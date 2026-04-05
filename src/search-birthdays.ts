import { InlineKeyboard } from 'grammy'
import { prisma } from './db.js'
import { BIRTHDAY_PAGE_SIZE, formatBirthdayLine } from './birthday-format.js'
import { getMainMenuKeyboard } from './main-menu.js'

export function createBirthdaySearchKeyboard(idsAndNames: Array<{ id: string; fullName: string }>): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  for (const item of idsAndNames) {
    keyboard.text(item.fullName, `birthday:view:${item.id}`).row()
  }

  keyboard.text('➕ Добавить', 'menu:add').text('🏠 Главное меню', 'menu:home')

  return keyboard
}

export function createEmptySearchKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('➕ Добавить', 'menu:add')
    .text('🏠 Главное меню', 'menu:home')
}

export function formatBirthdaySearchMessage(query: string, lines: string[]): string {
  return [
    `Результаты поиска: ${query}`,
    '',
    ...lines,
    '',
    'Нашёл несколько вариантов — нажми на нужное имя ниже.',
  ].join('\n')
}

export function formatEmptyBirthdaySearchMessage(query: string): string {
  return [
    `Ничего не нашёл по запросу: ${query}`,
    '',
    'Попробуй другой запрос или добавь новую запись.',
  ].join('\n')
}

export type BirthdaySearchResult =
  | { kind: 'empty'; text: string; replyMarkup: InlineKeyboard }
  | { kind: 'single'; birthdayId: string }
  | { kind: 'multiple'; text: string; replyMarkup: InlineKeyboard }

export async function getBirthdaySearchResult(userId: string, query: string): Promise<BirthdaySearchResult> {
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return {
      kind: 'empty',
      text: 'Напиши так: /search часть имени',
      replyMarkup: getMainMenuKeyboard(),
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
      kind: 'empty',
      text: formatEmptyBirthdaySearchMessage(normalizedQuery),
      replyMarkup: createEmptySearchKeyboard(),
    }
  }

  if (birthdays.length === 1) {
    const [birthday] = birthdays

    if (!birthday) {
      return {
        kind: 'empty',
        text: formatEmptyBirthdaySearchMessage(normalizedQuery),
        replyMarkup: createEmptySearchKeyboard(),
      }
    }

    return {
      kind: 'single',
      birthdayId: birthday.id,
    }
  }

  const lines = birthdays.map((birthday, index) => formatBirthdayLine(index + 1, birthday))

  return {
    kind: 'multiple',
    text: formatBirthdaySearchMessage(normalizedQuery, lines),
    replyMarkup: createBirthdaySearchKeyboard(birthdays.map((birthday) => ({ id: birthday.id, fullName: birthday.fullName }))),
  }
}
