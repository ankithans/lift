import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ChartNoAxesColumn, ChevronLeft, ChevronRight, Flame, Plus, Scale, Trash2, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { Empty } from '#/components/Empty'
import { ExerciseThumb } from '#/components/ExerciseThumb'
import { LineChart } from '#/components/LineChart'
import { PageHeader } from '#/components/PageHeader'
import { Sheet } from '#/components/Sheet'
import { BlockSkeleton } from '#/components/Skeletons'
import { fmtDate, fmtNum, fmtRelativeDay, fmtVolume, fmtWeight, fromDisplayWeight, toDisplayWeight } from '#/lib/format'
import { useMe, useUnit } from '#/lib/me'
import { weekBoundaries } from '#/lib/time'
import { useNow } from '#/lib/useNow'

export const Route = createFileRoute('/_app/progress')({ component: Progress })

function Progress() {
  const me = useMe()
  const now = useNow(60_000)
  const summary = useQuery(api.progress.summary, { weekEnd: weekBoundaries(now, me.profile?.weekStartsOn ?? 0)[7], weeks: 12 })

  return (
    <main className="page page-wide">
      <PageHeader title="Progress" />
      {summary === undefined ? (
        <div className="space-y-4">
          <BlockSkeleton h={120} />
          <BlockSkeleton h={300} />
        </div>
      ) : summary.totalWorkouts === 0 ? (
        <Empty icon={ChartNoAxesColumn} title="Your first workout starts the story" body="Muscle coverage, PRs and trends appear as you log." action={<Link to="/" className="btn btn-primary">Go train</Link>} />
      ) : (
        <div className="space-y-10 lg:grid lg:grid-cols-2 lg:gap-x-10 lg:space-y-0 lg:[&>*]:mb-10">
          <Consistency summary={summary} />
          <MuscleCoverage />
          <BodyWeight />
          <Records />
        </div>
      )}
    </main>
  )
}

