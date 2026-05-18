import type { Birthday } from './generated/prisma/client.js'
import { InlineKeyboard, type Context } from 'grammy'
import { prisma } from './db.js'
import { schedulerService } from './scheduler-service.js'
import { upsertUserFromContext } from './user.js'
import {
  clearSession,
  getTelegramUserKey,
  loadSessionPayload,
  upsertSession,
  WizardKind,
} from './wizard-session.js'

export type AddBirthdayDraft = {
  fullName?: string
  day?: number
  month?: number
  birthYear?: number | null
  notes?: string | null
}

export type AddBirthdayStep = 'fullName' | 'day' | 'month' | 'birthYear' | 'notes'

export type AddBirthdaySession = {
  step: AddBirthdayStep
  history: AddBirthdayStep[]
  draft: AddBirthdayDraft
}

type AddBirthdayTextResult = {
  text: string
  completed: boolean
  birthdayId?: string
}

type BackResult = {
  text: string
  exited: boolean
}

export const monthLabels = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

async function loadAddBirthdaySession(ctx: Context): Promise<AddBirthdaySession | null> {
  return loadSessionPayload<AddBirthdaySession>(getTelegramUserKey(ctx), WizardKind.add_birthday)
}

async function saveAddBirthdaySession(ctx: Context, session: AddBirthdaySession): Promise<void> {
  await upsertSession(getTelegramUserKey(ctx), WizardKind.add_birthday, session)
}

async function deleteAddBirthdaySession(ctx: Context): Promise<boolean> {
  return clearSession(getTelegramUserKey(ctx), WizardKind.add_birthday)
}

export function parseInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null
  }

  return Number(value)
}

export function validateDay(value: number): boolean {
  return value >= 1 && value <= 31
}

export function validateMonth(value: number): boolean {
  return value >= 1 && value <= 12
}

export function isLeapDayBirthday(day: number, month: number): boolean {
  return day === 29 && month === 2
}

export const LEAP_DAY_REJECTION_MESSAGE = 'Извини, 29 февраля как день рождения не поддерживается. Выбери 28 февраля или 1 марта.'

export function validateBirthYear(value: number): boolean {
  return value >= 1900 && value <= 2100
}

export function isSkipValue(value: string): boolean {
  const normalized = value.trim().toLowerCase()

  return normalized === 'skip'
    || normalized === 'пропустить'
    || normalized === 'без года'
    || normalized === 'без заметки'
    || normalized === 'нет'
}

function formatDatePreview(draft: AddBirthdayDraft): string {
  const day = draft.day ? String(draft.day).padStart(2, '0') : '—'
  const month = draft.month ? String(draft.month).padStart(2, '0') : '—'
  const year = draft.birthYear ? `.${draft.birthYear}` : ''

  return `${day}.${month}${year}`
}

function formatDraftProgress(draft: AddBirthdayDraft): string {
  return [
    `Имя: ${draft.fullName ?? '—'}`,
    `Дата: ${formatDatePreview(draft)}`,
    `Заметка: ${draft.notes ?? '—'}`,
  ].join('\n')
}

function formatBirthdayCreatedMessage(birthday: Birthday): string {
  const month = String(birthday.month).padStart(2, '0')
  const day = String(birthday.day).padStart(2, '0')
  const year = birthday.birthYear ? `.${birthday.birthYear}` : ''
  const notes = birthday.notes ? `\nЗаметка: ${birthday.notes}` : ''

  return [
    `Готово, сохранил день рождения для ${birthday.fullName}.`,
    '',
    `Дата: ${day}.${month}${year}`,
    notes ? `Заметка: ${birthday.notes}` : 'Заметка: —',
  ].join('\n')
}

function getBaseBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('← Назад', 'birthday:add:back')
}

function getMonthKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard()

  monthLabels.forEach((label, index) => {
    keyboard.text(label, `birthday:add:month:${index + 1}`)

    if ((index + 1) % 3 === 0 && index !== monthLabels.length - 1) {
      keyboard.row()
    }
  })

  keyboard.row().text('← Назад', 'birthday:add:back')

  return keyboard
}

function getStepLabel(step: AddBirthdayStep): string {
  if (step === 'fullName') {
    return 'Шаг 1 из 5'
  }

  if (step === 'day') {
    return 'Шаг 2 из 5'
  }

  if (step === 'month') {
    return 'Шаг 3 из 5'
  }

  if (step === 'birthYear') {
    return 'Шаг 4 из 5'
  }

  return 'Шаг 5 из 5'
}

function formatCurrentValue(step: AddBirthdayStep, draft: AddBirthdayDraft): string | null {
  if (step === 'fullName') {
    return draft.fullName ?? null
  }

  if (step === 'day') {
    return draft.day === undefined ? null : String(draft.day)
  }

  if (step === 'month') {
    if (draft.month === undefined) {
      return null
    }

    return monthLabels[draft.month - 1] ?? String(draft.month)
  }

  if (step === 'birthYear') {
    if (draft.birthYear === undefined) {
      return null
    }

    return draft.birthYear === null ? 'без года' : String(draft.birthYear)
  }

  if (draft.notes === undefined) {
    return null
  }

  return draft.notes === null ? 'без заметки' : draft.notes
}

