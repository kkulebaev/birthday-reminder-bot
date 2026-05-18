import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../src/db.js'
import {
  markUpdateProcessed,
  pruneOldProcessedUpdates,
  rollbackProcessedUpdate,
} from '../src/webhook-dedup.js'

describe('webhook-dedup', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('markUpdateProcessed', () => {
    it('returns fresh when insert succeeds', async () => {
      const spy = vi.spyOn(prisma.processedUpdate, 'create').mockResolvedValue({
        updateId: BigInt(123),
        createdAt: new Date(),
      })
      await expect(markUpdateProcessed(123)).resolves.toBe('fresh')
      expect(spy).toHaveBeenCalledWith({ data: { updateId: BigInt(123) } })
    })

    it('returns duplicate on unique-constraint violation (P2002)', async () => {
      vi.spyOn(prisma.processedUpdate, 'create').mockRejectedValue(
        Object.assign(new Error('unique'), { code: 'P2002' }),
      )
      await expect(markUpdateProcessed(123)).resolves.toBe('duplicate')
    })

    it('returns error on other DB failures', async () => {
      vi.spyOn(prisma.processedUpdate, 'create').mockRejectedValue(new Error('connection refused'))
      await expect(markUpdateProcessed(123)).resolves.toBe('error')
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('rollbackProcessedUpdate', () => {
    it('calls delete with the right key', async () => {
      const spy = vi.spyOn(prisma.processedUpdate, 'delete').mockResolvedValue({
        updateId: BigInt(123),
        createdAt: new Date(),
      })
      await rollbackProcessedUpdate(123)
      expect(spy).toHaveBeenCalledWith({ where: { updateId: BigInt(123) } })
    })

    it('logs and swallows delete errors', async () => {
      vi.spyOn(prisma.processedUpdate, 'delete').mockRejectedValue(new Error('cant delete'))
      await expect(rollbackProcessedUpdate(123)).resolves.toBeUndefined()
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('pruneOldProcessedUpdates', () => {
    it('returns deleted count', async () => {
      vi.spyOn(prisma.processedUpdate, 'deleteMany').mockResolvedValue({ count: 5 })
      await expect(pruneOldProcessedUpdates()).resolves.toBe(5)
    })

    it('uses a 7-day cutoff', async () => {
      const spy = vi.spyOn(prisma.processedUpdate, 'deleteMany').mockResolvedValue({ count: 0 })
      const before = Date.now()
      await pruneOldProcessedUpdates()
      const after = Date.now()

      const call = spy.mock.calls[0]
      expect(call).toBeDefined()
      const cutoff = (call![0] as { where: { createdAt: { lt: Date } } }).where.createdAt.lt
      const expectedMin = before - 7 * 24 * 60 * 60 * 1000
      const expectedMax = after - 7 * 24 * 60 * 60 * 1000
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(expectedMin)
      expect(cutoff.getTime()).toBeLessThanOrEqual(expectedMax)
    })

    it('returns 0 on failure and warns', async () => {
      vi.spyOn(prisma.processedUpdate, 'deleteMany').mockRejectedValue(new Error('boom'))
      await expect(pruneOldProcessedUpdates()).resolves.toBe(0)
      expect(console.warn).toHaveBeenCalled()
    })
  })
})
