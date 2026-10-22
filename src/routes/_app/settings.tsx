import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Check, ChevronRight, Copy, KeyRound, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { PageHeader } from '#/components/PageHeader'
import { Sheet } from '#/components/Sheet'
import { MCP_URL } from '#/lib/convex'
import { fmtClock, fmtRelativeDay, WEEKDAYS_LONG } from '#/lib/format'
import { useMe } from '#/lib/me'
import { toast } from '#/lib/toast'
import { WhoopSettings } from '#/components/whoop/WhoopConnection'
import { MusicConnections } from '#/components/music/MusicConnections'
import { clearWhoopCache } from '#/components/whoop/useWhoop'


export const Route = createFileRoute('/_app/settings')({
  head: () => ({ meta: [{ title: 'Settings · Lift' }] }),
  component: Settings,
})

function copy(text: string, what = 'Copied') {
  void navigator.clipboard.writeText(text).then(() => toast(what))
}

function Row({ label, value, onClick, to }: { label: string; value?: ReactNode; onClick?: () => void; to?: string }) {
  const inner = (
    <>
      <span className="flex-1 text-[16px]">{label}</span>
      {value !== undefined && <span className="num max-w-[55%] truncate text-[14px] text-muted">{value}</span>}
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
    </>
  )
  const cls = 'press flex min-h-14 w-full items-center gap-3 border-b border-line text-left'
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

function Choice<T extends string | number>({
  open,
  onClose,
  title,
  value,
  options,
  onPick,
}: {
  open: boolean
  onClose: () => void
  title: string
  value: T
  options: { value: T; label: string }[]
  onPick: (v: T) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div role="radiogroup" aria-label={title} className="pb-2">
        {options.map((o) => (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={value === o.value}
            onClick={() => {
              onPick(o.value)
              onClose()
            }}
            className="press -mx-2 flex min-h-14 w-[calc(100%+16px)] items-center justify-between rounded-2xl px-2 text-left text-[16px] hover:bg-raised"
          >
            {o.label}
            {value === o.value && <Check aria-hidden className="size-5 text-accent" strokeWidth={2.4} />}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function Settings() {
  const me = useMe()
  const p = me.profile!
  const update = useMutation(api.profile.update)
  const { signOut } = useAuthActions()
  const program = useQuery(api.programs.active)
  const [sheet, setSheet] = useState<null | 'unit' | 'week' | 'rest' | 'ai'>(null)

  return (
    <main className="page">
      <PageHeader back title="Settings" />

      <section className="-mt-3 border-b border-line pb-4">
        <div className="text-[18px] font-[600]">{me.name ?? 'Lifter'}</div>
        <div className="text-[14px] text-muted">{me.email}</div>
      </section>

      <h2 className="mb-1 mt-7 text-[13px] font-[500] text-muted">Training</h2>
      <Row label="Program" value={program?.name ?? 'None'} to="/program" />
      <Row label="Weight unit" value={p.unit} onClick={() => setSheet('unit')} />
      <Row label="Week starts" value={WEEKDAYS_LONG[p.weekStartsOn]} onClick={() => setSheet('week')} />
      <Row label="Default rest" value={fmtClock(p.defaultRestSec)} onClick={() => setSheet('rest')} />

      <h2 className="mb-1 mt-7 text-[13px] font-[500] text-muted">Connections</h2>
      <WhoopSettings />
      <MusicConnections />
      <Row label="AI access" onClick={() => setSheet('ai')} />

      <h2 className="mb-1 mt-7 text-[13px] font-[500] text-muted">Account</h2>
      <a href="/privacy" className="press flex min-h-14 w-full items-center gap-3 border-b border-line text-[16px]">
        <span className="flex-1">Privacy</span>
        <ChevronRight aria-hidden className="size-4 text-muted" />
      </a>
      <button onClick={() => { clearWhoopCache(); void signOut() }} className="press flex min-h-14 w-full items-center border-b border-line text-left text-[16px] text-danger">
        Sign out
      </button>
      <p className="mt-10 text-center text-[12px] text-muted">Lift 1.0</p>

      <Choice
        open={sheet === 'unit'}
        onClose={() => setSheet(null)}
        title="Weight unit"
        value={p.unit}
        options={[
          { value: 'kg', label: 'Kilograms (kg)' },
          { value: 'lb', label: 'Pounds (lb)' },
        ]}
        onPick={(unit) => update({ unit })}
      />
      <Choice
        open={sheet === 'week'}
        onClose={() => setSheet(null)}
        title="Week starts"
        value={p.weekStartsOn}
        options={[
          { value: 1, label: 'Monday' },
          { value: 0, label: 'Sunday' },
          { value: 6, label: 'Saturday' },
        ]}
        onPick={(weekStartsOn) => update({ weekStartsOn })}
      />
      <Choice
        open={sheet === 'rest'}
        onClose={() => setSheet(null)}
        title="Default rest"
        value={p.defaultRestSec}
        options={[45, 60, 90, 120, 150, 180, 240].map((s) => ({ value: s, label: fmtClock(s) }))}
        onPick={(defaultRestSec) => update({ defaultRestSec })}
      />
      <AiAccess open={sheet === 'ai'} onClose={() => setSheet(null)} />
    </main>
  )
}

function AiAccess({ open: shown, onClose }: { open: boolean; onClose: () => void }) {
  const tokens = useQuery(api.tokens.list)
  const create = useAction(api.tokens.create)
  const revoke = useMutation(api.tokens.revoke)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('Claude')
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [revoking, setRevoking] = useState<{ _id: Id<'apiTokens'>; name: string } | null>(null)

  const claudeCmd = token ? `claude mcp add --transport http lift ${MCP_URL} --header "Authorization: Bearer ${token}"` : ''
  const codexToml = token
    ? `[mcp_servers.lift]\nurl = "${MCP_URL}"\nhttp_headers = { Authorization = "Bearer ${token}" }`
    : ''
  const jsonCfg = token
    ? JSON.stringify({ mcpServers: { lift: { type: 'http', url: MCP_URL, headers: { Authorization: `Bearer ${token}` } } } }, null, 2)
    : ''

  return (
    <>
      <Sheet open={shown && !open && revoking === null} onClose={onClose} title="AI access" size="tall">
        <div className="pb-2">
          <p className="text-[15px] leading-6 text-muted">
            Let Claude, Codex or any MCP client read your training and log or adjust workouts. Every change they make is recorded.
          </p>
          <h3 className="mb-1 mt-6 text-[13px] font-[500] text-muted">Access tokens</h3>
          {tokens && tokens.length === 0 && <p className="py-3 text-[15px] text-muted">No tokens yet.</p>}
          <ul>
            {tokens?.map((t) => (
              <li key={t._id} className="flex min-h-14 items-center gap-3 border-b border-line">
                <KeyRound aria-hidden className="size-5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px]">{t.name}</span>
                  <span className="num block text-[13px] text-muted">
                    {t.prefix}… · {t.lastUsedAt ? `used ${fmtRelativeDay(t.lastUsedAt).toLowerCase()}` : 'never used'}
                  </span>
                </span>
                <button className="h-11 px-2 text-[14px] font-[550] text-danger" aria-label={`Revoke token ${t.name}`} onClick={() => setRevoking(t)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
          <button className="btn btn-secondary mt-5 w-full" onClick={() => { setToken(null); setOpen(true) }}>
            <Plus className="size-4" /> New token
          </button>
        </div>
      </Sheet>

      <Sheet open={revoking !== null} onClose={() => setRevoking(null)} title={revoking ? `Revoke “${revoking.name}”?` : ''}>
        <p className="text-[15px] leading-[22px] text-muted">Agents using this token stop working immediately. You can create a new one any time.</p>
        <div className="mt-5 grid grid-cols-2 gap-2 pb-2">
          <button className="btn btn-secondary" onClick={() => setRevoking(null)}>Cancel</button>
          <button
            className="btn bg-danger/15 text-danger"
            onClick={async () => {
              if (revoking) await revoke({ tokenId: revoking._id })
              setRevoking(null)
            }}
          >
            Revoke
          </button>
        </div>
      </Sheet>
      <Sheet open={open} onClose={() => setOpen(false)} title={token ? 'Connect your agent' : 'New access token'} size={token ? 'tall' : 'auto'}>
        {!token ? (
          <form
            className="pb-2"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              try {
                const res = await create({ name })
                setToken(res.token)
              } finally {
                setBusy(false)
              }
            }}
          >
            <label htmlFor="token-name" className="text-[14px] text-muted">Name it after the agent that will use it</label>
            <input id="token-name" value={name} onChange={(e) => setName(e.target.value)} className="field mt-2" placeholder="Claude" />
            <button disabled={busy || !name.trim()} className="btn btn-primary mt-4 w-full">Create token</button>
          </form>
        ) : (
          <div className="space-y-5 pb-4">
            <div className="rounded-[16px] border border-accent/30 bg-accent-dim p-4">
              <div className="flex items-center gap-2 text-[13px] font-[650] text-accent">
                <Check className="size-4" /> Copy it now — it won’t be shown again
              </div>
              <button onClick={() => copy(token, 'Token copied')} className="num mt-2 flex w-full items-center gap-2 break-all text-left text-[13px] text-ink">
                <span className="flex-1">{token}</span> <Copy className="size-4 shrink-0 text-muted" />
              </button>
            </div>
            <Snippet title="Claude Code" code={claudeCmd} />
            <Snippet title="Codex (~/.codex/config.toml)" code={codexToml} />
            <Snippet title="Any MCP client (JSON)" code={jsonCfg} />
            <p className="text-[13px] leading-5 text-subtle">
              Endpoint: <span className="num text-muted">{MCP_URL}</span> · Streamable HTTP · Bearer token auth.
            </p>
          </div>
        )}
      </Sheet>
    </>
  )
}

function Snippet({ title, code }: { title: string; code: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-[600] text-muted">{title}</span>
        <button onClick={() => copy(code)} aria-label={`Copy ${title} configuration`} className="chip h-9 px-3 text-[12px]">
          <Copy className="size-3" /> Copy
        </button>
      </div>
      <pre tabIndex={0} aria-label={`${title} configuration`} className="num overflow-x-auto rounded-[14px] bg-raised p-3 text-[12px] leading-[18px] text-ink/85">{code}</pre>
    </div>
  )
}
