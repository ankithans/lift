import { Link, createFileRoute } from '@tanstack/react-router'
import { usePaginatedQuery } from 'convex/react'
import { ChevronRight, History as HistoryIcon, Medal } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import { Empty } from '#/components/Empty'
import { PageHeader } from '#/components/PageHeader'
import { ListSkeleton } from '#/components/Skeletons'
import { fmtDate, fmtDuration } from '#/lib/format'

export const Route = createFileRoute('/_app/history/')({
  head: () => ({ meta: [{ title: 'History · Lift' }] }), component: HistoryList })

function HistoryList() {
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
        <Empty icon={HistoryIcon} title="No workouts yet" body="Completed sessions appear here." action={<Link to="/" className="btn btn-primary">Start training</Link>} />
      ) : (
        <div className="space-y-7">
          {groups.map((g) => (
            <section key={g.label} aria-label={`${g.label}, ${g.items.length} workouts`} className="animate-fade">
              <h2 className="sticky top-[calc(var(--safe-top)+56px)] z-10 -mx-5 bg-black px-5 py-2 text-[18px] font-[600] leading-6">{g.label}</h2>
              <ul>
                {g.items.map((w) => (
                  <li key={w._id}>
                    <Link to="/history/$workoutId" params={{ workoutId: w._id }} className="press -mx-2 flex min-h-20 items-center gap-3 rounded-2xl px-2 hover:bg-surface">
                      <div className="w-14 shrink-0 text-[13px] leading-[18px] text-muted">
                        <div className="font-[600]">{fmtDate(w.startedAt, { weekday: 'short' })}</div>
                        <div className="num">{new Date(w.startedAt).getDate()}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[16px] font-[550] leading-[22px]">{w.title}</div>
                        {w.stats && (
                          <div className="num text-[13px] text-muted">
                            {fmtDuration(w.stats.durationSec)} · {w.stats.sets} sets
                          </div>
                        )}
                      </div>
                      {(w.stats?.prs ?? 0) > 0 && (
                        <span className="num inline-flex shrink-0 items-center gap-1 text-[13px] font-[550] text-pr" aria-label={`${w.stats?.prs} personal records`}>
                          <Medal aria-hidden className="size-3.5" /> {w.stats?.prs}
                        </span>
                      )}
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
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
