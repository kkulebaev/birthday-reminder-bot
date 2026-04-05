import { describe, expect, it } from 'vitest'
import {
  createBirthdaySearchKeyboard,
  createEmptySearchKeyboard,
  formatBirthdaySearchMessage,
  formatEmptyBirthdaySearchMessage,
} from '../src/search-birthdays.js'

describe('search birthdays helpers', () => {
  it('formats search result message', () => {
    const result = formatBirthdaySearchMessage('иван', [
      '1. Иван Иванов — 07.04 🔔',
    ])

    expect(result).toContain('Результаты поиска: иван')
    expect(result).toContain('1. Иван Иванов — 07.04 🔔')
    expect(result).toContain('Нашёл несколько вариантов — нажми на нужное имя ниже.')
  })

  it('formats empty search message with stronger CTA', () => {
    const result = formatEmptyBirthdaySearchMessage('иван')

    expect(result).toContain('Ничего не нашёл по запросу: иван')
    expect(result).toContain('добавь новую запись')
  })

  it('builds search keyboard with add and home buttons', () => {
    const keyboard = createBirthdaySearchKeyboard([
      { id: 'b1', fullName: 'Иван Иванов' },
      { id: 'b2', fullName: 'Мария Петрова' },
    ])

    expect(keyboard.inline_keyboard[0]?.[0]?.text).toBe('Иван Иванов')
    expect(keyboard.inline_keyboard[1]?.[0]?.text).toBe('Мария Петрова')
    expect(keyboard.inline_keyboard[2]?.[0]?.text).toBe('➕ Добавить')
    expect(keyboard.inline_keyboard[2]?.[1]?.text).toBe('🏠 Главное меню')
  })

  it('builds empty search keyboard with query-based add CTA', () => {
    const keyboard = createEmptySearchKeyboard('Иван')

    expect(keyboard.inline_keyboard[0]?.[0]?.text).toBe('➕ Добавить «Иван»')
    expect(keyboard.inline_keyboard[1]?.map((button) => button.text)).toEqual(['📋 Открыть список', '🏠 Главное меню'])
  })
})
