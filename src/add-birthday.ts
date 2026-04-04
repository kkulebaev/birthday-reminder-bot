import type { Birthday } from '@prisma/client'
import { InlineKeyboard, type Context } from 'grammy'
import { prisma } from './db.js'
import { upsertUserFromContext } from './user.js'

type AddBirthdayDraft = {
  fullName?: string
  day?: number
  month?: number
  birthYear?: number | null
}

type AddBirthdayStep = 'fullName' | 'day' | 'month' | 'birthYear' | 'notes'

type AddBirthdaySession = {
  step: AddBirthdayStep
  draft: AddBirthdayDraft
}

const sessions = new Map<string, AddBirthdaySession>()

function getUserKey(ctx: Context): string {
  const from = ctx.from

  if (!from) {
    throw new Error('Sender is missing in context')
  }

  return String(from.id)
}

function getSession(ctx: Context): AddBirthdaySession | undefined {
  return sessions.get(getUserKey(ctx))
}

function setSession(ctx: Context, session: AddBirthdaySession): void {
  sessions.set(getUserKey(ctx), session)
}

function clearSession(ctx: Context): boolean {
  return sessions.delete(getUserKey(ctx))
}

function parseInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null
  }

  return Number(value)
}

function validateDay(value: number): boolean {
  return value >= 1 && value <= 31
}

function validateMonth(value: number): boolean {
  return value >= 1 && value <= 12
}

function validateBirthYear(value: number): boolean {
  return value >= 1900 && value <= 2100
}

function isSkipValue(value: string): boolean {
  const normalized = value.trim().toLowerCase()

  return normalized === 'skip'
    || normalized === 'пропустить'
    || normalized === 'без года'
    || normalized === 'без заметки'
    || normalized === 'нет'
}

function formatBirthdayCreatedMessage(birthday: Birthday): string {
  const month = String(birthday.month).padStart(2, '0')
  const day = String(birthday.day).padStart(2, '0')
  const year = birthday.birthYear ? `.${birthday.birthYear}` : ''
  const notes = birthday.notes ? `\nЗаметка: ${birthday.notes}` : ''

  return `Сохранил: ${birthday.fullName}\nДата: ${day}.${month}${year}${notes}`
}

export function beginAddBirthdayFlow(ctx: Context): string {
  setSession(ctx, {
    step: 'fullName',
    draft: {},
  })

  return [
    'Давай добавим день рождения.',
    '',
    'Шаг 1 из 5: отправь Full Name.',
    'Например: Иван Иванов',
  ].join('\n')
}

export function isAddBirthdayFlowActive(ctx: Context): boolean {
  return sessions.has(getUserKey(ctx))
}

export function cancelAddBirthdayFlow(ctx: Context): boolean {
  return clearSession(ctx)
}

export function getAddBirthdaySkipKeyboard(ctx: Context): InlineKeyboard | null {
  const session = getSession(ctx)

  if (!session) {
    return null
  }

  if (session.step !== 'birthYear' && session.step !== 'notes') {
    return null
  }

  return new InlineKeyboard().text('Пропустить', 'birthday:add:skip')
}

export function canSkipAddBirthdayStep(ctx: Context): boolean {
  const session = getSession(ctx)

  return session?.step === 'birthYear' || session?.step === 'notes'
}

export async function skipAddBirthdayStep(ctx: Context): Promise<string> {
  const session = getSession(ctx)

  if (!session) {
    return 'Сейчас нечего пропускать.'
  }

  if (session.step === 'birthYear') {
    setSession(ctx, {
      step: 'notes',
      draft: {
        ...session.draft,
        birthYear: null,
      },
    })

    return 'Шаг 5 из 5: отправь заметку или нажми «Пропустить».'
  }

  if (session.step === 'notes') {
    return finishAddBirthdayFlow(ctx, null)
  }

  return 'Сейчас этот шаг нельзя пропустить.'
}

async function finishAddBirthdayFlow(ctx: Context, notes: string | null): Promise<string> {
  const session = getSession(ctx)

  if (!session) {
    return 'Сейчас wizard не активен.'
  }

  const user = await upsertUserFromContext(ctx)
  const draft = session.draft

  if (!draft.fullName || draft.day === undefined || draft.month === undefined) {
    clearSession(ctx)
    throw new Error('Birthday draft is incomplete')
  }

  const birthday = await prisma.birthday.create({
    data: {
      userId: user.id,
      fullName: draft.fullName,
      day: draft.day,
      month: draft.month,
      birthYear: draft.birthYear ?? null,
      notes,
    },
  })

  clearSession(ctx)

  return formatBirthdayCreatedMessage(birthday)
}

export async function handleAddBirthdayText(ctx: Context, text: string): Promise<string> {
  const session = getSession(ctx)

  if (!session) {
    return 'Сейчас wizard не активен.'
  }

  if (session.step === 'fullName') {
    const fullName = text.trim()

    if (!fullName) {
      return 'Не вижу имени. Отправь Full Name текстом.'
    }

    setSession(ctx, {
      step: 'day',
      draft: {
        ...session.draft,
        fullName,
      },
    })

    return 'Шаг 2 из 5: отправь день месяца числом от 1 до 31.'
  }

  if (session.step === 'day') {
    const day = parseInteger(text.trim())

    if (day === null || !validateDay(day)) {
      return 'День должен быть числом от 1 до 31.'
    }

    setSession(ctx, {
      step: 'month',
      draft: {
        ...session.draft,
        day,
      },
    })

    return 'Шаг 3 из 5: отправь номер месяца числом от 1 до 12.'
  }

  if (session.step === 'month') {
    const month = parseInteger(text.trim())

    if (month === null || !validateMonth(month)) {
      return 'Месяц должен быть числом от 1 до 12.'
    }

    setSession(ctx, {
      step: 'birthYear',
      draft: {
        ...session.draft,
        month,
      },
    })

    return 'Шаг 4 из 5: отправь год рождения числом или нажми «Пропустить».'
  }

  if (session.step === 'birthYear') {
    if (isSkipValue(text)) {
      return skipAddBirthdayStep(ctx)
    }

    const birthYear = parseInteger(text.trim())

    if (birthYear === null || !validateBirthYear(birthYear)) {
      return 'Год рождения должен быть числом от 1900 до 2100. Если не хочешь указывать год, нажми «Пропустить».'
    }

    setSession(ctx, {
      step: 'notes',
      draft: {
        ...session.draft,
        birthYear,
      },
    })

    return 'Шаг 5 из 5: отправь заметку или нажми «Пропустить».'
  }

  if (isSkipValue(text)) {
    return skipAddBirthdayStep(ctx)
  }

  const notes = text.trim() || null

  return finishAddBirthdayFlow(ctx, notes)
}
