import { prisma } from './db.js'
import { deleteBirthdayJob, pingDkron, upsertBirthdayJob } from './dkron-client.js'

const FIRE_REMINDER_PATH = '/internal/fire-reminder'

type ReminderTarget = {
  id: string
  month: number
  day: number
  isReminderEnabled: boolean
  deletedAt: Date | null
  user: {
    settings: {
      timezone: string
      notifyAt: string
      notificationsEnabled: boolean
    } | null
  }
}

function getInternalWebhookUrl(): string {
  const override = process.env.BOT_INTERNAL_URL

  if (override) {
    return `${override.replace(/\/+$/, '')}${FIRE_REMINDER_PATH}`
  }

  const host = process.env.RAILWAY_PRIVATE_DOMAIN

  if (!host) {
    throw new Error('BOT_INTERNAL_URL or RAILWAY_PRIVATE_DOMAIN must be set')
  }

  const port = process.env.PORT ?? '3000'

  return `http://${host}:${port}${FIRE_REMINDER_PATH}`
}

function getInternalWebhookSecret(): string {
  const secret = process.env.INTERNAL_WEBHOOK_SECRET

  if (!secret) {
    throw new Error('INTERNAL_WEBHOOK_SECRET is required')
  }

  return secret
}

function shouldHaveJob(target: Pick<ReminderTarget, 'isReminderEnabled' | 'deletedAt' | 'user'>): boolean {
  if (!target.user.settings) {
    return false
  }

  if (!target.user.settings.notificationsEnabled) {
    return false
  }

  if (!target.isReminderEnabled) {
    return false
  }

  if (target.deletedAt) {
    return false
  }

  return true
}

async function loadReminderTarget(birthdayId: string): Promise<ReminderTarget | null> {
  return prisma.birthday.findUnique({
    where: { id: birthdayId },
    select: {
      id: true,
      month: true,
      day: true,
      isReminderEnabled: true,
      deletedAt: true,
      user: {
        select: {
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
  async start(): Promise<void> {
    const reachable = await pingDkron()

    if (!reachable) {
      console.warn('Dkron is not reachable — skipping startup rebuild')
      return
    }

    await this.rebuildAllActiveBirthdays()
  }

  async rebuildBirthdayNotification(birthdayId: string): Promise<void> {
    const target = await loadReminderTarget(birthdayId)

    if (!target) {
      await deleteBirthdayJob(birthdayId)
      return
    }

    if (!shouldHaveJob(target)) {
      await deleteBirthdayJob(birthdayId)
      return
    }

    const settings = target.user.settings

    if (!settings) {
      await deleteBirthdayJob(birthdayId)
      return
    }

    await upsertBirthdayJob({
      birthdayId: target.id,
      month: target.month,
      day: target.day,
      notifyAt: settings.notifyAt,
      timezone: settings.timezone,
      webhookUrl: getInternalWebhookUrl(),
      webhookSecret: getInternalWebhookSecret(),
    })
  }

  async rebuildUserNotifications(userId: string): Promise<void> {
    const birthdays = await prisma.birthday.findMany({
      where: { userId },
      select: { id: true },
    })

    for (const birthday of birthdays) {
      await this.rebuildBirthdayNotification(birthday.id)
    }
  }

  async rebuildAllActiveBirthdays(): Promise<void> {
    const birthdays = await prisma.birthday.findMany({
      where: {
        deletedAt: null,
        isReminderEnabled: true,
        user: {
          settings: { notificationsEnabled: true },
        },
      },
      select: { id: true },
    })

    for (const birthday of birthdays) {
      try {
        await this.rebuildBirthdayNotification(birthday.id)
      } catch (error) {
        console.error(`Failed to rebuild birthday job ${birthday.id}:`, error)
      }
    }
  }
}

export const schedulerService = new SchedulerService()