function formatCurrentValueLine(step: AddBirthdayStep, draft: AddBirthdayDraft): string | null {
  const currentValue = formatCurrentValue(step, draft)

  return currentValue ? `Сейчас: ${currentValue}` : null
}

function renderAddBirthdayStep(session: AddBirthdaySession): string {
  const currentValueLine = formatCurrentValueLine(session.step, session.draft)

  if (session.step === 'fullName') {
    return [
      'Давай добавим день рождения.',
      '',
      `${getStepLabel(session.step)}: как зовут человека?`,
      'Например: Иван Иванов',
      ...(currentValueLine ? ['', currentValueLine] : []),
    ].join('\n')
  }

  if (session.step === 'day') {
    return [
      `${getStepLabel(session.step)}: какого числа день рождения?`,
      'Отправь число от 1 до 31.',
      ...(currentValueLine ? ['', currentValueLine] : []),
      '',
      formatDraftProgress(session.draft),
    ].join('\n')
  }

  if (session.step === 'month') {
    return [
      `${getStepLabel(session.step)}: выбери месяц кнопкой ниже.`,
      'Если удобнее, можешь отправить номер месяца числом от 1 до 12.',
      ...(currentValueLine ? ['', currentValueLine] : []),
      '',
      formatDraftProgress(session.draft),
    ].join('\n')
  }

  if (session.step === 'birthYear') {
    return [
      `${getStepLabel(session.step)}: укажи год рождения или нажми «Пропустить».`,
      ...(currentValueLine ? ['', currentValueLine] : []),
      '',
      formatDraftProgress(session.draft),
    ].join('\n')
  }

  return [
    `${getStepLabel(session.step)}: добавь заметку или нажми «Пропустить».`,
    'Например: коллега с прошлой работы, любит звонки, поздравить утром.',
    ...(currentValueLine ? ['', currentValueLine] : []),
    '',
    formatDraftProgress(session.draft),
  ].join('\n')
}

async function moveToStep(
  ctx: Context,
  currentSession: AddBirthdaySession,
  nextStep: AddBirthdayStep,
  nextDraft: AddBirthdayDraft,
): Promise<string> {
  const nextSession: AddBirthdaySession = {
    step: nextStep,
    history: [...currentSession.history, currentSession.step],
    draft: nextDraft,
  }

  await saveAddBirthdaySession(ctx, nextSession)

  return renderAddBirthdayStep(nextSession)
}

export function getAddBirthdaySuccessKeyboard(birthdayId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('➕ Добавить ещё', 'menu:add')
    .text('🎂 Открыть карточку', `birthday:view:${birthdayId}`)
    .row()
    .text('🎈 Ближайшие', 'menu:upcoming')
    .text('🏠 Главное меню', 'menu:home')
}

export async function beginAddBirthdayFlow(ctx: Context): Promise<string> {
  const session: AddBirthdaySession = {
    step: 'fullName',
    history: [],
    draft: {},
  }

  await saveAddBirthdaySession(ctx, session)

  return renderAddBirthdayStep(session)
}

export async function isAddBirthdayFlowActive(ctx: Context): Promise<boolean> {
  const session = await loadAddBirthdaySession(ctx)
  return session !== null
}

export async function cancelAddBirthdayFlow(ctx: Context): Promise<boolean> {
  return deleteAddBirthdaySession(ctx)
}

export async function getAddBirthdayOptionalKeyboard(ctx: Context): Promise<InlineKeyboard | null> {
  const session = await loadAddBirthdaySession(ctx)

  if (!session) {
    return null
  }

  if (session.step === 'month') {
    return getMonthKeyboard()
  }

  if (session.step === 'birthYear' || session.step === 'notes') {
    return new InlineKeyboard()
      .text('Пропустить', 'birthday:add:skip')
      .row()
      .text('← Назад', 'birthday:add:back')
  }

  return getBaseBackKeyboard()
}

export async function canSkipAddBirthdayStep(ctx: Context): Promise<boolean> {
  const session = await loadAddBirthdaySession(ctx)

  return session?.step === 'birthYear' || session?.step === 'notes'
}

export async function canPickAddBirthdayMonth(ctx: Context): Promise<boolean> {
  const session = await loadAddBirthdaySession(ctx)

  return session?.step === 'month'
}

async function finishAddBirthdayFlow(
  ctx: Context,
  session: AddBirthdaySession,
  draftOverride?: AddBirthdayDraft,
): Promise<{ text: string; birthdayId: string }> {
  const user = await upsertUserFromContext(ctx)
  const draft = draftOverride ?? session.draft

  if (!draft.fullName || draft.day === undefined || draft.month === undefined) {
    await deleteAddBirthdaySession(ctx)
    throw new Error('Birthday draft is incomplete')
  }

  const birthday = await prisma.birthday.create({
    data: {
      userId: user.id,
      fullName: draft.fullName,
      day: draft.day,
      month: draft.month,
      birthYear: draft.birthYear ?? null,
      notes: draft.notes ?? null,
    },
  })

  await schedulerService.rebuildBirthdayNotification(birthday.id)
  await deleteAddBirthdaySession(ctx)

  return {
    text: formatBirthdayCreatedMessage(birthday),
    birthdayId: birthday.id,
  }
}

