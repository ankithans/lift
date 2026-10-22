import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Trophy } from 'lucide-react'

type Toast = { id: number; text: string; tone: 'default' | 'pr' | 'error'; action?: { label: string; run: () => void } }

let toasts: Toast[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
let nextId = 1

export function toast(text: string, opts: { tone?: Toast['tone']; action?: Toast['action']; ms?: number } = {}) {
  const t: Toast = { id: nextId++, text, tone: opts.tone ?? 'default', action: opts.action }
  toasts = [...toasts.slice(-2), t]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    emit()
  }, opts.ms ?? 3200)
}

export function Toaster() {
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
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+var(--toast-top,10px))] z-[80] flex flex-col items-center gap-2 px-4">
      {list.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex min-h-11 max-w-[420px] items-center gap-3 rounded-full border px-4 py-2 text-[14px] font-[580] shadow-[0_12px_40px_-8px_#000] backdrop-blur-xl animate-[rise_240ms_cubic-bezier(0.22,1,0.36,1)_both] ${
            t.tone === 'pr' ? 'border-pr/30 bg-[#1a160b]/95 text-pr' : t.tone === 'error' ? 'border-danger/30 bg-[#1c0d0d]/95 text-danger' : 'border-line-strong bg-raised/95 text-ink'
          }`}
        >
          {t.tone === 'pr' && <Trophy className="size-4 shrink-0" aria-hidden />}
          <span className="min-w-0">
            {t.text}
            {t.action && <span className="sr-only">, </span>}
          </span>
          {t.action && (
            <button
              className="-my-2 min-h-11 shrink-0 font-[650] text-accent"
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
