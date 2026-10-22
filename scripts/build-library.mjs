// Normalizes the captured exercise library into convex/data/exercises.json.
// Usage: node scripts/build-library.mjs [path/to/exercise-library.json]
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath =
  process.argv[2] ??
  resolve(process.env.HOME, 'Documents/projects/wrkt/research/bws/exercise-library.json')
const capture = JSON.parse(await readFile(sourcePath, 'utf8'))

// Specific muscle name → canonical group used for filters and coverage.
const GROUP_RULES = [
  [/upper chest|middle chest|lower chest|^chest$|pec/i, 'Chest'],
  [/trap/i, 'Traps'],
  [/lat|mid\/upper back|^back$|lower back|rhomboid/i, 'Back'],
  [/delt|^shoulders?$/i, 'Shoulders'],
  [/brachialis|bicep/i, 'Biceps'],
  [/tricep/i, 'Triceps'],
  [/forearm|wrist/i, 'Forearms'],
  [/quad|rec(t)?us femoris/i, 'Quads'],
  [/hamstring|knee flexor/i, 'Hamstrings'],
  [/glute|hip extensor|abductor/i, 'Glutes'],
  [/adductor/i, 'Adductors'],
  [/calf|calves|gastrocnemius|soleus/i, 'Calves'],
  [/abs|core|oblique|tva|transvers/i, 'Abs'],
]
const groupFor = (name) => {
  for (const [pattern, group] of GROUP_RULES) if (pattern.test(name)) return group
  return null
}
const prettyMuscle = (name) => {
  const trimmed = name.trim()
  const fixes = { 'Recus Femoris': 'Rectus Femoris', 'All quadriceps': 'All Quadriceps', 'All glutes': 'All Glutes', 'Mid/Upper back': 'Mid/Upper Back', 'Lower back': 'Lower Back', 'Upper abs': 'Upper Abs', Shoulder: 'Shoulders' }
  return fixes[trimmed] ?? trimmed
}
const CATEGORY_RENAME = { Quadriceps: 'Quads', Core: 'Abs' }

const slugify = (name) =>
  name.toLowerCase().replace(/\*/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const TRACKING = {
  weight: 'weight_reps',
  restPause: 'weight_reps',
  reps: 'reps',
  none: 'reps',
  duration: 'duration',
  distanceDuration: 'duration',
  loadableBodyweight: 'weighted_bodyweight',
}

// Category membership from the captured UI filters.
const details = capture.details_captured ?? []
const byName = new Map()
for (const d of details) {
  byName.set(d.name.trim(), d)
  if (d.alternate_visible_name) byName.set(d.alternate_visible_name.trim(), d)
}
const categories = new Map()
const addCategory = (visibleName, category) => {
  const d = byName.get(visibleName.trim())
  if (!d) return
  const set = categories.get(d) ?? new Set()
  set.add(CATEGORY_RENAME[category] ?? category)
  categories.set(d, set)
}
for (const [category, m] of Object.entries(capture.filter_membership_capture ?? {})) {
  for (const n of m.visible_names ?? []) addCategory(n, category)
  for (const [sub, nested] of Object.entries(m.subcategories ?? {})) {
    for (const n of nested.visible_names ?? []) {
      addCategory(n, category)
      addCategory(n, `${category}: ${sub}`)
    }
  }
}

const seen = new Set()
const rows = []
for (const d of details) {
  const name = d.name.trim().replace(/\s+/g, ' ')
  const slug = slugify(name)
  if (seen.has(slug)) continue
  seen.add(slug)

  const muscles = []
  const pushMuscle = (raw, role) => {
    if (!raw || /^(none|unclassified|n\/a)$/i.test(raw.trim())) return
    const label = prettyMuscle(raw)
    const group = groupFor(label)
    if (muscles.some((m) => m.name === label)) return
    muscles.push({ name: label, group: group ?? label, role })
  }
  for (const m of d.muscle_groups ?? []) pushMuscle(m.name, m.role === 'primary' ? 'primary' : 'secondary')
  if (!muscles.some((m) => m.role === 'primary') && d.target_area) pushMuscle(d.target_area, 'primary')

  const known = new Set(GROUP_RULES.map(([, g]) => g))
  const primaryGroups = [...new Set(muscles.filter((m) => m.role === 'primary' && known.has(m.group)).map((m) => m.group))]
  const secondaryGroups = [...new Set(muscles.filter((m) => m.role === 'secondary' && known.has(m.group)).map((m) => m.group))].filter((g) => !primaryGroups.includes(g))

  const cats = new Set(categories.get(d) ?? [])
  for (const g of primaryGroups) cats.add(g)
  if (d.health_tag === 'REHAB' || /rehab|prehab/.test(d.exerciseType ?? '')) cats.add('Rehab')
  if (d.exerciseType === 'cardio') cats.add('Cardio')
  if (d.exerciseType === 'warmup' || d.exerciseType === 'mobility') cats.add('Warm-up')

  const steps = (d.movement_steps_visible ?? d.instructions ?? []).map((s) => s.trim()).filter(Boolean)
  const cues = d.instruction_note ? [d.instruction_note.trim()] : []
  const repLow = d.lowerRepRange ?? 8
  const repHigh = d.upperRepRange ?? 12
  const aliases = [...new Set([...(d.aliases ?? []), d.alternate_visible_name, d.db_canonical_name].filter(Boolean).map((a) => a.trim()).filter((a) => a !== name))]

  rows.push({
    slug,
    name,
    aliases,
    muscles,
    primaryGroups,
    secondaryGroups,
    categories: [...cats],
    equipment: [...new Set(d.equipment_visible ?? [])],
    kind: d.exerciseType ?? 'accessory',
    movement: d.movement && d.movement !== 'unclassified' ? d.movement : undefined,
    tracking: TRACKING[d.loadType] ?? 'weight_reps',
    unilateral: d.laterality === 'unilateral',
    steps,
    cues,
    tips: typeof d.tips === 'string' && d.tips.trim() ? d.tips.trim() : undefined,
    videoUrl: d.youtube_url || undefined,
    thumbnailUrl: d.video_thumbnail_url || undefined,
    defaults: {
      sets: d.numberOfSets || 3,
      repLow: repLow || 0,
      repHigh: repHigh || 0,
      restSec: d.rest ?? 90,
    },
    listed: d.visibility !== 'database_only' || cats.size > 0,
    source: 'Built With Science library',
  })
}

const sortKey = (n) => n.replace(/^\([^)]*\)\s*/, '').replace(/^\d+\s*/, '')
rows.sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)))
const out = resolve(root, 'convex/data/exercises.json')
await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify(rows))
console.log(JSON.stringify({ exercises: rows.length, listed: rows.filter((r) => r.listed).length, withVideo: rows.filter((r) => r.videoUrl).length, out }, null, 2))
