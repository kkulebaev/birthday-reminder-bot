import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../src/db.js'
import { WizardKind } from '../src/generated/prisma/client.js'
import {
  clearAllSessions,
  clearSession,
  loadActiveSessions,
  loadSessionPayload,
  reapStaleSessions,
  upsertSession,
} from '../src/wizard-session.js'

type AddPayload = { step: 'fullName'; history: []; draft: { fullName?: string } }

describe('wizard-session', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loadActiveSessions', () => {
    it('makes a single findMany query and groups rows by kind', async () => {
      const rows = [
        {
          userId: '42',
          kind: WizardKind.add_birthday,
          payload: { step: 'fullName', history: [], draft: {} },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          userId: '42',
          kind: WizardKind.settings_edit,
          payload: { mode: 'timezone' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      const spy = vi.spyOn(prisma.wizardSession, 'findMany').mockResolvedValue(rows)
      const active = await loadActiveSessions('42')

      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith({ where: { userId: '42' } })
      expect(active.addFlow).toEqual({ step: 'fullName', history: [], draft: {} })
      expect(active.settingsEdit).toEqual({ mode: 'timezone' })
      expect(active.inlineEdit).toBeUndefined()
    })

    it('returns an empty object when nothing is active', async () => {
      vi.spyOn(prisma.wizardSession, 'findMany').mockResolvedValue([])
      const active = await loadActiveSessions('42')

      expect(active).toEqual({})
    })
  })

  describe('loadSessionPayload', () => {
    it('returns payload for an existing session', async () => {
      vi.spyOn(prisma.wizardSession, 'findUnique').mockResolvedValue({
        userId: '42',
        kind: WizardKind.add_birthday,
        payload: { step: 'fullName', history: [], draft: { fullName: 'Ann' } },
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const payload = await loadSessionPayload<AddPayload>('42', WizardKind.add_birthday)

      expect(payload).toEqual({ step: 'fullName', history: [], draft: { fullName: 'Ann' } })
    })

    it('returns null for a missing session', async () => {
      vi.spyOn(prisma.wizardSession, 'findUnique').mockResolvedValue(null)
      const payload = await loadSessionPayload<AddPayload>('42', WizardKind.add_birthday)

      expect(payload).toBeNull()
    })
  })

  describe('upsertSession', () => {
    it('calls upsert with composite key and payload', async () => {
      const spy = vi.spyOn(prisma.wizardSession, 'upsert').mockResolvedValue({
        userId: '42',
        kind: WizardKind.add_birthday,
        payload: { foo: 'bar' },
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await upsertSession('42', WizardKind.add_birthday, { foo: 'bar' })

      expect(spy).toHaveBeenCalledWith({
        where: { userId_kind: { userId: '42', kind: WizardKind.add_birthday } },
        create: { userId: '42', kind: WizardKind.add_birthday, payload: { foo: 'bar' } },
        update: { payload: { foo: 'bar' } },
      })
    })
  })

  describe('clearSession', () => {
    it('returns true when a row was deleted', async () => {
      vi.spyOn(prisma.wizardSession, 'deleteMany').mockResolvedValue({ count: 1 })
      await expect(clearSession('42', WizardKind.add_birthday)).resolves.toBe(true)
    })

    it('returns false when nothing was deleted', async () => {
      vi.spyOn(prisma.wizardSession, 'deleteMany').mockResolvedValue({ count: 0 })
      await expect(clearSession('42', WizardKind.add_birthday)).resolves.toBe(false)
    })
  })

  describe('clearAllSessions', () => {
    it('deletes every row for the user regardless of kind', async () => {
      const spy = vi.spyOn(prisma.wizardSession, 'deleteMany').mockResolvedValue({ count: 3 })
      await clearAllSessions('42')

      expect(spy).toHaveBeenCalledWith({ where: { userId: '42' } })
    })
  })

  describe('reapStaleSessions', () => {
    it('deletes rows older than the given cutoff', async () => {
      const spy = vi.spyOn(prisma.wizardSession, 'deleteMany').mockResolvedValue({ count: 4 })
      const before = Date.now()
      const count = await reapStaleSessions(60)
      const after = Date.now()

      expect(count).toBe(4)
      const call = spy.mock.calls[0]
      expect(call).toBeDefined()
      const cutoff = (call![0] as { where: { updatedAt: { lt: Date } } }).where.updatedAt.lt
      expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 60 * 60_000)
      expect(cutoff.getTime()).toBeLessThanOrEqual(after - 60 * 60_000)
    })

    it('returns 0 and warns on failure', async () => {
      vi.spyOn(prisma.wizardSession, 'deleteMany').mockRejectedValue(new Error('boom'))
      await expect(reapStaleSessions(60)).resolves.toBe(0)
      expect(console.warn).toHaveBeenCalled()
    })
  })
})
