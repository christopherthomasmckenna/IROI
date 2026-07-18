import type { RoiCaseField, Role } from '@/lib/db/schema'
import { calculateRoi } from '@/lib/calculator/engine'
import { convertFieldsToInputs } from '@/lib/cases/convert'
import { isFieldPerCaseEditable } from '@/lib/auth/permissions'
import {
  FIELD_META,
  CJS_ROW_IDS,
  CJS_ROW_META,
  RJC_ROW_IDS,
  RJC_ROW_META,
  HP_SUBSECTIONS,
  resolveExplanation,
} from '@/lib/cases/field-meta'
import { getFieldExplanations } from '@/lib/cases/field-explanations'
import { resolveParagraphs } from '@/lib/cases/content'
import { getContentBlocks } from '@/lib/cases/content-blocks'
import { IroiSummary } from '@/components/iroi'
import {
  adornmentOf,
  toDisplayValue,
  formatWithUnit,
} from '@/lib/cases/field-units'
import {
  updateCaseFieldAction,
  updateCjsRowAction,
  updateRjcRowAction,
  updateSplitAction,
} from '@/app/actions/cases'
import type { RjcScenarioBreakdown, Sensitivity } from '@/lib/calculator/types'
import { SplitEditor } from './SplitEditor'
import { InfoTip } from './InfoTip'
import { EditableGroupedRow, EditableFieldRow } from './EditableRows'

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtUsd(v: number): string {
  return '$' + Math.round(v).toLocaleString('en-US')
}
function pctToDisplay(frac: number): number {
  return Number((frac * 100).toFixed(6))
}

type Accent = 'amber' | 'indigo' | 'emerald'

const SECTIONINFO_CLS: Record<Accent, string> = {
  amber:   'border-amber-200 text-amber-800',
  indigo:  'border-indigo-200 text-indigo-800',
  emerald: 'border-emerald-200 text-emerald-800',
}

/** Collapsible per-section instructions from the spreadsheet (native <details>). */
function SectionInfo({ paragraphs, accent }: { paragraphs: string[]; accent: Accent }) {
  if (!paragraphs || paragraphs.length === 0) return null
  return (
    <details className={`mb-4 rounded-lg border bg-white ${SECTIONINFO_CLS[accent]}`}>
      <summary className="cursor-pointer select-none px-4 py-2 text-sm font-medium">
        About this section
      </summary>
      <div className="space-y-2 px-4 pb-3 text-sm leading-relaxed text-zinc-600">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </details>
  )
}

// ─── Subtotal bar ─────────────────────────────────────────────────────────────

const SUBTOTAL_BG: Record<Accent, string> = {
  amber:   'bg-amber-100 text-amber-900',
  indigo:  'bg-indigo-100 text-indigo-900',
  emerald: 'bg-emerald-100 text-emerald-900',
}

function SubtotalBar({
  label,
  value,
  accent,
  subtle = false,
}: {
  label: string
  value: number | Sensitivity<number>
  accent?: Accent
  subtle?: boolean
}) {
  const cls = subtle || !accent ? 'bg-zinc-50 text-zinc-700' : SUBTOTAL_BG[accent]
  return (
    <div className={`mt-3 rounded-md px-3 py-2 flex items-baseline justify-between gap-4 text-sm ${cls}`}>
      <span className="font-semibold">{label}</span>
      {typeof value === 'number' ? (
        <span className="font-bold tabular-nums">{fmtUsd(value)}</span>
      ) : (
        <span className="flex gap-4 tabular-nums">
          <span className="opacity-70">low {fmtUsd(value.low)}</span>
          <span>med <span className="font-bold">{fmtUsd(value.medium)}</span></span>
          <span className="opacity-70">high {fmtUsd(value.high)}</span>
        </span>
      )}
    </div>
  )
}

// ─── Single-value field row (HP/RP/Community) ──────────────────────────────────

interface SectionProps {
  fields: Map<string, RoiCaseField>
  caseId: string
  caseSlug: string
  role: Role | null
  canEditThisCase: boolean
  explanations: ReadonlyMap<string, string>
}

