import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { FieldGuidance } from '@/lib/cases/field-meta'

/**
 * GOV.UK-style field help (replaces the hover ⓘ tooltip, 2026-07-18):
 * an optional always-visible one-line hint plus a native <details> expander
 * ("About this input") holding the layered guidance — meaning, how to find
 * your local value, and where the default comes from. Server-rendered, no JS
 * required; markdown in the long layers.
 */

const MD_COMPONENTS = {
  a: (props: React.ComponentPropsWithoutRef<'a'>) => (
    <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 break-words" />
  ),
  p: (props: React.ComponentPropsWithoutRef<'p'>) => <p {...props} className="mb-2 last:mb-0" />,
  ul: (props: React.ComponentPropsWithoutRef<'ul'>) => <ul {...props} className="list-disc pl-4 mb-2 space-y-0.5" />,
  ol: (props: React.ComponentPropsWithoutRef<'ol'>) => <ol {...props} className="list-decimal pl-4 mb-2 space-y-0.5" />,
  code: (props: React.ComponentPropsWithoutRef<'code'>) => (
    <code {...props} className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]" />
  ),
}

/**
 * House style for guidance text: the spreadsheet-derived content mixes
 * "Note:" / "Notes:" / "Source:" / "Sources:" — normalize all to the plural
 * and bold them. Skips occurrences already wrapped in markdown bold so
 * admin-authored `**Notes:**` doesn't double-wrap.
 */
export function normalizeGuidanceText(text: string): string {
  return text
    .replace(/(?<!\*)\bNotes?:/g, '**Notes:**')
    .replace(/(?<!\*)\bSources?:/g, '**Sources:**')
}

export function Markdown({ text }: { text: string }) {
  // remark-gfm turns bare URLs into links (plus tables/strikethrough).
  return (
    <ReactMarkdown components={MD_COMPONENTS} remarkPlugins={[remarkGfm]}>
      {normalizeGuidanceText(text)}
    </ReactMarkdown>
  )
}

/** DOM-id-safe version of a variable key, for aria-describedby wiring. */
export function hintIdOf(variableKey: string): string {
  return `hint-${variableKey.replace(/[^\w-]+/g, '-')}`
}

/** The always-visible one-line hint (GOV.UK hint text). Renders nothing when unauthored. */
export function FieldHint({
  variableKey,
  hint,
}: {
  variableKey: string
  hint: string | null
}) {
  if (!hint) return null
  return (
    <p id={hintIdOf(variableKey)} className="text-xs text-zinc-500 mb-1.5">
      {hint}
    </p>
  )
}

/**
 * The "About this input" expander. Renders nothing when every layer is empty.
 * `compact` tightens spacing for use inside slim field rows (HP section).
 */
export function GuidanceDisclosure({
  guidance,
  compact = false,
}: {
  guidance: FieldGuidance
  compact?: boolean
}) {
  const { meaning, howToLocalize, provenance } = guidance
  if (!meaning && !howToLocalize && !provenance) return null

  return (
    <details className={compact ? 'mb-1' : 'mb-2'}>
      <summary
        className="inline-flex cursor-pointer select-none items-center gap-1 text-xs
                   text-blue-600 hover:text-blue-800 transition-colors
                   [&::-webkit-details-marker]:hidden list-none
                   before:content-['▸'] before:text-[10px] before:transition-transform
                   [[open]>&]:before:rotate-90"
      >
        About this input
      </summary>
      <div className="mt-2 border-l-2 border-zinc-200 pl-3 pr-1 pb-1 text-xs leading-relaxed text-zinc-600 space-y-2">
        {meaning && (
          <div>
            <Markdown text={meaning} />
          </div>
        )}
        {howToLocalize && (
          <div>
            <p className="font-semibold text-zinc-700 mb-1">How to find your local value</p>
            <Markdown text={howToLocalize} />
          </div>
        )}
        {provenance && (
          <div>
            <p className="font-semibold text-zinc-700 mb-1">Where the default comes from</p>
            <Markdown text={provenance} />
          </div>
        )}
      </div>
    </details>
  )
}
