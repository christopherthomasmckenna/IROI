// PDF export of a published case summary. Pure @react-pdf/renderer document —
// rendered server-side by the /s/[slug]/pdf route. Mirrors the /s/ page:
// headline IROI numbers, provenance brief (entry date + deviations from the
// Philadelphia defaults with author notes), and the derivation table.

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { RoiOutputs, Sensitivity } from '@/lib/calculator/types'
import type { Deviation } from '@/lib/cases/deviations'

const BLUE = '#1e40af'
const BLUE_LIGHT = '#eff6ff'
const ZINC_400 = '#a1a1aa'
const ZINC_600 = '#52525b'
const ZINC_900 = '#18181b'

const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 9.5, fontFamily: 'Helvetica', color: ZINC_900 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  meta: { fontSize: 8.5, color: ZINC_400, marginBottom: 10 },
  summary: { fontSize: 9.5, color: ZINC_600, marginBottom: 12, lineHeight: 1.4 },

  iroiBox: {
    backgroundColor: BLUE_LIGHT, borderRadius: 6, padding: 14, marginBottom: 16,
    border: `1 solid #bfdbfe`,
  },
  iroiHeading: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: BLUE, marginBottom: 8 },
  iroiRow: { flexDirection: 'row', justifyContent: 'space-around' },
  iroiCell: { alignItems: 'center' },
  iroiValue: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: BLUE },
  iroiLabel: { fontSize: 8, color: '#3b82f6', marginTop: 2 },

  h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 6, color: ZINC_900 },
  note: { fontSize: 8.5, color: ZINC_600, marginBottom: 6, lineHeight: 1.4 },

  table: { border: `1 solid #e4e4e7`, borderRadius: 4, marginBottom: 16 },
  tr: { flexDirection: 'row', borderTop: `1 solid #f4f4f5` },
  trHead: { flexDirection: 'row', backgroundColor: '#fafafa' },
  th: { padding: 5, fontSize: 8, fontFamily: 'Helvetica-Bold', color: ZINC_600 },
  td: { padding: 5, fontSize: 8.5 },
  right: { textAlign: 'right' },
  strong: { fontFamily: 'Helvetica-Bold' },
  totalRow: { backgroundColor: BLUE_LIGHT },
  totalCell: { fontFamily: 'Helvetica-Bold', color: BLUE },
  dim: { color: ZINC_400 },
  italic: { fontFamily: 'Helvetica-Oblique', color: ZINC_600 },

  footer: {
    position: 'absolute', bottom: 24, left: 42, right: 42,
    fontSize: 7.5, color: ZINC_400, borderTop: `1 solid #e4e4e7`, paddingTop: 6,
    flexDirection: 'row', justifyContent: 'space-between',
  },
})

