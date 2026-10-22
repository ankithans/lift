import type { OptimisticLocalStore } from 'convex/browser'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export type ActiveWorkout = NonNullable<FunctionReturnType<typeof api.workouts.active>>
export type WorkoutExercise = ActiveWorkout['exercises'][number]
export type WorkoutSet = WorkoutExercise['sets'][number]
export type Tracking = WorkoutExercise['exercise']['tracking']

export type Block = { group: string | null; items: { we: WorkoutExercise; letter: string | null }[] }

/** Consecutive exercises sharing a group form one superset block. */
export function toBlocks(exercises: WorkoutExercise[]): Block[] {
  const blocks: Block[] = []
  for (const we of exercises) {
    const last = blocks[blocks.length - 1]
    if (we.group && last && last.group === we.group) {
      last.items.push({ we, letter: null })
    } else {
      blocks.push({ group: we.group ?? null, items: [{ we, letter: null }] })
    }
  }
  for (const b of blocks) {
    if (b.items.length > 1) b.items.forEach((it, i) => (it.letter = String.fromCharCode(65 + i)))
    else b.group = null
  }
  return blocks
}

export function setLabel(set: WorkoutSet, index: number, letter: string | null) {
  if (set.kind === 'warmup') return 'W'
  if (set.kind === 'drop') return 'D'
  if (set.kind === 'failure') return 'F'
  return `${index + 1}${letter ?? ''}`
}

export type Suggestion = { weightKg: number | null; reps: number | null; durationSec: number | null }

/**
 * What to prefill for a set: the matching set from last session, unless the
 * person already deviated from last session's weight today (then carry today's).
 */
export function suggestFor(we: WorkoutExercise, index: number): Suggestion {
  const prevAt = (i: number) => we.previous[i] ?? we.previous[we.previous.length - 1] ?? null
  const prev = prevAt(index)
  let weightKg = prev?.weightKg ?? null
  let reps = prev?.reps ?? null
  const durationSec = prev?.durationSec ?? null
  for (let j = index - 1; j >= 0; j--) {
    const s = we.sets[j]
    if (s.weightKg === undefined && s.reps === undefined) continue
    const pj = prevAt(j)
    if (s.weightKg !== undefined && s.weightKg !== (pj?.weightKg ?? undefined)) weightKg = s.weightKg
    if (reps === null && s.reps !== undefined) reps = s.reps
    if (weightKg === null && s.weightKg !== undefined) weightKg = s.weightKg
    break
  }
  return { weightKg, reps, durationSec }
}

export function needsWeight(t: Tracking) {
  return t === 'weight_reps'
}

/** Optimistically patch one set of the active workout. */
export function patchActiveSet(
  store: OptimisticLocalStore,
  setId: Id<'sets'>,
  patch: Partial<WorkoutSet>,
  workoutPatch?: (w: ActiveWorkout, we: WorkoutExercise) => Partial<ActiveWorkout>,
) {
  const cur = store.getQuery(api.workouts.active, {})
  if (!cur) return
  let extra: Partial<ActiveWorkout> = {}
  const exercises = cur.exercises.map((we) => {
    if (!we.sets.some((s) => s._id === setId)) return we
    if (workoutPatch) extra = workoutPatch(cur, we)
    return { ...we, sets: we.sets.map((s) => (s._id === setId ? { ...s, ...patch } : s)) }
  })
  store.setQuery(api.workouts.active, {}, { ...cur, ...extra, exercises })
}

export function restAfter(w: ActiveWorkout, we: WorkoutExercise) {
  if (we.group) {
    const members = w.exercises.filter((x) => x.group === we.group)
    if (members.length > 1 && members[members.length - 1]._id !== we._id) return 0
  }
  return we.restSec
}
