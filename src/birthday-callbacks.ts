import { InlineKeyboard, type Context } from 'grammy'
import { beginInlineEdit } from './birthday-inline-edit.js'
import { prisma } from './db.js'
import { schedulerService } from './scheduler-service.js'
import { safeEditMessageText } from './telegram-api.js'
import { getUpcomingBirthdaysMessage } from './upcoming-birthdays.js'

export type BirthdayRecord = {
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

export function formatDetailText(record: BirthdayRecord): string {
  return [
    `🎂 ${record.fullName}`,
    '',
    `Дата: ${formatDate(record.day, record.month, record.birthYear)}`,
    `Напоминания: ${record.isReminderEnabled ? 'включены' : 'выключены'}`,
    `Заметка: ${record.notes ?? '—'}`,
  ].join('\n')
}

export function getDeleteConfirmationText(record: BirthdayRecord): string {
  return [
    `Удалить запись «${record.fullName}»?`,
    '',
    `Дата: ${formatDate(record.day, record.month, record.birthYear)}`,
    'Запись исчезнет из списка, и напоминания по ней больше не будут приходить.',
  ].join('\n')
}

function getReminderButtonText(record: BirthdayRecord): string {
  return record.isReminderEnabled ? '🔕 Выключить напоминания' : '🔔 Включить напоминания'
}

function getNoteButtonText(record: BirthdayRecord): string {
  return record.notes ? '📝 Изменить заметку' : '📝 Добавить заметку'
}

export function getDetailKeyboard(record: BirthdayRecord): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text(getReminderButtonText(record), `birthday:toggle:${record.id}`)
    .row()
    .text(getNoteButtonText(record), `birthday:edit-note:${record.id}`)
    .text('✏️ Имя', `birthday:edit-rename:${record.id}`)
    .row()
    .text('📅 Дата', `birthday:edit-date:${record.id}`)

  if (record.notes) {
    keyboard.text('🧹 Удалить заметку', `birthday:clear-note:${record.id}`)
  }

  keyboard
    .row()
    .text('🗑 Удалить', `birthday:delete:${record.id}`)
    .text('🎈 Ближайшие', 'birthday:upcoming')
    .row()
    .text('🏠 Главное меню', 'menu:home')

  return keyboard
}

export function getDeleteConfirmationKeyboard(recordId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('🗑 Да, удалить', `birthday:confirm-delete:${recordId}`)
    .text('↩️ Назад', `birthday:view:${recordId}`)
    .row()
    .text('🏠 Главное меню', 'menu:home')
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
    if (replyMarkup) {
      await ctx.reply(text, { reply_markup: replyMarkup })
      return
    }

    await ctx.reply(text)
    return
  }

  await safeEditMessageText(ctx.api, chatId, messageId, text, replyMarkup)
}

export async function sendBirthdayDetail(ctx: Context, userId: string, birthdayId: string): Promise<void> {
  const record = await getOwnedBirthday(userId, birthdayId)

  if (!record) {
    await ctx.reply('Не нашёл такую запись.')
    return
  }

  await ctx.reply(formatDetailText(record), {
    reply_markup: getDetailKeyboard(record),
  })
}

export async function sendUpdatedBirthdayDetail(ctx: Context, userId: string, birthdayId: string, successMessage?: string): Promise<void> {
  const record = await getOwnedBirthday(userId, birthdayId)

  if (!record) {
    await ctx.reply('Не нашёл такую запись.')
    return
  }

  const text = successMessage
    ? [successMessage, '', formatDetailText(record)].join('\n')
    : formatDetailText(record)

  await ctx.reply(text, {
    reply_markup: getDetailKeyboard(record),
  })
}

export async function promptDeleteConfirmation(ctx: Context, userId: string, birthdayId: string): Promise<boolean> {
  const record = await getOwnedBirthday(userId, birthdayId)

  if (!record) {
    return false
  }

  await ctx.reply(getDeleteConfirmationText(record), {
    reply_markup: getDeleteConfirmationKeyboard(record.id),
  })

  return true
}

