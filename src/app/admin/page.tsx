import Link from 'next/link'

export default function AdminHome() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 mb-6">Admin</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/fields"
          className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <h2 className="font-medium text-zinc-900 mb-1">Field Explanations</h2>
          <p className="text-sm text-zinc-500">
            Edit the ⓘ tooltip text shown for each model variable. Changes apply to
            every case.
          </p>
        </Link>

        <Link
          href="/admin/users"
          className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <h2 className="font-medium text-zinc-900 mb-1">Users &amp; Roles</h2>
          <p className="text-sm text-zinc-500">
            Promote or demote users between creator and admin.
          </p>
        </Link>

        <Link
          href="/admin/promote"
          className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <h2 className="font-medium text-zinc-900 mb-1">Promoted Cases</h2>
          <p className="text-sm text-zinc-500">
            Feature published public cases on the landing page.
          </p>
        </Link>

        <Link
          href="/admin/content"
          className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <h2 className="font-medium text-zinc-900 mb-1">Landing &amp; Content</h2>
          <p className="text-sm text-zinc-500">
            Edit landing-page copy and the per-section instructions.
          </p>
        </Link>
      </div>
    </div>
  )
}
