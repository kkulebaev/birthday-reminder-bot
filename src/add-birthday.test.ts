import type { Context } from 'grammy'
import { describe, expect, it } from 'vitest'
import {
  beginAddBirthdayFlow,
  canPickAddBirthdayMonth,
  canSkipAddBirthdayStep,
  getAddBirthdayOptionalKeyboard,
  goBackAddBirthdayStep,
  handleAddBirthdayText,
  isAddBirthdayFlowActive,
  selectAddBirthdayMonth,
} from './add-birthday.js'

function createContext(userId = 1): Context {
  return {
    from: {
      id: userId,
    },
  } as Context
}

describe('add birthday flow navigation', () => {
  it('starts from full name step with back button', () => {
    const ctx = createContext()

    const text = beginAddBirthdayFlow(ctx)
    const keyboard = getAddBirthdayOptionalKeyboard(ctx)

    expect(text).toContain('Шаг 1 из 5')
    expect(text).toContain('как зовут человека?')
    expect(isAddBirthdayFlowActive(ctx)).toBe(true)
    expect(keyboard?.inline_keyboard).toEqual([
      [{ text: '← Назад', callback_data: 'birthday:add:back' }],
    ])
  })

  it('shows current values when going back through previous steps', async () => {
    const ctx = createContext()

    beginAddBirthdayFlow(ctx)
    await handleAddBirthdayText(ctx, 'Иван Иванов')
    await handleAddBirthdayText(ctx, '12')
    selectAddBirthdayMonth(ctx, 3)

    const backToMonth = goBackAddBirthdayStep(ctx)
    expect(backToMonth.exited).toBe(false)
    expect(backToMonth.text).toContain('Шаг 3 из 5')
    expect(backToMonth.text).toContain('Сейчас: Мар')

    const backToDay = goBackAddBirthdayStep(ctx)
    expect(backToDay.exited).toBe(false)
    expect(backToDay.text).toContain('Шаг 2 из 5')
    expect(backToDay.text).toContain('Сейчас: 12')

    const backToName = goBackAddBirthdayStep(ctx)
    expect(backToName.exited).toBe(false)
    expect(backToName.text).toContain('Шаг 1 из 5')
    expect(backToName.text).toContain('Сейчас: Иван Иванов')
  })

  it('exits to menu when going back from the first step', () => {
    const ctx = createContext()

    beginAddBirthdayFlow(ctx)
    const result = goBackAddBirthdayStep(ctx)

    expect(result.exited).toBe(true)
    expect(isAddBirthdayFlowActive(ctx)).toBe(false)
  })

  it('keeps back button on month picker and skip plus back on optional steps', async () => {
    const ctx = createContext()

    beginAddBirthdayFlow(ctx)
    await handleAddBirthdayText(ctx, 'Иван Иванов')
    await handleAddBirthdayText(ctx, '12')

    const monthKeyboard = getAddBirthdayOptionalKeyboard(ctx)

    expect(canPickAddBirthdayMonth(ctx)).toBe(true)
    expect(monthKeyboard?.inline_keyboard.at(-1)).toEqual([
      { text: '← Назад', callback_data: 'birthday:add:back' },
    ])

    selectAddBirthdayMonth(ctx, 3)
    const birthYearKeyboard = getAddBirthdayOptionalKeyboard(ctx)

    expect(canSkipAddBirthdayStep(ctx)).toBe(true)
    expect(birthYearKeyboard?.inline_keyboard).toEqual([
      [{ text: 'Пропустить', callback_data: 'birthday:add:skip' }],
      [{ text: '← Назад', callback_data: 'birthday:add:back' }],
    ])
  })

  it('shows updated current values after going back and moving forward again', async () => {
    const ctx = createContext()

    beginAddBirthdayFlow(ctx)
    await handleAddBirthdayText(ctx, 'Иван Иванов')
    await handleAddBirthdayText(ctx, '12')
    selectAddBirthdayMonth(ctx, 3)
    await handleAddBirthdayText(ctx, '1990')

    const backToBirthYear = goBackAddBirthdayStep(ctx)
    expect(backToBirthYear.text).toContain('Сейчас: 1990')

    const notesStep = await handleAddBirthdayText(ctx, '2000')
    expect(notesStep.completed).toBe(false)
    expect(notesStep.text).toContain('Шаг 5 из 5')

    const backToBirthYearAgain = goBackAddBirthdayStep(ctx)
    expect(backToBirthYearAgain.text).toContain('Сейчас: 2000')
  })
})
