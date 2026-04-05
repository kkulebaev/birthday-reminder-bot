import { describe, expect, it } from 'vitest'
import { getHomeButtonKeyboard, getMainMenuKeyboard, getMainMenuText } from '../src/main-menu.js'

describe('main menu', () => {
  it('returns main menu text', () => {
    expect(getMainMenuText()).toBe('Что хочешь сделать?')
  })

  it('builds main menu keyboard with expected buttons', () => {
    const keyboard = getMainMenuKeyboard()
    const inlineKeyboard = keyboard.inline_keyboard

    expect(inlineKeyboard).toHaveLength(2)
    expect(inlineKeyboard[0]?.map((button) => button.text)).toEqual(['➕ Добавить', '🎈 Ближайшие'])
    expect(inlineKeyboard[1]?.map((button) => button.text)).toEqual(['📋 Список', 'ℹ️ Помощь'])
  })

  it('builds home button keyboard', () => {
    const keyboard = getHomeButtonKeyboard()
    const inlineKeyboard = keyboard.inline_keyboard

    expect(inlineKeyboard).toHaveLength(1)
    expect(inlineKeyboard[0]?.[0]?.text).toBe('🏠 Главное меню')
    expect(inlineKeyboard[0]?.[0]?.callback_data).toBe('menu:home')
  })
})