export async function handleBirthdayCallback(ctx: Context, userId: string, data: string): Promise<boolean> {
  if (data === 'birthday:upcoming') {
    const result = await getUpcomingBirthdaysMessage(userId)
    await editCallbackMessage(ctx, result.text, result.replyMarkup)
    await ctx.answerCallbackQuery()
    return true
  }

  if (data === 'birthday:upcoming-page-current') {
    await ctx.answerCallbackQuery()
    return true
  }

  if (data.startsWith('birthday:upcoming-page:')) {
    const pageIndex = Number.parseInt(data.replace('birthday:upcoming-page:', ''), 10)
    const result = await getUpcomingBirthdaysMessage(userId, pageIndex)
    await editCallbackMessage(ctx, result.text, result.replyMarkup)
    await ctx.answerCallbackQuery()
    return true
  }

  if (data.startsWith('birthday:view:')) {
    const birthdayId = data.replace('birthday:view:', '')
    const record = await getOwnedBirthday(userId, birthdayId)

    if (!record) {
      await ctx.answerCallbackQuery({ text: 'Не нашёл запись' })
      return true
    }

    await editCallbackMessage(ctx, formatDetailText(record), getDetailKeyboard(record))
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
    await ctx.answerCallbackQuery({ text: 'Не нашёл запись' })
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

    await schedulerService.rebuildBirthdayNotification(updated.id)
    await editCallbackMessage(ctx, formatDetailText(updated), getDetailKeyboard(updated))
    await ctx.answerCallbackQuery({ text: updated.isReminderEnabled ? 'Напоминания включены' : 'Напоминания выключены' })
    return true
  }

  if (action === 'delete') {
    await editCallbackMessage(ctx, getDeleteConfirmationText(record), getDeleteConfirmationKeyboard(record.id))
    await ctx.answerCallbackQuery({ text: 'Нужно подтверждение' })
    return true
  }

  if (action === 'confirm-delete') {
    await prisma.birthday.update({
      where: { id: record.id },
      data: { deletedAt: new Date() },
    })

    await schedulerService.rebuildBirthdayNotification(record.id)
    await editCallbackMessage(
      ctx,
      [`Готово, удалил запись: ${record.fullName}`, '', 'Можешь вернуться к ближайшим датам или в главное меню.'].join('\n'),
      new InlineKeyboard()
        .text('🎈 Ближайшие', 'birthday:upcoming')
        .row()
        .text('🏠 Главное меню', 'menu:home'),
    )
    await ctx.answerCallbackQuery({ text: 'Удалено' })
    return true
  }

  if (action === 'edit-note') {
    await ctx.answerCallbackQuery({ text: record.notes ? 'Жду новую заметку' : 'Жду заметку' })
    await ctx.reply(beginInlineEdit(ctx, record.id, 'note'))
    return true
  }

  if (action === 'clear-note') {
    await prisma.birthday.update({
      where: { id: record.id },
      data: { notes: null },
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

    const updated = await getOwnedBirthday(userId, record.id)

    if (!updated) {
      await ctx.answerCallbackQuery({ text: 'Не нашёл запись' })
      return true
    }

    await editCallbackMessage(ctx, formatDetailText(updated), getDetailKeyboard(updated))
    await ctx.answerCallbackQuery({ text: 'Заметка удалена' })
    return true
  }

  if (action === 'edit-rename') {
    await ctx.answerCallbackQuery({ text: 'Жду новое имя' })
    await ctx.reply(beginInlineEdit(ctx, record.id, 'rename'))
    return true
  }

  if (action === 'edit-date') {
    await ctx.answerCallbackQuery({ text: 'Жду новую дату' })
    await ctx.reply(beginInlineEdit(ctx, record.id, 'setdate'))
    return true
  }

  return false
}
