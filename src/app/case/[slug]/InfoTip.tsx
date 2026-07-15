'use client'

import { useEffect, useRef, useState } from 'react'

/** Render text with any URLs turned into clickable links on their own line. */
function renderWithLinks(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="block break-all text-blue-600 underline hover:text-blue-800"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

/**
 * A small "i" badge that reveals an explanation on hover and click/tap. The
 * popover wraps long text, linkifies URLs (on their own line), scrolls if long,
 * and — because it can now hold clickable links — stays open while the pointer
 * is over the badge OR the popover (hover handlers are on the wrapper, not just
 * the badge).
 */
export function InfoTip({ text }: { text: string | null | undefined }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  if (!text || !text.trim()) return null

  return (
    <span
      ref={ref}
      className="relative inline-block align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Explanation"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border
                   border-zinc-300 text-[10px] font-semibold leading-none text-zinc-400
                   hover:border-blue-400 hover:text-blue-500 transition-colors"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-40 mt-1 block w-72 max-h-72 overflow-y-auto
                     rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-normal
                     leading-relaxed text-zinc-600 shadow-lg whitespace-pre-wrap break-words"
        >
          {renderWithLinks(text)}
        </span>
      )}
    </span>
  )
}
