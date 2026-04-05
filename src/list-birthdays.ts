import { InlineKeyboard } from 'grammy'
import { prisma } from './db.js'
import { BIRTHDAY_PAGE_SIZE, formatBirthdayLine } from './birthday-format.js'

export function createBirthdayListKeyboard(idsAndNames: Array<{ id: string; fullName: string }>): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  for (const item of idsAndNames) {
    keyboard.text(item.fullName, `birthday:view:${item.id}`).row()
  }

  keyboard.text('➕ Добавить', 'menu:add').text('🏠 Главное меню', 'menu:home')

  return keyboard
}

export function createEmptyBirthdayListKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('➕ Добавить первую запись', 'menu:add')
    .row()
    .text('🎈 Ближайшие', 'menu:upcoming')
    .text('🏠 Главное меню', 'menu:home')
}

export function formatEmptyBirthdayListMessage(): string {
  return [
    'Пока тут пусто.',
    '',
    'Добавь первый день рождения — и я помогу не забыть важную дату 🎂',
  ].join('\n')
}

export function formatBirthdayListMessage(lines: string[]): string {
  return [
    'Твои дни рождения:',
    '',
    ...lines,
    '',
    'Нажми на имя ниже, чтобы открыть карточку.',
  ].join('\n')
}

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
      text: formatEmptyBirthdayListMessage(),
      replyMarkup: createEmptyBirthdayListKeyboard(),
    }
  }

  const lines = birthdays.map((birthday, index) => formatBirthdayLine(index + 1, birthday))

  return {
    text: formatBirthdayListMessage(lines),
    replyMarkup: createBirthdayListKeyboard(birthdays.map((birthday) => ({ id: birthday.id, fullName: birthday.fullName }))),
  }
}

export function getListBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('⬅️ К списку', 'birthday:list')
    .row()
    .text('🏠 Главное меню', 'menu:home')
}
