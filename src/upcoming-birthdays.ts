import { InlineKeyboard } from 'grammy'
import { prisma } from './db.js'

const UPCOMING_LIMIT = 5
export const DAY_IN_MS = 24 * 60 * 60 * 1000

export type UpcomingBirthday = {
  fullName: string
  day: number
  month: number
  nextOccurrence: Date
}

export function getStartOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function getNextOccurrence(day: number, month: number, fromDate: Date): Date {
  const currentYear = fromDate.getUTCFullYear()
  const candidateThisYear = new Date(Date.UTC(currentYear, month - 1, day))

  if (candidateThisYear.getTime() >= fromDate.getTime()) {
    return candidateThisYear
  }

  return new Date(Date.UTC(currentYear + 1, month - 1, day))
}

export function getDaysUntil(nextOccurrence: Date, fromDate: Date): number {
  return Math.round((nextOccurrence.getTime() - fromDate.getTime()) / DAY_IN_MS)
}

export function formatUpcomingDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')

  return `${day}.${month}`
}

export function formatUpcomingLine(index: number, birthday: UpcomingBirthday, fromDate: Date): string {
  const daysUntil = getDaysUntil(birthday.nextOccurrence, fromDate)
  const suffix = daysUntil === 0 ? 'сегодня' : `через ${daysUntil} дн.`

  return `${index}. ${formatUpcomingDate(birthday.nextOccurrence)} — ${birthday.fullName} (${suffix})`
}

export function sortUpcomingBirthdays(
  birthdays: Array<{ fullName: string; day: number; month: number }>,
  fromDate: Date,
): UpcomingBirthday[] {
  return birthdays
    .map((birthday) => ({
      fullName: birthday.fullName,
      day: birthday.day,
      month: birthday.month,
      nextOccurrence: getNextOccurrence(birthday.day, birthday.month, fromDate),
    }))
    .sort((left, right) => left.nextOccurrence.getTime() - right.nextOccurrence.getTime())
}

export function createEmptyUpcomingKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('➕ Добавить первую запись', 'menu:add')
    .row()
    .text('📋 Открыть список', 'menu:list')
    .text('🏠 Главное меню', 'menu:home')
}

export async function getUpcomingBirthdaysMessage(userId: string): Promise<{ text: string; replyMarkup: InlineKeyboard }> {
  const fromDate = getStartOfUtcDay(new Date())
  const birthdays = await prisma.birthday.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    select: {
      fullName: true,
      day: true,
      month: true,
    },
  })

  if (birthdays.length === 0) {
    return {
      text: [
        'Пока тут пусто.',
        '',
        'Добавь первый день рождения — и я покажу ближайшие важные даты.',
      ].join('\n'),
      replyMarkup: createEmptyUpcomingKeyboard(),
    }
  }

  const upcoming = sortUpcomingBirthdays(birthdays, fromDate).slice(0, UPCOMING_LIMIT)

  return {
    text: [
      'Ближайшие дни рождения:',
      '',
      ...upcoming.map((birthday, index) => formatUpcomingLine(index + 1, birthday, fromDate)),
    ].join('\n'),
    replyMarkup: new InlineKeyboard()
      .text('➕ Добавить', 'menu:add')
      .text('📋 Список', 'menu:list')
      .row()
      .text('🏠 Главное меню', 'menu:home'),
  }
}
