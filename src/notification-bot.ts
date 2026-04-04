import 'dotenv/config'
import { Bot } from 'grammy'

const token = process.env.TELEGRAM_BOT_TOKEN

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required')
}

export const notificationBot = new Bot(token)
