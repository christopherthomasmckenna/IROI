// Static instructional content sourced from the spreadsheet's Introduction and
// per-section tabs (extracted into roi-model-fields.json).
import fields from '../../../docs/roi-model-fields.json'

interface LandingContent {
  intro: string[]
  instructions: string[]
  limitation: string
}

interface SectionInstructions {
  cjs: string[]
  rjc: string[]
  hp: string[]
}

const f = fields as unknown as {
  landing?: LandingContent
  section_instructions?: SectionInstructions
}

export const LANDING: LandingContent = f.landing ?? { intro: [], instructions: [], limitation: '' }

export const SECTION_INSTRUCTIONS: SectionInstructions =
  f.section_instructions ?? { cjs: [], rjc: [], hp: [] }

/** The original RJC DAO Impact Measurement Report (PDF). */
export const RJC_STUDY_URL =
  'https://github.com/phillydao/phillydao-public-data/raw/main/docs/reports/RJ%20DAO%20Impact%20Measurement%20Report%20(Final%20January%2027%202026).pdf'

// ─── Admin-editable content blocks ────────────────────────────────────────────
//
// Each block has a key, a label for the admin UI, and a default (from the
// spreadsheet/JSON). Multi-paragraph blocks store/edit as one text with
// paragraphs separated by blank lines; single blocks (URL, one note) are one line.

export interface ContentBlockDef {
  key: string
  label: string
  /** Default paragraphs (single-element for one-liners like the study URL). */
  defaultParagraphs: string[]
  /** Single-value (URL / one note) vs multi-paragraph prose. */
  single: boolean
  group: 'Landing page' | 'Section summaries'
}

export const CONTENT_BLOCKS: ContentBlockDef[] = [
  { key: 'landing.intro',        label: 'Introduction',            defaultParagraphs: LANDING.intro,           single: false, group: 'Landing page' },
  { key: 'landing.instructions', label: 'How this model works',    defaultParagraphs: LANDING.instructions,    single: false, group: 'Landing page' },
  { key: 'landing.limitation',   label: 'Limitation note',         defaultParagraphs: [LANDING.limitation],    single: false, group: 'Landing page' },
  { key: 'landing.study_url',    label: 'RJC study link (URL)',    defaultParagraphs: [RJC_STUDY_URL],          single: true,  group: 'Landing page' },
  { key: 'section.cjs',          label: 'CJS Program Costs',       defaultParagraphs: SECTION_INSTRUCTIONS.cjs, single: false, group: 'Section summaries' },
  { key: 'section.rjc',          label: 'RJC Program Costs',       defaultParagraphs: SECTION_INSTRUCTIONS.rjc, single: false, group: 'Section summaries' },
  { key: 'section.hp',           label: 'HP / RP / Community',     defaultParagraphs: SECTION_INSTRUCTIONS.hp,  single: false, group: 'Section summaries' },
]

const BLOCK_BY_KEY = new Map(CONTENT_BLOCKS.map((b) => [b.key, b]))

/** Paragraphs ↔ stored body (one text, paragraphs separated by blank lines). */
export function paragraphsToBody(paragraphs: string[]): string {
  return paragraphs.join('\n\n')
}
export function bodyToParagraphs(body: string): string[] {
  return body.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
}

/** Effective body text for a block (admin override ?? default), for the admin UI. */
export function effectiveBody(key: string, overrides: ReadonlyMap<string, string>): string {
  const ov = overrides.get(key)
  if (ov != null) return ov
  return paragraphsToBody(BLOCK_BY_KEY.get(key)?.defaultParagraphs ?? [])
}

/** Resolve a multi-paragraph block (override split into paragraphs ?? default). */
export function resolveParagraphs(key: string, overrides: ReadonlyMap<string, string>): string[] {
  const ov = overrides.get(key)
  if (ov != null) return bodyToParagraphs(ov)
  return BLOCK_BY_KEY.get(key)?.defaultParagraphs ?? []
}

/** Resolve a single-value block (override ?? default first paragraph). */
export function resolveSingle(key: string, overrides: ReadonlyMap<string, string>): string {
  const ov = overrides.get(key)
  if (ov != null) return ov.trim()
  return BLOCK_BY_KEY.get(key)?.defaultParagraphs[0] ?? ''
}
