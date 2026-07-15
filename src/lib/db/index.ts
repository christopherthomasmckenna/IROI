import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

// In Next.js dev, hot reloads re-execute module code and would create a new
// connection pool on every reload. We stash the client on globalThis so the
// pool survives across reloads in development.
const globalForDb = globalThis as unknown as { _pgClient?: postgres.Sql }
const client = globalForDb._pgClient ?? postgres(process.env.DATABASE_URL)
if (process.env.NODE_ENV !== 'production') globalForDb._pgClient = client

export const db = drizzle(client, { schema })
