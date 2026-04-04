import 'dotenv/config'
import { Bot } from 'grammy'
import {
  beginAddBirthdayFlow,
  cancelAddBirthdayFlow,
  handleAddBirthdayText,
  isAddBirthdayFlowActive,
} from './add-birthday.js'
import {
  getBirthdayDetailMessage,
  renameBirthday,
  setBirthdayDate,
  softDeleteBirthday,
  toggleBirthdayReminder,
  updateBirthdayNote,
} from './birthday-detail.js'
import { formatStartMessage } from './format.js'
import { formatHelpMessage } from './help.js'
import { getBirthdayListMessage } from './list-birthdays.js'
import { notificationBot } from './notification-bot.js'
import { getBirthdaySearchMessage } from './search-birthdays.js'
import { sendTestNotification } from './test-notification.js'
import { isPrivateChat, upsertUserFromContext } from './user.js'

const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required')
}

export const bot = new Bot(token)

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

bot.command('list', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  await ctx.reply(await getBirthdayListMessage(user.id))
})

bot.command('search', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const query = String(ctx.match).trim()

  await ctx.reply(await getBirthdaySearchMessage(user.id, query))
})

bot.command('view', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const query = String(ctx.match).trim()

  await ctx.reply(await getBirthdayDetailMessage(user.id, query))
})

bot.command('note', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const rawInput = String(ctx.match).trim()
  const [queryPart, ...noteParts] = rawInput.split('|')
  const query = queryPart?.trim() ?? ''
  const note = noteParts.join('|').trim()

  await ctx.reply(await updateBirthdayNote(user.id, query, note))
})

bot.command('toggle', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const query = String(ctx.match).trim()

  await ctx.reply(await toggleBirthdayReminder(user.id, query))
})

bot.command('rename', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const rawInput = String(ctx.match).trim()
  const [queryPart, ...nameParts] = rawInput.split('|')
  const query = queryPart?.trim() ?? ''
  const fullName = nameParts.join('|').trim()

  await ctx.reply(await renameBirthday(user.id, query, fullName))
})

bot.command('setdate', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const rawInput = String(ctx.match).trim()
  const [queryPart, ...dateParts] = rawInput.split('|')
  const query = queryPart?.trim() ?? ''
  const dateInput = dateParts.join('|').trim()

  await ctx.reply(await setBirthdayDate(user.id, query, dateInput))
})

bot.command('delete', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const query = String(ctx.match).trim()

  await ctx.reply(await softDeleteBirthday(user.id, query))
})

bot.command('test_notification', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const chatId = ctx.chat?.id

  if (chatId === undefined) {
    throw new Error('Chat is missing in context')
  }

  await sendTestNotification(notificationBot, String(chatId))
  await ctx.reply('Тестовое уведомление отправил.')
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

  await ctx.reply(await handleAddBirthdayText(ctx, text))
})

bot.command('ping', async (ctx) => {
  await ctx.reply('pong')
})

bot.catch((error) => {
  console.error('Bot error', error)
})
