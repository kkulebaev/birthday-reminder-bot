import 'dotenv/config'
import { Bot } from 'grammy'

const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required')
}

const bot = new Bot(token)

bot.command('start', async (ctx) => {
  await ctx.reply('Привет. Я birthday-reminder-bot. Пока это ранний каркас проекта.')
})

bot.command('ping', async (ctx) => {
  await ctx.reply('pong')
})

bot.catch((error) => {
  console.error('Bot error', error)
})

void bot.start()
