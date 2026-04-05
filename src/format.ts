type StartMessageInput = {
  firstName: string | null
  timezone: string
  notifyAt: string
}

export function formatStartMessage(input: StartMessageInput): string {
  const name = input.firstName?.trim() || 'друг'

  return [
    `Привет, ${name} ✨`,
    '',
    'Я Birthday Reminder Bot — Lumen. Помогу хранить дни рождения и вовремя присылать напоминания сюда же в Telegram.',
    '',
    'Начни с /menu — там основные действия.',
    '',
    'Текущие настройки по умолчанию:',
    `• Часовой пояс: ${input.timezone}`,
    `• Время уведомления: ${input.notifyAt}`,
  ].join('\n')
}
