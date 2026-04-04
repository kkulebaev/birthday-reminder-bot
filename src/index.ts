import 'dotenv/config'
import { Bot } from 'grammy'
import {
  beginAddBirthdayFlow,
  cancelAddBirthdayFlow,
  handleAddBirthdayText,
  isAddBirthdayFlowActive,
} from './add-birthday.js'
import { formatStartMessage } from './format.js'
import { formatHelpMessage } from './help.js'
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

bot.command('help', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  await ctx.reply(formatHelpMessage())
})

bot.command('add', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  await upsertUserFromContext(ctx)
  await ctx.reply(beginAddBirthdayFlow(ctx))
})

bot.command('cancel', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const wasCancelled = cancelAddBirthdayFlow(ctx)

  await ctx.reply(wasCancelled ? 'Ок, отменил текущий wizard.' : 'Сейчас нечего отменять.')
})

bot.on('message:text', async (ctx, next) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const text = ctx.message.text.trim()

  if (text.startsWith('/')) {
    await next()
    return
  }

  if (!isAddBirthdayFlowActive(ctx)) {
    await next()
    return
  }

  await ctx.reply(handleAddBirthdayText(ctx, text))
})

bot.command('ping', async (ctx) => {
  await ctx.reply('pong')
})

bot.catch((error) => {
  console.error('Bot error', error)
})

void bot.start()
