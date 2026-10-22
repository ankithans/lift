import { Activity, Bike, ChevronRight, Dumbbell, Footprints, RefreshCw } from 'lucide-react'
import { useMutation } from 'convex/react'
import { useState } from 'react'
import type { WhoopDay } from '../../../convex/whoop/model'
import { api } from '../../../convex/_generated/api'
import { Sheet } from '#/components/Sheet'
import { LineChart } from '#/components/LineChart'
import { toast } from '#/lib/toast'
import { dayKey, sleepLabel, valueLabel, bandColor, STRAIN_COLOR, type WhoopView } from './useWhoop'
import { WhoopConnectButton } from './WhoopConnection'

export function SportIcon({ sport, className = 'size-4' }: { sport?: string; className?: string }) {
  const Icon = /cycl|bik/i.test(sport ?? '') ? Bike : /run|walk|hik/i.test(sport ?? '') ? Footprints : /strength|weightlift/i.test(sport ?? '') ? Dumbbell : Activity
  return <Icon aria-hidden className={className} />
}
export function RecoveryRing({ value, size = 18 }: { value?: number; size?: number }) {
  return <svg aria-hidden viewBox="0 0 20 20" width={size} height={size} className="shrink-0 -rotate-90">
    <circle cx="10" cy="10" r="7.5" fill="none" stroke="var(--color-line-strong)" strokeWidth="2.5" />
    {value !== undefined && <circle cx="10" cy="10" r="7.5" fill="none" stroke={bandColor(value)} strokeWidth="2.5" strokeDasharray={`${Math.max(0, Math.min(100, value)) / 100 * 47.12} 47.12`} strokeLinecap="round" />}
  </svg>
}
export function ActivityDetails({ activity }: { activity: WhoopDay['activities'][number] }) {
  const m = activity.metrics
  const duration = Math.round(((activity.endAt ?? activity.startAt) - activity.startAt) / 60000)
  return <details className="border-b border-line py-2">
    <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 text-left">
      <SportIcon sport={activity.sport} />
      <span className="min-w-0 flex-1"><span className="block truncate text-[15px] capitalize">{activity.sport?.replace(/_/g, ' ') ?? 'Activity'}</span><span className="num text-[12px] text-muted">{duration} min · {valueLabel(m.strain, ' strain', 1)}{activity.liftWorkoutId ? ' · Matched Lift session' : ''}</span></span>
      <span className="text-[10px] tracking-wider text-muted">WHOOP</span><ChevronRight aria-hidden className="size-4 text-muted" />
    </summary>
    <dl className="grid grid-cols-3 gap-3 pb-3 pt-2 text-[13px]">
      {[[valueLabel(m.avgHr, ' bpm'), 'Avg heart rate'], [valueLabel(m.maxHr, ' bpm'), 'Max heart rate'], [valueLabel(m.kilojoule, ' kJ'), 'Energy']].map(([v,k]) => <div key={k}><dt className="text-[11px] text-muted">{k}</dt><dd className="num mt-1">{v}</dd></div>)}
    </dl>
    {m.zones && <div className="space-y-2 pb-4" aria-label="Time in heart rate zones">
      {m.zones.map((ms,i) => <div key={i} className="flex items-center gap-3 text-[12px]"><span className="w-12 text-muted">Zone {i}</span><span className="h-1 flex-1 overflow-hidden rounded-full bg-raised"><span className="block h-full rounded-full" style={{ width: `${ms / Math.max(1, m.zones!.reduce((a,b) => a+b,0)) * 100}%`, background: STRAIN_COLOR }} /></span><span className="num w-12 text-right text-muted">{Math.round(ms/60000)} min</span></div>)}
    </div>}
  </details>
}
const METRICS = {
  recovery: { title: 'Recovery', unit: '%', definition: 'WHOOP’s estimate of how your body has returned toward its baseline. Green 67–100%, yellow 34–66%, red 0–33%. Look at your own trend and how you feel.' },
  strain: { title: 'Day strain', unit: '', definition: 'Cardiovascular load on WHOOP’s 0–21 scale. Today’s value is still accumulating. Strength volume and muscle fatigue are not measured by this number alone.' },
  sleepMs: { title: 'Sleep duration', unit: 'h', definition: 'Time asleep, summed from light, deep and REM stages. Main sleep belongs to the cycle it prepares you for; naps are excluded from this daily summary.' },
  hrv: { title: 'HRV', unit: 'ms', definition: 'Heart rate variability (RMSSD) measured by WHOOP. Compare with your own baseline, rather than another person’s number.' },
  rhr: { title: 'Resting heart rate', unit: 'bpm', definition: 'WHOOP’s resting heart rate for the cycle, in beats per minute. A single reading does not determine how you should train.' },
  sleepPerformance: { title: 'Sleep performance', unit: '%', definition: 'Time asleep relative to WHOOP’s estimated sleep need. It may remain unavailable while WHOOP is learning your sleep pattern.' },
} as const
export function suggestion(day?: WhoopDay) {
  const n = day?.metrics.recovery
  if (n === undefined || day?.metrics.calibrating || day?.recoveryState !== 'SCORED') return null
  return n <= 33 ? 'Consider one fewer set or leave 3–4 reps in reserve.' : n < 67 ? 'Keep 2–3 reps in reserve and see how your warm-up feels.' : 'Follow your plan and let your warm-up guide the load.'
}
export function WhoopDetails({ view, open, onClose, date }: { view: WhoopView; open: boolean; onClose: () => void; date?: string }) {
  const sync = useMutation(api.whoop.syncNow)
  const [metric, setMetric] = useState<keyof typeof METRICS>('recovery')
  const [range, setRange] = useState<7 | 14>(14)
  const [busy, setBusy] = useState(false)
  const selected = view.data?.today && view.data.today.date === date ? view.data.today : view.data?.trend.find(d => d.date === date)
  const todayKey = dayKey(view.now, view.timezone)
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(`lift:whoop:dismiss-suggestion:${todayKey}`) === 'yes' } catch { return false } })
  const advice = !view.stale && date === todayKey && !dismissed ? suggestion(selected) : null
  const config = METRICS[metric]
  const trend = (view.data?.trend ?? []).slice(-range)
  const points = trend.flatMap(d => { const n = d.metrics[metric]; return typeof n === 'number' ? [{ x: Date.parse(`${d.date}T12:00:00Z`), y: metric === 'sleepMs' ? n/3600000 : n }] : [] })
  return <Sheet open={open} onClose={onClose} title={date ? `WHOOP · ${date}` : 'WHOOP · Week & trends'} size="tall">
    <div className="whoop">
      <div className="flex items-center justify-between gap-2 text-[12px] text-muted"><span role="status">{!view.online ? 'Offline · saved readings' : view.data?.status === 'syncing' ? 'Syncing WHOOP…' : view.stale ? 'Stale · last saved readings' : 'From WHOOP'}</span><span>{view.data?.lastSyncedAt ? `Synced ${new Date(view.data.lastSyncedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Not synced yet'}</span></div>
      {view.data?.error && <p className="mt-3 text-[13px] text-warning">{view.data.error}</p>}
      {view.data?.status === 'reconnect' && <WhoopConnectButton className="btn btn-secondary mt-3 w-full" label="Reconnect WHOOP" />}
      {selected && <>
        <div className="mt-5 flex items-center gap-3"><RecoveryRing value={selected.metrics.recovery} size={36} /><div><div className="num text-[24px] font-[600]" style={{ color: bandColor(selected.metrics.recovery) }}>{valueLabel(selected.metrics.recovery, '%')} <span className="text-[14px] font-normal text-muted">recovery</span></div><p className="text-[12px] text-muted">{selected.metrics.calibrating ? 'WHOOP is calibrating your baseline' : selected.recoveryState === 'PENDING_SCORE' ? 'WHOOP is calculating this score' : selected.recoveryState === 'UNSCORABLE' ? 'Not enough data to score this cycle' : selected.recoveryState ? 'For this physiological cycle' : 'No recovery reading for this date'}</p></div></div>
        {advice && <div className="mt-4 flex items-start gap-2 border-l-2 border-line-strong pl-3"><p className="flex-1 text-[13px] text-muted">{advice}</p><button className="min-h-8 px-2 text-[12px] text-muted" onClick={() => {setDismissed(true); try {localStorage.setItem(`lift:whoop:dismiss-suggestion:${todayKey}`, 'yes'); window.dispatchEvent(new Event('whoop:suggestion-dismissed'))} catch { /* optional */ }}}>Dismiss</button></div>}
        <dl className="mt-5 grid grid-cols-3 gap-x-3 gap-y-4 text-[13px]">
          {[[valueLabel(selected.metrics.hrv,' ms'), 'HRV'],[valueLabel(selected.metrics.rhr,' bpm'),'Resting HR'],[valueLabel(selected.metrics.sleepPerformance,'%'),'Sleep performance'],[sleepLabel(selected.metrics.sleepMs),'Sleep'],[valueLabel(selected.metrics.strain,'',1),date===todayKey?'Strain so far':'Day strain'],[valueLabel(selected.metrics.kilojoule,' kJ'),'Day energy'],[valueLabel(selected.metrics.spo2,'%',1),'SpO₂'],[valueLabel(selected.metrics.skinTemp,'°C',1),'Skin temperature'],[valueLabel(selected.metrics.respiratoryRate,' /min',1),'Respiratory rate']].map(([v,k]) => <div key={k}><dt className="text-[11px] text-muted">{k}</dt><dd className="num mt-1">{v}</dd></div>)}
        </dl>
        {selected.metrics.sleepMs !== undefined && <p className="mt-4 text-[12px] text-muted">Sleep stages · Light {sleepLabel(selected.metrics.lightMs)} · Deep {sleepLabel(selected.metrics.deepMs)} · REM {sleepLabel(selected.metrics.remMs)} · Awake {sleepLabel(selected.metrics.awakeMs)}</p>}
        {(selected.activities.length + selected.linked.length > 0) && <section className="mt-6"><h3 className="text-[14px] font-[550]">Activities</h3>{[...selected.linked,...selected.activities].map(a=><ActivityDetails key={a.externalId} activity={a}/>)}</section>}
      </>}
      <section className="mt-7">
        <div className="flex items-center justify-between"><h3 className="text-[16px] font-[600]">Trends</h3><div className="flex" aria-label="Trend range">{([7,14] as const).map(n=><button key={n} aria-pressed={range===n} className={`min-h-11 px-3 text-[13px] ${range===n?'text-ink':'text-muted'}`} onClick={()=>setRange(n)}>{n} days</button>)}</div></div>
        <div className="mb-4 flex gap-1 overflow-x-auto" aria-label="Metric">{Object.entries(METRICS).map(([key,c])=><button key={key} onClick={()=>setMetric(key as keyof typeof METRICS)} aria-pressed={metric===key} className={`min-h-11 shrink-0 rounded-full px-3 text-[12px] ${metric===key?'bg-raised text-ink':'text-muted'}`}>{c.title}</button>)}</div>
        {points.length ? <LineChart points={points} unit={config.unit} color={metric==='strain'?STRAIN_COLOR:'var(--color-accent)'} /> : <p className="py-6 text-[13px] text-muted">No scored readings in this range yet.</p>}
        <p className="mt-4 text-[13px] leading-5 text-muted">{config.definition}</p>
        <p className="mt-2 text-[12px] text-muted">{points.length} available readings. Missing scores are excluded from averages. Today’s strain is partial.</p>
        <details className="mt-4 text-[12px]"><summary className="min-h-11 cursor-pointer py-3 text-muted">Dated values</summary><table className="num w-full text-left"><thead><tr className="text-muted"><th className="py-2 font-normal">Date</th><th className="font-normal">{config.title}</th></tr></thead><tbody>{trend.map(d=><tr key={d.date} className="border-t border-line"><td className="py-2">{d.date}</td><td>{metric==='sleepMs'?sleepLabel(d.metrics.sleepMs):valueLabel(d.metrics[metric],config.unit,metric==='strain'?1:0)}</td></tr>)}</tbody></table></details>
      </section>
      <button disabled={!view.online||busy||view.data?.status==='syncing'||view.data?.status==='reconnect'} className="btn btn-secondary mt-6 w-full" onClick={async()=>{setBusy(true);try{await sync({});toast('WHOOP sync requested.')}catch{toast('Could not sync WHOOP.',{tone:'error'})}finally{setBusy(false)}}}><RefreshCw aria-hidden className="size-4"/> {view.data?.status==='syncing'?'Syncing…':'Sync now'}</button>
      <p className="mt-4 text-[11px] text-muted">Readings are grouped by your local cycle date. Missing and unscorable readings stay blank.</p>
    </div>
  </Sheet>
}
