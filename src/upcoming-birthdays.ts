import { prisma } from './db.js'

const UPCOMING_LIMIT = 5
const DAY_IN_MS = 24 * 60 * 60 * 1000

type UpcomingBirthday = {
  fullName: string
  day: number
  month: number
  nextOccurrence: Date
}

function getStartOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function getNextOccurrence(day: number, month: number, fromDate: Date): Date {
  const currentYear = fromDate.getUTCFullYear()
  const candidateThisYear = new Date(Date.UTC(currentYear, month - 1, day))

  if (candidateThisYear.getTime() >= fromDate.getTime()) {
    return candidateThisYear
  }

  return new Date(Date.UTC(currentYear + 1, month - 1, day))
}

function getDaysUntil(nextOccurrence: Date, fromDate: Date): number {
  return Math.round((nextOccurrence.getTime() - fromDate.getTime()) / DAY_IN_MS)
}

function formatDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')

  return `${day}.${month}`
}

function formatUpcomingLine(index: number, birthday: UpcomingBirthday, fromDate: Date): string {
  const daysUntil = getDaysUntil(birthday.nextOccurrence, fromDate)
  const suffix = daysUntil === 0 ? 'сегодня' : `через ${daysUntil} дн.`

  return `${index}. ${formatDate(birthday.nextOccurrence)} — ${birthday.fullName} (${suffix})`
}

export async function getUpcomingBirthdaysMessage(userId: string): Promise<string> {
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
    return [
      'Пока тут пусто.',
      '',
      'Добавь первую запись командой /add 🎂',
    ].join('\n')
  }

  const upcoming = birthdays
    .map((birthday) => ({
      fullName: birthday.fullName,
      day: birthday.day,
      month: birthday.month,
      nextOccurrence: getNextOccurrence(birthday.day, birthday.month, fromDate),
    }))
    .sort((left, right) => left.nextOccurrence.getTime() - right.nextOccurrence.getTime())
    .slice(0, UPCOMING_LIMIT)

  return [
    'Ближайшие дни рождения:',
    '',
    ...upcoming.map((birthday, index) => formatUpcomingLine(index + 1, birthday, fromDate)),
  ].join('\n')
}
