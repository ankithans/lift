import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  CloudOff,
  Info,
  Link2,
  Link2Off,
  Loader2,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Repeat,
  Medal,
  Timer,
  Trash2,
  Trophy,
  X,
} from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { ExerciseInfo } from '#/components/ExerciseDetail'
import { ExercisePicker } from '#/components/ExercisePicker'
import { ExerciseThumb } from '#/components/ExerciseThumb'
import { Keypad, type KeypadField, type KeypadTab } from '#/components/Keypad'
import { Sheet, SheetAction, SheetDivider } from '#/components/Sheet'
import { BlockSkeleton } from '#/components/Skeletons'
import { announce } from '#/lib/announce'
import { useOnline } from '#/lib/convex'
import { askNotifyPermission, chime, notify, tap, unlockAudio } from '#/lib/haptics'
import { fmtClock, fmtDuration, fmtNum, fmtReps, fmtSet, fmtVolume, fmtWeight, fromDisplayWeight, toDisplayWeight, type Unit } from '#/lib/format'
import { useUnit } from '#/lib/me'
import { toast } from '#/lib/toast'
import { useNow } from '#/lib/useNow'
import { track } from '#/lib/outbox'
import { OfflineWorkout } from '#/components/OfflineWorkout'
import {
  type ActiveWorkout,
  type WorkoutExercise,
  type WorkoutSet,
  patchActiveSet,
  previousFor,
  restAfter,
  setLabel,
  suggestFor,
  toBlocks,
  workingIndex,
} from '#/lib/workout'

export const Route = createFileRoute('/_app/workout')({
  head: () => ({ meta: [{ title: 'Workout · Lift' }] }),
  component: LiveWorkout,
})

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

type Editing = {
  setId: Id<'sets'>
  weId: Id<'workoutExercises'>
  field: KeypadField
  draft: string
  /** Value shown when the field opened; unchanged drafts are never re-saved. */
  initial: string
  fresh: boolean
  /** Draft the user already confirmed despite the "looks off" warning. */
  warned?: string
  /** Opened by auto-advance (the move was already announced). */
  auto?: boolean
}

type Menu =
  | { type: 'exercise'; we: WorkoutExercise; index: number }
  | { type: 'set'; set: WorkoutSet; we: WorkoutExercise; label: string }
  | { type: 'rest'; we: WorkoutExercise }
  | { type: 'notes'; we: WorkoutExercise }
  | { type: 'info'; we: WorkoutExercise }
  | { type: 'swap'; we: WorkoutExercise }
  | { type: 'add' }
  | { type: 'finish' }
  | { type: 'discard' }
  | null

type MainField = Exclude<KeypadField, 'rir'>

function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        // denied (battery saver etc.) — ignore
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && request()
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [enabled])
}

type Rest = { endsAt: number | null; total: number; endedAt: number | null; dismiss: () => void }

/**
 * Rest timer. Driven by a single timeout (not a ticking clock) so the screen
 * doesn't re-render while resting. Only a natural expiry alerts — chime when
 * visible, a system notification when Lift is in the background.
 */
