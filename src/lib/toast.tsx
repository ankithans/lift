import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Medal } from 'lucide-react'
import { overlayCount, subscribeOverlays } from './overlays'

type Toast = { id: number; text: string; tone: 'default' | 'pr' | 'error'; action?: { label: string; run: () => void } }

let toasts: Toast[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
let nextId = 1

export function toast(text: string, opts: { tone?: Toast['tone']; action?: Toast['action']; ms?: number } = {}) {
  const t: Toast = { id: nextId++, text, tone: opts.tone ?? 'default', action: opts.action }
  // One toast at a time: the latest outcome replaces the previous one.
  toasts = [t]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    emit()
  }, opts.ms ?? (opts.action ? 6000 : 3200))
}

export function Toaster() {
  // With a sheet or the keypad open, toasts move to the top so they never cover it.
  const overlays = useSyncExternalStore(subscribeOverlays, overlayCount, () => 0)
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => toasts,
    () => toasts,
  )
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[80] flex flex-col items-center gap-2 px-4"
      style={
        overlays > 0
          ? { top: 'calc(var(--safe-top) + 12px)' }
          : { bottom: 'calc(var(--safe-bottom) + var(--toast-bottom, calc(var(--tabbar-h, 64px) + var(--dock, 0px) + 12px)))' }
      }
    >
      {list.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex min-h-14 w-full max-w-[420px] items-center gap-3 rounded-2xl border bg-raised px-4 py-2 text-[14px] font-[450] leading-5 animate-[rise_220ms_cubic-bezier(0.22,1,0.36,1)_both] ${
            t.tone === 'error' ? 'border-danger/40 text-danger' : 'border-line-strong text-ink'
          }`}
        >
          {t.tone === 'pr' && <Medal className="size-4 shrink-0 text-pr" aria-hidden />}
          <span className="min-w-0 flex-1">
            {t.text}
            {t.action && <span className="sr-only">, </span>}
          </span>
          {t.action && (
            <button
              className="-my-2 -mr-2 min-h-12 shrink-0 px-2 font-[600] text-accent"
              onClick={() => {
                t.action?.run()
                toasts = toasts.filter((x) => x.id !== t.id)
                emit()
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body,
  )
}
