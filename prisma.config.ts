import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

type Env = {
  DATABASE_URL: string
  DIRECT_DATABASE_URL?: string
}

const migrationUrlKey: keyof Env & string = process.env.DIRECT_DATABASE_URL
  ? 'DIRECT_DATABASE_URL'
  : 'DATABASE_URL'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env<Env>(migrationUrlKey),
  },
})
