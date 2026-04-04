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
    'Текущие настройки по умолчанию:',
    `• Часовой пояс: ${input.timezone}`,
    `• Время уведомления: ${input.notifyAt}`,
    '',
    'С чего начать:',
    '/menu — открыть главное меню',
    '/add — добавить день рождения',
    '/list — открыть список',
    '/upcoming — посмотреть ближайшие дни рождения',
  ].join('\n')
}
