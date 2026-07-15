import Link from 'next/link'
import { listPublicCases } from '@/lib/cases/operations'
import { setCasePromotedAction } from '@/app/actions/admin'

export default async function AdminPromotePage() {
  // Promotion candidates are exactly the public + published cases (all owners).
  const cases = await listPublicCases()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">Promoted Cases</h1>
      <p className="text-sm text-zinc-500 mb-8 max-w-2xl">
        Feature a case on the public landing page. Only public, published cases can
        be promoted; if a promoted case is later made private or unpublished it
        automatically drops off the landing page.
      </p>

      {cases.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-8 py-12 text-center">
          <p className="text-zinc-500 text-sm">No public, published cases to promote yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left px-6 py-3 font-medium text-zinc-600">Case</th>
                <th className="text-left px-6 py-3 font-medium text-zinc-600">Owner</th>
                <th className="text-left px-6 py-3 font-medium text-zinc-600">Status</th>
                <th className="text-right px-6 py-3 font-medium text-zinc-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {cases.map((c) => {
                const promoted = c.promotedAt != null
                const toggle = setCasePromotedAction.bind(null, c.id, !promoted)
                return (
                  <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/case/${c.shareSlug}`}
                        className="font-medium text-zinc-900 hover:text-blue-600 transition-colors"
                      >
                        {c.title}
                      </Link>
                      {c.summary && (
                        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1 max-w-md">{c.summary}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-500">{c.ownerEmail}</td>
                    <td className="px-6 py-4">
                      {promoted ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-medium">
                          Promoted
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <form action={toggle}>
                        <button
                          type="submit"
                          className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                            promoted
                              ? 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {promoted ? 'Unpromote' : 'Promote'}
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
