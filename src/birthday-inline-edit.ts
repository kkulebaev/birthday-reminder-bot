import type { Context } from 'grammy'
import { prisma } from './db.js'

type InlineEditMode = 'note' | 'rename' | 'setdate'

type InlineEditSession = {
  birthdayId: string
  mode: InlineEditMode
}

export type InlineEditResult =
  | { kind: 'missing'; message: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'updated'; birthdayId: string; message: string }

const sessions = new Map<string, InlineEditSession>()

function getUserKey(ctx: Context): string {
  const from = ctx.from

  if (!from) {
    throw new Error('Sender is missing in context')
  }

  return String(from.id)
}

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

export function beginInlineEdit(ctx: Context, birthdayId: string, mode: InlineEditMode): string {
  sessions.set(getUserKey(ctx), { birthdayId, mode })

  if (mode === 'note') {
    return 'Отправь новую заметку одним сообщением.'
  }

  if (mode === 'rename') {
    return 'Отправь новое имя одним сообщением.'
  }

  return 'Отправь новую дату в формате DD.MM или DD.MM.YYYY.'
}

export function cancelInlineEdit(ctx: Context): boolean {
  return sessions.delete(getUserKey(ctx))
}

export function hasInlineEditSession(ctx: Context): boolean {
  return sessions.has(getUserKey(ctx))
}

export async function handleInlineEditText(ctx: Context, userId: string, text: string): Promise<InlineEditResult> {
  const session = sessions.get(getUserKey(ctx))

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
    sessions.delete(getUserKey(ctx))
    return { kind: 'missing', message: 'Не нашёл такую запись.' }
  }

  if (session.mode === 'note') {
    await prisma.birthday.update({
      where: { id: birthday.id },
      data: { notes: text.trim() || null },
    })

    sessions.delete(getUserKey(ctx))
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

    sessions.delete(getUserKey(ctx))
    return { kind: 'updated', birthdayId: birthday.id, message: 'Готово, имя обновил.' }
  }

  const parsedDate = parseDateInput(text)

  if (!parsedDate) {
    return { kind: 'invalid', message: 'Дата должна быть в формате DD.MM или DD.MM.YYYY.' }
  }

  await prisma.birthday.update({
    where: { id: birthday.id },
    data: {
      day: parsedDate.day,
      month: parsedDate.month,
      birthYear: parsedDate.birthYear,
    },
  })

  sessions.delete(getUserKey(ctx))
  return { kind: 'updated', birthdayId: birthday.id, message: 'Готово, дату обновил.' }
}
