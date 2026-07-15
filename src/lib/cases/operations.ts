import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '../db'
import {
  type NewRoiCase,
  type RoiCase,
  type RoiCaseField,
  type RoiCaseVersion,
  type Role,
  roiCaseFields,
  roiCaseVersions,
  roiCases,
  users,
} from '../db/schema'
import { isFieldPerCaseEditable } from '../auth/permissions'
import { assertCanEdit } from './access'
import { buildCaseFieldRows } from './seed'
import { generateSlug } from './slug'
import { type CaseSnapshot, buildSnapshot } from './snapshot'

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getCaseBySlug(slug: string): Promise<RoiCase | null> {
  const [found] = await db
    .select()
    .from(roiCases)
    .where(eq(roiCases.shareSlug, slug))
    .limit(1)
  return found ?? null
}

export async function getCaseFields(caseId: string): Promise<RoiCaseField[]> {
  return db
    .select()
    .from(roiCaseFields)
    .where(eq(roiCaseFields.caseId, caseId))
}

export async function listMyCases(userId: string): Promise<
  Array<RoiCase & { ownerEmail: string | null }>
> {
  const rows = await db
    .select({
      id:            roiCases.id,
      ownerId:       roiCases.ownerId,
      title:         roiCases.title,
      summary:       roiCases.summary,
      isPrivate:     roiCases.isPrivate,
      shareSlug:     roiCases.shareSlug,
      liveVersionId: roiCases.liveVersionId,
      promotedAt:    roiCases.promotedAt,
      createdAt:     roiCases.createdAt,
      updatedAt:     roiCases.updatedAt,
      ownerEmail:    users.email,
    })
    .from(roiCases)
    .innerJoin(users, eq(roiCases.ownerId, users.id))
    .where(eq(roiCases.ownerId, userId))
    .orderBy(roiCases.createdAt)

  return rows
}

export async function listPublicCases(): Promise<
  Array<RoiCase & { ownerEmail: string | null }>
> {
  // Public cases that have a live published version. With the live_version_id
  // pointer this is a simple filter — no subquery needed.
  return db
    .select({
      id:            roiCases.id,
      ownerId:       roiCases.ownerId,
      title:         roiCases.title,
      summary:       roiCases.summary,
      isPrivate:     roiCases.isPrivate,
      shareSlug:     roiCases.shareSlug,
      liveVersionId: roiCases.liveVersionId,
      promotedAt:    roiCases.promotedAt,
      createdAt:     roiCases.createdAt,
      updatedAt:     roiCases.updatedAt,
      ownerEmail:    users.email,
    })
    .from(roiCases)
    .innerJoin(users, eq(roiCases.ownerId, users.id))
    .where(and(eq(roiCases.isPrivate, false), isNotNull(roiCases.liveVersionId)))
    .orderBy(roiCases.createdAt)
}

/**
 * Cases promoted to the public landing page: promoted AND public AND published.
 * The extra public+published gate is essential — a case can be promoted and
 * later made private / unpublished, and must NOT leak onto the landing page.
 * Newest promotion first.
 */
export async function listPromotedCases(): Promise<
  Array<RoiCase & { ownerEmail: string | null }>
> {
  return db
    .select({
      id:            roiCases.id,
      ownerId:       roiCases.ownerId,
      title:         roiCases.title,
      summary:       roiCases.summary,
      isPrivate:     roiCases.isPrivate,
      shareSlug:     roiCases.shareSlug,
      liveVersionId: roiCases.liveVersionId,
      promotedAt:    roiCases.promotedAt,
      createdAt:     roiCases.createdAt,
      updatedAt:     roiCases.updatedAt,
      ownerEmail:    users.email,
    })
    .from(roiCases)
    .innerJoin(users, eq(roiCases.ownerId, users.id))
    .where(
      and(
        isNotNull(roiCases.promotedAt),
        eq(roiCases.isPrivate, false),
        isNotNull(roiCases.liveVersionId)
      )
    )
    .orderBy(desc(roiCases.promotedAt))
}

