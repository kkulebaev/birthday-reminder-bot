import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import { bot } from './bot.js'
import { prisma } from './db.js'
import { deleteBirthdayJob } from './dkron-client.js'
import { formatBirthdayNotification, getBirthdayNotificationKeyboard } from './notification-format.js'
import { schedulerService } from './scheduler-service.js'
import { getSafeErrorMessage } from './telegram-api.js'
import { DeliveryStatus } from './generated/prisma/client.js'

function getWebhookPath(): string {
  return process.env.TELEGRAM_WEBHOOK_PATH ?? '/telegram/webhook'
}

function getInternalSecret(): string {
  const secret = process.env.INTERNAL_WEBHOOK_SECRET

  if (!secret) {
    throw new Error('INTERNAL_WEBHOOK_SECRET is required')
  }

  return secret
}

function getOccurrenceDateUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

async function recordDelivery(input: {
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
    where: { id: existing.id },
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

async function handleFireReminder(req: Request, res: Response): Promise<void> {
  const providedSecret = req.header('x-internal-auth')

  if (!providedSecret || providedSecret !== getInternalSecret()) {
    res.sendStatus(401)
    return
  }

  const birthdayId = typeof req.body?.birthdayId === 'string' ? req.body.birthdayId : null

  if (!birthdayId) {
    res.status(400).send('birthdayId is required')
    return
  }

  const birthday = await prisma.birthday.findUnique({
    where: { id: birthdayId },
    include: {
      user: {
        select: {
          telegramChatId: true,
          settings: { select: { notificationsEnabled: true } },
        },
      },
    },
  })

  if (!birthday) {
    await deleteBirthdayJob(birthdayId).catch(() => {})
    res.sendStatus(200)
    return
  }

  if (birthday.deletedAt || !birthday.isReminderEnabled || !birthday.user.settings?.notificationsEnabled) {
    await deleteBirthdayJob(birthdayId).catch(() => {})
    res.sendStatus(200)
    return
  }

  const occurrenceDate = getOccurrenceDateUtc(new Date())

  try {
    const message = await bot.api.sendMessage(
      birthday.user.telegramChatId,
      formatBirthdayNotification(birthday),
      { reply_markup: getBirthdayNotificationKeyboard(birthday.id) },
    )

    await recordDelivery({
      userId: birthday.userId,
      birthdayId: birthday.id,
      occurrenceDate,
      status: DeliveryStatus.sent,
      telegramMessageId: String(message.message_id),
    })

    res.sendStatus(200)
  } catch (error) {
    const errorMessage = getSafeErrorMessage(error)

    await recordDelivery({
      userId: birthday.userId,
      birthdayId: birthday.id,
      occurrenceDate,
      status: DeliveryStatus.failed,
      errorMessage,
    })

    console.error('Fire reminder failed:', errorMessage)
    res.sendStatus(500)
  }
}

function createApp() {
  const app = express()

  app.use(express.json())

  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).send('ok')
  })

  app.post(getWebhookPath(), async (req: Request, res: Response) => {
    try {
      await bot.handleUpdate(req.body)
      res.sendStatus(200)
    } catch (error) {
      console.error('Webhook handler error', getSafeErrorMessage(error))
      res.sendStatus(500)
    }
  })

  app.post('/internal/fire-reminder', (req, res) => {
    void handleFireReminder(req, res)
  })

  return app
}

export async function startServer(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000)
  const app = createApp()

  await bot.init()
  await schedulerService.start()

  await new Promise<void>((resolve) => {
    app.listen(port, '::', () => {
      console.log(`birthday-reminder-bot webhook server listening on [::]:${port}`)
      resolve()
    })
  })
}

void startServer().catch((error) => {
  console.error('Server startup error', getSafeErrorMessage(error))
  process.exitCode = 1
})
