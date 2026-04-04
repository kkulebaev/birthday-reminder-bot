import { InlineKeyboard } from 'grammy'
import { prisma } from './db.js'
import { BIRTHDAY_PAGE_SIZE, formatBirthdayLine } from './birthday-format.js'

export async function getBirthdaySearchMessage(userId: string, query: string): Promise<{ text: string; replyMarkup?: InlineKeyboard }> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return {
      text: 'Напиши так: /search часть имени',
    }
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
    return {
      text: `Ничего не нашёл по запросу: ${normalizedQuery}`,
    }
  }

  const lines = birthdays.map((birthday, index) => formatBirthdayLine(index + 1, birthday))
  const keyboard = new InlineKeyboard()

  for (const birthday of birthdays) {
    keyboard.text(birthday.fullName, `birthday:view:${birthday.id}`).row()
  }

  return {
    text: [
      `Результаты поиска: ${normalizedQuery}`,
      '',
      ...lines,
      '',
      'Нажми на имя ниже, чтобы открыть карточку.',
    ].join('\n'),
    replyMarkup: keyboard,
  }
}
