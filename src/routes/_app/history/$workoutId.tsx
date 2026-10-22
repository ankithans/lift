import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Check, Clock, Medal, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { PageHeader } from '#/components/PageHeader'
import { Sheet, SheetAction, SheetDivider } from '#/components/Sheet'
import { BlockSkeleton } from '#/components/Skeletons'
import { fmtDate, fmtDuration, fmtNum, fmtSet, fmtVolume, fromDisplayWeight, toDisplayWeight } from '#/lib/format'
import { useUnit } from '#/lib/me'
import { toast } from '#/lib/toast'
import { useTitle } from '#/lib/useTitle'
import { setLabel, toBlocks } from '#/lib/workout'
import { WhoopWorkout } from '#/components/whoop/WhoopWorkout'

export const Route = createFileRoute('/_app/history/$workoutId')({
  validateSearch: (s: Record<string, unknown>): { done?: number } => (s.done ? { done: 1 } : {}),
  component: WorkoutDetail,
})

function WorkoutDetail() {
  const { workoutId } = Route.useParams()
  const { done } = Route.useSearch()
  const unit = useUnit()
  const navigate = useNavigate()
  const workout = useQuery(api.workouts.get, { workoutId: workoutId as Id<'workouts'> })
  const updateSetMut = useMutation(api.workouts.updateSet)
  const removeSet = useMutation(api.workouts.removeSet)
  const addSet = useMutation(api.workouts.addSet)
  const completeSet = useMutation(api.workouts.completeSet)
  /** Resolves false (after a toast) when the server rejects the value, so the field can revert. */
  const updateSet = (args: Parameters<typeof updateSetMut>[0]) =>
    updateSetMut(args).then(
      () => true,
      (err: unknown) => {
        const data = (err as { data?: unknown })?.data
        toast(typeof data === 'string' ? data : 'Could not save that change.', { tone: 'error' })
        return false
      },
    )
  const remove = useMutation(api.workouts.remove)
  const [editing, setEditing] = useState(false)
  const [menu, setMenu] = useState<null | 'options' | 'delete'>(null)
  useTitle(workout ? `${workout.title}, ${fmtDate(workout.startedAt, { month: 'short', day: 'numeric' })}` : null)

  if (workout === undefined) {
    return (
      <main className="page space-y-4 pt-20">
        <BlockSkeleton h={140} />
        <BlockSkeleton h={300} />
      </main>
    )
  }
  if (workout === null) return null

  const s = workout.stats
  const prSets = workout.exercises.flatMap((we) => we.sets.filter((x) => x.isPr).map((x) => ({ we, set: x })))
  const blocks = toBlocks(workout.exercises as never)

  const stats = s
    ? [
        [fmtDuration(s.durationSec), 'Duration'],
        [String(s.sets), 'Sets'],
        ...(s.volumeKg > 0 ? [[fmtVolume(s.volumeKg, unit), `Volume, ${unit}`]] : []),
      ]
    : []

  return (
    <main className="page">
      {done ? (
        <section className="pb-2 pt-[calc(var(--safe-top)+40px)] animate-rise">
          <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-ink animate-pop">
            <Check aria-hidden className="size-6" strokeWidth={2.8} />
          </span>
          <div className="mt-5 text-[13px] text-muted">{fmtDate(workout.startedAt, { weekday: 'long', day: 'numeric', month: 'short' })}</div>
          <h1 className="mt-1 text-[28px] font-[650] leading-[34px] tracking-[-0.03em]">{workout.title} complete</h1>
        </section>
      ) : (
        <PageHeader
          back
          size="medium"
          eyebrow={fmtDate(workout.startedAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          title={workout.title}
          action={
            <button className="icon-btn size-12" onClick={() => setMenu('options')} aria-label="Workout options">
              <MoreHorizontal className="size-5" />
            </button>
          }
        />
      )}

      {stats.length > 0 && (
        <dl className={`-mt-3 flex gap-8 ${done ? 'mt-6' : ''}`}>
          {stats.map(([v, k]) => (
            <div key={k}>
              <dd className="num text-[20px] font-[550] leading-6 tracking-[-0.01em]">{v}</dd>
              <dt className="mt-0.5 text-[12px] text-muted">{k}</dt>
            </div>
          ))}
        </dl>
      )}

      <WhoopWorkout workoutId={workoutId as Id<'workouts'>} />

      {prSets.length > 0 && (
        <section className="mt-7 border-y border-line py-3" aria-label="Personal records">
          {prSets.map(({ we, set }) => (
            <div key={set._id} className="flex min-h-10 items-center gap-2">
              <Medal aria-hidden className="size-4 shrink-0 text-pr" />
              <span className="min-w-0 flex-1 truncate text-[15px]">{we.exercise.name}</span>
              <span className="num shrink-0 text-[15px] text-pr">{fmtSet(set, we.exercise.tracking, unit)}</span>
            </div>
          ))}
        </section>
      )}

      {workout.notes && <p className="mt-6 line-clamp-3 text-[15px] leading-6 text-muted">“{workout.notes}”</p>}

      {editing && (
        <div className="mt-6 flex items-center justify-between rounded-[14px] bg-surface px-4 py-2">
          <span className="text-[14px] text-muted">Editing sets</span>
          <button className="h-10 px-2 text-[15px] font-[600] text-accent" onClick={() => setEditing(false)}>
            Done
          </button>
        </div>
      )}

      <section className="mt-8 space-y-8">
        {blocks.map((b) => (
          <div key={b.items[0].we._id} className={b.group ? 'relative space-y-6 pl-3 before:absolute before:inset-y-1 before:left-0 before:w-px before:bg-line-strong' : 'space-y-6'}>
            {b.items.map(({ we, letter }) => (
              <article key={we._id}>
                <Link to="/library/$slug" params={{ slug: we.exercise.slug }} className="press block">
                  <h2 className="text-[17px] font-[600] leading-[23px]">
                    {letter && <span className="num mr-1.5 text-[13px] font-[600] text-accent">{letter}</span>}
                    {we.exercise.name}
                  </h2>
                  {we.notes && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{we.notes}</p>}
                </Link>
                <ul className="mt-1">
                  {we.sets.map((set, i) => {
                    const label = setLabel(set as never, we.sets.filter((x, j) => j < i && x.kind !== 'warmup').length, letter)
                    return (
                      <li
                        key={set._id}
                        className={`relative ${editing ? 'grid min-h-14 grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_76px_44px] items-center gap-2 py-1' : 'flex min-h-12 items-center gap-3'} ${set.isPr ? '-mx-2 rounded-[12px] bg-pr/[0.05] px-2' : ''}`}
                      >
                        {set.isPr && <span aria-hidden className="absolute left-0 top-1/2 h-8 w-[2px] -translate-y-1/2 rounded-full bg-pr" />}
                        <span className={`num w-10 shrink-0 text-[13px] ${set.kind === 'warmup' ? 'text-warning' : 'text-muted'}`}>
                          {set.isPr ? (
                            <span className="inline-flex items-center gap-0.5 text-pr">
                              <Medal aria-hidden className="size-3" />
                              <span className="text-[11px] font-[600]">PR</span>
                              <span className="sr-only">, set {label}, personal record</span>
                            </span>
                          ) : (
                            label
                          )}
                        </span>
                        {editing ? (
                          <>
                            {we.exercise.tracking !== 'reps' && we.exercise.tracking !== 'duration' && (
                              <NumField
                                key={`w-${unit}-${set.weightKg}`}
                                label={`Set ${i + 1} weight`}
                                value={toDisplayWeight(set.weightKg, unit)}
                                suffix={unit}
                                decimal
                                onCommit={(v) => updateSet({ setId: set._id, weightKg: v === null ? null : fromDisplayWeight(v, unit) })}
                              />
                            )}
                            {(we.exercise.tracking === 'reps' || we.exercise.tracking === 'duration') && <span aria-hidden />}
                            {we.exercise.tracking === 'duration' ? (
                              <NumField key={`d-${set.durationSec}`} label={`Set ${i + 1} seconds`} value={set.durationSec ?? null} suffix="s" onCommit={(v) => updateSet({ setId: set._id, durationSec: v })} />
                            ) : (
                              <NumField key={`r-${set.reps}`} label={`Set ${i + 1} reps`} value={set.reps ?? null} suffix="reps" onCommit={(v) => updateSet({ setId: set._id, reps: v })} />
                            )}
                            <NumField key={`rir-${set.rir}`} label={`Set ${i + 1} reps in reserve`} value={set.rir ?? null} suffix="RIR" narrow onCommit={(v) => updateSet({ setId: set._id, rir: v })} />
                            <button className="icon-btn shrink-0 text-muted hover:text-danger" aria-label={`Delete set ${i + 1}`} onClick={() => void removeSet({ setId: set._id })}>
                              <Trash2 className="size-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="num flex-1 text-[16px]">
                              {fmtSet(set, we.exercise.tracking, unit)}
                              {we.exercise.tracking !== 'duration' && we.exercise.tracking !== 'reps' && set.weightKg ? <span className="text-[13px] text-muted"> {unit}</span> : null}
                            </span>
                            {set.rir !== undefined && <span className="num text-[13px] text-muted">{set.rir} RIR</span>}
                          </>
                        )}
                      </li>
                    )
                  })}
                  {editing && (
                    <li>
                      <button
                        className="press flex h-12 w-full items-center gap-1.5 text-[14px] font-[600] text-muted hover:text-ink"
                        onClick={async () => {
                          const last = we.sets[we.sets.length - 1]
                          const id = await addSet({ workoutExerciseId: we._id })
                          // Copy the previous set; fall back to the rep target rather than inventing "1".
                          await completeSet({
                            setId: id,
                            weightKg: last?.weightKg ?? null,
                            reps: last?.reps ?? (we.exercise.tracking === 'duration' ? null : we.repLow || 8),
                            durationSec: last?.durationSec ?? (we.exercise.tracking === 'duration' ? 30 : null),
                            rir: last?.rir ?? null,
                          })
                        }}
                      >
                        <Plus aria-hidden className="size-4" /> Add set
                      </button>
                    </li>
                  )}
                </ul>
              </article>
            ))}
          </div>
        ))}
      </section>

      {done && (
        <Link to="/" className="btn btn-primary mt-10 w-full">
          Done
        </Link>
      )}

      <Sheet open={menu === 'options'} onClose={() => setMenu(null)} title={workout.title}>
        <div className="pb-2">
          <SheetAction icon={<Pencil className="size-5" />} label="Edit sets" onClick={() => { setEditing(true); setMenu(null) }} />
          <div className="flex min-h-14 items-center gap-4 text-[14px] text-muted">
            <Clock aria-hidden className="size-5 shrink-0" />
            <span className="num">
              {fmtDate(workout.startedAt, { hour: 'numeric', minute: '2-digit' })}
              {workout.finishedAt ? ` – ${fmtDate(workout.finishedAt, { hour: 'numeric', minute: '2-digit' })}` : ''}
              {workout.source === 'import' ? ' · imported' : workout.source === 'agent' ? ' · logged by an agent' : ''}
            </span>
          </div>
          <SheetDivider />
          <SheetAction icon={<Trash2 className="size-5" />} label="Delete workout" tone="danger" onClick={() => setMenu('delete')} />
        </div>
      </Sheet>
      <Sheet open={menu === 'delete'} onClose={() => setMenu(null)} title="Delete this workout?">
        <p className="text-[15px] text-muted">It will be removed from history and PRs recalculated. This can’t be undone.</p>
        <div className="mt-5 grid grid-cols-2 gap-2 pb-2">
          <button className="btn btn-secondary" onClick={() => setMenu(null)}>Cancel</button>
          <button
            className="btn bg-danger/15 text-danger"
            onClick={async () => {
              await remove({ workoutId: workout._id })
              navigate({ to: '/history', replace: true })
            }}
          >
            Delete
          </button>
        </div>
      </Sheet>
    </main>
  )
}

function NumField({
  value,
  suffix,
  decimal,
  narrow,
  label,
  onCommit,
}: {
  value: number | null
  suffix: string
  decimal?: boolean
  narrow?: boolean
  label: string
  onCommit: (v: number | null) => Promise<boolean> | void
}) {
  const saved = value === null ? '' : fmtNum(value)
  const [text, setText] = useState(saved)
  return (
    <label className={`flex h-11 min-w-0 items-center gap-1 rounded-[10px] bg-raised ${narrow ? 'px-2' : 'px-3'} focus-within:ring-1 focus-within:ring-line-strong`}>
      <input
        value={text}
        inputMode={decimal ? 'decimal' : 'numeric'}
        onChange={(e) => setText(e.target.value.replace(',', '.'))}
        onBlur={async () => {
          if (text === saved) return
          const n = text.trim() === '' ? null : Number.parseFloat(text)
          if (n !== null && !Number.isFinite(n)) return setText(saved)
          // A rejected value snaps back instead of lingering (and re-submitting).
          if ((await onCommit(n)) === false) setText(saved)
        }}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={label}
        className="num w-full min-w-0 bg-transparent text-[16px] font-[500] outline-none"
      />
      <span className="text-[12px] text-muted">{suffix}</span>
    </label>
  )
}

