export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm px-8 py-10 text-center">
          <div className="text-3xl mb-4">✉️</div>
          <h1 className="text-xl font-semibold text-zinc-900 mb-2">Check your email</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            A sign-in link has been sent to your email address.
            Click the link to complete sign-in.
          </p>
          <p className="text-xs text-zinc-400 mt-6">
            In development, the link is logged to the server console.
          </p>
        </div>
      </div>
    </div>
  )
}
