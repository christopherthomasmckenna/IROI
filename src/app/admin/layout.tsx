import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'

/**
 * Server-side admin gate. The proxy only checks that a session cookie is present
 * (it can't read roles from a database session at the edge); the actual role
 * check happens here. Non-admins get a 404 — no hint the area exists.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'admin') notFound()

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8 flex items-center gap-4 border-b border-zinc-200 pb-3">
        <Link href="/admin" className="text-lg font-semibold text-zinc-900 hover:text-blue-600">
          Admin
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/admin/fields" className="text-zinc-500 hover:text-zinc-900 transition-colors">
            Field Explanations
          </Link>
          <Link href="/admin/users" className="text-zinc-500 hover:text-zinc-900 transition-colors">
            Users &amp; Roles
          </Link>
          <Link href="/admin/promote" className="text-zinc-500 hover:text-zinc-900 transition-colors">
            Promoted Cases
          </Link>
          <Link href="/admin/content" className="text-zinc-500 hover:text-zinc-900 transition-colors">
            Landing &amp; Content
          </Link>
        </nav>
      </div>
      {children}
    </div>
  )
}
