import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const VALID_ENV = {
  TELEGRAM_BOT_TOKEN: 'valid-bot-token',
  DATABASE_URL: 'postgresql://u:p@h:5432/d',
  DKRON_API_URL: 'http://dkron:8080',
  INTERNAL_WEBHOOK_SECRET: 'sixteen-chars-long-secret',
  BOT_INTERNAL_URL: 'http://bot.local',
} as const

const ALL_ENV_KEYS = [
  'TELEGRAM_BOT_TOKEN',
  'DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'DKRON_API_URL',
  'INTERNAL_WEBHOOK_SECRET',
  'BOT_INTERNAL_URL',
  'RAILWAY_PRIVATE_DOMAIN',
  'PORT',
  'TELEGRAM_WEBHOOK_PATH',
] as const

function stubEnv(values: Partial<Record<(typeof ALL_ENV_KEYS)[number], string>>): void {
  for (const key of ALL_ENV_KEYS) {
    vi.stubEnv(key, values[key] ?? '')
  }
}

describe('env', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('parses a valid environment and applies defaults', async () => {
    stubEnv(VALID_ENV)
    const { env } = await import('../src/env.js')
    expect(env.TELEGRAM_BOT_TOKEN).toBe('valid-bot-token')
    expect(env.PORT).toBe(3000)
    expect(env.TELEGRAM_WEBHOOK_PATH).toBe('/telegram/webhook')
    expect(env.BOT_INTERNAL_URL).toBe('http://bot.local')
    expect(env.RAILWAY_PRIVATE_DOMAIN).toBeUndefined()
  })

  it('coerces PORT to a number when set', async () => {
    stubEnv({ ...VALID_ENV, PORT: '4242' })
    const { env } = await import('../src/env.js')
    expect(env.PORT).toBe(4242)
  })

  it('honors TELEGRAM_WEBHOOK_PATH override', async () => {
    stubEnv({ ...VALID_ENV, TELEGRAM_WEBHOOK_PATH: '/tg/hook' })
    const { env } = await import('../src/env.js')
    expect(env.TELEGRAM_WEBHOOK_PATH).toBe('/tg/hook')
  })

  it('throws when TELEGRAM_BOT_TOKEN is missing', async () => {
    stubEnv({ ...VALID_ENV, TELEGRAM_BOT_TOKEN: undefined })
    await expect(import('../src/env.js')).rejects.toThrow(/TELEGRAM_BOT_TOKEN/)
  })

  it('throws when DATABASE_URL is not a URL', async () => {
    stubEnv({ ...VALID_ENV, DATABASE_URL: 'not-a-url' })
    await expect(import('../src/env.js')).rejects.toThrow(/DATABASE_URL/)
  })

  it('throws when INTERNAL_WEBHOOK_SECRET is too short', async () => {
    stubEnv({ ...VALID_ENV, INTERNAL_WEBHOOK_SECRET: 'short' })
    await expect(import('../src/env.js')).rejects.toThrow(/INTERNAL_WEBHOOK_SECRET/)
  })

  it('throws when PORT is not a positive integer', async () => {
    stubEnv({ ...VALID_ENV, PORT: '-1' })
    await expect(import('../src/env.js')).rejects.toThrow(/PORT/)
  })

  it('throws when both BOT_INTERNAL_URL and RAILWAY_PRIVATE_DOMAIN are missing', async () => {
    stubEnv({ ...VALID_ENV, BOT_INTERNAL_URL: undefined })
    await expect(import('../src/env.js')).rejects.toThrow(/BOT_INTERNAL_URL or RAILWAY_PRIVATE_DOMAIN/)
  })

  it('leaves DIRECT_DATABASE_URL undefined when not set', async () => {
    stubEnv(VALID_ENV)
    const { env } = await import('../src/env.js')
    expect(env.DIRECT_DATABASE_URL).toBeUndefined()
  })

  it('accepts DIRECT_DATABASE_URL when it is a valid URL', async () => {
    stubEnv({ ...VALID_ENV, DIRECT_DATABASE_URL: 'postgresql://direct@h:5432/d' })
    const { env } = await import('../src/env.js')
    expect(env.DIRECT_DATABASE_URL).toBe('postgresql://direct@h:5432/d')
  })

  it('throws when DIRECT_DATABASE_URL is not a URL', async () => {
    stubEnv({ ...VALID_ENV, DIRECT_DATABASE_URL: 'not-a-url' })
    await expect(import('../src/env.js')).rejects.toThrow(/DIRECT_DATABASE_URL/)
  })

  it('accepts RAILWAY_PRIVATE_DOMAIN as the alternative to BOT_INTERNAL_URL', async () => {
    stubEnv({ ...VALID_ENV, BOT_INTERNAL_URL: undefined, RAILWAY_PRIVATE_DOMAIN: 'bot.railway.internal' })
    const { env } = await import('../src/env.js')
    expect(env.RAILWAY_PRIVATE_DOMAIN).toBe('bot.railway.internal')
    expect(env.BOT_INTERNAL_URL).toBeUndefined()
  })

  it('treats empty strings as missing for required fields', async () => {
    stubEnv({ ...VALID_ENV, DKRON_API_URL: '' })
    await expect(import('../src/env.js')).rejects.toThrow(/DKRON_API_URL/)
  })
})
