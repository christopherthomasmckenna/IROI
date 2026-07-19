import { getFieldGuidance } from '@/lib/cases/field-guidance'
import { FIELD_VARIABLES, type SectionLabel } from '@/lib/cases/field-meta'
import { updateFieldGuidanceAction } from '@/app/actions/admin'
import { GuidanceEditor } from './GuidanceEditor'

const SECTIONS: SectionLabel[] = [
  'CJS Program Costs',
  'RJC Program Costs',
  'HP / RP / Community',
]

export default async function AdminFieldsPage() {
  const guidance = await getFieldGuidance()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">Field Guidance</h1>
      <p className="text-sm text-zinc-500 mb-8 max-w-2xl">
        Each model input carries layered help shown on every case: a one-line hint
        under the label, plus an expandable &ldquo;About this input&rdquo; with what it means,
        how to find a local value, and where the Philadelphia default comes from.
        Markdown works in the long fields (links, <strong>bold</strong>, lists).
        Clear all four boxes and save to revert a variable to its defaults.
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
                const g = guidance.get(v.variableKey)
                return (
                  <GuidanceEditor
                    key={v.variableKey}
                    variableKey={v.variableKey}
                    label={v.label}
                    hasRow={guidance.has(v.variableKey)}
                    defaultMeaning={v.defaultExplanation}
                    initial={{
                      shortHint:     g?.shortHint ?? '',
                      meaning:       g?.meaning ?? '',
                      howToLocalize: g?.howToLocalize ?? '',
                      provenance:    g?.provenance ?? '',
                    }}
                    action={updateFieldGuidanceAction.bind(null, v.variableKey)}
                  />
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
