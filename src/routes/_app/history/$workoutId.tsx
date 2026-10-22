import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Check, MoreHorizontal, Pencil, Trash2, Trophy } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { ExerciseThumb } from '#/components/ExerciseThumb'
import { PageHeader } from '#/components/PageHeader'
import { Sheet, SheetAction } from '#/components/Sheet'
import { BlockSkeleton } from '#/components/Skeletons'
import { fmtDate, fmtDuration, fmtNum, fmtVolume, fmtWeight, fromDisplayWeight, toDisplayWeight } from '#/lib/format'
import { useUnit } from '#/lib/me'
import { useTitle } from '#/lib/useTitle'
import { setLabel, toBlocks } from '#/lib/workout'

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
  const updateSet = useMutation(api.workouts.updateSet)
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

  return (
    <main className="page">
      {done ? (
        <section className="pt-[calc(var(--safe-top)+28px)] text-center animate-rise">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-accent text-accent-ink animate-pop">
            <Check className="size-8" strokeWidth={2.8} />
          </span>
          <h1 className="mt-5 t-large">Workout complete</h1>
          <p className="mt-2 text-muted">{workout.title} · {fmtDate(workout.startedAt, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        </section>
      ) : (
        <PageHeader
          back
          eyebrow={fmtDate(workout.startedAt, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          title={workout.title}
          action={
            <button className="icon-btn" onClick={() => setMenu('options')} aria-label="Workout options">
              <MoreHorizontal className="size-5" />
            </button>
          }
        />
      )}

      {s && (
        <dl className={`grid grid-cols-3 gap-2 ${done ? 'mt-8' : ''}`}>
          {[
            ['Duration', fmtDuration(s.durationSec)],
            ['Sets', String(s.sets)],
            [`Volume ${unit}`, fmtVolume(s.volumeKg, unit)],
          ].map(([k, v]) => (
            <div key={k} className="card px-4 py-3.5">
              <dt className="text-[12px] font-[550] text-subtle">{k}</dt>
              <dd className="num mt-0.5 text-[22px] font-[680] tracking-[-0.02em]">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {prSets.length > 0 && (
        <section className="mt-4 rounded-[20px] bg-pr-dim p-4 animate-rise">
          <h2 className="flex items-center gap-2 text-[14px] font-[650] text-pr">
            <Trophy className="size-4" /> {prSets.length} personal record{prSets.length > 1 ? 's' : ''}
          </h2>
          <ul className="mt-2 space-y-1.5">
            {prSets.map(({ we, set }) => (
              <li key={set._id} className="flex items-baseline justify-between gap-3 text-[15px]">
                <span className="truncate">{we.exercise.name}</span>
                <span className="num shrink-0 font-[650]">
                  {fmtWeight(set.weightKg, unit)} {unit} × {set.reps}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {workout.notes && <p className="mt-4 rounded-[18px] bg-surface p-4 text-[15px] italic text-muted">“{workout.notes}”</p>}

      <section className="mt-8 space-y-6">
        {blocks.map((b) => (
          <div key={b.items[0].we._id} className={b.group ? 'border-l-2 border-accent/25 pl-3' : ''}>
            {b.items.map(({ we, letter }) => (
              <article key={we._id} className="mb-5 last:mb-0">
                <Link to="/library/$slug" params={{ slug: we.exercise.slug }} className="press flex items-center gap-3">
                  <ExerciseThumb src={we.exercise.thumbnailUrl} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {letter && <span className="num grid size-5 place-items-center rounded-md bg-accent/15 text-[11px] font-[750] text-accent">{letter}</span>}
                      <h2 className="truncate text-[16px] font-[600]">{we.exercise.name}</h2>
                    </div>
                    {we.notes && <p className="truncate text-[13px] italic text-subtle">{we.notes}</p>}
                  </div>
                </Link>
                <div className="mt-2 divide-hair rounded-[16px] bg-surface px-4">
                  {we.sets.map((set, i) => (
                    <div key={set._id} className="flex h-12 items-center gap-3">
                      <span className={`num w-7 text-[13px] font-[700] ${set.kind !== 'working' ? 'text-warning' : 'text-subtle'}`}>
                        {setLabel(set as never, we.sets.filter((x, j) => j < i && x.kind === 'working').length, letter)}
                      </span>
                      {editing ? (
                        <div className="flex flex-1 items-center gap-2">
                          {we.exercise.tracking !== 'reps' && we.exercise.tracking !== 'duration' && (
                            <NumField
                              value={toDisplayWeight(set.weightKg, unit)}
                              suffix={unit}
                              decimal
                              onCommit={(v) => updateSet({ setId: set._id, weightKg: v === null ? null : fromDisplayWeight(v, unit) })}
                            />
                          )}
                          {we.exercise.tracking === 'duration' ? (
                            <NumField value={set.durationSec ?? null} suffix="s" onCommit={(v) => updateSet({ setId: set._id, durationSec: v })} />
                          ) : (
                            <NumField value={set.reps ?? null} suffix="reps" onCommit={(v) => updateSet({ setId: set._id, reps: v })} />
                          )}
                        </div>
                      ) : (
                        <span className="num flex-1 text-[16px] font-[560]">
                          {we.exercise.tracking === 'duration'
                            ? `${fmtNum(set.durationSec)} s`
                            : we.exercise.tracking === 'reps'
                              ? `${set.reps ?? '—'} reps`
                              : `${fmtWeight(set.weightKg, unit)} ${unit} × ${set.reps ?? '—'}`}
                        </span>
                      )}
                      {set.rir !== undefined && !editing && <span className="num text-[13px] text-subtle">RIR {set.rir}</span>}
                      {set.isPr && <Trophy className="size-4 text-pr" aria-label="Personal record" />}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ))}
      </section>

      <div className="mt-10 space-y-2">
        {done ? (
          <Link to="/" className="btn btn-primary w-full">Done</Link>
        ) : (
          <button className="btn btn-secondary w-full" onClick={() => setEditing(!editing)}>
            {editing ? <><Check className="size-5" /> Done editing</> : <><Pencil className="size-[18px]" /> Edit sets</>}
          </button>
        )}
      </div>
      <p className="num mt-4 text-center text-[13px] text-subtle">
        {fmtDate(workout.startedAt, { hour: 'numeric', minute: '2-digit' })}
        {workout.finishedAt ? ` – ${fmtDate(workout.finishedAt, { hour: 'numeric', minute: '2-digit' })}` : ''}
        {workout.source === 'import' ? ' · imported' : workout.source === 'agent' ? ' · logged by agent' : ''}
      </p>

      <Sheet open={menu === 'options'} onClose={() => setMenu(null)} title="Workout">
        <div className="space-y-1 pb-2">
          <SheetAction icon={<Pencil className="size-4" />} label="Edit sets" onClick={() => { setEditing(true); setMenu(null) }} />
          <SheetAction icon={<Trash2 className="size-4" />} label="Delete workout" tone="danger" onClick={() => setMenu('delete')} />
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
  onCommit,
}: {
  value: number | null
  suffix: string
  decimal?: boolean
  onCommit: (v: number | null) => void
}) {
  const [text, setText] = useState(value === null ? '' : fmtNum(value))
  return (
    <label className="flex h-11 flex-1 items-center gap-1 rounded-[10px] bg-raised px-3 focus-within:ring-1 focus-within:ring-line-strong">
      <input
        value={text}
        inputMode={decimal ? 'decimal' : 'numeric'}
        onChange={(e) => setText(e.target.value.replace(',', '.'))}
        onBlur={() => {
          const n = text.trim() === '' ? null : Number.parseFloat(text)
          if (n === null || Number.isFinite(n)) onCommit(n)
        }}
        onFocus={(e) => e.currentTarget.select()}
        className="num w-full min-w-0 bg-transparent text-[16px] font-[600] outline-none"
      />
      <span className="text-[12px] text-subtle">{suffix}</span>
    </label>
  )
}