function FieldRow({ field, caseId, caseSlug, role, canEditThisCase, explanations }: SectionProps & { field: RoiCaseField }) {
  const meta = FIELD_META.get(field.fieldKey)
  const label = meta?.label ?? field.fieldKey
  const note = resolveExplanation(field.fieldKey, explanations) ?? undefined
  const userCanEdit = canEditThisCase && !!role && isFieldPerCaseEditable(field.fieldKey)
  const modified = Number(field.currentValue) !== Number(field.defaultValue)
  const updateAction = updateCaseFieldAction.bind(null, caseId, caseSlug, field.fieldKey)

  return (
    <div className="flex items-start gap-3 py-2 border-b border-zinc-50 last:border-0">
      <div className="w-56 shrink-0 text-sm text-zinc-700 leading-5 flex items-start gap-1.5">
        <InfoTip text={note} />
        <span>{label}</span>
      </div>

      {userCanEdit ? (
        <EditableFieldRow
          action={updateAction}
          value={String(toDisplayValue(Number(field.currentValue), field.fieldKey))}
          annotation={field.annotation ?? ''}
          modified={modified}
          adornment={adornmentOf(field.fieldKey)}
        />
      ) : (
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="w-28 shrink-0 text-sm text-zinc-900 text-right tabular-nums">
            {formatWithUnit(Number(field.currentValue), field.fieldKey)}
          </span>
          {field.annotation && (
            <span className="flex-1 min-w-0 text-sm text-zinc-400 italic truncate" title={field.annotation}>
              {field.annotation}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Grouped multi-column row (CJS editable, RJC read-only) ───────────────────

interface ColSpec {
  name: string
  header: string
  pct: boolean
}

const CJS_COLS: ColSpec[] = [
  { name: 'units_required', header: 'Units',     pct: false },
  { name: 'cost_per_unit',  header: 'Cost/unit', pct: false },
  { name: 'pct_low',        header: '% low',     pct: true },
  { name: 'pct_medium',     header: '% med',     pct: true },
  { name: 'pct_high',       header: '% high',    pct: true },
]
const RJC_COLS: ColSpec[] = [
  { name: 'hours_or_units', header: 'Units',         pct: false },
  { name: 'rate_per_unit',  header: 'Rate per unit', pct: false },
]

/** Signature of a row's persisted values + note — used as a remount key so the
 *  dirty form rebaselines after a save. */
function rowSignature(fields: Map<string, RoiCaseField>, rowId: string, cols: ColSpec[]): string {
  const vals = cols.map((c) => fields.get(`${rowId}.${c.name}`)?.currentValue ?? '').join(',')
  const note = cols.map((c) => fields.get(`${rowId}.${c.name}`)?.annotation).find((a) => a && a.trim()) ?? ''
  return `${vals}|${note}`
}

function GroupedRow({
  rowId,
  rowLabel,
  cols,
  gridCols,
  action,
  fields,
  role,
  canEditThisCase,
  explanations,
}: {
  rowId: string
  rowLabel: string
  cols: ColSpec[]
  gridCols: string
  action?: (formData: FormData) => void
  fields: Map<string, RoiCaseField>
  role: Role | null
  canEditThisCase: boolean
  explanations: ReadonlyMap<string, string>
}) {
  const note = resolveExplanation(`${rowId}.${cols[0].name}`, explanations) ?? undefined
  const editable =
    canEditThisCase && !!role && !!action && cols.every((c) => isFieldPerCaseEditable(`${rowId}.${c.name}`))
  const cellNum = (c: ColSpec): number => {
    const raw = Number(fields.get(`${rowId}.${c.name}`)?.currentValue ?? 0)
    return c.pct ? pctToDisplay(raw) : raw
  }
  const modified = cols.some((c) => {
    const f = fields.get(`${rowId}.${c.name}`)
    return f && Number(f.currentValue) !== Number(f.defaultValue)
  })
  const annotation =
    cols.map((c) => fields.get(`${rowId}.${c.name}`)?.annotation).find((a) => a && a.trim()) ?? ''

  const title = (
    <div className="flex items-start gap-1.5 mb-1.5">
      <InfoTip text={note} />
      <span className="text-sm text-zinc-700 leading-5">{rowLabel}</span>
      {modified && <span className="text-xs text-amber-600 mt-0.5" title="Changed from default">●</span>}
    </div>
  )

  if (!editable) {
    return (
      <div className="rounded-lg border border-zinc-100 bg-white px-4 pt-3 pb-2">
        {title}
        <div className={`grid ${gridCols} gap-2`}>
          {cols.map((c) => (
            <span key={c.name} className="min-w-0 text-sm text-zinc-900 text-right tabular-nums pr-2">
              {formatWithUnit(Number(fields.get(`${rowId}.${c.name}`)?.currentValue ?? 0), `${rowId}.${c.name}`)}
            </span>
          ))}
        </div>
        {annotation && <p className="mt-2 text-sm text-zinc-400 italic">{annotation}</p>}
      </div>
    )
  }

  return (
    <EditableGroupedRow
      action={action!}
      rowLabel={rowLabel}
      note={note ?? null}
      cols={cols.map((c) => ({ name: c.name, value: cellNum(c), adornment: adornmentOf(`${rowId}.${c.name}`) }))}
      annotation={annotation}
      modified={modified}
      gridCols={gridCols}
    />
  )
}

const COLHEADER_BG: Record<Accent, string> = {
  amber:   'bg-amber-50 text-amber-800',
  indigo:  'bg-indigo-50 text-indigo-800',
  emerald: 'bg-emerald-50 text-emerald-800',
}

function ColumnHeader({ cols, gridCols, accent }: { cols: ColSpec[]; gridCols: string; accent: Accent }) {
  return (
    <div className={`grid ${gridCols} gap-2 mb-1.5 px-4 py-1.5 rounded text-sm font-bold text-right ${COLHEADER_BG[accent]}`}>
      {cols.map((c) => (
        <span key={c.name} className="pr-2">{c.header}</span>
      ))}
    </div>
  )
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function CjsSection(props: SectionProps & { subtotal: Sensitivity<number>; info: string[] }) {
  const cjsAction = (rowId: string) => updateCjsRowAction.bind(null, props.caseId, props.caseSlug, rowId)
  return (
    <section className="mb-10 border-l-4 border-amber-300 pl-4">
      <h2 className="text-lg font-bold text-amber-800 mb-3 pb-2 border-b-2 border-amber-300">
        CJS Program Costs
      </h2>
      <SectionInfo paragraphs={props.info} accent="amber" />
      <ColumnHeader cols={CJS_COLS} gridCols="grid-cols-5" accent="amber" />
      <div className="space-y-3">
        {CJS_ROW_IDS.map((rowId) => (
          <GroupedRow
            key={`${rowId}:${rowSignature(props.fields, rowId, CJS_COLS)}`}
            rowId={rowId}
            rowLabel={CJS_ROW_META[rowId]?.label ?? rowId}
            cols={CJS_COLS}
            gridCols="grid-cols-5"
            action={cjsAction(rowId)}
            fields={props.fields}
            role={props.role}
            canEditThisCase={props.canEditThisCase}
            explanations={props.explanations}
          />
        ))}
      </div>
      <SubtotalBar label="Total CJS cost / case" value={props.subtotal} accent="amber" />
    </section>
  )
}

/**
 * RJC average cost / case = for each outcome, (per-case cost × 100 cases × % of
 * cases) summed, then ÷ 100. Shown above the editable split so the average reads
 * as the section's headline number.
 */
function RjcAverageBreakdown({ scenarios }: { scenarios: RjcScenarioBreakdown }) {
  const items = [
    { label: 'Full resolution', s: scenarios.resolution },
    { label: 'Pre-conferencing only', s: scenarios.preconferencing_only },
    { label: 'Conferenced unresolved', s: scenarios.conferenced_unresolved },
  ]
  const factored = items.map((i) => i.s.cost * 100 * i.s.weight)
  const sum = factored.reduce((a, b) => a + b, 0)
  const avg = sum / 100

  return (
    <div className="mt-4 rounded-lg border border-indigo-100 bg-white px-4 py-3">
      <p className="text-xs text-zinc-400 mb-2">
        Each outcome&apos;s per-case cost, applied across 100 cases at the case&apos;s split, then averaged:
      </p>
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-zinc-400">
            <th className="text-left font-medium py-1">Outcome</th>
            <th className="text-right font-medium py-1">Cost / case</th>
            <th className="text-right font-medium py-1">× 100 cases × %</th>
            <th className="text-right font-medium py-1">= Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i, idx) => (
            <tr key={i.label} className="border-t border-zinc-50">
              <td className="text-left text-zinc-600 py-1">{i.label}</td>
              <td className="text-right text-zinc-700 py-1">{fmtUsd(i.s.cost)}</td>
              <td className="text-right text-zinc-400 py-1">× 100 × {(i.s.weight * 100).toFixed(1)}%</td>
              <td className="text-right text-zinc-700 py-1">{fmtUsd(factored[idx])}</td>
            </tr>
          ))}
          <tr className="border-t border-zinc-200">
            <td className="text-left text-zinc-500 py-1" colSpan={3}>Sum across 100 cases</td>
            <td className="text-right font-medium text-zinc-700 py-1">{fmtUsd(sum)}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-2 rounded-md px-3 py-2 flex items-baseline justify-between bg-indigo-100 text-indigo-900">
        <span className="font-semibold">RJC average cost / case (÷ 100)</span>
        <span className="font-bold tabular-nums">{fmtUsd(avg)}</span>
      </div>
    </div>
  )
}

function RjcSection(props: SectionProps & { splitEditor: React.ReactNode; scenarios: RjcScenarioBreakdown; info: string[] }) {
  const rjcAction = (rowId: string) => updateRjcRowAction.bind(null, props.caseId, props.caseSlug, rowId)
  return (
    <section className="mb-10 border-l-4 border-indigo-300 pl-4">
      <h2 className="text-lg font-bold text-indigo-800 mb-3 pb-2 border-b-2 border-indigo-300">
        RJC Program Costs
      </h2>
      <SectionInfo paragraphs={props.info} accent="indigo" />
      <ColumnHeader cols={RJC_COLS} gridCols="grid-cols-2" accent="indigo" />
      <div className="space-y-3">
        {RJC_ROW_IDS.map((rowId) => (
          <GroupedRow
            key={`${rowId}:${rowSignature(props.fields, rowId, RJC_COLS)}`}
            rowId={rowId}
            rowLabel={RJC_ROW_META[rowId]?.label ?? rowId}
            cols={RJC_COLS}
            gridCols="grid-cols-2"
            action={rjcAction(rowId)}
            fields={props.fields}
            role={props.role}
            canEditThisCase={props.canEditThisCase}
            explanations={props.explanations}
          />
        ))}
      </div>

      {/* Case Outcome Split — the editable percentages, above the final number */}
      <h3 className="text-sm font-semibold text-indigo-700 mt-6 mb-2">Case Outcome Split</h3>
      {props.splitEditor}

      {/* RJC average (with its factoring) — the section's final number, below the split */}
      <RjcAverageBreakdown scenarios={props.scenarios} />
    </section>
  )
}

function HpSection(
  props: SectionProps & {
    subtotals: { hp: number; rp: Sensitivity<number>; community: Sensitivity<number> }
    info: string[]
  }
) {
  const subtotalOf: Record<string, number | Sensitivity<number>> = {
    hp: props.subtotals.hp,
    rp: props.subtotals.rp,
    community: props.subtotals.community,
  }
  const grandTotal: Sensitivity<number> = {
    low:    props.subtotals.hp + props.subtotals.rp.low + props.subtotals.community.low,
    medium: props.subtotals.hp + props.subtotals.rp.medium + props.subtotals.community.medium,
    high:   props.subtotals.hp + props.subtotals.rp.high + props.subtotals.community.high,
  }

  return (
    <section className="mb-10 border-l-4 border-emerald-300 pl-4">
      <h2 className="text-lg font-bold text-emerald-800 mb-3 pb-2 border-b-2 border-emerald-300">
        HP / RP / Community Inputs
      </h2>
      <SectionInfo paragraphs={props.info} accent="emerald" />
      <div className="space-y-6">
        {HP_SUBSECTIONS.map((sub) => (
          <div key={sub.key} className="rounded-lg border border-zinc-100 bg-white px-4 pt-3 pb-2">
            <h3 className="text-sm font-semibold text-zinc-600 mb-1">{sub.title}</h3>
            <div>
              {sub.fieldKeys.map((fk) => {
                const f = props.fields.get(fk)
                if (!f) return null
                return (
                  <FieldRow
                    key={`${fk}:${f.currentValue}|${f.annotation ?? ''}`}
                    field={f}
                    fields={props.fields}
                    caseId={props.caseId}
                    caseSlug={props.caseSlug}
                    role={props.role}
                    canEditThisCase={props.canEditThisCase}
                    explanations={props.explanations}
                  />
                )
              })}
            </div>
            <SubtotalBar label={`${sub.title} benefit`} value={subtotalOf[sub.key]} subtle />
          </div>
        ))}
      </div>
      <SubtotalBar label="Total HP + RP + Community benefit" value={grandTotal} accent="emerald" />
    </section>
  )
}

// ─── CaseView ─────────────────────────────────────────────────────────────────

interface CaseViewProps {
  fields: RoiCaseField[]
  editable: boolean
  role: Role | null
  caseId: string
  caseSlug: string
  stickyIroi?: boolean
}

export async function CaseView({
  fields,
  editable,
  role,
  caseId,
  caseSlug,
  stickyIroi = true,
}: CaseViewProps) {
  const fieldMap = new Map(fields.map((f) => [f.fieldKey, f]))
  const outputs = calculateRoi(convertFieldsToInputs(fields))
  const explanations = await getFieldExplanations()
  const content = await getContentBlocks()

  const sectionProps: SectionProps = {
    fields: fieldMap,
    caseId,
    caseSlug,
    role,
    canEditThisCase: editable,
    explanations,
  }

  const splitAction = updateSplitAction.bind(null, caseId, caseSlug)
  const splitEditor = (
    <SplitEditor
      action={splitAction}
      editable={editable}
      note={resolveExplanation('rjc_outcome_split.resolution_pct', explanations)}
      initialAnnotation={fieldMap.get('rjc_outcome_split.resolution_pct')?.annotation ?? null}
      initial={{
        resolution: pctToDisplay(Number(fieldMap.get('rjc_outcome_split.resolution_pct')?.currentValue ?? 0)),
        preconf:    pctToDisplay(Number(fieldMap.get('rjc_outcome_split.preconferencing_only_pct')?.currentValue ?? 0)),
        conf:       pctToDisplay(Number(fieldMap.get('rjc_outcome_split.conferenced_unresolved_pct')?.currentValue ?? 0)),
      }}
    />
  )

  return (
    <>
      <div className={stickyIroi ? 'sticky top-4 z-20 mb-8' : 'mb-8'}>
        <IroiSummary outputs={outputs} />
      </div>
      <CjsSection
        {...sectionProps}
        subtotal={outputs.cjs_cost_per_case}
        info={resolveParagraphs('section.cjs', content)}
      />
      <RjcSection
        {...sectionProps}
        splitEditor={splitEditor}
        scenarios={outputs.rjc_scenarios}
        info={resolveParagraphs('section.rjc', content)}
      />
      <HpSection
        {...sectionProps}
        subtotals={{
          hp: outputs.hp_benefit,
          rp: outputs.rp_benefit,
          community: outputs.community_benefit,
        }}
        info={resolveParagraphs('section.hp', content)}
      />
    </>
  )
}
