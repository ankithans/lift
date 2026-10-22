import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { Search, X } from 'lucide-react'
import { useDeferredValue, useMemo } from 'react'
import { api } from '../../../../convex/_generated/api'
import { ExerciseThumb } from '#/components/ExerciseThumb'
import { MuscleChips } from '#/components/ExercisePicker'
import { PageHeader } from '#/components/PageHeader'
import { ListSkeleton } from '#/components/Skeletons'

type Search = { q?: string; group?: string }

export const Route = createFileRoute('/_app/library/')({
  head: () => ({ meta: [{ title: 'Library · Lift' }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    group: typeof s.group === 'string' && s.group ? s.group : undefined,
  }),
  component: Library,
})

function Library() {
  const { q = '', group } = Route.useSearch()
  const navigate = Route.useNavigate()
  const query = useDeferredValue(q)
  const results = useQuery(api.library.search, { query: query || undefined, group, limit: 400 })
  const set = (patch: Search) => navigate({ search: { q: q || undefined, group, ...patch }, replace: true, viewTransition: false })

  const sections = useMemo(() => {
    if (!results) return []
    if (query) return [{ letter: '', items: results }]
    const map = new Map<string, typeof results>()
    const key = (n: string) => n.replace(/^\([^)]*\)\s*/, '').replace(/^\d+\s*/, '')
    for (const e of [...results].sort((a, b) => key(a.name).localeCompare(key(b.name)))) {
      const k = key(e.name)
      const l = /[a-z]/i.test(k[0]) ? k[0].toUpperCase() : '#'
      map.set(l, [...(map.get(l) ?? []), e])
    }
    return [...map.entries()].map(([letter, items]) => ({ letter, items }))
  }, [results, query])

  return (
    <main className="page">
      <PageHeader title="Library" />
      <div className="sticky top-0 z-20 -mx-5 bg-black/85 px-5 pb-3 pt-2 backdrop-blur-xl lg:-mx-8 lg:px-8">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-subtle" />
          <input
            value={q}
            onChange={(e) => set({ q: e.target.value || undefined })}
            placeholder={`Search ${results && !query && !group ? results.length : ''} exercises`.replace('  ', ' ')}
            className="field pl-11 pr-10"
            aria-label="Search exercises"
            enterKeyHint="search"
            autoComplete="off"
          />
          {q && (
            <button onClick={() => set({ q: undefined })} className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle" aria-label="Clear search">
              <X className="size-[18px]" />
            </button>
          )}
        </label>
        <div className="mt-3">
          <MuscleChips value={group ?? null} onChange={(g) => set({ group: g ?? undefined })} />
        </div>
      </div>

      {results === undefined ? (
        <div className="pt-3"><ListSkeleton rows={10} /></div>
      ) : results.length === 0 ? (
        <p className="py-16 text-center text-muted">Nothing matches “{q}”.</p>
      ) : (
        <div className="pt-1">
          {sections.map((s) => (
            <section key={s.letter || 'all'}>
              {s.letter && <h2 className="t-eyebrow pb-1 pt-5 text-subtle">{s.letter}</h2>}
              <ul>
                {s.items.map((e) => (
                  <li key={e._id}>
                    <Link to="/library/$slug" params={{ slug: e.slug }} className="press -mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface">
                      <ExerciseThumb src={e.thumbnailUrl} size={48} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-[560]">{e.name}</span>
                        <span className="block truncate text-[13px] text-subtle">
                          {[e.primaryGroups.join(', '), e.equipment.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
