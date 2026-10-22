import { Link, createFileRoute } from '@tanstack/react-router'
import { usePaginatedQuery } from 'convex/react'
import { History as HistoryIcon, Trophy } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import { Empty } from '#/components/Empty'
import { ExerciseThumb } from '#/components/ExerciseThumb'
import { PageHeader } from '#/components/PageHeader'
import { ListSkeleton } from '#/components/Skeletons'
import { fmtDate, fmtDuration, fmtVolume } from '#/lib/format'
import { useUnit } from '#/lib/me'

export const Route = createFileRoute('/_app/history/')({ component: HistoryList })

function HistoryList() {
  const unit = useUnit()
  const { results, status, loadMore } = usePaginatedQuery(api.workouts.list, {}, { initialNumItems: 20 })

  const groups: { label: string; items: typeof results }[] = []
  for (const w of results) {
    const label = fmtDate(w.startedAt, { month: 'long', year: 'numeric' })
    const g = groups[groups.length - 1]
    if (g && g.label === label) g.items.push(w)
    else groups.push({ label, items: [w] })
  }

  return (
    <main className="page">
      <PageHeader title="History" />
      {status === 'LoadingFirstPage' ? (
        <ListSkeleton rows={6} />
      ) : results.length === 0 ? (
        <Empty icon={HistoryIcon} title="No workouts yet" body="Finished workouts land here, with every set." action={<Link to="/" className="btn btn-primary">Start training</Link>} />
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.label} className="animate-fade">
              <h2 className="t-eyebrow sticky top-0 z-10 -mx-1 bg-black/85 px-1 py-2 text-subtle backdrop-blur">
                {g.label} <span className="num ml-1 text-faint">{g.items.length}</span>
              </h2>
              <ul className="divide-hair">
                {g.items.map((w) => (
                  <li key={w._id}>
                    <Link to="/history/$workoutId" params={{ workoutId: w._id }} className="press flex gap-4 py-4">
                      <div className="w-11 shrink-0 text-center">
                        <div className="text-[11px] font-[650] uppercase tracking-[0.06em] text-subtle">{fmtDate(w.startedAt, { weekday: 'short' })}</div>
                        <div className="num text-[22px] font-[680] leading-7 tracking-[-0.02em]">{new Date(w.startedAt).getDate()}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[16px] font-[600]">{w.title}</span>
                          {(w.stats?.prs ?? 0) > 0 && (
                            <span className="num inline-flex shrink-0 items-center gap-1 rounded-full bg-pr-dim px-2 py-0.5 text-[12px] font-[650] text-pr">
                              <Trophy className="size-3" /> {w.stats?.prs}
                            </span>
                          )}
                        </div>
                        {w.stats && (
                          <div className="num mt-0.5 text-[13px] text-subtle">
                            {fmtDuration(w.stats.durationSec)} · {w.stats.sets} sets · {fmtVolume(w.stats.volumeKg, unit)} {unit}
                          </div>
                        )}
                        <div className="mt-2.5 flex -space-x-1.5">
                          {w.exercises.slice(0, 7).map((e, i) => (
                            <ExerciseThumb key={i} src={e.thumbnailUrl} size={28} className="rounded-[8px] ring-2 ring-black" />
                          ))}
                          {w.exerciseCount > 7 && (
                            <span className="num grid size-7 place-items-center rounded-[8px] bg-raised text-[11px] font-[650] text-muted ring-2 ring-black">+{w.exerciseCount - 7}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {status === 'CanLoadMore' && (
            <button className="btn btn-secondary w-full" onClick={() => loadMore(30)}>Load more</button>
          )}
          {status === 'LoadingMore' && <ListSkeleton rows={2} />}
        </div>
      )}
    </main>
  )
}
