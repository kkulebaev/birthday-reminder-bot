import { InlineKeyboard, type Context } from 'grammy'
import { beginAddBirthdayFlow } from './add-birthday.js'
import { formatHelpMessage } from './help.js'
import { getSettingsMessage } from './settings.js'
import { safeEditMessageText } from './telegram-api.js'
import { getUpcomingBirthdaysMessage } from './upcoming-birthdays.js'

export function getMainMenuText(): string {
  return [
    '🎂 Birthday Reminder Bot — Lumen',
    '',
    'Я помогу не забыть важные даты.',
    'Выбери, что хочешь сделать дальше.',
  ].join('\n')
}

export function getMainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('➕ Добавить', 'menu:add')
    .text('🎈 Ближайшие', 'menu:upcoming')
    .row()
    .text('⚙️ Настройки', 'menu:settings')
    .text('ℹ️ Помощь', 'menu:help')
}

export function getHomeButtonKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('🏠 Главное меню', 'menu:home')
}

export async function sendMainMenu(ctx: Context): Promise<void> {
  await ctx.reply(getMainMenuText(), {
    reply_markup: getMainMenuKeyboard(),
  })
}

export async function handleMainMenuCallback(ctx: Context, userId: string, data: string): Promise<boolean> {
  if (data === 'menu:home') {
    if (ctx.chat?.id && ctx.callbackQuery?.message?.message_id) {
      await safeEditMessageText(ctx.api, ctx.chat.id, ctx.callbackQuery.message.message_id, getMainMenuText(), getMainMenuKeyboard())
    } else {
      await sendMainMenu(ctx)
    }

    await ctx.answerCallbackQuery()
    return true
  }

  if (data === 'menu:add') {
    await ctx.reply(beginAddBirthdayFlow(ctx))
    await ctx.answerCallbackQuery()
    return true
  }

  if (data === 'menu:upcoming') {
    const result = await getUpcomingBirthdaysMessage(userId)

    if (ctx.chat?.id && ctx.callbackQuery?.message?.message_id) {
      await safeEditMessageText(ctx.api, ctx.chat.id, ctx.callbackQuery.message.message_id, result.text, result.replyMarkup)
    } else {
      await ctx.reply(result.text, {
        reply_markup: result.replyMarkup,
      })
    }

    await ctx.answerCallbackQuery()
    return true
  }

  if (data === 'menu:settings') {
    const result = await getSettingsMessage(userId)

    if (ctx.chat?.id && ctx.callbackQuery?.message?.message_id) {
      await safeEditMessageText(ctx.api, ctx.chat.id, ctx.callbackQuery.message.message_id, result.text, result.replyMarkup)
    } else {
      await ctx.reply(result.text, {
        reply_markup: result.replyMarkup,
      })
    }

    await ctx.answerCallbackQuery()
    return true
  }

  if (data === 'menu:help') {
    if (ctx.chat?.id && ctx.callbackQuery?.message?.message_id) {
      await safeEditMessageText(ctx.api, ctx.chat.id, ctx.callbackQuery.message.message_id, formatHelpMessage(), getMainMenuKeyboard())
    } else {
      await ctx.reply(formatHelpMessage(), {
        reply_markup: getMainMenuKeyboard(),
      })
    }

    await ctx.answerCallbackQuery()
    return true
  }

  return false
}
