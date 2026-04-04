import type { Birthday } from '@prisma/client'
import { prisma } from './db.js'

const PAGE_SIZE = 10

function formatBirthdayLine(index: number, birthday: Birthday): string {
  const day = String(birthday.day).padStart(2, '0')
  const month = String(birthday.month).padStart(2, '0')
  const year = birthday.birthYear ? `.${birthday.birthYear}` : ''
  const reminder = birthday.isReminderEnabled ? '🔔' : '🔕'

  return `${index}. ${birthday.fullName} — ${day}.${month}${year} ${reminder}`
}

export async function getBirthdayListMessage(userId: string): Promise<string> {
  const birthdays = await prisma.birthday.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    orderBy: {
      fullName: 'asc',
    },
    take: PAGE_SIZE,
  })

  if (birthdays.length === 0) {
    return [
      'Список пока пуст.',
      '',
      'Добавь первую запись командой /add.',
    ].join('\n')
  }

  const lines = birthdays.map((birthday, index) => formatBirthdayLine(index + 1, birthday))

  return [
    'Твои дни рождения:',
    '',
    ...lines,
  ].join('\n')
}
