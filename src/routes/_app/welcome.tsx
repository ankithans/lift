import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { Check, Info, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { Sheet } from '#/components/Sheet'
import { WEEKDAYS } from '#/lib/format'
import { useMe } from '#/lib/me'
import { tap } from '#/lib/haptics'

export const Route = createFileRoute('/_app/welcome')({
  head: () => ({ meta: [{ title: 'Choose a program · Lift' }] }), component: Welcome })

function Welcome() {
  const me = useMe()
  const templates = useQuery(api.programs.templates)
  const start = useMutation(api.programs.startFromTemplate)
  const createEmpty = useMutation(api.programs.createEmpty)
  const update = useMutation(api.profile.update)
  const navigate = useNavigate()
  const [choice, setChoice] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const unit = me.profile?.unit ?? 'kg'
  const switching = Boolean(me.profile?.activeProgramId)

  async function go() {
    setBusy(true)
    tap('success')
    try {
      if (choice === 'empty') await createEmpty({ name: 'My program' })
      else await start({ template: choice })
      navigate({ to: '/', replace: true })
    } finally {
      setBusy(false)
    }
  }

  const options = templates
    ? [
        ...templates.map((t) => ({
          key: t.key,
          title: `${t.daysPerWeek} days a week`,
          line: [...new Set(t.days.filter((d) => d.kind === 'workout').map((d) => d.title.split(/[ ·(]/)[0]))].join(' / '),
          t,
        })),
        { key: 'empty', title: 'Start from scratch', line: 'Build your own week', t: null },
      ]
    : null
  const selected = options?.find((o) => o.key === choice)

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] px-5 pb-[calc(var(--safe-bottom)+120px)] pt-[calc(var(--safe-top)+48px)]">
      <div className="animate-rise">
        <h1 className="text-[28px] font-[650] leading-[34px] tracking-[-0.03em]">{switching ? 'Switch program' : 'Choose your week'}</h1>
        <p className="mt-2 text-[14px] leading-5 text-muted">{switching ? 'Your history and records stay.' : 'You can change it later.'}</p>
      </div>

      <div role="radiogroup" aria-label="Program" className="mt-7 overflow-hidden rounded-[20px] bg-surface animate-rise [animation-delay:60ms]">
        {options === null
          ? [0, 1, 2].map((i) => <div key={i} className="h-20 border-t border-line first:border-0" />)
          : options.map((o, i) => {
              const on = choice === o.key
              return (
                <div key={o.key} className={`flex items-center ${i > 0 ? 'border-t border-line' : ''} ${on ? 'bg-accent/[0.05]' : ''}`}>
                  <button
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      tap()
                      setChoice(o.key)
                    }}
                    className="flex min-h-20 min-w-0 flex-1 items-center gap-4 pl-4 text-left"
                  >
                    <span aria-hidden className={`grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors ${on ? 'border-accent bg-accent' : 'border-edge'}`}>
                      {on && <Check className="size-3 text-accent-ink" strokeWidth={3.5} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[16px] font-[550] leading-[22px]">{o.title}</span>
                      <span className="block truncate text-[13px] text-muted">{o.line}</span>
                    </span>
                  </button>
                  {o.t && (
                    <button className="icon-btn mr-2 shrink-0" aria-label={`About ${o.title}`} onClick={() => setInfo(o.key)}>
                      <Info className="size-5" />
                    </button>
                  )}
                </div>
              )
            })}
      </div>

      {!switching && (
        <div className="mt-6 flex min-h-14 items-center justify-between animate-rise [animation-delay:100ms]">
          <span className="text-[16px]">Weight unit</span>
          <div role="radiogroup" aria-label="Weight unit" className="flex rounded-[12px] bg-surface p-1">
            {(['kg', 'lb'] as const).map((u) => (
              <button
                key={u}
                role="radio"
                aria-checked={unit === u}
                onClick={() => update({ unit: u })}
                className={`press h-10 w-14 rounded-[9px] text-[14px] font-[550] ${unit === u ? 'bg-pressed text-ink' : 'text-muted'}`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 bg-black px-5 pb-[calc(var(--safe-bottom)+16px)] pt-4">
        <div className="mx-auto flex max-w-[560px] gap-2">
          {switching && (
            <button className="btn btn-secondary" onClick={() => navigate({ to: '/settings' })}>
              Cancel
            </button>
          )}
          <button disabled={busy || !selected} onClick={go} className="btn btn-primary flex-1">
            {busy ? <Loader2 className="size-5 animate-spin" /> : null}
            {selected ? (selected.t ? `Use ${selected.t.daysPerWeek}-day plan` : 'Start from scratch') : 'Choose a plan'}
          </button>
        </div>
      </div>

      <Sheet open={info !== null} onClose={() => setInfo(null)} title={options?.find((o) => o.key === info)?.t?.name ?? ''}>
        {(() => {
          const t = options?.find((o) => o.key === info)?.t
          if (!t) return null
          return (
            <div className="pb-2">
              <p className="text-[15px] leading-6 text-muted">{t.description}</p>
              <p className="mt-1 text-[13px] text-muted">
                {t.level} · {t.goal}
              </p>
              <ul className="mt-4">
                {[0, 1, 2, 3, 4, 5, 6].map((wd) => {
                  const d = t.days.find((x) => x.weekday === wd)
                  return (
                    <li key={wd} className="flex min-h-11 items-center gap-4 border-b border-line text-[15px]">
                      <span className="w-10 text-[13px] text-muted">{WEEKDAYS[wd]}</span>
                      <span className={d?.kind === 'workout' ? '' : 'text-muted'}>{d?.kind === 'workout' ? d.title : 'Rest'}</span>
                      {d?.kind === 'workout' && <span className="num ml-auto text-[13px] text-muted">{d.exercises} ex</span>}
                    </li>
                  )
                })}
              </ul>
              <button
                className="btn btn-primary mt-5 w-full"
                onClick={() => {
                  setChoice(t.key)
                  setInfo(null)
                }}
              >
                Use this plan
              </button>
            </div>
          )
        })()}
      </Sheet>
    </main>
  )
}
