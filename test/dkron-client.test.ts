import { describe, expect, it } from 'vitest'
import { buildBirthdayCronExpression, getBirthdayJobName } from '../src/dkron-client.js'

describe('dkron client helpers', () => {
  it('formats job name from birthday id', () => {
    expect(getBirthdayJobName('abc123')).toBe('bday-abc123')
  })

  it('builds 5-field cron expression for the birthday in the user notify time', () => {
    expect(buildBirthdayCronExpression({ month: 5, day: 15, notifyAt: '09:00' })).toBe('0 9 15 5 *')
    expect(buildBirthdayCronExpression({ month: 12, day: 1, notifyAt: '23:30' })).toBe('30 23 1 12 *')
  })

  it('rejects malformed notifyAt values', () => {
    expect(() => buildBirthdayCronExpression({ month: 1, day: 1, notifyAt: '9:00' })).toThrow()
    expect(() => buildBirthdayCronExpression({ month: 1, day: 1, notifyAt: '24:00' })).toThrow()
  })
})
