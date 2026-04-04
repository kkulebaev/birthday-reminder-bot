import { describe, expect, it } from 'vitest'
import { formatHelpMessage } from '../src/help.js'

describe('formatHelpMessage', () => {
  it('includes core commands in help output', () => {
    const result = formatHelpMessage()

    expect(result).toContain('/menu — открыть главное меню')
    expect(result).toContain('/add — добавить день рождения')
    expect(result).toContain('/upcoming — посмотреть ближайшие дни рождения')
    expect(result).toContain('/cancel — отменить текущее действие')
  })

  it('includes updated wizard hint', () => {
    const result = formatHelpMessage()

    expect(result).toContain('Подсказка: большинство действий можно делать через кнопки, а в wizard месяц выбирается кнопками.')
  })
})
