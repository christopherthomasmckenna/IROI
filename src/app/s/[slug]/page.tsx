import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { getCaseBySlug, getVersionById } from '@/lib/cases/operations'
import { canViewCase } from '@/lib/cases/access'
import { type CaseSnapshot, snapshotToFieldRows } from '@/lib/cases/snapshot'
import { convertFieldsToInputs } from '@/lib/cases/convert'
import { computeDeviations } from '@/lib/cases/deviations'
import { calculateRoi } from '@/lib/calculator/engine'
import { IroiSummary, IroiDerivation } from '@/components/iroi'
import { ProvenanceBrief } from '@/components/provenance'

function BlockedCta() {
  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-zinc-900 mb-2">This summary isn&apos;t available</h1>
      <p className="text-sm text-zinc-500 mb-6">Log in and create your own RJC Impact ROI analysis.</p>
      <Link
        href="/login"
        className="inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Log in and create your own
      </Link>
    </div>
  )
}

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const session = await getServerSession(authOptions)
  const userId = session?.user?.id ?? null
  const role = session?.user?.role ?? null

  const roiCase = await getCaseBySlug(slug)
  const viewable = roiCase ? canViewCase(roiCase, userId, role) : false
  if (!viewable || !roiCase) {
    if (!userId) return <BlockedCta />
    notFound()
  }

  const liveVersion = roiCase.liveVersionId ? await getVersionById(roiCase.liveVersionId) : null

  // Owner/admin can reach an unpublished case's summary URL — there's nothing to
  // summarize until it's published.
  if (!liveVersion) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-zinc-900 mb-2">Not published yet</h1>
        <p className="text-sm text-zinc-500 mb-6">
          Publish this case to generate its shareable summary.
        </p>
        <Link
          href={`/case/${roiCase.shareSlug}`}
          className="inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Go to the case
        </Link>
      </div>
    )
  }

  const snapshot = liveVersion.snapshot as CaseSnapshot
  const fields = snapshotToFieldRows(snapshot, roiCase.id)
  const outputs = calculateRoi(convertFieldsToInputs(fields))
  const deviations = computeDeviations(fields)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900 mb-1">{roiCase.title}</h1>
        {roiCase.summary && (
          <p className="text-sm text-zinc-600 max-w-2xl mt-1 whitespace-pre-wrap">{roiCase.summary}</p>
        )}
        <p className="text-xs text-zinc-400 mt-2">
          Published {liveVersion.publishedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Blue bar */}
      <div className="mb-8">
        <IroiSummary outputs={outputs} />
      </div>

      {/* Provenance: entry date + deviations from the Philadelphia defaults */}
      <ProvenanceBrief
        createdAt={roiCase.createdAt}
        publishedAt={liveVersion.publishedAt}
        deviations={deviations}
      />

      {/* The math */}
      <section className="mb-6">
        <h2 className="text-base font-semibold text-zinc-900 mb-3">How the numbers add up</h2>
        <IroiDerivation outputs={outputs} />
      </section>

      {/* How this is calculated */}
      <details className="mb-8 rounded-xl border border-zinc-200 bg-white">
        <summary className="cursor-pointer select-none px-5 py-3 font-medium text-zinc-800">
          How is this calculated?
        </summary>
        <div className="space-y-3 px-5 pb-5 text-sm leading-relaxed text-zinc-600">
          <p>
            Impact ROI (IROI) is the return for every dollar invested in a Restorative Justice
            Conferencing (RJC) program, compared with putting the same case through the Criminal
            Justice System (CJS). It is calculated per case — one case is one responsible party
            eligible for an RJC referral.
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              <span className="font-medium text-zinc-800">Program savings</span> — the CJS cost
              avoided by diverting the case to RJC, minus the RJC program&apos;s own cost.
            </li>
            <li>
              <span className="font-medium text-zinc-800">Total benefits</span> — the dollar value
              to harmed parties, the responsible party, and the community (restitution, avoided lost
              income, increased earnings, community service, recidivism reduction, and more).
            </li>
            <li>
              <span className="font-medium text-zinc-800">Overall benefit</span> — program savings
              plus total benefits.
            </li>
            <li>
              <span className="font-medium text-zinc-800">Impact ROI</span> — overall benefit divided
              by the RJC cost. An IROI of 11× means every $1 invested in RJC returns about $11 in
              savings and social benefit.
            </li>
          </ol>
          <p>
            <span className="font-medium text-zinc-800">Why three numbers?</span> CJS costs vary
            widely by jurisdiction and case path (court time, incarceration), while RJC costs are
            relatively stable. The Low / Medium / High columns show conservative, central, and
            high-cost CJS scenarios. Every input can be tailored to a specific jurisdiction in the
            full case.
          </p>
        </div>
      </details>

      <Link
        href={`/case/${roiCase.shareSlug}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
      >
        View full case for all inputs and sources →
      </Link>
    </div>
  )
}
