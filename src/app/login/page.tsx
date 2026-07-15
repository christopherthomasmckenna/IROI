'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await signIn('email', {
      email,
      callbackUrl: '/dashboard',
      redirect: false,
    })

    if (result?.error) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    } else {
      router.push('/login/verify')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm px-8 py-10">
          <h1 className="text-xl font-semibold text-zinc-900 mb-1">Sign in</h1>
          <p className="text-sm text-zinc-500 mb-8">
            Enter your email and we&apos;ll send you a sign-in link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm
                           text-zinc-900 placeholder-zinc-400 focus:outline-none
                           focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium
                         text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? 'Sending link…' : 'Send magic link'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
