import { X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Bottom sheet on mobile, centered panel on desktop.
 * Drag the grabber/header down to dismiss. Escape closes.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'auto',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'auto' | 'tall'
}) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const [drag, setDrag] = useState(0)
  const startY = useRef<number | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const t = setTimeout(() => setMounted(false), 260)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!mounted || typeof document === 'undefined') return null

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current === null) return
    setDrag(Math.max(0, e.clientY - startY.current))
  }
  const onPointerUp = () => {
    if (startY.current === null) return
    startY.current = null
    if (drag > 90) onClose()
    setDrag(0)
  }

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/70 backdrop-blur-[2px] transition-opacity duration-250 ${visible ? 'opacity-100' : 'opacity-0'}`}
      />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center md:items-center md:p-6">
        <div
          ref={panel}
          style={{
            transform: visible ? `translateY(${drag}px)` : 'translateY(100%)',
            transition: startY.current !== null ? 'none' : 'transform 300ms cubic-bezier(0.22,1,0.36,1), opacity 200ms',
          }}
          className={`pointer-events-auto flex w-full max-w-[560px] flex-col rounded-t-[28px] border border-b-0 border-line bg-[#0c0c0d] pb-[var(--safe-bottom)] shadow-[0_-20px_80px_-20px_#000] md:rounded-[28px] md:border-b md:pb-0 ${
            size === 'tall' ? 'h-[92dvh] md:h-[80dvh]' : 'max-h-[92dvh] md:max-h-[80dvh]'
          } ${visible ? 'md:opacity-100' : 'md:opacity-0'}`}
        >
          <div
            className="shrink-0 cursor-grab touch-none select-none px-5 pt-2.5 active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="mx-auto h-[5px] w-10 rounded-full bg-line-strong md:hidden" />
            {title !== undefined && (
              <div className="flex min-h-12 items-center justify-between gap-3 pt-2">
                <div className="min-w-0 flex-1 t-title">{title}</div>
                <button onClick={onClose} className="icon-btn -mr-2 size-10" aria-label="Close" onPointerDown={(e) => e.stopPropagation()}>
                  <X className="size-5" />
                </button>
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
          {footer && <div className="shrink-0 border-t border-line px-5 py-4">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** A list of large tappable actions for sheets. */
export function SheetAction({
  icon,
  label,
  hint,
  onClick,
  tone = 'default',
}: {
  icon: ReactNode
  label: string
  hint?: string
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      className={`press flex min-h-14 w-full items-center gap-4 rounded-2xl px-3 text-left hover:bg-raised ${tone === 'danger' ? 'text-danger' : ''}`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${tone === 'danger' ? 'bg-danger/10' : 'bg-raised text-muted'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-[560]">{label}</span>
        {hint && <span className="block text-[13px] text-subtle">{hint}</span>}
      </span>
    </button>
  )
}
