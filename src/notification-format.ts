import type { Birthday } from '@prisma/client'

export function formatBirthdayNotification(birthday: Birthday): string {
  const notes = birthday.notes ? `\n${birthday.notes}` : ''

  return `Сегодня день рождения у ${birthday.fullName}${notes}`
}
