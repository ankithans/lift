import { Link, useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Avatar } from './Avatar'

/** Large-title header. `back` shows a back chevron instead of the avatar. */
export function PageHeader({
  title,
  eyebrow,
  back,
  action,
}: {
  title: ReactNode
  eyebrow?: ReactNode
  back?: boolean | string
  action?: ReactNode
}) {
  const router = useRouter()
  return (
    <header className="mb-6">
      <div className="flex h-11 items-center justify-between">
        {back ? (
          <button
            onClick={() => (typeof back === 'string' ? router.navigate({ to: back }) : router.history.back())}
            className="icon-btn -ml-3"
            aria-label="Back"
          >
            <ChevronLeft className="size-6" strokeWidth={1.9} />
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          {action}
          {!back && (
            <Link to="/settings" className="press -mr-[6px] grid size-11 place-items-center rounded-full lg:hidden" aria-label="Settings">
              <Avatar size={34} />
            </Link>
          )}
        </div>
      </div>
      {eyebrow && <div className="mt-3 t-meta text-subtle">{eyebrow}</div>}
      <h1 className={`t-large ${eyebrow ? 'mt-1' : 'mt-3'}`}>{title}</h1>
    </header>
  )
}
