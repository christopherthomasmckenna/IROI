import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { listUsers } from '@/lib/users'
import { setUserRoleAction } from '@/app/actions/admin'

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions)
  const users = await listUsers()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">Users &amp; Roles</h1>
      <p className="text-sm text-zinc-500 mb-8 max-w-2xl">
        Everyone who has signed in. Promote a creator to admin, or demote an admin
        back to creator. You can&apos;t change your own role, and the last remaining
        admin can&apos;t be demoted.
      </p>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="text-left px-6 py-3 font-medium text-zinc-600">Email</th>
              <th className="text-left px-6 py-3 font-medium text-zinc-600">Role</th>
              <th className="text-left px-6 py-3 font-medium text-zinc-600">Cases</th>
              <th className="text-left px-6 py-3 font-medium text-zinc-600">Joined</th>
              <th className="text-right px-6 py-3 font-medium text-zinc-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map((u) => {
              const isSelf = u.id === session?.user?.id
              const targetRole: typeof u.role = u.role === 'admin' ? 'creator' : 'admin'
              const action = setUserRoleAction.bind(null, u.id, targetRole)
              return (
                <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4 text-zinc-900">
                    {u.email}
                    {isSelf && <span className="ml-2 text-xs text-zinc-400">(you)</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.role === 'admin' ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 tabular-nums">{u.caseCount}</td>
                  <td className="px-6 py-4 text-zinc-400">
                    {u.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isSelf ? (
                      <span className="text-xs text-zinc-300">—</span>
                    ) : (
                      <form action={action}>
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
                        >
                          {u.role === 'admin' ? 'Make creator' : 'Make admin'}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
