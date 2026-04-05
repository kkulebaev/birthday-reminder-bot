import 'dotenv/config'
import { Bot, type Context, type InlineKeyboard } from 'grammy'
import {
  beginAddBirthdayFlow,
  cancelAddBirthdayFlow,
  canPickAddBirthdayMonth,
  canSkipAddBirthdayStep,
  getAddBirthdayOptionalKeyboard,
  getAddBirthdaySuccessKeyboard,
  goBackAddBirthdayStep,
  handleAddBirthdayText,
  isAddBirthdayFlowActive,
  selectAddBirthdayMonth,
  skipAddBirthdayStep,
} from './add-birthday.js'
import { beginInlineEdit } from './birthday-inline-edit.js'
import {
  findBirthdays,
  getBirthdayDetailResult,
  renameBirthday,
  resolveBirthdayAction,
  setBirthdayDate,
  softDeleteBirthday,
  toggleBirthdayReminder,
  updateBirthdayNote,
  type BirthdayAction,
} from './birthday-detail.js'
import {
  handleBirthdayCallback,
  promptDeleteConfirmation,
  sendBirthdayDetail,
  sendUpdatedBirthdayDetail,
} from './birthday-callbacks.js'
import { cancelInlineEdit, handleInlineEditText, hasInlineEditSession } from './birthday-inline-edit.js'
import { formatStartMessage } from './format.js'
import { formatHelpMessage } from './help.js'
import { sendMainMenu, handleMainMenuCallback } from './main-menu.js'
import { notificationBot } from './notification-bot.js'
import { getBirthdaySearchResult } from './search-birthdays.js'
import {
  beginSettingsEdit,
  cancelSettingsEdit,
  getSettingsMessage,
  getTimezonePickerKeyboard,
  getTimezonePickerText,
  handleSettingsEditText,
  hasSettingsEditSession,
  setNotifyTimePreset,
  setTimezonePreset,
  toggleNotificationsEnabled,
} from './settings.js'
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

async function replyWithTextResult(
  ctx: Context,
  result: { text: string; replyMarkup?: InlineKeyboard },
): Promise<void> {
  if (result.replyMarkup) {
    await ctx.reply(result.text, { reply_markup: result.replyMarkup })
    return
  }

  await ctx.reply(result.text)
}

async function handleBirthdayActionSelection(
  ctx: Context,
  userId: string,
  action: BirthdayAction,
  birthdayId: string,
  query: string,
): Promise<void> {
  const birthdays = await findBirthdays(userId, query)
  const resolution = resolveBirthdayAction(birthdays, query, action)

  if (resolution.kind !== 'single' || resolution.birthday.id !== birthdayId) {
    await replyWithTextResult(ctx, {
      text: 'Эта запись уже не подходит. Попробуй ещё раз.',
    })
    return
  }

  if (action === 'view') {
    await sendBirthdayDetail(ctx, userId, birthdayId)
    return
  }

  if (action === 'note') {
    await ctx.reply('Выбрал запись. Теперь отправь новую заметку одним сообщением.')
    await ctx.reply(beginInlineEdit(ctx, birthdayId, 'note'))
    return
  }

  if (action === 'toggle') {
    await handleBirthdayCallback(ctx, userId, `birthday:toggle:${birthdayId}`)
    return
  }

  if (action === 'delete') {
    const prompted = await promptDeleteConfirmation(ctx, userId, birthdayId)

    if (!prompted) {
      await ctx.reply('Не нашёл такую запись.')
    }
    return
  }

  if (action === 'rename') {
    await ctx.reply('Выбрал запись. Теперь отправь новое имя одним сообщением.')
    await ctx.reply(beginInlineEdit(ctx, birthdayId, 'rename'))
    return
  }

  await ctx.reply('Выбрал запись. Теперь отправь новую дату в формате DD.MM или DD.MM.YYYY.')
  await ctx.reply(beginInlineEdit(ctx, birthdayId, 'setdate'))
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

  await sendMainMenu(ctx)
})

