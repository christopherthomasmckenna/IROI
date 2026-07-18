import type { Deviation } from '@/lib/cases/deviations'

/**
 * Provenance brief for a published summary: when the case was entered, and
 * every way it deviates from the original Philadelphia model defaults, with
 * the creator's note for each change. Renders on /s/[slug] and mirrors the
 * content of the PDF export.
 */
export function ProvenanceBrief({
  createdAt,
  publishedAt,
  deviations,
}: {
  createdAt: Date
  publishedAt: Date
  deviations: Deviation[]
}) {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <section className="mb-8 rounded-xl border border-zinc-200 bg-white">
      <div className="px-5 py-3 border-b border-zinc-100">
        <h2 className="text-base font-semibold text-zinc-900">About this analysis</h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Entered {fmt(createdAt)} · published {fmt(publishedAt)}
        </p>
      </div>

      <div className="px-5 py-4">
        {deviations.length === 0 ? (
          <p className="text-sm text-zinc-500">
            This analysis uses the original Philadelphia model defaults unchanged.
          </p>
        ) : (
          <>
            <p className="text-sm text-zinc-500 mb-3">
              This analysis changes{' '}
              <span className="font-medium text-zinc-700">
                {deviations.length} input{deviations.length === 1 ? '' : 's'}
              </span>{' '}
              from the original Philadelphia model. Each change is shown against the
              default it replaced, with the author&apos;s note where provided.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-400 border-b border-zinc-100">
                    <th className="text-left font-medium py-1.5 pr-3">Input</th>
                    <th className="text-right font-medium py-1.5 pr-3 whitespace-nowrap">Philadelphia default</th>
                    <th className="text-right font-medium py-1.5 pr-3 whitespace-nowrap">This analysis</th>
                    <th className="text-left font-medium py-1.5">Author&apos;s note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {deviations.map((d) => (
                    <tr key={d.fieldKey} className="align-top">
                      <td className="py-2 pr-3">
                        <span className="text-zinc-800">{d.fieldLabel}</span>
                        {d.rowLabel && (
                          <span className="block text-xs text-zinc-400 max-w-xs truncate" title={d.rowLabel}>
                            {d.rowLabel}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right text-zinc-400 tabular-nums whitespace-nowrap">
                        {d.defaultDisplay}
                      </td>
                      <td className="py-2 pr-3 text-right font-medium text-zinc-900 tabular-nums whitespace-nowrap">
                        {d.currentDisplay}
                      </td>
                      <td className="py-2 text-zinc-500 italic">{d.annotation ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
