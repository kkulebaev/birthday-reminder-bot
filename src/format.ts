type StartMessageInput = {
  firstName: string | null
  timezone: string
  notifyAt: string
}

export function formatStartMessage(input: StartMessageInput): string {
  const name = input.firstName?.trim() || 'друг'

  return [
    `Привет, ${name}.`,
    '',
    'Я помогу хранить дни рождения и присылать напоминания сюда же в Telegram.',
    '',
    'Текущие настройки по умолчанию:',
    `• timezone: ${input.timezone}`,
    `• notify_at: ${input.notifyAt}`,
    '',
    'Скоро здесь появятся команды для добавления, поиска и списка дней рождения.',
  ].join('\n')
}
