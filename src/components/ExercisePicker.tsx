import { useQuery } from 'convex/react'
import { Check, Search, X } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { ExerciseThumb } from './ExerciseThumb'
import { Sheet } from './Sheet'
import { ListSkeleton } from './Skeletons'

export const GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Forearms', 'Traps', 'Cardio', 'Rehab', 'Warm-up']

export function MuscleChips({ value, onChange }: { value: string | null; onChange: (g: string | null) => void }) {
  return (
    <div role="group" aria-label="Filter by muscle" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-1">
      <button className="chip" data-on={value === null} aria-pressed={value === null} onClick={() => onChange(null)}>
        All
      </button>
      {GROUPS.map((g) => (
        <button key={g} className="chip" data-on={value === g} aria-pressed={value === g} onClick={() => onChange(value === g ? null : g)}>
          {g}
        </button>
      ))}
    </div>
  )
}

export type PickedExercise = { _id: Id<'exercises'>; name: string }

export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = 'Add exercise',
  multi = false,
}: {
  open: boolean
  onClose: () => void
  onPick: (picked: PickedExercise[]) => void
  title?: string
  multi?: boolean
}) {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [selected, setSelected] = useState<PickedExercise[]>([])
  const query = useDeferredValue(q)
  const results = useQuery(api.library.search, open ? { query: query || undefined, group: group ?? undefined, limit: 120 } : 'skip')

  const close = () => {
    setSelected([])
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={title}
      size="tall"
      footer={
        multi && selected.length > 0 ? (
          <button
            className="btn btn-primary w-full"
            onClick={() => {
              onPick(selected)
              setSelected([])
            }}
          >
            Add {selected.length} exercise{selected.length > 1 ? 's' : ''}
          </button>
        ) : undefined
      }
    >
      <div className="sticky top-0 z-10 -mx-5 bg-[#0c0c0d] px-5 pb-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-subtle" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 326 exercises"
            aria-label="Search exercises"
            className="field pl-11 pr-10"
            autoComplete="off"
            enterKeyHint="search"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle" aria-label="Clear">
              <X className="size-[18px]" />
            </button>
          )}
        </label>
        <div className="mt-3">
          <MuscleChips value={group} onChange={setGroup} />
        </div>
      </div>
      {results === undefined ? (
        <div className="pt-4">
          <ListSkeleton rows={8} />
        </div>
      ) : results.length === 0 ? (
        <p className="py-12 text-center text-muted">No matches. Try another name.</p>
      ) : (
        <ul className="pt-1">
          {results.map((e) => {
            const on = selected.some((s) => s._id === e._id)
            return (
              <li key={e._id}>
                <button
                  aria-pressed={multi ? on : undefined}
                  className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-raised"
                  onClick={() => {
                    const item = { _id: e._id, name: e.name }
                    if (!multi) {
                      onPick([item])
                      return
                    }
                    setSelected(on ? selected.filter((s) => s._id !== e._id) : [...selected, item])
                  }}
                >
                  <ExerciseThumb src={e.thumbnailUrl} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-[560]">{e.name}</span>
                    <span className="block truncate text-[13px] text-subtle">
                      {[e.primaryGroups.join(', '), e.equipment[0]].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {multi && (
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full border transition-colors ${
                        on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong'
                      }`}
                    >
                      {on && <Check className="size-4" strokeWidth={3} />}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
