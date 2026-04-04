import type { Birthday } from '@prisma/client'

export const BIRTHDAY_PAGE_SIZE = 10

export function formatBirthdayLine(index: number, birthday: Birthday): string {
  const day = String(birthday.day).padStart(2, '0')
  const month = String(birthday.month).padStart(2, '0')
  const year = birthday.birthYear ? `.${birthday.birthYear}` : ''
  const reminder = birthday.isReminderEnabled ? '🔔' : '🔕'

  return `${index}. ${birthday.fullName} — ${day}.${month}${year} ${reminder}`
}
