import { describe, expect, it } from 'vitest'
import {
  getBirthdayActionSelectionMessage,
  resolveBirthdayAction,
} from '../src/birthday-detail.js'

const firstBirthday = {
  id: 'b1',
  userId: 'u1',
  fullName: 'Анна Иванова',
  day: 7,
  month: 4,
  birthYear: 1990,
  notes: null,
  isReminderEnabled: true,
  deletedAt: null,
  createdAt: new Date('2026-04-04T00:00:00.000Z'),
  updatedAt: new Date('2026-04-04T00:00:00.000Z'),
}

const secondBirthday = {
  id: 'b2',
  userId: 'u1',
  fullName: 'Анна Иванова',
  day: 11,
  month: 12,
  birthYear: null,
  notes: null,
  isReminderEnabled: false,
  deletedAt: null,
  createdAt: new Date('2026-04-04T00:00:00.000Z'),
  updatedAt: new Date('2026-04-04T00:00:00.000Z'),
}

describe('birthday action disambiguation', () => {
  it('returns not-found result with actionable keyboard', () => {
    const result = resolveBirthdayAction([], 'анна', 'view')

    expect(result.kind).toBe('not-found')

    if (result.kind !== 'not-found') {
      throw new Error('Expected not-found result')
    }

    expect(result.text).toContain('Ничего не нашёл по запросу: анна')
    expect(result.text).toContain('Попробуй другой запрос или добавь новую запись.')
    expect(result.replyMarkup.inline_keyboard[0]?.map((button) => button.text)).toEqual(['➕ Добавить', '📋 Открыть список'])
  })

  it('returns single result when only one birthday matches', () => {
    const result = resolveBirthdayAction([firstBirthday], 'анна', 'toggle')

    expect(result.kind).toBe('single')

    if (result.kind !== 'single') {
      throw new Error('Expected single result')
    }

    expect(result.birthday.id).toBe('b1')
  })

  it('returns action-specific ambiguous selection with dates in buttons', () => {
    const result = resolveBirthdayAction([firstBirthday, secondBirthday], 'анна', 'delete')

    expect(result.kind).toBe('ambiguous')

    if (result.kind !== 'ambiguous') {
      throw new Error('Expected ambiguous result')
    }

    expect(result.text).toBe(getBirthdayActionSelectionMessage('delete', 'анна'))
    expect(result.replyMarkup.inline_keyboard[0]?.[0]?.text).toBe('Анна Иванова — 07.04.1990')
    expect(result.replyMarkup.inline_keyboard[1]?.[0]?.text).toBe('Анна Иванова — 11.12')
    expect(result.replyMarkup.inline_keyboard[0]?.[0]?.callback_data).toBe('birthday:select:delete:b1:%D0%B0%D0%BD%D0%BD%D0%B0')
  })

  it('uses tailored prompts for different actions', () => {
    expect(getBirthdayActionSelectionMessage('note', 'иван')).toContain('обновить заметку')
    expect(getBirthdayActionSelectionMessage('rename', 'иван')).toContain('изменить имя')
    expect(getBirthdayActionSelectionMessage('setdate', 'иван')).toContain('изменить дату')
    expect(getBirthdayActionSelectionMessage('toggle', 'иван')).toContain('переключить напоминания')
  })
})
