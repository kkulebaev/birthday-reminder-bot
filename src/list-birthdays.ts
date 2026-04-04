import { InlineKeyboard } from 'grammy'
import { prisma } from './db.js'
import { BIRTHDAY_PAGE_SIZE, formatBirthdayLine } from './birthday-format.js'

export async function getBirthdayListMessage(userId: string): Promise<{ text: string; replyMarkup?: InlineKeyboard }> {
  const birthdays = await prisma.birthday.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    orderBy: {
      fullName: 'asc',
    },
    take: BIRTHDAY_PAGE_SIZE,
  })

  if (birthdays.length === 0) {
    return {
      text: [
        'Список пока пуст.',
        '',
        'Добавь первую запись командой /add.',
      ].join('\n'),
    }
  }

  const lines = birthdays.map((birthday, index) => formatBirthdayLine(index + 1, birthday))
  const keyboard = new InlineKeyboard()

  for (const birthday of birthdays) {
    keyboard.text(birthday.fullName, `birthday:view:${birthday.id}`).row()
  }

  return {
    text: [
      'Твои дни рождения:',
      '',
      ...lines,
      '',
      'Нажми на имя ниже, чтобы открыть карточку.',
    ].join('\n'),
    replyMarkup: keyboard,
  }
}
