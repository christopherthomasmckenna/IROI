import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import {
  getCaseBySlug,
  getCaseFields,
  getVersionById,
  listVersions,
} from '@/lib/cases/operations'
import { canViewCase, canEditCase } from '@/lib/cases/access'
import {
  type CaseSnapshot,
  snapshotToFieldRows,
  draftDiffersFromSnapshot,
} from '@/lib/cases/snapshot'
import {
  updateCaseTitleAction,
  updateCaseSummaryAction,
  toggleCasePrivacyAction,
  deleteCaseAction,
  publishCaseAction,
  restoreVersionAction,
} from '@/app/actions/cases'
import { CaseView } from './CaseView'
import { SummaryEditor } from './EditableRows'

// ─── Blocked-case CTA (anonymous visitors) ────────────────────────────────────

function BlockedCta() {
  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-zinc-900 mb-2">This case isn&apos;t available</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Log in and create your own RJC Impact ROI analysis.
      </p>
      <Link
        href="/login"
        className="inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium
                   text-white hover:bg-blue-700 transition-colors"
      >
        Log in and create your own
      </Link>
    </div>
  )
}

// ─── Version history (owner/admin only) ───────────────────────────────────────

interface VersionRow {
  id: string
  versionNumber: number
  publishedAt: Date
  publishedByEmail: string | null
}

