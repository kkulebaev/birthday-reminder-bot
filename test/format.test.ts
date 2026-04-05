import { describe, expect, it } from 'vitest'
import { formatStartMessage } from '../src/format.js'

describe('formatStartMessage', () => {
  it('uses provided first name', () => {
    const result = formatStartMessage({
      firstName: 'Костя',
      timezone: 'Europe/Moscow',
      notifyAt: '09:00',
    })

    expect(result).toContain('Привет, Костя ✨')
    expect(result).toContain('Начни с /menu — там основные действия.')
    expect(result).toContain('• Часовой пояс: Europe/Moscow')
    expect(result).toContain('• Время уведомления: 09:00')
  })

  it('falls back to default name when first name is missing', () => {
    const result = formatStartMessage({
      firstName: null,
      timezone: 'UTC',
      notifyAt: '12:00',
    })

    expect(result).toContain('Привет, друг ✨')
  })
})
