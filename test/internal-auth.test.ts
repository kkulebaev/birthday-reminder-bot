import { describe, expect, it } from 'vitest'
import { env } from '../src/env.js'
import { verifyInternalAuth } from '../src/internal-auth.js'

const SECRET = env.INTERNAL_WEBHOOK_SECRET
const ONE_BIT_FLIPPED = String.fromCharCode(SECRET.charCodeAt(0) ^ 1) + SECRET.slice(1)

describe('verifyInternalAuth', () => {
  it('accepts the correct secret', () => {
    expect(verifyInternalAuth(SECRET)).toBe(true)
  })

  it('rejects undefined header', () => {
    expect(verifyInternalAuth(undefined)).toBe(false)
  })

  it('rejects empty string', () => {
    expect(verifyInternalAuth('')).toBe(false)
  })

  it('rejects a wrong secret of the same length', () => {
    const wrong = 'X'.repeat(SECRET.length)
    expect(wrong.length).toBe(SECRET.length)
    expect(verifyInternalAuth(wrong)).toBe(false)
  })

  it('rejects a one-bit-different secret of the same length', () => {
    expect(ONE_BIT_FLIPPED).not.toBe(SECRET)
    expect(ONE_BIT_FLIPPED.length).toBe(SECRET.length)
    expect(verifyInternalAuth(ONE_BIT_FLIPPED)).toBe(false)
  })

  it('rejects a truncated secret', () => {
    expect(verifyInternalAuth(SECRET.slice(0, -1))).toBe(false)
  })

  it('rejects a secret with extra suffix', () => {
    expect(verifyInternalAuth(`${SECRET}extra`)).toBe(false)
  })
})
