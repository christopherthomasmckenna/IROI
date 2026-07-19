'use client'

import { useState } from 'react'
import { Markdown } from '@/components/guidance'

/**
 * Admin editor for one variable's layered guidance. Four structured fields
 * (GOV.UK-style help layers) with a live preview of how the case page renders
 * them. Saving all-empty reverts the variable to its defaults.
 */

const FIELD_CLS =
  'w-full resize-y rounded border border-zinc-200 px-2 py-1.5 text-sm text-zinc-700 ' +
  'placeholder-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500'

export function GuidanceEditor({
  variableKey,
  label,
  hasRow,
  defaultMeaning,
  initial,
  action,
}: {
  variableKey: string
  label: string
  hasRow: boolean
  /** JSON-derived fallback shown/used when no meaning is authored. */
  defaultMeaning: string | null
  initial: {
    shortHint: string
    meaning: string
    howToLocalize: string
    provenance: string
  }
  action: (formData: FormData) => void
}) {
  const [shortHint, setShortHint] = useState(initial.shortHint)
  const [meaning, setMeaning] = useState(initial.meaning)
  const [howToLocalize, setHowToLocalize] = useState(initial.howToLocalize)
  const [provenance, setProvenance] = useState(initial.provenance)
  const [showPreview, setShowPreview] = useState(false)

  const dirty =
    shortHint !== initial.shortHint ||
    meaning !== initial.meaning ||
    howToLocalize !== initial.howToLocalize ||
    provenance !== initial.provenance

  const effectiveMeaning = meaning.trim() || defaultMeaning || ''

  return (
    <form action={action} className="rounded-lg border border-zinc-100 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-sm font-medium text-zinc-700">{label}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
            hasRow ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-400'
          }`}
        >
          {hasRow ? 'custom' : 'default'}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Short hint — one sentence, always visible under the label (plain text)
          </label>
          <input
            name="short_hint"
            value={shortHint}
            maxLength={140}
            onChange={(e) => setShortHint(e.target.value)}
            placeholder="e.g. Your county's average daily cost to hold one person in jail"
            className={FIELD_CLS}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            What this input means — markdown allowed; empty = use the model default below
          </label>
          <textarea
            name="meaning"
            rows={3}
            value={meaning}
            onChange={(e) => setMeaning(e.target.value)}
            placeholder={defaultMeaning ?? ''}
            className={FIELD_CLS}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            How to find your local value — markdown allowed
          </label>
          <textarea
            name="how_to_localize"
            rows={3}
            value={howToLocalize}
            onChange={(e) => setHowToLocalize(e.target.value)}
            placeholder="Where a local analyst finds this number: which office, report, or dataset"
            className={FIELD_CLS}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1">
            Where the default comes from — markdown allowed
          </label>
          <textarea
            name="provenance"
            rows={2}
            value={provenance}
            onChange={(e) => setProvenance(e.target.value)}
            placeholder="Source of the Philadelphia default: study, table, year"
            className={FIELD_CLS}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
            dirty ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' : 'bg-zinc-100 text-zinc-400'
          }`}
        >
          {dirty ? 'Save •' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setShowPreview((p) => !p)}
          className="rounded px-2.5 py-1 text-xs text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors"
        >
          {showPreview ? 'Hide preview' : 'Preview'}
        </button>
        <span className="text-xs text-zinc-300 font-mono">{variableKey}</span>
      </div>

      {showPreview && (
        <div className="mt-3 rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-2">
            As shown on the case page
          </p>
          {shortHint.trim() && <p className="text-xs text-zinc-500 mb-1.5">{shortHint}</p>}
          <p className="text-xs text-blue-600 mb-2">▸ About this input</p>
          <div className="border-l-2 border-zinc-200 pl-3 text-xs leading-relaxed text-zinc-600 space-y-2">
            {effectiveMeaning && (
              <div>
                <Markdown text={effectiveMeaning} />
              </div>
            )}
            {howToLocalize.trim() && (
              <div>
                <p className="font-semibold text-zinc-700 mb-1">How to find your local value</p>
                <Markdown text={howToLocalize} />
              </div>
            )}
            {provenance.trim() && (
              <div>
                <p className="font-semibold text-zinc-700 mb-1">Where the default comes from</p>
                <Markdown text={provenance} />
              </div>
            )}
          </div>
        </div>
      )}
    </form>
  )
}
