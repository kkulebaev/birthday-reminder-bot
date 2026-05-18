import type { Context } from 'grammy'
import { prisma } from './db.js'
import { WizardKind } from './generated/prisma/client.js'
import { getSafeErrorMessage } from './telegram-api.js'

import type { AddBirthdaySession } from './add-birthday.js'
import type { InlineEditSession } from './birthday-inline-edit.js'
import type { SettingsSession } from './settings.js'

export { WizardKind }

export type ActiveSessions = {
  addFlow?: AddBirthdaySession
  inlineEdit?: InlineEditSession
  settingsEdit?: SettingsSession
}

export function getTelegramUserKey(ctx: Context): string {
  const from = ctx.from

  if (!from) {
    throw new Error('Sender is missing in context')
  }

  return String(from.id)
}

export async function loadActiveSessions(userId: string): Promise<ActiveSessions> {
  const rows = await prisma.wizardSession.findMany({ where: { userId } })
  const out: ActiveSessions = {}

  for (const row of rows) {
    if (row.kind === WizardKind.add_birthday) {
      out.addFlow = row.payload as unknown as AddBirthdaySession
    } else if (row.kind === WizardKind.inline_edit) {
      out.inlineEdit = row.payload as unknown as InlineEditSession
    } else if (row.kind === WizardKind.settings_edit) {
      out.settingsEdit = row.payload as unknown as SettingsSession
    }
  }

  return out
}

export async function loadSessionPayload<T>(userId: string, kind: WizardKind): Promise<T | null> {
  const row = await prisma.wizardSession.findUnique({
    where: { userId_kind: { userId, kind } },
  })

  if (!row) {
    return null
  }

  return row.payload as unknown as T
}

export async function upsertSession(
  userId: string,
  kind: WizardKind,
  payload: unknown,
): Promise<void> {
  await prisma.wizardSession.upsert({
    where: { userId_kind: { userId, kind } },
    create: { userId, kind, payload: payload as object },
    update: { payload: payload as object },
  })
}

export async function clearSession(userId: string, kind: WizardKind): Promise<boolean> {
  const result = await prisma.wizardSession.deleteMany({ where: { userId, kind } })
  return result.count > 0
}

export async function clearAllSessions(userId: string): Promise<void> {
  await prisma.wizardSession.deleteMany({ where: { userId } })
}

export async function reapStaleSessions(maxAgeMinutes = 60): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000)

  try {
    const result = await prisma.wizardSession.deleteMany({
      where: { updatedAt: { lt: cutoff } },
    })
    return result.count
  } catch (err) {
    console.warn('wizard_sessions reap failed', getSafeErrorMessage(err))
    return 0
  }
}
