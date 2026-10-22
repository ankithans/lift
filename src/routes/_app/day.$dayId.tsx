import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ChevronRight, Info, Loader2, MoreHorizontal, Pencil, Play } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { ExerciseInfo } from '#/components/ExerciseDetail'
import { ExerciseThumb } from '#/components/ExerciseThumb'
import { PageHeader } from '#/components/PageHeader'
import { Sheet, SheetAction } from '#/components/Sheet'
import { BlockSkeleton } from '#/components/Skeletons'
import { fmtClock, fmtDate, fmtReps, WEEKDAYS_LONG } from '#/lib/format'
import { tap } from '#/lib/haptics'
import { useMe } from '#/lib/me'
import { startOfDay } from '#/lib/time'
import { useTitle } from '#/lib/useTitle'

export const Route = createFileRoute('/_app/day/$dayId')({ component: DayPreview })

/** The next date (today or later) that falls on `weekday`. */
function nextDate(weekday: number) {
  const d = new Date(startOfDay(Date.now()))
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7))
  return d.getTime()
}

function DayPreview() {
  const { dayId } = Route.useParams()
  const day = useQuery(api.programs.day, { dayId: dayId as Id<'programDays'> })
  const me = useMe()
  const start = useMutation(api.workouts.start)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<{ id: string; name: string; plan: string } | null>(null)
  const [menu, setMenu] = useState<null | 'menu' | 'details'>(null)
  useTitle(day?.title)

  if (day === undefined) {
    return (
      <main className="page space-y-4 pt-20">
        <BlockSkeleton h={90} />
        <BlockSkeleton h={380} />
      </main>
    )
  }
  if (day === null) return null

  const active = me.activeWorkout
  const when = day.weekday !== undefined ? fmtDate(nextDate(day.weekday), { weekday: 'long', day: 'numeric', month: 'short' }) : 'Workout'

  // Position of each exercise inside its superset (A, B, …), if any.
  const letters = day.exercises.map((e, i) => {
    const inGroup = Boolean(e.group && (day.exercises[i - 1]?.group === e.group || day.exercises[i + 1]?.group === e.group))
    if (!inGroup) return null
    let k = 0
    for (let j = i - 1; j >= 0 && day.exercises[j].group === e.group; j--) k++
    return String.fromCharCode(65 + k)
  })

  return (
    <main className="page pb-[calc(var(--safe-bottom)+120px)]">
      <PageHeader
        back
        eyebrow={when}
        title={day.title}
        subtitle={`${day.exercises.length} exercises · about ${day.estimatedMinutes} min`}
        action={
          <button className="icon-btn size-12" aria-label="Workout options" onClick={() => setMenu('menu')}>
            <MoreHorizontal className="size-5" />
          </button>
        }
      />

      <ol className="-mt-2">
        {day.exercises.map((e, i) => {
          const letter = letters[i]
          const startsGroup = letter === 'A'
          const rounds = startsGroup ? Math.max(...day.exercises.filter((x) => x.group === e.group).map((x) => x.sets)) : 0
          const plan = `${e.sets} × ${fmtReps(e.repLow, e.repHigh)}`
          return (
            <li key={e._id}>
              {startsGroup && <div className="mb-1 mt-4 text-[13px] font-[500] text-muted">Superset · {rounds} rounds</div>}
              <button
                onClick={() => setInfo({ id: e.exercise._id, name: e.exercise.name, plan: `${plan} reps · rest ${fmtClock(e.restSec)}` })}
                className={`press -mx-2 flex min-h-[76px] w-[calc(100%+16px)] items-center gap-3 rounded-2xl px-2 text-left hover:bg-surface ${
                  letter ? 'relative before:absolute before:bottom-2 before:left-[-4px] before:top-2 before:w-px before:bg-line-strong' : ''
                }`}
              >
                <ExerciseThumb src={e.exercise.thumbnailUrl} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-[550] leading-[22px]">
                    {letter && <span className="num mr-1.5 text-[13px] font-[600] text-accent">{letter}</span>}
                    {e.exercise.name}
                  </span>
                  <span className="num block text-[13px] text-muted">{plan}</span>
                </span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
              </button>
            </li>
          )
        })}
      </ol>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-black px-5 pb-[calc(var(--safe-bottom)+16px)] pt-4 lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto max-w-[600px]">
          {active ? (
            <>
              {active.title !== day.title && <p className="mb-2 text-center text-[13px] text-muted">{active.title} is still in progress.</p>}
              <Link to="/workout" className="btn btn-primary w-full">
                <Play aria-hidden className="size-[18px] fill-current" /> Resume {active.title}
              </Link>
            </>
          ) : (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                tap('success')
                try {
                  await start({ programDayId: day._id })
                  navigate({ to: '/workout' })
                } finally {
                  setBusy(false)
                }
              }}
              className="btn btn-primary w-full"
            >
              {busy ? <Loader2 className="size-5 animate-spin" /> : <Play aria-hidden className="size-[18px] fill-current" />}
              Start {day.title}
            </button>
          )}
        </div>
      </div>

      <Sheet open={menu === 'menu'} onClose={() => setMenu(null)} title={day.title}>
        <div className="pb-2">
          <SheetAction icon={<Info className="size-5" />} label="Workout details" onClick={() => setMenu('details')} />
          <SheetAction
            icon={<Pencil className="size-5" />}
            label="Edit workout"
            onClick={() => {
              setMenu(null)
              navigate({ to: '/program', search: { day: day._id } })
            }}
          />
        </div>
      </Sheet>

      <Sheet open={menu === 'details'} onClose={() => setMenu(null)} title="Workout details">
        <div className="pb-2">
          <div className="flex min-h-14 items-center justify-between border-b border-line">
            <span className="text-[16px]">Working sets</span>
            <span className="num text-[16px] text-muted">{day.totalSets}</span>
          </div>
          <div className="flex min-h-14 items-center justify-between border-b border-line">
            <span className="text-[16px]">Usual day</span>
            <span className="text-[16px] text-muted">{day.weekday !== undefined ? WEEKDAYS_LONG[day.weekday] : '—'}</span>
          </div>
          <h3 className="mb-1 mt-6 text-[13px] font-[500] text-muted">Muscle emphasis</h3>
          <ul>
            {day.targets.map((t) => (
              <li key={t.group} className="flex min-h-12 items-center justify-between border-b border-line text-[16px]">
                <span>{t.group}</span>
                <span className="num text-muted">{Math.round(t.share * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>

      <Sheet open={info !== null} onClose={() => setInfo(null)} title={info?.name} size="tall">
        {info && (
          <>
            <p className="num -mt-1 mb-4 text-[14px] text-muted">{info.plan}</p>
            <ExerciseInfo id={info.id} defaultTab="form" />
          </>
        )}
      </Sheet>
    </main>
  )
}
