import type { Api, InlineKeyboard } from 'grammy'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getErrorDescription(error: unknown): string | null {
  if (!isObject(error)) {
    return null
  }

  const description = error['description']

  return typeof description === 'string' ? description : null
}

export function isMessageNotModifiedError(error: unknown): boolean {
  if (error instanceof Error && error.message.includes('message is not modified')) {
    return true
  }

  const description = getErrorDescription(error)

  return description?.includes('message is not modified') ?? false
}

export async function safeEditMessageText(
  api: Api,
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboard,
): Promise<boolean> {
  try {
    if (replyMarkup) {
      await api.editMessageText(chatId, messageId, text, {
        reply_markup: replyMarkup,
      })
    } else {
      await api.editMessageText(chatId, messageId, text)
    }

    return true
  } catch (error) {
    if (isMessageNotModifiedError(error)) {
      return false
    }

    throw error
  }
}

export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message
  }

  return String(error)
}
