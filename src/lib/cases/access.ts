import type { RoiCase, Role } from '../db/schema'

/**
 * Whether the given user may see a case at all.
 *
 * Rules (from the brief):
 * - Admin: always yes
 * - Owner: always yes
 * - Everyone else: yes only if the case is public AND has a live published
 *   version (roi_cases.live_version_id is set)
 * - Private case + non-owner non-admin: 404 (don't reveal existence)
 *
 * Non-owners see only the live version (read-only) — never the draft or history.
 */
export function canViewCase(
  roiCase: RoiCase,
  sessionUserId: string | null | undefined,
  sessionRole: Role | null | undefined
): boolean {
  if (sessionRole === 'admin') return true
  if (sessionUserId && sessionUserId === roiCase.ownerId) return true
  return !roiCase.isPrivate && roiCase.liveVersionId !== null
}

/**
 * Whether the given user may edit a case's fields or metadata.
 * Owners and admins only; role checking for field-level granularity is handled
 * separately in canEditField().
 */
export function canEditCase(
  roiCase: RoiCase,
  sessionUserId: string | null | undefined,
  sessionRole: Role | null | undefined
): boolean {
  if (sessionRole === 'admin') return true
  if (sessionUserId && sessionUserId === roiCase.ownerId) return true
  return false
}

export class AccessError extends Error {
  constructor(
    public readonly reason: 'not_found' | 'forbidden',
    message: string
  ) {
    super(message)
    this.name = 'AccessError'
  }
}

export function assertCanView(
  roiCase: RoiCase,
  sessionUserId: string | null | undefined,
  sessionRole: Role | null | undefined
): void {
  if (!canViewCase(roiCase, sessionUserId, sessionRole)) {
    throw new AccessError('not_found', 'Case not found or access denied')
  }
}

export function assertCanEdit(
  roiCase: RoiCase,
  sessionUserId: string | null | undefined,
  sessionRole: Role | null | undefined
): void {
  if (!canEditCase(roiCase, sessionUserId, sessionRole)) {
    throw new AccessError('forbidden', 'Not authorized to edit this case')
  }
}
