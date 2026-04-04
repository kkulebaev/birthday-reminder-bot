import { InlineKeyboard, type Context } from 'grammy'
import { prisma } from './db.js'
import { getBirthdayListMessage, getListBackKeyboard } from './list-birthdays.js'

type BirthdayRecord = {
  id: string
  userId: string
  fullName: string
  day: number
  month: number
  birthYear: number | null
  notes: string | null
  isReminderEnabled: boolean
}

function formatDate(day: number, month: number, birthYear: number | null): string {
  const dayText = String(day).padStart(2, '0')
  const monthText = String(month).padStart(2, '0')
  const yearText = birthYear ? `.${birthYear}` : ''

  return `${dayText}.${monthText}${yearText}`
}

function formatDetailText(record: BirthdayRecord): string {
  return [
    `Full Name: ${record.fullName}`,
    `Дата: ${formatDate(record.day, record.month, record.birthYear)}`,
    `Напоминания: ${record.isReminderEnabled ? 'включены' : 'выключены'}`,
    `Заметка: ${record.notes ?? '—'}`,
  ].join('\n')
}

function getDetailKeyboard(recordId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔔 Toggle', `birthday:toggle:${recordId}`)
    .text('🗑 Delete', `birthday:delete:${recordId}`)
    .row()
    .text('⬅️ Назад к списку', 'birthday:list')
}

async function getOwnedBirthday(userId: string, birthdayId: string): Promise<BirthdayRecord | null> {
  return prisma.birthday.findFirst({
    where: {
      id: birthdayId,
      userId,
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
      fullName: true,
      day: true,
      month: true,
      birthYear: true,
      notes: true,
      isReminderEnabled: true,
    },
  })
}

async function editCallbackMessage(ctx: Context, text: string, replyMarkup?: InlineKeyboard): Promise<void> {
  const chatId = ctx.chat?.id
  const messageId = ctx.callbackQuery?.message?.message_id

  if (!chatId || !messageId) {
    await ctx.reply(text, replyMarkup ? { reply_markup: replyMarkup } : undefined)
    return
  }

  if (replyMarkup) {
    await ctx.api.editMessageText(chatId, messageId, text, {
      reply_markup: replyMarkup,
    })
    return
  }

  await ctx.api.editMessageText(chatId, messageId, text)
}

export async function sendBirthdayDetail(ctx: Context, userId: string, birthdayId: string): Promise<void> {
  const record = await getOwnedBirthday(userId, birthdayId)

  if (!record) {
    await ctx.reply('Запись не найдена.')
    return
  }

  await ctx.reply(formatDetailText(record), {
    reply_markup: getDetailKeyboard(record.id),
  })
}

export async function handleBirthdayCallback(ctx: Context, userId: string, data: string): Promise<boolean> {
  if (data === 'birthday:list') {
    const result = await getBirthdayListMessage(userId)
    await editCallbackMessage(ctx, result.text, result.replyMarkup)
    await ctx.answerCallbackQuery()
    return true
  }

  const parts = data.split(':')

  if (parts.length !== 3 || parts[0] !== 'birthday') {
    return false
  }

  const action = parts[1]
  const birthdayId = parts[2]

  if (!action || !birthdayId) {
    return false
  }

  const record = await getOwnedBirthday(userId, birthdayId)

  if (!record) {
    await ctx.answerCallbackQuery({ text: 'Запись не найдена' })
    return true
  }

  if (action === 'toggle') {
    const updated = await prisma.birthday.update({
      where: { id: record.id },
      data: { isReminderEnabled: !record.isReminderEnabled },
      select: {
        id: true,
        userId: true,
        fullName: true,
        day: true,
        month: true,
        birthYear: true,
        notes: true,
        isReminderEnabled: true,
      },
    })

    await editCallbackMessage(ctx, formatDetailText(updated), getDetailKeyboard(updated.id))
    await ctx.answerCallbackQuery({ text: 'Статус напоминаний обновлён' })
    return true
  }

  if (action === 'delete') {
    await prisma.birthday.update({
      where: { id: record.id },
      data: { deletedAt: new Date() },
    })

    await editCallbackMessage(ctx, `Удалил запись: ${record.fullName}`, getListBackKeyboard())
    await ctx.answerCallbackQuery({ text: 'Запись удалена' })
    return true
  }

  return false
}
