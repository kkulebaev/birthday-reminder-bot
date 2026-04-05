import { InlineKeyboard, type Context } from 'grammy'
import { prisma } from './db.js'

export type SettingsEditMode = 'timezone' | 'notifyAt'

type SettingsSession = {
  mode: SettingsEditMode
}

type UserSettingsRecord = {
  timezone: string
  notifyAt: string
  notificationsEnabled: boolean
}

export type SettingsEditResult =
  | { kind: 'missing'; message: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'updated'; message: string }

export const TIMEZONE_PRESETS = [
  { label: '🌍 UTC', value: 'UTC' },
  { label: '🇷🇺 Moscow', value: 'Europe/Moscow' },
  { label: '🇬🇪 Tbilisi', value: 'Asia/Tbilisi' },
  { label: '🇩🇪 Berlin', value: 'Europe/Berlin' },
  { label: '🇦🇪 Dubai', value: 'Asia/Dubai' },
  { label: '🇺🇸 New York', value: 'America/New_York' },
] as const

const sessions = new Map<string, SettingsSession>()

function getUserKey(ctx: Context): string {
  const from = ctx.from

  if (!from) {
    throw new Error('Sender is missing in context')
  }

  return String(from.id)
}

function formatNotificationsEnabled(value: boolean): string {
  return value ? 'включены' : 'выключены'
}

function getNotificationsToggleText(value: boolean): string {
  return value ? '🔕 Выключить уведомления' : '🔔 Включить уведомления'
}

export function formatSettingsText(settings: UserSettingsRecord): string {
  return [
    '⚙️ Настройки',
    '',
    'Текущие параметры уведомлений:',
    '',
    `Часовой пояс: ${settings.timezone}`,
    `Время уведомления: ${settings.notifyAt}`,
    `Уведомления: ${formatNotificationsEnabled(settings.notificationsEnabled)}`,
    '',
    'Можешь изменить их кнопками ниже или отправить новое значение после выбора пункта.',
  ].join('\n')
}

export function getSettingsKeyboard(settings: UserSettingsRecord): InlineKeyboard {
  return new InlineKeyboard()
    .text('🌍 Часовой пояс', 'settings:edit-timezone')
    .text('⏰ Время уведомления', 'settings:edit-notifyAt')
    .row()
    .text('🕘 09:00', 'settings:preset-notifyAt:09:00')
    .text('🕛 12:00', 'settings:preset-notifyAt:12:00')
    .text('🕕 18:00', 'settings:preset-notifyAt:18:00')
    .row()
    .text(getNotificationsToggleText(settings.notificationsEnabled), 'settings:toggle-notifications')
    .row()
    .text('🏠 Главное меню', 'menu:home')
}

export function getTimezonePickerKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  TIMEZONE_PRESETS.forEach((preset, index) => {
    keyboard.text(preset.label, `settings:preset-timezone:${preset.value}`)

    if (index % 2 === 1 && index !== TIMEZONE_PRESETS.length - 1) {
      keyboard.row()
    }
  })

  return keyboard
    .row()
    .text('✍️ Ввести вручную', 'settings:edit-timezone-manual')
    .row()
    .text('⚙️ Назад к настройкам', 'menu:settings')
}

async function getUserSettings(userId: string): Promise<UserSettingsRecord | null> {
  return prisma.userSettings.findUnique({
    where: { userId },
    select: {
      timezone: true,
      notifyAt: true,
      notificationsEnabled: true,
    },
  })
}

export async function getSettingsMessage(userId: string): Promise<{ text: string; replyMarkup: InlineKeyboard }> {
  const settings = await getUserSettings(userId)

  if (!settings) {
    throw new Error('User settings not found')
  }

  return {
    text: formatSettingsText(settings),
    replyMarkup: getSettingsKeyboard(settings),
  }
}

export function getTimezonePickerText(): string {
  return [
    'Выбери часовой пояс ниже.',
    '',
    'Если нужного варианта нет, нажми «Ввести вручную».',
  ].join('\n')
}

export function beginSettingsEdit(ctx: Context, mode: SettingsEditMode): string {
  sessions.set(getUserKey(ctx), { mode })

  if (mode === 'timezone') {
    return [
      'Отправь часовой пояс одним сообщением.',
      'Формат: Region/City',
      'Примеры: UTC, Europe/Moscow, Asia/Tbilisi',
      'Если не знаешь точное название, возьми его из списка tz database:',
      'https://en.wikipedia.org/wiki/List_of_tz_database_time_zones',
    ].join('\n')
  }

  return [
    'Отправь новое время уведомления одним сообщением.',
    'Формат: HH:MM, например 09:00',
  ].join('\n')
}

export function hasSettingsEditSession(ctx: Context): boolean {
  return sessions.has(getUserKey(ctx))
}

export function cancelSettingsEdit(ctx: Context): boolean {
  return sessions.delete(getUserKey(ctx))
}

export function isValidNotifyTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim())
}

export function isValidTimezone(value: string): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: value.trim() })

    return formatter.resolvedOptions().timeZone.length > 0
  } catch {
    return false
  }
}

export async function toggleNotificationsEnabled(userId: string): Promise<string> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      notificationsEnabled: true,
    },
  })

  if (!settings) {
    throw new Error('User settings not found')
  }

  const updated = await prisma.userSettings.update({
    where: { userId },
    data: {
      notificationsEnabled: !settings.notificationsEnabled,
    },
    select: {
      notificationsEnabled: true,
    },
  })

  return updated.notificationsEnabled ? 'Уведомления включены.' : 'Уведомления выключены.'
}

export async function setNotifyTimePreset(userId: string, notifyAt: string): Promise<string> {
  if (!isValidNotifyTime(notifyAt)) {
    throw new Error('Invalid notify time preset')
  }

  await prisma.userSettings.update({
    where: { userId },
    data: { notifyAt },
  })

  return `Готово, время уведомления теперь ${notifyAt}.`
}

export async function setTimezonePreset(userId: string, timezone: string): Promise<string> {
  if (!isValidTimezone(timezone)) {
    throw new Error('Invalid timezone preset')
  }

  await prisma.userSettings.update({
    where: { userId },
    data: { timezone },
  })

  return `Готово, часовой пояс теперь ${timezone}.`
}

export async function handleSettingsEditText(ctx: Context, userId: string, text: string): Promise<SettingsEditResult> {
  const session = sessions.get(getUserKey(ctx))

  if (!session) {
    return { kind: 'missing', message: 'Сейчас нечего менять в настройках.' }
  }

  const value = text.trim()

  if (session.mode === 'timezone') {
    if (!isValidTimezone(value)) {
      return {
        kind: 'invalid',
        message: [
          'Не похоже на корректный часовой пояс.',
          'Используй формат Region/City, например Europe/Moscow или Asia/Tbilisi.',
          'Если не знаешь точное название, посмотри список tz database:',
          'https://en.wikipedia.org/wiki/List_of_tz_database_time_zones',
        ].join('\n'),
      }
    }

    await prisma.userSettings.update({
      where: { userId },
      data: { timezone: value },
    })

    sessions.delete(getUserKey(ctx))
    return { kind: 'updated', message: 'Готово, часовой пояс обновил.' }
  }

  if (!isValidNotifyTime(value)) {
    return { kind: 'invalid', message: 'Время должно быть в формате HH:MM, например 09:00.' }
  }

  await prisma.userSettings.update({
    where: { userId },
    data: { notifyAt: value },
  })

  sessions.delete(getUserKey(ctx))
  return { kind: 'updated', message: 'Готово, время уведомления обновил.' }
}
