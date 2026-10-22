// Imports data/bws/history.json (Built With Science export) into Lift for one user.
// Usage: node scripts/import-bws.mjs <email> [--prod] [--dry]
//   --prod uses CONVEX_DEPLOY_KEY_PROD from ~/.config/lift/secrets.env
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [email, ...flags] = process.argv.slice(2)
if (!email) throw new Error('usage: node scripts/import-bws.mjs <email> [--prod] [--dry]')
const prod = flags.includes('--prod')
const dry = flags.includes('--dry')

const history = JSON.parse(readFileSync(resolve(root, 'data/bws/history.json'), 'utf8'))
const library = JSON.parse(readFileSync(resolve(root, 'convex/data/exercises.json'), 'utf8'))

const norm = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase()
const slugByName = new Map()
for (const e of library) {
  slugByName.set(norm(e.name), e.slug)
  for (const a of e.aliases) if (!slugByName.has(norm(a))) slugByName.set(norm(a), e.slug)
}
const unmatched = new Set()
const slugOf = (name) => {
  const s = slugByName.get(norm(name))
  if (!s) unmatched.add(name)
  return s
}

// Program: the seven scheduled days (supplementary routines without a weekday are skipped).
const days = history.program.days
  .filter((d) => d.weekday !== null && d.weekday !== undefined)
  .map((d) => ({
    key: d.bwsWorkoutPlanId ?? `rest-${d.weekday}`,
    weekday: d.weekday,
    title: d.isRest ? 'Rest' : d.title,
    kind: d.isRest ? 'rest' : 'workout',
    exercises: (d.exercises ?? [])
      .map((e) => ({
        slug: slugOf(e.name),
        sets: e.sets || 3,
        repLow: e.repLow || 0,
        repHigh: e.repHigh || e.repLow || 0,
        restSec: e.restSec ?? e.libraryRestSec ?? 90,
        ...(e.supersetGroup ? { group: String(e.supersetGroup) } : {}),
      }))
      .filter((e) => e.slug),
  }))

const KIND = { normal: 'working', drop: 'drop', light: 'working' }
const sessions = []
for (const s of history.sessions) {
  const exercises = []
  for (const ex of s.exercises) {
    const sets = ex.sets
      .filter((x) => x.completed)
      .map((x) => ({
        ...(x.weightKg ? { weightKg: x.weightKg } : {}),
        ...(x.reps ? { reps: x.reps } : {}),
        kind: KIND[x.type] ?? 'working',
      }))
      .filter((x) => x.reps || x.weightKg)
    if (sets.length === 0) continue
    const slug = slugOf(ex.name)
    if (!slug) continue
    exercises.push({ slug, ...(ex.supersetGroup ? { group: String(ex.supersetGroup) } : {}), sets })
  }
  if (exercises.length === 0) continue
  const startedAt = Date.parse(s.startedAt)
  let finishedAt = s.finishedAt ? Date.parse(s.finishedAt) : NaN
  const setCount = exercises.reduce((n, e) => n + e.sets.length, 0)
  // Sessions left open for hours (finished the next day) get a realistic duration.
  if (!Number.isFinite(finishedAt) || finishedAt - startedAt > 3 * 3600_000 || finishedAt <= startedAt) {
    finishedAt = startedAt + Math.min(90, Math.max(20, setCount * 3)) * 60_000
  }
  sessions.push({ externalId: `bws:${s.bwsId}`, planKey: s.bwsWorkoutPlanId, title: s.title.trim(), startedAt, finishedAt, exercises })
}

const payload = {
  email,
  source: 'bws:' + (history.program.bwsProgramPlanId ?? 'program'),
  program: { name: history.program.name.replace(/^Intermediate:\s*/, ''), goal: history.program.goal, level: history.program.level, days },
  sessions,
}

console.log(JSON.stringify({
  days: days.length,
  sessions: sessions.length,
  sets: sessions.reduce((n, s) => n + s.exercises.reduce((m, e) => m + e.sets.length, 0), 0),
  first: new Date(sessions[0]?.startedAt).toISOString(),
  last: new Date(sessions.at(-1)?.startedAt).toISOString(),
  unmatched: [...unmatched],
}, null, 2))
if (dry) process.exit(0)

const env = { ...process.env }
if (prod) {
  const secrets = resolve(process.env.HOME, '.config/lift/secrets.env')
  if (!existsSync(secrets)) throw new Error('missing ~/.config/lift/secrets.env')
  const vars = Object.fromEntries(readFileSync(secrets, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
  env.CONVEX_DEPLOY_KEY = vars.CONVEX_DEPLOY_KEY_PROD
  delete env.CONVEX_DEPLOYMENT
}
const run = (fn, args) => execFileSync('npx', ['convex', 'run', ...(prod ? ['--prod'] : []), fn, JSON.stringify(args)], { cwd: root, env, encoding: 'utf8', maxBuffer: 1 << 26 })
console.log(run('importer:importHistory', payload))
console.log(run('importer:rebuildStats', { email }))
