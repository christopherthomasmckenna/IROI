import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'RJC Impact ROI Calculator',
  description:
    'Interactive tool for calculating and sharing Restorative Justice Conferencing impact return on investment.',
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession(authOptions)

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900">
        <header className="bg-white border-b border-zinc-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="font-semibold text-zinc-900 hover:text-blue-600 transition-colors"
            >
              RJC Impact ROI
            </Link>

            <nav className="flex items-center gap-4 text-sm">
              {session ? (
                <>
                  <Link
                    href="/dashboard"
                    className="text-zinc-600 hover:text-zinc-900 transition-colors"
                  >
                    Dashboard
                  </Link>
                  {session.user.role === 'admin' && (
                    <Link
                      href="/admin"
                      className="text-zinc-600 hover:text-zinc-900 transition-colors"
                    >
                      Admin
                    </Link>
                  )}
                  <Link
                    href="/api/auth/signout"
                    className="text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    Sign out
                  </Link>
                </>
              ) : (
                <Link
                  href="/login"
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 transition-colors"
                >
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-zinc-200 bg-white py-4">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-xs text-zinc-400">
            RJC Impact ROI Calculator
          </div>
        </footer>
      </body>
    </html>
  )
}
