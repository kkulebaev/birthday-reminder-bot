import { InlineKeyboard } from 'grammy'
import { prisma } from './db.js'

export const UPCOMING_PAGE_SIZE = 5
export const DAY_IN_MS = 24 * 60 * 60 * 1000

export type UpcomingBirthday = {
  id: string
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
  birthdays: Array<{ id: string; fullName: string; day: number; month: number }>,
  fromDate: Date,
): UpcomingBirthday[] {
  return birthdays
    .map((birthday) => ({
      id: birthday.id,
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
    .text('🏠 Главное меню', 'menu:home')
}

export function getUpcomingTotalPages(totalItems: number, pageSize: number = UPCOMING_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(totalItems / pageSize))
}

export function normalizeUpcomingPageIndex(pageIndex: number, totalItems: number, pageSize: number = UPCOMING_PAGE_SIZE): number {
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    return 0
  }

  const lastPageIndex = getUpcomingTotalPages(totalItems, pageSize) - 1

  return Math.min(pageIndex, lastPageIndex)
}

export function getUpcomingPageItems(
  upcoming: UpcomingBirthday[],
  pageIndex: number,
  pageSize: number = UPCOMING_PAGE_SIZE,
): UpcomingBirthday[] {
  const normalizedPageIndex = normalizeUpcomingPageIndex(pageIndex, upcoming.length, pageSize)
  const startIndex = normalizedPageIndex * pageSize

  return upcoming.slice(startIndex, startIndex + pageSize)
}

export function createUpcomingKeyboard(
  upcoming: UpcomingBirthday[],
  pageIndex: number,
  totalItems: number,
  pageSize: number = UPCOMING_PAGE_SIZE,
): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  for (const [index, birthday] of upcoming.entries()) {
    keyboard.text(`${birthday.fullName} — ${formatUpcomingDate(birthday.nextOccurrence)}`, `birthday:view:${birthday.id}`)

    if (index < upcoming.length - 1) {
      keyboard.row()
    }
  }

  const totalPages = getUpcomingTotalPages(totalItems, pageSize)
  const normalizedPageIndex = normalizeUpcomingPageIndex(pageIndex, totalItems, pageSize)

  if (totalPages > 1) {
    keyboard.row()

    if (normalizedPageIndex > 0) {
      keyboard.text('◀️', `birthday:upcoming-page:${normalizedPageIndex - 1}`)
    }

    keyboard.text(`${normalizedPageIndex + 1}/${totalPages}`, `birthday:upcoming-page:${normalizedPageIndex}`)

    if (normalizedPageIndex < totalPages - 1) {
      keyboard.text('▶️', `birthday:upcoming-page:${normalizedPageIndex + 1}`)
    }
  }

  keyboard.row().text('↩️ Главное меню', 'menu:home')

  return keyboard
}

export async function getUpcomingBirthdaysMessage(
  userId: string,
  pageIndex: number = 0,
): Promise<{ text: string; replyMarkup: InlineKeyboard }> {
  const fromDate = getStartOfUtcDay(new Date())
  const birthdays = await prisma.birthday.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    select: {
      id: true,
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

  const sortedUpcoming = sortUpcomingBirthdays(birthdays, fromDate)
  const normalizedPageIndex = normalizeUpcomingPageIndex(pageIndex, sortedUpcoming.length)
  const upcoming = getUpcomingPageItems(sortedUpcoming, normalizedPageIndex)
  const startIndex = normalizedPageIndex * UPCOMING_PAGE_SIZE

  return {
    text: [
      '🎈 Ближайшие дни рождения',
      '',
      ...upcoming.map((birthday, index) => formatUpcomingLine(startIndex + index + 1, birthday, fromDate)),
      '',
      'Нажми на человека ниже, чтобы открыть карточку.',
    ].join('\n'),
    replyMarkup: createUpcomingKeyboard(upcoming, normalizedPageIndex, sortedUpcoming.length),
  }
}
