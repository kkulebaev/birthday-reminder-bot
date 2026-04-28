import { InlineKeyboard } from 'grammy'
import type { Birthday } from './generated/prisma/client.js'
import { prisma } from './db.js'
import { getMainMenuKeyboard } from './main-menu.js'
import { schedulerService } from './scheduler-service.js'

export type BirthdayAction = 'view' | 'note' | 'toggle' | 'delete' | 'rename' | 'setdate'

export type BirthdayActionResolution =
  | { kind: 'single'; birthday: Birthday }
  | { kind: 'not-found'; text: string; replyMarkup: InlineKeyboard }
  | { kind: 'ambiguous'; text: string; replyMarkup: InlineKeyboard }

function formatDateLine(birthday: Birthday): string {
  const day = String(birthday.day).padStart(2, '0')
  const month = String(birthday.month).padStart(2, '0')
  const year = birthday.birthYear ? `.${birthday.birthYear}` : ''

  return `${day}.${month}${year}`
}

function formatReminderLine(birthday: Birthday): string {
  return birthday.isReminderEnabled ? 'включены' : 'выключены'
}

function formatBirthdayDetail(birthday: Birthday): string {
  const notes = birthday.notes ? birthday.notes : '—'

  return [
    `🎂 ${birthday.fullName}`,
    '',
    `Дата: ${formatDateLine(birthday)}`,
    `Напоминания: ${formatReminderLine(birthday)}`,
    `Заметка: ${notes}`,
  ].join('\n')
}

function getActionPrompt(action: BirthdayAction): string {
  if (action === 'note') {
    return 'Выбери запись, для которой нужно обновить заметку.'
  }

  if (action === 'toggle') {
    return 'Выбери запись, для которой нужно переключить напоминания.'
  }

  if (action === 'delete') {
    return 'Выбери запись, которую нужно удалить.'
  }

  if (action === 'rename') {
    return 'Выбери запись, для которой нужно изменить имя.'
  }

  if (action === 'setdate') {
    return 'Выбери запись, для которой нужно изменить дату.'
  }

  return 'Выбери нужную запись ниже.'
}

function createActionSelectionKeyboard(
  birthdays: Birthday[],
  action: BirthdayAction,
  query: string,
): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  for (const birthday of birthdays) {
    keyboard.text(
      `${birthday.fullName} — ${formatDateLine(birthday)}`,
      `birthday:select:${action}:${birthday.id}:${encodeURIComponent(query)}`,
    ).row()
  }

  keyboard.text('🏠 Главное меню', 'menu:home')

  return keyboard
}

function createNotFoundKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('➕ Добавить', 'menu:add')
    .text('🎈 Ближайшие', 'menu:upcoming')
    .row()
    .text('🏠 Главное меню', 'menu:home')
}

export async function findBirthdays(userId: string, query: string): Promise<Birthday[]> {
  return prisma.birthday.findMany({
    where: {
      userId,
      deletedAt: null,
      fullName: {
        contains: query,
        mode: 'insensitive',
      },
    },
    orderBy: {
      fullName: 'asc',
    },
    take: 10,
  })
}

export function resolveBirthdayAction(
  birthdays: Birthday[],
  query: string,
  action: BirthdayAction,
): BirthdayActionResolution {
  if (birthdays.length === 0) {
    return {
      kind: 'not-found',
      text: [
        `Ничего не нашёл по запросу: ${query}`,
        '',
        'Попробуй другой запрос или добавь новую запись.',
      ].join('\n'),
      replyMarkup: createNotFoundKeyboard(),
    }
  }

  if (birthdays.length > 1) {
    return {
      kind: 'ambiguous',
      text: [
        `Нашёл несколько записей по запросу: ${query}`,
        '',
        getActionPrompt(action),
      ].join('\n'),
      replyMarkup: createActionSelectionKeyboard(birthdays, action, query),
    }
  }

  const [birthday] = birthdays

  if (!birthday) {
    return {
      kind: 'not-found',
      text: [
        `Ничего не нашёл по запросу: ${query}`,
        '',
        'Попробуй другой запрос или добавь новую запись.',
      ].join('\n'),
      replyMarkup: createNotFoundKeyboard(),
    }
  }

  return {
    kind: 'single',
    birthday,
  }
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

export async function getBirthdayDetailResult(userId: string, query: string): Promise<{ text: string; replyMarkup?: InlineKeyboard }> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return {
      text: 'Напиши так: /view часть имени',
      replyMarkup: getMainMenuKeyboard(),
    }
  }

  const birthdays = await findBirthdays(userId, normalizedQuery)
  const result = resolveBirthdayAction(birthdays, normalizedQuery, 'view')

  if (result.kind !== 'single') {
    return {
      text: result.text,
      replyMarkup: result.replyMarkup,
    }
  }

  return {
    text: formatBirthdayDetail(result.birthday),
  }
}

export async function getBirthdayDetailMessage(userId: string, query: string): Promise<string> {
  const result = await getBirthdayDetailResult(userId, query)

  return result.text
}

