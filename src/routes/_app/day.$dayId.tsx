import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Link2, Loader2, Pencil, Play } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { ExerciseInfo } from '#/components/ExerciseDetail'
import { ExerciseThumb } from '#/components/ExerciseThumb'
import { PageHeader } from '#/components/PageHeader'
import { Sheet } from '#/components/Sheet'
import { BlockSkeleton } from '#/components/Skeletons'
import { fmtClock, fmtRelativeDay, fmtWeight, WEEKDAYS_LONG } from '#/lib/format'
import { useMe, useUnit } from '#/lib/me'
import { useTitle } from '#/lib/useTitle'
import { tap } from '#/lib/haptics'

export const Route = createFileRoute('/_app/day/$dayId')({ component: DayPreview })

function DayPreview() {
  const { dayId } = Route.useParams()
  const day = useQuery(api.programs.day, { dayId: dayId as Id<'programDays'> })
  const me = useMe()
  const unit = useUnit()
  const start = useMutation(api.workouts.start)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<{ id: string; name: string } | null>(null)
  useTitle(day?.title)

  if (day === undefined) {
    return (
      <main className="page space-y-4 pt-20">
        <BlockSkeleton h={120} />
        <BlockSkeleton h={320} />
      </main>
    )
  }
  if (day === null) return null

  const active = me.activeWorkout
  return (
    <main className="page">
      <PageHeader
        back
        eyebrow={day.weekday !== undefined ? WEEKDAYS_LONG[day.weekday] : 'Workout'}
        title={day.title}
        action={
          <Link to="/program" search={{ day: day._id }} className="icon-btn" aria-label="Edit plan">
            <Pencil className="size-[18px]" />
          </Link>
        }
      />
      <p className="num -mt-3 text-[15px] text-muted">
        {day.exercises.length} exercises · {day.totalSets} sets · ~{day.estimatedMinutes} min
      </p>

      {day.targets.length > 0 && (
        <section className="mt-6">
          <h2 className="t-eyebrow text-subtle">Target muscles</h2>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-raised">
            {day.targets.map((t, i) => (
              <div key={t.group} style={{ width: `${t.share * 100}%`, opacity: 1 - i * 0.22 }} className="h-full bg-accent first:rounded-l-full" />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {day.targets.map((t, i) => (
              <span key={t.group} className="flex items-center gap-1.5 text-[14px]">
                <span className="size-2 rounded-full bg-accent" style={{ opacity: 1 - i * 0.22 }} />
                {t.group} <span className="num text-subtle">{Math.round(t.share * 100)}%</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="t-eyebrow text-subtle">Exercises</h2>
        <ol className="mt-2">
          {day.exercises.map((e, i) => {
            const prev = day.exercises[i - 1]
            const next = day.exercises[i + 1]
            const startsGroup = e.group && next?.group === e.group && prev?.group !== e.group
            const inGroup = Boolean(e.group && (prev?.group === e.group || next?.group === e.group))
            return (
              <li key={e._id}>
                {startsGroup && (
                  <div className="mt-3 flex items-center gap-1.5 text-accent">
                    <Link2 className="size-3.5" />
                    <span className="t-eyebrow">Superset</span>
                  </div>
                )}
                <button
                  onClick={() => setInfo({ id: e.exercise._id, name: e.exercise.name })}
                  className={`press flex w-full items-center gap-3 py-3 text-left ${inGroup ? 'border-l-2 border-accent/30 pl-3' : ''}`}
                >
                  <ExerciseThumb src={e.exercise.thumbnailUrl} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[16px] font-[580]">{e.exercise.name}</div>
                    <div className="num text-[14px] text-muted">
                      {e.sets} sets · {e.repLow === e.repHigh ? e.repHigh : `${e.repLow}–${e.repHigh}`} reps · rest {fmtClock(e.restSec)}
                    </div>
                    {e.last && (
                      <div className="num truncate text-[13px] text-subtle">
                        Last: {e.last.sets.map((x) => (x.durationSec && !x.reps ? `${x.durationSec}s` : `${x.weightKg ? fmtWeight(x.weightKg, unit) : 'BW'}×${x.reps ?? '—'}`)).join(' · ')}
                        {e.last.at ? ` · ${fmtRelativeDay(e.last.at)}` : ''}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ol>
      </section>

      {/* Room for the fixed start bar so it never covers the last exercise. */}
      <div aria-hidden className="h-24 lg:hidden" />
      <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+var(--dock,0px))] z-30 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pb-3 pt-8 lg:static lg:mt-8 lg:bg-none lg:p-0">
        <div className="mx-auto max-w-[600px]">
          {active ? (
            <Link to="/workout" className="btn btn-primary w-full shadow-[0_10px_40px_-6px_#000]">
              Resume {active.title}
            </Link>
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
              className="btn btn-primary w-full shadow-[0_10px_40px_-6px_#000]"
            >
              {busy ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-[18px] fill-current" />}
              Start workout
            </button>
          )}
        </div>
      </div>

      <Sheet open={info !== null} onClose={() => setInfo(null)} title={info?.name} size="tall">
        {info && <ExerciseInfo id={info.id} />}
      </Sheet>
    </main>
  )
}