/** Admin: promote/unpromote a case. Promoting stamps promoted_at = now. */
export async function setCasePromoted(caseId: string, promoted: boolean): Promise<void> {
  await db
    .update(roiCases)
    .set({ promotedAt: promoted ? new Date() : null })
    .where(eq(roiCases.id, caseId))
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function createCase(
  ownerId: string,
  title: string
): Promise<RoiCase> {
  // Retry slug generation on the rare chance of a collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug()

    try {
      const result = await db.transaction(async (tx) => {
        const [newCase] = await tx
          .insert(roiCases)
          .values({ ownerId, title, shareSlug: slug } satisfies Partial<NewRoiCase>)
          .returning()

        if (!newCase) throw new Error('Case insert returned no rows')

        const fieldRows = buildCaseFieldRows(newCase.id)
        await tx.insert(roiCaseFields).values(fieldRows)

        return newCase
      })

      return result
    } catch (err) {
      // Unique violation on share_slug — try a different slug
      if (isUniqueViolation(err) && attempt < 4) continue
      throw err
    }
  }

  throw new Error('Failed to generate a unique case slug after 5 attempts')
}

export async function updateCaseMeta(
  caseId: string,
  sessionUserId: string,
  sessionRole: Role,
  updates: { title?: string; summary?: string | null; isPrivate?: boolean }
): Promise<void> {
  const roiCase = await db
    .select()
    .from(roiCases)
    .where(eq(roiCases.id, caseId))
    .limit(1)
    .then((r) => r[0] ?? null)

  if (!roiCase) throw new Error('Case not found')
  assertCanEdit(roiCase, sessionUserId, sessionRole)

  if (Object.keys(updates).length === 0) return

  await db
    .update(roiCases)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(roiCases.id, caseId))
}

export async function deleteCase(
  caseId: string,
  sessionUserId: string,
  sessionRole: Role
): Promise<void> {
  const roiCase = await db
    .select()
    .from(roiCases)
    .where(eq(roiCases.id, caseId))
    .limit(1)
    .then((r) => r[0] ?? null)

  if (!roiCase) throw new Error('Case not found')
  assertCanEdit(roiCase, sessionUserId, sessionRole)

  await db.delete(roiCases).where(eq(roiCases.id, caseId))
}

export const SPLIT_FIELD_KEYS = [
  'rjc_outcome_split.resolution_pct',
  'rjc_outcome_split.preconferencing_only_pct',
  'rjc_outcome_split.conferenced_unresolved_pct',
] as const

// How far the entered outcome-split sum may be from 100% before we reject it.
// In fraction units: 5e-4 = 0.05 percentage points. Generous enough for typed
// decimals, tight enough to mean "100%". The value is renormalized to exact
// before storage. Shared shape with the client check in SplitEditor.
export const SPLIT_SUM_TOLERANCE = 5e-4

/**
 * Update a single case field's value and (optionally) its annotation.
 *
 * The three RJC outcome-split fields are NOT updatable here — they must be saved
 * together via updateSplit() so the 100%-sum invariant can be enforced. Saving
 * one in isolation would transiently break the constraint.
 */
export async function updateCaseField(
  caseId: string,
  fieldKey: string,
  rawValue: string,
  sessionUserId: string,
  sessionRole: Role,
  annotation?: string | null
): Promise<void> {
  if ((SPLIT_FIELD_KEYS as readonly string[]).includes(fieldKey)) {
    throw new Error(
      'Outcome-split fields must be saved together via updateSplit(), not individually'
    )
  }

  await loadEditableCase(caseId, sessionUserId, sessionRole)

  if (!isFieldPerCaseEditable(fieldKey)) {
    throw new Error(`Field '${fieldKey}' is a fixed model constant, not editable per-case`)
  }

  const value = Number(rawValue)
  if (!isFinite(value)) {
    throw new Error(`Invalid numeric value for field '${fieldKey}': ${rawValue}`)
  }

  const set: { currentValue: string; annotation?: string | null } = {
    currentValue: String(value),
  }
  if (annotation !== undefined) {
    const trimmed = annotation?.trim() ?? ''
    set.annotation = trimmed === '' ? null : trimmed
  }

  await db.transaction(async (tx) => {
    await tx
      .update(roiCaseFields)
      .set(set)
      .where(
        and(eq(roiCaseFields.caseId, caseId), eq(roiCaseFields.fieldKey, fieldKey))
      )

    await tx
      .update(roiCases)
      .set({ updatedAt: new Date() })
      .where(eq(roiCases.id, caseId))
  })
}

/**
 * Update a group of fields that share a single annotation (e.g. a CJS cost line:
 * units + cost + the three applicability %s, with one "note on change" for the
 * whole row). Values are stored as-is (caller converts %s to fractions first).
 * The shared note is written to annotationKey and cleared on the other fields so
 * the row has exactly one canonical note.
 */
