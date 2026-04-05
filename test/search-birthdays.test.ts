import { describe, expect, it } from 'vitest'
import { createBirthdaySearchKeyboard, formatBirthdaySearchMessage } from '../src/search-birthdays.js'

describe('search birthdays helpers', () => {
  it('formats search result message', () => {
    const result = formatBirthdaySearchMessage('иван', [
      '1. Иван Иванов — 07.04 🔔',
    ])

    expect(result).toContain('Результаты поиска: иван')
    expect(result).toContain('1. Иван Иванов — 07.04 🔔')
    expect(result).toContain('Нашёл несколько вариантов — нажми на нужное имя ниже.')
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
})
