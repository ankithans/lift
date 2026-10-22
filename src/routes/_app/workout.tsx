import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Info,
  Link2,
  Link2Off,
  Loader2,
  MoreHorizontal,
  NotebookPen,
  Plus,
  Repeat,
  Timer,
  Trash2,
  Trophy,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { ExerciseInfo } from '#/components/ExerciseDetail'
import { ExercisePicker } from '#/components/ExercisePicker'
import { ExerciseThumb } from '#/components/ExerciseThumb'
import { Keypad, type KeypadField, type KeypadTab } from '#/components/Keypad'
import { Sheet, SheetAction } from '#/components/Sheet'
import { BlockSkeleton } from '#/components/Skeletons'
import { chime, tap } from '#/lib/haptics'
import { fmtClock, fmtNum, fmtReps, fmtVolume, fmtWeight, fromDisplayWeight, toDisplayWeight } from '#/lib/format'
import { useUnit } from '#/lib/me'
import { toast } from '#/lib/toast'
import { useNow } from '#/lib/useNow'
import {
  type ActiveWorkout,
  type WorkoutExercise,
  type WorkoutSet,
  patchActiveSet,
  restAfter,
  setLabel,
  previousFor,
  suggestFor,
  toBlocks,
} from '#/lib/workout'

export const Route = createFileRoute('/_app/workout')({ component: LiveWorkout })

type Editing = { setId: Id<'sets'>; weId: Id<'workoutExercises'>; field: KeypadField; draft: string; fresh: boolean }
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

type RestState = { remaining: number; total: number; over: boolean; dismiss: () => void }

/**
 * Rest timer state, tracked at the screen level so it keeps counting (and alerts)
 * while the keypad is open. Only a natural expiry alerts — not Skip or un-ticking.
 */
