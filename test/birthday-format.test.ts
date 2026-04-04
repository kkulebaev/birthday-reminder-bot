import { describe, expect, it } from 'vitest'
import { formatBirthdayLine } from '../src/birthday-format.js'

describe('formatBirthdayLine', () => {
  it('formats birthday line with year and enabled reminder', () => {
    const result = formatBirthdayLine(1, {
      id: 'b1',
      userId: 'u1',
      fullName: 'Иван Иванов',
      day: 7,
      month: 4,
      birthYear: 1990,
      notes: null,
      isReminderEnabled: true,
      deletedAt: null,
      createdAt: new Date('2026-04-04T00:00:00.000Z'),
      updatedAt: new Date('2026-04-04T00:00:00.000Z'),
    })

    expect(result).toBe('1. Иван Иванов — 07.04.1990 🔔')
  })

  it('formats birthday line without year and disabled reminder', () => {
    const result = formatBirthdayLine(2, {
      id: 'b2',
      userId: 'u1',
      fullName: 'Мария Петрова',
      day: 11,
      month: 12,
      birthYear: null,
      notes: null,
      isReminderEnabled: false,
      deletedAt: null,
      createdAt: new Date('2026-04-04T00:00:00.000Z'),
      updatedAt: new Date('2026-04-04T00:00:00.000Z'),
    })

    expect(result).toBe('2. Мария Петрова — 11.12 🔕')
  })
})
