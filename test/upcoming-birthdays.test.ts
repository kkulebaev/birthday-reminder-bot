import { describe, expect, it } from 'vitest'
import {
  createEmptyUpcomingKeyboard,
  createUpcomingKeyboard,
  formatUpcomingDate,
  formatUpcomingLine,
  getDaysUntil,
  getNextOccurrence,
  getStartOfUtcDay,
  getUpcomingPageItems,
  getUpcomingTotalPages,
  normalizeUpcomingPageIndex,
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

  it('calculates total pages with a minimum of one page', () => {
    expect(getUpcomingTotalPages(0)).toBe(1)
    expect(getUpcomingTotalPages(5)).toBe(1)
    expect(getUpcomingTotalPages(6)).toBe(2)
  })

  it('normalizes invalid page index values', () => {
    expect(normalizeUpcomingPageIndex(-1, 12)).toBe(0)
    expect(normalizeUpcomingPageIndex(Number.NaN, 12)).toBe(0)
    expect(normalizeUpcomingPageIndex(99, 12)).toBe(2)
  })

  it('returns only birthdays for the requested page', () => {
    const pageItems = getUpcomingPageItems(
      [
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
          day: 5,
          month: 4,
          nextOccurrence: new Date('2026-04-05T00:00:00.000Z'),
        },
        {
          id: 'b3',
          fullName: 'Анна Смирнова',
          day: 6,
          month: 4,
          nextOccurrence: new Date('2026-04-06T00:00:00.000Z'),
        },
      ],
      1,
      2,
    )

    expect(pageItems.map((item) => item.id)).toEqual(['b3'])
  })

  it('builds upcoming keyboard with pagination and home button', () => {
    const keyboard = createUpcomingKeyboard(
      [
        {
          id: 'b6',
          fullName: 'Иван Иванов',
          day: 4,
          month: 4,
          nextOccurrence: new Date('2026-04-04T00:00:00.000Z'),
        },
        {
          id: 'b7',
          fullName: 'Мария Петрова',
          day: 10,
          month: 4,
          nextOccurrence: new Date('2026-04-10T00:00:00.000Z'),
        },
      ],
      1,
      12,
      5,
    )

    expect(keyboard.inline_keyboard[0]?.[0]?.text).toBe('Иван Иванов — 04.04')
    expect(keyboard.inline_keyboard[0]?.[0]?.callback_data).toBe('birthday:view:b6')
    expect(keyboard.inline_keyboard[1]?.[0]?.text).toBe('Мария Петрова — 10.04')
    expect(keyboard.inline_keyboard[2]?.map((button) => button.text)).toEqual(['◀️', '2/3', '▶️'])
    expect(keyboard.inline_keyboard[2]?.[0]?.callback_data).toBe('birthday:upcoming-page:0')
    expect(keyboard.inline_keyboard[2]?.[1]?.callback_data).toBe('birthday:upcoming-page:1')
    expect(keyboard.inline_keyboard[2]?.[2]?.callback_data).toBe('birthday:upcoming-page:2')
    expect(keyboard.inline_keyboard[3]?.map((button) => button.text)).toEqual(['↩️ Главное меню'])
  })

  it('hides pagination controls when there is only one page', () => {
    const keyboard = createUpcomingKeyboard(
      [
        {
          id: 'b1',
          fullName: 'Иван Иванов',
          day: 4,
          month: 4,
          nextOccurrence: new Date('2026-04-04T00:00:00.000Z'),
        },
      ],
      0,
      1,
    )

    expect(keyboard.inline_keyboard[1]?.map((button) => button.text)).toEqual(['↩️ Главное меню'])
  })
})
