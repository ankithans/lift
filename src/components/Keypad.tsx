import { Check, ChevronDown, Delete, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { announce } from '#/lib/announce'
import { openOverlay } from '#/lib/overlays'
import { tap } from '#/lib/haptics'

export type KeypadField = 'weight' | 'reps' | 'rir' | 'duration'

export type KeypadTab = { field: KeypadField; label: string; value: string }

const RIR_OPTIONS = [
  { v: 0, label: '0' },
  { v: 1, label: '1' },
  { v: 2, label: '2' },
  { v: 3, label: '3' },
  { v: 4, label: '4' },
  { v: 5, label: '5+' },
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
  accessory,
  target,
  warning,
  focusKey,
  quiet,
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
  /** Optional slot in the header row (e.g. the rest countdown). */
  accessory?: ReactNode
  /** Rep target; the chip turns mint while the typed reps are inside it. */
  target?: { low: number; high: number } | null
  /** Shown when the value looks like a typo; the next confirm keeps it anyway. */
  warning?: string | null
  /** Changes when the keypad moves to another set, so focus re-enters the active tab. */
  focusKey?: string
  /** Skip the field announcement (the caller already said something more useful). */
  quiet?: boolean
}) {
  const decimal = field === 'weight'
  const activeTab = useRef<HTMLButtonElement>(null)
  const active = tabs.find((t) => t.field === field)

  // Move focus into the keypad when it opens or the field changes, and say so.
  useEffect(() => {
    activeTab.current?.focus({ preventScroll: true })
    if (!quiet) announce(`${active?.label ?? ''} ${value || 'empty'}. Type a number, then Next.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, focusKey])

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

  // Back button closes the keypad (saving the draft) instead of leaving the workout.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => openOverlay(() => closeRef.current(), 'keypad'), [])

  // Keys are handled only while focus is inside the keypad (focus moves there on open).
  const onKeyDown = (e: ReactKeyboardEvent) => {
    {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      // Enter/Space on a focused key/button performs that button's own action.
      if ((e.key === 'Enter' || e.key === ' ') && t?.tagName === 'BUTTON' && !t.dataset.tab) return
      if (/^[0-9]$/.test(e.key)) {
        if (field === 'rir') onInput(String(Math.min(5, Number(e.key))), true)
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
  }

  const key = 'press grid h-[54px] place-items-center rounded-[14px] bg-raised text-[22px] font-[560] active:bg-pressed num'

  return (
    <section role="region" aria-label={`Keypad, ${context}`} onKeyDown={onKeyDown} className="fixed inset-x-0 bottom-0 z-50 animate-[rise_220ms_cubic-bezier(0.22,1,0.36,1)_both]">
      <div className="mx-auto max-w-[640px] rounded-t-[26px] border border-b-0 border-line bg-[#0b0b0c]/95 px-3 pb-[calc(var(--safe-bottom)+10px)] pt-3 shadow-[0_-24px_60px_-12px_#000] backdrop-blur-xl lg:mb-4 lg:rounded-[26px] lg:border-b">
        <div className="flex items-center gap-2 px-1">
          <div className="flex min-w-0 flex-1 items-baseline gap-1.5 text-[13px] font-[550] text-muted">
            <span className="truncate">{context.split(' · ')[0]}</span>
            {context.includes(' · ') && <span className="num shrink-0 text-ink/80">{context.split(' · ').slice(1).join(' · ')}</span>}
          </div>
          {target && (target.low || target.high) ? (
            <span
              className={`num flex h-8 shrink-0 items-center rounded-full px-2.5 text-[12px] font-[650] transition-colors ${
                field === 'reps' && value && Number(value) >= target.low && Number(value) <= target.high
                  ? 'bg-accent-dim text-accent'
                  : field === 'reps' && value && Number(value) > target.high
                    ? 'bg-accent-dim text-accent'
                    : 'bg-surface text-muted'
              }`}
            >
              {target.low === target.high ? target.high : `${target.low}–${target.high}`}
              <span className="sr-only"> reps target</span>
              {field === 'reps' && value ? (
                <span className="sr-only">
                  {Number(value) < target.low ? ', below target' : Number(value) > target.high ? ', above target' : ', in target'}
                </span>
              ) : null}
            </span>
          ) : null}
          {accessory}
          <button onClick={onClose} className="icon-btn" aria-label="Close keypad">
            <ChevronDown className="size-5" />
          </button>
        </div>
        <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0,1fr))` }}>
          {tabs.map((t) => {
            const on = t.field === field
            return (
              <button
                key={t.field}
                ref={on ? activeTab : undefined}
                aria-pressed={on}
                data-tab="true"
                aria-label={`${t.label} ${(on ? value : t.value) || 'empty'}`}
                onClick={() => onField(t.field)}
                className={`press flex h-[58px] flex-col items-start justify-center rounded-[14px] px-3 text-left transition-colors ${
                  on ? 'bg-ink text-black' : 'bg-surface text-ink'
                }`}
              >
                <span className={`text-[11px] font-[650] uppercase tracking-[0.08em] ${on ? 'text-black/55' : 'text-subtle'}`}>{t.label}</span>
                <span className="num text-[22px] font-[650] leading-[26px] tracking-[-0.02em]">
                  {on ? (
                    <>
                      <span className={fresh && value ? 'rounded bg-black/10 px-0.5' : ''}>{value || <span className="text-black/55">{field === 'rir' ? '–' : '0'}</span>}</span>
                      <span aria-hidden className="ml-0.5 inline-block h-[20px] w-[2px] translate-y-[2px] animate-pulse bg-black/70" />
                    </>
                  ) : (
                    t.value || <span className="text-subtle">—</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {warning && (
          <p role="alert" className="mt-2 rounded-[12px] bg-warning/10 px-3 py-2 text-[13px] font-[560] text-warning">
            {warning}
          </p>
        )}
        {field === 'rir' ? (
          // Same footprint as the number pad, so switching fields never changes the keypad height.
          <div className="mt-2 grid h-[240px] grid-cols-3 grid-rows-[1fr_1fr_1.15fr] gap-2">
            <div role="radiogroup" aria-label="Reps in reserve" className="contents">
              {RIR_OPTIONS.map((o) => {
                const on = value === String(o.v)
                return (
                  <button
                    key={o.v}
                    role="radio"
                    aria-checked={on}
                    aria-label={o.v === 0 ? 'Zero reps left' : `${o.label} reps left`}
                    onClick={() => {
                      tap()
                      onInput(String(o.v), true)
                    }}
                    className={`press num grid place-items-center rounded-[14px] text-[22px] font-[600] transition-colors ${
                      on ? 'bg-accent text-accent-ink' : 'bg-raised'
                    }`}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => {
                onInput('', true)
                onDone()
              }}
              className="press rounded-[14px] bg-raised text-[15px] font-[600] text-muted"
            >
              Skip
            </button>
            <button onClick={onDone} className="press col-span-2 flex items-center justify-center gap-2 rounded-[14px] bg-ink text-[16px] font-[650] text-black">
              <Check aria-hidden className="size-5" strokeWidth={2.6} /> Log set
            </button>
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
            <button className={key} onClick={() => press('.')} aria-label="Decimal point" aria-disabled={!decimal} tabIndex={decimal ? undefined : -1}>
              <span aria-hidden className={decimal ? '' : 'opacity-0'}>.</span>
            </button>
            <button className={key} onClick={() => press('0')}>0</button>
            <button className={`${key} text-muted`} onClick={() => press('back')} aria-label="Delete">
              <Delete className="size-6" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
