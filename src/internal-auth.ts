import { timingSafeEqual } from 'node:crypto'
import { env } from './env.js'

export function verifyInternalAuth(headerValue: string | undefined): boolean {
  if (!headerValue) return false
  const expected = Buffer.from(env.INTERNAL_WEBHOOK_SECRET)
  const got = Buffer.from(headerValue)
  if (got.length !== expected.length) return false
  return timingSafeEqual(got, expected)
}
