import { InlineKeyboard, type Context } from 'grammy'
import { beginAddBirthdayFlow } from './add-birthday.js'
import { formatHelpMessage } from './help.js'
import { getBirthdayListMessage } from './list-birthdays.js'
import { getUpcomingBirthdaysMessage } from './upcoming-birthdays.js'

export function getMainMenuText(): string {
  return 'Что хочешь сделать?'
}

export function getMainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('➕ Добавить', 'menu:add')
    .text('🎈 Ближайшие', 'menu:upcoming')
    .row()
    .text('📋 Список', 'menu:list')
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
      await ctx.api.editMessageText(ctx.chat.id, ctx.callbackQuery.message.message_id, getMainMenuText(), {
        reply_markup: getMainMenuKeyboard(),
      })
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

  if (data === 'menu:list') {
    const result = await getBirthdayListMessage(userId)

    if (result.replyMarkup && ctx.chat?.id && ctx.callbackQuery?.message?.message_id) {
      await ctx.api.editMessageText(ctx.chat.id, ctx.callbackQuery.message.message_id, result.text, {
        reply_markup: result.replyMarkup,
      })
    } else if (result.replyMarkup) {
      await ctx.reply(result.text, {
        reply_markup: result.replyMarkup,
      })
    } else {
      await ctx.reply(result.text)
    }

    await ctx.answerCallbackQuery()
    return true
  }

  if (data === 'menu:upcoming') {
    const result = await getUpcomingBirthdaysMessage(userId)

    if (ctx.chat?.id && ctx.callbackQuery?.message?.message_id) {
      await ctx.api.editMessageText(ctx.chat.id, ctx.callbackQuery.message.message_id, result.text, {
        reply_markup: result.replyMarkup,
      })
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
      await ctx.api.editMessageText(ctx.chat.id, ctx.callbackQuery.message.message_id, formatHelpMessage(), {
        reply_markup: getMainMenuKeyboard(),
      })
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
