import { describe, expect, it } from 'vitest'
import { formatHelpMessage } from '../src/help.js'

describe('formatHelpMessage', () => {
  it('includes core commands in help output', () => {
    const result = formatHelpMessage()

    expect(result).toContain('/menu — открыть главное меню')
    expect(result).toContain('/add — добавить день рождения')
    expect(result).toContain('/upcoming — посмотреть ближайшие дни рождения')
    expect(result).toContain('/search <name> — найти запись по имени')
  })

  it('includes menu-first guidance', () => {
    const result = formatHelpMessage()

    expect(result).toContain('Остальное доступно из карточки записи и через кнопки.')
    expect(result).toContain('Если сомневаешься — просто открой /menu.')
  })
})
