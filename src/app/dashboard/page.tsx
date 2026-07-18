import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { listMyCases } from '@/lib/cases/operations'
import { createCaseAction } from '@/app/actions/cases'
import { ShareButton } from './ShareButton'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const cases = await listMyCases(session.user.id)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">My Cases</h1>
        <CreateCaseForm />
      </div>

      {cases.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white px-8 py-16 text-center">
          <p className="text-zinc-500 text-sm mb-4">You don&apos;t have any cases yet.</p>
          <p className="text-zinc-400 text-xs">
            Use the &ldquo;New Case&rdquo; button above to create your first analysis.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="text-left px-6 py-3 font-medium text-zinc-600">Title</th>
                <th className="text-left px-6 py-3 font-medium text-zinc-600">Created by</th>
                <th className="text-left px-6 py-3 font-medium text-zinc-600">Date</th>
                <th className="text-left px-6 py-3 font-medium text-zinc-600">Visibility</th>
                <th className="text-right px-6 py-3 font-medium text-zinc-600">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      href={`/case/${c.shareSlug}`}
                      className="font-medium text-zinc-900 hover:text-blue-600 transition-colors"
                    >
                      {c.title}
                    </Link>
                    {c.summary && (
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2 max-w-md">
                        {c.summary}
                      </p>
                    )}
                    {c.liveVersionId && (
                      <span className="inline-flex items-center gap-3 mt-1">
                        <Link
                          href={`/s/${c.shareSlug}`}
                          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          View summary →
                        </Link>
                        <a
                          href={`/s/${c.shareSlug}/pdf`}
                          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          Download PDF
                        </a>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-zinc-500">{c.ownerEmail}</td>
                  <td className="px-6 py-4 text-zinc-400">
                    {c.createdAt.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.isPrivate
                          ? 'bg-zinc-100 text-zinc-500'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {c.isPrivate ? 'Private' : 'Public'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!c.isPrivate && <ShareButton slug={c.shareSlug} title={c.title} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CreateCaseForm() {
  return (
    <form action={createCaseAction} className="flex items-center gap-2">
      <input
        name="title"
        required
        placeholder="Case title…"
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900
                   placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500
                   focus:border-transparent w-56"
      />
      <button
        type="submit"
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white
                   hover:bg-blue-700 transition-colors whitespace-nowrap"
      >
        New Case
      </button>
    </form>
  )
}