function Consistency({ summary }: { summary: NonNullable<ReturnType<typeof useQuery<typeof api.progress.summary>>> }) {
  const unit = useUnit()
  const max = Math.max(1, ...summary.weeks.map((w) => w.workouts))
  const last4 = summary.weeks.slice(-4)
  const avg = last4.reduce((n, w) => n + w.workouts, 0) / 4
  return (
    <section className="animate-rise">
      <h2 className="t-eyebrow text-subtle">Consistency</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Tile label="Week streak" value={String(summary.streakWeeks)} icon={<Flame className="size-4 text-warning" />} />
        <Tile label="Per week (4w)" value={fmtNum(Math.round(avg * 10) / 10)} />
        <Tile label="Workouts" value={String(summary.totalWorkouts)} />
      </div>
      <div className="card mt-2 p-4">
        <div className="flex h-28 items-end gap-1.5">
          {summary.weeks.map((w, i) => (
            <div key={w.start} className="flex h-full flex-1 flex-col justify-end" title={`${w.workouts} workouts`}>
              <div
                className={`w-full rounded-[5px] transition-[height] duration-500 ${i === summary.weeks.length - 1 ? 'bg-accent' : 'bg-accent/35'}`}
                style={{ height: `${Math.max(w.workouts ? 8 : 3, (w.workouts / max) * 100)}%`, opacity: w.workouts ? 1 : 0.35 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-faint">
          <span>{fmtDate(summary.weeks[0].start, { month: 'short', day: 'numeric' })}</span>
          <span>This week</span>
        </div>
        <p className="num mt-3 text-[13px] text-subtle">
          {fmtVolume(summary.weeks.reduce((n, w) => n + w.volumeKg, 0), unit)} {unit} lifted in 12 weeks
        </p>
      </div>
    </section>
  )
}

function Tile({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="card px-3.5 py-3">
      <div className="flex items-center gap-1 text-[12px] font-[550] text-subtle">{icon}{label}</div>
      <div className="num mt-0.5 text-[24px] font-[680] tracking-[-0.03em]">{value}</div>
    </div>
  )
}

function MuscleCoverage() {
  const me = useMe()
  const now = useNow(60_000)
  const [offset, setOffset] = useState(0)
  const b = useMemo(() => weekBoundaries(now, me.profile?.weekStartsOn ?? 0, offset), [now, me.profile?.weekStartsOn, offset])
  const data = useQuery(api.progress.muscles, { from: b[0], to: b[7] })
  const groups = data?.groups.filter((g) => !['Traps', 'Adductors'].includes(g.group) || g.sets > 0) ?? []
  const max = Math.max(20, ...groups.map((g) => g.sets))

  return (
    <section className="animate-rise">
      <div className="flex items-center justify-between">
        <h2 className="t-eyebrow text-subtle">Weekly sets per muscle</h2>
        <div className="flex items-center">
          <button className="icon-btn size-8" onClick={() => setOffset(offset - 1)} aria-label="Previous week"><ChevronLeft className="size-4" /></button>
          <span className="num min-w-[78px] text-center text-[13px] font-[600] text-muted">
            {offset === 0 ? 'This week' : fmtDate(b[0], { month: 'short', day: 'numeric' })}
          </span>
          <button className="icon-btn size-8" disabled={offset >= 0} onClick={() => setOffset(Math.min(0, offset + 1))} aria-label="Next week"><ChevronRight className="size-4" /></button>
        </div>
      </div>
      <div className="card mt-3 p-4">
        {data === undefined ? (
          <BlockSkeleton h={260} />
        ) : (
          <>
            <ul className="space-y-2.5">
              {groups.map((g) => {
                const pct = Math.min(1, g.sets / max)
                const zone = g.sets >= 10 && g.sets <= 20 ? 'bg-accent' : g.sets > 20 ? 'bg-warning' : 'bg-accent/45'
                return (
                  <li key={g.group} className="grid grid-cols-[92px_1fr_36px] items-center gap-3">
                    <span className={`text-[14px] ${g.sets ? 'text-ink' : 'text-faint'}`}>{g.group}</span>
                    <span className="relative h-2 overflow-hidden rounded-full bg-raised">
                      <span className="absolute inset-y-0 border-x border-black/60 bg-white/[0.04]" style={{ left: `${(10 / max) * 100}%`, width: `${(10 / max) * 100}%` }} />
                      <span className={`absolute inset-y-0 left-0 rounded-full ${zone} transition-[width] duration-700 ease-out`} style={{ width: `${pct * 100}%` }} />
                    </span>
                    <span className="num text-right text-[14px] font-[600] text-muted">{fmtNum(g.sets)}</span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-4 text-[12px] leading-[17px] text-subtle">
              Working sets this week: primary muscle counts 1, secondary ½. Shaded band = 10–20 sets, a common hypertrophy range.
            </p>
          </>
        )}
      </div>
    </section>
  )
}

function BodyWeight() {
  const unit = useUnit()
  const rows = useQuery(api.progress.bodyMetrics, { kind: 'weight', limit: 200 })
  const log = useMutation(api.progress.logBodyMetric)
  const del = useMutation(api.progress.deleteBodyMetric)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const points = (rows ?? []).slice().reverse().map((r) => ({ x: r.measuredAt, y: toDisplayWeight(r.value, unit) ?? 0 }))

  return (
    <section className="animate-rise">
      <div className="flex items-center justify-between">
        <h2 className="t-eyebrow text-subtle">Body weight</h2>
        <button className="chip h-8" onClick={() => { setText(rows?.[0] ? fmtNum(toDisplayWeight(rows[0].value, unit)) : ''); setOpen(true) }}>
          <Plus className="size-3.5" /> Log
        </button>
      </div>
      <div className="card mt-3 p-4">
        {rows === undefined ? (
          <BlockSkeleton h={160} />
        ) : rows.length === 0 ? (
          <div className="flex items-center gap-3 py-4 text-muted">
            <Scale className="size-5 text-subtle" /> No weigh-ins yet. Log one to start a trend.
          </div>
        ) : points.length === 1 ? (
          <div className="num text-[26px] font-[680]">{fmtWeight(rows[0].value, unit)} <span className="text-[14px] text-subtle">{unit} · {fmtRelativeDay(rows[0].measuredAt)}</span></div>
        ) : (
          <LineChart points={points} unit={unit} height={150} color="#e9e9ec" />
        )}
        {rows && rows.length > 0 && (
          <ul className="mt-3 divide-hair">
            {rows.slice(0, 4).map((r) => (
              <li key={r._id} className="flex h-11 items-center justify-between text-[14px]">
                <span className="text-muted">{fmtRelativeDay(r.measuredAt)}</span>
                <span className="flex items-center gap-2">
                  <span className="num font-[600]">{fmtWeight(r.value, unit)} {unit}</span>
                  <button className="icon-btn size-8 text-faint" onClick={() => del({ metricId: r._id })} aria-label="Delete">
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Log body weight">
        <form
          className="pb-2"
          onSubmit={async (e) => {
            e.preventDefault()
            const n = Number.parseFloat(text.replace(',', '.'))
            if (!Number.isFinite(n) || n <= 0) return
            await log({ kind: 'weight', value: fromDisplayWeight(n, unit) })
            setOpen(false)
          }}
        >
          <label className="flex items-baseline gap-2 rounded-[18px] bg-raised px-5 py-4">
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              inputMode="decimal"
              placeholder="0.0"
              className="num w-full bg-transparent text-[40px] font-[680] tracking-[-0.03em] outline-none placeholder:text-faint"
            />
            <span className="text-[18px] font-[600] text-subtle">{unit}</span>
          </label>
          <button type="submit" className="btn btn-primary mt-4 w-full">Save</button>
        </form>
      </Sheet>
    </section>
  )
}

function Records() {
  const unit = useUnit()
  const prs = useQuery(api.progress.prs, { limit: 12 })
  return (
    <section className="animate-rise">
      <h2 className="t-eyebrow text-subtle">Personal records</h2>
      <div className="card mt-3 px-4">
        {prs === undefined ? (
          <div className="py-4"><BlockSkeleton h={200} /></div>
        ) : prs.length === 0 ? (
          <p className="py-6 text-muted">Records appear after your second session of an exercise.</p>
        ) : (
          <ul className="divide-hair">
            {prs.map((p) => (
              <li key={p.exerciseId}>
                <Link to="/library/$slug" params={{ slug: p.slug }} className="press flex items-center gap-3 py-3">
                  <ExerciseThumb src={p.thumbnailUrl} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-[560]">{p.name}</div>
                    <div className="num text-[13px] text-subtle">
                      {fmtWeight(p.weightKg, unit)} {unit} × {p.reps} · {fmtRelativeDay(p.at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num flex items-center gap-1 text-[15px] font-[650] text-pr">
                      <Trophy className="size-3.5" /> {fmtWeight(p.bestE1rmKg, unit)}
                    </div>
                    <div className="text-[11px] text-subtle">est. 1RM</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
