import type { Birthday } from '@prisma/client'
import { InlineKeyboard, type Context } from 'grammy'
import { prisma } from './db.js'
import { upsertUserFromContext } from './user.js'

type AddBirthdayDraft = {
  fullName?: string
  day?: number
  month?: number
  birthYear?: number | null
  notes?: string | null
}

type AddBirthdayStep = 'fullName' | 'day' | 'month' | 'birthYear' | 'notes' | 'confirm'

type AddBirthdaySession = {
  step: AddBirthdayStep
  draft: AddBirthdayDraft
}

const sessions = new Map<string, AddBirthdaySession>()
export const monthLabels = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

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

export function parseInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null
  }

  return Number(value)
}

export function validateDay(value: number): boolean {
  return value >= 1 && value <= 31
}

export function validateMonth(value: number): boolean {
  return value >= 1 && value <= 12
}

export function validateBirthYear(value: number): boolean {
  return value >= 1900 && value <= 2100
}

export function isSkipValue(value: string): boolean {
  const normalized = value.trim().toLowerCase()

  return normalized === 'skip'
    || normalized === 'пропустить'
    || normalized === 'без года'
    || normalized === 'без заметки'
    || normalized === 'нет'
}

function formatDatePreview(draft: AddBirthdayDraft): string {
  const day = draft.day ? String(draft.day).padStart(2, '0') : '—'
  const month = draft.month ? String(draft.month).padStart(2, '0') : '—'
  const year = draft.birthYear ? `.${draft.birthYear}` : ''

  return `${day}.${month}${year}`
}

function formatDraftProgress(draft: AddBirthdayDraft): string {
  return [
    `Имя: ${draft.fullName ?? '—'}`,
    `Дата: ${formatDatePreview(draft)}`,
    `Заметка: ${draft.notes ?? '—'}`,
  ].join('\n')
}

function formatBirthdayCreatedMessage(birthday: Birthday): string {
  const month = String(birthday.month).padStart(2, '0')
  const day = String(birthday.day).padStart(2, '0')
  const year = birthday.birthYear ? `.${birthday.birthYear}` : ''
  const notes = birthday.notes ? `\nЗаметка: ${birthday.notes}` : ''

  return [
    `Готово, сохранил день рождения для ${birthday.fullName}.`,
    '',
    `Дата: ${day}.${month}${year}`,
    notes ? `Заметка: ${birthday.notes}` : 'Заметка: —',
  ].join('\n')
}

function formatDraftSummary(draft: AddBirthdayDraft): string {
  return [
    'Проверь перед сохранением:',
    '',
    formatDraftProgress(draft),
    '',
    'Если всё верно, нажми «Сохранить».',
  ].join('\n')
}

function getMonthKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  monthLabels.forEach((label, index) => {
    keyboard.text(label, `birthday:add:month:${index + 1}`)

    if ((index + 1) % 3 === 0 && index !== monthLabels.length - 1) {
      keyboard.row()
    }
  })

  return keyboard
}

function getConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Сохранить', 'birthday:add:confirm')
    .text('❌ Отмена', 'birthday:add:cancel')
}

export function getAddBirthdaySuccessKeyboard(birthdayId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('➕ Добавить ещё', 'menu:add')
    .text('🎂 Открыть карточку', `birthday:view:${birthdayId}`)
    .row()
    .text('🎈 Ближайшие', 'menu:upcoming')
    .text('🏠 Главное меню', 'menu:home')
}

export function beginAddBirthdayFlow(ctx: Context): string {
  setSession(ctx, {
    step: 'fullName',
    draft: {},
  })

  return [
    'Давай добавим день рождения.',
    '',
    'Шаг 1 из 5: как зовут человека?',
    'Например: Иван Иванов',
  ].join('\n')
}

export function isAddBirthdayFlowActive(ctx: Context): boolean {
  return sessions.has(getUserKey(ctx))
}

export function cancelAddBirthdayFlow(ctx: Context): boolean {
  return clearSession(ctx)
}

export function getAddBirthdayOptionalKeyboard(ctx: Context): InlineKeyboard | null {
  const session = getSession(ctx)

  if (!session) {
    return null
  }

  if (session.step === 'month') {
    return getMonthKeyboard()
  }

  if (session.step === 'birthYear' || session.step === 'notes') {
    return new InlineKeyboard().text('Пропустить', 'birthday:add:skip')
  }

  if (session.step === 'confirm') {
    return getConfirmKeyboard()
  }

  return null
}

export function canSkipAddBirthdayStep(ctx: Context): boolean {
  const session = getSession(ctx)

  return session?.step === 'birthYear' || session?.step === 'notes'
}

export function canPickAddBirthdayMonth(ctx: Context): boolean {
  const session = getSession(ctx)

  return session?.step === 'month'
}

export function canConfirmAddBirthday(ctx: Context): boolean {
  const session = getSession(ctx)

  return session?.step === 'confirm'
}

function moveToConfirm(ctx: Context, draft: AddBirthdayDraft): string {
  setSession(ctx, {
    step: 'confirm',
    draft,
  })

  return formatDraftSummary(draft)
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

    return [
      'Шаг 5 из 5: добавь заметку или нажми «Пропустить».',
      '',
      'Например: коллега с прошлой работы, любит звонки, поздравить утром.',
      '',
      formatDraftProgress({
        ...session.draft,
        birthYear: null,
      }),
    ].join('\n')
  }

  if (session.step === 'notes') {
    return moveToConfirm(ctx, {
      ...session.draft,
      notes: null,
    })
  }

  return 'Сейчас этот шаг нельзя пропустить.'
}

