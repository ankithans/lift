import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { Check, ChevronLeft, ChevronRight, GripVertical, Loader2, Lock, Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { PageHeader } from '#/components/PageHeader'
import { Sheet } from '#/components/Sheet'
import { BlockSkeleton } from '#/components/Skeletons'
import { announce } from '#/lib/announce'
import { fmtDate, fmtDuration, WEEKDAYS, WEEKDAYS_LONG } from '#/lib/format'
import { tap } from '#/lib/haptics'
import { useMe } from '#/lib/me'
import { startOfDay, weekBoundaries } from '#/lib/time'
import { toast } from '#/lib/toast'
import { useNow } from '#/lib/useNow'
import { useWhoop, dayKey, type WhoopView } from '#/components/whoop/useWhoop'
import { WhoopToday, WhoopWeekSummary, WhoopMetricLine, WhoopDayButton } from '#/components/whoop/WhoopCalendar'
import { WhoopConnectRow } from '#/components/whoop/WhoopConnection'
import type { WhoopDay } from '../../../convex/whoop/model'

export const Route = createFileRoute('/_app/')({
  head: () => ({ meta: [{ title: 'Train · Lift' }] }),
  component: Train,
})

type Week = NonNullable<FunctionReturnType<typeof api.programs.week>>
type ServerDay = Week['days'][number]
/** 'before': a day that predates the account (shown plainly, never "missed"). */
type Day = Omit<ServerDay, 'status'> & { status: ServerDay['status'] | 'before' }

const ROW_H = 60
const WHOOP_ROW_H = 76
// The click that ends a drag must not also open the day.
let lastDragEnd = 0

const dayName = (d: Day | undefined) => (d?.planned?.kind === 'workout' ? d.planned.title : 'Rest')

function rangeLabel(start: number, end: number) {
  const a = new Date(start)
  const b = new Date(end - 1)
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${fmtDate(start, { month: 'short' })}`
    : `${fmtDate(start, { day: 'numeric', month: 'short' })} – ${fmtDate(b.getTime(), { day: 'numeric', month: 'short' })}`
}

function Train() {
  const me = useMe()
  const weekStartsOn = me.profile?.weekStartsOn ?? 0
  const now = useNow(60_000)
  const today = startOfDay(now)
  const [offset, setOffset] = useState(0)
  const boundaries = useMemo(() => weekBoundaries(today, weekStartsOn, offset), [today, weekStartsOn, offset])
  const week = useQuery(api.programs.week, { boundaries, now: today })
  const whoop = useWhoop(boundaries[0], boundaries[7])
  const thisWeekBounds = useMemo(() => weekBoundaries(today, weekStartsOn, 0), [today, weekStartsOn])
  const thisWeek = useQuery(api.programs.week, offset === 0 ? 'skip' : { boundaries: thisWeekBounds, now: today })

  // Days before the account existed aren't "missed".
  const joined = startOfDay(me.profile?._creationTime ?? 0)
  // Days before the account existed are plain, neither "missed" nor "upcoming".
  const fix = (w: Week | undefined): Day[] | undefined =>
    w?.days.map((d): Day => (d.start + 86400000 <= joined && d.status !== 'done' ? { ...d, status: 'before' } : d))
  const days = useMemo(() => fix(week), [week, joined])
  const currentDays = useMemo(() => (offset === 0 ? days : fix(thisWeek)), [offset, days, thisWeek, joined])
  const todayDay = currentDays?.find((d) => d.isToday)

  const planned = days?.filter((d) => d.planned?.kind === 'workout' && d.status !== 'before').length ?? 0
  const doneCount = days?.filter((d) => d.status === 'done').length ?? 0

  return (
    <main className="page">
      <PageHeader eyebrow={fmtDate(now, { weekday: 'short', day: 'numeric', month: 'short' })} title="Train" />

      {week === undefined || !days ? (
        <div className="space-y-3">
          <BlockSkeleton h={150} />
          <BlockSkeleton h={420} />
        </div>
      ) : !week.program ? (
        <><NoProgram /><WhoopConnectRow /></>
      ) : (
        <>
          {todayDay && <TodayHero day={todayDay} days={currentDays!} whoop={whoop} />}
          {whoop.data?.status === 'disconnected' && <WhoopConnectRow />}
          <WeekSection
            whoop={whoop}
            key={offset}
            days={days}
            title={offset === 0 ? 'This week' : offset === -1 ? 'Last week' : offset === 1 ? 'Next week' : 'Week'}
            range={rangeLabel(boundaries[0], boundaries[7])}
            summary={planned ? `${doneCount} of ${planned} sessions` : ''}
            offset={offset}
            setOffset={setOffset}
          />
          {offset === 0 && <LastSession />}
        </>
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------
// Today: one decision, one action.

function useStartWorkout() {
  const startMut = useMutation(api.workouts.start)
  const navigate = useNavigate()
  const me = useMe()
  const [busy, setBusy] = useState(false)
  return {
    busy,
    run: async (programDayId?: Id<'programDays'>) => {
      setBusy(true)
      tap('success')
      // Workouts left open for 6h+ are closed out by the server; say so.
      const stale = me.activeWorkout && Date.now() - me.activeWorkout.startedAt > 6 * 3600_000 ? me.activeWorkout : null
      try {
        await startMut(programDayId ? { programDayId } : {})
        if (stale) toast(`Saved your unfinished ${stale.title} from ${fmtDate(stale.startedAt, { weekday: 'long' })}.`, { ms: 5000 })
        navigate({ to: '/workout' })
      } catch {
        toast('Could not start the workout. Check your connection.', { tone: 'error' })
      } finally {
        setBusy(false)
      }
    },
  }
}

function TodayHero({ day, days, whoop }: { day: Day; days: Day[]; whoop: WhoopView }) {
  const me = useMe()
  const start = useStartWorkout()
  const now = useNow(60_000)
  const p = day.planned
  const active = me.activeWorkout

  let label = 'Today'
  let title: string
  let support: string
  let action: ReactNode
  let titleLink: Id<'programDays'> | null = null

  if (active) {
    label = 'In progress'
    title = active.title
    support = `Started ${Math.max(1, Math.round((now - active.startedAt) / 60000))} min ago`
    action = (
      <Link to="/workout" className="btn btn-primary w-full">
        <Play aria-hidden className="size-[18px] fill-current" /> Resume {active.title}
      </Link>
    )
  } else if (day.status === 'done' && day.workout) {
    title = day.workout.title
    support = day.workout.stats ? `Done · ${fmtDuration(day.workout.stats.durationSec)} · ${day.workout.stats.sets} sets` : 'Done'
    action = (
      <Link to="/history/$workoutId" params={{ workoutId: day.workout._id }} className="btn btn-secondary w-full">
        <Check aria-hidden className="size-5 text-accent" strokeWidth={2.6} /> View session
      </Link>
    )
  } else if (!p || p.kind === 'rest') {
    const next = days.slice(days.indexOf(day) + 1).find((d) => d.planned?.kind === 'workout')
    title = 'Rest day'
    support = next ? `Next: ${next.planned!.title} · ${WEEKDAYS_LONG[next.weekday]}` : 'Recovery is where you grow.'
    action = (
      <div className="flex gap-2">
        {next && (
          <Link to="/day/$dayId" params={{ dayId: next.planned!._id }} className="btn btn-secondary flex-1">
            Preview {next.planned!.title}
          </Link>
        )}
        <button disabled={start.busy} onClick={() => start.run()} className="btn btn-ghost flex-1 border border-line-strong text-ink">
          Train anyway
        </button>
      </div>
    )
  } else {
    title = p.title
    titleLink = p._id
    support = `${p.exercises.length} exercises · about ${p.estimatedMinutes} min`
    action = (
      <button disabled={start.busy} onClick={() => start.run(p._id)} className="btn btn-primary w-full">
        {start.busy ? <Loader2 className="size-5 animate-spin" /> : <Play aria-hidden className="size-[18px] fill-current" />}
        Start {p.title}
      </button>
    )
  }

  const titleClass = 'mt-1 block text-[28px] font-[600] leading-[34px] tracking-[-0.025em]'
  return (
    <section aria-labelledby="today-title" className="animate-fade">
      <div className={`text-[13px] leading-[18px] ${active ? 'text-accent' : 'text-muted'}`}>{label}</div>
      {titleLink ? (
        <Link to="/day/$dayId" params={{ dayId: titleLink }} id="today-title" className={`${titleClass} hover:text-ink/80`}>
          {title}
        </Link>
      ) : (
        <h2 id="today-title" className={titleClass}>
          {title}
        </h2>
      )}
      <p className="mt-1 text-[14px] leading-5 text-muted">{support}</p>
      <WhoopToday view={whoop} />
      <div className="mt-4">{action}</div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// The week: dates fixed on the left; in Arrange mode, workouts swap between days.

type DragState = { from: number; to: number; dy: number; pointerId: number }

function WeekSection({
  whoop,
  days,
  title,
  range,
  summary,
  offset,
  setOffset,
}: {
  whoop: WhoopView
  days: Day[]
  title: string
  range: string
  summary: string
  offset: number
  setOffset: (n: number) => void
}) {
  const arrange = useMutation(api.programs.arrangeWeek)
  const [order, setOrder] = useState<Day[]>(days)
  useEffect(() => setOrder(days), [days])
  const [editing, setEditing] = useState(false)
  const sensorConnected = Boolean(whoop.data && whoop.data.status !== 'disconnected')
  const rowHeight = sensorConnected ? WHOOP_ROW_H : ROW_H
  const [drag, setDrag] = useState<DragState | null>(null)
  const [moveFrom, setMoveFrom] = useState<number | null>(null)
  const [settle, setSettle] = useState<{ key: number; offsets: Record<number, number> } | null>(null)
  const [changed, setChanged] = useState<{ key: number; rows: number[] } | null>(null)
  const startY = useRef(0)
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number; id: number } | null>(null)
  const today = startOfDay(Date.now())

  useEffect(() => {
    if (!changed) return
    const t = setTimeout(() => setChanged(null), 1000)
    return () => clearTimeout(t)
  }, [changed])

  /** Done, in-progress and past days can't move: they already happened. */
  const movable = (i: number) => {
    const d = days[i]
    return Boolean(d) && d.status !== 'done' && d.status !== 'active' && d.start + 86400000 > today
  }

  const commit = async (next: Day[], previous: Day[]) => {
    setOrder(next)
    try {
      await arrange({ slots: days.map((d, i) => ({ weekday: d.weekday, dayId: next[i]?.planned?._id ?? null })) })
    } catch {
      setOrder(previous)
      toast('Couldn’t save. Week restored.', { tone: 'error' })
    }
  }

  const swap = (from: number, to: number, releaseY?: number) => {
    if (from === to || !movable(from) || !movable(to)) return
    const before = order
    const next = [...order]
    ;[next[from], next[to]] = [next[to], next[from]]
    void commit(next, before)
    tap('success')
    const a = dayName(order[from])
    const b = dayName(order[to])
    // Both contents travel along their direct path; the dragged one from where it was let go.
    setSettle({
      key: Date.now(),
      offsets: { [to]: releaseY !== undefined ? releaseY - (to - from) * rowHeight : (from - to) * rowHeight, [from]: (to - from) * rowHeight },
    })
    setChanged({ key: Date.now(), rows: [from, to] })
    const outcome =
      b === 'Rest' ? `${a} moved to ${WEEKDAYS_LONG[days[to].weekday]}` : a === 'Rest' ? `${b} moved to ${WEEKDAYS_LONG[days[from].weekday]}` : `${a} ↔ ${b} swapped`
    announce(`${a} moved to ${WEEKDAYS_LONG[days[to].weekday]}. ${b} moved to ${WEEKDAYS_LONG[days[from].weekday]}. Undo available.`)
    toast(outcome, {
      action: {
        label: 'Undo',
        run: () => {
          void commit(before, next)
          setSettle({ key: Date.now(), offsets: { [from]: (to - from) * rowHeight, [to]: (from - to) * rowHeight } })
          setChanged({ key: Date.now(), rows: [from, to] })
          announce('Move undone.')
        },
      },
    })
  }

  const begin = (index: number, pointerId: number, clientY: number) => {
    if (!movable(index)) return
    setEditing(true)
    startY.current = clientY
    setDrag({ from: index, to: index, dy: 0, pointerId })
    tap()
  }

  // While dragging, follow the pointer anywhere and stop touch scrolling.
  useEffect(() => {
    if (!drag) return
    const prevent = (e: TouchEvent) => e.preventDefault()
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      const dy = e.clientY - startY.current
      // Target = slot under the card's centre, with hysteresis so it doesn't flicker on a boundary.
      const raw = drag.from + dy / rowHeight
      let to = drag.to
      if (Math.abs(raw - drag.to) > 0.6) to = Math.max(0, Math.min(days.length - 1, Math.round(raw)))
      if (to !== drag.to && movable(to)) tap()
      setDrag((d) => (d ? { ...d, dy, to } : d))
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      setDrag(null)
      lastDragEnd = Date.now()
      if (Math.abs(drag.dy) < 6 && drag.from === drag.to) setMoveFrom(drag.from)
      else if (drag.to !== drag.from && movable(drag.to)) swap(drag.from, drag.to, drag.dy)
      else setSettle({ key: Date.now(), offsets: { [drag.from]: drag.dy } }) // cancelled: glide home
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrag(null)
    document.addEventListener('touchmove', prevent, { passive: false })
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('touchmove', prevent)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKey)
    }
  })

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }

  const target = drag && drag.to !== drag.from && movable(drag.to) ? drag.to : null

  return (
    <section aria-labelledby="week-title" className="mt-10">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="week-title" className="text-[18px] font-[600] leading-6 tracking-[-0.01em]">
            {title}
          </h2>
          <div className="num mt-0.5 text-[13px] text-muted">
            {range}
            {summary && !editing ? ` · ${summary}` : ''}
          </div>
        </div>
        {editing ? (
          <button onClick={() => setEditing(false)} className="h-11 rounded-full px-4 text-[15px] font-[600] text-accent">
            Done
          </button>
        ) : (
          <div className="-mr-3 flex items-center">
            <button className="icon-btn" aria-label="Previous week" onClick={() => setOffset(offset - 1)}>
              <ChevronLeft className="size-5" />
            </button>
            <button className="icon-btn" aria-label="Next week" onClick={() => setOffset(offset + 1)}>
              <ChevronRight className="size-5" />
            </button>
          </div>
        )}
      </div>
      {sensorConnected && <WhoopWeekSummary view={whoop} dates={days.map(d => d.start)} />}
      {editing && <p className="mb-2 text-[13px] text-muted animate-fade">Drag a workout onto another day to swap them.</p>}

      <ol
        className="relative select-none"
        onPointerMove={(e) => {
          if (press.current && press.current.id === e.pointerId && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8) cancelPress()
        }}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
      >
        {days.map((slot, i) => {
          const item = order[i]
          const isSource = drag?.from === i
          const isTarget = target === i
          const settling = settle && settle.offsets[i] !== undefined ? settle : null
          const locked = editing && !movable(i)
          return (
            <li key={slot.start} className="relative flex items-stretch" style={{ height: rowHeight }}>
              <div aria-hidden className={`flex w-14 shrink-0 items-center gap-1 text-[13px] ${slot.isToday ? 'text-accent' : 'text-muted'}`}>
                <span className="font-[600]">{WEEKDAYS[slot.weekday]}</span>
                <span className="num">{new Date(slot.start).getDate()}</span>
              </div>

              {/* Source ghost: the slot the workout is leaving. */}
              {isSource && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1.5 left-14 right-0 flex items-center rounded-[14px] border border-dashed border-[#464646] pl-3 text-[16px] font-[550] text-ink/35"
                >
                  {dayName(item)}
                </div>
              )}

              <div
                key={settling ? `${slot.start}-${settling.key}` : slot.start}
                className={`relative min-w-0 flex-1 py-1.5 ${settling ? 'animate-[settle_220ms_cubic-bezier(0.22,1,0.36,1)_both]' : ''}`}
                style={{
                  transform: isSource ? `translateY(${drag!.dy}px) scale(1.025)` : undefined,
                  transition: isSource ? 'none' : undefined,
                  zIndex: isSource ? 20 : settling ? 10 : undefined,
                  ['--settle-y' as string]: settling ? `${settling.offsets[i]}px` : undefined,
                }}
                onAnimationEnd={(e) => e.target === e.currentTarget && settling && setSettle(null)}
              >
                <DayRow
                  slot={slot}
                  whoop={whoop}
                  sensor={whoop.data?.days.find(d => d.date === dayKey(slot.start, whoop.timezone))}
                  showSensor={sensorConnected && !editing && slot.start <= today}
                  item={item}
                  index={i}
                  editing={editing}
                  locked={locked}
                  dragging={isSource}
                  target={isTarget ? dayName(order[i]) : null}
                  floating={isSource && target !== null ? `${dayName(item)} → ${WEEKDAYS[days[target].weekday]} ${new Date(days[target].start).getDate()}` : null}
                  floatingSub={isSource && target !== null ? (dayName(order[target]) === 'Rest' ? 'Move here (rest day)' : `Swap with ${dayName(order[target])}`) : null}
                  changed={Boolean(changed?.rows.includes(i))}
                  changedKey={changed?.key ?? 0}
                  onHandleDown={(e) => begin(i, e.pointerId, e.clientY)}
                  onPressStart={(e) => {
                    const { pointerId, clientX, clientY } = e
                    cancelPress()
                    if (!movable(i)) return
                    press.current = {
                      id: pointerId,
                      x: clientX,
                      y: clientY,
                      timer: setTimeout(() => {
                        press.current = null
                        begin(i, pointerId, clientY)
                      }, 300),
                    }
                  }}
                  onKeyMove={(dir) => {
                    let to = i + dir
                    while (to >= 0 && to < days.length && !movable(to)) to += dir
                    if (to < 0 || to >= days.length) return
                    swap(i, to)
                    requestAnimationFrame(() => (document.querySelector(`[data-handle="${to}"]`) as HTMLElement | null)?.focus())
                  }}
                  onOpenMove={() => setMoveFrom(i)}
                />
              </div>
            </li>
          )
        })}
      </ol>

      {!editing && (
        <button onClick={() => setEditing(true)} className="mt-2 h-12 w-full rounded-2xl text-[14px] font-[600] text-muted hover:bg-surface hover:text-ink">
          Arrange week
        </button>
      )}

      <p id="reorder-help" className="sr-only">Press Enter to choose a new day, or use the up and down arrow keys to swap with the neighbouring day.</p>
      <Sheet open={moveFrom !== null} onClose={() => setMoveFrom(null)} title={moveFrom !== null ? `Move ${dayName(order[moveFrom])} to…` : ''}>
        {moveFrom !== null && (
          <ul className="pb-2">
            {days.map((d, j) => {
              const current = j === moveFrom
              const disabled = current || !movable(j)
              const there = dayName(order[j])
              return (
                <li key={d.start}>
                  <button
                    disabled={disabled}
                    aria-current={current ? 'true' : undefined}
                    onClick={() => {
                      setMoveFrom(null)
                      swap(moveFrom, j)
                    }}
                    className={`press -mx-2 flex min-h-14 w-[calc(100%+16px)] items-center gap-4 rounded-2xl px-2 text-left ${disabled ? 'opacity-50' : 'hover:bg-raised'}`}
                  >
                    <span className="w-24 shrink-0 text-[16px] font-[500]">{WEEKDAYS_LONG[d.weekday]}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-muted">
                      {current ? 'Current day' : !movable(j) ? 'Already happened' : there === 'Rest' ? 'Move here (rest day)' : `Swap with ${there}`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Sheet>
    </section>
  )
}

function DayRow({
  whoop,
  sensor,
  showSensor,
  slot,
  item,
  index,
  editing,
  locked,
  dragging,
  target,
  floating,
  floatingSub,
  changed,
  changedKey,
  onHandleDown,
  onPressStart,
  onKeyMove,
  onOpenMove,
}: {
  whoop: WhoopView
  sensor?: WhoopDay
  showSensor: boolean
  slot: Day
  item: Day
  index: number
  editing: boolean
  locked: boolean
  dragging: boolean
  target: string | null
  floating: string | null
  floatingSub: string | null
  changed: boolean
  changedKey: number
  onHandleDown: (e: React.PointerEvent) => void
  onPressStart: (e: React.PointerEvent) => void
  onKeyMove: (dir: -1 | 1) => void
  onOpenMove: () => void
}) {
  const navigate = useNavigate()
  const moved = item !== slot
  const planned = item.planned ?? null
  const isRest = !planned || planned.kind === 'rest'
  const status = moved ? (isRest ? 'rest' : slot.isToday ? 'today' : 'upcoming') : slot.status
  const workout = moved ? null : slot.workout
  const title = workout?.title ?? (isRest ? 'Rest' : planned.title)

  const open = () => {
    if (Date.now() - lastDragEnd < 500 || editing) return
    if (workout?.status === 'completed') navigate({ to: '/history/$workoutId', params: { workoutId: workout._id } })
    else if (status === 'active') navigate({ to: '/workout' })
    else if (!isRest) navigate({ to: '/day/$dayId', params: { dayId: planned._id } })
  }

  return (
    <div
      key={changed ? changedKey : 'idle'}
      className={`flex h-full items-center rounded-[14px] pl-3 transition-[background-color,box-shadow,opacity] duration-150 ${
        changed ? 'animate-[swap-flash_1000ms_ease-out_both]' : ''
      } ${
        dragging
          ? 'bg-raised shadow-[0_8px_24px_#0008,0_0_0_1px_rgba(255,255,255,0.16)]'
          : target !== null
            ? 'bg-accent/[0.06] shadow-[inset_0_0_0_1px_rgba(184,244,208,0.65)]'
            : ''
      } ${locked ? 'opacity-45' : ''}`}
    >
      <button
        onClick={open}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return
          onPressStart(e)
        }}
        onContextMenu={(e) => e.preventDefault()}
        className="flex h-full min-w-0 flex-1 items-center gap-3 text-left [-webkit-touch-callout:none]"
      >
        <span className="min-w-0 flex-1">
          <span className="sr-only">
            {WEEKDAYS_LONG[slot.weekday]}
            {slot.isToday ? ', today' : ''}:{' '}
          </span>
          <span
            className={`block truncate text-[16px] leading-[22px] ${isRest && !workout ? 'font-[450] text-muted' : 'font-[550]'} ${
              status === 'missed' || status === 'before' ? 'text-muted' : ''
            }`}
          >
            {floating ?? title}
          </span>
          {showSensor && <WhoopMetricLine day={sensor} today={slot.isToday} />}
          {(floatingSub ?? (target !== null ? (target === 'Rest' ? 'Move here (rest day)' : `Swap with ${target}`) : null)) && (
            <span className="block text-[13px] text-accent">{floatingSub ?? (target === 'Rest' ? 'Move here (rest day)' : `Swap with ${target}`)}</span>
          )}
        </span>
        {!editing && (
          <span className="shrink-0 pr-2 text-[13px]">
            {status === 'done' && (
              <>
                <Check aria-hidden className="size-[18px] text-accent" strokeWidth={2.6} />
                <span className="sr-only">, done</span>
              </>
            )}
            {status === 'today' && <span className="font-[500] text-accent">Today</span>}
            {status === 'active' && <span className="font-[500] text-accent">Now</span>}
            {status === 'missed' && <span className="text-muted">Missed</span>}
            {status === 'upcoming' && !isRest && <ChevronRight aria-hidden className="size-4 text-muted" />}
            {/* 'before': day predates the account, nothing to show */}
          </span>
        )}
      </button>
      {showSensor && <WhoopDayButton view={whoop} day={sensor} dateAt={slot.start} />}
      {editing &&
        (locked ? (
          <span className="grid size-11 shrink-0 place-items-center text-muted" aria-label="Already happened, can’t move">
            <Lock aria-hidden className="size-4" />
          </span>
        ) : (
          <button
            data-handle={index}
            onPointerDown={(e) => {
              if (e.pointerType !== 'mouse') e.preventDefault()
              onHandleDown(e)
            }}
            onClick={(e) => {
              if (e.detail === 0) onOpenMove()
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault()
                onKeyMove(e.key === 'ArrowUp' ? -1 : 1)
              }
            }}
            aria-label={`Move ${title}, ${WEEKDAYS_LONG[slot.weekday]}`}
            aria-describedby="reorder-help"
            className="grid h-full w-12 shrink-0 cursor-grab touch-none place-items-center rounded-r-[14px] text-muted animate-fade hover:text-ink active:cursor-grabbing"
          >
            <GripVertical className="size-[18px]" />
          </button>
        ))}
    </div>
  )
}

/** One quiet row: the most recent saved session. */
function LastSession() {
  const { results } = usePaginatedQuery(api.workouts.list, {}, { initialNumItems: 1 })
  const w = results[0]
  if (!w) return null
  return (
    <section className="mt-8">
      <h2 className="text-[18px] font-[600] leading-6 tracking-[-0.01em]">Last session</h2>
      <Link to="/history/$workoutId" params={{ workoutId: w._id }} className="press -mx-2 mt-1 flex min-h-16 items-center gap-3 rounded-2xl px-2 hover:bg-surface">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-[550]">{w.title}</span>
          <span className="num block text-[13px] text-muted">
            {fmtDate(w.startedAt, { weekday: 'short', day: 'numeric', month: 'short' })}
            {w.stats ? ` · ${fmtDuration(w.stats.durationSec)}` : ''}
          </span>
        </span>
        <ChevronRight aria-hidden className="size-4 text-muted" />
      </Link>
    </section>
  )
}

function NoProgram() {
  return (
    <section className="py-10 text-center animate-fade">
      <h2 className="text-[20px] font-[550]">Set up your week</h2>
      <p className="mt-2 text-[14px] text-muted">Pick a plan and your days fill themselves in.</p>
      <Link to="/welcome" className="btn btn-primary mt-6">
        Choose a plan
      </Link>
    </section>
  )
}
