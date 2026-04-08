import 'dotenv/config'
import { schedulerService } from './scheduler-service.js'
import { getSafeErrorMessage } from './telegram-api.js'

void schedulerService.start().catch((error) => {
  console.error('Scheduler startup error', getSafeErrorMessage(error))
  process.exitCode = 1
})
