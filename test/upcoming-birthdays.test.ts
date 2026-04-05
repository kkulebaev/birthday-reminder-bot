import { describe, expect, it } from 'vitest'
import {
  createEmptyUpcomingKeyboard,
  createUpcomingKeyboard,
  formatUpcomingDate,
  formatUpcomingLine,
  getDaysUntil,
  getNextOccurrence,
  getStartOfUtcDay,
  sortUpcomingBirthdays,
} from '../src/upcoming-birthdays.js'

describe('upcoming birthdays logic', () => {
  it('normalizes date to start of UTC day', () => {
    const result = getStartOfUtcDay(new Date('2026-04-04T18:36:00.000Z'))

    expect(result.toISOString()).toBe('2026-04-04T00:00:00.000Z')
  })

  it('returns current year occurrence when birthday is today', () => {
    const fromDate = new Date('2026-04-04T00:00:00.000Z')
    const result = getNextOccurrence(4, 4, fromDate)

    expect(result.toISOString()).toBe('2026-04-04T00:00:00.000Z')
  })

  it('rolls to next year when birthday already passed', () => {
    const fromDate = new Date('2026-04-04T00:00:00.000Z')
    const result = getNextOccurrence(1, 4, fromDate)

    expect(result.toISOString()).toBe('2027-04-01T00:00:00.000Z')
  })

  it('calculates days until next occurrence', () => {
    const fromDate = new Date('2026-04-04T00:00:00.000Z')
    const nextOccurrence = new Date('2026-04-10T00:00:00.000Z')

    expect(getDaysUntil(nextOccurrence, fromDate)).toBe(6)
  })

  it('formats upcoming date as dd.mm', () => {
    const result = formatUpcomingDate(new Date('2026-12-07T00:00:00.000Z'))

    expect(result).toBe('07.12')
  })

  it('formats upcoming line for today', () => {
    const fromDate = new Date('2026-04-04T00:00:00.000Z')
    const result = formatUpcomingLine(
      1,
      {
        id: 'b1',
        fullName: 'Иван Иванов',
        day: 4,
        month: 4,
        nextOccurrence: new Date('2026-04-04T00:00:00.000Z'),
      },
      fromDate,
    )

    expect(result).toBe('1. 04.04 — Иван Иванов (сегодня)')
  })

  it('sorts birthdays by nearest next occurrence', () => {
    const fromDate = new Date('2026-04-04T00:00:00.000Z')
    const result = sortUpcomingBirthdays(
      [
        { id: 'b3', fullName: 'Позже', day: 20, month: 4 },
        { id: 'b1', fullName: 'Сегодня', day: 4, month: 4 },
        { id: 'b2', fullName: 'Уже прошло', day: 1, month: 4 },
      ],
      fromDate,
    )

    expect(result.map((item) => item.fullName)).toEqual(['Сегодня', 'Позже', 'Уже прошло'])
  })

  it('builds empty upcoming keyboard with next actions', () => {
    const keyboard = createEmptyUpcomingKeyboard()

    expect(keyboard.inline_keyboard[0]?.[0]?.text).toBe('➕ Добавить первую запись')
    expect(keyboard.inline_keyboard[1]?.map((button) => button.text)).toEqual(['🏠 Главное меню'])
  })

  it('builds upcoming keyboard with direct links to birthday cards', () => {
    const keyboard = createUpcomingKeyboard([
      {
        id: 'b1',
        fullName: 'Иван Иванов',
        day: 4,
        month: 4,
        nextOccurrence: new Date('2026-04-04T00:00:00.000Z'),
      },
      {
        id: 'b2',
        fullName: 'Мария Петрова',
        day: 10,
        month: 4,
        nextOccurrence: new Date('2026-04-10T00:00:00.000Z'),
      },
    ])

    expect(keyboard.inline_keyboard[0]?.[0]?.text).toBe('Иван Иванов — 04.04')
    expect(keyboard.inline_keyboard[0]?.[0]?.callback_data).toBe('birthday:view:b1')
    expect(keyboard.inline_keyboard[1]?.[0]?.text).toBe('Мария Петрова — 10.04')
    expect(keyboard.inline_keyboard[2]?.map((button) => button.text)).toEqual(['➕ Добавить', '⚙️ Настройки'])
    expect(keyboard.inline_keyboard[3]?.map((button) => button.text)).toEqual(['🏠 Главное меню'])
  })
})
