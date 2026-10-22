import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { ArrowDown, ArrowUp, ChevronDown, Link2, Link2Off, Minus, MoreHorizontal, Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { ExercisePicker } from '#/components/ExercisePicker'
import { ExerciseThumb } from '#/components/ExerciseThumb'
import { PageHeader } from '#/components/PageHeader'
import { Sheet, SheetAction } from '#/components/Sheet'
import { BlockSkeleton } from '#/components/Skeletons'
import { fmtClock, WEEKDAYS, WEEKDAYS_LONG } from '#/lib/format'
import { toast } from '#/lib/toast'

export const Route = createFileRoute('/_app/program')({
  head: () => ({ meta: [{ title: 'Program · Lift' }] }),
  validateSearch: (s: Record<string, unknown>): { day?: string } => (typeof s.day === 'string' ? { day: s.day } : {}),
  component: ProgramEditor,
})

type Program = NonNullable<FunctionReturnType<typeof api.programs.active>>
type Day = Program['days'][number]
type Slot = Day['exercises'][number]

function ProgramEditor() {
  const { day: focus } = Route.useSearch()
  const program = useQuery(api.programs.active)
  const [open, setOpen] = useState<string | null>(focus ?? null)
  const [slotMenu, setSlotMenu] = useState<{ slot: Slot; day: Day; index: number } | null>(null)
  const [dayMenu, setDayMenu] = useState<Day | null>(null)
  const [adding, setAdding] = useState<Day | null>(null)
  const [swapping, setSwapping] = useState<Slot | null>(null)
  const [renaming, setRenaming] = useState(false)
  const addExercise = useMutation(api.programs.addExercise)
  const swap = useMutation(api.programs.swapExercise)

  if (program === undefined) {
    return (
      <main className="page space-y-3 pt-24">
        {[0, 1, 2, 3].map((i) => <BlockSkeleton key={i} h={64} />)}
      </main>
    )
  }
  if (program === null) return null

  const days = [...program.days].sort((a, b) => (a.weekday ?? 9) - (b.weekday ?? 9))

  return (
    <main className="page">
      <PageHeader
        back
        eyebrow="Program"
        title={program.name}
        action={
          <button className="icon-btn" aria-label="Rename program" onClick={() => setRenaming(true)}>
            <Pencil className="size-[18px]" />
          </button>
        }
      />
      <p className="-mt-3 text-[15px] text-muted">{program.days.filter((d) => d.kind === 'workout').length} training days. Changes apply to future workouts.</p>

      <div className="mt-6 space-y-2">
        {days.map((d) => {
          const expanded = open === d._id
          return (
            <section key={d._id} className={`card overflow-hidden transition-colors ${expanded ? '' : 'hover:bg-raised/50'}`}>
              <div className="flex items-center">
                <button onClick={() => setOpen(expanded ? null : d._id)} className="flex min-h-16 flex-1 items-center gap-4 pl-4 text-left">
                  <span className="w-9 text-[13px] font-[650] text-subtle">{d.weekday !== undefined ? WEEKDAYS[d.weekday] : '—'}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[16px] font-[600] ${d.kind === 'rest' ? 'text-subtle' : ''}`}>{d.kind === 'rest' ? 'Rest' : d.title}</span>
                    {d.kind === 'workout' && <span className="num block text-[13px] text-subtle">{d.exercises.length} exercises · ~{d.estimatedMinutes} min</span>}
                  </span>
                  <ChevronDown className={`size-5 text-subtle transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                </button>
                <button className="icon-btn mr-2" onClick={() => setDayMenu(d)} aria-label="Day options">
                  <MoreHorizontal className="size-5" />
                </button>
              </div>
              {expanded && (
                <div className="border-t border-line px-2 pb-2 animate-fade">
                  {d.exercises.map((s, i) => {
                    const prev = d.exercises[i - 1]
                    const next = d.exercises[i + 1]
                    const inGroup = Boolean(s.group && (prev?.group === s.group || next?.group === s.group))
                    return (
                      <button
                        key={s._id}
                        onClick={() => setSlotMenu({ slot: s, day: d, index: i })}
                        className={`press flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-raised ${inGroup ? 'border-l-2 border-accent/30' : ''}`}
                      >
                        <ExerciseThumb src={s.exercise.thumbnailUrl} size={42} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-[560]">{s.exercise.name}</span>
                          <span className="num block text-[13px] text-subtle">
                            {s.sets} × {s.repLow === s.repHigh ? s.repHigh : `${s.repLow}–${s.repHigh}`} · rest {fmtClock(s.restSec)}
                            {inGroup && <span className="text-accent/80"> · superset</span>}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                  <button onClick={() => setAdding(d)} className="press mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-[600] text-accent hover:bg-raised">
                    <Plus className="size-5" /> Add exercise
                  </button>
                </div>
              )}
            </section>
          )
        })}
      </div>

      <Sheet open={slotMenu !== null} onClose={() => setSlotMenu(null)} title={slotMenu?.slot.exercise.name}>
        {slotMenu && <SlotEditor key={slotMenu.slot._id} {...slotMenu} close={() => setSlotMenu(null)} onSwap={() => { setSwapping(slotMenu.slot); setSlotMenu(null) }} />}
      </Sheet>

      <Sheet open={renaming} onClose={() => setRenaming(false)} title="Rename program">
        {renaming && <RenameProgram name={program.name} close={() => setRenaming(false)} />}
      </Sheet>

      <Sheet open={dayMenu !== null} onClose={() => setDayMenu(null)} title={dayMenu ? (dayMenu.weekday !== undefined ? WEEKDAYS_LONG[dayMenu.weekday] : dayMenu.title) : ''}>
        {dayMenu && <DayEditor key={dayMenu._id} day={dayMenu} close={() => setDayMenu(null)} />}
      </Sheet>

      <ExercisePicker
        open={adding !== null}
        multi
        onClose={() => setAdding(null)}
        onPick={async (picked) => {
          const d = adding
          setAdding(null)
          if (!d) return
          for (const p of picked) await addExercise({ dayId: d._id, exerciseId: p._id })
          setOpen(d._id)
          toast(`Added ${picked.length} to ${d.title}`)
        }}
      />
      <ExercisePicker
        open={swapping !== null}
        title="Replace with"
        onClose={() => setSwapping(null)}
        onPick={async ([p]) => {
          const s = swapping
          setSwapping(null)
          if (!s || !p) return
          await swap({ slotId: s._id, exerciseId: p._id })
          toast(`Swapped to ${p.name}`)
        }}
      />
    </main>
  )
}

function Stepper({ label, value, onChange, min = 0, max = 50, format = String }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; format?: (n: number) => string }) {
  return (
    <div className="flex items-center justify-between rounded-[16px] bg-raised px-4 py-2">
      <span className="text-[15px] font-[560] text-muted">{label}</span>
      <div className="flex items-center gap-1">
        <button className="icon-btn size-10" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Decrease ${label}`}><Minus className="size-4" /></button>
        <span className="num w-12 text-center text-[19px] font-[650]">{format(value)}</span>
        <button className="icon-btn size-10" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`Increase ${label}`}><Plus className="size-4" /></button>
      </div>
    </div>
  )
}

function SlotEditor({ slot, day, index, close, onSwap }: { slot: Slot; day: Day; index: number; close: () => void; onSwap: () => void }) {
  const update = useMutation(api.programs.updateExercise)
  const remove = useMutation(api.programs.removeExercise)
  const move = useMutation(api.programs.moveExercise)
  const [v, setV] = useState({ sets: slot.sets, repLow: slot.repLow, repHigh: slot.repHigh, restSec: slot.restSec })
  const save = (patch: Partial<typeof v>) => {
    const next = { ...v, ...patch }
    if (next.repHigh < next.repLow) next.repHigh = next.repLow
    setV(next)
    void update({ slotId: slot._id, ...next })
  }
  const next = day.exercises[index + 1]
  const grouped = Boolean(slot.group && day.exercises.filter((x) => x.group === slot.group).length > 1)
  return (
    <div className="space-y-2 pb-2">
      <Stepper label="Sets" value={v.sets} min={1} max={10} onChange={(sets) => save({ sets })} />
      <Stepper label="Reps from" value={v.repLow} min={0} max={50} onChange={(repLow) => save({ repLow })} />
      <Stepper label="Reps to" value={v.repHigh} min={0} max={60} onChange={(repHigh) => save({ repHigh })} />
      <div className="rounded-[16px] bg-raised p-3">
        <div className="px-1 text-[15px] font-[560] text-muted">Rest</div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {[30, 60, 90, 120, 180].map((s) => (
            <button key={s} onClick={() => save({ restSec: s })} className={`press num h-10 rounded-[12px] text-[14px] font-[600] ${v.restSec === s ? 'bg-ink text-black' : 'bg-pressed text-muted'}`}>
              {fmtClock(s)}
            </button>
          ))}
        </div>
      </div>
      <div className="pt-2">
        <SheetAction icon={<Repeat className="size-4" />} label="Replace exercise" onClick={onSwap} />
        {grouped ? (
          <SheetAction
            icon={<Link2Off className="size-4" />}
            label="Remove from superset"
            onClick={async () => {
              close()
              await update({ slotId: slot._id, group: null })
              const rest = day.exercises.filter((x) => x.group === slot.group && x._id !== slot._id)
              if (rest.length === 1) await update({ slotId: rest[0]._id, group: null })
            }}
          />
        ) : next ? (
          <SheetAction
            icon={<Link2 className="size-4" />}
            label="Superset with next"
            hint={next.exercise.name}
            onClick={async () => {
              close()
              const g = next.group ?? `ss-${Date.now().toString(36)}`
              await update({ slotId: slot._id, group: g })
              if (!next.group) await update({ slotId: next._id, group: g })
            }}
          />
        ) : null}
        {index > 0 && <SheetAction icon={<ArrowUp className="size-4" />} label="Move up" onClick={() => { close(); void move({ slotId: slot._id, position: index - 1 }) }} />}
        {index < day.exercises.length - 1 && <SheetAction icon={<ArrowDown className="size-4" />} label="Move down" onClick={() => { close(); void move({ slotId: slot._id, position: index + 1 }) }} />}
        <SheetAction icon={<Trash2 className="size-4" />} label="Remove from day" tone="danger" onClick={() => { close(); void remove({ slotId: slot._id }) }} />
      </div>
    </div>
  )
}

function DayEditor({ day, close }: { day: Day; close: () => void }) {
  const update = useMutation(api.programs.updateDay)
  const [title, setTitle] = useState(day.title)
  return (
    <div className="space-y-4 pb-2">
      <div role="radiogroup" aria-label="Day type" className="grid grid-cols-2 rounded-full bg-raised p-1">
        {(['workout', 'rest'] as const).map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={day.kind === k}
            onClick={() => update({ dayId: day._id as Id<'programDays'>, kind: k, ...(k === 'workout' && day.title === 'Rest' ? { title: 'Workout' } : {}) })}
            className={`press h-10 rounded-full text-[14px] font-[600] capitalize ${day.kind === k ? 'bg-ink text-black' : 'text-muted'}`}
          >
            {k === 'workout' ? 'Training day' : 'Rest day'}
          </button>
        ))}
      </div>
      {day.kind === 'workout' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void update({ dayId: day._id, title: title.trim() || day.title })
            close()
          }}
          className="flex gap-2"
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="field" placeholder="Name" />
          <button className="btn btn-primary btn-sm h-[52px]">Save</button>
        </form>
      )}
      <div>
        <div className="mb-2 text-[14px] text-muted">Day of the week</div>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((w, i) => (
            <button
              key={w}
              aria-pressed={day.weekday === i}
              aria-label={WEEKDAYS_LONG[i]}
              onClick={() => { void update({ dayId: day._id, weekday: i }); close() }}
              className={`press h-11 rounded-[12px] text-[13px] font-[650] ${day.weekday === i ? 'bg-ink text-black' : 'bg-raised text-muted'}`}
            >
              {w}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-subtle">Moving onto a taken day swaps the two.</p>
      </div>
    </div>
  )
}

function RenameProgram({ name, close }: { name: string; close: () => void }) {
  const rename = useMutation(api.programs.rename)
  const [value, setValue] = useState(name)
  return (
    <form
      className="flex gap-2 pb-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (value.trim()) await rename({ name: value.trim() })
        close()
      }}
    >
      <label htmlFor="program-name" className="sr-only">Program name</label>
      <input id="program-name" autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="field" maxLength={60} />
      <button className="btn btn-primary btn-sm h-[52px]">Save</button>
    </form>
  )
}
