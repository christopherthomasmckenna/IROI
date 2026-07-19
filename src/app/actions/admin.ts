'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { assertAdmin } from '@/lib/auth/permissions'
import { upsertFieldGuidance } from '@/lib/cases/field-guidance'
import { setUserRole } from '@/lib/users'
import { setCasePromoted } from '@/lib/cases/operations'
import { upsertContentBlock } from '@/lib/cases/content-blocks'
import type { Role } from '@/lib/db/schema'

export async function updateFieldGuidanceAction(
  variableKey: string,
  formData: FormData
): Promise<void> {
  const session = await getServerSession(authOptions)
  assertAdmin(session)

  const val = (name: string) => (formData.get(name) as string | null) ?? null
  await upsertFieldGuidance(
    variableKey,
    {
      shortHint:     val('short_hint'),
      meaning:       val('meaning'),
      howToLocalize: val('how_to_localize'),
      provenance:    val('provenance'),
    },
    session.user.id
  )

  // Case pages are dynamic and re-read guidance on each request, so they
  // pick this up automatically. Revalidate the admin screen itself.
  revalidatePath('/admin/fields')
}

export async function updateContentBlockAction(key: string, formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions)
  assertAdmin(session)

  const body = (formData.get('body') as string | null) ?? ''
  await upsertContentBlock(key, body, session.user.id)

  revalidatePath('/admin/content')
  revalidatePath('/') // landing page copy
  // section accordions render on dynamic case pages, picked up on next request
}

export async function setCasePromotedAction(caseId: string, promote: boolean): Promise<void> {
  const session = await getServerSession(authOptions)
  assertAdmin(session)

  await setCasePromoted(caseId, promote)
  revalidatePath('/admin/promote')
  revalidatePath('/') // landing page shows promoted cases
}

export async function setUserRoleAction(userId: string, role: Role): Promise<void> {
  const session = await getServerSession(authOptions)
  assertAdmin(session)

  // UX guard: don't let an admin change their own role (the data layer's
  // last-admin check is the real safety net against lockout).
  if (userId === session.user.id) {
    throw new Error('You cannot change your own role')
  }

  await setUserRole(userId, role)
  revalidatePath('/admin/users')
}
