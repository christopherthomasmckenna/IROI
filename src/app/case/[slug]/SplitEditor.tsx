'use client'

import { useState } from 'react'
import { AdornedInput } from './EditableRows'

// Mirror of SPLIT_SUM_TOLERANCE (server) expressed in percentage points.
const TOLERANCE_PCT = 0.05

interface SplitEditorProps {
  // Bound server action: updateSplitAction.bind(null, caseId, caseSlug)
  action: (formData: FormData) => void
  // Current values as percentages (0–100)
  initial: { resolution: number; preconf: number; conf: number }
  editable: boolean
  // Server-rendered hint + guidance disclosure (see components/guidance.tsx)
  guidance?: React.ReactNode
  // The split's single shared annotation (creator's note for the whole split)
  initialAnnotation?: string | null
}

const COLS = [
  { name: 'resolution_pct',             header: 'Full resolution %' },
  { name: 'preconferencing_only_pct',   header: 'Pre-conferencing only % (→ CJS)' },
  { name: 'conferenced_unresolved_pct', header: 'Conferenced unresolved % (→ CJS)' },
] as const

export function SplitEditor({
  action,
  initial,
  editable,
  guidance,
  initialAnnotation,
}: SplitEditorProps) {
  const [resolution, setResolution] = useState(String(initial.resolution))
  const [preconf, setPreconf]       = useState(String(initial.preconf))
  const [conf, setConf]             = useState(String(initial.conf))

  const valueOf: Record<string, string> = {
    resolution_pct: resolution,
    preconferencing_only_pct: preconf,
    conferenced_unresolved_pct: conf,
  }
  const setterOf: Record<string, (v: string) => void> = {
    resolution_pct: setResolution,
    preconferencing_only_pct: setPreconf,
    conferenced_unresolved_pct: setConf,
  }

  const nums = [resolution, preconf, conf].map((s) => parseFloat(s))
  const allValid = nums.every((n) => Number.isFinite(n) && n >= 0)
  const total = allValid ? nums[0] + nums[1] + nums[2] : NaN
  const atHundred = allValid && Math.abs(total - 100) <= TOLERANCE_PCT

  const header = (
    <div className="mb-1.5">
      <span className="text-sm font-semibold text-zinc-600">Case Outcome Split</span>
      {guidance}
    </div>
  )

  const columnHeaders = (
    <div className="grid grid-cols-3 gap-2 mb-1 text-xs text-zinc-400">
      {COLS.map((c) => (
        <span key={c.name}>{c.header}</span>
      ))}
    </div>
  )

  if (!editable) {
    return (
      <div className="rounded-lg border border-zinc-100 bg-white px-4 pt-3 pb-2">
        {header}
        {columnHeaders}
        <div className="grid grid-cols-3 gap-2">
          {COLS.map((c) => (
            <span key={c.name} className="text-sm text-zinc-900 tabular-nums">
              {valueOf[c.name]}%
            </span>
          ))}
        </div>
        {initialAnnotation && <p className="mt-2 text-sm text-zinc-400 italic">{initialAnnotation}</p>}
      </div>
    )
  }

  return (
    <form action={action} className="rounded-lg border border-zinc-100 bg-white px-4 pt-3 pb-2">
      {header}
      {columnHeaders}
      <div className="grid grid-cols-3 gap-2">
        {COLS.map((c) => (
          <AdornedInput
            key={c.name}
            name={c.name}
            value={valueOf[c.name]}
            onChange={(v) => setterOf[c.name](v)}
            adornment={{ suffix: '%', align: 'right' }}
          />
        ))}
      </div>

      <textarea
        name="annotation"
        rows={2}
        defaultValue={initialAnnotation ?? ''}
        placeholder="Note on change (optional)"
        className="w-full mt-2 resize-y rounded border border-zinc-200 px-2 py-1.5 text-sm
                   text-zinc-700 placeholder-zinc-300 focus:outline-none focus:ring-1
                   focus:ring-blue-500 focus:border-blue-500"
      />

      <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between">
        <span className={`text-sm tabular-nums ${atHundred ? 'text-green-600' : 'text-amber-600'}`}>
          Total: {allValid ? total.toFixed(2) : '—'}%
          {!atHundred && allValid && '  ⚠ must equal 100%'}
        </span>
        <button
          type="submit"
          disabled={!atHundred}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white
                     hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save split
        </button>
      </div>
    </form>
  )
}
