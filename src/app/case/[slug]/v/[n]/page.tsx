import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { getCaseBySlug, getVersion } from '@/lib/cases/operations'
import { canEditCase } from '@/lib/cases/access'
import { type CaseSnapshot, snapshotToFieldRows } from '@/lib/cases/snapshot'
import { restoreVersionAction } from '@/app/actions/cases'
import { CaseView } from '../../CaseView'

/**
 * Read-only view of a single past version. Owner/admin only — version history is
 * never public (a viewer hitting this gets a 404, same as a non-existent case).
 */
export default async function VersionPage({
  params,
}: {
  params: Promise<{ slug: string; n: string }>
}) {
  const { slug, n } = await params
  const versionNumber = Number.parseInt(n, 10)
  if (!Number.isInteger(versionNumber) || versionNumber < 1) notFound()

  const session = await getServerSession(authOptions)
  const userId  = session?.user?.id   ?? null
  const role    = session?.user?.role ?? null

  const roiCase = await getCaseBySlug(slug)
  if (!roiCase) notFound()

  // History is owner/admin only.
  if (!canEditCase(roiCase, userId, role)) notFound()

  const version = await getVersion(roiCase.id, versionNumber)
  if (!version) notFound()

  const snapshot = version.snapshot as CaseSnapshot
  const fields = snapshotToFieldRows(snapshot, roiCase.id)
  const isLive = version.id === roiCase.liveVersionId
  const restore = restoreVersionAction.bind(null, roiCase.id, roiCase.shareSlug, versionNumber)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-6">
        <Link
          href={`/case/${roiCase.shareSlug}`}
          className="text-sm text-zinc-400 hover:text-blue-600 transition-colors"
        >
          ← Back to {roiCase.title}
        </Link>
        <div className="flex items-start justify-between gap-4 mt-2">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 mb-1">
              {snapshot.title}{' '}
              <span className="text-zinc-400 font-normal">· version {versionNumber}</span>
              {isLive && (
                <span className="ml-2 align-middle rounded-full bg-blue-50 text-blue-700 text-xs px-2 py-0.5">
                  live
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-400">
              Published {version.publishedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              {' · read-only snapshot'}
            </p>
          </div>
          {!isLive && (
            <form action={restore}>
              <button
                type="submit"
                className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
                title="Copy this version into your draft and make it live"
              >
                Restore this version
              </button>
            </form>
          )}
        </div>
      </div>

      <CaseView
        fields={fields}
        editable={false}
        role={role}
        caseId={roiCase.id}
        caseSlug={roiCase.shareSlug}
        stickyIroi={false}
      />
    </div>
  )
}
