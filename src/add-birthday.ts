import type { Context } from 'grammy'

const addBirthdayState = new Set<string>()

function getUserKey(ctx: Context): string {
  const from = ctx.from

  if (!from) {
    throw new Error('Sender is missing in context')
  }

  return String(from.id)
}

export function beginAddBirthdayFlow(ctx: Context): string {
  const userKey = getUserKey(ctx)
  addBirthdayState.add(userKey)

  return [
    'Давай добавим день рождения.',
    '',
    'Шаг 1 из 4: отправь Full Name.',
    'Например: Иван Иванов',
  ].join('\n')
}

export function isAddBirthdayFlowActive(ctx: Context): boolean {
  return addBirthdayState.has(getUserKey(ctx))
}

export function cancelAddBirthdayFlow(ctx: Context): boolean {
  return addBirthdayState.delete(getUserKey(ctx))
}

export function handleAddBirthdayText(ctx: Context, text: string): string {
  const fullName = text.trim()

  if (!fullName) {
    return 'Не вижу имени. Отправь Full Name текстом.'
  }

  addBirthdayState.delete(getUserKey(ctx))

  return [
    `Принял Full Name: ${fullName}`,
    '',
    'Это пока каркас wizard flow.',
    'Следующим шагом добавим выбор дня, месяца, года и заметки.',
  ].join('\n')
}
