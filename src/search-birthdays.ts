import { prisma } from './db.js'
import { BIRTHDAY_PAGE_SIZE, formatBirthdayLine } from './birthday-format.js'

export async function getBirthdaySearchMessage(userId: string, query: string): Promise<string> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return 'Напиши так: /search часть имени'
  }

  const birthdays = await prisma.birthday.findMany({
    where: {
      userId,
      deletedAt: null,
      fullName: {
        contains: normalizedQuery,
        mode: 'insensitive',
      },
    },
    orderBy: {
      fullName: 'asc',
    },
    take: BIRTHDAY_PAGE_SIZE,
  })

  if (birthdays.length === 0) {
    return `Ничего не нашёл по запросу: ${normalizedQuery}`
  }

  const lines = birthdays.map((birthday, index) => formatBirthdayLine(index + 1, birthday))

  return [
    `Результаты поиска: ${normalizedQuery}`,
    '',
    ...lines,
  ].join('\n')
}