function fmtIroi(v: number): string {
  return v.toFixed(2)
}
function fmtUsd(v: number): string {
  return '$' + Math.round(v).toLocaleString('en-US')
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export interface SummaryPdfProps {
  title: string
  summary: string | null
  createdAt: Date
  publishedAt: Date
  outputs: RoiOutputs
  deviations: Deviation[]
  shareUrl: string | null
}

export function SummaryPdf({
  title,
  summary,
  createdAt,
  publishedAt,
  outputs,
  deviations,
  shareUrl,
}: SummaryPdfProps) {
  type Sens = keyof Sensitivity<number>
  const sens: Sens[] = ['low', 'medium', 'high']
  const rjc = outputs.rjc_avg_cost_per_case
  const cjs = (s: Sens) => outputs.cjs_cost_per_case[s]
  const benefit = (s: Sens) => outputs.hp_benefit + outputs.rp_benefit[s] + outputs.community_benefit[s]
  const savings = (s: Sens) => cjs(s) - rjc
  const overall = (s: Sens) => savings(s) + benefit(s)

  const derivationRows: Array<{ label: string; cell: (s: Sens) => string; strong?: boolean; total?: boolean }> = [
    { label: 'CJS cost / case', cell: (s) => fmtUsd(cjs(s)) },
    { label: '−  RJC avg cost / case', cell: () => '−' + fmtUsd(rjc) },
    { label: '=  Program savings', cell: (s) => fmtUsd(savings(s)), strong: true },
    { label: '+  Total HP + RP + Community benefit', cell: (s) => fmtUsd(benefit(s)) },
    { label: '=  Overall benefit', cell: (s) => fmtUsd(overall(s)), strong: true },
    { label: '÷  RJC avg cost / case', cell: () => fmtUsd(rjc) },
    { label: '=  Impact ROI', cell: (s) => fmtIroi(outputs.iroi[s]) + '×', strong: true, total: true },
  ]

  return (
    <Document title={`${title} — RJC Impact ROI`} author="RJC Impact ROI Calculator">
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          RJC Impact ROI analysis · entered {fmtDate(createdAt)} · published {fmtDate(publishedAt)}
        </Text>
        {summary ? <Text style={styles.summary}>{summary}</Text> : null}

        {/* Headline IROI */}
        <View style={styles.iroiBox}>
          <Text style={styles.iroiHeading}>Impact ROI — return per $1 invested in RJC</Text>
          <View style={styles.iroiRow}>
            {([['Low', outputs.iroi.low], ['Medium', outputs.iroi.medium], ['High', outputs.iroi.high]] as const).map(
              ([label, value]) => (
                <View key={label} style={styles.iroiCell}>
                  <Text style={styles.iroiValue}>{fmtIroi(value)}×</Text>
                  <Text style={styles.iroiLabel}>{label} sensitivity</Text>
                </View>
              )
            )}
          </View>
        </View>

        {/* Provenance brief */}
        <Text style={styles.h2}>About this analysis</Text>
        {deviations.length === 0 ? (
          <Text style={styles.note}>
            This analysis uses the original Philadelphia model defaults unchanged.
          </Text>
        ) : (
          <>
            <Text style={styles.note}>
              This analysis changes {deviations.length} input{deviations.length === 1 ? '' : 's'} from the
              original Philadelphia model. Each change is shown against the default it replaced, with the
              author&apos;s note where provided.
            </Text>
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={[styles.th, { width: '34%' }]}>Input</Text>
                <Text style={[styles.th, styles.right, { width: '15%' }]}>Default</Text>
                <Text style={[styles.th, styles.right, { width: '15%' }]}>This analysis</Text>
                <Text style={[styles.th, { width: '36%', paddingLeft: 10 }]}>Author&apos;s note</Text>
              </View>
              {deviations.map((d) => (
                <View key={d.fieldKey} style={styles.tr} wrap={false}>
                  <View style={[styles.td, { width: '34%' }]}>
                    <Text>{d.fieldLabel}</Text>
                    {d.rowLabel ? <Text style={[styles.dim, { fontSize: 7 }]}>{d.rowLabel}</Text> : null}
                  </View>
                  <Text style={[styles.td, styles.right, styles.dim, { width: '15%' }]}>{d.defaultDisplay}</Text>
                  <Text style={[styles.td, styles.right, styles.strong, { width: '15%' }]}>{d.currentDisplay}</Text>
                  <Text style={[styles.td, styles.italic, { width: '36%', paddingLeft: 10 }]}>
                    {d.annotation ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Derivation */}
        <Text style={styles.h2}>How the numbers add up</Text>
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={[styles.th, { width: '46%' }]}>Per case</Text>
            {(['Low', 'Medium', 'High'] as const).map((s) => (
              <Text key={s} style={[styles.th, styles.right, { width: '18%' }]}>{s}</Text>
            ))}
          </View>
          {derivationRows.map((r) => (
            <View key={r.label} style={[styles.tr, ...(r.total ? [styles.totalRow] : [])]}>
              <Text style={[styles.td, { width: '46%' }, ...(r.strong ? [styles.strong] : [styles.dim])]}>
                {r.label}
              </Text>
              {sens.map((s) => (
                <Text
                  key={s}
                  style={[
                    styles.td,
                    styles.right,
                    { width: '18%' },
                    ...(r.total ? [styles.totalCell] : r.strong ? [styles.strong] : []),
                  ]}
                >
                  {r.cell(s)}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <Text style={styles.note}>
          Impact ROI (IROI) compares the cost of resolving a case through Restorative Justice
          Conferencing (RJC) with the Criminal Justice System (CJS) path it replaces, adding the
          measured dollar benefits to harmed parties, the responsible party, and the community.
          Low / Medium / High reflect conservative, central, and high-cost CJS scenarios.
        </Text>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>RJC Impact ROI Calculator</Text>
          <Text>{shareUrl ?? ''}</Text>
        </View>
      </Page>
    </Document>
  )
}
