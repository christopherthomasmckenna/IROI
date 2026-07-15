import { CONTENT_BLOCKS, effectiveBody } from '@/lib/cases/content'
import { getContentBlocks } from '@/lib/cases/content-blocks'
import { updateContentBlockAction } from '@/app/actions/admin'

const GROUPS = ['Landing page', 'Section summaries'] as const

export default async function AdminContentPage() {
  const overrides = await getContentBlocks()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">Landing &amp; Section Content</h1>
      <p className="text-sm text-zinc-500 mb-8 max-w-2xl">
        Edit the landing-page copy and the per-section &ldquo;About this section&rdquo; text shown to
        creators. For multi-paragraph blocks, separate paragraphs with a blank line. Clear a box and
        save to revert it to the default from the spreadsheet.
      </p>

      {GROUPS.map((group) => (
        <section key={group} className="mb-10">
          <h2 className="text-base font-semibold text-zinc-900 mb-4 pb-2 border-b border-zinc-200">
            {group}
          </h2>
          <div className="space-y-4">
            {CONTENT_BLOCKS.filter((b) => b.group === group).map((b) => {
              const overridden = overrides.has(b.key)
              const value = effectiveBody(b.key, overrides)
              const action = updateContentBlockAction.bind(null, b.key)
              return (
                <form
                  key={b.key}
                  action={action}
                  className="rounded-lg border border-zinc-100 bg-white px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-sm font-medium text-zinc-700">{b.label}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        overridden ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-400'
                      }`}
                    >
                      {overridden ? 'custom' : 'default'}
                    </span>
                  </div>
                  <textarea
                    name="body"
                    rows={b.single ? 2 : 6}
                    defaultValue={value}
                    className="w-full resize-y rounded border border-zinc-200 px-2 py-1.5 text-sm
                               text-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500
                               focus:border-blue-500"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="submit"
                      className="rounded bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-200 transition-colors"
                    >
                      Save
                    </button>
                    <span className="text-xs text-zinc-300 font-mono">{b.key}</span>
                  </div>
                </form>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
