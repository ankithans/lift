import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ChartNoAxesColumn, ChevronLeft, ChevronRight, Info, Medal, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { Empty } from '#/components/Empty'
import { LineChart } from '#/components/LineChart'
import { PageHeader } from '#/components/PageHeader'
import { Sheet } from '#/components/Sheet'
import { BlockSkeleton } from '#/components/Skeletons'
import { fmtDate, fmtNum, fmtRelativeDay, fmtSet, fmtVolume, fmtWeight, fromDisplayWeight, toDisplayWeight } from '#/lib/format'
import { useMe, useUnit } from '#/lib/me'
import { weekBoundaries } from '#/lib/time'
import { useNow } from '#/lib/useNow'

type Search = { view?: 'weight' }

export const Route = createFileRoute('/_app/progress')({
  head: () => ({ meta: [{ title: 'Progress · Lift' }] }),
  validateSearch: (s: Record<string, unknown>): Search => (s.view === 'weight' ? { view: 'weight' } : {}),
  component: Progress,
})

function rangeLabel(start: number, end: number) {
  const a = new Date(start)
  const b = new Date(end - 1)
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${fmtDate(start, { month: 'short' })}`
    : `${fmtDate(start, { day: 'numeric', month: 'short' })} – ${fmtDate(b.getTime(), { day: 'numeric', month: 'short' })}`
}

function Progress() {
  const { view } = Route.useSearch()
  const navigate = Route.useNavigate()
  const tab = view ?? 'training'

  return (
    <main className="page">
      <PageHeader title="Progress" />
      <div role="tablist" aria-label="Progress view" className="-mt-3 grid grid-cols-2 rounded-[12px] bg-surface p-1">
        {(
          [
            ['training', 'Training'],
            ['weight', 'Body weight'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={tab === v}
            onClick={() => navigate({ search: v === 'weight' ? { view: 'weight' } : {}, replace: true, viewTransition: false })}
            className={`press h-10 rounded-[9px] text-[14px] font-[550] transition-colors ${tab === v ? 'bg-pressed text-ink' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-7">
        {tab === 'training' ? <Training /> : <BodyWeight />}
      </div>
    </main>
  )
}

// ---------------------------------------------------------------------------

