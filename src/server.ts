import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import { bot } from './bot.js'

function getWebhookPath(): string {
  return process.env.TELEGRAM_WEBHOOK_PATH ?? '/telegram/webhook'
}

function getBaseUrl(): string | null {
  const explicitUrl = process.env.APP_BASE_URL?.trim()

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, '')
  }

  return null
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
      console.error('Webhook handler error', error)
      res.sendStatus(500)
    }
  })

  return app
}

export async function startServer(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000)
  const app = createApp()

  await bot.init()

  const baseUrl = getBaseUrl()

  if (baseUrl) {
    await bot.api.setWebhook(`${baseUrl}${getWebhookPath()}`)
  }

  await new Promise<void>((resolve) => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`birthday-reminder-bot webhook server listening on 0.0.0.0:${port}`)
      resolve()
    })
  })
}

void startServer().catch((error) => {
  console.error('Server startup error', error)
  process.exitCode = 1
})
