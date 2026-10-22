import type { FunctionReference } from 'convex/server'
import { api } from '../../convex/_generated/api'
import { getConvex } from './convex'

/**
 * Durable record of set mutations that haven't been acknowledged yet.
 * Convex queues mutations while offline, but only in memory: a reload or the OS
 * killing the tab would drop them. Entries live in localStorage until the server
 * confirms, and are replayed on the next launch. All replayed mutations are idempotent.
 */
const KEY = 'lift:outbox'
type Name = 'completeSet' | 'updateSet' | 'uncompleteSet'
type Entry = { id: string; name: Name; args: Record<string, unknown>; at: number }

const refs: Record<Name, FunctionReference<'mutation'>> = {
  completeSet: api.workouts.completeSet,
  updateSet: api.workouts.updateSet,
  uncompleteSet: api.workouts.uncompleteSet,
}

function read(): Entry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Entry[]
  } catch {
    return []
  }
}
function write(list: Entry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-200)))
  } catch {
    // storage full / private mode — best effort
  }
}

/** Wrap a mutation promise so it's remembered until acknowledged. */
export function track<T>(name: Name, args: Record<string, unknown>, promise: Promise<T>): Promise<T> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  write([...read(), { id, name, args, at: Date.now() }])
  const drop = () => write(read().filter((e) => e.id !== id))
  return promise.then(
    (v) => {
      drop()
      return v
    },
    (err) => {
      // Rejected by the server (validation etc.): don't keep retrying it.
      drop()
      throw err
    },
  )
}

let replaying = false
/** Replay entries left over from a previous session, oldest first. */
export async function replayOutbox() {
  if (replaying) return
  const pending = read().filter((e) => Date.now() - e.at < 3 * 24 * 3600_000)
  if (pending.length === 0) return
  replaying = true
  const client = getConvex()
  try {
    for (const e of pending) {
      try {
        await client.mutation(refs[e.name], e.args as never)
      } catch {
        // stale (set deleted, workout finished): drop
      }
      write(read().filter((x) => x.id !== e.id))
    }
  } finally {
    replaying = false
  }
}
