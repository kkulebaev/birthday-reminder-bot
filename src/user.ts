import type { Context } from 'grammy'
import { prisma } from './db.js'

function getChatId(ctx: Context): string {
  const chatId = ctx.chat?.id

  if (chatId === undefined) {
    throw new Error('Chat is missing in context')
  }

  return String(chatId)
}

export function isPrivateChat(ctx: Context): boolean {
  return ctx.chat?.type === 'private'
}

export async function upsertUserFromContext(ctx: Context) {
  const from = ctx.from

  if (!from) {
    throw new Error('Sender is missing in context')
  }

  return prisma.user.upsert({
    where: { telegramUserId: String(from.id) },
    update: {
      telegramChatId: getChatId(ctx),
      telegramUsername: from.username ?? null,
      telegramFirstName: from.first_name ?? null,
    },
    create: {
      telegramUserId: String(from.id),
      telegramChatId: getChatId(ctx),
      telegramUsername: from.username ?? null,
      telegramFirstName: from.first_name ?? null,
      settings: {
        create: {},
      },
    },
    include: {
      settings: true,
    },
  })
}
