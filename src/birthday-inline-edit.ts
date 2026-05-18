import type { Context } from 'grammy'
import { isLeapDayBirthday, LEAP_DAY_REJECTION_MESSAGE } from './add-birthday.js'
import { prisma } from './db.js'
import { schedulerService } from './scheduler-service.js'
import {
  clearSession,
  getTelegramUserKey,
  loadSessionPayload,
  upsertSession,
  WizardKind,
} from './wizard-session.js'

type InlineEditMode = 'note' | 'rename' | 'setdate'

export type InlineEditSession = {
  birthdayId: string
  mode: InlineEditMode
}

export type InlineEditResult =
  | { kind: 'missing'; message: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'updated'; birthdayId: string; message: string }

function parseInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null
  }

  return Number(value)
}

function parseDateInput(value: string): { day: number; month: number; birthYear: number | null } | null {
  const parts = value.trim().split('.')

  if (parts.length < 2 || parts.length > 3) {
    return null
  }

  const [dayPart, monthPart, yearPart] = parts
  const day = parseInteger(dayPart ?? '')
  const month = parseInteger(monthPart ?? '')

  if (day === null || month === null) {
    return null
  }

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return null
  }

  if (!yearPart) {
    return {
      day,
      month,
      birthYear: null,
    }
  }

  const birthYear = parseInteger(yearPart)

  if (birthYear === null || birthYear < 1900 || birthYear > 2100) {
    return null
  }

  return {
    day,
    month,
    birthYear,
  }
}

export async function beginInlineEdit(ctx: Context, birthdayId: string, mode: InlineEditMode): Promise<string> {
  await upsertSession(getTelegramUserKey(ctx), WizardKind.inline_edit, { birthdayId, mode })

  if (mode === 'note') {
    return 'Отправь новую заметку одним сообщением.'
  }

  if (mode === 'rename') {
    return 'Отправь новое имя одним сообщением.'
  }

  return 'Отправь новую дату в формате DD.MM или DD.MM.YYYY.'
}

export async function cancelInlineEdit(ctx: Context): Promise<boolean> {
  return clearSession(getTelegramUserKey(ctx), WizardKind.inline_edit)
}

export async function hasInlineEditSession(ctx: Context): Promise<boolean> {
  const session = await loadSessionPayload<InlineEditSession>(getTelegramUserKey(ctx), WizardKind.inline_edit)
  return session !== null
}

export async function handleInlineEditText(ctx: Context, userId: string, text: string): Promise<InlineEditResult> {
  const key = getTelegramUserKey(ctx)
  const session = await loadSessionPayload<InlineEditSession>(key, WizardKind.inline_edit)

  if (!session) {
    return { kind: 'missing', message: 'Сейчас нечего редактировать.' }
  }

  const birthday = await prisma.birthday.findFirst({
    where: {
      id: session.birthdayId,
      userId,
      deletedAt: null,
    },
  })

  if (!birthday) {
    await clearSession(key, WizardKind.inline_edit)
    return { kind: 'missing', message: 'Не нашёл такую запись.' }
  }

  if (session.mode === 'note') {
    await prisma.birthday.update({
      where: { id: birthday.id },
      data: { notes: text.trim() || null },
    })

    await clearSession(key, WizardKind.inline_edit)
    return { kind: 'updated', birthdayId: birthday.id, message: 'Готово, заметку обновил.' }
  }

  if (session.mode === 'rename') {
    const fullName = text.trim()

    if (!fullName) {
      return { kind: 'invalid', message: 'Имя не должно быть пустым.' }
    }

    await prisma.birthday.update({
      where: { id: birthday.id },
      data: { fullName },
    })

    await clearSession(key, WizardKind.inline_edit)
    return { kind: 'updated', birthdayId: birthday.id, message: 'Готово, имя обновил.' }
  }

  const parsedDate = parseDateInput(text)

  if (!parsedDate) {
    return { kind: 'invalid', message: 'Дата должна быть в формате DD.MM или DD.MM.YYYY.' }
  }

  if (isLeapDayBirthday(parsedDate.day, parsedDate.month)) {
    return { kind: 'invalid', message: LEAP_DAY_REJECTION_MESSAGE }
  }

  await prisma.birthday.update({
    where: { id: birthday.id },
    data: {
      day: parsedDate.day,
      month: parsedDate.month,
      birthYear: parsedDate.birthYear,
    },
  })

  await schedulerService.rebuildBirthdayNotification(birthday.id)
  await clearSession(key, WizardKind.inline_edit)
  return { kind: 'updated', birthdayId: birthday.id, message: 'Готово, дату обновил.' }
}
