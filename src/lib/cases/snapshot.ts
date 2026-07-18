import type { RoiCaseField } from '../db/schema'

/**
 * A published version stores a complete copy of every field row, so the viewer
 * and version-view paths can render and recalculate without ever touching the
 * live draft (roi_case_fields). Shape mirrors the field-row columns the
 * read-only UI + convertFieldsToInputs already consume.
 */
export interface SnapshotField {
  fieldKey: string
  sectionKey: RoiCaseField['sectionKey']
  currentValue: string
  defaultValue: string
  note: string | null
  annotation: string | null
}

export interface CaseSnapshot {
  title: string
  fields: SnapshotField[]
}

/** Build a snapshot from field rows (accepts both select and insert shapes). */
export function buildSnapshot(
  title: string,
  fields: Array<
    Pick<RoiCaseField, 'fieldKey' | 'sectionKey' | 'currentValue' | 'defaultValue'> & {
      note?: string | null
      annotation?: string | null
    }
  >
): CaseSnapshot {
  return {
    title,
    fields: fields.map((f) => ({
      fieldKey:     f.fieldKey,
      sectionKey:   f.sectionKey,
      currentValue: f.currentValue,
      defaultValue: f.defaultValue,
      note:         f.note ?? null,
      annotation:   f.annotation ?? null,
    })),
  }
}

/**
 * Reconstitute RoiCaseField-shaped rows from a snapshot for read-only rendering
 * and calculation. id is synthetic (the fieldKey) — it's never used for display
 * or writes on a read-only version view.
 */
export function snapshotToFieldRows(snapshot: CaseSnapshot, caseId: string): RoiCaseField[] {
  return snapshot.fields.map((f) => ({
    id:           f.fieldKey,
    caseId,
    sectionKey:   f.sectionKey,
    fieldKey:     f.fieldKey,
    currentValue: f.currentValue,
    defaultValue: f.defaultValue,
    note:         f.note,
    annotation:   f.annotation,
  }))
}

/**
 * True when the live draft differs from a published snapshot (values or
 * annotations) — i.e. there are unpublished changes. Compares by fieldKey.
 */
export function draftDiffersFromSnapshot(
  draft: Array<Pick<RoiCaseField, 'fieldKey' | 'currentValue'> & { annotation?: string | null }>,
  snapshot: CaseSnapshot
): boolean {
  const snapByKey = new Map(snapshot.fields.map((f) => [f.fieldKey, f]))
  if (draft.length !== snapshot.fields.length) return true

  for (const d of draft) {
    const s = snapByKey.get(d.fieldKey)
    if (!s) return true
    // Compare numeric value (tolerant of trailing-zero string differences)
    if (Number(d.currentValue) !== Number(s.currentValue)) return true
    if ((d.annotation ?? '') !== (s.annotation ?? '')) return true
  }
  return false
}
