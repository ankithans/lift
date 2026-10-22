import { Check, ChevronDown, Delete, Minus, Plus } from 'lucide-react'
import { useEffect } from 'react'
import { tap } from '#/lib/haptics'

export type KeypadField = 'weight' | 'reps' | 'rir' | 'duration'

export type KeypadTab = { field: KeypadField; label: string; value: string }

const RIR_OPTIONS = [
  { v: 0, label: 'Failure', hint: 'nothing left' },
  { v: 1, label: '1', hint: 'one more' },
  { v: 2, label: '2', hint: 'two more' },
  { v: 3, label: '3', hint: 'three more' },
  { v: 4, label: '4+', hint: 'easy' },
]

/**
 * Custom numeric keypad for one-handed, sweaty-handed logging.
 * Stateless: the parent owns the draft string and field order.
 */
export function Keypad({
  context,
  tabs,
  field,
  value,
  fresh,
  onInput,
  onField,
  onNext,
  onDone,
  onClose,
  step,
  nextLabel,
}: {
  context: string
  tabs: KeypadTab[]
  field: KeypadField
  value: string
  /** When true, the next digit replaces the value instead of appending. */
  fresh: boolean
  onInput: (value: string, fresh: boolean) => void
  onField: (field: KeypadField) => void
  onNext: () => void
  onDone: () => void
  onClose: () => void
  step: number
  nextLabel: string
}) {
  const decimal = field === 'weight'

  const press = (key: string) => {
    tap()
    if (key === 'back') {
      onInput(fresh ? '' : value.slice(0, -1), false)
      return
    }
    if (key === '.') {
      if (!decimal) return
      const base = fresh ? '0' : value || '0'
      if (base.includes('.')) return
      onInput(`${base}.`, false)
      return
    }
    const base = fresh ? '' : value
    if (base.replace('.', '').length >= 6) return
    const next = base === '0' ? key : base + key
    if (decimal && next.includes('.') && next.split('.')[1].length > 2) return
    onInput(next, false)
  }

  const bump = (dir: 1 | -1) => {
    tap()
    const n = Number.parseFloat(value || '0') || 0
    const next = Math.max(0, Math.round((n + dir * step) * 100) / 100)
    onInput(String(next), true)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) {
        if (field === 'rir') onInput(String(Math.min(4, Number(e.key))), true)
        else press(e.key)
      } else if (e.key === '.' || e.key === ',') press('.')
      else if (e.key === 'Backspace') press('back')
      else if (e.key === 'Enter') (e.shiftKey ? onDone : onNext)()
      else if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowUp') bump(1)
      else if (e.key === 'ArrowDown') bump(-1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const key = 'press grid h-[54px] place-items-center rounded-[14px] bg-raised text-[22px] font-[560] active:bg-pressed num'

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-[rise_220ms_cubic-bezier(0.22,1,0.36,1)_both]">
      <div className="mx-auto max-w-[640px] rounded-t-[26px] border border-b-0 border-line bg-[#0b0b0c]/95 px-3 pb-[calc(var(--safe-bottom)+10px)] pt-3 shadow-[0_-24px_60px_-12px_#000] backdrop-blur-xl lg:mb-4 lg:rounded-[26px] lg:border-b">
        <div className="flex items-center gap-2 px-1">
          <div className="min-w-0 flex-1 truncate text-[13px] font-[550] text-subtle">{context}</div>
          <button onClick={onClose} className="icon-btn size-9" aria-label="Close keypad">
            <ChevronDown className="size-5" />
          </button>
        </div>
        <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }}>
          {tabs.map((t) => {
            const on = t.field === field
            return (
              <button
                key={t.field}
                onClick={() => onField(t.field)}
                className={`press flex h-[58px] flex-col items-start justify-center rounded-[14px] px-3 text-left transition-colors ${
                  on ? 'bg-ink text-black' : 'bg-surface text-ink'
                }`}
              >
                <span className={`text-[11px] font-[650] uppercase tracking-[0.08em] ${on ? 'text-black/55' : 'text-subtle'}`}>{t.label}</span>
                <span className="num text-[22px] font-[650] leading-[26px] tracking-[-0.02em]">
                  {on ? (
                    <>
                      <span className={fresh && value ? 'rounded bg-black/10 px-0.5' : ''}>{value || <span className="text-black/30">0</span>}</span>
                      <span className="ml-0.5 inline-block h-[20px] w-[2px] translate-y-[2px] animate-pulse bg-black/70" />
                    </>
                  ) : (
                    t.value || <span className="text-faint">—</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {field === 'rir' ? (
          <div className="mt-2">
            <div className="grid grid-cols-5 gap-2">
              {RIR_OPTIONS.map((o) => {
                const on = value === String(o.v)
                return (
                  <button
                    key={o.v}
                    onClick={() => {
                      tap()
                      onInput(String(o.v), true)
                    }}
                    className={`press flex h-[64px] flex-col items-center justify-center rounded-[14px] transition-colors ${
                      on ? 'bg-accent text-accent-ink' : 'bg-raised'
                    }`}
                  >
                    <span className="num text-[18px] font-[650]">{o.label}</span>
                    <span className={`text-[10.5px] font-[550] ${on ? 'text-accent-ink/70' : 'text-subtle'}`}>{o.hint}</span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 px-1 text-[12px] leading-4 text-subtle">Reps in reserve — how many more you could have done. Optional.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={() => { onInput('', true); onDone() }} className="press h-[54px] rounded-[14px] bg-raised text-[16px] font-[600] text-muted">
                Skip
              </button>
              <button onClick={onDone} className="press flex h-[54px] items-center justify-center gap-2 rounded-[14px] bg-accent text-[16px] font-[650] text-accent-ink">
                <Check className="size-5" strokeWidth={2.6} /> Log set
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 grid grid-cols-4 gap-2">
            {['1', '2', '3'].map((k) => (
              <button key={k} className={key} onClick={() => press(k)}>{k}</button>
            ))}
            <button className={`${key} text-muted`} onClick={() => bump(-1)} aria-label={`Minus ${step}`}>
              <span className="flex items-center gap-0.5 text-[15px]"><Minus className="size-4" />{step}</span>
            </button>
            {['4', '5', '6'].map((k) => (
              <button key={k} className={key} onClick={() => press(k)}>{k}</button>
            ))}
            <button className={`${key} text-muted`} onClick={() => bump(1)} aria-label={`Plus ${step}`}>
              <span className="flex items-center gap-0.5 text-[15px]"><Plus className="size-4" />{step}</span>
            </button>
            {['7', '8', '9'].map((k) => (
              <button key={k} className={key} onClick={() => press(k)}>{k}</button>
            ))}
            <button onClick={onNext} className="press row-span-2 flex flex-col items-center justify-center gap-1 rounded-[14px] bg-ink text-[15px] font-[650] text-black">
              {nextLabel === 'Log set' ? <Check className="size-6" strokeWidth={2.6} /> : null}
              {nextLabel}
            </button>
            <button className={`${key} ${decimal ? '' : 'text-faint'}`} onClick={() => press('.')} disabled={!decimal}>
              {decimal ? '.' : ''}
            </button>
            <button className={key} onClick={() => press('0')}>0</button>
            <button className={`${key} text-muted`} onClick={() => press('back')} aria-label="Delete">
              <Delete className="size-6" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
