import { useMutation, useQuery } from 'convex/react'
import { Check, Loader2, Plus, Search, X } from 'lucide-react'
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
  const [creating, setCreating] = useState(false)
  const query = useDeferredValue(q)
  const results = useQuery(api.library.search, open ? { query: query || undefined, group: group ?? undefined, limit: 120 } : 'skip')

  const close = () => {
    setSelected([])
    setCreating(false)
    onClose()
  }

  if (creating) {
    return (
      <Sheet open={open} onClose={close} title="New exercise">
        <CreateExercise
          initialName={q.trim()}
          onCancel={() => setCreating(false)}
          onCreated={(item) => {
            setCreating(false)
            if (multi) setSelected([...selected, item])
            else onPick([item])
          }}
        />
      </Sheet>
    )
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
        <div className="py-10 text-center">
          <p className="text-muted">No exercise called “{q}”.</p>
          <button className="btn btn-secondary mt-4" onClick={() => setCreating(true)}>
            <Plus className="size-5" /> Create “{q.trim()}”
          </button>
        </div>
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
          {q.trim() && (
            <li>
              <button onClick={() => setCreating(true)} className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left text-accent hover:bg-raised">
                <span className="grid size-11 place-items-center rounded-[12px] bg-accent-dim">
                  <Plus aria-hidden className="size-5" />
                </span>
                <span className="text-[15px] font-[600]">Create “{q.trim()}”</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </Sheet>
  )
}

const TRACKING = [
  { value: 'weight_reps', label: 'Weight × reps' },
  { value: 'reps', label: 'Bodyweight reps' },
  { value: 'weighted_bodyweight', label: 'Bodyweight + load' },
  { value: 'duration', label: 'Time' },
] as const

function CreateExercise({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string
  onCancel: () => void
  onCreated: (item: PickedExercise) => void
}) {
  const create = useMutation(api.library.create)
  const [name, setName] = useState(initialName)
  const [groups, setGroups] = useState<string[]>([])
  const [tracking, setTracking] = useState<(typeof TRACKING)[number]['value']>('weight_reps')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="space-y-5 pb-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        setBusy(true)
        try {
          const id = await create({ name: name.trim(), primaryGroups: groups, tracking })
          onCreated({ _id: id, name: name.trim() })
        } finally {
          setBusy(false)
        }
      }}
    >
      <div>
        <label htmlFor="new-exercise-name" className="text-[14px] text-muted">Name</label>
        <input id="new-exercise-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} className="field mt-2" maxLength={80} />
      </div>
      <fieldset>
        <legend className="text-[14px] text-muted">Main muscles</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {GROUPS.filter((g) => !['Cardio', 'Rehab', 'Warm-up'].includes(g)).map((g) => {
            const on = groups.includes(g)
            return (
              <button
                type="button"
                key={g}
                className="chip"
                data-on={on}
                aria-pressed={on}
                onClick={() => setGroups(on ? groups.filter((x) => x !== g) : [...groups, g])}
              >
                {g}
              </button>
            )
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend id="tracking-legend" className="text-[14px] text-muted">How you log it</legend>
        <div role="radiogroup" aria-labelledby="tracking-legend" className="mt-2 grid grid-cols-2 gap-2">
          {TRACKING.map((t) => (
            <button
              type="button"
              key={t.value}
              role="radio"
              aria-checked={tracking === t.value}
              onClick={() => setTracking(t.value)}
              className={`press h-12 rounded-[14px] text-[14px] font-[600] ${tracking === t.value ? 'bg-ink text-black' : 'bg-raised text-muted'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Back</button>
        <button className="btn btn-primary" disabled={busy || !name.trim()}>
          {busy && <Loader2 className="size-5 animate-spin" />} Create
        </button>
      </div>
    </form>
  )
}
