import Link from 'next/link'
import { listPromotedCases } from '@/lib/cases/operations'
import { resolveParagraphs, resolveSingle } from '@/lib/cases/content'
import { getContentBlocks } from '@/lib/cases/content-blocks'

export default async function HomePage() {
  const cases = await listPromotedCases()
  const content = await getContentBlocks()
  const intro = resolveParagraphs('landing.intro', content)
  const instructions = resolveParagraphs('landing.instructions', content)
  const limitation = resolveSingle('landing.limitation', content)
  const studyUrl = resolveSingle('landing.study_url', content)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      {/* Hero / introduction */}
      <section className="mb-10">
        <h1 className="text-3xl font-bold text-zinc-900 mb-4">RJC Impact ROI</h1>
        <div className="space-y-3 text-zinc-600 max-w-3xl leading-relaxed">
          {intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={studyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium
                       text-white hover:bg-blue-700 transition-colors"
          >
            Read the original RJC study (PDF) →
          </a>
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium
                       text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Log in to build your own
          </Link>
        </div>
      </section>

      {/* Instructions — collapsed by default (native, no JS) */}
      {instructions.length > 0 && (
        <details className="mb-10 rounded-xl border border-zinc-200 bg-white">
          <summary className="cursor-pointer select-none px-5 py-3 font-medium text-zinc-800">
            How this model works
          </summary>
          <div className="space-y-3 px-5 pb-4 text-sm text-zinc-600 leading-relaxed">
            {instructions.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {limitation && (
              <p className="mt-3 border-t border-zinc-100 pt-3 text-xs italic text-zinc-400">
                {limitation}
              </p>
            )}
          </div>
        </details>
      )}

      {/* Promoted cases */}
      <section>
        <h2 className="text-xl font-semibold text-zinc-900 mb-4">Featured analyses</h2>
        {cases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-8 py-12 text-center">
            <p className="text-sm text-zinc-400">No featured analyses yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {cases.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <Link href={`/case/${c.shareSlug}`} className="block">
                  <h3 className="font-medium text-zinc-900 mb-1">{c.title}</h3>
                  {c.summary && <p className="text-sm text-zinc-500 line-clamp-3">{c.summary}</p>}
                  <p className="mt-2 text-xs text-zinc-400">{c.ownerEmail}</p>
                </Link>
                <div className="mt-3 flex items-center gap-3 text-xs">
                  <Link href={`/s/${c.shareSlug}`} className="text-blue-600 hover:text-blue-800 transition-colors">
                    Summary →
                  </Link>
                  <a href={`/s/${c.shareSlug}/pdf`} className="text-blue-600 hover:text-blue-800 transition-colors">
                    Download PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
