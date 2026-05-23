import { prisma } from './db.js'
import { deleteBirthdayJob, pingDkron, upsertBirthdayJob } from './dkron-client.js'
import { env } from './env.js'
import { reapStaleSessions } from './wizard-session.js'

const FIRE_REMINDER_PATH = '/internal/fire-reminder'

type ReminderTarget = {
  id: string
  fullName: string
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
  if (env.BOT_INTERNAL_URL) {
    return `${env.BOT_INTERNAL_URL.replace(/\/+$/, '')}${FIRE_REMINDER_PATH}`
  }

  if (!env.RAILWAY_PRIVATE_DOMAIN) {
    throw new Error('BOT_INTERNAL_URL or RAILWAY_PRIVATE_DOMAIN must be set')
  }

  return `http://${env.RAILWAY_PRIVATE_DOMAIN}:${env.PORT}${FIRE_REMINDER_PATH}`
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
      fullName: true,
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
    await reapStaleSessions(60)

    const reachable = await this.waitForDkron()

    if (!reachable) {
      console.warn('Dkron is not reachable — skipping startup rebuild')
      return
    }

    await this.rebuildAllActiveBirthdays()
  }

  private async waitForDkron(attempts = 10, delayMs = 2000): Promise<boolean> {
    // Railway private networking is not ready the instant the container boots,
    // so an immediate dkron ping can fail with a transient "fetch failed".
    // Retry for a short window before giving up on the startup rebuild.
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (await pingDkron()) {
        return true
      }

      if (attempt < attempts) {
        console.warn(`Dkron not reachable yet (attempt ${attempt}/${attempts}); retrying in ${delayMs}ms`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    return false
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
      fullName: target.fullName,
      month: target.month,
      day: target.day,
      notifyAt: settings.notifyAt,
      timezone: settings.timezone,
      webhookUrl: getInternalWebhookUrl(),
      webhookSecret: env.INTERNAL_WEBHOOK_SECRET,
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
