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
  action: 'view' | 'note' | 'toggle',
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
          'Уточни запрос для /view, /note или /toggle.',
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
