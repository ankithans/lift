import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function Empty({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center animate-fade">
      <span className="grid size-14 place-items-center rounded-full bg-surface text-subtle">
        <Icon className="size-6" strokeWidth={1.6} />
      </span>
      <h3 className="mt-5 t-title">{title}</h3>
      {body && <p className="mt-2 max-w-[300px] text-[15px] leading-[22px] text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
