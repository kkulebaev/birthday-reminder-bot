export function formatHelpMessage(): string {
  return [
    'Команды:',
    '/start — создать или обновить профиль',
    '/help — показать справку',
    '/add — начать добавление дня рождения',
    '/list — показать первые 10 записей',
    '/search <name> — найти записи по имени',
    '/view <name> — показать одну запись',
    '/note <name> | <text> — обновить заметку',
    '/toggle <name> — включить или выключить напоминания',
    '/rename <name> | <new name> — обновить имя',
    '/setdate <name> | <DD.MM or DD.MM.YYYY> — обновить дату',
    '/delete <name> — soft delete записи',
    '/test_notification — проверить доставку уведомлений',
    '/ping — проверить, что бот жив',
    '/cancel — отменить текущее действие',
    '',
    'Подсказка: часть действий доступна и через inline-кнопки в карточке записи.',
  ].join('\n')
}
