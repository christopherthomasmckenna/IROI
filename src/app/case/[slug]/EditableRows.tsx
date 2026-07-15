'use client'

import { useState } from 'react'
import { InfoTip } from './InfoTip'
import type { Adornment } from '@/lib/cases/field-units'

// Client editable rows. Plain serializable props only (no Maps / function
// children — those can't cross the server/client boundary). Dirty = controlled
// values differ from initial props; the parent remounts the row on a
// persisted-value key after a save, re-seeding state and clearing dirty.

function SaveButton({ dirty }: { dirty: boolean }) {
  return (
    <button
      type="submit"
      className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
        dirty ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' : 'bg-zinc-100 text-zinc-400'
      }`}
    >
      {dirty ? 'Save •' : 'Save'}
    </button>
  )
}

/**
 * A number input with a grayed, non-editable unit adornment, with the value AND
 * its unit right-justified together inside the box ("$1,500", "Cases 1", "80%").
 * The input is sized to its content so the unit stays adjacent to the number.
 */
export function AdornedInput({
  name,
  value,
  onChange,
  adornment,
}: {
  name: string
  value: string
  onChange: (v: string) => void
  adornment: Adornment
}) {
  const { prefix, suffix } = adornment
  return (
    <div
      className="flex items-center justify-end gap-0.5 min-w-0 rounded border border-zinc-300 px-2 py-1
                 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500"
    >
      {prefix && <span className="shrink-0 text-sm text-zinc-400">{prefix}</span>}
      <input
        name={name}
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: `${Math.max(2, value.length) + 1}ch` }}
        className="min-w-0 max-w-full bg-transparent p-0 text-right text-sm text-zinc-900 tabular-nums
                   border-0 focus:outline-none focus:ring-0"
      />
      {suffix && <span className="shrink-0 text-sm text-zinc-400">{suffix}</span>}
    </div>
  )
}

export interface EditableCol {
  name: string
  value: number
  adornment: Adornment
}

export function EditableGroupedRow({
  action,
  rowLabel,
  note,
  cols,
  annotation,
  modified,
  gridCols,
}: {
  action: (formData: FormData) => void
  rowLabel: string
  note: string | null
  cols: EditableCol[]
  annotation: string
  modified: boolean
  gridCols: string
}) {
  const [vals, setVals] = useState(() => cols.map((c) => String(c.value)))
  const [ann, setAnn] = useState(annotation)
  const dirty = vals.some((v, i) => v !== String(cols[i].value)) || ann !== annotation

  return (
    <form action={action} className="rounded-lg border border-zinc-100 bg-white px-4 pt-3 pb-2">
      <div className="flex items-start gap-1.5 mb-1.5">
        <InfoTip text={note} />
        <span className="text-sm text-zinc-700 leading-5">{rowLabel}</span>
        {modified && <span className="text-xs text-amber-600 mt-0.5" title="Changed from default">●</span>}
      </div>
      <div className={`grid ${gridCols} gap-2`}>
        {cols.map((c, i) => (
          <AdornedInput
            key={c.name}
            name={c.name}
            value={vals[i]}
            onChange={(v) => setVals((prev) => prev.map((x, j) => (j === i ? v : x)))}
            adornment={c.adornment}
          />
        ))}
      </div>
      <div className="flex items-start gap-2 mt-2">
        <textarea
          name="annotation"
          rows={2}
          value={ann}
          onChange={(e) => setAnn(e.target.value)}
          placeholder="Note on change (optional)"
          className="flex-1 min-w-0 resize-y rounded border border-zinc-200 px-2 py-1 text-sm
                     text-zinc-700 placeholder-zinc-300 focus:outline-none focus:ring-1
                     focus:ring-blue-500 focus:border-blue-500"
        />
        <SaveButton dirty={dirty} />
      </div>
    </form>
  )
}

export function SummaryEditor({
  action,
  initial,
}: {
  action: (formData: FormData) => void
  initial: string
}) {
  const [val, setVal] = useState(initial)
  const dirty = val !== initial
  return (
    <form action={action} className="mt-3 max-w-2xl">
      <label htmlFor="case-summary" className="block text-xs text-zinc-400 mb-1">
        Summary (a brief description of this case)
      </label>
      <textarea
        id="case-summary"
        name="summary"
        rows={2}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="e.g. what program, jurisdiction, or scenario this case models"
        className="w-full resize-y rounded border border-zinc-200 px-2 py-1.5 text-sm
                   text-zinc-700 placeholder-zinc-300 focus:outline-none focus:ring-1
                   focus:ring-blue-500 focus:border-blue-500"
      />
      <div className="mt-1">
        <SaveButton dirty={dirty} />
      </div>
    </form>
  )
}

export function EditableFieldRow({
  action,
  value,
  annotation,
  modified,
  adornment,
}: {
  action: (formData: FormData) => void
  value: string
  annotation: string
  modified: boolean
  adornment: Adornment
}) {
  const [val, setVal] = useState(value)
  const [ann, setAnn] = useState(annotation)
  const dirty = val !== value || ann !== annotation

  return (
    <form action={action} className="flex items-start gap-2 flex-1 min-w-0">
      <div className="w-28 shrink-0">
        <AdornedInput name="value" value={val} onChange={setVal} adornment={adornment} />
      </div>
      <input
        name="annotation"
        type="text"
        value={ann}
        onChange={(e) => setAnn(e.target.value)}
        placeholder="Note on change (optional)"
        className="flex-1 min-w-0 rounded border border-zinc-200 px-2 py-1 text-sm
                   text-zinc-700 placeholder-zinc-300 focus:outline-none focus:ring-1
                   focus:ring-blue-500 focus:border-blue-500"
      />
      <SaveButton dirty={dirty} />
      {modified && (
        <span className="shrink-0 mt-1 text-xs text-amber-600" title="Changed from default">●</span>
      )}
    </form>
  )
}
