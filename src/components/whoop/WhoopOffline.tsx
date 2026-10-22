import type { WhoopWeek } from '../../../convex/whoop/model'
import { RecoveryRing } from './WhoopDetails'
import { sleepLabel, valueLabel } from './useWhoop'
export function WhoopOfflineSummary() {
  let cached: WhoopWeek | null = null
  try { cached = JSON.parse(localStorage.getItem('lift:whoop:latest') ?? 'null') as WhoopWeek | null } catch { /* No readable cache. */ }
  const day = cached?.today ?? cached?.days?.at(-1)
  if (!day || cached?.status === 'disconnected') return null
  return <section className="whoop mt-6 border-b border-line pb-5" aria-label="WHOOP saved readings">
    <h2 className="text-[16px] font-[550]">WHOOP · saved readings</h2>
    <p className="mt-1 text-[12px] text-muted">{day.date} · Offline{cached?.lastSyncedAt ? ` · Synced ${new Date(cached.lastSyncedAt).toLocaleString()}` : ''}</p>
    <div className="num mt-4 flex items-center gap-2 text-[13px]"><RecoveryRing value={day.metrics.recovery}/><span>{valueLabel(day.metrics.recovery,'%')} recovery · {sleepLabel(day.metrics.sleepMs)} sleep · {valueLabel(day.metrics.strain,' strain',1)}</span></div>
  </section>
}
