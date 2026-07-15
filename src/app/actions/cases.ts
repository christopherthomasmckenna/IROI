'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { assertCreator } from '@/lib/auth/permissions'
import { toStoredValue } from '@/lib/cases/field-units'
import {
  createCase,
  deleteCase,
  publishCase,
  restoreVersion,
  updateCaseField,
  updateCaseMeta,
  updateFieldGroup,
  updateSplit,
} from '@/lib/cases/operations'

export async function createCaseAction(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions)
  assertCreator(session)

  const title = (formData.get('title') as string | null)?.trim()
  if (!title) throw new Error('Title is required')

  const newCase = await createCase(session.user.id, title)
  redirect(`/case/${newCase.shareSlug}`)
}

/**
 * Pre-bind caseId and caseSlug via .bind(null, caseId, caseSlug) before
 * passing as a form action so revalidatePath can use the slug.
 */
export async function updateCaseFieldAction(
  caseId: string,
  caseSlug: string,
  fieldKey: string,
  formData: FormData
): Promise<void> {
  const session = await getServerSession(authOptions)
  assertCreator(session)

  const rawValue = formData.get('value') as string | null
  if (rawValue === null) throw new Error('Value is required')
  // Percentage fields are entered as 0–100 but stored as fractions 0–1.
  const stored = String(toStoredValue(Number(rawValue), fieldKey))

  // annotation is optional; absent field => leave unchanged, empty => clear
  const annotation = formData.has('annotation')
    ? ((formData.get('annotation') as string | null) ?? '')
    : undefined

  await updateCaseField(
    caseId,
    fieldKey,
    stored,
    session.user.id,
    session.user.role,
    annotation
  )
  revalidatePath(`/case/${caseSlug}`)
}

export async function updateCjsRowAction(
  caseId: string,
  caseSlug: string,
  rowId: string,
  formData: FormData
): Promise<void> {
  const session = await getServerSession(authOptions)
  assertCreator(session)

  const num = (name: string): number => {
    const raw = formData.get(name) as string | null
    if (raw === null) throw new Error(`${name} is required`)
    return Number(raw)
  }
  // pct fields are entered as percentages (0–100); stored as fractions (0–1).
  const updates = [
    { fieldKey: `${rowId}.units_required`, value: num('units_required') },
    { fieldKey: `${rowId}.cost_per_unit`,  value: num('cost_per_unit') },
    { fieldKey: `${rowId}.pct_low`,        value: num('pct_low') / 100 },
    { fieldKey: `${rowId}.pct_medium`,     value: num('pct_medium') / 100 },
    { fieldKey: `${rowId}.pct_high`,       value: num('pct_high') / 100 },
  ]

  const annotation = formData.has('annotation')
    ? ((formData.get('annotation') as string | null) ?? '')
    : undefined

  await updateFieldGroup(
    caseId,
    updates,
    annotation,
    `${rowId}.units_required`,
    session.user.id,
    session.user.role
  )
  revalidatePath(`/case/${caseSlug}`)
}

export async function updateSplitAction(
  caseId: string,
  caseSlug: string,
  formData: FormData
): Promise<void> {
  const session = await getServerSession(authOptions)
  assertCreator(session)

  const num = (name: string): number => {
    const raw = formData.get(name) as string | null
    if (raw === null) throw new Error(`${name} is required`)
    // Inputs are entered as percentages (0–100); store as fractions (0–1).
    return Number(raw) / 100
  }

  const annotation = formData.has('annotation')
    ? ((formData.get('annotation') as string | null) ?? '')
    : undefined

  await updateSplit(
    caseId,
    {
      resolution_pct:             num('resolution_pct'),
      preconferencing_only_pct:   num('preconferencing_only_pct'),
      conferenced_unresolved_pct: num('conferenced_unresolved_pct'),
    },
    session.user.id,
    session.user.role,
    annotation
  )
  revalidatePath(`/case/${caseSlug}`)
}

export async function updateCaseTitleAction(
  caseId: string,
  caseSlug: string,
  formData: FormData
): Promise<void> {
  const session = await getServerSession(authOptions)
  assertCreator(session)

  const title = (formData.get('title') as string | null)?.trim()
  if (!title) throw new Error('Title is required')

  await updateCaseMeta(caseId, session.user.id, session.user.role, { title })
  revalidatePath(`/case/${caseSlug}`)
}

export async function updateCaseSummaryAction(
  caseId: string,
  caseSlug: string,
  formData: FormData
): Promise<void> {
  const session = await getServerSession(authOptions)
  assertCreator(session)

  const raw = (formData.get('summary') as string | null)?.trim() ?? ''
  await updateCaseMeta(caseId, session.user.id, session.user.role, {
    summary: raw === '' ? null : raw,
  })
  revalidatePath(`/case/${caseSlug}`)
}

export async function toggleCasePrivacyAction(
  caseId: string,
  caseSlug: string,
  isCurrentlyPrivate: boolean
): Promise<void> {
  const session = await getServerSession(authOptions)
  assertCreator(session)

  await updateCaseMeta(caseId, session.user.id, session.user.role, {
    isPrivate: !isCurrentlyPrivate,
  })
  revalidatePath(`/case/${caseSlug}`)
}

export async function deleteCaseAction(caseId: string): Promise<void> {
  const session = await getServerSession(authOptions)
  assertCreator(session)

  await deleteCase(caseId, session.user.id, session.user.role)
  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export async function publishCaseAction(
  caseId: string,
  caseSlug: string
): Promise<void> {
  const session = await getServerSession(authOptions)
  assertCreator(session)

  await publishCase(caseId, session.user.id, session.user.role)
  revalidatePath(`/case/${caseSlug}`)
}

export async function restoreVersionAction(
  caseId: string,
  caseSlug: string,
  versionNumber: number
): Promise<void> {
  const session = await getServerSession(authOptions)
  assertCreator(session)

  await restoreVersion(caseId, versionNumber, session.user.id, session.user.role)
  revalidatePath(`/case/${caseSlug}`)
}
