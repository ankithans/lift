import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { Check, ChevronLeft, ChevronRight, CirclePlay, Footprints, Loader2, Play, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { ExerciseThumb } from '#/components/ExerciseThumb'
import { PageHeader } from '#/components/PageHeader'
import { BlockSkeleton } from '#/components/Skeletons'
import { fmtDate, fmtDuration, fmtVolume, WEEKDAYS, WEEKDAYS_LONG } from '#/lib/format'
import { useMe, useUnit } from '#/lib/me'
import { startOfDay, weekBoundaries } from '#/lib/time'
import { useNow } from '#/lib/useNow'
import { tap } from '#/lib/haptics'

export const Route = createFileRoute('/_app/')({ component: Train })

type Week = NonNullable<FunctionReturnType<typeof api.programs.week>>
type Day = Week['days'][number]

function Train() {
  const me = useMe()
  const weekStartsOn = me.profile?.weekStartsOn ?? 0
  const now = useNow(60_000)
  const [offset, setOffset] = useState(0)
  const boundaries = useMemo(() => weekBoundaries(now, weekStartsOn, offset), [now, weekStartsOn, offset])
  const week = useQuery(api.programs.week, { boundaries, now })
  const todayIndex = week?.days.findIndex((d) => d.isToday) ?? -1
  const [picked, setPicked] = useState<number | null>(null)
  const selectedIndex = picked ?? (todayIndex >= 0 ? todayIndex : 0)
  // Days before the account existed aren't "skipped".
  const joined = startOfDay(me.profile?._creationTime ?? 0)
  const days = week?.days.map((d) => (d.status === 'missed' && d.start < joined ? { ...d, status: 'upcoming' as const } : d))
  const selected = days?.[selectedIndex]

  const greeting = (() => {
    const h = new Date(now).getHours()
    return h < 5 ? 'Late session' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'
  })()

  return (
    <main className="page">
      <PageHeader
        eyebrow={fmtDate(now, { weekday: 'long', month: 'long', day: 'numeric' })}
        title={`${greeting}${me.name ? `, ${me.name}` : ''}`}
      />

      {week === undefined ? (
        <div className="space-y-4">
          <BlockSkeleton h={74} />
          <BlockSkeleton h={260} />
        </div>
      ) : !week.program ? (
        <NoProgram />
      ) : (
        <>
          <section aria-label="Week" className="animate-fade">
            <div className="mb-3 flex items-center justify-between">
              <Link to="/program" className="min-w-0 truncate text-[14px] font-[560] text-muted hover:text-ink">
                {week.program.name}
              </Link>
              <div className="flex items-center">
                <button className="icon-btn size-9" aria-label="Previous week" onClick={() => { setOffset(offset - 1); setPicked(null) }}>
                  <ChevronLeft className="size-[18px]" />
                </button>
                <button
                  className={`h-9 rounded-full px-2 text-[13px] font-[600] ${offset === 0 ? 'text-subtle' : 'text-accent'}`}
                  onClick={() => { setOffset(0); setPicked(null) }}
                >
                  {offset === 0 ? 'This week' : fmtDate(boundaries[0], { month: 'short', day: 'numeric' })}
                </button>
                <button className="icon-btn size-9" aria-label="Next week" onClick={() => { setOffset(offset + 1); setPicked(null) }}>
                  <ChevronRight className="size-[18px]" />
                </button>
              </div>
            </div>
            <WeekStrip days={days!} selected={selectedIndex} onSelect={(i) => { tap(); setPicked(i) }} />
          </section>

          {selected && <DayCard key={`${offset}-${selectedIndex}`} day={selected} />}

          <section className="mt-10">
            <h2 className="t-eyebrow mb-1 text-subtle">The week</h2>
            <div className="divide-hair">
              {days!.map((d, i) => (
                <WeekRow key={i} day={d} active={i === selectedIndex} onSelect={() => { tap(); setPicked(i); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}

function statusGlyph(d: Day) {
  switch (d.status) {
    case 'done':
      return <Check className="size-[15px]" strokeWidth={2.6} />
    case 'active':
      return <span className="size-2 rounded-full bg-accent" />
    case 'today':
      return <span className="size-1.5 rounded-full bg-current" />
    case 'missed':
      return <span className="h-[2px] w-2 rounded bg-current" />
    default:
      return null
  }
}

function WeekStrip({ days, selected, onSelect }: { days: Day[]; selected: number; onSelect: (i: number) => void }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((d, i) => {
        const on = i === selected
        const done = d.status === 'done'
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`press relative flex h-[74px] flex-col items-center justify-center gap-1.5 rounded-[16px] transition-colors ${
              on ? 'bg-ink text-black' : d.isToday ? 'bg-raised' : 'hover:bg-surface'
            }`}
          >
            <span className={`text-[11px] font-[650] uppercase tracking-[0.06em] ${on ? 'text-black/60' : 'text-subtle'}`}>
              {WEEKDAYS[d.weekday].slice(0, 1)}
            </span>
            <span className={`num text-[17px] font-[650] leading-none ${on ? '' : d.planned?.kind === 'workout' ? 'text-ink' : 'text-subtle'}`}>
              {new Date(d.start).getDate()}
            </span>
            <span
              className={`grid h-4 place-items-center ${
                done ? (on ? 'text-black' : 'text-accent') : d.status === 'missed' ? (on ? 'text-black/40' : 'text-faint') : on ? 'text-black' : 'text-accent'
              }`}
            >
              {statusGlyph(d)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function WeekRow({ day, active, onSelect }: { day: Day; active: boolean; onSelect: () => void }) {
  const unit = useUnit()
  const title = day.workout?.title ?? day.planned?.title ?? 'Rest'
  const rest = !day.workout && (!day.planned || day.planned.kind === 'rest')
  return (
    <button onClick={onSelect} className="press flex h-16 w-full items-center gap-4 text-left">
      <span className={`w-10 shrink-0 text-[13px] font-[600] ${day.isToday ? 'text-accent' : 'text-subtle'}`}>
        {WEEKDAYS[day.weekday]}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[16px] font-[560] ${rest ? 'text-subtle' : active ? 'text-ink' : 'text-ink/90'}`}>{title}</span>
        {day.workout?.stats && (
          <span className="num block text-[13px] text-subtle">
            {fmtDuration(day.workout.stats.durationSec)} · {day.workout.stats.sets} sets · {fmtVolume(day.workout.stats.volumeKg, unit)} {unit}
          </span>
        )}
        {day.extras.length > 0 && (
          <span className="block truncate text-[13px] text-subtle">+ {day.extras.map((w) => w.title).join(', ')}</span>
        )}
      </span>
      <span className="shrink-0 text-[13px] font-[560]">
        {day.status === 'done' && <span className="inline-flex items-center gap-1 text-accent"><Check className="size-4" strokeWidth={2.4} /> Done</span>}
        {day.status === 'active' && <span className="text-accent">In progress</span>}
        {day.status === 'today' && <span className="text-ink">Today</span>}
        {day.status === 'missed' && <span className="text-faint">Skipped</span>}
        {day.status === 'upcoming' && <ChevronRight className="size-4 text-faint" />}
      </span>
    </button>
  )
}

function DayCard({ day }: { day: Day }) {
  const navigate = useNavigate()
  const unit = useUnit()
  const start = useMutation(api.workouts.start)
  const [busy, setBusy] = useState(false)
  const planned = day.planned
  const label = day.isToday ? 'Today' : WEEKDAYS_LONG[day.weekday]

  async function begin(programDayId?: Id<'programDays'>) {
    setBusy(true)
    tap('success')
    try {
      await start(programDayId ? { programDayId } : {})
      navigate({ to: '/workout' })
    } finally {
      setBusy(false)
    }
  }

  if (day.workout && day.status === 'done') {
    const s = day.workout.stats
    return (
      <section className="card mt-5 p-5 animate-rise">
        <div className="t-eyebrow text-accent">{label} · Completed</div>
        <h2 className="mt-2 t-screen">{day.workout.title}</h2>
        {s && (
          <dl className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="Time" value={fmtDuration(s.durationSec)} />
            <Stat label="Sets" value={String(s.sets)} />
            <Stat label={`Volume ${unit}`} value={fmtVolume(s.volumeKg, unit)} />
          </dl>
        )}
        <Link to="/history/$workoutId" params={{ workoutId: day.workout._id }} className="btn btn-secondary mt-5 w-full">
          View workout
        </Link>
      </section>
    )
  }

  if (day.status === 'active') {
    return (
      <section className="card mt-5 p-5 animate-rise">
        <div className="t-eyebrow text-accent">In progress</div>
        <h2 className="mt-2 t-screen">{day.workout?.title}</h2>
        <Link to="/workout" className="btn btn-primary mt-5 w-full">
          <CirclePlay className="size-5" /> Resume workout
        </Link>
      </section>
    )
  }

  if (!planned || planned.kind === 'rest') {
    return (
      <section className="card mt-5 p-5 animate-rise">
        <div className="t-eyebrow text-subtle">{label}</div>
        <h2 className="mt-2 flex items-center gap-2 t-screen">
          Rest day <Footprints className="size-5 text-subtle" strokeWidth={1.75} />
        </h2>
        <p className="mt-2 text-[15px] leading-[22px] text-muted">Recovery is where the growth happens. A walk counts.</p>
        <button disabled={busy} onClick={() => begin()} className="btn btn-secondary mt-5 w-full">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />} Start an empty workout
        </button>
      </section>
    )
  }

  return (
    <section className="card mt-5 overflow-hidden animate-rise">
      <div className="p-5 pb-4">
        <div className={`t-eyebrow ${day.isToday ? 'text-accent' : day.status === 'missed' ? 'text-faint' : 'text-subtle'}`}>
          {label}
          {day.status === 'missed' ? ' · Skipped' : ''}
        </div>
        <h2 className="mt-2 t-screen">{planned.title}</h2>
        <p className="num mt-1 text-[14px] text-muted">
          {planned.exercises.length} exercises · {planned.totalSets} sets · ~{planned.estimatedMinutes} min
        </p>
        {planned.targets.length > 0 && (
          <div className="mt-4 flex gap-1.5">
            {planned.targets.slice(0, 4).map((t) => (
              <span key={t.group} className="rounded-full bg-raised px-2.5 py-1 text-[12px] font-[600] text-muted">
                {t.group} <span className="num text-subtle">{Math.round(t.share * 100)}%</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <Link to="/day/$dayId" params={{ dayId: planned._id }} className="block px-5 transition-colors hover:bg-raised/40">
        <ul className="divide-hair">
          {planned.exercises.map((e, i) => {
            const prev = planned.exercises[i - 1]
            const next = planned.exercises[i + 1]
            const inGroup = Boolean(e.group && (prev?.group === e.group || next?.group === e.group))
            return (
              <li key={e._id} className="flex items-center gap-3 py-2.5">
                <ExerciseThumb src={e.exercise.thumbnailUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-[560]">{e.exercise.name}</div>
                  <div className="num text-[13px] text-subtle">
                    {e.sets} × {e.repLow === e.repHigh ? e.repHigh : `${e.repLow}–${e.repHigh}`}
                    {inGroup && <span className="ml-2 text-accent/80">Superset</span>}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </Link>
      <div className="flex gap-2 p-5 pt-4">
        <button disabled={busy} onClick={() => begin(planned._id)} className="btn btn-primary flex-1">
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-[18px] fill-current" />}
          Start workout
        </button>
        <Link to="/day/$dayId" params={{ dayId: planned._id }} className="btn btn-secondary px-5">
          Preview
        </Link>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] font-[550] text-subtle">{label}</dt>
      <dd className="num mt-0.5 text-[20px] font-[650] tracking-[-0.02em]">{value}</dd>
    </div>
  )
}

function NoProgram() {
  return (
    <section className="card p-6 text-center animate-rise">
      <h2 className="t-title">No program yet</h2>
      <p className="mt-2 text-[15px] text-muted">Pick a plan and your week fills itself in.</p>
      <Link to="/welcome" className="btn btn-primary mt-5">Choose a program</Link>
    </section>
  )
}
