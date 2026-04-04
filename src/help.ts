export function formatHelpMessage(): string {
  return [
    'Команды:',
    '/start — создать или обновить профиль',
    '/help — показать справку',
    '/add — начать добавление дня рождения',
    '/ping — проверить, что бот жив',
    '/cancel — отменить текущий wizard',
  ].join('\n')
}
