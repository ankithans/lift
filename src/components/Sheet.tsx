import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { openOverlay } from '#/lib/overlays'

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
  className = '',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'auto' | 'tall'
  className?: string
}) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const [drag, setDrag] = useState(0)
  const startY = useRef<number | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const returnFocus = useRef<HTMLElement | null>(null)

  // Dialog behaviour: focus moves in, background is inert, focus returns on close.
  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement as HTMLElement | null
    const root = document.getElementById('app-root')
    root?.setAttribute('inert', '')
    return () => {
      // Only release if no other sheet is still open.
      if (document.querySelectorAll('[data-sheet-open]').length === 0) root?.removeAttribute('inert')
      const target = returnFocus.current
      if (target && document.contains(target)) requestAnimationFrame(() => target.focus({ preventScroll: true }))
    }
  }, [open])

  // Move focus in once the panel actually exists (it mounts a frame after `open`).
  useEffect(() => {
    if (!open || !mounted) return
    const id = requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>('[autofocus], input, textarea, [data-autofocus]')
      ;(first ?? panel.current)?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [open, mounted])

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

  // Move focus in once the panel actually exists (it mounts a frame after `open`).
  useEffect(() => {
    if (!open || !mounted) return
    const id = requestAnimationFrame(() => {
      const first = panel.current?.querySelector<HTMLElement>('[autofocus], input, textarea, [data-autofocus]')
      ;(first ?? panel.current)?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [open, mounted])

  // Back button / gesture closes the sheet instead of leaving the page.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    return openOverlay(() => closeRef.current())
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
    <div
      className={`pointer-events-none fixed inset-0 z-[60] ${className}`}
      role="dialog"
      aria-modal="true"
      data-sheet-open={open ? '' : undefined}
      {...(typeof title === 'string' || typeof title === 'number' ? { 'aria-labelledby': titleId } : { 'aria-label': 'Dialog' })}
    >
      <div
        onClick={onClose}
        style={{ top: 'var(--music-video-space, 0px)' }}
        className={`pointer-events-auto absolute inset-0 bg-black/55 transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}
      />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center md:items-center md:p-6">
        <div
          ref={panel}
          tabIndex={-1}
          style={{
            maxHeight: 'min(92dvh, calc(100dvh - var(--music-video-space, 0px) - var(--safe-top)))',
            transform: visible ? `translateY(${drag}px)` : 'translateY(100%)',
            transition: startY.current !== null ? 'none' : `transform ${visible ? 240 : 180}ms cubic-bezier(0.22,1,0.36,1), opacity 160ms`,
          }}
          className={`pointer-events-auto flex w-full max-w-[560px] flex-col rounded-t-[28px] border border-b-0 border-[#303030] bg-surface pb-[var(--safe-bottom)] md:rounded-[28px] md:border-b md:pb-0 ${
            size === 'tall' ? 'h-[92dvh] md:h-[80dvh]' : 'max-h-[92dvh] md:max-h-[80dvh]'
          } ${visible ? 'md:opacity-100' : 'md:opacity-0'} outline-none`}
        >
          <div
            className="shrink-0 cursor-grab touch-none select-none px-5 pt-3 active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div aria-hidden className="mx-auto h-1 w-9 rounded-full bg-[#666] md:hidden" />
            {title !== undefined && (
              <div className="flex min-h-12 items-center justify-between gap-3 pt-3">
                <h2 id={titleId} className="line-clamp-2 min-w-0 flex-1 text-[18px] font-[600] leading-6 tracking-[-0.01em]">{title}</h2>
                <button onClick={onClose} className="icon-btn -mr-2" aria-label="Close" onPointerDown={(e) => e.stopPropagation()}>
                  <X className="size-5" />
                </button>
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-3">{children}</div>
          {footer && <div className="shrink-0 border-t border-line px-5 py-4">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** One 56px action row: icon straight on the surface, label, optional value on the right. */
export function SheetAction({
  icon,
  label,
  hint,
  value,
  onClick,
  tone = 'default',
}: {
  icon: ReactNode
  label: string
  /** Only for a real consequence; most rows need none. */
  hint?: string
  value?: ReactNode
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      className={`press -mx-2 flex min-h-14 w-[calc(100%+16px)] items-center gap-4 rounded-2xl px-2 text-left hover:bg-raised ${tone === 'danger' ? 'text-danger' : ''}`}
    >
      <span aria-hidden className={`grid size-5 shrink-0 place-items-center ${tone === 'danger' ? '' : 'text-muted'}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-[500] leading-[22px]">{label}</span>
        {hint && <span className="block text-[13px] text-muted">{hint}</span>}
      </span>
      {value !== undefined && <span className="num shrink-0 text-[14px] text-muted">{value}</span>}
    </button>
  )
}

/** Hairline + gap that separates destructive actions from routine ones. */
export function SheetDivider() {
  return <div aria-hidden className="my-2 h-px bg-line" />
}
