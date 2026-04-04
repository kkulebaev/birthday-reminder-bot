import 'dotenv/config'
import { Bot } from 'grammy'
import { formatStartMessage } from './format.js'
import { isPrivateChat, upsertUserFromContext } from './user.js'

const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required')
}

const bot = new Bot(token)

bot.command('start', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const settings = user.settings

  if (!settings) {
    throw new Error('User settings were not created')
  }

  await ctx.reply(
    formatStartMessage({
      firstName: user.telegramFirstName,
      timezone: settings.timezone,
      notifyAt: settings.notifyAt,
    }),
  )
})

bot.command('ping', async (ctx) => {
  await ctx.reply('pong')
})

bot.catch((error) => {
  console.error('Bot error', error)
})

void bot.start()
