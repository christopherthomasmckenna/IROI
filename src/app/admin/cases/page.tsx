import Link from 'next/link'
import { listAllCases } from '@/lib/cases/operations'

/**
 * Admin: every case in the database with its author, visibility, and publish
 * state. The admin layout already gates this route to admins (404 otherwise);
 * admins can open any case from here (canViewCase/canEditCase allow it).
 */
export default async function AdminCasesPage() {
  const cases = await listAllCases()

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 mb-1">All Cases</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Every case in the database — including other users&apos; private drafts. {cases.length} total.
      </p>

      {cases.length === 0 ? (
        <p className="text-sm text-zinc-400">No cases yet.</p>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Author</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Visibility</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Published</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Created</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/case/${c.shareSlug}`}
                      className="font-medium text-zinc-900 hover:text-blue-600 transition-colors"
                    >
                      {c.title}
                    </Link>
                    {c.promotedAt && (
                      <span className="ml-2 rounded-full bg-amber-50 text-amber-700 text-xs px-2 py-0.5">
                        promoted
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{c.ownerEmail}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.isPrivate ? 'bg-zinc-100 text-zinc-500' : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {c.isPrivate ? 'Private' : 'Public'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.liveVersionId ? (
                      <span className="inline-flex items-center gap-3">
                        <span className="text-green-600 text-xs">✓ published</span>
                        <Link
                          href={`/s/${c.shareSlug}`}
                          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          summary
                        </Link>
                        <a
                          href={`/s/${c.shareSlug}/pdf`}
                          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          PDF
                        </a>
                      </span>
                    ) : (
                      <span className="text-zinc-300 text-xs">draft only</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{fmt(c.createdAt)}</td>
                  <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{fmt(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
