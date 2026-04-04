import { describe, expect, it } from 'vitest'
import { formatBirthdayNotification } from '../src/notification-format.js'

describe('formatBirthdayNotification', () => {
  it('formats notification without notes', () => {
    const result = formatBirthdayNotification({
      id: 'b1',
      userId: 'u1',
      fullName: 'Иван Иванов',
      day: 10,
      month: 4,
      birthYear: null,
      notes: null,
      isReminderEnabled: true,
      deletedAt: null,
      createdAt: new Date('2026-04-04T00:00:00.000Z'),
      updatedAt: new Date('2026-04-04T00:00:00.000Z'),
    })

    expect(result).toBe('Сегодня день рождения у Иван Иванов')
  })

  it('formats notification with notes', () => {
    const result = formatBirthdayNotification({
      id: 'b2',
      userId: 'u1',
      fullName: 'Мария Петрова',
      day: 11,
      month: 4,
      birthYear: null,
      notes: 'Не забыть поздравить утром',
      isReminderEnabled: true,
      deletedAt: null,
      createdAt: new Date('2026-04-04T00:00:00.000Z'),
      updatedAt: new Date('2026-04-04T00:00:00.000Z'),
    })

    expect(result).toBe('Сегодня день рождения у Мария Петрова\nНе забыть поздравить утром')
  })
})
