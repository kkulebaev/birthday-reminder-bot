import { describe, expect, it } from 'vitest'
import { createBirthdaySearchKeyboard, formatBirthdaySearchMessage } from '../src/search-birthdays.js'

describe('search birthdays helpers', () => {
  it('formats search result message', () => {
    const result = formatBirthdaySearchMessage('иван', [
      '1. Иван Иванов — 07.04 🔔',
    ])

    expect(result).toContain('Результаты поиска: иван')
    expect(result).toContain('1. Иван Иванов — 07.04 🔔')
    expect(result).toContain('Нажми на имя ниже, чтобы открыть карточку.')
  })

  it('builds search keyboard with home button', () => {
    const keyboard = createBirthdaySearchKeyboard([
      { id: 'b1', fullName: 'Иван Иванов' },
      { id: 'b2', fullName: 'Мария Петрова' },
    ])

    expect(keyboard.inline_keyboard[0]?.[0]?.text).toBe('Иван Иванов')
    expect(keyboard.inline_keyboard[1]?.[0]?.text).toBe('Мария Петрова')
    expect(keyboard.inline_keyboard[2]?.[0]?.text).toBe('🏠 Главное меню')
  })
})
