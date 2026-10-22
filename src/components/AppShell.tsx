import { Link, useRouterState } from '@tanstack/react-router'
import { BookOpen, ChartNoAxesColumn, Dumbbell, History, type LucideIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { useMe } from '#/lib/me'
import { Logo } from './Logo'
import { Avatar } from './Avatar'
import { WorkoutBar } from './WorkoutBar'

const TABS: { to: '/' | '/library' | '/progress' | '/history'; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Train', icon: Dumbbell },
  { to: '/library', label: 'Library', icon: BookOpen },
  { to: '/progress', label: 'Progress', icon: ChartNoAxesColumn },
  { to: '/history', label: 'History', icon: History },
]

/** Full-screen tasks: no navigation chrome at all. */
const FULLSCREEN = ['/workout', '/welcome']
/** Pushed detail routes: no tab bar (back returns to the tab), dock still available. */
const PUSHED = [/^\/day\//, /^\/history\/.+/, /^\/library\/.+/, /^\/program/, /^\/settings/]

function isActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/' || pathname.startsWith('/day')
  return pathname.startsWith(to)
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const me = useMe()
  const fullscreen = FULLSCREEN.some((p) => pathname.startsWith(p))
  const pushed = PUSHED.some((r) => r.test(pathname))
  // Train shows its own Resume hero, so the dock would be a duplicate there.
  const dock = Boolean(me.activeWorkout) && !fullscreen && pathname !== '/' && !pathname.startsWith('/day/')
  const tabs = !fullscreen && !pushed

  const vars = {
    '--dock': dock ? '72px' : '0px',
    '--tabbar-h': tabs ? '64px' : '0px',
  } as CSSProperties

  return (
    <div id="app-root" className="min-h-dvh bg-black lg:flex" style={vars}>
      {/* Desktop sidebar */}
      {!fullscreen && (
        <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
          <Link to="/" className="flex min-h-11 items-center gap-3 px-2">
            <Logo size={30} />
            <span className="text-[19px] font-[680] tracking-[-0.03em]">Lift</span>
          </Link>
          <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
            {TABS.map(({ to, label, icon: Icon }) => {
              const on = isActive(pathname, to)
              return (
                <Link
                  key={to}
                  to={to}
                  className={`press flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-[560] ${
                    on ? 'bg-raised text-ink' : 'text-muted hover:bg-surface hover:text-ink'
                  }`}
                >
                  <Icon className={`size-[19px] ${on ? 'text-accent' : ''}`} strokeWidth={1.75} />
                  {label}
                </Link>
              )
            })}
          </nav>
          {me.activeWorkout && (
            <div className="mt-6">
              <WorkoutBar variant="sidebar" />
            </div>
          )}
          <Link
            to="/settings"
            className={`press mt-auto flex items-center gap-3 rounded-xl px-2 py-2 ${pathname.startsWith('/settings') ? 'bg-raised' : 'hover:bg-surface'}`}
          >
            <Avatar size={32} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-[600]">{me.name ?? 'You'}</div>
              <div className="truncate text-[12px] text-muted">{me.email ?? 'Settings'}</div>
            </div>
          </Link>
        </aside>
      )}

      <div className="min-w-0 flex-1">{children}</div>

      {/* Mobile: dock lane + tab bar */}
      {(dock || tabs) && (
        <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden" style={{ viewTransitionName: 'tabbar' }}>
          {dock && (
            <div className={`px-4 pb-2 ${tabs ? '' : 'pb-[calc(var(--safe-bottom)+8px)]'}`}>
              <WorkoutBar variant="dock" />
            </div>
          )}
          {tabs && (
            <nav aria-label="Main" className="border-t border-line bg-black pb-[var(--safe-bottom)]">
              <div className="mx-auto flex h-16 max-w-[640px] items-stretch">
                {TABS.map(({ to, label, icon: Icon }) => {
                  const on = isActive(pathname, to)
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`press flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-[500] ${on ? 'text-accent' : 'text-muted'}`}
                    >
                      <Icon aria-hidden className="size-6" strokeWidth={1.75} />
                      {label}
                    </Link>
                  )
                })}
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}
