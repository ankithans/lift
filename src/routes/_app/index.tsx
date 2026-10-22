import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { Check, ChevronLeft, ChevronRight, Footprints, GripVertical, Loader2, Play, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { PageHeader } from '#/components/PageHeader'
import { Sheet } from '#/components/Sheet'
import { BlockSkeleton } from '#/components/Skeletons'
import { fmtDate, fmtDuration, fmtVolume, WEEKDAYS, WEEKDAYS_LONG } from '#/lib/format'
import { tap } from '#/lib/haptics'
import { useMe, useUnit } from '#/lib/me'
import { startOfDay, weekBoundaries } from '#/lib/time'
import { toast } from '#/lib/toast'
import { announce } from '#/lib/announce'
import { useNow } from '#/lib/useNow'

export const Route = createFileRoute('/_app/')({
  head: () => ({ meta: [{ title: 'Train · Lift' }] }), component: Train })

type Week = NonNullable<FunctionReturnType<typeof api.programs.week>>
type Day = Week['days'][number]
type Planned = NonNullable<Day['planned']>

const ROW_H = 76
// The click that ends a drag must not also open the day.
let lastDragEnd = 0

function Train() {
  const me = useMe()
  const weekStartsOn = me.profile?.weekStartsOn ?? 0
  const now = useNow(60_000)
  const today = startOfDay(now)
  const [offset, setOffset] = useState(0)
  const boundaries = useMemo(() => weekBoundaries(today, weekStartsOn, offset), [today, weekStartsOn, offset])
  // Day-granular `now` keeps the query args stable (no refetch every minute).
  const week = useQuery(api.programs.week, { boundaries, now: today })

  // Days before the account existed aren't "skipped".
  const joined = startOfDay(me.profile?._creationTime ?? 0)
  const days = useMemo(
    () => week?.days.map((d) => (d.status === 'missed' && d.start < joined ? { ...d, status: 'upcoming' as const } : d)),
    [week, joined],
  )
  const todayDay = days?.find((d) => d.isToday)

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
      {todayDay && offset === 0 && <TodayLine day={todayDay} />}

      {week === undefined || !days ? (
        <div className="mt-6 space-y-2">
          {Array.from({ length: 7 }, (_, i) => <BlockSkeleton key={i} h={ROW_H - 8} />)}
        </div>
      ) : !week.program ? (
        <NoProgram />
      ) : (
        <section aria-labelledby="week-title" className="mt-7 animate-fade">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 id="week-title" className="text-[15px] font-[650] tracking-[-0.01em]">
                {offset === 0 ? 'This week' : offset === -1 ? 'Last week' : offset === 1 ? 'Next week' : `Week of ${fmtDate(boundaries[0], { month: 'short', day: 'numeric' })}`}
              </h2>
              <Link to="/program" className="block truncate text-[13px] text-subtle hover:text-ink">
                {week.program.name}
              </Link>
            </div>
            <div className="flex items-center">
              <button className="icon-btn" aria-label="Previous week" onClick={() => setOffset(offset - 1)}>
                <ChevronLeft className="size-5" />
              </button>
              {offset !== 0 && (
                <button className="h-9 rounded-full px-2.5 text-[13px] font-[650] text-accent" onClick={() => setOffset(0)}>
                  Today
                </button>
              )}
              <button className="icon-btn" aria-label="Next week" onClick={() => setOffset(offset + 1)}>
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>
          <WeekList days={days} />
          <p className="mt-3 text-[13px] text-subtle">Drag a day by its handle, or press and hold, to swap it with another. Tap the handle to pick a day. This changes your weekly plan.</p>
        </section>
      )}
    </main>
  )
}

