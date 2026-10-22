import { Link } from '@tanstack/react-router'
import { ChevronRight, Timer } from 'lucide-react'
import { fmtClock } from '#/lib/format'
import { useMe } from '#/lib/me'
import { useNow } from '#/lib/useNow'

/** Persistent "workout in progress" affordance shown outside the live workout. */
export function WorkoutBar({ variant }: { variant: 'dock' | 'sidebar' }) {
  const { activeWorkout } = useMe()
  const now = useNow(1000, Boolean(activeWorkout))
  if (!activeWorkout) return null
  const elapsed = (now - activeWorkout.startedAt) / 1000
  const rest = activeWorkout.restEndsAt ? (activeWorkout.restEndsAt - now) / 1000 : 0
  const resting = rest > 0

  return (
    <Link
      to="/workout"
      style={variant === 'dock' ? { viewTransitionName: 'workout-bar' } : undefined}
      className={`press flex h-16 items-center gap-3 overflow-hidden rounded-[16px] border border-line bg-surface px-4 animate-rise`}
    >
      <span className="relative flex size-2.5 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-50" />
        <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-[550] leading-5">{activeWorkout.title}</div>
        <div className="num text-[13px] leading-[18px] text-muted">
          {resting ? (
            <span className="inline-flex items-center gap-1 text-accent">
              <Timer className="size-3.5" /> Rest {fmtClock(rest)}
            </span>
          ) : (
            <>In progress · {fmtClock(elapsed)}</>
          )}
        </div>
      </div>
      <span className="flex items-center gap-0.5 text-[14px] font-[600] text-accent">
        Resume <ChevronRight className="size-4" />
      </span>
    </Link>
  )
}