export function selectAddBirthdayMonth(ctx: Context, month: number): string {
  const session = getSession(ctx)

  if (!session || session.step !== 'month') {
    return 'Сейчас месяц выбрать нельзя.'
  }

  if (!validateMonth(month)) {
    return 'Месяц должен быть от 1 до 12.'
  }

  const updatedDraft = {
    ...session.draft,
    month,
  }

  setSession(ctx, {
    step: 'birthYear',
    draft: updatedDraft,
  })

  return [
    'Шаг 4 из 5: укажи год рождения или нажми «Пропустить».',
    '',
    formatDraftProgress(updatedDraft),
  ].join('\n')
}

async function finishAddBirthdayFlow(ctx: Context): Promise<{ text: string; birthdayId: string }> {
  const session = getSession(ctx)

  if (!session) {
    return {
      text: 'Сейчас wizard не активен.',
      birthdayId: '',
    }
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
      notes: draft.notes ?? null,
    },
  })

  clearSession(ctx)

  return {
    text: formatBirthdayCreatedMessage(birthday),
    birthdayId: birthday.id,
  }
}

export async function confirmAddBirthdayFlow(ctx: Context): Promise<{ text: string; birthdayId: string }> {
  const session = getSession(ctx)

  if (!session || session.step !== 'confirm') {
    return {
      text: 'Сейчас нечего сохранять.',
      birthdayId: '',
    }
  }

  return finishAddBirthdayFlow(ctx)
}

export async function handleAddBirthdayText(ctx: Context, text: string): Promise<{ text: string; completed: boolean }> {
  const session = getSession(ctx)

  if (!session) {
    return {
      text: 'Сейчас wizard не активен.',
      completed: false,
    }
  }

  if (session.step === 'fullName') {
    const fullName = text.trim()

    if (!fullName) {
      return {
        text: 'Не вижу имени. Напиши имя человека одним сообщением.',
        completed: false,
      }
    }

    const updatedDraft = {
      ...session.draft,
      fullName,
    }

    setSession(ctx, {
      step: 'day',
      draft: updatedDraft,
    })

    return {
      text: [
        'Шаг 2 из 5: в какой день день рождения?',
        'Отправь число от 1 до 31.',
        '',
        formatDraftProgress(updatedDraft),
      ].join('\n'),
      completed: false,
    }
  }

  if (session.step === 'day') {
    const day = parseInteger(text.trim())

    if (day === null || !validateDay(day)) {
      return {
        text: 'День должен быть числом от 1 до 31.',
        completed: false,
      }
    }

    const updatedDraft = {
      ...session.draft,
      day,
    }

    setSession(ctx, {
      step: 'month',
      draft: updatedDraft,
    })

    return {
      text: [
        'Шаг 3 из 5: выбери месяц кнопкой ниже.',
        'Если удобнее, можешь отправить номер месяца числом от 1 до 12.',
        '',
        formatDraftProgress(updatedDraft),
      ].join('\n'),
      completed: false,
    }
  }

  if (session.step === 'month') {
    const month = parseInteger(text.trim())

    if (month === null || !validateMonth(month)) {
      return {
        text: 'Выбери месяц кнопкой ниже или отправь число от 1 до 12.',
        completed: false,
      }
    }

    const updatedDraft = {
      ...session.draft,
      month,
    }

    setSession(ctx, {
      step: 'birthYear',
      draft: updatedDraft,
    })

    return {
      text: [
        'Шаг 4 из 5: укажи год рождения или нажми «Пропустить».',
        '',
        formatDraftProgress(updatedDraft),
      ].join('\n'),
      completed: false,
    }
  }

  if (session.step === 'birthYear') {
    if (isSkipValue(text)) {
      return {
        text: await skipAddBirthdayStep(ctx),
        completed: false,
      }
    }

    const birthYear = parseInteger(text.trim())

    if (birthYear === null || !validateBirthYear(birthYear)) {
      return {
        text: 'Год рождения должен быть числом от 1900 до 2100. Если не хочешь указывать год, нажми «Пропустить».',
        completed: false,
      }
    }

    const updatedDraft = {
      ...session.draft,
      birthYear,
    }

    setSession(ctx, {
      step: 'notes',
      draft: updatedDraft,
    })

    return {
      text: [
        'Шаг 5 из 5: добавь заметку или нажми «Пропустить».',
        'Например: коллега с прошлой работы, любит звонки, поздравить утром.',
        '',
        formatDraftProgress(updatedDraft),
      ].join('\n'),
      completed: false,
    }
  }

  if (session.step === 'confirm') {
    return {
      text: 'Проверь данные и нажми «Сохранить» или «Отмена».',
      completed: false,
    }
  }

  if (isSkipValue(text)) {
    const resultText = await skipAddBirthdayStep(ctx)

    return {
      text: resultText,
      completed: false,
    }
  }

  const notes = text.trim() || null

  return {
    text: moveToConfirm(ctx, {
      ...session.draft,
      notes,
    }),
    completed: false,
  }
}
