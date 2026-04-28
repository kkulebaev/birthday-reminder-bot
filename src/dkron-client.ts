import { getSafeErrorMessage } from './telegram-api.js'

type BirthdayJobInput = {
  birthdayId: string
  fullName: string
  month: number
  day: number
  notifyAt: string
  timezone: string
  webhookUrl: string
  webhookSecret: string
}

type DkronHttpExecutorConfig = {
  method: string
  url: string
  headers: string
  body: string
  timeout: string
  expectCode: string
}

type DkronJob = {
  name: string
  displayname: string
  schedule: string
  timezone: string
  executor: 'http'
  executor_config: DkronHttpExecutorConfig
  retries: number
  concurrency: 'allow' | 'forbid'
  disabled: boolean
}

function getDkronApiUrl(): string {
  const url = process.env.DKRON_API_URL

  if (!url) {
    throw new Error('DKRON_API_URL is required')
  }

  return url.replace(/\/+$/, '')
}

export function getBirthdayJobName(birthdayId: string): string {
  return `bday-${birthdayId}`
}

function parseNotifyAt(notifyAt: string): { hour: number; minute: number } {
  const match = notifyAt.match(/^([01]\d|2[0-3]):([0-5]\d)$/)

  if (!match) {
    throw new Error(`Invalid notifyAt value: ${notifyAt}`)
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  }
}

export function buildBirthdayCronExpression(input: { month: number; day: number; notifyAt: string }): string {
  const { hour, minute } = parseNotifyAt(input.notifyAt)

  return `0 ${minute} ${hour} ${input.day} ${input.month} *`
}

export function buildBirthdayJobDisplayName(fullName: string): string {
  const trimmed = fullName.trim()

  if (!trimmed) {
    return 'Birthday reminder'
  }

  return `Birthday · ${trimmed}`
}

function buildBirthdayJobPayload(input: BirthdayJobInput): DkronJob {
  return {
    name: getBirthdayJobName(input.birthdayId),
    displayname: buildBirthdayJobDisplayName(input.fullName),
    schedule: buildBirthdayCronExpression(input),
    timezone: input.timezone,
    executor: 'http',
    executor_config: {
      method: 'POST',
      url: input.webhookUrl,
      headers: JSON.stringify([
        'Content-Type: application/json',
        `X-Internal-Auth: ${input.webhookSecret}`,
      ]),
      body: JSON.stringify({ birthdayId: input.birthdayId }),
      timeout: '30',
      expectCode: '200',
    },
    retries: 3,
    concurrency: 'forbid',
    disabled: false,
  }
}

async function dkronFetch(path: string, init: Parameters<typeof fetch>[1]): Promise<Response> {
  const url = `${getDkronApiUrl()}${path}`
  const response = await fetch(url, init)

  return response
}

export async function upsertBirthdayJob(input: BirthdayJobInput): Promise<void> {
  const payload = buildBirthdayJobPayload(input)
  const response = await dkronFetch('/v1/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')

    throw new Error(`Dkron upsert failed (${response.status}): ${text}`)
  }
}

export async function deleteBirthdayJob(birthdayId: string): Promise<void> {
  const name = getBirthdayJobName(birthdayId)
  const response = await dkronFetch(`/v1/jobs/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })

  if (response.status === 404) {
    return
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')

    throw new Error(`Dkron delete failed (${response.status}): ${text}`)
  }
}

export async function pingDkron(): Promise<boolean> {
  try {
    const response = await dkronFetch('/v1/jobs', { method: 'GET' })

    return response.ok
  } catch (error) {
    console.error('Dkron ping failed:', getSafeErrorMessage(error))
    return false
  }
}
