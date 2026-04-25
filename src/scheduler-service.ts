import {
  DeliveryStatus,
  ScheduledNotificationStatus,
  type Birthday,
  type ScheduledNotification,
} from '@prisma/client'
import { Bot } from 'grammy'
import { prisma } from './db.js'
import { formatBirthdayNotification, getBirthdayNotificationKeyboard } from './notification-format.js'
import {
  getEndOfOccurrenceDay,
  getNextOccurrenceDate,
  getNextOccurrenceDateAfter,
  getScheduledFor,
  isOccurrenceDayActive,
} from './notification-schedule.js'
import { getSafeErrorMessage } from './telegram-api.js'

const ACTIVE_NOTIFICATION_STATUSES = [
  ScheduledNotificationStatus.pending,
  ScheduledNotificationStatus.processing,
]

const READY_NOTIFICATION_STATUSES = [
  ScheduledNotificationStatus.pending,
]

const IMMEDIATE_RETRY_DELAYS_MS = [5000, 30000, 120000]
const FAILED_RECOVERY_DELAY_MS = 60 * 60 * 1000
const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000
const MAX_TOTAL_ATTEMPTS = 6
// Node.js uses a 32-bit signed integer for setTimeout delay values. Any value
// exceeding this limit (~24.8 days) causes a TimeoutOverflowWarning and the
// delay is clamped to 1ms. We cap the delay here so the timer fires safely and
// reschedules itself when it fires, eventually reaching the correct time.
const MAX_TIMEOUT_MS = Math.pow(2, 31) - 1

let notificationBot: Bot | null = null

type BirthdayWithUserSettings = Birthday & {
  user: {
    telegramChatId: string
    settings: {
      timezone: string
      notifyAt: string
      notificationsEnabled: boolean
    } | null
  }
}

type ScheduledNotificationWithBirthday = ScheduledNotification & {
  birthday: BirthdayWithUserSettings
}

function getNotificationBot(): Bot {
  if (notificationBot) {
    return notificationBot
  }

  const token = process.env.TELEGRAM_BOT_TOKEN

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required')
  }

  notificationBot = new Bot(token)

  return notificationBot
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getRecoveryTime(notification: ScheduledNotificationWithBirthday, now: Date): Date | null {
  if (notification.attemptCount >= MAX_TOTAL_ATTEMPTS) {
    return null
  }

  const endOfDay = getEndOfOccurrenceDay(notification.occurrenceDate, notification.timezone)

  if (now.getTime() >= endOfDay.getTime()) {
    return null
  }

  const candidate = new Date(now.getTime() + FAILED_RECOVERY_DELAY_MS)

  if (candidate.getTime() >= endOfDay.getTime()) {
    return null
  }

  return candidate
}

function shouldProcessNotificationStatus(status: ScheduledNotificationStatus): boolean {
  return status === ScheduledNotificationStatus.pending
}

async function createOrUpdateScheduledNotificationForOccurrence(input: {
  birthday: BirthdayWithUserSettings
  occurrenceDate: Date
}): Promise<void> {
  const settings = input.birthday.user.settings

  if (!settings) {
    return
  }

  const scheduledFor = getScheduledFor(input.occurrenceDate, settings.notifyAt, settings.timezone)

  const existing = await prisma.scheduledNotification.findUnique({
    where: {
      birthdayId_occurrenceDate: {
        birthdayId: input.birthday.id,
        occurrenceDate: input.occurrenceDate,
      },
    },
  })

  if (existing?.status === ScheduledNotificationStatus.sent) {
    return
  }

  const sharedData = {
    userId: input.birthday.userId,
    birthdayId: input.birthday.id,
    occurrenceDate: input.occurrenceDate,
    scheduledFor,
    timezone: settings.timezone,
    notifyAt: settings.notifyAt,
    status: ScheduledNotificationStatus.pending,
    lockedAt: null,
    sentAt: null,
    failedAt: null,
    canceledAt: null,
    errorMessage: null,
  }

  if (existing) {
    await prisma.scheduledNotification.update({
      where: { id: existing.id },
      data: {
        ...sharedData,
        attemptCount: 0,
      },
    })
    return
  }

  await prisma.scheduledNotification.create({
    data: {
      ...sharedData,
      attemptCount: 0,
    },
  })
}

async function createNextScheduledNotification(notification: ScheduledNotificationWithBirthday): Promise<void> {
  const settings = notification.birthday.user.settings

  if (!settings || !notification.birthday.isReminderEnabled || notification.birthday.deletedAt) {
    return
  }

  if (!settings.notificationsEnabled) {
    return
  }

  const nextOccurrenceDate = getNextOccurrenceDateAfter(notification.occurrenceDate, notification.birthday)

  await createOrUpdateScheduledNotificationForOccurrence({
    birthday: notification.birthday,
    occurrenceDate: nextOccurrenceDate,
  })
}

