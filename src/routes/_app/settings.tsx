import { Link, createFileRoute } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { Bot, Check, ChevronRight, Copy, KeyRound, LogOut, Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { Avatar } from '#/components/Avatar'
import { PageHeader } from '#/components/PageHeader'
import { Sheet } from '#/components/Sheet'
import { MCP_URL } from '#/lib/convex'
import { fmtClock, fmtRelativeDay } from '#/lib/format'
import { useMe } from '#/lib/me'
import { toast } from '#/lib/toast'

export const Route = createFileRoute('/_app/settings')({
  head: () => ({ meta: [{ title: 'Settings · Lift' }] }), component: Settings })

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
      <div className="min-w-0">
        <div className="text-[16px] font-[540]">{label}</div>
        {hint && <div className="text-[13px] text-subtle">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-raised p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`press h-10 min-w-12 rounded-full px-3 text-[14px] font-[600] transition-colors ${value === o.value ? 'bg-ink text-black' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function copy(text: string, what = 'Copied') {
  void navigator.clipboard.writeText(text).then(() => toast(what))
}

function Settings() {
  const me = useMe()
  const p = me.profile!
  const update = useMutation(api.profile.update)
  const { signOut } = useAuthActions()
  const program = useQuery(api.programs.active)

  return (
    <main className="page">
      <PageHeader title="Settings" />

      <section className="card flex items-center gap-4 p-4">
        <Avatar size={52} />
        <div className="min-w-0">
          <div className="truncate text-[18px] font-[650]">{me.name ?? 'Lifter'}</div>
          <div className="truncate text-[14px] text-subtle">{me.email}</div>
        </div>
      </section>

      <h2 className="t-eyebrow mb-1 mt-8 text-subtle">Training</h2>
      <div className="divide-hair">
        <Link to="/program" className="press flex min-h-14 items-center justify-between gap-4 py-2">
          <div className="min-w-0">
            <div className="text-[16px] font-[540]">Program</div>
            <div className="truncate text-[13px] text-subtle">{program?.name ?? 'None'}</div>
          </div>
          <ChevronRight className="size-5 text-subtle" />
        </Link>
        <Link to="/welcome" className="press flex min-h-14 items-center justify-between gap-4 py-2">
          <div className="min-w-0">
            <div className="text-[16px] font-[540]">Switch program</div>
            <div className="text-[13px] text-subtle">Your history and PRs stay</div>
          </div>
          <ChevronRight className="size-5 text-subtle" />
        </Link>
        <Row label="Units">
          <Segmented label="Units" value={p.unit} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} onChange={(unit) => update({ unit })} />
        </Row>
        <Row label="Week starts">
          <Segmented label="Week starts" value={p.weekStartsOn} options={[{ value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }]} onChange={(weekStartsOn) => update({ weekStartsOn })} />
        </Row>
        <Row label="Default rest" hint="For exercises you add">
          <Segmented
            label="Default rest"
            value={p.defaultRestSec}
            options={[60, 90, 120, 180].map((s) => ({ value: s, label: fmtClock(s) }))}
            onChange={(defaultRestSec) => update({ defaultRestSec })}
          />
        </Row>
      </div>

      <AiAccess />

      <h2 className="t-eyebrow mb-1 mt-8 text-subtle">Account</h2>
      <div className="divide-hair">
        <button onClick={() => void signOut()} className="press flex min-h-14 w-full items-center gap-3 py-2 text-left text-danger">
          <LogOut className="size-5" /> Sign out
        </button>
      </div>
      <p className="mt-10 text-center text-[12px] text-subtle">
        Lift · made for lifting, not scrolling · <a href="/privacy" className="underline underline-offset-2">Privacy</a>
      </p>
    </main>
  )
}

function AiAccess() {
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
      <h2 className="t-eyebrow mb-1 mt-8 text-subtle">AI access</h2>
      <div className="card p-4">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-dim text-accent">
            <Bot className="size-5" />
          </span>
          <div>
            <div className="text-[16px] font-[600]">Connect Claude, Codex & more</div>
            <p className="mt-1 text-[14px] leading-5 text-muted">
              Lift speaks MCP. Agents can read your history and plan, log workouts, and adjust programs — every change is recorded.
            </p>
          </div>
        </div>
        <ul className="mt-3 divide-hair">
          {tokens?.map((t) => (
            <li key={t._id} className="flex h-12 items-center gap-3">
              <KeyRound className="size-4 text-subtle" />
              <span className="min-w-0 flex-1 truncate text-[15px]">
                {t.name} <span className="num text-[13px] text-subtle">{t.prefix}…</span>
              </span>
              <span className="text-[12px] text-subtle">{t.lastUsedAt ? `used ${fmtRelativeDay(t.lastUsedAt).toLowerCase()}` : 'never used'}</span>
              <button className="icon-btn text-subtle" aria-label={`Revoke token ${t.name}`} onClick={() => setRevoking(t)}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <button className="btn btn-secondary btn-sm mt-3 w-full" onClick={() => { setToken(null); setOpen(true) }}>
          <Plus className="size-4" /> New access token
        </button>
      </div>

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
