import { InlineKeyboard, type Context } from 'grammy'
import { prisma } from './db.js'

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

    if (ctx.chat?.id && ctx.callbackQuery?.message?.message_id) {
      await ctx.api.editMessageText(ctx.chat.id, ctx.callbackQuery.message.message_id, formatDetailText(updated), {
        reply_markup: getDetailKeyboard(updated.id),
      })
    }

    await ctx.answerCallbackQuery({ text: 'Статус напоминаний обновлён' })
    return true
  }

  if (action === 'delete') {
    await prisma.birthday.update({
      where: { id: record.id },
      data: { deletedAt: new Date() },
    })

    if (ctx.chat?.id && ctx.callbackQuery?.message?.message_id) {
      await ctx.api.editMessageText(ctx.chat.id, ctx.callbackQuery.message.message_id, `Удалил запись: ${record.fullName}`)
    }

    await ctx.answerCallbackQuery({ text: 'Запись удалена' })
    return true
  }

  return false
}
