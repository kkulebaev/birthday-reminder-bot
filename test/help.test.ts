import { describe, expect, it } from 'vitest'
import { formatHelpMessage } from '../src/help.js'

describe('formatHelpMessage', () => {
  it('includes core commands in help output', () => {
    const result = formatHelpMessage()

    expect(result).toContain('/menu — открыть главное меню')
    expect(result).toContain('/add — начать добавление дня рождения')
    expect(result).toContain('/upcoming — показать ближайшие дни рождения')
    expect(result).toContain('/cancel — отменить текущее действие')
  })

  it('includes wizard hint', () => {
    const result = formatHelpMessage()

    expect(result).toContain('Подсказка: в wizard можно нажимать «Пропустить», а месяц выбирать кнопками.')
  })
})
