import { describe, expect, it } from 'vitest'
import {
  getDateString,
  getEndOfOccurrenceDay,
  getNextOccurrenceDate,
  getNextOccurrenceDateAfter,
  getScheduledFor,
  isOccurrenceDayActive,
  resolveBirthdayDateForYear,
} from '../src/notification-schedule.js'

describe('notification schedule helpers', () => {
  it('keeps leap-day birthdays on 29 feb in leap years', () => {
    expect(resolveBirthdayDateForYear({ day: 29, month: 2 }, 2028)).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    })
  })

  it('moves leap-day birthdays to 28 feb in non-leap years', () => {
    expect(resolveBirthdayDateForYear({ day: 29, month: 2 }, 2027)).toEqual({
      year: 2027,
      month: 2,
      day: 28,
    })
  })

  it('returns today when the birthday is today in the user timezone', () => {
    const now = new Date('2026-04-08T12:00:00.000Z')

    expect(getDateString(getNextOccurrenceDate({ day: 8, month: 4 }, 'UTC', now))).toBe('2026-04-08')
  })

  it('rolls over to the next year after the birthday passed locally', () => {
    const now = new Date('2026-04-09T01:00:00.000Z')

    expect(getDateString(getNextOccurrenceDate({ day: 8, month: 4 }, 'UTC', now))).toBe('2027-04-08')
  })

  it('computes the next yearly occurrence from a stored occurrence date', () => {
    const occurrenceDate = new Date('2026-04-08T00:00:00.000Z')

    expect(getDateString(getNextOccurrenceDateAfter(occurrenceDate, { day: 8, month: 4 }))).toBe('2027-04-08')
  })

  it('converts local notify time into utc timestamp', () => {
    const occurrenceDate = new Date('2026-04-08T00:00:00.000Z')

    expect(getScheduledFor(occurrenceDate, '09:00', 'Europe/Berlin').toISOString()).toBe('2026-04-08T07:00:00.000Z')
  })

  it('tracks whether the local occurrence day is still active', () => {
    const occurrenceDate = new Date('2026-04-08T00:00:00.000Z')
    const endOfDay = getEndOfOccurrenceDay(occurrenceDate, 'UTC')

    expect(endOfDay.toISOString()).toBe('2026-04-09T00:00:00.000Z')
    expect(isOccurrenceDayActive(occurrenceDate, 'UTC', new Date('2026-04-08T23:59:59.000Z'))).toBe(true)
    expect(isOccurrenceDayActive(occurrenceDate, 'UTC', endOfDay)).toBe(false)
  })
})
