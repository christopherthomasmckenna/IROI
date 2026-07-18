'use client'

import { useEffect, useState } from 'react'

/**
 * Share button + lightbox for a public case. The shared link points at the
 * published SUMMARY (/s/<slug>) — the polished public results page — built from
 * the current origin so it's correct in dev (neuron:3000) and production alike.
 */
export function ShareButton({ slug, title }: { slug: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [url, setUrl] = useState(`/s/${slug}`)

  // The absolute URL needs window.location, so build it when the dialog opens
  // (a user event — always client-side) rather than in an effect.
  function openDialog() {
    setUrl(`${window.location.origin}/s/${slug}`)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard may be unavailable (non-HTTPS / permissions) — the user can
      // still select the text in the field manually.
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
      >
        Share
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-base font-semibold text-zinc-900">Share case</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-lg leading-none text-zinc-400 hover:text-zinc-700"
              >
                ×
              </button>
            </div>
            <p className="text-sm text-zinc-500 mb-4 truncate">{title}</p>
            <p className="text-xs text-zinc-400 mb-2">
              Anyone with this link can view the published summary.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 rounded border border-zinc-300 px-2 py-1.5 text-sm text-zinc-700"
              />
              <button
                type="button"
                onClick={copy}
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