function VersionHistory({
  versions,
  liveVersionId,
  caseId,
  caseSlug,
}: {
  versions: VersionRow[]
  liveVersionId: string | null
  caseId: string
  caseSlug: string
}) {
  if (versions.length === 0) {
    return (
      <section className="mb-10">
        <h2 className="text-base font-semibold text-zinc-900 mb-3 pb-2 border-b border-zinc-200">
          Version History
        </h2>
        <p className="text-sm text-zinc-400">
          No versions yet. Publish to create the first one.
        </p>
      </section>
    )
  }

  return (
    <section className="mb-10">
      <h2 className="text-base font-semibold text-zinc-900 mb-3 pb-2 border-b border-zinc-200">
        Version History
      </h2>
      <p className="text-xs text-zinc-400 mb-3">
        Only you can see this history. The public only ever sees the live version.
      </p>
      <div className="rounded-lg border border-zinc-100 bg-white divide-y divide-zinc-50">
        {versions.map((v) => {
          const isLive = v.id === liveVersionId
          const restore = restoreVersionAction.bind(null, caseId, caseSlug, v.versionNumber)
          return (
            <div key={v.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="font-medium text-zinc-700 w-12">v{v.versionNumber}</span>
              <span className="text-zinc-500 w-40 tabular-nums">
                {v.publishedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
              <span className="text-zinc-400 flex-1 min-w-0 truncate">{v.publishedByEmail}</span>
              {isLive && (
                <span className="rounded-full bg-blue-50 text-blue-700 text-xs px-2 py-0.5">live</span>
              )}
              <Link
                href={`/case/${caseSlug}/v/${v.versionNumber}`}
                className="text-zinc-500 hover:text-blue-600 transition-colors"
              >
                view
              </Link>
              {!isLive && (
                <form action={restore}>
                  <button
                    type="submit"
                    className="text-zinc-500 hover:text-blue-600 transition-colors"
                    title="Copy this version into your draft and make it live"
                  >
                    restore
                  </button>
                </form>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CasePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const session = await getServerSession(authOptions)
  const userId  = session?.user?.id   ?? null
  const role    = session?.user?.role ?? null

  const roiCase = await getCaseBySlug(slug)
  const viewable = roiCase ? canViewCase(roiCase, userId, role) : false

  if (!viewable || !roiCase) {
    if (!userId) return <BlockedCta />
    notFound()
  }

  const canEdit = canEditCase(roiCase, userId, role)

  // ── Viewer (non-owner): render the live published version, read-only ────────
  if (!canEdit) {
    const liveVersion = roiCase.liveVersionId
      ? await getVersionById(roiCase.liveVersionId)
      : null
    if (!liveVersion) notFound()

    const snapshot = liveVersion.snapshot as CaseSnapshot
    const fields = snapshotToFieldRows(snapshot, roiCase.id)

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900 mb-1">{roiCase.title}</h1>
          {roiCase.summary && (
            <p className="text-sm text-zinc-600 max-w-2xl mt-1 mb-2 whitespace-pre-wrap">
              {roiCase.summary}
            </p>
          )}
          <p className="text-xs text-zinc-400">
            Published {liveVersion.publishedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <CaseView
          fields={fields}
          editable={false}
          role={role}
          caseId={roiCase.id}
          caseSlug={roiCase.shareSlug}
        />
      </div>
    )
  }

  // ── Owner/admin: live editable draft + publish controls + history ───────────
  const draft = await getCaseFields(roiCase.id)
  const liveVersion = roiCase.liveVersionId
    ? await getVersionById(roiCase.liveVersionId)
    : null
  const versions = await listVersions(roiCase.id)

  const hasUnpublishedChanges = liveVersion
    ? draftDiffersFromSnapshot(draft, liveVersion.snapshot as CaseSnapshot)
    : true // never published → everything is unpublished

  const updateTitleAction = updateCaseTitleAction.bind(null, roiCase.id, roiCase.shareSlug)
  const updateSummaryAction = updateCaseSummaryAction.bind(null, roiCase.id, roiCase.shareSlug)
  const togglePrivacyAction = toggleCasePrivacyAction.bind(null, roiCase.id, roiCase.shareSlug, roiCase.isPrivate)
  const deleteAction = deleteCaseAction.bind(null, roiCase.id)
  const publishAction = publishCaseAction.bind(null, roiCase.id, roiCase.shareSlug)

  const liveVersionNumber = versions.find((v) => v.id === roiCase.liveVersionId)?.versionNumber ?? null
  // versions is desc-ordered, so versions[0] holds the true max — matches the
  // next number publishCase will assign (max + 1), even after a restore where
  // the live version is an older one.
  const nextVersionNumber = (versions[0]?.versionNumber ?? 0) + 1

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <form action={updateTitleAction} className="flex items-center gap-2 group mb-1">
            <input
              name="title"
              defaultValue={roiCase.title}
              className="text-2xl font-semibold text-zinc-900 bg-transparent border-b
                         border-transparent focus:border-zinc-300 focus:outline-none
                         focus:bg-white px-1 py-0.5 w-full max-w-lg"
            />
            <button
              type="submit"
              className="text-xs text-zinc-400 hover:text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Rename
            </button>
          </form>
          <p className="text-xs text-zinc-400">
            Created {roiCase.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}
            <span className={roiCase.isPrivate ? 'text-zinc-400' : 'text-blue-500'}>
              {roiCase.isPrivate ? 'Private' : 'Public'}
            </span>
          </p>

          <SummaryEditor
            key={roiCase.summary ?? ''}
            action={updateSummaryAction}
            initial={roiCase.summary ?? ''}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <form action={togglePrivacyAction}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Make {roiCase.isPrivate ? 'public' : 'private'}
            </button>
          </form>
          <form action={deleteAction}>
            <button
              type="submit"
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      {/* Publish bar */}
      <div className="flex items-center justify-between gap-4 mb-8 rounded-lg border border-zinc-200 bg-white px-4 py-3">
        <div className="text-sm">
          {liveVersionNumber === null ? (
            <span className="text-zinc-500">Not published yet — viewers can&apos;t see this case.</span>
          ) : hasUnpublishedChanges ? (
            <span className="text-amber-600">
              ● Unpublished changes — live version is v{liveVersionNumber}.
            </span>
          ) : (
            <span className="text-green-600">✓ Published — live version is v{liveVersionNumber}, up to date.</span>
          )}
          {roiCase.isPrivate && liveVersionNumber !== null && (
            <span className="text-zinc-400">  (private — make public for viewers to see it)</span>
          )}
        </div>
        <form action={publishAction}>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Publish v{nextVersionNumber}
          </button>
        </form>
      </div>

      <CaseView
        fields={draft}
        editable
        role={role}
        caseId={roiCase.id}
        caseSlug={roiCase.shareSlug}
      />

      <VersionHistory
        versions={versions}
        liveVersionId={roiCase.liveVersionId}
        caseId={roiCase.id}
        caseSlug={roiCase.shareSlug}
      />
    </div>
  )
}