function useRest(workout: ActiveWorkout | null | undefined, quietUntil: { current: number }): Rest {
  const endsAt = workout?.restEndsAt ?? null
  const total = workout?.restTotalSec ?? 0
  const [endedAt, setEndedAt] = useState<number | null>(null)
  const fired = useRef<number | null>(null)
  const announced = useRef<number | null>(null)

  useEffect(() => {
    if (!endsAt) return
    // A timer that was already running when this screen opened (reload, coming back):
    // keep counting, but don't announce its start, and don't re-alert if it's already over.
    const inherited = announced.current === null && Date.now() - (endsAt - total * 1000) > 3000
    if (inherited) {
      announced.current = endsAt
      if (endsAt <= Date.now()) {
        fired.current = endsAt
        return
      }
    }
    const fire = () => {
      if (fired.current === endsAt) return
      fired.current = endsAt
      if (Date.now() - endsAt > 10 * 60_000) return // long gone: no alarm
      setEndedAt(endsAt)
      tap('success')
      announce('Rest complete. Next set when you are ready.')
      if (document.visibilityState === 'visible') chime()
      else void notify('Rest over', 'Time for your next set.')
    }
    if (endsAt <= Date.now()) {
      fire()
      return
    }
    setEndedAt(null)
    // Optimistic and server timestamps differ slightly: treat them as one rest.
    if (announced.current === null || Math.abs(announced.current - endsAt) > 3000) {
      announced.current = endsAt
      // logSet already announced the rest as part of its sentence.
      if (Date.now() >= quietUntil.current) {
        const m = Math.floor(total / 60)
        const s = total % 60
        announce(`Rest started, ${m ? `${m} minute${m > 1 ? 's' : ''}` : ''}${m && s ? ' ' : ''}${s ? `${s} seconds` : ''}.`)
      }
    }
    const t = setTimeout(fire, endsAt - Date.now())
    // Background tabs throttle timers; re-check as soon as we're visible again.
    const onVisible = () => document.visibilityState === 'visible' && endsAt <= Date.now() && fire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [endsAt, total])

  // "Rest over" lingers a few minutes as a quiet reminder, then goes away.
  useEffect(() => {
    if (endedAt === null) return
    const t = setTimeout(() => setEndedAt(null), 5 * 60_000)
    return () => clearTimeout(t)
  }, [endedAt])

  return { endsAt: endsAt && endsAt > Date.now() - 500 ? endsAt : null, total, endedAt, dismiss: () => setEndedAt(null) }
}

function tabsFor(tracking: WorkoutExercise['exercise']['tracking']): KeypadField[] {
  if (tracking === 'reps') return ['reps', 'rir']
  if (tracking === 'duration') return ['duration']
  return ['weight', 'reps', 'rir']
}

function fieldLabel(f: KeypadField, tracking: string, unit: string) {
  if (f === 'weight') return tracking === 'weighted_bodyweight' ? `+${unit}` : unit
  if (f === 'reps') return 'Reps'
  if (f === 'duration') return 'Seconds'
  return 'RIR'
}

/** Plate-sized steps: bigger jumps for barbells and machines in lb. */
function stepFor(we: WorkoutExercise, field: KeypadField, unit: Unit) {
  if (field === 'duration') return 5
  if (field !== 'weight') return 1
  if (unit === 'kg') return 2.5
  const eq = we.exercise.equipment.join(' ').toLowerCase()
  return /barbell|smith|machine|leg press|hack/.test(eq) ? 5 : 2.5
}

/** Where the keypad goes after logging: next exercise in a superset round, else this exercise's next set. */
function nextTarget(w: ActiveWorkout, we: WorkoutExercise, setIndex: number) {
  const idx = w.exercises.findIndex((x) => x._id === we._id)
  const undoneAt = (x: WorkoutExercise, k: number) => {
    const i = x.sets.findIndex((s, j) => !s.done && s.kind !== 'warmup' && workingIndex(x, j) === k)
    return i >= 0 ? { we: x, index: i } : null
  }
  if (we.group) {
    let start = idx
    while (start > 0 && w.exercises[start - 1].group === we.group) start--
    let end = idx
    while (end < w.exercises.length - 1 && w.exercises[end + 1].group === we.group) end++
    const members = w.exercises.slice(start, end + 1)
    if (members.length > 1) {
      const k = workingIndex(we, setIndex)
      for (const m of members.slice(idx - start + 1)) {
        const hit = undoneAt(m, k)
        if (hit) return hit
      }
      for (const m of members) {
        const hit = undoneAt(m, k + 1)
        if (hit) return hit
      }
      return null
    }
  }
  const j = we.sets.findIndex((s, i) => i > setIndex && !s.done)
  return j >= 0 ? { we, index: j } : null
}

function LiveWorkout() {
  const workout = useQuery(api.workouts.active)
  const navigate = useNavigate()
  const unit = useUnit()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [menu, setMenu] = useState<Menu>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [prFlash, setPrFlash] = useState(0)
  const lastToggle = useRef(new Map<string, number>())
  const quietUntil = useRef(0)
  const focusAfter = useRef<string | null>(null)
  useWakeLock(Boolean(workout))
  const rest = useRest(workout, quietUntil)

  // Toasts sit just above whatever occupies the bottom: keypad, rest strip, or nothing.
  const bottomLayer = editing ? 430 : rest.endsAt || rest.endedAt ? 96 : 16
  useEffect(() => {
    document.documentElement.style.setProperty('--toast-bottom', `${bottomLayer}px`)
    return () => {
      document.documentElement.style.removeProperty('--toast-bottom')
    }
  }, [bottomLayer])

  // Put keyboard/screen-reader focus somewhere sensible after the keypad closes or cards fold.
  useEffect(() => {
    if (!focusAfter.current) return
    const target = document.getElementById(focusAfter.current)
    focusAfter.current = null
    target?.focus({ preventScroll: true })
  })

  const online = useOnline()
  const wasOnline = useRef(true)
  useEffect(() => {
    if (wasOnline.current === online) return
    wasOnline.current = online
    announce(online ? 'Back online. Everything is saved.' : 'Offline. Sets will save when you are back online.')
  }, [online])

  // PR/info toasts sit below the workout header instead of covering Finish.


  // Mutations with optimistic updates for instant feel.
  const updateSetMut = useMutation(api.workouts.updateSet).withOptimisticUpdate((store, args) => {
    const patch: Partial<WorkoutSet> = {}
    for (const k of ['weightKg', 'reps', 'rir', 'durationSec'] as const) {
      if (args[k] !== undefined) patch[k] = args[k] ?? undefined
    }
    if (args.kind) patch.kind = args.kind
    patchActiveSet(store, args.setId, patch)
  })
  const completeSetMut = useMutation(api.workouts.completeSet).withOptimisticUpdate((store, args) => {
    const patch: Partial<WorkoutSet> = { done: true, doneAt: Date.now() }
    for (const k of ['weightKg', 'reps', 'rir', 'durationSec'] as const) {
      if (args[k] !== undefined) patch[k] = args[k] ?? undefined
    }
    patchActiveSet(store, args.setId, patch, (w, we) => {
      const r = restAfter(w, we)
      return r > 0 ? { restEndsAt: Date.now() + r * 1000, restTotalSec: r } : {}
    })
  })
  const uncompleteSetMut = useMutation(api.workouts.uncompleteSet).withOptimisticUpdate((store, args) => {
    const cur = store.getQuery(api.workouts.active, {})
    const set = cur?.exercises.flatMap((x) => x.sets).find((s) => s._id === args.setId)
    const restStart = cur?.restEndsAt ? cur.restEndsAt - (cur.restTotalSec ?? 0) * 1000 : null
    const startedRest = restStart !== null && set?.doneAt !== undefined && Math.abs(set.doneAt - restStart) < 3000
    patchActiveSet(store, args.setId, { done: false, doneAt: undefined, isPr: false }, () => (startedRest ? { restEndsAt: undefined } : {}))
  })
  const restMut = useMutation(api.workouts.rest).withOptimisticUpdate((store, args) => {
    const cur = store.getQuery(api.workouts.active, {})
    if (!cur) return
    if (args.skip || !cur.restEndsAt) store.setQuery(api.workouts.active, {}, { ...cur, restEndsAt: undefined })
    else
      store.setQuery(api.workouts.active, {}, {
        ...cur,
        restEndsAt: Math.max(Date.now(), cur.restEndsAt + (args.addSec ?? 0) * 1000),
        restTotalSec: Math.max(1, (cur.restTotalSec ?? 0) + (args.addSec ?? 0)),
      })
  })
  // Every set change is also written to a durable outbox until the server confirms it.
  const updateSet = (args: Parameters<typeof updateSetMut>[0]) => track('updateSet', args, updateSetMut(args))
  const completeSet = (args: Parameters<typeof completeSetMut>[0]) => track('completeSet', args, completeSetMut(args))
  const uncompleteSet = (args: Parameters<typeof uncompleteSetMut>[0]) => track('uncompleteSet', args, uncompleteSetMut(args))
  const addSet = useMutation(api.workouts.addSet)
  const removeSet = useMutation(api.workouts.removeSet)
  const addExercise = useMutation(api.workouts.addExercise)
  const removeExercise = useMutation(api.workouts.removeExercise)
  const swapExercise = useMutation(api.workouts.swapExercise)
  const updateExercise = useMutation(api.workouts.updateExercise)
  const finish = useMutation(api.workouts.finish)
  const discard = useMutation(api.workouts.remove)

  // Keep a copy of the live workout so it can be shown if the app reopens without signal.
  useEffect(() => {
    try {
      if (workout) localStorage.setItem('lift:last-workout', JSON.stringify(workout))
      else if (workout === null) localStorage.removeItem('lift:last-workout')
    } catch {
      // ignore
    }
  }, [workout])

  const blocks = useMemo(() => (workout ? toBlocks(workout.exercises) : []), [workout])
  const weById = useMemo(() => new Map(workout?.exercises.map((we) => [we._id, we]) ?? []), [workout])

  if (workout === undefined && !online) return <OfflineWorkout />
  if (workout === undefined) {
    return (
      <main className="page space-y-4 pt-16">
        <BlockSkeleton h={60} />
        <BlockSkeleton h={260} />
        <BlockSkeleton h={260} />
      </main>
    )
  }
  if (workout === null) {
    return (
      <main className="page flex min-h-dvh flex-col items-center justify-center text-center">
        <h1 className="t-screen">No workout in progress</h1>
        <p className="mt-2 text-muted">Start one from your week.</p>
        <Link to="/" className="btn btn-primary mt-6">Go to Train</Link>
      </main>
    )
  }

  // ----- value helpers -----
  const serverValue = (set: WorkoutSet, field: KeypadField): number | undefined =>
    field === 'weight' ? set.weightKg : field === 'reps' ? set.reps : field === 'rir' ? set.rir : set.durationSec

  const displayValue = (we: WorkoutExercise, set: WorkoutSet, index: number, field: KeypadField): { text: string; suggested: boolean } => {
    const v = serverValue(set, field)
    if (v !== undefined) return { text: field === 'weight' ? fmtNum(toDisplayWeight(v, unit)) : String(v), suggested: false }
    if (set.done || field === 'rir') return { text: '', suggested: false }
    const s = suggestFor(we, index)
    const sv = field === 'weight' ? s.weightKg : field === 'reps' ? s.reps : s.durationSec
    if (sv === null || sv === undefined) return { text: '', suggested: true }
    return { text: field === 'weight' ? fmtNum(toDisplayWeight(sv, unit)) : String(sv), suggested: true }
  }

  const toServer = (we: WorkoutExercise, field: KeypadField, text: string): number | null => {
    if (text === '' || text === '.') return null
    const n = Number.parseFloat(text)
    if (!Number.isFinite(n)) return null
    if (field === 'weight') {
      // 0 kg on a loaded lift means "not entered", not an empty bar.
      if (n === 0 && we.exercise.tracking === 'weight_reps') return null
      return fromDisplayWeight(n, unit)
    }
    return n
  }

  const argKey = (f: KeypadField) =>
    (f === 'weight' ? 'weightKg' : f === 'reps' ? 'reps' : f === 'rir' ? 'rir' : 'durationSec') as 'weightKg' | 'reps' | 'rir' | 'durationSec'

  /** A typo like 12000 kg would become a permanent PR — ask once before keeping it. */
  const implausible = (we: WorkoutExercise, field: KeypadField, text: string): string | null => {
    const n = Number.parseFloat(text)
    if (!Number.isFinite(n)) return null
    if (field === 'weight') {
      const kg = fromDisplayWeight(n, unit)
      const ref = Math.max(we.best?.weightKg ?? 0, ...we.previous.map((p) => p.weightKg ?? 0))
      if (kg > 1000) return `That’s over 1000 kg — fix the number.`
      // Relative to this lifter's own history when there is one; generous otherwise.
      const limit = ref > 0 ? Math.max(ref * 2.5, ref + 40) : 300
      if (kg > limit) return `${fmtNum(n)} ${unit} is far above your usual. Tap again to keep it.`
    }
    if (field === 'reps' && n > 60) return `${n} reps is a lot. Tap again to keep it.`
    if (field === 'duration' && n > 3600) return `That’s over an hour. Tap again to keep it.`
    return null
  }

  /** Returns false (and shows a warning) if the draft needs a second confirmation. */
  const passes = (e: Editing): boolean => {
    const we = weById.get(e.weId)
    if (!we || e.draft === e.initial) return true
    const w = implausible(we, e.field, e.draft)
    if (!w) return true
    if (w.startsWith('That’s over 1000')) {
      setEditing({ ...e, warned: undefined })
      toast(w, { tone: 'error' })
      return false
    }
    if (e.warned === e.draft) return true
    setEditing({ ...e, warned: e.draft })
    tap('heavy')
    return false
  }

  function openKeypad(we: WorkoutExercise, set: WorkoutSet, index: number, field: KeypadField) {
    tap()
    if (editing && !commitEditing()) return
    const { text } = displayValue(we, set, index, field)
    setEditing({ setId: set._id, weId: we._id, field, draft: text, initial: text, fresh: true })
    requestAnimationFrame(() => {
      document.getElementById(`set-${set._id}`)?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })
    })
  }

  /** Save the open field if it changed. Returns false if the value needs confirming first. */
  function commitEditing(e: Editing | null = editing): boolean {
    if (!e) return true
    const we = weById.get(e.weId)
    const set = we?.sets.find((s) => s._id === e.setId)
    if (!we || !set) return true
    if (e.draft === e.initial) return true
    if (!passes(e)) return false
    const value = toServer(we, e.field, e.draft)
    if ((value ?? undefined) !== serverValue(set, e.field)) {
      updateSet({ setId: set._id, [argKey(e.field)]: value }).catch((err: unknown) =>
        toast(errorText(err, 'Could not save that value.'), { tone: 'error' }),
      )
    }
    return true
  }

  async function logSet(we: WorkoutExercise, set: WorkoutSet, index: number, e: Editing | null) {
    unlockAudio()
    // Ticking a different set must not throw away what was being typed elsewhere.
    if (e && e.setId !== set._id && !commitEditing(e)) return
    const own = e && e.setId === set._id ? e : null
    if (own && !passes(own)) return
    const values: Record<string, number | null> = {}
    for (const f of tabsFor(we.exercise.tracking)) {
      if (own && own.field === f && own.draft !== own.initial) values[argKey(f)] = toServer(we, f, own.draft)
      else {
        const v = serverValue(set, f)
        if (v !== undefined) values[argKey(f)] = v
        else if (f !== 'rir') {
          const s = suggestFor(we, index)
          const sv = f === 'weight' ? s.weightKg : f === 'reps' ? s.reps : s.durationSec
          if (sv !== null) values[argKey(f)] = sv
        }
      }
    }
    // Require the essential value before logging.
    const missing: KeypadField | null =
      we.exercise.tracking === 'duration' ? (values.durationSec == null ? 'duration' : null) : values.reps == null ? 'reps' : null
    if (missing) {
      setEditing(null)
      openKeypad(we, set, index, missing)
      return
    }
    tap('success')
    rest.dismiss()
    askNotifyPermission()
    const restSec = restAfter(workout!, we)
    const said = [`Set ${setLabel(set, workingIndex(we, index), null)} of ${we.exercise.name} logged.`, restSec ? `Rest ${fmtClock(restSec)}.` : '']
    quietUntil.current = Date.now() + 1500

    // Keep the keypad open on the next set (superset partner first), prefilled.
    if (own) {
      const patched = { ...we, sets: we.sets.map((s) => (s._id === set._id ? { ...s, ...clean(values), done: true } : s)) }
      const w2 = { ...workout!, exercises: workout!.exercises.map((x) => (x._id === we._id ? patched : x)) }
      const next = nextTarget(w2, patched, index)
      if (next) {
        const nwe = next.we._id === we._id ? patched : next.we
        const nset = nwe.sets[next.index]
        // Bodyweight-plus-load with no load suggested: start on reps, not an empty "+kg".
        const loadSuggested = suggestFor(nwe, next.index).weightKg
        const field =
          nwe.exercise.tracking === 'weighted_bodyweight' && !loadSuggested && nset.weightKg === undefined ? 'reps' : tabsFor(nwe.exercise.tracking)[0]
        const { text } = displayValue(nwe, nset, next.index, field)
        setEditing({ setId: nset._id, weId: nwe._id, field, draft: text, initial: text, fresh: true, auto: true })
        said.push(`Next: ${nwe._id === we._id ? '' : `${nwe.exercise.name}, `}set ${workingIndex(nwe, next.index) + 1}, ${fieldLabel(field, nwe.exercise.tracking, unit)} ${text || 'empty'}.`)
        requestAnimationFrame(() =>
          document.getElementById(`set-${nset._id}`)?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' }),
        )
      } else {
        setEditing(null)
        focusAfter.current = `tick-${set._id}`
      }
    } else if (e?.setId === set._id) setEditing(null)
    announce(said.filter(Boolean).join(' '))

    try {
      const res = await completeSet({ setId: set._id, ...values })
      if (res.isPr) {
        tap('heavy')
        setPrFlash(Date.now())
        toast(`New PR · ${we.exercise.name}`, {
          tone: 'pr',
          ms: 5000,
          action: {
            label: 'Undo',
            run: () => {
              void uncompleteSet({ setId: set._id })
              const field = tabsFor(we.exercise.tracking)[0]
              const text = field === 'weight' ? fmtNum(toDisplayWeight(values.weightKg ?? null, unit)) : String(values[argKey(field)] ?? '')
              setEditing({ setId: set._id, weId: we._id, field, draft: text, initial: text, fresh: true })
            },
          },
        })
      }
    } catch (err) {
      toast(errorText(err, 'Could not save that set. Check your connection.'), { tone: 'error' })
    }
  }

  function toggleSet(we: WorkoutExercise, set: WorkoutSet, index: number) {
    // A double tap must not log and immediately un-log the set.
    const last = lastToggle.current.get(set._id) ?? 0
    if (Date.now() - last < 600) return
    lastToggle.current.set(set._id, Date.now())
    if (set.done) {
      tap()
      void uncompleteSet({ setId: set._id })
      announce(`Set ${index + 1} marked not done.`)
      return
    }
    void logSet(we, set, index, editing)
  }

  // ----- keypad wiring -----
  const editingWe = editing ? weById.get(editing.weId) : undefined
  const editingSet = editingWe?.sets.find((s) => s._id === editing?.setId)
  const editingIndex = editingWe && editingSet ? editingWe.sets.indexOf(editingSet) : -1
  const fields = editingWe ? tabsFor(editingWe.exercise.tracking) : []
  const mainFields = fields.filter((f): f is MainField => f !== 'rir')
  const blockOf = editingWe ? blocks.find((b) => b.items.some((i) => i.we._id === editingWe._id)) : undefined
  const letter = blockOf?.items.find((i) => i.we._id === editingWe?._id)?.letter ?? null
  // If the set being edited disappears (deleted elsewhere), close the keypad.
  if (editing && !editingSet) queueMicrotask(() => setEditing(null))

  const keypadTabs: KeypadTab[] =
    editingWe && editingSet
      ? fields.map((f) => ({
          field: f,
          label: fieldLabel(f, editingWe.exercise.tracking, unit),
          value: f === editing?.field ? editing.draft : displayValue(editingWe, editingSet, editingIndex, f).text,
        }))
      : []

  const switchField = (f: KeypadField) => {
    if (!editing || !editingWe || !editingSet || !commitEditing()) return
    const { text } = displayValue(editingWe, editingSet, editingIndex, f)
    setEditing({ ...editing, field: f, draft: text, initial: text, fresh: true, warned: undefined })
  }

  const nextField = () => {
    if (!editing || !editingWe || !editingSet) return
    const i = (mainFields as KeypadField[]).indexOf(editing.field)
    if (editing.field === 'rir' || i === mainFields.length - 1) {
      void logSet(editingWe, editingSet, editingIndex, editing)
      return
    }
    switchField(mainFields[i + 1])
  }

  const openMenu = (m: Menu) => {
    if (!commitEditing()) return
    setEditing(null)
    setMenu(m)
  }

  const doneSets = workout.exercises.reduce((n, we) => n + we.sets.filter((s) => s.done).length, 0)
  const totalSets = workout.exercises.reduce((n, we) => n + we.sets.length, 0)

  // What's next (shown on the rest strip).
  const upNext = (() => {
    for (const we of workout.exercises) {
      const i = we.sets.findIndex((s) => !s.done)
      if (i < 0) continue
      const s = suggestFor(we, i)
      const what =
        we.exercise.tracking === 'duration'
          ? s.durationSec ? `${s.durationSec}s` : ''
          : s.weightKg ? `${fmtWeight(s.weightKg, unit)} × ${s.reps ?? '?'}` : s.reps ? `${s.reps} reps` : ''
      return { setId: we.sets[i]._id, text: `${we.exercise.name}${what ? ` · ${what}` : ''}` }
    }
    return null
  })()

  return (
    <div className="min-h-dvh">
      <Header
        workout={workout}
        done={doneSets}
        total={totalSets}
        online={online}
        prFlash={prFlash}
        onFinish={() => openMenu({ type: 'finish' })}
      />

      <main className={`mx-auto max-w-[680px] px-3 pt-3 min-[390px]:px-4 ${editing ? 'pb-[460px]' : 'pb-[calc(var(--safe-bottom)+150px)]'}`}>
        {workout.exercises.length === 0 && (
          <div className="py-16 text-center animate-fade">
            <h2 className="t-screen">Empty workout</h2>
            <p className="mt-2 text-muted">Add exercises as you go.</p>
          </div>
        )}

        <div className="space-y-3">
          {blocks.map((block, bi) => (
            <section
              key={block.items[0].we._id}
              aria-label={block.group ? `Superset: ${block.items.map((i) => i.we.exercise.name).join(' and ')}` : undefined}
              className={`animate-rise ${block.group ? 'rounded-[22px] bg-surface/60 py-1 pl-2.5' : ''}`}
              style={{ animationDelay: `${Math.min(bi, 6) * 30}ms` }}
            >
              {block.group && (
                <div className="flex items-center gap-2 px-1 pb-1 pt-3 text-accent">
                  <Link2 aria-hidden className="size-3.5" />
                  <span className="t-eyebrow">Superset · {Math.max(...block.items.map((i) => i.we.sets.length))} rounds</span>
                </div>
              )}
              <div className={block.group ? 'border-l-2 border-accent/25' : ''}>
                {block.items.map(({ we, letter }) => {
                  const allDone = we.sets.length > 0 && we.sets.every((s) => s.done)
                  const folded = allDone && !expanded.has(we._id) && editing?.weId !== we._id
                  return folded ? (
                    <FoldedCard
                      key={we._id}
                      we={we}
                      letter={letter}
                      inSuperset={Boolean(block.group)}
                      onExpand={() => {
                        focusAfter.current = `ex-${we._id}`
                        setExpanded(new Set(expanded).add(we._id))
                      }}
                    />
                  ) : (
                    <ExerciseCard
                      key={we._id}
                      we={we}
                      letter={letter}
                      inSuperset={Boolean(block.group)}
                      editing={editing}
                      displayValue={displayValue}
                      onCell={openKeypad}
                      onToggle={toggleSet}
                      onSetMenu={(set, label) => openMenu({ type: 'set', set, we, label })}
                      onMenu={() => openMenu({ type: 'exercise', we, index: workout.exercises.indexOf(we) })}
                      onInfo={() => openMenu({ type: 'info', we })}
                      onRest={() => openMenu({ type: 'rest', we })}
                      onCollapse={
                        allDone
                          ? () => {
                              const n = new Set(expanded)
                              n.delete(we._id)
                              focusAfter.current = `fold-${we._id}`
                              setExpanded(n)
                            }
                          : undefined
                      }
                      onAddSet={async () => {
                        tap()
                        try {
                          await addSet({ workoutExerciseId: we._id })
                        } catch (err) {
                          toast(errorText(err, 'Could not add a set.'), { tone: 'error' })
                        }
                      }}
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <button onClick={() => openMenu({ type: 'add' })} className="btn btn-secondary mt-6 w-full">
          <Plus className="size-5" /> Add exercise
        </button>
        <button onClick={() => openMenu({ type: 'discard' })} className="mx-auto mt-6 block h-11 px-4 text-[14px] font-[560] text-danger hover:underline">
          Discard workout
        </button>
      </main>

      {!editing && (
        <RestStrip
          rest={rest}
          upNext={upNext}
          onAdjust={(addSec) => restMut({ workoutId: workout._id, addSec })}
          onSkip={() => restMut({ workoutId: workout._id, skip: true })}
        />
      )}

      {editing && editingWe && editingSet && (
        <Keypad
          context={`${editingWe.exercise.name} · Set ${setLabel(editingSet, workingIndex(editingWe, editingIndex), letter)} of ${editingWe.sets.length}`}
          target={editingWe.repLow || editingWe.repHigh ? { low: editingWe.repLow ?? 0, high: editingWe.repHigh ?? editingWe.repLow ?? 0 } : null}
          warning={editing.warned && editing.warned === editing.draft ? implausible(editingWe, editing.field, editing.draft) : null}
          tabs={keypadTabs}
          field={editing.field}
          value={editing.draft}
          fresh={editing.fresh}
          step={stepFor(editingWe, editing.field, unit)}
          focusKey={editing.setId}
          quiet={editing.auto}
          nextLabel={editing.field === mainFields[mainFields.length - 1] ? 'Log set' : 'Next'}
          accessory={<RestPill rest={rest} />}
          onInput={(draft, fresh) => setEditing({ ...editing, draft, fresh, auto: false })}
          onField={switchField}
          onNext={nextField}
          onDone={() => void logSet(editingWe, editingSet, editingIndex, editing)}
          onClose={() => {
            if (!commitEditing()) return
            focusAfter.current = `cell-${editing.setId}-${editing.field}`
            setEditing(null)
          }}
        />
      )}

      {/* ---------------- sheets ---------------- */}
      <Sheet open={menu?.type === 'exercise'} onClose={() => setMenu(null)} title={menu?.type === 'exercise' ? menu.we.exercise.name : ''}>
        {menu?.type === 'exercise' && (
          <ExerciseMenu
            workout={workout}
            we={menu.we}
            index={menu.index}
            close={() => setMenu(null)}
            open={(m) => setMenu(m)}
            update={updateExercise}
            remove={async () => {
              setMenu(null)
              await removeExercise({ workoutExerciseId: menu.we._id })
              toast(`Removed ${menu.we.exercise.name}`)
            }}
          />
        )}
      </Sheet>

      <Sheet open={menu?.type === 'set'} onClose={() => setMenu(null)} title={menu?.type === 'set' ? `Set ${menu.label}` : ''}>
        {menu?.type === 'set' && (
          <div className="pb-2">
            {menu.set.isPr && (
              <div className="mb-3 rounded-[16px] bg-pr/[0.06] px-4 py-3 shadow-[inset_2px_0_0_var(--color-pr)]">
                <div className="flex items-center gap-1.5 text-[13px] font-[550] text-pr">
                  <Medal aria-hidden className="size-3.5" /> Personal record
                </div>
                <div className="num mt-1 text-[20px] font-[550]">{fmtSet(menu.set, menu.we.exercise.tracking, unit)}</div>
                {menu.we.best && (
                  <div className="num mt-0.5 text-[13px] text-muted">
                    Previous best: {fmtSet({ weightKg: menu.we.best.weightKg, reps: menu.we.best.reps }, menu.we.exercise.tracking, unit)}
                  </div>
                )}
              </div>
            )}
            {(
              [
                ['working', 'Working set', 'Counts toward volume and PRs'],
                ['warmup', 'Warm-up', 'Excluded from stats'],
                ['drop', 'Drop set', 'Reduced weight, straight after'],
                ['failure', 'To failure', 'Taken to 0 reps in reserve'],
              ] as const
            ).map(([kind, label, hint]) => (
              <SheetAction
                key={kind}
                icon={
                  menu.set.kind === kind ? <Check className="size-4 text-accent" strokeWidth={2.6} /> : <span className="text-[13px] font-[700]">{kind[0].toUpperCase()}</span>
                }
                label={`${label}${menu.set.kind === kind ? ' (current)' : ''}`}
                hint={hint}
                onClick={() => {
                  void updateSet({ setId: menu.set._id, kind })
                  setMenu(null)
                }}
              />
            ))}
            {menu.set.done && (
              <SheetAction
                icon={<X className="size-4" />}
                label="Mark not done"
                onClick={() => {
                  void uncompleteSet({ setId: menu.set._id })
                  setMenu(null)
                }}
              />
            )}
            <SheetDivider />
            <SheetAction
              icon={<Trash2 className="size-5" />}
              label="Delete set"
              tone="danger"
              onClick={() => {
                void removeSet({ setId: menu.set._id })
                setMenu(null)
              }}
            />
          </div>
        )}
      </Sheet>

      <Sheet open={menu?.type === 'rest'} onClose={() => setMenu(null)} title="Rest timer">
        {menu?.type === 'rest' && (
          <div className="pb-2">
            <p className="text-[14px] text-muted">After each set of {menu.we.exercise.name}.</p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[0, 30, 45, 60, 90, 120, 150, 180, 240, 300].map((sec) => (
                <button
                  key={sec}
                  onClick={() => {
                    void updateExercise({ workoutExerciseId: menu.we._id, restSec: sec })
                    setMenu(null)
                  }}
                  aria-pressed={menu.we.restSec === sec}
                  className={`press num h-12 rounded-[14px] text-[16px] font-[600] ${menu.we.restSec === sec ? 'bg-accent text-accent-ink' : 'bg-raised'}`}
                >
                  {sec === 0 ? 'Off' : fmtClock(sec)}
                </button>
              ))}
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={menu?.type === 'notes'} onClose={() => setMenu(null)} title="Note">
        {menu?.type === 'notes' && (
          <NoteEditor
            initial={menu.we.notes ?? ''}
            onSave={(notes) => {
              void updateExercise({ workoutExerciseId: menu.we._id, notes: notes || null })
              setMenu(null)
            }}
          />
        )}
      </Sheet>

      <Sheet open={menu?.type === 'info'} onClose={() => setMenu(null)} title={menu?.type === 'info' ? menu.we.exercise.name : ''} size="tall">
        {menu?.type === 'info' && <ExerciseInfo id={menu.we.exercise._id} />}
      </Sheet>

      <ExercisePicker
        open={menu?.type === 'add'}
        multi
        onClose={() => setMenu(null)}
        onPick={async (picked) => {
          setMenu(null)
          for (const p of picked) await addExercise({ workoutId: workout._id, exerciseId: p._id })
          tap('success')
          announce(`Added ${picked.map((p) => p.name).join(', ')}.`)
          requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' }))
        }}
      />
      <ExercisePicker
        open={menu?.type === 'swap'}
        title="Replace with"
        onClose={() => setMenu(null)}
        onPick={async ([p]) => {
          if (menu?.type !== 'swap' || !p) return
          const from = menu.we.exercise.name
          setMenu(null)
          await swapExercise({ workoutExerciseId: menu.we._id, exerciseId: p._id })
          toast(`Swapped ${from} → ${p.name}`)
        }}
      />

      <Sheet open={menu?.type === 'finish'} onClose={() => setMenu(null)} title="Finish workout?">
        {menu?.type === 'finish' && (
          <FinishPanel
            workout={workout}
            done={doneSets}
            total={totalSets}
            online={online}
            onFinish={async (notes) => {
              let id: Id<'workouts'>
              try {
                id = await finish({ workoutId: workout._id, notes: notes || undefined })
              } catch (err) {
                toast(errorText(err, 'Could not finish — check your connection and try again.'), { tone: 'error' })
                return
              }
              tap('success')
              setMenu(null)
              navigate({ to: '/history/$workoutId', params: { workoutId: id }, search: { done: 1 }, replace: true })
            }}
            onCancel={() => setMenu(null)}
          />
        )}
      </Sheet>

      <Sheet open={menu?.type === 'discard'} onClose={() => setMenu(null)} title="Discard this workout?">
        <p className="text-[15px] text-muted">
          {doneSets === 0 ? 'Nothing is logged yet.' : `All ${doneSets} logged set${doneSets > 1 ? 's' : ''} will be deleted. This can’t be undone.`}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2 pb-2">
          <button className="btn btn-secondary" onClick={() => setMenu(null)}>Keep training</button>
          <button
            className="btn bg-danger/15 text-danger"
            onClick={async () => {
              setMenu(null)
              await discard({ workoutId: workout._id })
              navigate({ to: '/', replace: true })
            }}
          >
            Discard
          </button>
        </div>
      </Sheet>
    </div>
  )
}

function clean(values: Record<string, number | null>) {
  const out: Partial<WorkoutSet> = {}
  for (const [k, v] of Object.entries(values)) (out as Record<string, number | undefined>)[k] = v ?? undefined
  return out
}

function errorText(err: unknown, fallback: string) {
  const data = (err as { data?: unknown })?.data
  return typeof data === 'string' ? data : fallback
}

// ---------------------------------------------------------------------------

function Header({
  workout,
  done,
  total,
  online,
  prFlash,
  onFinish,
}: {
  workout: ActiveWorkout
  done: number
  total: number
  online: boolean
  prFlash: number
  onFinish: () => void
}) {
  const now = useNow(1000)
  const pct = total ? done / total : 0
  const gold = now - prFlash < 1400
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-black/80 pt-[var(--safe-top)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-[60px] max-w-[680px] items-center gap-2 px-2">
        <Link to="/" className="icon-btn" aria-label="Minimize workout">
          <ChevronDown className="size-6" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-[650] tracking-[-0.01em]">{workout.title}</h1>
          <div className="num flex items-center gap-1.5 text-[13px] text-muted">
            <span aria-hidden>{fmtClock((now - workout.startedAt) / 1000)}</span>
            <span className="sr-only">{Math.floor((now - workout.startedAt) / 60000)} minutes in,</span>
            <span aria-hidden>·</span>
            <span>
              {done}/{total} sets
            </span>
            {!online && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[12px] font-[600] text-warning">
                <CloudOff aria-hidden className="size-3" /> Offline · saving when back
              </span>
            )}
          </div>
        </div>
        <button onClick={onFinish} className="btn btn-sm btn-primary mr-1 h-11">
          Finish
        </button>
      </div>
      <div className="h-[2px] bg-line" role="progressbar" aria-label="Sets done" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div
          className={`h-full transition-[width,background-color] duration-500 ease-out ${gold ? 'bg-pr' : 'bg-accent'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </header>
  )
}

function prevLabel(we: WorkoutExercise, i: number, unit: Unit) {
  const t = we.exercise.tracking
  const prev = previousFor(we, i)
  if (!prev) return '—'
  return fmtSet(prev, t, unit)
}

function FoldedCard({ we, letter, inSuperset, onExpand }: { we: WorkoutExercise; letter: string | null; inSuperset: boolean; onExpand: () => void }) {
  const unit = useUnit()
  const t = we.exercise.tracking
  const summary = we.sets
    .filter((s) => s.kind !== 'warmup')
    .map((s) => (t === 'duration' ? `${fmtNum(s.durationSec)}s` : s.weightKg ? `${fmtWeight(s.weightKg, unit)}×${s.reps ?? '—'}` : `${s.reps ?? '—'}`))
    .join(' · ')
  const prs = we.sets.filter((s) => s.isPr).length
  return (
    <button
      id={`fold-${we._id}`}
      onClick={onExpand}
      aria-expanded={false}
      aria-label={`${we.exercise.name}, done: ${summary}${prs ? `, ${prs} personal record` : ''}. Show sets`}
      className={`press flex w-full items-center gap-3 text-left ${inSuperset ? 'py-2.5 pl-3 pr-2' : 'card px-4 py-3'} animate-fade`}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
        <Check aria-hidden className="size-[18px]" strokeWidth={2.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {letter && <span className="num grid size-5 shrink-0 place-items-center rounded-md bg-accent/15 text-[11px] font-[750] text-accent">{letter}</span>}
          <span className="truncate text-[15px] font-[600] text-ink/90">{we.exercise.name}</span>
          {prs > 0 && <Trophy aria-hidden className="size-3.5 shrink-0 text-pr" />}
        </span>
        <span className="num block truncate text-[13px] text-muted">{summary}</span>
      </span>
      <ChevronDown aria-hidden className="size-5 shrink-0 text-subtle" />
    </button>
  )
}

const ExerciseCard = memo(function ExerciseCard({
  we,
  letter,
  inSuperset,
  editing,
  displayValue,
  onCell,
  onToggle,
  onSetMenu,
  onMenu,
  onInfo,
  onRest,
  onAddSet,
  onCollapse,
}: {
  we: WorkoutExercise
  letter: string | null
  inSuperset: boolean
  editing: Editing | null
  displayValue: (we: WorkoutExercise, set: WorkoutSet, index: number, field: KeypadField) => { text: string; suggested: boolean }
  onCell: (we: WorkoutExercise, set: WorkoutSet, index: number, field: KeypadField) => void
  onToggle: (we: WorkoutExercise, set: WorkoutSet, index: number) => void
  onSetMenu: (set: WorkoutSet, label: string) => void
  onMenu: () => void
  onInfo: () => void
  onRest: () => void
  onAddSet: () => void
  onCollapse?: () => void
}) {
  const unit = useUnit()
  const t = we.exercise.tracking
  const cols: KeypadField[] = t === 'reps' ? ['reps', 'rir'] : t === 'duration' ? ['duration'] : ['weight', 'reps', 'rir']
  const allDone = we.sets.length > 0 && we.sets.every((s) => s.done)
  // On narrow screens the "Previous" column moves under each row so inputs keep their size.
  // Superset blocks lose ~14px to their rail, so they switch a little earlier (430px).
  const grid = inSuperset
    ? cols.length === 3
      ? 'grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_40px_44px] min-[430px]:grid-cols-[44px_minmax(0,1fr)_62px_62px_42px_46px]'
      : cols.length === 2
        ? 'grid-cols-[40px_minmax(0,1fr)_52px_44px] min-[430px]:grid-cols-[44px_minmax(0,1fr)_72px_52px_46px]'
        : 'grid-cols-[40px_minmax(0,1fr)_44px] min-[430px]:grid-cols-[44px_minmax(0,1fr)_88px_46px]'
    : cols.length === 3
      ? 'grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_40px_44px] min-[390px]:grid-cols-[44px_minmax(0,1fr)_62px_62px_42px_46px]'
      : cols.length === 2
        ? 'grid-cols-[40px_minmax(0,1fr)_52px_44px] min-[390px]:grid-cols-[44px_minmax(0,1fr)_72px_52px_46px]'
        : 'grid-cols-[40px_minmax(0,1fr)_44px] min-[390px]:grid-cols-[44px_minmax(0,1fr)_88px_46px]'
  const narrowHide = inSuperset ? 'max-[429px]:hidden' : 'max-[389px]:hidden'
  const narrowShow = inSuperset ? 'max-[429px]:block' : 'max-[389px]:block'
  return (
    <article className={`${inSuperset ? 'pl-2.5 pr-1' : 'card'} pb-2 pt-4`}>
      <div className={`flex items-start gap-3 ${inSuperset ? '' : 'px-3 min-[390px]:px-4'}`}>
        <button onClick={onInfo} className="press shrink-0" aria-label={`About ${we.exercise.name}`}>
          <ExerciseThumb src={we.exercise.thumbnailUrl} size={46} />
        </button>
        <button onClick={onInfo} className="min-w-0 flex-1 pt-0.5 text-left">
          <div className="flex items-start gap-2">
            {letter && <span className="num mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-accent/15 text-[11px] font-[750] text-accent">{letter}</span>}
            <h2 id={`ex-${we._id}`} tabIndex={-1} className={`line-clamp-2 text-[18px] font-[600] leading-6 tracking-[-0.015em] outline-none ${allDone ? 'text-muted' : ''}`}>{we.exercise.name}</h2>
          </div>
          <div className="num mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">
            {we.repLow ? <span>{fmtReps(we.repLow, we.repHigh)} reps</span> : null}
            {allDone && (
              <span className="inline-flex items-center gap-1 text-accent">
                · <Check aria-hidden className="size-3.5" strokeWidth={2.6} /> Done
              </span>
            )}
          </div>
        </button>
        {onCollapse && (
          <button onClick={onCollapse} className="icon-btn -mt-1 shrink-0" aria-label={`Collapse ${we.exercise.name}`} aria-expanded>
            <ChevronDown className="size-5 rotate-180" />
          </button>
        )}
        <button onClick={onMenu} className="icon-btn -mr-1 -mt-1 shrink-0" aria-label={`${we.exercise.name} options`}>
          <MoreHorizontal className="size-5" />
        </button>
      </div>

      {we.notes && <p className={`mt-2 text-[14px] italic leading-5 text-muted ${inSuperset ? '' : 'px-4'}`}>“{we.notes}”</p>}

      <div className={`mt-3 ${inSuperset ? '' : 'px-1 min-[390px]:px-2'}`}>
        <div aria-hidden className={`grid ${grid} items-center gap-1 px-1 pb-1 text-[11px] font-[650] uppercase tracking-[0.08em] text-subtle min-[390px]:px-2`}>
          <span className="text-center">Set</span>
          <span className={`pl-1 ${narrowHide}`}>Previous</span>
          {cols.map((c) => (
            <span key={c} className="text-center">
              {c === 'weight' ? (t === 'weighted_bodyweight' ? `+${unit}` : unit) : c === 'reps' ? 'Reps' : c === 'rir' ? 'RIR' : 'Sec'}
            </span>
          ))}
          <span />
        </div>
        {we.sets.map((set, i) => {
          const label = setLabel(set, workingIndex(we, i), letter)
          const prevText = prevLabel(we, i, unit)
          return (
            <div
              key={set._id}
              id={`set-${set._id}`}
              className={`grid ${grid} relative min-h-[56px] items-center gap-1 rounded-[14px] px-1 transition-colors duration-200 min-[390px]:px-2 ${
                set.isPr
                  ? 'animate-[pr-fill_500ms_ease-out_both] bg-pr/[0.05]'
                  : set.done
                    ? 'bg-accent/[0.07]'
                    : editing?.setId === set._id
                      ? 'bg-raised/70'
                      : ''
              }`}
            >
              <button
                onClick={() => onSetMenu(set, label)}
                className={`press num relative mx-auto grid size-11 place-items-center rounded-[12px] text-[14px] font-[700] ${
                  set.kind !== 'working' ? 'text-warning' : set.done ? 'text-accent' : 'text-muted'
                }`}
                aria-label={`Set ${label}${set.kind !== 'working' ? `, ${set.kind === 'warmup' ? 'warm-up' : set.kind === 'drop' ? 'drop set' : 'to failure'}` : ''}${set.isPr ? ', personal record' : ''}, options`}
              >
                {set.isPr ? (
                  <span className="flex items-center gap-0.5 text-pr">
                    <Medal aria-hidden className="size-3" strokeWidth={2.2} />
                    <span className="text-[10px] font-[600] leading-[14px] tracking-[0.02em]">PR</span>
                  </span>
                ) : (
                  label
                )}
              </button>
              {/* A record keeps a fine gold rule at its left edge — durable, not decorative. */}
              {set.isPr && <span aria-hidden className="pointer-events-none absolute left-0 top-1/2 h-10 w-[2px] -translate-y-1/2 rounded-full bg-pr animate-fade" />}
              <span className={`num truncate pl-1 text-[13px] text-muted ${narrowHide}`}>
                <span className="sr-only">Previous </span>
                {prevText}
              </span>
              {cols.map((c) => {
                const v = displayValue(we, set, i, c)
                const active = editing?.setId === set._id && editing.field === c
                return (
                  <button
                    key={c}
                    id={`cell-${set._id}-${c}`}
                    onClick={() => onCell(we, set, i, c)}
                    aria-label={`${
                      c === 'weight' ? (t === 'weighted_bodyweight' ? `Added ${unit}` : unit === 'kg' ? 'Kilograms' : 'Pounds') : c === 'reps' ? 'Reps' : c === 'rir' ? 'Reps in reserve' : 'Seconds'
                    } ${(active ? editing.draft : v.text) || 'empty'}${v.suggested && v.text && !active ? ', suggested from last time' : ''}, set ${label}`}
                    className={`press num h-11 min-w-0 rounded-[12px] text-center text-[20px] tracking-[-0.01em] transition-colors ${
                      active ? 'bg-ink font-[500] text-black' : set.done ? 'font-[500] text-ink' : 'bg-raised font-[500] hover:bg-pressed'
                    } ${v.suggested && !active ? '!font-[400] text-muted' : ''}`}
                  >
                    {active
                      ? editing.draft || (c === 'rir' ? '–' : '0')
                      : v.text || (
                          <span className="text-subtle">{c === 'reps' && we.repLow ? fmtReps(we.repLow, we.repHigh) : '–'}</span>
                        )}
                  </button>
                )
              })}
              <button
                id={`tick-${set._id}`}
                onClick={() => onToggle(we, set, i)}
                aria-label={`Set ${label} done`}
                aria-pressed={set.done}
                className={`press mx-auto grid size-11 place-items-center rounded-full transition-all duration-200 ${
                  set.isPr
                    ? 'bg-pr text-black'
                    : set.done
                      ? 'bg-accent text-accent-ink'
                      : 'border-[1.5px] border-edge text-subtle hover:border-muted hover:text-muted'
                }`}
              >
                <Check aria-hidden className={`size-5 ${set.done ? 'animate-pop' : ''}`} strokeWidth={2.8} />
              </button>
              <span className={`num col-span-full -mt-1 hidden pb-1.5 pl-[44px] text-[12px] text-muted ${narrowShow}`}>
                Last: {prevText}
              </span>
            </div>
          )
        })}
      </div>

      <div className={`mt-1 flex items-center ${inSuperset ? '' : 'px-2'}`}>
        <button
          onClick={onAddSet}
          className="press flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[14px] font-[600] text-muted hover:bg-raised hover:text-ink"
        >
          <Plus aria-hidden className="size-4" /> Add set
        </button>
        <span aria-hidden className="h-5 w-px bg-line" />
        <button
          onClick={onRest}
          aria-label={`Rest after each set: ${we.restSec ? fmtClock(we.restSec) : 'off'}. Change`}
          className="press num flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[14px] font-[600] text-muted hover:bg-raised hover:text-ink"
        >
          <Timer aria-hidden className="size-4" /> {we.restSec ? fmtClock(we.restSec) : 'Off'}
        </button>
      </div>
    </article>
  )
})

function ExerciseMenu({
  workout,
  we,
  index,
  close,
  open,
  update,
  remove,
}: {
  workout: ActiveWorkout
  we: WorkoutExercise
  index: number
  close: () => void
  open: (m: Menu) => void
  update: (args: { workoutExerciseId: Id<'workoutExercises'>; group?: string | null; position?: number; linkNext?: boolean }) => Promise<null>
  remove: () => void
}) {
  const prev = workout.exercises[index - 1]
  const next = workout.exercises[index + 1]
  // Grouped only if an adjacent exercise shares the group (what the screen shows).
  const grouped = Boolean(we.group && (prev?.group === we.group || next?.group === we.group))
  const [more, setMore] = useState(false)
  if (more) {
    return (
      <div className="pb-2">
        <button onClick={() => setMore(false)} className="-ml-2 mb-1 flex h-11 items-center gap-1 rounded-full px-2 text-[14px] font-[550] text-muted hover:text-ink">
          <ChevronDown aria-hidden className="size-4 rotate-90" /> Back
        </button>
        <SheetAction icon={<NotebookPen className="size-5" />} label={we.notes ? 'Edit note' : 'Add note'} onClick={() => open({ type: 'notes', we })} />
        {index > 0 && (
          <SheetAction icon={<ArrowUp className="size-5" />} label="Move up" onClick={() => { close(); void update({ workoutExerciseId: we._id, position: index - 1 }) }} />
        )}
        {index < workout.exercises.length - 1 && (
          <SheetAction icon={<ArrowDown className="size-5" />} label="Move down" onClick={() => { close(); void update({ workoutExerciseId: we._id, position: index + 1 }) }} />
        )}
      </div>
    )
  }
  return (
    <div className="pb-2">
      <SheetAction icon={<Info className="size-5" />} label="Form & history" onClick={() => open({ type: 'info', we })} />
      <SheetAction icon={<Repeat className="size-5" />} label="Replace exercise" onClick={() => open({ type: 'swap', we })} />
      {grouped ? (
        <SheetAction
          icon={<Link2Off className="size-5" />}
          label="Unpair superset"
          onClick={async () => {
            close()
            await update({ workoutExerciseId: we._id, group: null })
          }}
        />
      ) : next ? (
        <SheetAction
          icon={<Link2 className="size-5" />}
          label={`Pair with ${next.exercise.name}`}
          onClick={async () => {
            close()
            await update({ workoutExerciseId: we._id, linkNext: true })
            announce(`${we.exercise.name} and ${next.exercise.name} are now a superset.`)
          }}
        />
      ) : null}
      <SheetAction icon={<Timer className="size-5" />} label="Rest duration" value={we.restSec ? fmtClock(we.restSec) : 'Off'} onClick={() => open({ type: 'rest', we })} />
      <SheetAction icon={<MoreHorizontal className="size-5" />} label="More" value={<ChevronRight aria-hidden className="size-4" />} onClick={() => setMore(true)} />
      <SheetDivider />
      <SheetAction icon={<Trash2 className="size-5" />} label="Remove exercise" tone="danger" onClick={remove} />
    </div>
  )
}

function NoteEditor({ initial, onSave }: { initial: string; onSave: (s: string) => void }) {
  const [text, setText] = useState(initial)
  return (
    <div className="pb-2">
      <label htmlFor="exercise-note" className="sr-only">Note</label>
      <textarea
        id="exercise-note"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Seat height 4, slow negatives…"
        className="field h-auto resize-none py-3 leading-6"
      />
      <button className="btn btn-primary mt-3 w-full" onClick={() => onSave(text.trim())}>
        Save note
      </button>
    </div>
  )
}

/** Compact rest countdown that lives in the keypad header. Ticks on its own. */
function RestPill({ rest }: { rest: Rest }) {
  const now = useNow(1000, Boolean(rest.endsAt))
  const remaining = rest.endsAt ? (rest.endsAt - now) / 1000 : 0
  if (remaining > 0) {
    return (
      <span className="num flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent-dim px-3 text-[13px] font-[650] text-accent">
        <Timer aria-hidden className="size-3.5" />
        <span className="sr-only">Rest </span>
        {fmtClock(remaining)}
      </span>
    )
  }
  if (rest.endedAt) {
    return (
      <span className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 text-[13px] font-[650] text-accent-ink animate-pop">
        <Check aria-hidden className="size-3.5" strokeWidth={2.8} /> Rest done
      </span>
    )
  }
  return null
}

function RestStrip({
  rest,
  upNext,
  onAdjust,
  onSkip,
}: {
  rest: Rest
  upNext: { setId: string; text: string } | null
  onAdjust: (s: number) => void
  onSkip: () => void
}) {
  const now = useNow(rest.endsAt ? 250 : 1000, Boolean(rest.endsAt || rest.endedAt))
  const remaining = rest.endsAt ? (rest.endsAt - now) / 1000 : 0
  if (!(remaining > 0) && !rest.endedAt) return null
  const pct = rest.total > 0 ? Math.max(0, Math.min(1, remaining / rest.total)) : 0
  const R = 19
  const C = 2 * Math.PI * R
  const goNext = () =>
    upNext && document.getElementById(`set-${upNext.setId}`)?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' })

  return (
    <aside aria-label="Rest timer" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(var(--safe-bottom)+12px)]">
      <div className="mx-auto max-w-[560px] overflow-hidden rounded-[22px] border border-line-strong bg-raised/95 shadow-[0_16px_50px_-10px_#000] backdrop-blur-xl animate-[rise_240ms_cubic-bezier(0.22,1,0.36,1)_both]">
        <div className="flex h-[68px] items-center gap-3 pl-3 pr-2">
          {!(remaining > 0) ? (
            <>
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink animate-pop">
                <Check aria-hidden className="size-5" strokeWidth={2.8} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-[650]">Rest over</div>
                <div className="num text-[13px] text-muted">{fmtClock((now - (rest.endedAt ?? now)) / 1000)} ago</div>
              </div>
              <button onClick={rest.dismiss} className="icon-btn" aria-label="Dismiss">
                <X className="size-5" />
              </button>
            </>
          ) : (
            <>
              <svg aria-hidden width="46" height="46" viewBox="0 0 46 46" className="shrink-0 -rotate-90">
                <circle cx="23" cy="23" r={R} fill="none" stroke="#2a2a2d" strokeWidth="3.5" />
                <circle
                  cx="23"
                  cy="23"
                  r={R}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - pct)}
                  style={{ transition: 'stroke-dashoffset 250ms linear' }}
                />
              </svg>
              {/* Tap the time to jump to the next set (named for screen readers). */}
              <button onClick={goNext} className="min-w-0 flex-1 text-left" aria-label={upNext ? `Next: ${upNext.text}` : 'Rest'}>
                <div className="text-[12px] font-[500] text-muted">Rest</div>
                <div aria-hidden className="num text-[22px] font-[550] leading-[26px] tracking-[-0.02em]">{fmtClock(remaining)}</div>
              </button>
              <button onClick={() => onAdjust(-15)} aria-label="15 seconds less" className="press num h-11 rounded-full px-3 text-[14px] font-[650] text-muted hover:bg-pressed">
                −15
              </button>
              <button onClick={() => onAdjust(15)} aria-label="15 seconds more" className="press num h-11 rounded-full px-3 text-[14px] font-[650] text-muted hover:bg-pressed">
                +15
              </button>
              <button onClick={onSkip} aria-label={`Skip rest, ${fmtClock(remaining)} left`} className="press h-11 rounded-full bg-ink px-4 text-[14px] font-[650] text-black">
                Skip
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

function FinishPanel({
  workout,
  done,
  total,
  online,
  onFinish,
  onCancel,
}: {
  workout: ActiveWorkout
  done: number
  total: number
  online: boolean
  onFinish: (notes: string) => Promise<void>
  onCancel: () => void
}) {
  const unit = useUnit()
  const [notes, setNotes] = useState(workout.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [slow, setSlow] = useState(false)
  const volume = workout.exercises.reduce(
    (n, we) => n + we.sets.filter((s) => s.done && s.kind !== 'warmup').reduce((m, s) => m + (s.weightKg ?? 0) * (s.reps ?? 0), 0),
    0,
  )
  const prs = workout.exercises.reduce((n, we) => n + we.sets.filter((s) => s.isPr).length, 0)
  const skipped = total - done
  return (
    <div className="pb-2">
      <dl className="grid grid-cols-3 gap-2">
        {[
          ['Duration', fmtDuration((Date.now() - workout.startedAt) / 1000)],
          ['Sets', `${done}`],
          [`Volume ${unit}`, volume > 0 ? fmtVolume(volume, unit) : '—'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[16px] bg-raised px-3 py-3">
            <dt className="text-[12px] font-[550] text-muted">{k}</dt>
            <dd className="num mt-0.5 text-[20px] font-[680] tracking-[-0.02em]">{v}</dd>
          </div>
        ))}
      </dl>
      {prs > 0 && (
        <p className="mt-3 flex items-center gap-2 text-[14px] font-[600] text-pr">
          <Trophy aria-hidden className="size-4" /> {prs} new personal record{prs > 1 ? 's' : ''}
        </p>
      )}
      {skipped > 0 && (
        <p className="mt-3 text-[14px] leading-5 text-muted">
          {skipped} planned set{skipped > 1 ? 's' : ''} not logged — {skipped > 1 ? 'they' : 'it'}’ll be left out.
        </p>
      )}
      <label htmlFor="finish-notes" className="sr-only">Notes</label>
      <textarea
        id="finish-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="How did it feel? (optional)"
        className="field mt-4 h-auto resize-none py-3 leading-6"
      />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn btn-secondary" onClick={onCancel}>Keep going</button>
        <button
          className="btn btn-primary"
          disabled={busy || done === 0}
          onClick={async () => {
            setBusy(true)
            const t = setTimeout(() => setSlow(true), 5000)
            try {
              await onFinish(notes.trim())
            } finally {
              clearTimeout(t)
              setBusy(false)
              setSlow(false)
            }
          }}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" strokeWidth={2.6} />} Finish
        </button>
      </div>
      {(slow || (busy && !online)) && (
        <p className="mt-3 text-center text-[13px] text-warning">
          Still saving… keep Lift open. It finishes as soon as you’re back online.
        </p>
      )}
      {done === 0 && <p className="mt-3 text-center text-[13px] text-muted">Log at least one set, or discard the workout.</p>}
    </div>
  )
}

