import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { Play, Trophy } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import { fmtDate, fmtNum, fmtRelativeDay, fmtWeight, toDisplayWeight } from '#/lib/format'
import { useUnit } from '#/lib/me'
import { LineChart } from './LineChart'
import { BlockSkeleton } from './Skeletons'

export type ExerciseData = NonNullable<FunctionReturnType<typeof api.library.get>>

export function youtubeId(url: string | null | undefined) {
  if (!url) return null
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/)
  return m?.[1] ?? null
}

export function VideoPlayer({ url, poster }: { url: string | null; poster?: string | null }) {
  const [playing, setPlaying] = useState(false)
  const id = youtubeId(url)
  if (!id) return null
  if (playing) {
    return (
      <div className="video-frame animate-fade">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title="Form video"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    )
  }
  return (
    <button onClick={() => setPlaying(true)} className="video-frame press group block" aria-label="Play form video">
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
  const [tab, setTab] = useState<'about' | 'history'>(data.sessions.length > 0 && compact ? 'history' : 'about')
  // "All Glutes" next to "Glutes" is noise; keep the more specific labels.
  const muscles = data.muscles.filter((m, i, all) => !(m.name.startsWith('All ') && all.some((o, j) => j !== i && o.group === m.group)))
  const primary = muscles.filter((m) => m.role === 'primary')
  const secondary = muscles.filter((m) => m.role === 'secondary' && !primary.some((p) => p.group === m.group && p.name === m.name))
  const chartPoints = [...data.sessions]
    .reverse()
    .filter((s) => s.bestE1rmKg > 0)
    .map((s) => ({ x: s.at, y: toDisplayWeight(s.bestE1rmKg, unit) ?? 0 }))

  return (
    <div>
      {data.videoUrl ? (
        <VideoPlayer url={data.videoUrl} />
      ) : (
        <div className="grid aspect-video place-items-center rounded-[18px] bg-surface text-[14px] text-subtle">Video coming soon</div>
      )}

      <div className="mt-5 grid grid-cols-2 rounded-full bg-surface p-1">
        {(['about', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`press h-10 rounded-full text-[14px] font-[600] capitalize transition-colors ${tab === t ? 'bg-raised text-ink' : 'text-subtle'}`}
          >
            {t === 'history' ? `History${data.sessions.length ? ` · ${data.sessions.length}` : ''}` : 'Form'}
          </button>
        ))}
      </div>

      {tab === 'about' ? (
        <div className="mt-6 space-y-7 animate-fade">
          <section>
            <h3 className="t-eyebrow text-subtle">Muscles</h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {primary.map((m) => (
                <span key={m.name} className="rounded-full bg-accent-dim px-3 py-1.5 text-[13px] font-[600] text-accent">
                  {m.name}
                </span>
              ))}
              {secondary.map((m) => (
                <span key={m.name} className="rounded-full bg-raised px-3 py-1.5 text-[13px] font-[550] text-muted">
                  {m.name}
                </span>
              ))}
            </div>
            {data.equipment.length > 0 && <p className="mt-3 text-[14px] text-subtle">Equipment · {data.equipment.join(', ')}</p>}
          </section>
          {data.steps.length > 0 && (
            <section>
              <h3 className="t-eyebrow text-subtle">How to</h3>
              <ol className="mt-3 space-y-4">
                {data.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="num mt-[1px] grid size-6 shrink-0 place-items-center rounded-full bg-raised text-[12px] font-[650] text-muted">{i + 1}</span>
                    <p className="text-[15px] leading-[23px] text-ink/85">{s.trim()}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {(data.cues.length > 0 || data.tips) && (
            <section className="rounded-[18px] bg-surface p-4">
              <h3 className="t-eyebrow text-subtle">Cues</h3>
              {data.cues.map((c, i) => (
                <p key={i} className="mt-2 text-[15px] leading-[23px] text-ink/85">{c}</p>
              ))}
              {data.tips && <p className="mt-2 text-[15px] leading-[23px] text-muted">{data.tips}</p>}
            </section>
          )}
        </div>
      ) : (
        <div className="mt-6 animate-fade">
          {data.sessions.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-muted">No sets logged yet. Your first one sets the bar.</p>
          ) : (
            <>
              {data.stats?.bestE1rmKg ? (
                <div className="flex items-center gap-3 rounded-[18px] bg-pr-dim p-4">
                  <Trophy className="size-5 text-pr" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-[600] text-pr">Best set</div>
                    <div className="num text-[17px] font-[650]">
                      {fmtWeight(data.stats.bestWeightKg, unit)} {unit} × {data.stats.bestReps}
                      <span className="ml-2 text-[13px] font-[500] text-muted">≈ {fmtWeight(data.stats.bestE1rmKg, unit)} {unit} 1RM</span>
                    </div>
                  </div>
                  {data.stats.bestSetAt && <div className="text-[12px] text-subtle">{fmtDate(data.stats.bestSetAt, { month: 'short', day: 'numeric' })}</div>}
                </div>
              ) : null}
              {chartPoints.length >= 2 && (
                <div className="mt-5">
                  <div className="t-eyebrow mb-2 text-subtle">Estimated 1RM</div>
                  <LineChart points={chartPoints} unit={unit} />
                </div>
              )}
              <ul className="mt-5 divide-hair">
                {data.sessions.map((s) => (
                  <li key={s.workoutId}>
                    <Link to="/history/$workoutId" params={{ workoutId: s.workoutId }} className="press block py-3.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[15px] font-[580]">{fmtRelativeDay(s.at)}</span>
                        <span className="truncate text-[13px] text-subtle">{s.title}</span>
                      </div>
                      <div className="num mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[14px] text-muted">
                        {s.sets.map((x, i) => (
                          <span key={i} className={x.isPr ? 'text-pr' : ''}>
                            {x.weightKg ? `${fmtWeight(x.weightKg, unit)}×` : ''}
                            {x.reps ?? (x.durationSec ? `${fmtNum(x.durationSec)}s` : '—')}
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
