import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { ChevronDown, Medal, Play } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import { fmtDate, fmtSet, toDisplayWeight } from '#/lib/format'
import { useUnit } from '#/lib/me'
import { LineChart } from './LineChart'
import { BlockSkeleton } from './Skeletons'

export type ExerciseData = NonNullable<FunctionReturnType<typeof api.library.get>>

export function youtubeId(url: string | null | undefined) {
  if (!url) return null
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)
  return m?.[1] ?? null
}

export function VideoPlayer({ url, poster, name }: { url: string | null; poster?: string | null; name: string }) {
  const [playing, setPlaying] = useState(false)
  const id = youtubeId(url)
  if (!id) return null
  if (playing) {
    return (
      <div className="video-frame animate-fade">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={`Form video: ${name}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    )
  }
  return (
    <button onClick={() => setPlaying(true)} className="video-frame press group block" aria-label={`Watch form video, ${name}`}>
      <img
        src={poster || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt=""
        className="absolute inset-0 size-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
        loading="lazy"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/70 py-1.5 pl-1.5 pr-3.5 text-[13px] font-[600] backdrop-blur">
        <span className="grid size-7 place-items-center rounded-full bg-white text-black">
          <Play className="size-3.5 translate-x-[1px] fill-current" />
        </span>
        Watch form
      </span>
    </button>
  )
}

export function ExerciseBody({ data, compact = false }: { data: ExerciseData; compact?: boolean }) {
  const unit = useUnit()
  // Sheets opened mid-workout default to History (what you need between sets); the page defaults to Form.
  const [tab, setTab] = useState<'form' | 'history'>(compact && data.sessions.length > 0 ? 'history' : 'form')
  const [allSteps, setAllSteps] = useState(false)
  const [musclesOpen, setMusclesOpen] = useState(false)
  // "All Glutes" next to "Glutes" is noise; keep the specific labels.
  const muscles = data.muscles.filter((m, i, all) => !(m.name.startsWith('All ') && all.some((o, j) => j !== i && o.group === m.group)))
  const primary = muscles.filter((m) => m.role === 'primary')
  const secondary = muscles.filter((m) => m.role === 'secondary' && !primary.some((p) => p.name === m.name))
  const steps = data.steps.map((s) => s.trim()).filter(Boolean)
  const shownSteps = allSteps ? steps : steps.slice(0, 3)

  // One metric, clearly named: heaviest working set per session (reps for bodyweight, time for holds).
  const loaded = data.tracking === 'weight_reps' || data.tracking === 'weighted_bodyweight'
  const metricName = data.tracking === 'duration' ? 'Longest hold' : loaded ? 'Heaviest set' : 'Most reps'
  const perSession = [...data.sessions].reverse().map((s) => {
    const top = s.sets.reduce<(typeof s.sets)[number] | null>((best, x) => {
      const v = data.tracking === 'duration' ? (x.durationSec ?? 0) : loaded ? (x.weightKg ?? 0) * 1000 + (x.reps ?? 0) : (x.reps ?? 0)
      const b = best ? (data.tracking === 'duration' ? (best.durationSec ?? 0) : loaded ? (best.weightKg ?? 0) * 1000 + (best.reps ?? 0) : (best.reps ?? 0)) : -1
      return v > b ? x : best
    }, null)
    return { at: s.at, top }
  })
  const value = (x: { weightKg: number | null; reps: number | null; durationSec: number | null } | null) =>
    !x ? 0 : data.tracking === 'duration' ? (x.durationSec ?? 0) : loaded ? (toDisplayWeight(x.weightKg, unit) ?? 0) : (x.reps ?? 0)
  const points = perSession.filter((p) => p.top).map((p) => ({ x: p.at, y: value(p.top) }))
  const bestIdx = perSession.reduce((bi, p, i) => (value(p.top) > value(perSession[bi]?.top ?? null) ? i : bi), 0)
  const best = perSession[bestIdx]
  const metricUnit = data.tracking === 'duration' ? 's' : loaded ? unit : 'reps'

  return (
    <div>
      <div role="tablist" aria-label="Exercise view" className="grid grid-cols-2 rounded-[12px] bg-surface p-1">
        {(['form', 'history'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`press h-10 rounded-[9px] text-[14px] font-[550] capitalize transition-colors ${tab === t ? 'bg-pressed text-ink' : 'text-muted'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'form' ? (
        <div role="tabpanel" className="mt-4 animate-fade">
          {data.videoUrl ? <VideoPlayer url={data.videoUrl} name={data.name} /> : null}
          {steps.length > 0 && (
            <section className="mt-7">
              <h2 className="text-[18px] font-[600] leading-6">Technique</h2>
              <ol className="mt-3 space-y-4">
                {shownSteps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="num w-4 shrink-0 pt-[1px] text-[14px] text-muted">{i + 1}</span>
                    <p className={`text-[16px] leading-6 text-ink/90 ${allSteps ? '' : 'line-clamp-3'}`}>{s}</p>
                  </li>
                ))}
              </ol>
              {(steps.length > 3 || steps.some((s) => s.length > 160)) && (
                <button onClick={() => setAllSteps(!allSteps)} className="mt-3 h-11 text-[14px] font-[600] text-accent">
                  {allSteps ? 'Show less' : 'Full instructions'}
                </button>
              )}
              {data.cues[0] && allSteps && <p className="mt-2 text-[15px] leading-6 text-muted">{data.cues[0]}</p>}
            </section>
          )}
          {muscles.length > 0 && (
            <section className="mt-6 border-t border-line">
              <button onClick={() => setMusclesOpen(!musclesOpen)} aria-expanded={musclesOpen} className="flex min-h-16 w-full items-center gap-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-[550]">Muscles</span>
                  <span className="block truncate text-[13px] text-muted">
                    {primary.map((m) => m.name).join(', ')}
                    {secondary.length ? ` · also ${secondary.map((m) => m.name).join(', ')}` : ''}
                  </span>
                </span>
                <ChevronDown aria-hidden className={`size-4 text-muted transition-transform ${musclesOpen ? 'rotate-180' : ''}`} />
              </button>
              {musclesOpen && (
                <dl className="pb-3 text-[15px] animate-fade">
                  <dt className="text-[13px] text-muted">Primary</dt>
                  <dd className="mb-3">{primary.map((m) => m.name).join(', ') || '—'}</dd>
                  {secondary.length > 0 && (
                    <>
                      <dt className="text-[13px] text-muted">Secondary</dt>
                      <dd>{secondary.map((m) => m.name).join(', ')}</dd>
                    </>
                  )}
                </dl>
              )}
            </section>
          )}
        </div>
      ) : (
        <div role="tabpanel" className="mt-5 animate-fade">
          {data.sessions.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[16px] font-[550]">No sets logged yet</p>
              <p className="mt-1 text-[14px] text-muted">Your first session sets the baseline.</p>
            </div>
          ) : (
            <>
              <div className="text-[13px] text-muted">{metricName}</div>
              {best?.top && (
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="num text-[28px] font-[550] leading-[34px] tracking-[-0.02em]">{fmtSet(best.top, data.tracking, unit)}</span>
                  <span className="inline-flex items-center gap-1 text-[13px] font-[500] text-pr">
                    <Medal aria-hidden className="size-3.5" /> Best
                  </span>
                  <span className="text-[13px] text-muted">{fmtDate(best.at, { day: 'numeric', month: 'short' })}</span>
                </div>
              )}
              {points.length >= 2 && (
                <div className="mt-3">
                  <LineChart points={points} unit={metricUnit} height={160} hideReadout />
                </div>
              )}
              <ul className="mt-4">
                {data.sessions.map((s) => (
                  <li key={s.workoutId} className="border-t border-line">
                    <Link to="/history/$workoutId" params={{ workoutId: s.workoutId }} className="press block py-3.5">
                      <div className="text-[13px] text-muted">
                        {fmtDate(s.at, { day: 'numeric', month: 'short' })} · {s.title}
                      </div>
                      <div className="num mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[16px]">
                        {s.sets.map((x, i) => (
                          <span key={i} className={x.isPr ? 'inline-flex items-center gap-1 text-pr' : ''}>
                            {x.isPr && <Medal aria-label="Personal record" className="size-3.5" />}
                            {fmtSet(x, data.tracking, unit)}
                          </span>
                        ))}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Self-loading exercise view used inside sheets. */
export function ExerciseInfo({ id }: { id: string }) {
  const data = useQuery(api.library.get, { id })
  if (data === undefined) return <BlockSkeleton h={220} />
  if (data === null) return null
  return <ExerciseBody data={data} compact />
}