function Training() {
  const me = useMe()
  const unit = useUnit()
  const now = useNow(60_000)
  const weekStartsOn = me.profile?.weekStartsOn ?? 0
  const [offset, setOffset] = useState(0)
  const [sheet, setSheet] = useState<null | 'method' | 'records' | 'consistency' | 'muscles'>(null)
  const b = useMemo(() => weekBoundaries(now, weekStartsOn, offset), [now, weekStartsOn, offset])
  const data = useQuery(api.progress.muscles, { from: b[0], to: b[7] })
  const prs = useQuery(api.progress.prs, { limit: 50 })
  const summary = useQuery(api.progress.summary, { weekEnd: weekBoundaries(now, weekStartsOn)[7], weeks: 12 })

  if (summary && summary.totalWorkouts === 0) {
    return <Empty icon={ChartNoAxesColumn} title="No workouts yet" body="Coverage and records appear after your first session." action={<Link to="/" className="btn btn-primary">Go train</Link>} />
  }

  const groups = (data?.groups ?? []).filter((g) => g.sets > 0).sort((x, y) => y.sets - x.sets)
  const top = groups.slice(0, 6)
  const max = Math.max(1, ...groups.map((g) => g.sets))

  return (
    <div className="animate-fade">
      <section aria-labelledby="week-h">
        <div className="flex items-end justify-between">
          <div>
            <h2 id="week-h" className="text-[18px] font-[600] leading-6">
              {offset === 0 ? 'This week' : offset === -1 ? 'Last week' : 'Week'}
            </h2>
            <div className="num mt-0.5 text-[13px] text-muted">{rangeLabel(b[0], b[7])}</div>
          </div>
          <div className="-mr-3 flex">
            <button className="icon-btn" onClick={() => setOffset(offset - 1)} aria-label="Previous week">
              <ChevronLeft className="size-5" />
            </button>
            <button className="icon-btn" disabled={offset >= 0} onClick={() => setOffset(Math.min(0, offset + 1))} aria-label="Next week">
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
        <dl className="mt-4 flex gap-10">
          <div>
            <dd className="num text-[24px] font-[550] leading-7">{data?.workouts ?? '–'}</dd>
            <dt className="text-[13px] text-muted">{data?.workouts === 1 ? 'session' : 'sessions'}</dt>
          </div>
          <div>
            <dd className="num text-[24px] font-[550] leading-7">{data?.sets ?? '–'}</dd>
            <dt className="text-[13px] text-muted">working sets</dt>
          </div>
        </dl>
      </section>

      <section aria-labelledby="cov-h" className="mt-9">
        <div className="flex items-center justify-between">
          <h2 id="cov-h" className="text-[18px] font-[600] leading-6">
            Muscle coverage
          </h2>
          <button className="icon-btn -mr-3" aria-label="How sets are counted" onClick={() => setSheet('method')}>
            <Info className="size-[18px]" />
          </button>
        </div>
        {data === undefined ? (
          <BlockSkeleton h={200} />
        ) : groups.length === 0 ? (
          <p className="mt-2 text-[15px] text-muted">Nothing logged this week yet.</p>
        ) : (
          <>
            <ul className="mt-2">
              {top.map((g) => (
                <li key={g.group} className="grid min-h-10 grid-cols-[96px_1fr_40px] items-center gap-3">
                  <span className="text-[15px]">{g.group}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-raised">
                    <span className="block h-full rounded-full bg-accent/80 transition-[width] duration-500" style={{ width: `${(g.sets / max) * 100}%` }} />
                  </span>
                  <span className="num text-right text-[15px] text-muted">{fmtNum(g.sets)}</span>
                </li>
              ))}
            </ul>
            {groups.length > top.length && (
              <button onClick={() => setSheet('muscles')} className="mt-1 h-11 text-[14px] font-[600] text-accent">
                Show all {groups.length} muscles
              </button>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="rec-h" className="mt-9">
        <div className="flex items-center justify-between">
          <h2 id="rec-h" className="text-[18px] font-[600] leading-6">
            Recent records
          </h2>
          {prs && prs.length > 3 && (
            <button onClick={() => setSheet('records')} className="-mr-2 h-11 px-2 text-[13px] font-[550] text-accent">
              See all
            </button>
          )}
        </div>
        {prs === undefined ? (
          <BlockSkeleton h={150} />
        ) : prs.length === 0 ? (
          <p className="mt-2 text-[15px] text-muted">Records appear from your second session of an exercise.</p>
        ) : (
          <RecordList items={prs.slice(0, 3)} unit={unit} />
        )}
      </section>

      <button onClick={() => setSheet('consistency')} className="press mt-8 flex min-h-14 w-full items-center justify-between border-t border-line text-left">
        <span className="text-[16px] font-[500]">Consistency</span>
        <span className="flex items-center gap-2 text-[14px] text-muted">
          {summary ? `${summary.streakWeeks} week streak` : ''}
          <ChevronRight aria-hidden className="size-4" />
        </span>
      </button>

      <Sheet open={sheet === 'method'} onClose={() => setSheet(null)} title="How sets are counted">
        <div className="space-y-3 pb-2 text-[15px] leading-6 text-ink/90">
          <p>Each working set counts once for the muscles an exercise mainly trains, and half for muscles it trains secondarily. Warm-ups don’t count.</p>
          <p className="text-muted">So 3 sets of bench press add 3 to Chest and 1.5 to Triceps and Shoulders. Many lifters aim for roughly 10–20 weighted sets per muscle each week.</p>
        </div>
      </Sheet>
      <Sheet open={sheet === 'muscles'} onClose={() => setSheet(null)} title="All muscles">
        <ul className="pb-2">
          {groups.map((g) => (
            <li key={g.group} className="flex min-h-12 items-center justify-between border-b border-line text-[16px]">
              <span>{g.group}</span>
              <span className="num text-muted">{fmtNum(g.sets)}</span>
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet open={sheet === 'records'} onClose={() => setSheet(null)} title="Personal records" size="tall">
        {prs && <RecordList items={prs} unit={unit} />}
      </Sheet>
      <Sheet open={sheet === 'consistency'} onClose={() => setSheet(null)} title="Consistency">
        {summary && <Consistency summary={summary} unit={unit} />}
      </Sheet>
    </div>
  )
}

type Pr = NonNullable<ReturnType<typeof useQuery<typeof api.progress.prs>>>[number]

function RecordList({ items, unit }: { items: Pr[]; unit: 'kg' | 'lb' }) {
  return (
    <ul className="mt-1">
      {items.map((p) => (
        <li key={p.exerciseId}>
          <Link to="/library/$slug" params={{ slug: p.slug }} className="press -mx-2 flex min-h-16 items-center gap-3 rounded-2xl px-2 hover:bg-raised">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-[550]">{p.name}</span>
              <span className="text-[13px] text-muted">{fmtRelativeDay(p.at)}</span>
            </span>
            <span className="num inline-flex shrink-0 items-center gap-1.5 text-[15px] text-pr">
              <Medal aria-hidden className="size-3.5" />
              {fmtSet(p, p.tracking, unit)}
              {p.tracking === 'weight_reps' && p.weightKg ? <span className="text-[12px]">{unit}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Consistency({ summary, unit }: { summary: NonNullable<ReturnType<typeof useQuery<typeof api.progress.summary>>>; unit: 'kg' | 'lb' }) {
  const max = Math.max(1, ...summary.weeks.map((w) => w.workouts))
  const avg = summary.weeks.slice(-4).reduce((n, w) => n + w.workouts, 0) / 4
  return (
    <div className="pb-2">
      <dl className="flex gap-10">
        <div>
          <dd className="num text-[24px] font-[550] leading-7">{summary.streakWeeks}</dd>
          <dt className="text-[13px] text-muted">week streak</dt>
        </div>
        <div>
          <dd className="num text-[24px] font-[550] leading-7">{fmtNum(Math.round(avg * 10) / 10)}</dd>
          <dt className="text-[13px] text-muted">per week, last 4</dt>
        </div>
        <div>
          <dd className="num text-[24px] font-[550] leading-7">{summary.totalWorkouts}</dd>
          <dt className="text-[13px] text-muted">all time</dt>
        </div>
      </dl>
      <ul className="sr-only">
        {summary.weeks.map((w) => (
          <li key={w.start}>
            Week of {fmtDate(w.start, { month: 'short', day: 'numeric' })}: {w.workouts} workouts
          </li>
        ))}
      </ul>
      <div aria-hidden className="mt-6 flex h-28 items-end gap-1.5">
        {summary.weeks.map((w, i) => (
          <div key={w.start} className="flex h-full flex-1 flex-col justify-end">
            <div
              className={`w-full rounded-[4px] ${i === summary.weeks.length - 1 ? 'bg-accent' : 'bg-accent/35'}`}
              style={{ height: `${Math.max(w.workouts ? 8 : 3, (w.workouts / max) * 100)}%`, opacity: w.workouts ? 1 : 0.4 }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-2 flex justify-between text-[12px] text-muted">
        <span>{fmtDate(summary.weeks[0].start, { month: 'short', day: 'numeric' })}</span>
        <span>This week</span>
      </div>
      <p className="num mt-4 text-[13px] text-muted">
        {fmtVolume(summary.weeks.reduce((n, w) => n + w.volumeKg, 0), unit)} {unit} lifted in 12 weeks
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------

function BodyWeight() {
  const unit = useUnit()
  const rows = useQuery(api.progress.bodyMetrics, { kind: 'weight', limit: 200 })
  const log = useMutation(api.progress.logBodyMetric)
  const del = useMutation(api.progress.deleteBodyMetric)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const points = (rows ?? []).slice().reverse().map((r) => ({ x: r.measuredAt, y: toDisplayWeight(r.value, unit) ?? 0 }))
  const latest = rows?.[0]

  const openLog = () => {
    setText(latest ? fmtNum(toDisplayWeight(latest.value, unit)) : '')
    setDate(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10))
    setOpen(true)
  }

  return (
    <div className="animate-fade">
      {rows === undefined ? (
        <BlockSkeleton h={220} />
      ) : !latest ? (
        <div className="py-10 text-center">
          <p className="text-[20px] font-[550]">Log your first reading</p>
          <p className="mt-1 text-[14px] text-muted">A weekly weigh-in is enough to see the trend.</p>
          <button className="btn btn-primary mt-6" onClick={openLog}>
            Log weight
          </button>
        </div>
      ) : (
        <>
          <div className="text-[13px] text-muted">Latest · {fmtRelativeDay(latest.measuredAt)}</div>
          <div className="num mt-1 text-[32px] font-[550] leading-9 tracking-[-0.02em]">
            {fmtWeight(latest.value, unit)} <span className="text-[16px] text-muted">{unit}</span>
          </div>
          {points.length >= 2 && (
            <div className="mt-4">
              <LineChart points={points} unit={unit} height={160} color="#e9e9ec" hideReadout />
            </div>
          )}
          <button className="btn btn-primary mt-5 w-full" onClick={openLog}>
            Log weight
          </button>
          <ul className="mt-6">
            {rows.map((r) => (
              <li key={r._id} className="flex min-h-12 items-center justify-between border-b border-line">
                <span className="text-[15px] text-muted">{fmtDate(r.measuredAt, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className="flex items-center gap-1">
                  <span className="num text-[16px]">
                    {fmtWeight(r.value, unit)} {unit}
                  </span>
                  <button
                    className="icon-btn -mr-3 text-muted"
                    onClick={() => del({ metricId: r._id })}
                    aria-label={`Delete weigh-in ${fmtWeight(r.value, unit)} ${unit}, ${fmtRelativeDay(r.measuredAt)}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Log weight">
        <form
          className="pb-2"
          onSubmit={async (e) => {
            e.preventDefault()
            const n = Number.parseFloat(text.replace(',', '.'))
            if (!Number.isFinite(n) || n <= 0) return
            // Midday local time on the chosen date keeps it on that calendar day everywhere.
            const [y, m, d] = date.split('-').map(Number)
            const measuredAt = new Date(y, m - 1, d, 12).getTime()
            await log({ kind: 'weight', value: fromDisplayWeight(n, unit), measuredAt: Math.min(measuredAt, Date.now()) })
            setOpen(false)
          }}
        >
          <label className="flex items-baseline gap-2 rounded-[18px] bg-raised px-5 py-4">
            <span className="sr-only">Weight in {unit}</span>
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              inputMode="decimal"
              placeholder="0.0"
              className="num w-full bg-transparent text-[40px] font-[550] tracking-[-0.03em] outline-none placeholder:text-muted/50"
            />
            <span className="text-[18px] font-[500] text-muted">{unit}</span>
          </label>
          <label className="mt-3 flex min-h-14 items-center justify-between border-b border-line text-[16px]">
            Date
            <input
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="num bg-transparent text-right text-[16px] text-muted outline-none [color-scheme:dark]"
            />
          </label>
          <button type="submit" className="btn btn-primary mt-4 w-full">
            Save
          </button>
        </form>
      </Sheet>
    </div>
  )
}
