import 'dotenv/config'
import { DeliveryStatus } from '@prisma/client'
import { Bot } from 'grammy'
import { prisma } from './db.js'
import { formatBirthdayNotification } from './notification-format.js'

type DueBirthday = {
  birthdayId: string
  userId: string
  telegramChatId: string
  fullName: string
  day: number
  month: number
  birthYear: number | null
  notes: string | null
  isReminderEnabled: boolean
}

const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required')
}

const bot = new Bot(token)

function getTodayUtcDate(): Date {
  const now = new Date()

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function getMoscowDateParts(): { day: number; month: number } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
  })

  const parts = formatter.formatToParts(new Date())
  const dayPart = parts.find((part) => part.type === 'day')?.value
  const monthPart = parts.find((part) => part.type === 'month')?.value

  if (!dayPart || !monthPart) {
    throw new Error('Failed to resolve Moscow date parts')
  }

  return {
    day: Number(dayPart),
    month: Number(monthPart),
  }
}

async function getDueBirthdays(): Promise<DueBirthday[]> {
  const { day, month } = getMoscowDateParts()

  const birthdays = await prisma.birthday.findMany({
    where: {
      deletedAt: null,
      isReminderEnabled: true,
      day,
      month,
      user: {
        settings: {
          is: {
            notificationsEnabled: true,
          },
        },
      },
    },
    include: {
      user: true,
    },
  })

  return birthdays.map((birthday) => ({
    birthdayId: birthday.id,
    userId: birthday.userId,
    telegramChatId: birthday.user.telegramChatId,
    fullName: birthday.fullName,
    day: birthday.day,
    month: birthday.month,
    birthYear: birthday.birthYear,
    notes: birthday.notes,
    isReminderEnabled: birthday.isReminderEnabled,
  }))
}

async function markDeliveryAttempt(input: {
  userId: string
  birthdayId: string
  occurrenceDate: Date
  status: DeliveryStatus
  telegramMessageId?: string
  errorMessage?: string
}): Promise<void> {
  const existing = await prisma.deliveryLog.findUnique({
    where: {
      userId_birthdayId_notificationType_occurrenceDate: {
        userId: input.userId,
        birthdayId: input.birthdayId,
        notificationType: 'birthday',
        occurrenceDate: input.occurrenceDate,
      },
    },
  })

  if (!existing) {
    await prisma.deliveryLog.create({
      data: {
        userId: input.userId,
        birthdayId: input.birthdayId,
        notificationType: 'birthday',
        occurrenceDate: input.occurrenceDate,
        status: input.status,
        attemptCount: 1,
        lastAttemptAt: new Date(),
        sentAt: input.status === DeliveryStatus.sent ? new Date() : null,
        telegramMessageId: input.telegramMessageId ?? null,
        errorMessage: input.errorMessage ?? null,
      },
    })

    return
  }

  await prisma.deliveryLog.update({
    where: {
      id: existing.id,
    },
    data: {
      status: input.status,
      attemptCount: existing.attemptCount + 1,
      lastAttemptAt: new Date(),
      sentAt: input.status === DeliveryStatus.sent ? new Date() : existing.sentAt,
      telegramMessageId: input.telegramMessageId ?? existing.telegramMessageId,
      errorMessage: input.errorMessage ?? null,
    },
  })
}

async function hasSuccessfulDelivery(userId: string, birthdayId: string, occurrenceDate: Date): Promise<boolean> {
  const deliveryLog = await prisma.deliveryLog.findUnique({
    where: {
      userId_birthdayId_notificationType_occurrenceDate: {
        userId,
        birthdayId,
        notificationType: 'birthday',
        occurrenceDate,
      },
    },
  })

  return deliveryLog?.status === DeliveryStatus.sent
}

export async function runScheduler(): Promise<void> {
  const occurrenceDate = getTodayUtcDate()
  const dueBirthdays = await getDueBirthdays()

  for (const dueBirthday of dueBirthdays) {
    const alreadySent = await hasSuccessfulDelivery(dueBirthday.userId, dueBirthday.birthdayId, occurrenceDate)

    if (alreadySent) {
      continue
    }

    try {
      const message = await bot.api.sendMessage(
        dueBirthday.telegramChatId,
        formatBirthdayNotification({
          id: dueBirthday.birthdayId,
          userId: dueBirthday.userId,
          fullName: dueBirthday.fullName,
          day: dueBirthday.day,
          month: dueBirthday.month,
          birthYear: dueBirthday.birthYear,
          notes: dueBirthday.notes,
          isReminderEnabled: dueBirthday.isReminderEnabled,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      )

      await markDeliveryAttempt({
        userId: dueBirthday.userId,
        birthdayId: dueBirthday.birthdayId,
        occurrenceDate,
        status: DeliveryStatus.sent,
        telegramMessageId: String(message.message_id),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown scheduler error'

      await markDeliveryAttempt({
        userId: dueBirthday.userId,
        birthdayId: dueBirthday.birthdayId,
        occurrenceDate,
        status: DeliveryStatus.failed,
        errorMessage,
      })
    }
  }
}

void runScheduler()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error('Scheduler error', error)
    await prisma.$disconnect()
    process.exitCode = 1
  })