export async function updateBirthdayNote(userId: string, query: string, note: string): Promise<{ text: string; replyMarkup?: InlineKeyboard }> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery || !note.trim()) {
    return {
      text: 'Напиши так: /note часть имени | новая заметка',
    }
  }

  const birthdays = await findBirthdays(userId, normalizedQuery)
  const result = resolveBirthdayAction(birthdays, normalizedQuery, 'note')

  if (result.kind !== 'single') {
    return {
      text: result.text,
      replyMarkup: result.replyMarkup,
    }
  }

  const birthday = await prisma.birthday.update({
    where: {
      id: result.birthday.id,
    },
    data: {
      notes: note.trim(),
    },
  })

  return {
    text: ['Готово, заметку обновил.', '', formatBirthdayDetail(birthday)].join('\n'),
  }
}

export async function toggleBirthdayReminder(userId: string, query: string): Promise<{ text: string; replyMarkup?: InlineKeyboard }> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return {
      text: 'Напиши так: /toggle часть имени',
    }
  }

  const birthdays = await findBirthdays(userId, normalizedQuery)
  const result = resolveBirthdayAction(birthdays, normalizedQuery, 'toggle')

  if (result.kind !== 'single') {
    return {
      text: result.text,
      replyMarkup: result.replyMarkup,
    }
  }

  const birthday = await prisma.birthday.update({
    where: {
      id: result.birthday.id,
    },
    data: {
      isReminderEnabled: !result.birthday.isReminderEnabled,
    },
  })

  await schedulerService.rebuildBirthdayNotification(birthday.id)

  return {
    text: ['Готово, статус напоминаний обновил.', '', formatBirthdayDetail(birthday)].join('\n'),
  }
}

export async function softDeleteBirthday(userId: string, query: string): Promise<{ text: string; replyMarkup?: InlineKeyboard }> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return {
      text: 'Напиши так: /delete часть имени',
    }
  }

  const birthdays = await findBirthdays(userId, normalizedQuery)
  const result = resolveBirthdayAction(birthdays, normalizedQuery, 'delete')

  if (result.kind !== 'single') {
    return {
      text: result.text,
      replyMarkup: result.replyMarkup,
    }
  }

  const birthday = await prisma.birthday.update({
    where: {
      id: result.birthday.id,
    },
    data: {
      deletedAt: new Date(),
    },
  })

  await schedulerService.rebuildBirthdayNotification(birthday.id)

  return {
    text: `Готово, удалил запись: ${birthday.fullName}`,
  }
}

export async function renameBirthday(userId: string, query: string, fullName: string): Promise<{ text: string; replyMarkup?: InlineKeyboard }> {
  const normalizedQuery = query.trim()
  const normalizedFullName = fullName.trim()

  if (!normalizedQuery || !normalizedFullName) {
    return {
      text: 'Напиши так: /rename часть имени | новое имя',
    }
  }

  const birthdays = await findBirthdays(userId, normalizedQuery)
  const result = resolveBirthdayAction(birthdays, normalizedQuery, 'rename')

  if (result.kind !== 'single') {
    return {
      text: result.text,
      replyMarkup: result.replyMarkup,
    }
  }

  const birthday = await prisma.birthday.update({
    where: {
      id: result.birthday.id,
    },
    data: {
      fullName: normalizedFullName,
    },
  })

  return {
    text: ['Готово, имя обновил.', '', formatBirthdayDetail(birthday)].join('\n'),
  }
}

export async function setBirthdayDate(userId: string, query: string, dateInput: string): Promise<{ text: string; replyMarkup?: InlineKeyboard }> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery || !dateInput.trim()) {
    return {
      text: 'Напиши так: /setdate часть имени | DD.MM или DD.MM.YYYY',
    }
  }

  const parsedDate = parseDateInput(dateInput)

  if (!parsedDate) {
    return {
      text: 'Дата должна быть в формате DD.MM или DD.MM.YYYY.',
    }
  }

  const birthdays = await findBirthdays(userId, normalizedQuery)
  const result = resolveBirthdayAction(birthdays, normalizedQuery, 'setdate')

  if (result.kind !== 'single') {
    return {
      text: result.text,
      replyMarkup: result.replyMarkup,
    }
  }

  const birthday = await prisma.birthday.update({
    where: {
      id: result.birthday.id,
    },
    data: {
      day: parsedDate.day,
      month: parsedDate.month,
      birthYear: parsedDate.birthYear,
    },
  })

  await schedulerService.rebuildBirthdayNotification(birthday.id)

  return {
    text: ['Готово, дату обновил.', '', formatBirthdayDetail(birthday)].join('\n'),
  }
}

export function getBirthdayActionSelectionMessage(action: BirthdayAction, query: string): string {
  return [
    `Нашёл несколько записей по запросу: ${query}`,
    '',
    getActionPrompt(action),
  ].join('\n')
}