/** One quiet line under the greeting: what today is, and the fastest way to start. */
function TodayLine({ day }: { day: Day }) {
  const start = useStartWorkout()
  const p = day.planned
  if (day.status === 'active') {
    return (
      <Link to="/workout" className="btn btn-primary mt-1 w-full">
        <Play className="size-[18px] fill-current" /> Resume {day.workout?.title}
      </Link>
    )
  }
  if (day.status === 'done') {
    return (
      <p className="-mt-2 flex items-center gap-1.5 text-[15px] text-muted">
        <Check className="size-4 text-accent" strokeWidth={2.6} /> {day.workout?.title} done today. Nice work.
      </p>
    )
  }
  if (!p || p.kind === 'rest') {
    return <p className="-mt-2 text-[15px] text-muted">Rest day. Recovery is where you grow.</p>
  }
  return (
    <div className="-mt-1">
      <p className="text-[15px] text-muted">
        Today is <span className="font-[600] text-ink">{p.title}</span> · {p.exercises.length} exercises · ~{p.estimatedMinutes} min
      </p>
      <button disabled={start.busy} onClick={() => start.run(p._id)} className="btn btn-primary mt-4 w-full">
        {start.busy ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-[18px] fill-current" />}
        Start {p.title}
      </button>
    </div>
  )
}

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

// ---------------------------------------------------------------------------
// The week: fixed weekday rail on the left, draggable plan cards on the right.

type DragState = { from: number; to: number; dy: number; pointerId: number }

function WeekList({ days }: { days: Day[] }) {
  const arrange = useMutation(api.programs.arrangeWeek)
  // Local order of plan content per weekday slot; reset whenever the server answers.
  const [order, setOrder] = useState<Day[]>(days)
  useEffect(() => setOrder(days), [days])
  const [drag, setDrag] = useState<DragState | null>(null)
  const [restSheet, setRestSheet] = useState<Day | null>(null)
  const [moveFrom, setMoveFrom] = useState<number | null>(null)
  const startY = useRef(0)
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number; id: number } | null>(null)

  const commit = async (next: Day[]) => {
    setOrder(next)
    try {
      await arrange({ slots: days.map((d, i) => ({ weekday: d.weekday, dayId: next[i]?.planned?._id ?? null })) })
    } catch {
      setOrder(days)
      toast('Could not move that day. Try again.', { tone: 'error' })
    }
  }

  const move = (from: number, to: number) => {
    if (from === to) return
    // A week has fixed slots: dropping a day onto another weekday swaps the two.
    const next = [...order]
    const item = next[from]
    next[from] = next[to]
    next[to] = item
    void commit(next)
    tap('success')
    const name = (d: Day | undefined) => (d?.planned?.kind === 'workout' ? d.planned.title : 'Rest')
    announce(`${name(item)} moved to ${WEEKDAYS_LONG[days[to].weekday]}. ${name(next[from])} is now on ${WEEKDAYS_LONG[days[from].weekday]}.`)
  }

  const begin = (index: number, pointerId: number, clientY: number) => {
    startY.current = clientY
    setDrag({ from: index, to: index, dy: 0, pointerId })
    tap()
  }

  // While dragging, follow the pointer anywhere on the page and stop touch scrolling.
  useEffect(() => {
    if (!drag) return
    const prevent = (e: TouchEvent) => e.preventDefault()
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      const dy = e.clientY - startY.current
      const to = Math.max(0, Math.min(order.length - 1, drag.from + Math.round(dy / ROW_H)))
      if (to !== drag.to) tap()
      setDrag((d) => (d ? { ...d, dy, to } : d))
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      setDrag(null)
      lastDragEnd = Date.now()
      // A tap on the handle (no real movement) opens the "Move to…" sheet instead.
      if (Math.abs(drag.dy) < 6 && drag.from === drag.to) setMoveFrom(drag.from)
      else move(drag.from, drag.to)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrag(null)
    }
    document.addEventListener('touchmove', prevent, { passive: false })
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('touchmove', prevent)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  })

  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }

  return (
    <>
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
          // The day being hovered previews the swap by sliding into the origin slot.
          const shift = drag && i === drag.to && i !== drag.from ? (drag.from - drag.to) * ROW_H : 0
          const dragging = drag?.from === i
          return (
            <li key={slot.start} className="relative flex items-stretch" style={{ height: ROW_H }}>
              <div className={`flex w-12 shrink-0 flex-col justify-center ${slot.isToday ? 'text-accent' : 'text-subtle'}`} aria-hidden>
                <span className="text-[12px] font-[700] uppercase tracking-[0.06em]">{WEEKDAYS[slot.weekday]}</span>
                <span className={`num text-[19px] font-[680] leading-6 ${slot.isToday ? 'text-accent' : 'text-ink/80'}`}>{new Date(slot.start).getDate()}</span>
              </div>
              <div
                className="relative min-w-0 flex-1 py-1"
                style={{
                  transform: `translateY(${dragging ? drag.dy : shift}px)`,
                  transition: dragging ? 'none' : 'transform 220ms cubic-bezier(0.22,1,0.36,1)',
                  zIndex: dragging ? 20 : undefined,
                }}
              >
                <DayCard
                  slot={slot}
                  item={item}
                  index={i}
                  dragging={dragging}
                  onHandleDown={(e) => begin(i, e.pointerId, e.clientY)}
                  onPressStart={(e) => {
                    const { pointerId, clientX, clientY } = e
                    cancelPress()
                    press.current = {
                      id: pointerId,
                      x: clientX,
                      y: clientY,
                      timer: setTimeout(() => {
                        press.current = null
                        begin(i, pointerId, clientY)
                      }, 380),
                    }
                  }}
                  onKeyMove={(dir) => {
                    const to = i + dir
                    if (to < 0 || to >= order.length) return
                    move(i, to)
                    requestAnimationFrame(() => (document.querySelector(`[data-handle="${to}"]`) as HTMLElement | null)?.focus())
                  }}
                  onRest={() => setRestSheet(slot)}
                  onOpenMove={() => setMoveFrom(i)}
                />
              </div>
            </li>
          )
        })}
      </ol>
      <p id="reorder-help" className="sr-only">Press Enter to choose a new day, or use the up and down arrow keys to swap with the neighbouring day.</p>
      <RestSheet day={restSheet} onClose={() => setRestSheet(null)} />
      <Sheet
        open={moveFrom !== null}
        onClose={() => setMoveFrom(null)}
        title={moveFrom !== null ? `Move ${order[moveFrom]?.planned?.kind === 'workout' ? order[moveFrom].planned!.title : 'Rest'} to…` : ''}
      >
        {moveFrom !== null && (
          <ul className="space-y-1 pb-2">
            {days.map((d, j) => {
              const there = order[j]?.planned?.kind === 'workout' ? order[j].planned!.title : 'Rest'
              const current = j === moveFrom
              return (
                <li key={d.start}>
                  <button
                    disabled={current}
                    aria-current={current ? 'true' : undefined}
                    onClick={() => {
                      setMoveFrom(null)
                      move(moveFrom, j)
                    }}
                    className={`press flex min-h-14 w-full items-center gap-4 rounded-2xl px-3 text-left ${current ? 'bg-raised' : 'hover:bg-raised'}`}
                  >
                    <span className="w-24 shrink-0 text-[15px] font-[600]">{WEEKDAYS_LONG[d.weekday]}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-subtle">{current ? 'Current day' : there === 'Rest' ? 'Rest — move here' : `Swap with ${there}`}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Sheet>
    </>
  )
}

function DayCard({
  slot,
  item,
  index,
  dragging,
  onHandleDown,
  onPressStart,
  onKeyMove,
  onRest,
  onOpenMove,
}: {
  slot: Day
  item: Day
  index: number
  dragging: boolean
  onHandleDown: (e: React.PointerEvent) => void
  onPressStart: (e: React.PointerEvent) => void
  onKeyMove: (dir: -1 | 1) => void
  onRest: () => void
  onOpenMove: () => void
}) {
  const unit = useUnit()
  const start = useStartWorkout()
  const navigate = useNavigate()
  // Status belongs to the slot only while its content hasn't been moved locally.
  const moved = item !== slot
  const planned: Planned | null = item.planned ?? null
  const isRest = !planned || planned.kind === 'rest'
  const status = moved ? (isRest ? 'rest' : slot.isToday ? 'today' : 'upcoming') : slot.status
  const workout = moved ? null : slot.workout
  const title = workout?.title ?? (isRest ? 'Rest' : planned.title)

  const open = () => {
    if (Date.now() - lastDragEnd < 500) return
    if (workout?.status === 'completed') navigate({ to: '/history/$workoutId', params: { workoutId: workout._id } })
    else if (status === 'active') navigate({ to: '/workout' })
    else if (!isRest) navigate({ to: '/day/$dayId', params: { dayId: planned._id } })
    else onRest()
  }

  const meta = workout?.stats
    ? `${fmtDuration(workout.stats.durationSec)} · ${workout.stats.sets} sets · ${fmtVolume(workout.stats.volumeKg, unit)} ${unit}`
    : status === 'active'
      ? 'In progress'
      : !isRest
        ? `${planned.exercises.length} exercises · ~${planned.estimatedMinutes} min`
        : null

  const highlight = status === 'today' || status === 'active'

  return (
    <div
      className={`flex h-full items-center gap-1 rounded-[18px] pl-4 transition-[background-color,box-shadow,transform] duration-200 ${
        dragging
          ? 'scale-[1.02] bg-raised shadow-[0_18px_40px_-12px_#000] ring-1 ring-line-strong'
          : highlight
            ? 'bg-surface ring-1 ring-accent/25'
            : 'hover:bg-surface/70'
      }`}
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
          <span className="sr-only">{WEEKDAYS_LONG[slot.weekday]}{status === 'today' ? ', today' : ''}: </span>
          <span
            className={`flex items-center gap-1.5 text-[16px] font-[600] tracking-[-0.01em] ${
              isRest && !workout ? 'text-subtle' : status === 'missed' ? 'text-muted' : ''
            }`}
          >
            {isRest && !workout && <Footprints className="size-4 shrink-0" strokeWidth={1.75} />}
            <span className="truncate">{title}</span>
          </span>
          {meta && <span className="num block truncate text-[13px] text-subtle">{meta}</span>}
          {!moved && slot.extras.length > 0 && (
            <span className="block truncate text-[13px] text-subtle">+ {slot.extras.map((w) => w.title).join(', ')}</span>
          )}
        </span>
        <span className="shrink-0 text-[13px] font-[600]">
          {status === 'done' && (
            <span className="flex items-center gap-1 text-accent">
              <Check className="size-4" strokeWidth={2.6} /> Done
            </span>
          )}
          {status === 'missed' && <span className="text-muted">Skipped</span>}
          {status === 'active' && <span className="text-accent">Resume</span>}
        </span>
      </button>
      {status === 'today' && !isRest && (
        <button
          disabled={start.busy}
          onClick={() => start.run(planned._id)}
          className="press flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-accent pl-3 pr-3.5 text-[14px] font-[650] text-accent-ink"
          aria-label={`Start ${title}`}
        >
          {start.busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-3.5 fill-current" />}
          Start
        </button>
      )}
      <button
        data-handle={index}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse') e.preventDefault()
          onHandleDown(e)
        }}
        onClick={(e) => {
          // Keyboard activation (Enter/Space) has detail 0; pointer taps are handled by the drag logic.
          if (e.detail === 0) onOpenMove()
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            onKeyMove(e.key === 'ArrowUp' ? -1 : 1)
          }
        }}
        aria-label={`Move ${title}, ${WEEKDAYS_LONG[slot.weekday]}, ${index + 1} of 7`}
        aria-describedby="reorder-help"
        className="grid h-full w-11 shrink-0 cursor-grab touch-none place-items-center rounded-r-[18px] text-subtle hover:text-muted active:cursor-grabbing"
      >
        <GripVertical className="size-[18px]" />
      </button>
    </div>
  )
}

function RestSheet({ day, onClose }: { day: Day | null; onClose: () => void }) {
  const start = useStartWorkout()
  return (
    <Sheet open={day !== null} onClose={onClose} title={day ? `${WEEKDAYS_LONG[day.weekday]} · Rest` : ''}>
      <p className="text-[15px] leading-[22px] text-muted">Nothing planned. Want to train anyway?</p>
      <button disabled={start.busy} onClick={() => start.run()} className="btn btn-secondary mb-2 mt-5 w-full">
        {start.busy ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />} Start an empty workout
      </button>
    </Sheet>
  )
}

function NoProgram() {
  return (
    <section className="card mt-6 p-6 text-center animate-rise">
      <h2 className="t-title">No program yet</h2>
      <p className="mt-2 text-[15px] text-muted">Pick a plan and your week fills itself in.</p>
      <Link to="/welcome" className="btn btn-primary mt-5">Choose a program</Link>
    </section>
  )
}
