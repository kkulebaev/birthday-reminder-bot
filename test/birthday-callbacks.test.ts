import { describe, expect, it } from 'vitest'
import {
  formatDetailText,
  getDeleteConfirmationKeyboard,
  getDeleteConfirmationText,
  getDetailKeyboard,
} from '../src/birthday-callbacks.js'

const record = {
  id: 'b1',
  userId: 'u1',
  fullName: 'Иван Иванов',
  day: 7,
  month: 4,
  birthYear: 1990,
  notes: null,
  isReminderEnabled: true,
}

describe('birthday callbacks ui', () => {
  it('formats detail text in product style', () => {
    const result = formatDetailText(record)

    expect(result).toContain('🎂 Иван Иванов')
    expect(result).toContain('Дата: 07.04.1990')
    expect(result).toContain('Напоминания: включены')
    expect(result).toContain('Заметка: —')
  })

  it('builds detail keyboard with delete action', () => {
    const keyboard = getDetailKeyboard(record.id)
    const inlineKeyboard = keyboard.inline_keyboard

    expect(inlineKeyboard[0]?.map((button) => button.text)).toEqual(['🔔 Напоминания', '🗑 Удалить'])
  })

  it('builds delete confirmation keyboard', () => {
    const keyboard = getDeleteConfirmationKeyboard(record.id)
    const inlineKeyboard = keyboard.inline_keyboard

    expect(inlineKeyboard).toHaveLength(2)
    expect(inlineKeyboard[0]?.map((button) => button.text)).toEqual(['🗑 Да, удалить', '↩️ Назад'])
    expect(inlineKeyboard[0]?.[0]?.callback_data).toBe('birthday:confirm-delete:b1')
    expect(inlineKeyboard[0]?.[1]?.callback_data).toBe('birthday:view:b1')
  })

  it('formats delete confirmation text with date and impact', () => {
    const result = getDeleteConfirmationText(record)

    expect(result).toContain('Удалить запись «Иван Иванов»?')
    expect(result).toContain('Дата: 07.04.1990')
    expect(result).toContain('Запись исчезнет из списка')
  })
})
