import { WhoopOfflineSummary } from '#/components/whoop/WhoopOffline'
import { CloudOff } from 'lucide-react'
import { fmtWeight, type Unit } from '#/lib/format'
import type { ActiveWorkout } from '#/lib/workout'

/** Shown when the workout page opens with no connection: the last saved state, read-only. */
export function OfflineWorkout() {
  // No profile offline: remember the unit from the last session.
  const unit = ((typeof localStorage !== 'undefined' && localStorage.getItem('lift:unit')) || 'kg') as Unit
  const snap = (() => {
    try {
      return JSON.parse(localStorage.getItem('lift:last-workout') ?? 'null') as ActiveWorkout | null
    } catch {
      return null
    }
  })()
  return (
    <main className="page pt-10">
      <div role="status" className="flex items-start gap-3 rounded-[18px] bg-warning/10 p-4 text-warning">
        <CloudOff aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div>
          <div className="text-[15px] font-[650]">You’re offline</div>
          <p className="mt-0.5 text-[14px] leading-5 text-warning/90">
            Showing your last saved workout. Sets you logged are kept and sync as soon as you have signal.
          </p>
        </div>
      </div>
      <WhoopOfflineSummary />
      {snap ? (
        <section className="mt-6">
          <h1 className="t-screen">{snap.title}</h1>
          <ul className="mt-4 space-y-3">
            {snap.exercises.map((we) => (
              <li key={we._id} className="card px-4 py-3">
                <div className="text-[16px] font-[600]">{we.exercise.name}</div>
                <div className="num mt-1 text-[14px] text-muted">
                  {we.sets
                    .map((s) => (s.done ? `${s.weightKg ? fmtWeight(s.weightKg, unit) + '×' : ''}${s.reps ?? (s.durationSec ? s.durationSec + 's' : '—')} ✓` : '·'))
                    .join('   ')}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="mt-6 text-muted">No saved workout on this device yet.</p>
      )}
      <button onClick={() => location.reload()} className="btn btn-secondary mt-6 w-full">Try again</button>
    </main>
  )
}
