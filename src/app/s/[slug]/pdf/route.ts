import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { authOptions } from '@/auth'
import { getCaseBySlug, getVersionById } from '@/lib/cases/operations'
import { canViewCase } from '@/lib/cases/access'
import { type CaseSnapshot, snapshotToFieldRows } from '@/lib/cases/snapshot'
import { convertFieldsToInputs } from '@/lib/cases/convert'
import { computeDeviations } from '@/lib/cases/deviations'
import { calculateRoi } from '@/lib/calculator/engine'
import { SummaryPdf } from '@/lib/pdf/summary-pdf'

export const dynamic = 'force-dynamic'

/**
 * PDF export of the published summary. Access rules are identical to /s/[slug]:
 * the case must be viewable by the requester and have a live published version.
 * Always renders the LIVE version — never the draft.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const session = await getServerSession(authOptions)
  const userId = session?.user?.id ?? null
  const role = session?.user?.role ?? null

  const roiCase = await getCaseBySlug(slug)
  if (!roiCase || !canViewCase(roiCase, userId, role)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const liveVersion = roiCase.liveVersionId
    ? await getVersionById(roiCase.liveVersionId)
    : null
  if (!liveVersion) {
    return new NextResponse('Not published yet', { status: 404 })
  }

  const snapshot = liveVersion.snapshot as CaseSnapshot
  const fields = snapshotToFieldRows(snapshot, roiCase.id)
  const outputs = calculateRoi(convertFieldsToInputs(fields))
  const deviations = computeDeviations(fields)

  const origin = new URL(req.url).origin
  const buffer = await renderToBuffer(
    createElement(SummaryPdf, {
      title: roiCase.title,
      summary: roiCase.summary,
      createdAt: roiCase.createdAt,
      publishedAt: liveVersion.publishedAt,
      outputs,
      deviations,
      shareUrl: `${origin}/s/${roiCase.shareSlug}`,
    })
  )

  const safeName = roiCase.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'summary'
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="IROI-${safeName}.pdf"`,
    },
  })
}