bot.command('menu', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  await sendMainMenu(ctx)
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

bot.command('upcoming', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const result = await getUpcomingBirthdaysMessage(user.id)
  await ctx.reply(result.text, { reply_markup: result.replyMarkup })
})

bot.command('search', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const query = String(ctx.match).trim()
  const result = await getBirthdaySearchResult(user.id, query)

  if (result.kind === 'single') {
    await sendBirthdayDetail(ctx, user.id, result.birthdayId)
    return
  }

  await ctx.reply(result.text, {
    reply_markup: result.replyMarkup,
  })
})

bot.command('view', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const query = String(ctx.match).trim()
  const result = await getBirthdayDetailResult(user.id, query)

  if (result.replyMarkup) {
    await ctx.reply(result.text, { reply_markup: result.replyMarkup })
    return
  }

  await ctx.reply(result.text)
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

  await replyWithTextResult(ctx, await updateBirthdayNote(user.id, query, note))
})

bot.command('toggle', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const query = String(ctx.match).trim()

  await replyWithTextResult(ctx, await toggleBirthdayReminder(user.id, query))
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

  await replyWithTextResult(ctx, await renameBirthday(user.id, query, fullName))
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

  await replyWithTextResult(ctx, await setBirthdayDate(user.id, query, dateInput))
})

