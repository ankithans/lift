import { Link, useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar } from './Avatar'

/**
 * Screen header: a large title row plus a 56px bar whose compact title fades in
 * once the large title scrolls away. Root tabs show the avatar; pushed screens a back button.
 */
export function PageHeader({
  title,
  eyebrow,
  subtitle,
  back,
  action,
  compactTitle,
  size = 'large',
}: {
  title: ReactNode
  eyebrow?: ReactNode
  subtitle?: ReactNode
  back?: boolean | string
  action?: ReactNode
  /** Text for the collapsed bar (defaults to `title` when it is a string). */
  compactTitle?: string
  size?: 'large' | 'medium'
}) {
  const router = useRouter()
  const sentinel = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setCollapsed(!e.isIntersecting), { rootMargin: '-56px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const compact = compactTitle ?? (typeof title === 'string' ? title : '')

  return (
    <header className="mb-7">
      <div
        className={`sticky top-0 z-30 -mx-5 flex h-14 items-center gap-1 px-3 pt-[var(--safe-top)] transition-colors duration-150 lg:-mx-8 lg:px-6 ${
          collapsed ? 'border-b border-line bg-black' : 'border-b border-transparent bg-black'
        }`}
        style={{ boxSizing: 'content-box' }}
      >
        {back ? (
          <button
            onClick={() => (typeof back === 'string' ? router.navigate({ to: back }) : router.history.back())}
            className="icon-btn size-12"
            aria-label="Back"
          >
            <ChevronLeft className="size-6" strokeWidth={1.9} />
          </button>
        ) : (
          <span className="w-2" />
        )}
        <div
          aria-hidden={!collapsed}
          className={`min-w-0 flex-1 truncate text-[17px] font-[600] tracking-[-0.01em] transition-opacity duration-150 ${collapsed ? 'opacity-100' : 'opacity-0'}`}
        >
          {compact}
        </div>
        <div className="flex items-center">
          {action}
          {!back && (
            <Link to="/settings" className="press grid size-12 place-items-center rounded-full lg:hidden" aria-label="Settings">
              <Avatar size={32} />
            </Link>
          )}
        </div>
      </div>
      <div className="mt-1">
        {eyebrow && <div className="text-[13px] leading-[18px] text-muted">{eyebrow}</div>}
        <h1 className={`${size === 'large' ? 'text-[32px] leading-[36px]' : 'text-[28px] leading-[34px]'} font-[650] tracking-[-0.03em] ${eyebrow ? 'mt-1' : ''}`}>
          {title}
        </h1>
        {subtitle && <div className="mt-2 text-[14px] leading-5 text-muted">{subtitle}</div>}
        <div ref={sentinel} aria-hidden className="h-px" />
      </div>
    </header>
  )
}
