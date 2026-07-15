import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', ['creator', 'admin'])

export const sectionKeyEnum = pgEnum('section_key', [
  'cjs_program_costs',
  'rjc_program_costs',
  'hp_rp_community_inputs',
])

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email:        text('email').unique().notNull(),
  // Auth.js-standard columns (populated on account creation via magic link)
  emailVerified: timestamp('email_verified', { mode: 'date', withTimezone: true }),
  name:         text('name'),
  image:        text('image'),
  // App-specific columns
  passwordHash: text('password_hash'),        // nullable — set only if creator adds a password
  role:         roleEnum('role').notNull().default('creator'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Cases ────────────────────────────────────────────────────────────────────

export const roiCases = pgTable(
  'roi_cases',
  {
    id:        uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    ownerId:   uuid('owner_id').notNull().references(() => users.id),
    title:     text('title').notNull(),
    summary:   text('summary'),   // short creator-written description; nullable
    isPrivate: boolean('is_private').notNull().default(true),
    shareSlug: text('share_slug').unique().notNull(),
    // The single published version shown to the public (when also non-private).
    // Null until first publish. Set by publish; re-pointed by restore. The FK is
    // declared loosely (no .references()) to avoid a circular table dependency
    // with roi_case_versions; integrity is enforced in application code.
    liveVersionId: uuid('live_version_id'),
    // Admin-set: when non-null, the case is "promoted" — featured on the public
    // landing page (only if it is also public AND has a live version). The
    // timestamp gives a natural most-recent-first showcase order.
    promotedAt: timestamp('promoted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('roi_cases_owner_id_idx').on(t.ownerId),
  ]
)

// ─── Case Fields ──────────────────────────────────────────────────────────────

/**
 * One row per editable numeric input per case (~81 rows per case).
 *
 * field_key format:
 *   - CJS/RJC rows:  "{row_id}.{subfield}"   e.g. "cjs_row13.units_required"
 *   - Outcome split: "rjc_outcome_split.{subfield}"
 *   - HP/RP/Comm:    "{field_name}"           e.g. "avg_harmed_parties_per_case"
 *
 * default_value is frozen at case-creation time — a copy of the system defaults
 * at that moment, not a live pointer to roi-model-fields.json.
 *
 * note is seeded from the corresponding "notes" field in roi-model-fields.json
 * at case creation. It gives context for what the field represents and where its
 * default came from. Both the creator and admin can update it.
 *
 * annotation is the creator's explanation for why they changed current_value
 * away from default_value. Null until the creator provides one.
 */
export const roiCaseFields = pgTable(
  'roi_case_fields',
  {
    id:           uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    caseId:       uuid('case_id').notNull().references(() => roiCases.id, { onDelete: 'cascade' }),
    sectionKey:   sectionKeyEnum('section_key').notNull(),
    fieldKey:     text('field_key').notNull(),
    defaultValue: numeric('default_value').notNull(),
    currentValue: numeric('current_value').notNull(),
    note:         text('note'),
    annotation:   text('annotation'),
  },
  (t) => [
    unique('roi_case_fields_case_field_key').on(t.caseId, t.fieldKey),
    index('roi_case_fields_case_id_idx').on(t.caseId),
  ]
)

// ─── Case Versions ────────────────────────────────────────────────────────────

/**
 * Immutable publish snapshots. Written only when a Creator explicitly publishes,
 * not on every field edit. The snapshot is a complete copy of all field values
 * and annotations at the moment of publishing, structured as RoiInputs with
 * annotations, so it can be reproduced exactly without querying roi_case_fields.
 */
export const roiCaseVersions = pgTable(
  'roi_case_versions',
  {
    id:            uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    caseId:        uuid('case_id').notNull().references(() => roiCases.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    snapshot:      jsonb('snapshot').notNull(),
    publishedBy:   uuid('published_by').notNull().references(() => users.id),
    publishedAt:   timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('roi_case_versions_case_version').on(t.caseId, t.versionNumber),
    index('roi_case_versions_case_id_idx').on(t.caseId),
  ]
)

// ─── Field Explanations (admin-managed, global) ───────────────────────────────

/**
 * Admin-edited overrides for the ⓘ tooltip explanations, keyed by a logical
 * "variable" key (see variableKeyOf() in field-meta.ts — a CJS/RJC cost-line
 * row, an outcome-split outcome, or an HP/RP/Community field). These are GLOBAL:
 * one canonical explanation per variable, applied to every case. A row exists
 * only when an admin has overridden the default explanation from the JSON; the
 * tooltip falls back to the JSON default when there's no row here.
 */
export const fieldExplanations = pgTable('field_explanations', {
  variableKey: text('variable_key').primaryKey(),
  explanation: text('explanation').notNull(),
  updatedBy:   uuid('updated_by').references(() => users.id),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Admin-edited overrides for editable prose blocks (landing-page copy, the
 * per-section "About this section" accordions). Keyed by a content key (e.g.
 * "landing.intro", "section.cjs"). A row exists only when an admin has
 * overridden the default text baked from the spreadsheet into roi-model-fields.json;
 * rendering falls back to that default when there's no row here.
 */
export const contentBlocks = pgTable('content_blocks', {
  key:       text('key').primaryKey(),
  body:      text('body').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Rate limiting ────────────────────────────────────────────────────────────

/**
 * Sliding-window event log for rate limiting (currently the magic-link sign-in
 * email endpoint). One row per attempt per bucket — "email:<addr>", "ip:<addr>",
 * or "global:<name>". Counts within a time window gate the action; rows older
 * than the longest window are pruned. Postgres-backed (not in-memory) so it
 * holds across multiple app instances.
 */
export const rateLimitEvents = pgTable(
  'rate_limit_events',
  {
    id:        uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    bucket:    text('bucket').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('rate_limit_events_bucket_created_idx').on(t.bucket, t.createdAt),
  ]
)

// ─── Auth.js tables ───────────────────────────────────────────────────────────
//
// Required by @auth/drizzle-adapter. `accounts` links OAuth provider records to
// users (reserved for future OAuth support); `sessions` holds DB sessions;
// `verificationTokens` holds magic-link tokens pending use.
//
// TypeScript property names must match what the adapter expects (see
// node_modules/@auth/drizzle-adapter/lib/pg.js).

export const accounts = pgTable(
  'accounts',
  {
    userId:            uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type:              text('type').notNull(),
    provider:          text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token:     text('refresh_token'),
    access_token:      text('access_token'),
    expires_at:        integer('expires_at'),
    token_type:        text('token_type'),
    scope:             text('scope'),
    id_token:          text('id_token'),
    session_state:     text('session_state'),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index('accounts_user_id_idx').on(t.userId),
  ]
)

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires:      timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
})

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token:      text('token').notNull(),
    expires:    timestamp('expires', { mode: 'date', withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.identifier, t.token] }),
  ]
)

// ─── Inferred types ───────────────────────────────────────────────────────────

export type Role           = typeof roleEnum.enumValues[number]   // 'creator' | 'admin'
export type User           = typeof users.$inferSelect
export type NewUser        = typeof users.$inferInsert
export type RoiCase        = typeof roiCases.$inferSelect
export type NewRoiCase     = typeof roiCases.$inferInsert
export type RoiCaseField   = typeof roiCaseFields.$inferSelect
export type NewRoiCaseField = typeof roiCaseFields.$inferInsert
export type RoiCaseVersion = typeof roiCaseVersions.$inferSelect
export type NewRoiCaseVersion = typeof roiCaseVersions.$inferInsert
export type FieldExplanation = typeof fieldExplanations.$inferSelect
export type NewFieldExplanation = typeof fieldExplanations.$inferInsert