bot.command('delete', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  const user = await upsertUserFromContext(ctx)
  const query = String(ctx.match).trim()

  await replyWithTextResult(ctx, await softDeleteBirthday(user.id, query))
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
  const settingsCancelled = cancelSettingsEdit(ctx)
  const wizardCancelled = cancelAddBirthdayFlow(ctx)

  if (inlineCancelled || settingsCancelled || wizardCancelled) {
    await ctx.reply('Ок, отменил текущее действие.')
    await sendMainMenu(ctx)
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
    const result = await skipAddBirthdayStep(ctx)

    if (result.completed && result.birthdayId) {
      await ctx.reply(result.text, {
        reply_markup: getAddBirthdaySuccessKeyboard(result.birthdayId),
      })
      return
    }

    await replyWithOptionalKeyboard(ctx, result.text)
    return
  }


  if (data === 'birthday:add:back') {
    if (!isAddBirthdayFlowActive(ctx)) {
      await ctx.answerCallbackQuery({ text: 'Сейчас возвращаться некуда' })
      return
    }

    const result = goBackAddBirthdayStep(ctx)
    await ctx.answerCallbackQuery({ text: result.exited ? 'Открываю меню' : 'Возвращаю назад' })

    if (result.exited) {
      await sendMainMenu(ctx)
      return
    }

    await replyWithOptionalKeyboard(ctx, result.text)
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

  if (data.startsWith('birthday:select:')) {
    const parts = data.split(':')
    const action = parts[2]
    const birthdayId = parts[3]
    const encodedQuery = parts[4]

    if (!action || !birthdayId || !encodedQuery) {
      await ctx.answerCallbackQuery({ text: 'Не понял выбор' })
      return
    }

    await ctx.answerCallbackQuery()
    await handleBirthdayActionSelection(ctx, user.id, action as BirthdayAction, birthdayId, decodeURIComponent(encodedQuery))
    return
  }

  if (data.startsWith('birthday:view:')) {
    const birthdayId = data.replace('birthday:view:', '')
    await sendBirthdayDetail(ctx, user.id, birthdayId)
    await ctx.answerCallbackQuery()
    return
  }

  if (data === 'settings:edit-timezone') {
    await ctx.answerCallbackQuery()
    await ctx.reply(getTimezonePickerText(), {
      reply_markup: getTimezonePickerKeyboard(),
    })
    return
  }

  if (data === 'settings:edit-timezone-manual') {
    await ctx.answerCallbackQuery({ text: 'Жду часовой пояс' })
    await ctx.reply(beginSettingsEdit(ctx, 'timezone'))
    return
  }

  if (data.startsWith('settings:preset-timezone:')) {
    const timezone = data.replace('settings:preset-timezone:', '')
    const message = await setTimezonePreset(user.id, timezone)
    const settingsMessage = await getSettingsMessage(user.id)

    await ctx.answerCallbackQuery({ text: message })
    if (ctx.chat?.id && ctx.callbackQuery?.message?.message_id) {
      await ctx.api.editMessageText(ctx.chat.id, ctx.callbackQuery.message.message_id, settingsMessage.text, {
        reply_markup: settingsMessage.replyMarkup,
      })
    } else {
      await ctx.reply(settingsMessage.text, { reply_markup: settingsMessage.replyMarkup })
    }
    return
  }

  if (data === 'settings:edit-notifyAt') {
    await ctx.answerCallbackQuery({ text: 'Жду новое время' })
    await ctx.reply(beginSettingsEdit(ctx, 'notifyAt'))
    return
  }

  if (data === 'settings:toggle-notifications') {
    const message = await toggleNotificationsEnabled(user.id)
    const settingsMessage = await getSettingsMessage(user.id)

    await ctx.answerCallbackQuery({ text: message })
    if (ctx.chat?.id && ctx.callbackQuery?.message?.message_id) {
      await ctx.api.editMessageText(ctx.chat.id, ctx.callbackQuery.message.message_id, settingsMessage.text, {
        reply_markup: settingsMessage.replyMarkup,
      })
    } else {
      await ctx.reply(settingsMessage.text, { reply_markup: settingsMessage.replyMarkup })
    }
    return
  }

  if (data.startsWith('settings:preset-notifyAt:')) {
    const notifyAt = data.replace('settings:preset-notifyAt:', '')
    const message = await setNotifyTimePreset(user.id, notifyAt)
    const settingsMessage = await getSettingsMessage(user.id)

    await ctx.answerCallbackQuery({ text: message })
    if (ctx.chat?.id && ctx.callbackQuery?.message?.message_id) {
      await ctx.api.editMessageText(ctx.chat.id, ctx.callbackQuery.message.message_id, settingsMessage.text, {
        reply_markup: settingsMessage.replyMarkup,
      })
    } else {
      await ctx.reply(settingsMessage.text, { reply_markup: settingsMessage.replyMarkup })
    }
    return
  }

  const menuHandled = await handleMainMenuCallback(ctx, user.id, data)

  if (menuHandled) {
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
    const result = await handleInlineEditText(ctx, user.id, text)

    if (result.kind === 'updated') {
      await sendUpdatedBirthdayDetail(ctx, user.id, result.birthdayId, result.message)
      return
    }

    await ctx.reply(result.message)
    return
  }

  if (hasSettingsEditSession(ctx)) {
    const result = await handleSettingsEditText(ctx, user.id, text)

    if (result.kind === 'updated') {
      const settingsMessage = await getSettingsMessage(user.id)
      await ctx.reply([result.message, '', settingsMessage.text].join('\n'), {
        reply_markup: settingsMessage.replyMarkup,
      })
      return
    }

    await ctx.reply(result.message)
    return
  }

  if (!isAddBirthdayFlowActive(ctx)) {
    await next()
    return
  }

  const result = await handleAddBirthdayText(ctx, text)

  if (result.completed && result.birthdayId) {
    await ctx.reply(result.text, {
      reply_markup: getAddBirthdaySuccessKeyboard(result.birthdayId),
    })
    return
  }

  await replyWithOptionalKeyboard(ctx, result.text)

  if (result.completed) {
    await sendMainMenu(ctx)
  }
})

bot.command('ping', async (ctx) => {
  await ctx.reply('pong')
})

bot.hears(/^\/[A-Za-z0-9_]+(?:@\w+)?(?:\s.*)?$/, async (ctx) => {
  if (!isPrivateChat(ctx)) {
    return
  }

  await ctx.reply('Не знаю такую команду. Открой /menu или /help.')
  await sendMainMenu(ctx)
})

bot.catch((error) => {
  console.error('Bot error', error)
})
