import { describe, expect, it } from 'vitest'
import {
  createBirthdayListKeyboard,
  createEmptyBirthdayListKeyboard,
  formatBirthdayListMessage,
  formatEmptyBirthdayListMessage,
  getListBackKeyboard,
} from '../src/list-birthdays.js'

describe('list birthdays helpers', () => {
  it('formats empty list message', () => {
    const result = formatEmptyBirthdayListMessage()

    expect(result).toContain('Пока тут пусто.')
    expect(result).toContain('Добавь первый день рождения')
  })

  it('formats populated list message', () => {
    const result = formatBirthdayListMessage([
      '1. Иван Иванов — 07.04 🔔',
      '2. Мария Петрова — 11.12 🔕',
    ])

    expect(result).toContain('Твои дни рождения:')
    expect(result).toContain('1. Иван Иванов — 07.04 🔔')
    expect(result).toContain('Нажми на имя ниже, чтобы открыть карточку.')
  })

  it('builds keyboard for birthday list and action buttons', () => {
    const keyboard = createBirthdayListKeyboard([
      { id: 'b1', fullName: 'Иван Иванов' },
      { id: 'b2', fullName: 'Мария Петрова' },
    ])

    expect(keyboard.inline_keyboard[0]?.[0]?.text).toBe('Иван Иванов')
    expect(keyboard.inline_keyboard[1]?.[0]?.text).toBe('Мария Петрова')
    expect(keyboard.inline_keyboard[2]?.[0]?.text).toBe('➕ Добавить')
    expect(keyboard.inline_keyboard[2]?.[1]?.text).toBe('🏠 Главное меню')
  })

  it('builds empty list keyboard with strong next actions', () => {
    const keyboard = createEmptyBirthdayListKeyboard()

    expect(keyboard.inline_keyboard[0]?.[0]?.text).toBe('➕ Добавить первую запись')
    expect(keyboard.inline_keyboard[1]?.map((button) => button.text)).toEqual(['🎈 Ближайшие', '🏠 Главное меню'])
  })

  it('builds list back keyboard', () => {
    const keyboard = getListBackKeyboard()

    expect(keyboard.inline_keyboard[0]?.[0]?.text).toBe('⬅️ К списку')
    expect(keyboard.inline_keyboard[1]?.[0]?.text).toBe('🏠 Главное меню')
  })
})