function useRest(workout: ActiveWorkout | null | undefined): RestState {
  const endsAt = workout?.restEndsAt
  const now = useNow(250, Boolean(endsAt))
  const remaining = endsAt ? (endsAt - now) / 1000 : 0
  const [overAt, setOverAt] = useState<number | null>(null)
  const fired = useRef<number | null>(null)
  const expired = Boolean(endsAt && remaining <= 0)
  useEffect(() => {
    if (!endsAt) return
    if (!expired) {
      setOverAt(null)
      return
    }
    if (fired.current === endsAt) return
    fired.current = endsAt
    if (Date.now() - endsAt < 5000) {
      if (document.visibilityState === 'visible') chime()
      tap('success')
      setOverAt(Date.now())
    }
  }, [endsAt, expired])
  useEffect(() => {
    if (overAt === null) return
    const t = setTimeout(() => setOverAt(null), 4000)
    return () => clearTimeout(t)
  }, [overAt])
  return { remaining: Math.max(0, remaining), total: workout?.restTotalSec ?? 0, over: overAt !== null, dismiss: () => setOverAt(null) }
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

function LiveWorkout() {
  const workout = useQuery(api.workouts.active)
  const navigate = useNavigate()
  const unit = useUnit()
  const [editing, setEditing] = useState<Editing | null>(null)
  const [menu, setMenu] = useState<Menu>(null)
  const finishing = useRef(false)
  useWakeLock(Boolean(workout))
  const rest = useRest(workout)

  // Mutations with optimistic updates for instant feel.
  const updateSet = useMutation(api.workouts.updateSet).withOptimisticUpdate((store, args) => {
    const patch: Partial<WorkoutSet> = {}
    for (const k of ['weightKg', 'reps', 'rir', 'durationSec'] as const) {
      if (args[k] !== undefined) patch[k] = args[k] ?? undefined
    }
    if (args.kind) patch.kind = args.kind
    patchActiveSet(store, args.setId, patch)
  })
  const completeSet = useMutation(api.workouts.completeSet).withOptimisticUpdate((store, args) => {
    const patch: Partial<WorkoutSet> = { done: true, doneAt: Date.now() }
    for (const k of ['weightKg', 'reps', 'rir', 'durationSec'] as const) {
      if (args[k] !== undefined) patch[k] = args[k] ?? undefined
    }
    patchActiveSet(store, args.setId, patch, (w, we) => {
      const r = restAfter(w, we)
      return r > 0 ? { restEndsAt: Date.now() + r * 1000, restTotalSec: r } : {}
    })
  })
  const uncompleteSet = useMutation(api.workouts.uncompleteSet).withOptimisticUpdate((store, args) => {
    patchActiveSet(store, args.setId, { done: false, doneAt: undefined, isPr: false }, () => ({ restEndsAt: undefined }))
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
  const addSet = useMutation(api.workouts.addSet)
  const removeSet = useMutation(api.workouts.removeSet)
  const addExercise = useMutation(api.workouts.addExercise)
  const removeExercise = useMutation(api.workouts.removeExercise)
  const swapExercise = useMutation(api.workouts.swapExercise)
  const updateExercise = useMutation(api.workouts.updateExercise)
  const finish = useMutation(api.workouts.finish)
  const discard = useMutation(api.workouts.remove)

  const blocks = useMemo(() => (workout ? toBlocks(workout.exercises) : []), [workout])
  const weById = useMemo(() => new Map(workout?.exercises.map((we) => [we._id, we]) ?? []), [workout])

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

  const toServer = (field: KeypadField, text: string): number | null => {
    if (text === '' || text === '.') return null
    const n = Number.parseFloat(text)
    if (!Number.isFinite(n)) return null
    return field === 'weight' ? fromDisplayWeight(n, unit) : n
  }

  const argKey = (f: KeypadField) => (f === 'weight' ? 'weightKg' : f === 'reps' ? 'reps' : f === 'rir' ? 'rir' : 'durationSec') as
    | 'weightKg'
    | 'reps'
    | 'rir'
    | 'durationSec'

  function openKeypad(we: WorkoutExercise, set: WorkoutSet, index: number, field: KeypadField) {
    tap()
    commitEditing()
    const { text } = displayValue(we, set, index, field)
    setEditing({ setId: set._id, weId: we._id, field, draft: text, fresh: true })
    requestAnimationFrame(() => {
      document.getElementById(`set-${set._id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }

  function commitEditing(e: Editing | null = editing) {
    if (!e) return
    const we = weById.get(e.weId)
    const set = we?.sets.find((s) => s._id === e.setId)
    if (!we || !set) return
    const value = toServer(e.field, e.draft)
    const current = serverValue(set, e.field)
    if ((value ?? undefined) !== current) void updateSet({ setId: set._id, [argKey(e.field)]: value })
  }

  async function logSet(we: WorkoutExercise, set: WorkoutSet, index: number, e: Editing | null) {
    // Ticking a different set must not throw away what was being typed elsewhere.
    if (e && e.setId !== set._id) commitEditing(e)
    const values: Record<string, number | null> = {}
    for (const f of tabsFor(we.exercise.tracking)) {
      if (e && e.setId === set._id && e.field === f) values[argKey(f)] = toServer(f, e.draft)
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
    // Require the essential value(s) before logging.
    const missing: KeypadField | null =
      we.exercise.tracking === 'duration'
        ? values.durationSec == null ? 'duration' : null
        : values.reps == null
          ? 'reps'
          : null
    if (missing) {
      openKeypad(we, set, index, missing)
      return
    }
    setEditing(null)
    tap('success')
    try {
      const res = await completeSet({ setId: set._id, ...values })
      if (res.isPr) {
        tap('heavy')
        toast(`New PR · ${we.exercise.name}`, { tone: 'pr' })
      }
    } catch {
      toast('Could not save that set. Check your connection.')
    }
  }

  function toggleSet(we: WorkoutExercise, set: WorkoutSet, index: number) {
    if (set.done) {
      tap()
      void uncompleteSet({ setId: set._id })
      return
    }
    void logSet(we, set, index, editing)
  }

  // ----- keypad wiring -----
  const editingWe = editing ? weById.get(editing.weId) : undefined
  const editingSet = editingWe?.sets.find((s) => s._id === editing?.setId)
  const editingIndex = editingWe && editingSet ? editingWe.sets.indexOf(editingSet) : -1
  const fields = editingWe ? tabsFor(editingWe.exercise.tracking) : []
  const mainFields = fields.filter((f): f is Exclude<KeypadField, 'rir'> => f !== 'rir')
  const blockOf = editingWe ? blocks.find((b) => b.items.some((i) => i.we._id === editingWe._id)) : undefined
  const letter = blockOf?.items.find((i) => i.we._id === editingWe?._id)?.letter ?? null

  const keypadTabs: KeypadTab[] =
    editingWe && editingSet
      ? fields.map((f) => ({
          field: f,
          label: fieldLabel(f, editingWe.exercise.tracking, unit),
          value: f === editing?.field ? editing.draft : displayValue(editingWe, editingSet, editingIndex, f).text,
        }))
      : []

  const nextField = () => {
    if (!editing || !editingWe || !editingSet) return
    const i = (mainFields as KeypadField[]).indexOf(editing.field)
    if (editing.field === 'rir' || i === mainFields.length - 1) {
      void logSet(editingWe, editingSet, editingIndex, editing)
      return
    }
    commitEditing()
    const f = mainFields[i + 1]
    setEditing({ ...editing, field: f, draft: displayValue(editingWe, editingSet, editingIndex, f).text, fresh: true })
  }

  const openMenu = (m: Menu) => {
    commitEditing()
    setEditing(null)
    setMenu(m)
  }

  const doneSets = workout.exercises.reduce((n, we) => n + we.sets.filter((s) => s.done).length, 0)
  const totalSets = workout.exercises.reduce((n, we) => n + we.sets.length, 0)

  return (
    <div className="min-h-dvh">
      <Header workout={workout} done={doneSets} total={totalSets} onFinish={() => { commitEditing(); setEditing(null); setMenu({ type: 'finish' }) }} />

      <main className={`mx-auto max-w-[680px] px-4 pt-3 ${editing ? 'pb-[440px]' : 'pb-[calc(var(--safe-bottom)+140px)]'}`}>
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
              className={`animate-rise ${block.group ? 'rounded-[22px] bg-surface/60 py-1 pl-3' : ''}`}
              style={{ animationDelay: `${Math.min(bi, 6) * 30}ms` }}
            >
              {block.group && (
                <div className="flex items-center gap-2 px-1 pb-1 pt-3 text-accent">
                  <Link2 className="size-3.5" />
                  <span className="t-eyebrow">Superset · {Math.max(...block.items.map((i) => i.we.sets.length))} rounds</span>
                </div>
              )}
              <div className={block.group ? 'border-l-2 border-accent/25' : ''}>
                {block.items.map(({ we, letter }) => (
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
                    onAddSet={async () => {
                      tap()
                      await addSet({ workoutExerciseId: we._id })
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <button onClick={() => openMenu({ type: 'add' })} className="btn btn-secondary mt-6 w-full">
          <Plus className="size-5" /> Add exercise
        </button>
        <button onClick={() => openMenu({ type: 'discard' })} className="mx-auto mt-6 block h-11 px-4 text-[14px] font-[560] text-danger/80 hover:text-danger">
          Discard workout
        </button>
      </main>

      {!editing && <RestStrip rest={rest} onAdjust={(addSec) => restMut({ workoutId: workout._id, addSec })} onSkip={() => restMut({ workoutId: workout._id, skip: true })} />}

      {editing && editingWe && editingSet && (
        <Keypad
          context={`${editingWe.exercise.name} · Set ${setLabel(editingSet, editingIndex, letter)}${
            editingWe.repLow ? ` · target ${fmtReps(editingWe.repLow, editingWe.repHigh)}` : ''
          }`}
          tabs={keypadTabs}
          field={editing.field}
          value={editing.draft}
          fresh={editing.fresh}
          step={editing.field === 'weight' ? (unit === 'lb' ? 5 : 2.5) : editing.field === 'duration' ? 5 : 1}
          nextLabel={editing.field === mainFields[mainFields.length - 1] ? 'Log set' : 'Next'}
          accessory={
            rest.remaining > 0 ? (
              <span className="num flex h-8 items-center gap-1.5 rounded-full bg-accent-dim px-3 text-[13px] font-[650] text-accent">
                <Timer className="size-3.5" /> {fmtClock(rest.remaining)}
              </span>
            ) : rest.over ? (
              <span className="flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-[13px] font-[650] text-accent-ink animate-pop">
                <Check className="size-3.5" strokeWidth={2.8} /> Rest done
              </span>
            ) : null
          }
          onInput={(draft, fresh) => setEditing({ ...editing, draft, fresh })}
          onField={(f) => {
            commitEditing()
            setEditing({ ...editing, field: f, draft: displayValue(editingWe, editingSet, editingIndex, f).text, fresh: true })
          }}
          onNext={nextField}
          onDone={() => void logSet(editingWe, editingSet, editingIndex, editing)}
          onClose={() => {
            commitEditing()
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
          <div className="space-y-1 pb-2">
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
                icon={menu.set.kind === kind ? <Check className="size-4 text-accent" strokeWidth={2.6} /> : <span className="text-[13px] font-[700]">{kind[0].toUpperCase()}</span>}
                label={label}
                hint={hint}
                onClick={() => {
                  void updateSet({ setId: menu.set._id, kind })
                  setMenu(null)
                }}
              />
            ))}
            <SheetAction
              icon={<Trash2 className="size-4" />}
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
          requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
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
            onFinish={async (notes) => {
              finishing.current = true
              let id: Id<'workouts'>
              try {
                id = await finish({ workoutId: workout._id, notes: notes || undefined })
              } catch {
                toast('Could not finish — check your connection and try again.')
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
        <p className="text-[15px] text-muted">All {doneSets} logged sets will be deleted. This can’t be undone.</p>
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

// ---------------------------------------------------------------------------

function Header({ workout, done, total, onFinish }: { workout: ActiveWorkout; done: number; total: number; onFinish: () => void }) {
  const now = useNow(1000)
  const pct = total ? done / total : 0
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-black/80 pt-[var(--safe-top)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-[60px] max-w-[680px] items-center gap-2 px-2">
        <Link to="/" className="icon-btn" aria-label="Minimize workout">
          <ChevronDown className="size-6" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-[650] tracking-[-0.01em]">{workout.title}</div>
          <div className="num text-[13px] text-muted">
            {fmtClock((now - workout.startedAt) / 1000)} · {done}/{total} sets
          </div>
        </div>
        <button onClick={onFinish} className="btn btn-sm btn-primary mr-1">
          Finish
        </button>
      </div>
      <div className="h-[2px] bg-line">
        <div className="h-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${pct * 100}%` }} />
      </div>
    </header>
  )
}

function ExerciseCard({
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
}) {
  const unit = useUnit()
  const t = we.exercise.tracking
  const cols: KeypadField[] = t === 'reps' ? ['reps', 'rir'] : t === 'duration' ? ['duration'] : ['weight', 'reps', 'rir']
  const allDone = we.sets.length > 0 && we.sets.every((s) => s.done)
  const grid = cols.length === 3 ? 'grid-cols-[40px_minmax(0,1fr)_64px_64px_44px_48px]' : cols.length === 2 ? 'grid-cols-[40px_minmax(0,1fr)_72px_52px_48px]' : 'grid-cols-[40px_minmax(0,1fr)_88px_48px]'

  return (
    <article className={`${inSuperset ? 'pl-3 pr-1' : 'card'} pb-2 pt-4`}>
      <div className={`flex items-start gap-3 ${inSuperset ? '' : 'px-4'}`}>
        <button onClick={onInfo} className="press shrink-0" aria-label={`About ${we.exercise.name}`}>
          <ExerciseThumb src={we.exercise.thumbnailUrl} size={46} />
        </button>
        <button onClick={onInfo} className="min-w-0 flex-1 pt-0.5 text-left">
          <div className="flex items-center gap-2">
            {letter && <span className="num grid size-5 shrink-0 place-items-center rounded-md bg-accent/15 text-[11px] font-[750] text-accent">{letter}</span>}
            <h2 className={`truncate text-[17px] font-[620] tracking-[-0.015em] ${allDone ? 'text-muted' : ''}`}>{we.exercise.name}</h2>
          </div>
          <div className="num mt-0.5 flex items-center gap-1.5 text-[13px] text-subtle">
            {we.repLow ? <span>{fmtReps(we.repLow, we.repHigh)} reps</span> : null}
            {we.best && t !== 'duration' ? (
              <span className="inline-flex items-center gap-1">
                · <Trophy className="size-3" /> {fmtWeight(we.best.weightKg, unit)}×{we.best.reps}
              </span>
            ) : null}
            {allDone && <span className="inline-flex items-center gap-1 text-accent">· <Check className="size-3.5" strokeWidth={2.6} /> Done</span>}
          </div>
        </button>
        <button onClick={onMenu} className="icon-btn -mr-1 -mt-1 shrink-0" aria-label="Exercise options">
          <MoreHorizontal className="size-5" />
        </button>
      </div>

      {we.notes && <p className={`mt-2 text-[14px] italic leading-5 text-muted ${inSuperset ? '' : 'px-4'}`}>“{we.notes}”</p>}

      <div className={`mt-3 ${inSuperset ? '' : 'px-2'}`}>
        <div className={`grid ${grid} items-center gap-1 px-2 pb-1 text-[11px] font-[650] uppercase tracking-[0.08em] text-faint`}>
          <span className="text-center">Set</span>
          <span className="pl-1">Previous</span>
          {cols.map((c) => (
            <span key={c} className="text-center">
              {c === 'weight' ? (t === 'weighted_bodyweight' ? `+${unit}` : unit) : c === 'reps' ? 'Reps' : c === 'rir' ? 'RIR' : 'Sec'}
            </span>
          ))}
          <span />
        </div>
        {we.sets.map((set, i) => {
          const label = setLabel(set, we.sets.filter((s, j) => j < i && s.kind === 'working').length, letter)
          const prev = previousFor(we, i)
          const prevText = prev
            ? t === 'duration'
              ? `${fmtNum(prev.durationSec)}s`
              : t === 'reps'
                ? `${prev.reps ?? '—'} reps`
                : prev.weightKg
                  ? `${t === 'weighted_bodyweight' ? '+' : ''}${fmtWeight(prev.weightKg, unit)} × ${prev.reps ?? '—'}`
                  : `BW × ${prev.reps ?? '—'}`
            : '—'
          return (
            <div
              key={set._id}
              id={`set-${set._id}`}
              className={`grid ${grid} min-h-[56px] items-center gap-1 rounded-[14px] px-2 transition-colors duration-200 ${
                set.done ? 'bg-accent/[0.07]' : editing?.setId === set._id ? 'bg-raised/70' : ''
              }`}
            >
              <button
                onClick={() => onSetMenu(set, label)}
                className={`press num relative mx-auto grid h-8 min-w-8 place-items-center rounded-[10px] px-1 text-[14px] font-[700] ${
                  set.kind !== 'working' ? 'text-warning' : set.done ? 'text-accent' : 'text-muted'
                }`}
                aria-label={`Set ${label} options`}
              >
                {label}
                {set.isPr && (
                  <span className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-pr text-black animate-pop">
                    <Trophy className="size-2.5" strokeWidth={2.5} />
                  </span>
                )}
              </button>
              <span className="num truncate pl-1 text-[13px] text-subtle">{prevText}</span>
              {cols.map((c) => {
                const v = displayValue(we, set, i, c)
                const active = editing?.setId === set._id && editing.field === c
                return (
                  <button
                    key={c}
                    onClick={() => onCell(we, set, i, c)}
                    className={`press num h-11 rounded-[12px] text-center text-[19px] font-[620] tracking-[-0.01em] transition-colors ${
                      active ? 'bg-ink text-black' : set.done ? 'text-ink' : 'bg-raised hover:bg-pressed'
                    } ${v.suggested && !active ? 'text-subtle' : ''}`}
                  >
                    {active ? editing.draft || '0' : v.text || (c === 'rir' ? <span className="text-faint">–</span> : <span className="text-faint">{c === 'reps' && we.repLow ? fmtReps(we.repLow, we.repHigh) : '–'}</span>)}
                  </button>
                )
              })}
              <button
                onClick={() => onToggle(we, set, i)}
                aria-label={set.done ? 'Mark not done' : 'Log set'}
                className={`press mx-auto grid size-11 place-items-center rounded-full transition-all duration-200 ${
                  set.done ? 'bg-accent text-accent-ink' : 'border-[1.5px] border-line-strong text-faint hover:border-muted hover:text-muted'
                }`}
              >
                <Check className={`size-5 ${set.done ? 'animate-pop' : ''}`} strokeWidth={2.8} />
              </button>
            </div>
          )
        })}
      </div>

      <div className={`mt-1 flex items-center ${inSuperset ? '' : 'px-2'}`}>
        <button onClick={onAddSet} className="press flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[14px] font-[600] text-muted hover:bg-raised hover:text-ink">
          <Plus className="size-4" /> Add set
        </button>
        <span className="h-5 w-px bg-line" />
        <button onClick={onRest} className="press num flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[14px] font-[600] text-muted hover:bg-raised hover:text-ink">
          <Timer className="size-4" /> {we.restSec ? fmtClock(we.restSec) : 'Off'}
        </button>
      </div>
    </article>
  )
}

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
  update: (args: { workoutExerciseId: Id<'workoutExercises'>; group?: string | null; position?: number }) => Promise<null>
  remove: () => void
}) {
  const next = workout.exercises[index + 1]
  const grouped = Boolean(we.group && workout.exercises.filter((x) => x.group === we.group).length > 1)
  return (
    <div className="space-y-1 pb-2">
      <SheetAction icon={<Info className="size-4" />} label="Form & history" onClick={() => open({ type: 'info', we })} />
      <SheetAction icon={<Repeat className="size-4" />} label="Replace exercise" hint="Keeps your sets" onClick={() => open({ type: 'swap', we })} />
      {grouped ? (
        <SheetAction
          icon={<Link2Off className="size-4" />}
          label="Remove from superset"
          onClick={async () => {
            close()
            await update({ workoutExerciseId: we._id, group: null })
            const rest = workout.exercises.filter((x) => x.group === we.group && x._id !== we._id)
            if (rest.length === 1) await update({ workoutExerciseId: rest[0]._id, group: null })
          }}
        />
      ) : next ? (
        <SheetAction
          icon={<Link2 className="size-4" />}
          label="Superset with next"
          hint={next.exercise.name}
          onClick={async () => {
            close()
            const g = next.group ?? `ss-${Date.now().toString(36)}`
            await update({ workoutExerciseId: we._id, group: g })
            if (!next.group) await update({ workoutExerciseId: next._id, group: g })
          }}
        />
      ) : null}
      <SheetAction icon={<Timer className="size-4" />} label="Rest timer" hint={we.restSec ? fmtClock(we.restSec) : 'Off'} onClick={() => open({ type: 'rest', we })} />
      <SheetAction icon={<NotebookPen className="size-4" />} label={we.notes ? 'Edit note' : 'Add note'} onClick={() => open({ type: 'notes', we })} />
      {index > 0 && (
        <SheetAction icon={<ArrowUp className="size-4" />} label="Move up" onClick={() => { close(); void update({ workoutExerciseId: we._id, position: index - 1 }) }} />
      )}
      {index < workout.exercises.length - 1 && (
        <SheetAction icon={<ArrowDown className="size-4" />} label="Move down" onClick={() => { close(); void update({ workoutExerciseId: we._id, position: index + 1 }) }} />
      )}
      <SheetAction icon={<Trash2 className="size-4" />} label="Remove exercise" tone="danger" onClick={remove} />
    </div>
  )
}

function NoteEditor({ initial, onSave }: { initial: string; onSave: (s: string) => void }) {
  const [text, setText] = useState(initial)
  return (
    <div className="pb-2">
      <textarea
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

function RestStrip({ rest, onAdjust, onSkip }: { rest: RestState; onAdjust: (s: number) => void; onSkip: () => void }) {
  const { remaining, total, over } = rest
  if (!(remaining > 0) && !over) return null
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const R = 19
  const C = 2 * Math.PI * R

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(var(--safe-bottom)+12px)]">
      <div className="mx-auto flex h-[68px] max-w-[560px] items-center gap-3 rounded-[22px] border border-line-strong bg-raised/95 pl-3 pr-2 shadow-[0_16px_50px_-10px_#000] backdrop-blur-xl animate-[rise_240ms_cubic-bezier(0.22,1,0.36,1)_both]">
        {over && !(remaining > 0) ? (
          <>
            <span className="grid size-11 place-items-center rounded-full bg-accent text-accent-ink animate-pop">
              <Check className="size-5" strokeWidth={2.8} />
            </span>
            <div className="flex-1">
              <div className="text-[15px] font-[650]">Rest complete</div>
              <div className="text-[13px] text-muted">Next set when you’re ready.</div>
            </div>
            <button onClick={rest.dismiss} className="icon-btn" aria-label="Dismiss">
              <X className="size-5" />
            </button>
          </>
        ) : (
          <>
            <svg width="46" height="46" viewBox="0 0 46 46" className="-rotate-90 shrink-0">
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
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-[600] text-subtle">Rest</div>
              <div className="num text-[24px] font-[680] leading-7 tracking-[-0.02em]">{fmtClock(remaining)}</div>
            </div>
            <button onClick={() => onAdjust(-15)} className="press num h-11 rounded-full px-3 text-[14px] font-[650] text-muted hover:bg-pressed">
              −15
            </button>
            <button onClick={() => onAdjust(15)} className="press num h-11 rounded-full px-3 text-[14px] font-[650] text-muted hover:bg-pressed">
              +15
            </button>
            <button onClick={onSkip} className="press h-11 rounded-full bg-ink px-4 text-[14px] font-[650] text-black">
              Skip
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function FinishPanel({
  workout,
  done,
  total,
  onFinish,
  onCancel,
}: {
  workout: ActiveWorkout
  done: number
  total: number
  onFinish: (notes: string) => Promise<void>
  onCancel: () => void
}) {
  const unit = useUnit()
  const [notes, setNotes] = useState(workout.notes ?? '')
  const [busy, setBusy] = useState(false)
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
          ['Time', fmtClock((Date.now() - workout.startedAt) / 1000)],
          ['Sets', `${done}`],
          [`Volume ${unit}`, fmtVolume(volume, unit)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[16px] bg-raised px-3 py-3">
            <dt className="text-[12px] font-[550] text-subtle">{k}</dt>
            <dd className="num mt-0.5 text-[20px] font-[680] tracking-[-0.02em]">{v}</dd>
          </div>
        ))}
      </dl>
      {prs > 0 && (
        <p className="mt-3 flex items-center gap-2 text-[14px] font-[600] text-pr">
          <Trophy className="size-4" /> {prs} new personal record{prs > 1 ? 's' : ''}
        </p>
      )}
      {skipped > 0 && (
        <p className="mt-3 text-[14px] leading-5 text-muted">
          {skipped} planned set{skipped > 1 ? 's' : ''} not logged — {skipped > 1 ? 'they' : 'it'}’ll be left out.
        </p>
      )}
      <textarea
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
            try {
              await onFinish(notes.trim())
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" strokeWidth={2.6} />} Finish
        </button>
      </div>
      {done === 0 && <p className="mt-3 text-center text-[13px] text-subtle">Log at least one set, or discard the workout.</p>}
    </div>
  )
}
