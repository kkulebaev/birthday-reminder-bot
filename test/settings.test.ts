import { describe, expect, it } from 'vitest'
import {
  TIMEZONE_PRESETS,
  formatSettingsText,
  getSettingsKeyboard,
  getTimezonePickerKeyboard,
  getTimezonePickerText,
  isValidNotifyTime,
  isValidTimezone,
} from '../src/settings.js'

describe('settings helpers', () => {
  it('formats settings text with current values', () => {
    const result = formatSettingsText({
      timezone: 'Europe/Moscow',
      notifyAt: '09:00',
      notificationsEnabled: true,
    })

    expect(result).toContain('⚙️ Настройки')
    expect(result).toContain('Часовой пояс: Europe/Moscow')
    expect(result).toContain('Время уведомления: 09:00')
    expect(result).toContain('Уведомления: включены')
    expect(result).toContain('Можешь изменить настройки кнопками ниже')
  })

  it('builds settings keyboard with edit actions, presets, and toggle', () => {
    const keyboard = getSettingsKeyboard({
      timezone: 'UTC',
      notifyAt: '12:00',
      notificationsEnabled: true,
    })

    expect(keyboard.inline_keyboard[0]?.map((button) => button.text)).toEqual(['🌍 Часовой пояс', '⏰ Время уведомления'])
    expect(keyboard.inline_keyboard[1]?.map((button) => button.text)).toEqual(['🕘 09:00', '🕛 12:00', '🕕 18:00'])
    expect(keyboard.inline_keyboard[2]?.[0]?.text).toBe('🔕 Выключить уведомления')
    expect(keyboard.inline_keyboard[3]?.[0]?.text).toBe('🏠 Главное меню')
  })

  it('builds timezone picker with presets and manual fallback', () => {
    const keyboard = getTimezonePickerKeyboard()

    expect(TIMEZONE_PRESETS).toHaveLength(6)
    expect(keyboard.inline_keyboard[0]?.map((button) => button.text)).toEqual(['🌍 UTC', '🇷🇺 Moscow'])
    expect(keyboard.inline_keyboard[1]?.map((button) => button.text)).toEqual(['🇬🇪 Tbilisi', '🇩🇪 Berlin'])
    expect(keyboard.inline_keyboard[2]?.map((button) => button.text)).toEqual(['🇦🇪 Dubai', '🇺🇸 New York'])
    expect(keyboard.inline_keyboard[3]?.[0]?.text).toBe('✍️ Ввести вручную')
    expect(keyboard.inline_keyboard[4]?.[0]?.text).toBe('⚙️ Назад к настройкам')
  })

  it('formats timezone picker guidance text', () => {
    const result = getTimezonePickerText()

    expect(result).toContain('Выбери часовой пояс ниже.')
    expect(result).toContain('Ввести вручную')
  })

  it('switches notifications toggle label when disabled', () => {
    const keyboard = getSettingsKeyboard({
      timezone: 'UTC',
      notifyAt: '12:00',
      notificationsEnabled: false,
    })

    expect(keyboard.inline_keyboard[2]?.[0]?.text).toBe('🔔 Включить уведомления')
  })

  it('validates notify time format', () => {
    expect(isValidNotifyTime('09:00')).toBe(true)
    expect(isValidNotifyTime('23:59')).toBe(true)
    expect(isValidNotifyTime('9:00')).toBe(false)
    expect(isValidNotifyTime('24:00')).toBe(false)
  })

  it('validates timezone names', () => {
    expect(isValidTimezone('UTC')).toBe(true)
    expect(isValidTimezone('Europe/Moscow')).toBe(true)
    expect(isValidTimezone('Mars/Olympus')).toBe(false)
  })
})
