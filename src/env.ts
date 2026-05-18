import 'dotenv/config'
import { z } from 'zod'

const trimEmptyStrings = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null) {
    return value
  }
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    out[key] = typeof raw === 'string' && raw.trim() === '' ? undefined : raw
  }
  return out
}

const schema = z.preprocess(
  trimEmptyStrings,
  z
    .object({
      TELEGRAM_BOT_TOKEN: z.string().min(1),
      DATABASE_URL: z.url(),
      DIRECT_DATABASE_URL: z.url().optional(),
      DKRON_API_URL: z.url(),
      INTERNAL_WEBHOOK_SECRET: z.string().min(16),
      PORT: z.coerce.number().int().positive().default(3000),
      TELEGRAM_WEBHOOK_PATH: z.string().min(1).default('/telegram/webhook'),
      BOT_INTERNAL_URL: z.url().optional(),
      RAILWAY_PRIVATE_DOMAIN: z.string().min(1).optional(),
    })
    .refine(
      (parsed) => Boolean(parsed.BOT_INTERNAL_URL ?? parsed.RAILWAY_PRIVATE_DOMAIN),
      { message: 'BOT_INTERNAL_URL or RAILWAY_PRIVATE_DOMAIN must be set' },
    ),
)

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid environment variables:\n${issues}`)
}

export const env = parsed.data
