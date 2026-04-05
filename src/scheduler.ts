import 'dotenv/config'
import { DeliveryStatus, type Birthday } from '@prisma/client'
import { Bot } from 'grammy'
import { prisma } from './db.js'
import { formatBirthdayNotification, getBirthdayNotificationKeyboard } from './notification-format.js'

type DueBirthday = {
  birthday: Birthday
  telegramChatId: string
  timezone: string
  notifyAt: string
}

const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required')
}

const bot = new Bot(token)

function getDatePartsInTimezone(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const yearPart = parts.find((part) => part.type === 'year')?.value
  const monthPart = parts.find((part) => part.type === 'month')?.value
  const dayPart = parts.find((part) => part.type === 'day')?.value

  if (!yearPart || !monthPart || !dayPart) {
    throw new Error(`Failed to resolve date parts for timezone ${timeZone}`)
  }

  return {
    year: Number(yearPart),
    month: Number(monthPart),
    day: Number(dayPart),
  }
}

function getMinutesInTimezone(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const hourPart = parts.find((part) => part.type === 'hour')?.value
  const minutePart = parts.find((part) => part.type === 'minute')?.value

  if (!hourPart || !minutePart) {
    throw new Error(`Failed to resolve time parts for timezone ${timeZone}`)
  }

  return Number(hourPart) * 60 + Number(minutePart)
}

function parseNotifyAtToMinutes(notifyAt: string): number | null {
  const match = notifyAt.match(/^(\d{2}):(\d{2})$/)

  if (!match) {
    return null
  }

  const [, hoursText, minutesText] = match
  const hours = Number(hoursText)
  const minutes = Number(minutesText)

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  return hours * 60 + minutes
}

function getOccurrenceDateForTimezone(date: Date, timeZone: string): Date {
  const parts = getDatePartsInTimezone(date, timeZone)

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
}

function isBirthdayToday(birthday: Birthday, timeZone: string, now: Date): boolean {
  const parts = getDatePartsInTimezone(now, timeZone)

  return birthday.day === parts.day && birthday.month === parts.month
}

function isNotifyTimeReached(notifyAt: string, timeZone: string, now: Date): boolean {
  const notifyMinutes = parseNotifyAtToMinutes(notifyAt)

  if (notifyMinutes === null) {
    return true
  }

  return getMinutesInTimezone(now, timeZone) >= notifyMinutes
}

async function getDueBirthdays(now: Date): Promise<DueBirthday[]> {
  const birthdays = await prisma.birthday.findMany({
    where: {
      deletedAt: null,
      isReminderEnabled: true,
      user: {
        settings: {
          is: {
            notificationsEnabled: true,
          },
        },
      },
    },
    include: {
      user: {
        include: {
          settings: true,
        },
      },
    },
  })

  return birthdays
    .filter((birthday) => {
      const settings = birthday.user.settings

      if (!settings) {
        return false
      }

      return isBirthdayToday(birthday, settings.timezone, now) && isNotifyTimeReached(settings.notifyAt, settings.timezone, now)
    })
    .map((birthday) => {
      const settings = birthday.user.settings

      if (!settings) {
        throw new Error('User settings are missing for due birthday')
      }

      return {
        birthday: {
          id: birthday.id,
          userId: birthday.userId,
          fullName: birthday.fullName,
          day: birthday.day,
          month: birthday.month,
          birthYear: birthday.birthYear,
          notes: birthday.notes,
          isReminderEnabled: birthday.isReminderEnabled,
          deletedAt: birthday.deletedAt,
          createdAt: birthday.createdAt,
          updatedAt: birthday.updatedAt,
        },
        telegramChatId: birthday.user.telegramChatId,
        timezone: settings.timezone,
        notifyAt: settings.notifyAt,
      }
    })
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

export async function runScheduler(now: Date = new Date()): Promise<void> {
  const dueBirthdays = await getDueBirthdays(now)

  for (const dueBirthday of dueBirthdays) {
    const occurrenceDate = getOccurrenceDateForTimezone(now, dueBirthday.timezone)
    const alreadySent = await hasSuccessfulDelivery(dueBirthday.birthday.userId, dueBirthday.birthday.id, occurrenceDate)

    if (alreadySent) {
      continue
    }

    try {
      const message = await bot.api.sendMessage(
        dueBirthday.telegramChatId,
        formatBirthdayNotification(dueBirthday.birthday),
        {
          reply_markup: getBirthdayNotificationKeyboard(dueBirthday.birthday.id),
        },
      )

      await markDeliveryAttempt({
        userId: dueBirthday.birthday.userId,
        birthdayId: dueBirthday.birthday.id,
        occurrenceDate,
        status: DeliveryStatus.sent,
        telegramMessageId: String(message.message_id),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown scheduler error'

      await markDeliveryAttempt({
        userId: dueBirthday.birthday.userId,
        birthdayId: dueBirthday.birthday.id,
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
