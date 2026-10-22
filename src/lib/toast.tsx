import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Trophy } from 'lucide-react'

type Toast = { id: number; text: string; tone: 'default' | 'pr'; action?: { label: string; run: () => void } }

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
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+10px)] z-[80] flex flex-col items-center gap-2 px-4">
      {list.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex min-h-11 max-w-[420px] items-center gap-3 rounded-full border px-4 py-2 text-[14px] font-[580] shadow-[0_12px_40px_-8px_#000] backdrop-blur-xl animate-[rise_240ms_cubic-bezier(0.22,1,0.36,1)_both] ${
            t.tone === 'pr' ? 'border-pr/30 bg-[#1a160b]/95 text-pr' : 'border-line-strong bg-raised/95 text-ink'
          }`}
        >
          {t.tone === 'pr' && <Trophy className="size-4 shrink-0" />}
          <span className="min-w-0">{t.text}</span>
          {t.action && (
            <button
              className="shrink-0 font-[650] text-accent"
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
