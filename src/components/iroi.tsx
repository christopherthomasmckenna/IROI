import type { RoiOutputs, Sensitivity } from '@/lib/calculator/types'

function fmtIroi(v: number): string {
  return v.toFixed(2)
}
function fmtUsd(v: number): string {
  return '$' + Math.round(v).toLocaleString('en-US')
}

/** The "blue bar" — headline IROI multipliers + key metrics. */
export function IroiSummary({ outputs }: { outputs: RoiOutputs }) {
  const { iroi, rjc_avg_cost_per_case, iroi_by_category_medium } = outputs
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-blue-700 mb-3">Impact ROI</h2>
      <div className="grid grid-cols-3 gap-6 mb-4">
        {(
          [
            ['Low', iroi.low],
            ['Medium', iroi.medium],
            ['High', iroi.high],
          ] as [string, number][]
        ).map(([label, value]) => (
          <div key={label} className="text-center">
            <div className="text-2xl font-bold text-blue-800 tabular-nums">{fmtIroi(value)}×</div>
            <div className="text-xs text-blue-500 mt-0.5">{label} sensitivity</div>
          </div>
        ))}
      </div>
      <div className="border-t border-blue-200 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-blue-700">
        <div>
          <div className="text-blue-500">RJC avg cost/case</div>
          <div className="font-medium tabular-nums">{fmtUsd(rjc_avg_cost_per_case)}</div>
        </div>
        <div>
          <div className="text-blue-500">Program savings (med)</div>
          <div className="font-medium tabular-nums">{fmtIroi(iroi_by_category_medium.program_savings)}×</div>
        </div>
        <div>
          <div className="text-blue-500">RP benefits (med)</div>
          <div className="font-medium tabular-nums">{fmtIroi(iroi_by_category_medium.responsible_party_benefits)}×</div>
        </div>
        <div>
          <div className="text-blue-500">Community benefits (med)</div>
          <div className="font-medium tabular-nums">{fmtIroi(iroi_by_category_medium.community_benefits)}×</div>
        </div>
      </div>
    </div>
  )
}

type Sens = keyof Sensitivity<number>

/** The full derivation that turns the three section subtotals into the IROI. */
export function IroiDerivation({ outputs }: { outputs: RoiOutputs }) {
  const rjc = outputs.rjc_avg_cost_per_case
  const cjs = (s: Sens) => outputs.cjs_cost_per_case[s]
  const benefit = (s: Sens) => outputs.hp_benefit + outputs.rp_benefit[s] + outputs.community_benefit[s]
  const savings = (s: Sens) => cjs(s) - rjc
  const overall = (s: Sens) => savings(s) + benefit(s)

  const rows: Array<{ label: string; cell: (s: Sens) => string; strong?: boolean; total?: boolean }> = [
    { label: 'CJS cost / case', cell: (s) => fmtUsd(cjs(s)) },
    { label: '−  RJC avg cost / case', cell: () => '−' + fmtUsd(rjc) },
    { label: '=  Program savings', cell: (s) => fmtUsd(savings(s)), strong: true },
    { label: '+  Total HP + RP + Community benefit', cell: (s) => fmtUsd(benefit(s)) },
    { label: '=  Overall benefit', cell: (s) => fmtUsd(overall(s)), strong: true },
    { label: '÷  RJC avg cost / case', cell: () => fmtUsd(rjc) },
    { label: '=  Impact ROI', cell: (s) => fmtIroi(outputs.iroi[s]) + '×', strong: true, total: true },
  ]
  const sens: Sens[] = ['low', 'medium', 'high']

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
            <th className="text-left px-4 py-2 font-medium">Per case</th>
            <th className="text-right px-4 py-2 font-medium">Low</th>
            <th className="text-right px-4 py-2 font-medium">Medium</th>
            <th className="text-right px-4 py-2 font-medium">High</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {rows.map((r) => (
            <tr key={r.label} className={r.total ? 'bg-blue-50' : undefined}>
              <td className={`px-4 py-2 ${r.strong ? 'font-medium text-zinc-800' : 'text-zinc-500'}`}>
                {r.label}
              </td>
              {sens.map((s) => (
                <td
                  key={s}
                  className={`px-4 py-2 text-right tabular-nums ${
                    r.total ? 'font-bold text-blue-800' : r.strong ? 'font-semibold text-zinc-900' : 'text-zinc-600'
                  }`}
                >
                  {r.cell(s)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