export async function updateFieldGroup(
  caseId: string,
  updates: Array<{ fieldKey: string; value: number }>,
  annotation: string | null | undefined,
  annotationKey: string,
  sessionUserId: string,
  sessionRole: Role
): Promise<void> {
  await loadEditableCase(caseId, sessionUserId, sessionRole)

  for (const u of updates) {
    if (!isFieldPerCaseEditable(u.fieldKey)) {
      throw new Error(`Field '${u.fieldKey}' is not editable per-case`)
    }
    if (!isFinite(u.value)) {
      throw new Error(`Invalid numeric value for field '${u.fieldKey}': ${u.value}`)
    }
  }

  let note: string | null | undefined = undefined
  if (annotation !== undefined) {
    const trimmed = annotation?.trim() ?? ''
    note = trimmed === '' ? null : trimmed
  }

  await db.transaction(async (tx) => {
    for (const u of updates) {
      const set: { currentValue: string; annotation?: string | null } = {
        currentValue: String(u.value),
      }
      if (note !== undefined) {
        // Canonical field holds the note; clear it on the others.
        set.annotation = u.fieldKey === annotationKey ? note : null
      }
      await tx
        .update(roiCaseFields)
        .set(set)
        .where(and(eq(roiCaseFields.caseId, caseId), eq(roiCaseFields.fieldKey, u.fieldKey)))
    }

    await tx
      .update(roiCases)
      .set({ updatedAt: new Date() })
      .where(eq(roiCases.id, caseId))
  })
}

/**
 * Update all three RJC outcome-split values together.
 *
 * The three must sum to 1 (100%) within a small epsilon and each be non-negative.
 * Enforced here server-side regardless of what the client sends — the calculation
 * engine requires sum-to-1 and would otherwise throw.
 */
export async function updateSplit(
  caseId: string,
  values: {
    resolution_pct: number
    preconferencing_only_pct: number
    conferenced_unresolved_pct: number
  },
  sessionUserId: string,
  sessionRole: Role,
  annotation?: string | null
): Promise<void> {
  await loadEditableCase(caseId, sessionUserId, sessionRole)

  const { resolution_pct, preconferencing_only_pct, conferenced_unresolved_pct } = values

  for (const [k, v] of Object.entries(values)) {
    if (!isFinite(v) || v < 0) {
      throw new Error(`Invalid outcome-split value for ${k}: ${v} (must be ≥ 0)`)
    }
  }

  // Validate against a human-friendly tolerance (typed percentages won't hit
  // exact float sums). SPLIT_SUM_TOLERANCE is in fraction units.
  const sum = resolution_pct + preconferencing_only_pct + conferenced_unresolved_pct
  if (Math.abs(sum - 1) > SPLIT_SUM_TOLERANCE) {
    throw new Error(
      `Outcome split must total 100% (got ${(sum * 100).toFixed(4)}%)`
    )
  }

  // Renormalize so the stored triple sums to exactly 1 in float — the engine's
  // sum-to-1 check uses a 1e-9 epsilon and would otherwise reject a value that
  // is only "close" to 100%. Renormalizing perturbs each value by < tolerance,
  // which is below display precision.
  const norm = (v: number) => v / sum

  // The split has ONE shared note. Written to all three rows together (they're
  // only ever updated as a group here, so they can't drift); read back from the
  // resolution_pct row. Omitted from the update when annotation is undefined.
  let sharedAnnotation: string | null | undefined = undefined
  if (annotation !== undefined) {
    const trimmed = annotation?.trim() ?? ''
    sharedAnnotation = trimmed === '' ? null : trimmed
  }

  await db.transaction(async (tx) => {
    const pairs: Array<[string, number]> = [
      ['rjc_outcome_split.resolution_pct', norm(resolution_pct)],
      ['rjc_outcome_split.preconferencing_only_pct', norm(preconferencing_only_pct)],
      ['rjc_outcome_split.conferenced_unresolved_pct', norm(conferenced_unresolved_pct)],
    ]

    for (const [fieldKey, v] of pairs) {
      const set: { currentValue: string; annotation?: string | null } = {
        currentValue: String(v),
      }
      if (sharedAnnotation !== undefined) set.annotation = sharedAnnotation

      await tx
        .update(roiCaseFields)
        .set(set)
        .where(
          and(eq(roiCaseFields.caseId, caseId), eq(roiCaseFields.fieldKey, fieldKey))
        )
    }

    await tx
      .update(roiCases)
      .set({ updatedAt: new Date() })
      .where(eq(roiCases.id, caseId))
  })
}

