import type { Birthday } from '@prisma/client'
import { prisma } from './db.js'

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
    `Full Name: ${birthday.fullName}`,
    `Дата: ${formatDateLine(birthday)}`,
    `Напоминания: ${formatReminderLine(birthday)}`,
    `Заметка: ${notes}`,
  ].join('\n')
}

async function findBirthdays(userId: string, query: string): Promise<Birthday[]> {
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

function getSingleBirthdayOrMessage(
  birthdays: Birthday[],
  query: string,
  action: 'view' | 'note' | 'toggle' | 'delete' | 'rename' | 'setdate',
): { birthday: Birthday } | { message: string } {
  if (birthdays.length === 0) {
    return {
      message: `Ничего не нашёл по запросу: ${query}`,
    }
  }

  if (birthdays.length > 1) {
    if (action === 'view') {
      return {
        message: [
          `Нашёл несколько записей по запросу: ${query}`,
          '',
          ...birthdays.map((birthday, index) => `${index + 1}. ${birthday.fullName}`),
          '',
          'Уточни запрос для /view, /note, /toggle, /delete, /rename или /setdate.',
        ].join('\n'),
      }
    }

    return {
      message: `Нашлось несколько записей. Уточни запрос для /${action}.`,
    }
  }

  const [birthday] = birthdays

  if (!birthday) {
    return {
      message: `Ничего не нашёл по запросу: ${query}`,
    }
  }

  return { birthday }
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

export async function getBirthdayDetailMessage(userId: string, query: string): Promise<string> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return 'Напиши так: /view часть имени'
  }

  const birthdays = await findBirthdays(userId, normalizedQuery)
  const result = getSingleBirthdayOrMessage(birthdays, normalizedQuery, 'view')

  if ('message' in result) {
    return result.message
  }

  return formatBirthdayDetail(result.birthday)
}

export async function updateBirthdayNote(userId: string, query: string, note: string): Promise<string> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery || !note.trim()) {
    return 'Напиши так: /note часть имени | новая заметка'
  }

  const birthdays = await findBirthdays(userId, normalizedQuery)
  const result = getSingleBirthdayOrMessage(birthdays, normalizedQuery, 'note')

  if ('message' in result) {
    return result.message
  }

  const birthday = await prisma.birthday.update({
    where: {
      id: result.birthday.id,
    },
    data: {
      notes: note.trim(),
    },
  })

  return [
    'Заметку обновил.',
    '',
    formatBirthdayDetail(birthday),
  ].join('\n')
}

export async function toggleBirthdayReminder(userId: string, query: string): Promise<string> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return 'Напиши так: /toggle часть имени'
  }

  const birthdays = await findBirthdays(userId, normalizedQuery)
  const result = getSingleBirthdayOrMessage(birthdays, normalizedQuery, 'toggle')

  if ('message' in result) {
    return result.message
  }

  const birthday = await prisma.birthday.update({
    where: {
      id: result.birthday.id,
    },
    data: {
      isReminderEnabled: !result.birthday.isReminderEnabled,
    },
  })

  return [
    'Статус напоминаний обновил.',
    '',
    formatBirthdayDetail(birthday),
  ].join('\n')
}

export async function softDeleteBirthday(userId: string, query: string): Promise<string> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return 'Напиши так: /delete часть имени'
  }

  const birthdays = await findBirthdays(userId, normalizedQuery)
  const result = getSingleBirthdayOrMessage(birthdays, normalizedQuery, 'delete')

  if ('message' in result) {
    return result.message
  }

  const birthday = await prisma.birthday.update({
    where: {
      id: result.birthday.id,
    },
    data: {
      deletedAt: new Date(),
    },
  })

  return `Удалил запись: ${birthday.fullName}`
}

export async function renameBirthday(userId: string, query: string, fullName: string): Promise<string> {
  const normalizedQuery = query.trim()
  const normalizedFullName = fullName.trim()

  if (!normalizedQuery || !normalizedFullName) {
    return 'Напиши так: /rename часть имени | новое имя'
  }

  const birthdays = await findBirthdays(userId, normalizedQuery)
  const result = getSingleBirthdayOrMessage(birthdays, normalizedQuery, 'rename')

  if ('message' in result) {
    return result.message
  }

  const birthday = await prisma.birthday.update({
    where: {
      id: result.birthday.id,
    },
    data: {
      fullName: normalizedFullName,
    },
  })

  return [
    'Имя обновил.',
    '',
    formatBirthdayDetail(birthday),
  ].join('\n')
}

export async function setBirthdayDate(userId: string, query: string, dateInput: string): Promise<string> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery || !dateInput.trim()) {
    return 'Напиши так: /setdate часть имени | DD.MM или DD.MM.YYYY'
  }

  const parsedDate = parseDateInput(dateInput)

  if (!parsedDate) {
    return 'Дата должна быть в формате DD.MM или DD.MM.YYYY'
  }

  const birthdays = await findBirthdays(userId, normalizedQuery)
  const result = getSingleBirthdayOrMessage(birthdays, normalizedQuery, 'setdate')

  if ('message' in result) {
    return result.message
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

  return [
    'Дату обновил.',
    '',
    formatBirthdayDetail(birthday),
  ].join('\n')
}
