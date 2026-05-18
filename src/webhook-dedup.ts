import { prisma } from './db.js'
import { getSafeErrorMessage } from './telegram-api.js'

export type DedupResult = 'fresh' | 'duplicate' | 'error'

const PRUNE_OLDER_THAN_MS = 7 * 24 * 60 * 60 * 1000

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  )
}

export async function markUpdateProcessed(updateId: number): Promise<DedupResult> {
  try {
    await prisma.processedUpdate.create({ data: { updateId: BigInt(updateId) } })
    return 'fresh'
  } catch (err) {
    if (isUniqueViolation(err)) {
      return 'duplicate'
    }
    console.error('Webhook dedup insert failed', getSafeErrorMessage(err))
    return 'error'
  }
}

export async function rollbackProcessedUpdate(updateId: number): Promise<void> {
  try {
    await prisma.processedUpdate.delete({ where: { updateId: BigInt(updateId) } })
  } catch (err) {
    console.error('Webhook dedup rollback failed', {
      updateId,
      err: getSafeErrorMessage(err),
    })
  }
}

export async function pruneOldProcessedUpdates(): Promise<number> {
  const cutoff = new Date(Date.now() - PRUNE_OLDER_THAN_MS)
  try {
    const result = await prisma.processedUpdate.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })
    return result.count
  } catch (err) {
    console.warn('processed_updates prune failed', getSafeErrorMessage(err))
    return 0
  }
}