async function finalizeNotificationFailure(notification: ScheduledNotificationWithBirthday, errorMessage: string): Promise<void> {
  const now = new Date()
  const recoveryTime = getRecoveryTime(notification, now)

  if (recoveryTime) {
    await prisma.scheduledNotification.update({
      where: { id: notification.id },
      data: {
        status: ScheduledNotificationStatus.pending,
        failedAt: now,
        errorMessage,
        scheduledFor: recoveryTime,
        lockedAt: null,
      },
    })

    return
  }

  await prisma.scheduledNotification.update({
    where: { id: notification.id },
    data: {
      status: ScheduledNotificationStatus.failed,
      failedAt: now,
      errorMessage,
      lockedAt: null,
    },
  })

  await createNextScheduledNotification(notification)
}

async function markDeliveryAttempt(input: {
  userId: string
  birthdayId: string
  occurrenceDate: Date
  status: DeliveryStatus
  attemptCountIncrement?: number
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

  const attemptIncrement = input.attemptCountIncrement ?? 1

  if (!existing) {
    await prisma.deliveryLog.create({
      data: {
        userId: input.userId,
        birthdayId: input.birthdayId,
        notificationType: 'birthday',
        occurrenceDate: input.occurrenceDate,
        status: input.status,
        attemptCount: attemptIncrement,
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
      attemptCount: existing.attemptCount + attemptIncrement,
      lastAttemptAt: new Date(),
      sentAt: input.status === DeliveryStatus.sent ? new Date() : existing.sentAt,
      telegramMessageId: input.telegramMessageId ?? existing.telegramMessageId,
      errorMessage: input.errorMessage ?? null,
    },
  })
}

async function getBirthdayWithSettings(birthdayId: string): Promise<BirthdayWithUserSettings | null> {
  return prisma.birthday.findUnique({
    where: { id: birthdayId },
    include: {
      user: {
        select: {
          telegramChatId: true,
          settings: {
            select: {
              timezone: true,
              notifyAt: true,
              notificationsEnabled: true,
            },
          },
        },
      },
    },
  })
}

export class SchedulerService {
  private timer: ReturnType<typeof setTimeout> | null = null
  private started = false
  private processing = false
  private needsReschedule = false

  async start(): Promise<void> {
    if (this.started) {
      return
    }

    this.started = true

    await this.recoverStaleProcessing()
    await this.processDueNotifications()
  }

  async rebuildBirthdayNotification(birthdayId: string): Promise<void> {
    const birthday = await getBirthdayWithSettings(birthdayId)

    if (!birthday) {
      return
    }

    await this.cancelActiveNotificationsForBirthday(birthday.id)

    const settings = birthday.user.settings

    if (!settings || !settings.notificationsEnabled || !birthday.isReminderEnabled || birthday.deletedAt) {
      await this.refreshTimer()
      return
    }

    let occurrenceDate = getNextOccurrenceDate(birthday, settings.timezone, new Date())
    const sentForOccurrence = await prisma.scheduledNotification.findUnique({
      where: {
        birthdayId_occurrenceDate: {
          birthdayId: birthday.id,
          occurrenceDate,
        },
      },
      select: {
        status: true,
      },
    })

    if (sentForOccurrence?.status === ScheduledNotificationStatus.sent) {
      occurrenceDate = getNextOccurrenceDateAfter(occurrenceDate, birthday)
    }

    await createOrUpdateScheduledNotificationForOccurrence({
      birthday,
      occurrenceDate,
    })
    await this.refreshTimer()
  }

  async rebuildUserNotifications(userId: string): Promise<void> {
    const birthdays = await prisma.birthday.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    })

    for (const birthday of birthdays) {
      await this.rebuildBirthdayNotification(birthday.id)
    }

    await this.refreshTimer()
  }

  private async cancelActiveNotificationsForBirthday(birthdayId: string): Promise<void> {
    await prisma.scheduledNotification.updateMany({
      where: {
        birthdayId,
        status: {
          in: ACTIVE_NOTIFICATION_STATUSES,
        },
      },
      data: {
        status: ScheduledNotificationStatus.canceled,
        canceledAt: new Date(),
        lockedAt: null,
      },
    })
  }

  async refreshTimer(): Promise<void> {
    if (!this.started) {
      return
    }

    if (this.processing) {
      this.needsReschedule = true
      return
    }

    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    const nextNotification = await prisma.scheduledNotification.findFirst({
      where: {
        status: {
          in: READY_NOTIFICATION_STATUSES,
        },
      },
      orderBy: {
        scheduledFor: 'asc',
      },
    })

    if (!nextNotification) {
      return
    }

    const delayMs = nextNotification.scheduledFor.getTime() - Date.now()

    if (delayMs <= 0) {
      this.timer = setTimeout(() => {
        void this.processDueNotifications()
      }, 0)
      return
    }

    // Cap the delay to MAX_TIMEOUT_MS to avoid a TimeoutOverflowWarning from
    // Node.js when the next notification is more than ~24.8 days away. When the
    // capped timer fires, refreshTimer() is called again and will reschedule
    // with the remaining delay until the notification is actually due.
    const safeDelayMs = Math.min(delayMs, MAX_TIMEOUT_MS)

    this.timer = setTimeout(() => {
      void this.processDueNotifications()
    }, safeDelayMs)
  }

  private async recoverStaleProcessing(): Promise<void> {
    const staleBefore = new Date(Date.now() - PROCESSING_TIMEOUT_MS)
    const staleNotifications = await prisma.scheduledNotification.findMany({
      where: {
        status: ScheduledNotificationStatus.processing,
        lockedAt: {
          not: null,
          lt: staleBefore,
        },
      },
    })

    for (const notification of staleNotifications) {
      await prisma.scheduledNotification.update({
        where: { id: notification.id },
        data: {
          status: ScheduledNotificationStatus.pending,
          failedAt: new Date(),
          errorMessage: 'Processing lock expired',
          lockedAt: null,
          scheduledFor: new Date(),
        },
      })
    }
  }

  async processDueNotifications(): Promise<void> {
    if (!this.started) {
      return
    }

    if (this.processing) {
      this.needsReschedule = true
      return
    }

    this.processing = true

    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    try {
      do {
        this.needsReschedule = false

        const dueNotifications = await prisma.scheduledNotification.findMany({
          where: {
            status: {
              in: READY_NOTIFICATION_STATUSES,
            },
            scheduledFor: {
              lte: new Date(),
            },
          },
          include: {
            birthday: {
              include: {
                user: {
                  select: {
                    telegramChatId: true,
                    settings: {
                      select: {
                        timezone: true,
                        notifyAt: true,
                        notificationsEnabled: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: {
            scheduledFor: 'asc',
          },
        })

        for (const notification of dueNotifications) {
          if (!shouldProcessNotificationStatus(notification.status)) {
            continue
          }

          await this.processNotification(notification)
        }
      } while (this.needsReschedule)
    } finally {
      this.processing = false
      await this.refreshTimer()
    }
  }

  private async processNotification(notification: ScheduledNotificationWithBirthday): Promise<void> {
    const birthday = notification.birthday
    const settings = birthday.user.settings
    const now = new Date()

    if (!settings || !settings.notificationsEnabled || !birthday.isReminderEnabled || birthday.deletedAt) {
      await prisma.scheduledNotification.update({
        where: { id: notification.id },
        data: {
          status: ScheduledNotificationStatus.canceled,
          canceledAt: now,
          lockedAt: null,
        },
      })
      return
    }

    if (!isOccurrenceDayActive(notification.occurrenceDate, notification.timezone, now)) {
      await finalizeNotificationFailure(notification, 'Occurrence day already ended')
      return
    }

    const claimed = await prisma.scheduledNotification.updateMany({
      where: {
        id: notification.id,
        status: notification.status,
      },
      data: {
        status: ScheduledNotificationStatus.processing,
        lockedAt: now,
      },
    })

    if (claimed.count === 0) {
      return
    }

    let lastErrorMessage = 'Unknown scheduler error'
    let attemptsMade = 0

    for (let attemptIndex = 0; attemptIndex < IMMEDIATE_RETRY_DELAYS_MS.length; attemptIndex += 1) {
      attemptsMade += 1

      try {
        const message = await getNotificationBot().api.sendMessage(
          birthday.user.telegramChatId,
          formatBirthdayNotification(birthday),
          {
            reply_markup: getBirthdayNotificationKeyboard(birthday.id),
          },
        )

        const sentAt = new Date()
        await prisma.scheduledNotification.update({
          where: { id: notification.id },
          data: {
            status: ScheduledNotificationStatus.sent,
            sentAt,
            lockedAt: null,
            errorMessage: null,
            attemptCount: {
              increment: attemptsMade,
            },
          },
        })
        await markDeliveryAttempt({
          userId: notification.userId,
          birthdayId: notification.birthdayId,
          occurrenceDate: notification.occurrenceDate,
          status: DeliveryStatus.sent,
          attemptCountIncrement: attemptsMade,
          telegramMessageId: String(message.message_id),
        })
        await createNextScheduledNotification(notification)
        return
      } catch (error) {
        lastErrorMessage = getSafeErrorMessage(error)

        if (attemptIndex < IMMEDIATE_RETRY_DELAYS_MS.length - 1) {
          const delayMs = IMMEDIATE_RETRY_DELAYS_MS[attemptIndex]

          if (delayMs !== undefined) {
            await delay(delayMs)
          }
        }
      }
    }

    await prisma.scheduledNotification.update({
      where: { id: notification.id },
      data: {
        attemptCount: {
          increment: attemptsMade,
        },
      },
    })
    await markDeliveryAttempt({
      userId: notification.userId,
      birthdayId: notification.birthdayId,
      occurrenceDate: notification.occurrenceDate,
      status: DeliveryStatus.failed,
      attemptCountIncrement: attemptsMade,
      errorMessage: lastErrorMessage,
    })
    await finalizeNotificationFailure(
      {
        ...notification,
        attemptCount: notification.attemptCount + attemptsMade,
      },
      lastErrorMessage,
    )
  }
}

export const schedulerService = new SchedulerService()
