import { InlineKeyboard } from 'grammy'
import type { Birthday } from '@prisma/client'

export function formatBirthdayNotification(birthday: Birthday): string {
  const noteBlock = birthday.notes
    ? ['', '📝 Что важно помнить:', birthday.notes].join('\n')
    : ''

  return [
    `🎉 Сегодня день рождения у ${birthday.fullName}`,
    noteBlock,
  ].filter(Boolean).join('\n')
}

export function getBirthdayNotificationKeyboard(birthdayId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('🎂 Открыть карточку', `birthday:view:${birthdayId}`)
    .text('🔕 Выключить напоминания', `birthday:toggle:${birthdayId}`)
}
