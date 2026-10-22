import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { ArrowRight, Check, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { Logo } from '#/components/Logo'
import { BlockSkeleton } from '#/components/Skeletons'
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
  const [choice, setChoice] = useState<string>('ulppl')
  const [busy, setBusy] = useState(false)
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

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] px-5 pb-[calc(var(--safe-bottom)+120px)] pt-[calc(var(--safe-top)+40px)]">
      <div className="animate-rise">
        <Logo size={40} />
        <h1 className="mt-6 t-large">{switching ? 'Switch program' : `Welcome${me.name ? `, ${me.name}` : ''}.`}</h1>
        <p className="mt-2 text-[16px] leading-6 text-muted">
          {switching ? 'Your history stays. The new plan takes over your week.' : 'Pick a plan to fill your week. You can change every exercise later.'}
        </p>
      </div>

      {!switching && (
        <div className="mt-8 flex items-center justify-between animate-rise [animation-delay:60ms]">
          <span className="text-[15px] font-[560]">I lift in</span>
          <div role="radiogroup" aria-label="Units" className="flex rounded-full bg-raised p-1">
            {(['kg', 'lb'] as const).map((u) => (
              <button key={u} role="radio" aria-checked={unit === u} onClick={() => update({ unit: u })} className={`press h-10 w-14 rounded-full text-[14px] font-[650] ${unit === u ? 'bg-ink text-black' : 'text-muted'}`}>
                {u}
              </button>
            ))}
          </div>
        </div>
      )}

      <div role="radiogroup" aria-label="Program" className="mt-6 space-y-2.5">
        {templates === undefined
          ? [0, 1, 2].map((i) => <BlockSkeleton key={i} h={118} />)
          : [...templates, { key: 'empty', name: 'Start from scratch', goal: 'Build your own', level: 'Any level', description: 'An empty week. Add your own days and exercises.', daysPerWeek: 0, days: [] }].map((t, i) => {
              const on = choice === t.key
              return (
                <button
                  key={t.key}
                  role="radio"
                  aria-checked={on}
                  onClick={() => { tap(); setChoice(t.key) }}
                  className={`press w-full rounded-[22px] border p-4 text-left transition-colors animate-rise ${
                    on ? 'border-accent/60 bg-accent/[0.06]' : 'border-line bg-surface hover:border-line-strong'
                  }`}
                  style={{ animationDelay: `${100 + i * 50}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[17px] font-[650] tracking-[-0.01em]">{t.name}</span>
                        {t.key === 'ulppl' && <span className="inline-flex items-center gap-1 rounded-full bg-accent-dim px-2 py-0.5 text-[11px] font-[650] text-accent"><Sparkles className="size-3" />Popular</span>}
                      </div>
                      <div className="mt-0.5 text-[13px] text-subtle">{t.goal} · {t.level}</div>
                      <p className="mt-2 text-[14px] leading-5 text-muted">{t.description}</p>
                    </div>
                    <span className={`grid size-6 shrink-0 place-items-center rounded-full border transition-colors ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong'}`}>
                      {on && <Check className="size-4" strokeWidth={3} />}
                    </span>
                  </div>
                  {t.days.length > 0 && (
                    <div className="mt-3 grid grid-cols-7 gap-1">
                      {[0, 1, 2, 3, 4, 5, 6].map((wd) => {
                        const d = t.days.find((x) => x.weekday === wd)
                        const work = d?.kind === 'workout'
                        return (
                          <div key={wd} className={`rounded-[8px] px-1 py-1.5 text-center ${work ? 'bg-raised' : ''}`}>
                            <div className="text-[10px] font-[650] text-subtle">{WEEKDAYS[wd][0]}</div>
                            <div className={`truncate text-[10px] font-[600] ${work ? 'text-ink/80' : 'text-subtle'}`}>{work ? d!.title.split(' ')[0] : '—'}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </button>
              )
            })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/95 to-transparent px-5 pb-[calc(var(--safe-bottom)+16px)] pt-8">
        <div className="mx-auto flex max-w-[560px] gap-2">
          {switching && <button className="btn btn-secondary" onClick={() => navigate({ to: '/settings' })}>Cancel</button>}
          <button disabled={busy} onClick={go} className="btn btn-primary flex-1">
            {busy ? <Loader2 className="size-5 animate-spin" /> : null}
            {switching ? 'Switch program' : 'Let’s lift'}
            {!busy && <ArrowRight className="size-5" />}
          </button>
        </div>
      </div>
    </main>
  )
}
