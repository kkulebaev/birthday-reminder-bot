import type { Birthday } from '@prisma/client'

type DateParts = {
  year: number
  month: number
  day: number
}

type DateTimeParts = DateParts & {
  hour: number
  minute: number
  second: number
}

type TimeParts = {
  hour: number
  minute: number
}

const LOCAL_DATE_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>()
const LOCAL_DATE_TIME_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>()

function getDateFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = LOCAL_DATE_FORMATTER_CACHE.get(timeZone)

  if (cached) {
    return cached
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  LOCAL_DATE_FORMATTER_CACHE.set(timeZone, formatter)

  return formatter
}

function getDateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = LOCAL_DATE_TIME_FORMATTER_CACHE.get(timeZone)

  if (cached) {
    return cached
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  LOCAL_DATE_TIME_FORMATTER_CACHE.set(timeZone, formatter)

  return formatter
}

function getPartValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const value = parts.find((part) => part.type === type)?.value

  if (!value) {
    throw new Error(`Failed to resolve ${type} from Intl.DateTimeFormat parts`)
  }

  return value
}

function getDatePartsInTimezone(date: Date, timeZone: string): DateParts {
  const parts = getDateFormatter(timeZone).formatToParts(date)

  return {
    year: Number(getPartValue(parts, 'year')),
    month: Number(getPartValue(parts, 'month')),
    day: Number(getPartValue(parts, 'day')),
  }
}

function getDateTimePartsInTimezone(date: Date, timeZone: string): DateTimeParts {
  const parts = getDateTimeFormatter(timeZone).formatToParts(date)

  return {
    year: Number(getPartValue(parts, 'year')),
    month: Number(getPartValue(parts, 'month')),
    day: Number(getPartValue(parts, 'day')),
    hour: Number(getPartValue(parts, 'hour')),
    minute: Number(getPartValue(parts, 'minute')),
    second: Number(getPartValue(parts, 'second')),
  }
}

function isLeapYear(year: number): boolean {
  if (year % 400 === 0) {
    return true
  }

  if (year % 100 === 0) {
    return false
  }

  return year % 4 === 0
}

function parseNotifyAt(notifyAt: string): TimeParts {
  const match = notifyAt.match(/^([01]\d|2[0-3]):([0-5]\d)$/)

  if (!match) {
    throw new Error(`Invalid notifyAt value: ${notifyAt}`)
  }

  const [, hoursText, minutesText] = match

  return {
    hour: Number(hoursText),
    minute: Number(minutesText),
  }
}

function compareDateParts(left: DateParts, right: DateParts): number {
  if (left.year !== right.year) {
    return left.year - right.year
  }

  if (left.month !== right.month) {
    return left.month - right.month
  }

  return left.day - right.day
}

function datePartsToDate(dateParts: DateParts): Date {
  return new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day))
}

function resolveLocalDateTimeToUtc(input: {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second?: number
  millisecond?: number
  timeZone: string
}): Date {
  const second = input.second ?? 0
  const millisecond = input.millisecond ?? 0
  const desired = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, second, millisecond)
  let candidate = new Date(desired)

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const actual = getDateTimePartsInTimezone(candidate, input.timeZone)
    const actualUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      0,
    )
    const diff = desired - actualUtc

    if (diff === 0) {
      return new Date(candidate.getTime() + millisecond)
    }

    candidate = new Date(candidate.getTime() + diff)
  }

  return candidate
}

export function resolveBirthdayDateForYear(birthday: Pick<Birthday, 'day' | 'month'>, year: number): DateParts {
  if (birthday.month === 2 && birthday.day === 29 && !isLeapYear(year)) {
    return {
      year,
      month: 2,
      day: 28,
    }
  }

  return {
    year,
    month: birthday.month,
    day: birthday.day,
  }
}

export function getNextOccurrenceDate(birthday: Pick<Birthday, 'day' | 'month'>, timeZone: string, now: Date): Date {
  const today = getDatePartsInTimezone(now, timeZone)
  const occurrenceThisYear = resolveBirthdayDateForYear(birthday, today.year)
  const comparison = compareDateParts(occurrenceThisYear, today)

  if (comparison >= 0) {
    return datePartsToDate(occurrenceThisYear)
  }

  return datePartsToDate(resolveBirthdayDateForYear(birthday, today.year + 1))
}

export function getDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function getOccurrenceDateParts(occurrenceDate: Date): DateParts {
  return {
    year: occurrenceDate.getUTCFullYear(),
    month: occurrenceDate.getUTCMonth() + 1,
    day: occurrenceDate.getUTCDate(),
  }
}

export function getScheduledFor(occurrenceDate: Date, notifyAt: string, timeZone: string): Date {
  const occurrence = getOccurrenceDateParts(occurrenceDate)
  const time = parseNotifyAt(notifyAt)

  return resolveLocalDateTimeToUtc({
    ...occurrence,
    hour: time.hour,
    minute: time.minute,
    timeZone,
  })
}

export function getNextOccurrenceDateAfter(occurrenceDate: Date, birthday: Pick<Birthday, 'day' | 'month'>): Date {
  const occurrence = getOccurrenceDateParts(occurrenceDate)

  return datePartsToDate(resolveBirthdayDateForYear(birthday, occurrence.year + 1))
}

export function getEndOfOccurrenceDay(occurrenceDate: Date, timeZone: string): Date {
  const occurrence = getOccurrenceDateParts(occurrenceDate)
  const nextDay = new Date(Date.UTC(occurrence.year, occurrence.month - 1, occurrence.day + 1))
  const nextDayParts = getOccurrenceDateParts(nextDay)

  return resolveLocalDateTimeToUtc({
    ...nextDayParts,
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0,
    timeZone,
  })
}

export function isOccurrenceDayActive(occurrenceDate: Date, timeZone: string, now: Date): boolean {
  return now.getTime() < getEndOfOccurrenceDay(occurrenceDate, timeZone).getTime()
}
