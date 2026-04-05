import { describe, expect, it } from 'vitest'
import {
  getAddBirthdaySuccessKeyboard,
  isSkipValue,
  monthLabels,
  parseInteger,
  validateBirthYear,
  validateDay,
  validateMonth,
} from '../src/add-birthday.js'

describe('add birthday helpers', () => {
  it('parses integer values', () => {
    expect(parseInteger('12')).toBe(12)
    expect(parseInteger('001')).toBe(1)
  })

  it('returns null for non-integer values', () => {
    expect(parseInteger('')).toBeNull()
    expect(parseInteger('12a')).toBeNull()
    expect(parseInteger('3.14')).toBeNull()
  })

  it('validates day boundaries', () => {
    expect(validateDay(1)).toBe(true)
    expect(validateDay(31)).toBe(true)
    expect(validateDay(0)).toBe(false)
    expect(validateDay(32)).toBe(false)
  })

  it('validates month boundaries', () => {
    expect(validateMonth(1)).toBe(true)
    expect(validateMonth(12)).toBe(true)
    expect(validateMonth(0)).toBe(false)
    expect(validateMonth(13)).toBe(false)
  })

  it('validates birth year boundaries', () => {
    expect(validateBirthYear(1900)).toBe(true)
    expect(validateBirthYear(2100)).toBe(true)
    expect(validateBirthYear(1899)).toBe(false)
    expect(validateBirthYear(2101)).toBe(false)
  })

  it('recognizes friendly skip values', () => {
    expect(isSkipValue('skip')).toBe(true)
    expect(isSkipValue('Пропустить')).toBe(true)
    expect(isSkipValue('без года')).toBe(true)
    expect(isSkipValue('без заметки')).toBe(true)
    expect(isSkipValue('нет')).toBe(true)
    expect(isSkipValue('оставить')).toBe(false)
  })

  it('exposes 12 month labels', () => {
    expect(monthLabels).toHaveLength(12)
    expect(monthLabels[0]).toBe('Янв')
    expect(monthLabels[11]).toBe('Дек')
  })

  it('builds success keyboard with next actions', () => {
    const keyboard = getAddBirthdaySuccessKeyboard('b1')

    expect(keyboard.inline_keyboard[0]?.map((button) => button.text)).toEqual(['➕ Добавить ещё', '🎂 Открыть карточку'])
    expect(keyboard.inline_keyboard[1]?.map((button) => button.text)).toEqual(['📋 Открыть список', '🏠 Главное меню'])
    expect(keyboard.inline_keyboard[0]?.[1]?.callback_data).toBe('birthday:view:b1')
  })
})