/** Load a case and assert the session may edit it. Throws on missing/forbidden. */
async function loadEditableCase(
  caseId: string,
  sessionUserId: string,
  sessionRole: Role
): Promise<RoiCase> {
  const roiCase = await db
    .select()
    .from(roiCases)
    .where(eq(roiCases.id, caseId))
    .limit(1)
    .then((r) => r[0] ?? null)

  if (!roiCase) throw new Error('Case not found')
  assertCanEdit(roiCase, sessionUserId, sessionRole)
  return roiCase
}

// ─── Publish / Versions ───────────────────────────────────────────────────────

/**
 * Snapshot the live draft into a new immutable version and point the case's
 * live_version_id at it. Atomic; retries on the (case_id, version_number)
 * unique collision the way createCase retries slug collisions.
 */
export async function publishCase(
  caseId: string,
  sessionUserId: string,
  sessionRole: Role
): Promise<RoiCaseVersion> {
  const roiCase = await loadEditableCase(caseId, sessionUserId, sessionRole)
  const fields = await getCaseFields(caseId)
  const snapshot = buildSnapshot(roiCase.title, fields)

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const [{ maxNum }] = await tx
          .select({
            maxNum: sql<number>`coalesce(max(${roiCaseVersions.versionNumber}), 0)`,
          })
          .from(roiCaseVersions)
          .where(eq(roiCaseVersions.caseId, caseId))

        const nextNumber = Number(maxNum) + 1

        const [version] = await tx
          .insert(roiCaseVersions)
          .values({
            caseId,
            versionNumber: nextNumber,
            snapshot,
            publishedBy: sessionUserId,
          })
          .returning()

        if (!version) throw new Error('Version insert returned no rows')

        await tx
          .update(roiCases)
          .set({ liveVersionId: version.id, updatedAt: new Date() })
          .where(eq(roiCases.id, caseId))

        return version
      })
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 4) continue
      throw err
    }
  }

  throw new Error('Failed to publish after 5 attempts')
}

/**
 * Restore an older version: copy its snapshot values + annotations back into the
 * live draft AND re-point live_version_id to that version. The restored version
 * becomes both the working draft and the live (public-eligible) version. Does
 * not create a new version.
 */
export async function restoreVersion(
  caseId: string,
  versionNumber: number,
  sessionUserId: string,
  sessionRole: Role
): Promise<void> {
  await loadEditableCase(caseId, sessionUserId, sessionRole)

  const [version] = await db
    .select()
    .from(roiCaseVersions)
    .where(
      and(
        eq(roiCaseVersions.caseId, caseId),
        eq(roiCaseVersions.versionNumber, versionNumber)
      )
    )
    .limit(1)

  if (!version) throw new Error('Version not found')
  const snapshot = version.snapshot as CaseSnapshot

  await db.transaction(async (tx) => {
    for (const f of snapshot.fields) {
      await tx
        .update(roiCaseFields)
        .set({ currentValue: f.currentValue, annotation: f.annotation })
        .where(
          and(eq(roiCaseFields.caseId, caseId), eq(roiCaseFields.fieldKey, f.fieldKey))
        )
    }

    await tx
      .update(roiCases)
      .set({ liveVersionId: version.id, updatedAt: new Date() })
      .where(eq(roiCases.id, caseId))
  })
}

export interface VersionListItem {
  id: string
  versionNumber: number
  publishedAt: Date
  publishedByEmail: string | null
}

/** List a case's versions, newest first. Owner/admin only (gate at call site). */
export async function listVersions(caseId: string): Promise<VersionListItem[]> {
  return db
    .select({
      id:               roiCaseVersions.id,
      versionNumber:    roiCaseVersions.versionNumber,
      publishedAt:      roiCaseVersions.publishedAt,
      publishedByEmail: users.email,
    })
    .from(roiCaseVersions)
    .innerJoin(users, eq(roiCaseVersions.publishedBy, users.id))
    .where(eq(roiCaseVersions.caseId, caseId))
    .orderBy(desc(roiCaseVersions.versionNumber))
}

/** Fetch one version of a case by its version number (incl. snapshot). */
export async function getVersion(
  caseId: string,
  versionNumber: number
): Promise<RoiCaseVersion | null> {
  const [v] = await db
    .select()
    .from(roiCaseVersions)
    .where(
      and(
        eq(roiCaseVersions.caseId, caseId),
        eq(roiCaseVersions.versionNumber, versionNumber)
      )
    )
    .limit(1)
  return v ?? null
}

/** Fetch a version by its id — used to render the live version for viewers. */
export async function getVersionById(id: string): Promise<RoiCaseVersion | null> {
  const [v] = await db
    .select()
    .from(roiCaseVersions)
    .where(eq(roiCaseVersions.id, id))
    .limit(1)
  return v ?? null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === '23505'
  )
}
