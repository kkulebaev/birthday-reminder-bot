import { Bot } from 'grammy'
import { env } from './env.js'

export const notificationBot = new Bot(env.TELEGRAM_BOT_TOKEN)
