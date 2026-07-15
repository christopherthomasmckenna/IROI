import { getFieldExplanations } from '@/lib/cases/field-explanations'
import { FIELD_VARIABLES, type SectionLabel } from '@/lib/cases/field-meta'
import { updateFieldExplanationAction } from '@/app/actions/admin'

const SECTIONS: SectionLabel[] = [
  'CJS Program Costs',
  'RJC Program Costs',
  'HP / RP / Community',
]

export default async function AdminFieldsPage() {
  const overrides = await getFieldExplanations()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">Field Explanations</h1>
      <p className="text-sm text-zinc-500 mb-8 max-w-2xl">
        These power the ⓘ tooltips on every case. Edit and save to change one
        globally. Clear a box and save to revert it to the default from the model
        definition.
      </p>

      {SECTIONS.map((section) => {
        const vars = FIELD_VARIABLES.filter((v) => v.section === section)
        return (
          <section key={section} className="mb-10">
            <h2 className="text-base font-semibold text-zinc-900 mb-4 pb-2 border-b border-zinc-200">
              {section}
            </h2>
            <div className="space-y-4">
              {vars.map((v) => {
                const overridden = overrides.has(v.variableKey)
                const current = overrides.get(v.variableKey) ?? v.defaultExplanation ?? ''
                const action = updateFieldExplanationAction.bind(null, v.variableKey)
                return (
                  <form
                    key={v.variableKey}
                    action={action}
                    className="rounded-lg border border-zinc-100 bg-white px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-sm font-medium text-zinc-700">{v.label}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                          overridden ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-400'
                        }`}
                      >
                        {overridden ? 'custom' : 'default'}
                      </span>
                    </div>
                    <textarea
                      name="explanation"
                      rows={3}
                      defaultValue={current}
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
                      <span className="text-xs text-zinc-300 font-mono">{v.variableKey}</span>
                    </div>
                  </form>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
