import { useAction, useMutation, useQuery } from 'convex/react'
import { ChevronRight, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { Sheet } from '#/components/Sheet'
import { useOnline } from '#/lib/convex'
import { announce } from '#/lib/announce'
import { musicError, PROVIDERS, type Source } from './providers'
import './music.css'

export function ConnectMusic({ source, label }: { source: Source; label?: string }) {
  const connect = useAction(api.music.connect), online = useOnline()
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  return <>
    <button className="btn btn-primary w-full" disabled={busy || !online} onClick={async () => {
      setBusy(true); setError('')
      try { location.assign(await connect({ provider: source, returnTo: location.origin + location.pathname })) }
      catch (e) { setError(musicError(e)); setBusy(false) }
    }}>{busy ? 'Opening…' : label ?? `Connect ${PROVIDERS[source]}`}</button>
    {error && <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p>}
  </>
}
export function MusicConnections() {
  const connections = useQuery(api.musicStore.connections), disconnect = useMutation(api.musicStore.disconnect)
  const [source, setSource] = useState<Source | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const online = useOnline(), connection = connections?.find(c => c.provider === source)
  useEffect(() => {
    const params = new URLSearchParams(location.search), outcome = params.get('music'), p = params.get('source')
    if (!outcome || (p !== 'spotify' && p !== 'youtube')) return
    const message = outcome === 'connected' ? `${PROVIDERS[p]} connected` : outcome === 'cancelled' ? `${PROVIDERS[p]} connection cancelled` : `Could not connect ${PROVIDERS[p]}. Try again.`
    setNotice(message); announce(message)
    for (const key of ['music', 'source', 'music_reason']) params.delete(key)
    history.replaceState(history.state, '', location.pathname + (params.size ? `?${params}` : ''))
  }, [])
  return <>
    {(Object.keys(PROVIDERS) as Source[]).map(p => <button key={p} className="press flex min-h-14 w-full items-center gap-3 border-b border-line text-left" onClick={() => { setError(''); setSource(p) }}>
      <span className="flex-1 text-[16px]">{PROVIDERS[p]}</span><span className="text-[14px] text-muted">{connections === undefined ? '…' : connections.find(c => c.provider === p)?.status === 'reconnect' ? 'Reconnect' : connections.some(c => c.provider === p) ? 'Connected' : 'Connect'}</span><ChevronRight aria-hidden className="size-4 text-muted" />
    </button>)}
    {notice && <p className="py-2 text-[13px] text-muted">{notice}</p>}
    <Sheet className="music-ui" open={source !== null} onClose={() => setSource(null)} title={source ? PROVIDERS[source] : 'Music'}>
      {source && <>
        <p className="text-[15px] leading-6 text-muted">{source === 'spotify' ? 'Browse your liked songs, top tracks, playlists and recent music during a workout. Spotify Premium is required to control playback.' : 'Browse playlists and likes from your YouTube account. YouTube may include non-music videos and may not expose every YouTube Music favourite.'}</p>
        {source === 'youtube' && <p className="mt-3 text-[13px] leading-5 text-muted">Video stays visible while playing in Lift. Closing the music sheet or locking your screen pauses it; iOS PWAs cannot keep this audio playing in the background. Google may show an unverified-app warning for this optional read-only connection.</p>}
        <p className="mt-3 text-[13px] leading-5 text-muted">Music authorization is separate from Lift sign-in. Tokens stay on Lift’s server, except the short-lived Spotify playback token used in browser memory. Disconnect deletes the connection and cached favourites.</p>
        <div className="mt-6">{connection?.status !== 'connected' && <ConnectMusic source={source} label={connection ? `Reconnect ${PROVIDERS[source]}` : undefined} />}</div>
        {connection && <button className="btn btn-secondary mt-3 w-full text-danger" disabled={busy || !online} onClick={async () => {
          setBusy(true)
          try { await disconnect({ provider: source }); announce(`Disconnected ${PROVIDERS[source]}`); setSource(null) } catch (e) { setError(musicError(e)) } finally { setBusy(false) }
        }}>{busy ? 'Disconnecting…' : `Disconnect ${PROVIDERS[source]}`}</button>}
        {error && <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p>}
        <a href={source === 'youtube' ? 'https://myaccount.google.com/permissions' : 'https://www.spotify.com/account/apps/'} target="_blank" rel="noreferrer" className="mt-3 flex min-h-11 items-center justify-center gap-2 text-[13px] text-muted underline">Manage provider access <ExternalLink aria-hidden className="size-3" /></a>
        <a href="/privacy" className="flex min-h-11 items-center justify-center text-[13px] text-muted underline">Privacy policy</a>
      </>}
    </Sheet>
  </>
}
