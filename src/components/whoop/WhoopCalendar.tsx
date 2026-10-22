import { useEffect, useState } from 'react'
import { ChevronRight, Activity } from 'lucide-react'
import type { WhoopDay } from '../../../convex/whoop/model'
import { RecoveryRing, SportIcon, WhoopDetails, suggestion } from './WhoopDetails'
import { bandColor, dayKey, sleepLabel, valueLabel, STRAIN_COLOR, type WhoopView } from './useWhoop'
import './whoop.css'

export function WhoopToday({view}:{view:WhoopView}) {
  const [open,setOpen]=useState(false)
  const date=dayKey(view.now,view.timezone),day=view.data?.today ?? view.data?.trend.find(d=>d.date===date)
  const [dismissed,setDismissed]=useState(false)
  useEffect(()=>{const update=()=>{try{setDismissed(localStorage.getItem(`lift:whoop:dismiss-suggestion:${date}`)==='yes')}catch{/* optional */}};update();window.addEventListener('whoop:suggestion-dismissed',update);return()=>window.removeEventListener('whoop:suggestion-dismissed',update)},[date])
  if(!view.data||view.data.status==='disconnected')return null
  const advice=!view.stale&&!dismissed?suggestion(day):null
  const short=advice ? day!.metrics.recovery!<=33?'consider a lighter session':day!.metrics.recovery!<67?'keep 2–3 reps in reserve':'follow your plan':view.stale?'last synced reading':dismissed?'from WHOOP':day?.recoveryState==='UNSCORABLE'?'not enough data':'score pending'
  return <><button onClick={()=>setOpen(true)} className="whoop mt-1 flex min-h-8 max-w-full items-center gap-1.5 text-left text-[12px] text-muted"><RecoveryRing value={day?.metrics.recovery}/><span className="truncate"><span className="num" style={{color:bandColor(day?.metrics.recovery)}}>{valueLabel(day?.metrics.recovery,'%')} recovery</span> · {short}</span></button><WhoopDetails view={view} open={open} onClose={()=>setOpen(false)} date={date}/></>
}
export function WhoopMetricLine({day,today}:{day?:WhoopDay;today:boolean}) {
  const m=day?.metrics??{}
  const linked=day?.linked[0]
  const label=`Recovery ${m.recovery===undefined?'unavailable':Math.round(m.recovery)+' percent'}, day strain ${m.strain===undefined?'unavailable':m.strain.toFixed(1)+(today?' so far':'')}, sleep ${m.sleepMs===undefined?'unavailable':sleepLabel(m.sleepMs)}${linked?`, Lift session strain ${valueLabel(linked.metrics.strain,'',1)}, average heart rate ${valueLabel(linked.metrics.avgHr,' beats per minute')}, energy ${valueLabel(linked.metrics.kilojoule,' kilojoules')}`:''}${day?.activities.length?`, ${day.activities.length} WHOOP activities`:''}`
  return <span className="whoop num mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[12px] leading-[18px] text-muted" role="img" aria-label={label}>
    <span aria-hidden className="flex min-w-0 items-center gap-1.5 overflow-hidden"><RecoveryRing value={m.recovery}/><span>{valueLabel(m.recovery,'%')}</span><span className="h-[3px] w-5 shrink-0 overflow-hidden rounded-full bg-line-strong"><span className="block h-full" style={{width:`${Math.max(0,Math.min(21,m.strain??0))/21*100}%`,background:STRAIN_COLOR}}/></span><span className="truncate">{valueLabel(m.strain,'',1)}{today?' so far':''} · {sleepLabel(m.sleepMs)}{linked?` · Lift ${valueLabel(linked.metrics.strain,'',1)} · ${valueLabel(linked.metrics.avgHr,' bpm')} · ${valueLabel(linked.metrics.kilojoule,' kJ')}`:''}</span></span>
  </span>
}
export function WhoopDayButton({view,day,dateAt}:{view:WhoopView;day?:WhoopDay;dateAt:number}) {
  const [open,setOpen]=useState(false)
  const activities=day?.activities??[]
  return <><button onClick={()=>setOpen(true)} className="whoop flex min-h-8 min-w-8 shrink-0 items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] text-muted hover:bg-raised" aria-label={`WHOOP details for ${dayKey(dateAt,view.timezone)}${activities.length?`, ${activities.length} activities`:''}`}>
    {activities.length?<><SportIcon sport={activities[0].sport} className="size-3.5"/><span className="num">{valueLabel(activities[0].metrics.strain,'',1)}{activities.length>1?` +${activities.length-1}`:''}</span></>:<Activity aria-hidden className="size-3.5"/>}
  </button><WhoopDetails view={view} open={open} onClose={()=>setOpen(false)} date={dayKey(dateAt,view.timezone)}/></>
}
export function WhoopWeekSummary({view,dates}:{view:WhoopView;dates:number[]}) {
  const [open,setOpen]=useState(false)
  const today=dayKey(view.now,view.timezone)
  const days=dates.map(at=>({at,date:dayKey(at,view.timezone),day:view.data?.days.find(d=>d.date===dayKey(at,view.timezone))}))
  const average=(metric:'recovery'|'strain'|'sleepMs')=>{const values=days.flatMap(d=>{const n=d.day?.metrics[metric];return d.date<=today&&n!==undefined?[n]:[]});return values.length?values.reduce((a,b)=>a+b,0)/values.length:undefined}
  const recovery=average('recovery'),strain=average('strain'),sleep=average('sleepMs')
  // Split line at missing days instead of implying observations through a gap.
  const line=days.map((d,i)=>{const n=d.day?.metrics.strain;return d.date<=today&&n!==undefined?`${i===0||days[i-1].day?.metrics.strain===undefined?'M':'L'}${i*40+20},${44-n/21*40}`:''}).join(' ')
  return <div className="whoop mb-2 mt-4">
    <button className="w-full rounded-[14px] bg-surface px-3 py-3 text-left" onClick={()=>setOpen(true)} aria-label={`WHOOP week averages and trends. Recovery ${valueLabel(recovery, '%')}, strain ${valueLabel(strain, '', 1)}, sleep ${sleepLabel(sleep)}.`}>
      <span className="mb-2 flex items-center justify-between text-[11px] text-muted"><span>{!view.online?'Offline · saved data':view.data?.status==='syncing'?'WHOOP · syncing…':view.stale?'WHOOP · stale data':dates[0] > view.now ? 'WHOOP · upcoming week' : dates[dates.length-1] < view.now ? 'WHOOP · week summary' : 'WHOOP · week so far'}</span><ChevronRight aria-hidden className="size-3.5"/></span>
      <span className="grid grid-cols-3 gap-2 text-[11px] text-muted">{[[valueLabel(recovery,'%'),'Avg recovery'],[valueLabel(strain,'',1),'Avg strain'],[sleepLabel(sleep),'Avg sleep']].map(([v,k])=><span key={k}><span className="num block text-[17px] font-[550] leading-6 text-ink">{v}</span>{k}</span>)}</span>
      <span aria-hidden className="relative mt-3 block h-12">
        <span className="absolute inset-0 grid grid-cols-7 items-end gap-3 px-1">{days.map(d=><span key={d.at} className="mx-auto block w-full max-w-7 rounded-t-[3px]" style={{height:d.date>today||d.day?.metrics.recovery===undefined?2:`${Math.max(3,d.day.metrics.recovery/100*100)}%`,background:d.date>today||d.day?.metrics.recovery===undefined?'var(--color-line-strong)':bandColor(d.day.metrics.recovery)}}/>)}</span>
        <svg viewBox="0 0 280 48" preserveAspectRatio="none" className="absolute inset-0 h-full w-full"><path d={line} fill="none" stroke={STRAIN_COLOR} strokeWidth="1.75" strokeLinejoin="round"/>{days.map((d,i)=>d.day?.metrics.strain!==undefined&&d.date<=today?<circle key={d.at} cx={i*40+20} cy={44-d.day.metrics.strain/21*40} r="2" fill={STRAIN_COLOR}/>:null)}</svg>
      </span>
      <span aria-hidden className="mt-1 grid grid-cols-7 text-center text-[10px] text-muted">{days.map(d=><span key={d.at} className={d.date===today?'font-bold text-ink underline decoration-accent underline-offset-4':''}>{new Date(d.at).toLocaleDateString('en',{weekday:'narrow',timeZone:view.timezone})}</span>)}</span>
      <span className="sr-only">{days.map(d=>`${d.date}${d.date===today?', today':''}: recovery ${valueLabel(d.day?.metrics.recovery,'%')}, strain ${valueLabel(d.day?.metrics.strain,'',1)}`).join('. ')}</span>
      <span className="mt-2 flex justify-between text-[10px] text-muted"><span>Bars: recovery 0–100%</span><span style={{color:STRAIN_COLOR}}>Line: strain 0–21</span></span>
    </button><WhoopDetails view={view} open={open} onClose={()=>setOpen(false)}/>
  </div>
}
