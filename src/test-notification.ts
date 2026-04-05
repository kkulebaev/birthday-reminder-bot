import type { Bot } from 'grammy'
import { getBirthdayNotificationKeyboard } from './notification-format.js'

export async function sendTestNotification(bot: Bot, chatId: string): Promise<void> {
  await bot.api.sendMessage(
    chatId,
    ['Тестовое уведомление', '', '🎉 Сегодня день рождения у Иван Иванов'].join('\n'),
    {
      reply_markup: getBirthdayNotificationKeyboard('test-notification'),
    },
  )
}
