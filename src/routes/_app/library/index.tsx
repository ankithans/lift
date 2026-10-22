import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Check, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import { ExerciseThumb } from '#/components/ExerciseThumb'
import { GROUPS } from '#/components/ExercisePicker'
import { PageHeader } from '#/components/PageHeader'
import { Sheet } from '#/components/Sheet'
import { ListSkeleton } from '#/components/Skeletons'
import { mainEquipment } from '#/lib/format'

type Search = { q?: string; group?: string; scope?: 'recent' }

export const Route = createFileRoute('/_app/library/')({
  head: () => ({ meta: [{ title: 'Library · Lift' }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    group: typeof s.group === 'string' && s.group ? s.group : undefined,
    scope: s.scope === 'recent' ? 'recent' : undefined,
  }),
  component: Library,
})

// Drop the leading "(Bodyweight)" / "3 Point" style prefixes when sorting and grouping.
const sortKey = (n: string) => n.replace(/^\([^)]*\)\s*/, '').replace(/^\d+\s*/, '')

function Library() {
  const { q = '', group, scope } = Route.useSearch()
  const navigate = Route.useNavigate()
  const query = useDeferredValue(q)
  const all = useQuery(api.library.search, scope === 'recent' ? 'skip' : { query: query || undefined, group, limit: 400 })
  const recent = useQuery(api.library.recent, scope === 'recent' ? { limit: 60 } : 'skip')
  const [filtering, setFiltering] = useState(false)
  const set = (patch: Search) => navigate({ search: { q: q || undefined, group, scope, ...patch }, replace: true, viewTransition: false })

  const results = useMemo(() => {
    if (scope !== 'recent') return all
    if (!recent) return undefined
    const t = query.trim().toLowerCase()
    return recent.filter((e) => (!t || e.name.toLowerCase().includes(t)) && (!group || e.primaryGroups.includes(group) || e.categories.includes(group)))
  }, [scope, all, recent, query, group])

  const sections = useMemo(() => {
    if (!results) return []
    if (query || scope === 'recent') return [{ letter: '', items: results }]
    const map = new Map<string, typeof results>()
    for (const e of [...results].sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name)))) {
      const k = sortKey(e.name)
      const l = /[a-z]/i.test(k[0]) ? k[0].toUpperCase() : '#'
      map.set(l, [...(map.get(l) ?? []), e])
    }
    return [...map.entries()].map(([letter, items]) => ({ letter, items }))
  }, [results, query, scope])

  return (
    <main className="page">
      <PageHeader
        title="Library"
        action={
          <button className="icon-btn relative size-12" aria-label={group ? `Filter: ${group}` : 'Filter'} onClick={() => setFiltering(true)}>
            <SlidersHorizontal className="size-5" />
            {group && <span aria-hidden className="absolute right-3 top-3 size-2 rounded-full bg-accent" />}
          </button>
        }
      />
      <div className="sticky top-[calc(var(--safe-top)+56px)] z-20 -mx-5 -mt-4 bg-black px-5 pb-3 pt-1 lg:-mx-8 lg:px-8">
        <label className="relative block">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => set({ q: e.target.value || undefined })}
            placeholder="Search exercises"
            aria-label="Search exercises"
            className="field pl-11 pr-11"
            enterKeyHint="search"
            autoComplete="off"
          />
          {q && (
            <button onClick={() => set({ q: undefined })} className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center text-muted" aria-label="Clear search">
              <X className="size-[18px]" />
            </button>
          )}
        </label>
        <div className="mt-3 flex items-center gap-2" role="group" aria-label="Scope">
          {([
            [undefined, 'All'],
            ['recent', 'Recent'],
          ] as const).map(([v, label]) => (
            <button key={label} className="chip" data-on={scope === v} aria-pressed={scope === v} onClick={() => set({ scope: v })}>
              {label}
            </button>
          ))}
          {group && (
            <span className="ml-auto flex items-center text-[13px] text-muted">
              {group}
              <button className="-mr-2 grid size-11 place-items-center text-muted hover:text-ink" aria-label={`Clear ${group} filter`} onClick={() => set({ group: undefined })}>
                <X className="size-4" />
              </button>
            </span>
          )}
        </div>
      </div>

      {results === undefined ? (
        <div className="pt-3">
          <ListSkeleton rows={10} />
        </div>
      ) : results.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[16px] font-[550]">{scope === 'recent' && !q && !group ? 'Nothing logged yet' : `No exercises match${q ? ` “${q}”` : ''}`}</p>
          {(q || group) && (
            <button className="mt-3 h-11 text-[14px] font-[600] text-accent" onClick={() => set({ q: undefined, group: undefined })}>
              Clear search and filters
            </button>
          )}
        </div>
      ) : (
        <div>
          {sections.map((s) => (
            <section key={s.letter || 'all'} aria-label={s.letter || undefined}>
              {s.letter && <h2 className="pb-2 pt-6 text-[12px] font-[500] text-muted">{s.letter}</h2>}
              <ul>
                {s.items.map((e) => (
                  <li key={e._id}>
                    <Link to="/library/$slug" params={{ slug: e.slug }} className="press -mx-2 flex min-h-[72px] items-center gap-3 rounded-2xl px-2 hover:bg-surface">
                      <ExerciseThumb src={e.thumbnailUrl} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-[550] leading-[22px]">{e.name}</span>
                        {e.equipment.length > 0 && <span className="block truncate text-[13px] text-muted">{mainEquipment(e.equipment)}</span>}
                      </span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Sheet open={filtering} onClose={() => setFiltering(false)} title="Filter">
        <div role="radiogroup" aria-label="Muscle" className="pb-2">
          {group && (
            <div className="mb-2 flex min-h-12 items-center justify-between border-b border-line text-[14px] text-muted">
              Showing {group}
              <button
                className="h-11 px-2 text-[14px] font-[600] text-accent"
                onClick={() => {
                  set({ group: undefined })
                  setFiltering(false)
                }}
              >
                Clear
              </button>
            </div>
          )}
          {[null, ...GROUPS].map((g) => {
            const on = (group ?? null) === g
            return (
              <button
                key={g ?? 'all'}
                role="radio"
                aria-checked={on}
                onClick={() => {
                  set({ group: g ?? undefined })
                  setFiltering(false)
                }}
                className="press -mx-2 flex min-h-12 w-[calc(100%+16px)] items-center justify-between rounded-2xl px-2 text-left text-[16px] hover:bg-raised"
              >
                {g ?? 'All muscles'}
                {on && <Check aria-hidden className="size-5 text-accent" strokeWidth={2.4} />}
              </button>
            )
          })}
        </div>
      </Sheet>
    </main>
  )
}
