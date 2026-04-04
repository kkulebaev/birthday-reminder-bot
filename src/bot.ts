import 'dotenv/config'
import { Bot, type Context } from 'grammy'
import {
  beginAddBirthdayFlow,
  cancelAddBirthdayFlow,
  canPickAddBirthdayMonth,
  canSkipAddBirthdayStep,
  getAddBirthdayOptionalKeyboard,
  handleAddBirthdayText,
  isAddBirthdayFlowActive,
  selectAddBirthdayMonth,
  skipAddBirthdayStep,
} from './add-birthday.js'
import {
  getBirthdayDetailMessage,
  renameBirthday,
  setBirthdayDate,
  softDeleteBirthday,
  toggleBirthdayReminder,
  updateBirthdayNote,
} from './birthday-detail.js'
import { handleBirthdayCallback, sendBirthdayDetail } from './birthday-callbacks.js'
import { cancelInlineEdit, handleInlineEditText, hasInlineEditSession } from './birthday-inline-edit.js'
import { formatStartMessage } from './format.js'
import { formatHelpMessage } from './help.js'
import { getBirthdayListMessage } from './list-birthdays.js'
import { notificationBot } from './notification-bot.js'
import { getBirthdaySearchMessage } from './search-birthdays.js'
import { sendTestNotification } from './test-notification.js'
import { getUpcomingBirthdaysMessage } from './upcoming-birthdays.js'
import { isPrivateChat, upsertUserFromContext } from './user.js'

const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required')
}

export const bot = new Bot(token)

async function replyWithOptionalKeyboard(ctx: Context, text: string): Promise<void> {
  const keyboard = getAddBirthdayOptionalKeyboard(ctx)

  if (keyboard) {
    await ctx.reply(text, { reply_markup: keyboard })
    return
  }

  await ctx.reply(text)
}

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
  const result = await getBirthdayListMessage(user.id)

  if (result.replyMarkup) {
    await ctx.reply(result.text, {
      reply_markup: result.replyMarkup,
    })
    return
  }

  await ctx.reply(result.text)
})

bot.command('upcoming', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  await ctx.reply(await getUpcomingBirthdaysMessage(user.id))
})

bot.command('search', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const query = String(ctx.match).trim()
  const result = await getBirthdaySearchMessage(user.id, query)

  if (result.replyMarkup) {
    await ctx.reply(result.text, {
      reply_markup: result.replyMarkup,
    })
    return
  }

  await ctx.reply(result.text)
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

  const inlineCancelled = cancelInlineEdit(ctx)
  const wizardCancelled = cancelAddBirthdayFlow(ctx)

  if (inlineCancelled || wizardCancelled) {
    await ctx.reply('Ок, отменил текущее действие.')
    return
  }

  await ctx.reply('Сейчас нечего отменять.')
})

bot.on('callback_query:data', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const data = ctx.callbackQuery.data

  if (data === 'birthday:add:skip') {
    if (!canSkipAddBirthdayStep(ctx)) {
      await ctx.answerCallbackQuery({ text: 'Сейчас нечего пропускать' })
      return
    }

    await ctx.answerCallbackQuery({ text: 'Пропускаю' })
    await replyWithOptionalKeyboard(ctx, await skipAddBirthdayStep(ctx))
    return
  }

  if (data.startsWith('birthday:add:month:')) {
    if (!canPickAddBirthdayMonth(ctx)) {
      await ctx.answerCallbackQuery({ text: 'Сейчас месяц выбрать нельзя' })
      return
    }

    const month = Number(data.replace('birthday:add:month:', ''))
    await ctx.answerCallbackQuery({ text: 'Месяц выбран' })
    await replyWithOptionalKeyboard(ctx, selectAddBirthdayMonth(ctx, month))
    return
  }

  if (data.startsWith('birthday:view:')) {
    const birthdayId = data.replace('birthday:view:', '')
    await sendBirthdayDetail(ctx, user.id, birthdayId)
    await ctx.answerCallbackQuery()
    return
  }

  const handled = await handleBirthdayCallback(ctx, user.id, data)

  if (!handled) {
    await ctx.answerCallbackQuery({ text: 'Не понял кнопку' })
  }
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

  const user = await upsertUserFromContext(ctx)

  if (hasInlineEditSession(ctx)) {
    await ctx.reply(await handleInlineEditText(ctx, user.id, text))
    return
  }

  if (!isAddBirthdayFlowActive(ctx)) {
    await next()
    return
  }

  await replyWithOptionalKeyboard(ctx, await handleAddBirthdayText(ctx, text))
})

bot.command('ping', async (ctx) => {
  await ctx.reply('pong')
})

bot.catch((error) => {
  console.error('Bot error', error)
})