export async function skipAddBirthdayStep(ctx: Context): Promise<AddBirthdayTextResult> {
  const session = await loadAddBirthdaySession(ctx)

  if (!session) {
    return {
      text: 'Сейчас нечего пропускать.',
      completed: false,
    }
  }

  if (session.step === 'birthYear') {
    const updatedDraft = {
      ...session.draft,
      birthYear: null,
    }

    return {
      text: await moveToStep(ctx, session, 'notes', updatedDraft),
      completed: false,
    }
  }

  if (session.step === 'notes') {
    const result = await finishAddBirthdayFlow(ctx, session, {
      ...session.draft,
      notes: null,
    })

    return {
      text: result.text,
      completed: true,
      birthdayId: result.birthdayId,
    }
  }

  return {
    text: 'Сейчас этот шаг нельзя пропустить.',
    completed: false,
  }
}

export async function selectAddBirthdayMonth(ctx: Context, month: number): Promise<string> {
  const session = await loadAddBirthdaySession(ctx)

  if (!session || session.step !== 'month') {
    return 'Сейчас месяц выбрать нельзя.'
  }

  if (!validateMonth(month)) {
    return 'Месяц должен быть от 1 до 12.'
  }

  if (session.draft.day !== undefined && isLeapDayBirthday(session.draft.day, month)) {
    return LEAP_DAY_REJECTION_MESSAGE
  }

  const updatedDraft = {
    ...session.draft,
    month,
  }

  return moveToStep(ctx, session, 'birthYear', updatedDraft)
}

export async function goBackAddBirthdayStep(ctx: Context): Promise<BackResult> {
  const session = await loadAddBirthdaySession(ctx)

  if (!session) {
    return {
      text: 'Сейчас возвращаться некуда.',
      exited: false,
    }
  }

  const previousStep = session.history.at(-1)

  if (!previousStep) {
    await deleteAddBirthdaySession(ctx)

    return {
      text: 'Возвращаю в главное меню.',
      exited: true,
    }
  }

  const previousSession: AddBirthdaySession = {
    step: previousStep,
    history: session.history.slice(0, -1),
    draft: session.draft,
  }

  await saveAddBirthdaySession(ctx, previousSession)

  return {
    text: renderAddBirthdayStep(previousSession),
    exited: false,
  }
}

export async function handleAddBirthdayText(
  ctx: Context,
  text: string,
): Promise<AddBirthdayTextResult> {
  const session = await loadAddBirthdaySession(ctx)

  if (!session) {
    return {
      text: 'Сейчас добавление не активно.',
      completed: false,
    }
  }

  if (session.step === 'fullName') {
    const fullName = text.trim()

    if (!fullName) {
      return {
        text: 'Не вижу имени. Напиши имя человека одним сообщением.',
        completed: false,
      }
    }

    const updatedDraft = {
      ...session.draft,
      fullName,
    }

    return {
      text: await moveToStep(ctx, session, 'day', updatedDraft),
      completed: false,
    }
  }

  if (session.step === 'day') {
    const day = parseInteger(text.trim())

    if (day === null || !validateDay(day)) {
      return {
        text: 'День должен быть числом от 1 до 31.',
        completed: false,
      }
    }

    const updatedDraft = {
      ...session.draft,
      day,
    }

    return {
      text: await moveToStep(ctx, session, 'month', updatedDraft),
      completed: false,
    }
  }

  if (session.step === 'month') {
    const month = parseInteger(text.trim())

    if (month === null || !validateMonth(month)) {
      return {
        text: 'Выбери месяц кнопкой ниже или отправь число от 1 до 12.',
        completed: false,
      }
    }

    if (session.draft.day !== undefined && isLeapDayBirthday(session.draft.day, month)) {
      return {
        text: LEAP_DAY_REJECTION_MESSAGE,
        completed: false,
      }
    }

    const updatedDraft = {
      ...session.draft,
      month,
    }

    return {
      text: await moveToStep(ctx, session, 'birthYear', updatedDraft),
      completed: false,
    }
  }

  if (session.step === 'birthYear') {
    if (isSkipValue(text)) {
      return skipAddBirthdayStep(ctx)
    }

    const birthYear = parseInteger(text.trim())

    if (birthYear === null || !validateBirthYear(birthYear)) {
      return {
        text: 'Год рождения должен быть числом от 1900 до 2100. Если не хочешь указывать год, нажми «Пропустить».',
        completed: false,
      }
    }

    const updatedDraft = {
      ...session.draft,
      birthYear,
    }

    return {
      text: await moveToStep(ctx, session, 'notes', updatedDraft),
      completed: false,
    }
  }

  if (isSkipValue(text)) {
    return skipAddBirthdayStep(ctx)
  }

  const result = await finishAddBirthdayFlow(ctx, session, {
    ...session.draft,
    notes: text.trim() || null,
  })

  return {
    text: result.text,
    completed: true,
    birthdayId: result.birthdayId,
  }
}
