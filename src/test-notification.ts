import type { Bot } from 'grammy'

export async function sendTestNotification(bot: Bot, chatId: string): Promise<void> {
  await bot.api.sendMessage(chatId, 'Тестовое уведомление\nСегодня день рождения у Иван Иванов')
}
