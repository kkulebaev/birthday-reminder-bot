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
    'Я помогу хранить дни рождения и присылать напоминания сюда же в Telegram.',
    '',
    'Начни с /menu — там основные действия.',
    '',
    'Текущие настройки по умолчанию:',
    `• Часовой пояс: ${input.timezone}`,
    `• Время уведомления: ${input.notifyAt}`,
  ].join('\n')
}
