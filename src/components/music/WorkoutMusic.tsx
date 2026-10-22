import { useAction, useQuery } from 'convex/react'
import { ChevronLeft, ChevronRight, ExternalLink, ListMusic, Music2, Pause, Play, SkipBack, SkipForward, Speaker } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import type { LibraryPage } from '../../../convex/music/model'
import { Sheet } from '#/components/Sheet'
import { announce } from '#/lib/announce'
import { useOnline } from '#/lib/convex'
import { ConnectMusic } from './MusicConnections'
import { loadSpotify, musicError, PROVIDERS, type Item, type Source, type SpotifyPlayer } from './providers'
import { YouTubePlayer } from './YouTubePlayer'
import './music.css'

type Collection = 'liked' | 'top' | 'playlists' | 'recent' | 'playlist' | 'queue'
const LABELS = { liked: 'Liked', top: 'Top', playlists: 'Playlists', recent: 'Recent', playlist: 'Playlist', queue: 'Queue' }
type Playback = FunctionReturnType<typeof api.spotify.playback>

export function WorkoutMusic({ open, hidden, onOpen, onClose }: { open: boolean; hidden: boolean; onOpen: () => void; onClose: () => void }) {
  const connections = useQuery(api.musicStore.connections)
  const online = useOnline()
  const [source, setSource] = useState<Source>('spotify')
  const connection = connections?.find(c => c.provider === source)
  const [collection, setCollection] = useState<Collection>('liked')
  const [playlist, setPlaylist] = useState<Item | null>(null)
  const [page, setPage] = useState<LibraryPage | null>(null)
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [playback, setPlayback] = useState<Playback | null>(null)
  const [devices, setDevices] = useState<FunctionReturnType<typeof api.spotify.devices>>([])
  const [deviceId, setDeviceId] = useState<string | undefined>(), [deviceOpen, setDeviceOpen] = useState(false)
  const [sdkBusy, setSdkBusy] = useState(false), [browserDevice, setBrowserDevice] = useState(''), [premiumDenied, setPremiumDenied] = useState(false)
  const sdk = useRef<SpotifyPlayer | null>(null)
  const alive = useRef(true)
  const [queue, setQueue] = useState<Item[]>([]), [index, setIndex] = useState(-1), [ytPlaying, setYtPlaying] = useState(false)
  const [visible, setVisible] = useState(true)
  const requestId = useRef(0)
  const playbackVersion = useRef(0)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sdkTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const spotifyLibrary = useAction(api.spotify.library), youtubeLibrary = useAction(api.youtube.library)
  const getPlayback = useAction(api.spotify.playback), getDevices = useAction(api.spotify.devices), getQueue = useAction(api.spotify.queue)
  const control = useAction(api.spotify.control), getSdkToken = useAction(api.spotify.sdkToken)
  const connected = connection?.status === 'connected'
  const premium = connection?.premium !== false && !premiumDenied
  const item = source === 'spotify' ? playback?.item : queue[index]
  const playing = source === 'spotify' ? playback?.playing ?? false : ytPlaying

  useEffect(() => {
    alive.current = true
    const change = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', change)
    return () => { alive.current = false; clearTimeout(refreshTimer.current); clearTimeout(sdkTimer.current); document.removeEventListener('visibilitychange', change); sdk.current?.disconnect(); sdk.current = null }
  }, [])
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const outcome = params.get('music'), from = params.get('source')
    if (from === 'spotify' || from === 'youtube') setSource(from)
    if (outcome) {
      announce(outcome === 'connected' ? 'Music connected' : outcome === 'cancelled' ? 'Music connection cancelled' : 'Music could not connect. Try again in Settings.')
      for (const key of ['music', 'source', 'music_reason']) params.delete(key)
      history.replaceState(history.state, '', location.pathname + (params.size ? `?${params}` : ''))
    }
  }, [])
  useEffect(() => {
    if (!connections?.some(c => c.provider === 'spotify' && c.status === 'connected')) { sdk.current?.disconnect(); sdk.current = null; setBrowserDevice(''); setPlayback(null); setDeviceId(undefined) }
    if (!connections?.some(c => c.provider === 'youtube' && c.status === 'connected')) { setQueue([]); setIndex(-1); setYtPlaying(false) }
  }, [connections])
  useEffect(() => {
    if (!open || !online || hidden || source !== 'youtube') setYtPlaying(false)
  }, [open, online, hidden, source])

  // Poll only while the header/sheet is visible, never hidden behind the keypad or in a background tab.
  useEffect(() => {
    if (source !== 'spotify' || !connected || !online || hidden || !visible) return
    let cancelled = false, timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      let delay = 15_000
      const version = playbackVersion.current
      try { const result = await getPlayback({}); if (!cancelled && version === playbackVersion.current) setPlayback(result) }
      catch (e) { delay = 60_000; if (!cancelled) setError(musicError(e)) }
      if (!cancelled) timer = setTimeout(poll, delay)
    }
    void poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [source, connected, online, hidden, visible, getPlayback])

  const load = useCallback(async (cursor?: string) => {
    if (!connected || !online) return
    const id = ++requestId.current
    setLoading(true); setError('')
    try {
      const result = collection === 'queue' ? { items: source === 'spotify' ? await getQueue({}) : queue.slice(index + 1) }
        : source === 'spotify' ? await spotifyLibrary({ collection, playlistId: playlist?.id, cursor })
        : await youtubeLibrary({ collection: collection === 'top' || collection === 'recent' ? 'liked' : collection, playlistId: playlist?.id, cursor })
      if (id === requestId.current) setPage(old => cursor && old ? { ...result, items: [...old.items, ...result.items].slice(-1000) } : result)
    } catch (e) { if (id === requestId.current) setError(musicError(e)) }
    finally { if (id === requestId.current) setLoading(false) }
  }, [connected, online, collection, source, playlist?.id, spotifyLibrary, youtubeLibrary, getQueue, queue, index])
  useEffect(() => {
    setPage(null)
    if (open) void load()
    return () => { requestId.current++ }
  }, [open, load])

  const act = async (command: 'play' | 'pause' | 'next' | 'previous', uris?: string[], contextUri?: string, label?: string) => {
    if (busy || !online) return
    setBusy(true); setError('')
    const version = ++playbackVersion.current
    try {
      await control({ command, deviceId, uris, contextUri })
      announce(label ?? (command === 'next' ? 'Skipped' : command === 'previous' ? 'Previous song' : command === 'pause' ? 'Paused' : 'Playing'))
      // Spotify acknowledges controls before its read endpoint catches up.
      // Reflect the accepted transport action immediately, then reconcile once.
      if (command === 'pause' || command === 'play') setPlayback(old => old ? { ...old, playing: command === 'play' } : old)
      clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => {
        void getPlayback({}).then(result => { if (alive.current && version === playbackVersion.current) setPlayback(result) }).catch(e => { if (alive.current) setError(musicError(e)) })
      }, 1000)
    } catch (e) { setError(musicError(e)) }
    finally { setBusy(false) }
  }
  const youtubeSkip = (delta: number, explicit: boolean) => {
    const next = index + delta
    if (next < 0 || next >= queue.length) { setYtPlaying(false); return }
    setIndex(next); setYtPlaying(true)
    if (explicit) announce(delta > 0 ? 'Skipped' : 'Previous song')
  }
  const transport = (command: 'play' | 'pause' | 'next' | 'previous') => {
    if (source === 'spotify') void act(command)
    else if (command === 'next' || command === 'previous') youtubeSkip(command === 'next' ? 1 : -1, true)
    else { setYtPlaying(command === 'play'); announce(command === 'play' ? 'Playing' : 'Paused') }
  }
  const selectSource = async (p: Source) => {
    if (p === source) return
    if (source === 'spotify' && playback?.playing && online) {
      try { await control({ command: 'pause', deviceId }) } catch (e) { setError(musicError(e)); return }
    }
    setYtPlaying(false); setSource(p); setCollection('liked'); setPlaylist(null); setError(''); setDeviceOpen(false)
  }
  const chooseItem = (track: Item, list: Item[]) => {
    if (track.kind === 'playlist') { setPlaylist(track); setCollection('playlist'); return }
    if (source === 'spotify') {
      const start = list.indexOf(track)
      void act('play', list.slice(Math.max(0, start), Math.max(0, start) + 50).flatMap(x => x.uri ? [x.uri] : []), undefined, `Playing ${track.title}`)
    } else {
      setQueue(list.filter(x => x.kind === 'track')); setIndex(Math.max(0, list.findIndex(x => x.id === track.id))); setYtPlaying(true); announce(`Playing ${track.title}`)
    }
  }
  const useBrowser = async () => {
    if (sdkBusy || sdk.current || !online) return
    setSdkBusy(true); setError('')
    try {
      await loadSpotify()
      if (!alive.current || !window.Spotify) return
      const player = new window.Spotify.Player({ name: 'Lift · this browser', volume: 0.7, getOAuthToken: cb => {
        void getSdkToken({}).then(t => { if (alive.current) cb(t.accessToken) }).catch(e => { if (alive.current) { setError(musicError(e)); setSdkBusy(false); sdk.current?.disconnect(); sdk.current = null; clearTimeout(sdkTimer.current) } })
      } })
      sdk.current = player
      const sdkError = () => { clearTimeout(sdkTimer.current); if (alive.current) { setError('Spotify could not start this browser player. Try your Spotify app or another device.'); setSdkBusy(false); player.disconnect(); sdk.current = null } }
      sdkTimer.current = setTimeout(sdkError, 20_000)
      for (const event of ['initialization_error', 'authentication_error', 'playback_error']) player.addListener(event, sdkError)
      player.addListener('account_error', () => { if (alive.current) setPremiumDenied(true); sdkError() })
      player.addListener('ready', ({ device_id }) => {
        if (!alive.current || !device_id) return
        clearTimeout(sdkTimer.current)
        setBrowserDevice(device_id); setDeviceId(device_id); setSdkBusy(false)
        void control({ command: 'transfer', deviceId: device_id }).then(() => { if (alive.current) announce('This browser is ready. Choose a favourite to play.') }).catch(e => { if (alive.current) setError(musicError(e)) })
      })
      player.addListener('not_ready', () => { if (alive.current) { setBrowserDevice(''); setDeviceId(undefined); setError('This browser player disconnected. Choose another device.'); sdk.current?.disconnect(); sdk.current = null } })
      await player.activateElement()
      if (!await player.connect()) sdkError()
    } catch (e) { setError(musicError(e)); sdk.current?.disconnect(); sdk.current = null; setSdkBusy(false) }
  }
  const chooseDevice = async (id: string) => {
    setBusy(true); setError('')
    try { await control({ command: 'transfer', deviceId: id }); setDeviceId(id); setDeviceOpen(false); setPlayback(await getPlayback({})); announce('Playback device selected') }
    catch (e) { setError(musicError(e)) } finally { setBusy(false) }
  }
  const controlsDisabled = !online || busy || !connected || (source === 'spotify' && !premium) || (source === 'youtube' && !item)
  const controls = <div className="flex items-center justify-center gap-5 py-2" role="group" aria-label="Playback controls">
    <button className="icon-btn size-12" aria-label="Previous song" disabled={controlsDisabled || (source === 'youtube' && index <= 0)} onClick={() => transport('previous')}><SkipBack aria-hidden className="size-6" /></button>
    <button className="grid size-14 place-items-center rounded-full bg-ink text-canvas disabled:opacity-40" aria-label={playing ? 'Pause music' : 'Play music'} disabled={controlsDisabled} onClick={() => transport(playing ? 'pause' : 'play')}>{playing ? <Pause aria-hidden className="size-6" /> : <Play aria-hidden className="size-6" />}</button>
    <button className="icon-btn size-12" aria-label="Next song" disabled={controlsDisabled || (source === 'youtube' && index >= queue.length - 1)} onClick={() => transport('next')}><SkipForward aria-hidden className="size-6" /></button>
  </div>
  return <>
    {!hidden && <div className="music-ui mx-auto flex max-w-[680px] justify-end px-4 pb-1" data-music-header>
      {online ? <div className="flex min-h-11 max-w-full items-center gap-1 rounded-full bg-raised pl-3">
        <button className="flex min-h-11 min-w-0 items-center gap-2 pr-2 text-left" aria-label={item ? `Open music: ${item.title}, ${item.subtitle}` : 'Open workout music'} onClick={onOpen}>
          {item?.image ? <img src={item.image} alt="" className="size-7 shrink-0 rounded object-cover" /> : <Music2 aria-hidden className="size-4 text-muted" />}
          <span className="min-w-0 max-w-[150px]"><span className="block truncate text-[13px]">{item?.title ?? 'Music'}</span>{item && <span className="block truncate text-[11px] text-muted">{item.subtitle}</span>}</span>
          {!item && <ChevronRight aria-hidden className="size-3 text-muted" />}
        </button>
        {item && source === 'spotify' && <><button className="icon-btn size-11" aria-label={playing ? 'Pause music' : 'Play music'} disabled={controlsDisabled} onClick={() => transport(playing ? 'pause' : 'play')}>{playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}</button><button className="icon-btn size-11" aria-label="Next song" disabled={controlsDisabled} onClick={() => transport('next')}><SkipForward aria-hidden className="size-4" /></button></>}
      </div> : <span className="flex min-h-11 items-center gap-2 text-[12px] text-muted"><Music2 aria-hidden className="size-4" />Music offline</span>}
    </div>}
    <Sheet className="music-ui" open={open && !hidden} onClose={() => { setYtPlaying(false); onClose() }} title="Music" size="tall">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-raised p-1" role="group" aria-label="Music source">
        {(Object.keys(PROVIDERS) as Source[]).map(p => <button key={p} aria-pressed={source === p} onClick={() => void selectSource(p)} className={`min-h-11 rounded-lg px-2 text-[14px] font-[550] ${source === p ? 'bg-surface text-ink' : 'text-muted'}`}>{PROVIDERS[p]}</button>)}
      </div>
      {!online && <p role="status" className="mt-4 text-[13px] text-muted">Music needs a connection. Your workout is still available offline.</p>}
      {!connected ? <div className="py-6"><h3 className="text-[18px] font-[600]">Your music, between sets</h3><p className="mb-5 mt-2 text-[14px] leading-6 text-muted">{source === 'spotify' ? 'Connect to browse favourites and control Spotify. Premium is required for playback.' : 'Connect your YouTube account to browse playlists and likes. The video player stays visible while music plays.'}</p><ConnectMusic source={source} label={connection ? `Reconnect ${PROVIDERS[source]}` : undefined} /></div> : <>
        {source === 'youtube' && item && open && online && !hidden && <div className="sticky top-0 z-10 bg-surface pt-4 pb-2"><YouTubePlayer item={item} playing={ytPlaying} onPlaying={setYtPlaying} onEnded={() => youtubeSkip(1, false)} onError={setError} /></div>}
        {item ? <div className="mt-5 flex min-w-0 items-center gap-3">
          {item.image && <img src={item.image} alt="" className="size-14 shrink-0 rounded-md object-cover" />}
          <div className="min-w-0"><p className="truncate text-[16px] font-[600]">{item.title}</p><p className="truncate text-[13px] text-muted">{item.subtitle}</p><a href={item.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-[12px] text-muted underline">Open in {PROVIDERS[source]} <ExternalLink aria-hidden className="size-3" /></a></div>
        </div> : <p className="mt-5 text-[14px] text-muted">Choose a favourite to set the mood.</p>}
        {controls}
        {source === 'spotify' && <>
          {!premium && <p className="my-3 text-[13px] leading-5 text-muted">Spotify Premium is needed for playback here. Browse favourites and open them in Spotify.</p>}
          <button className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-[13px] text-muted" disabled={!online || busy} aria-expanded={deviceOpen} onClick={async () => {
            setDeviceOpen(!deviceOpen)
            if (!deviceOpen) { try { setDevices(await getDevices({})) } catch (e) { setError(musicError(e)) } }
          }}><span className="flex min-w-0 items-center gap-2"><Speaker aria-hidden className="size-4 shrink-0" /><span className="truncate">{playback?.device ? `Listening on ${playback.device}` : 'Choose playback device'}</span></span><ChevronRight aria-hidden className="size-4" /></button>
          {deviceOpen && <div className="my-2 rounded-xl border border-line p-3">
            {!devices.length && <p className="text-[13px] leading-5 text-muted">No device found. Open Spotify and start a song, or use this browser.</p>}
            {devices.map(d => <button key={d.id} disabled={d.restricted || busy || !online} onClick={() => void chooseDevice(d.id)} className="flex min-h-12 w-full items-center justify-between gap-2 text-left text-[14px]"><span>{d.name}{d.restricted ? ' · unavailable' : ''}</span>{(deviceId === d.id || (!deviceId && d.active)) && <span className="text-accent">Selected</span>}</button>)}
          </div>}
          {premium && <button className="min-h-11 w-full text-left text-[13px] text-accent" disabled={!online || sdkBusy || Boolean(browserDevice)} onClick={() => void useBrowser()}>{browserDevice ? 'This browser is ready' : sdkBusy ? 'Starting browser player…' : 'Play on this browser'}</button>}
        </>}
        {source === 'youtube' && <p className="my-3 text-[13px] leading-5 text-muted">Keep the video visible. Closing this sheet or locking your screen pauses it, including in an iOS PWA. <a className="underline" href={item?.url ?? 'https://music.youtube.com/'} target="_blank" rel="noreferrer">Open in YouTube Music</a> to listen outside Lift.</p>}
        <div role="group" aria-label="Music favourites" className="mt-4 flex flex-wrap gap-1 border-b border-line pb-2">
          {(['liked', ...(source === 'spotify' ? ['top'] as const : []), 'playlists', ...(source === 'spotify' ? ['recent'] as const : []), 'queue'] as Collection[]).map(c => <button key={c} aria-pressed={collection === c} onClick={() => { setCollection(c); setPlaylist(null) }} className={`min-h-11 rounded-full px-3 text-[13px] ${collection === c ? 'bg-raised text-ink' : 'text-muted'}`}>{LABELS[c]}</button>)}
        </div>
        {playlist && <div className="mt-3"><button className="flex min-h-11 items-center gap-1 text-[13px] text-muted" onClick={() => { setPlaylist(null); setCollection('playlists') }}><ChevronLeft aria-hidden className="size-4" />Playlists</button><h3 className="text-[18px] font-[600]">{playlist.title}</h3>{source === 'spotify' && premium && <button className="btn btn-secondary my-3 w-full" disabled={!online || busy} onClick={() => void act('play', undefined, playlist.uri, `Playing ${playlist.title}`)}>Play playlist</button>}</div>}
        {page?.notice && <p className="mt-3 text-[13px] leading-5 text-muted">{page.notice}</p>}
        {loading && !page && <p className="py-6 text-[14px] text-muted" role="status">Loading favourites…</p>}
        {!loading && page?.items.length === 0 && <div className="py-8 text-center"><ListMusic aria-hidden className="mx-auto mb-2 size-6 text-muted" /><p className="text-[14px] text-muted">{collection === 'queue' ? 'Nothing queued yet.' : 'No favourites in this list yet.'}</p></div>}
        <ul className="mt-2">{page?.items.map((track, i) => <li key={`${track.id}-${i}`} className="flex min-h-[64px] items-center gap-2 border-b border-line">
          <button className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 text-left" disabled={!online || busy || (track.kind === 'track' && source === 'spotify' && !premium)} aria-label={`${track.kind === 'playlist' ? 'Open playlist' : 'Play'} ${track.title}, ${track.subtitle}`} onClick={() => chooseItem(track, page.items)}>
            {track.image ? <img loading="lazy" src={track.image} alt="" className="size-10 shrink-0 rounded object-cover" /> : <span className="grid size-10 shrink-0 place-items-center rounded bg-raised"><Music2 aria-hidden className="size-4 text-muted" /></span>}
            <span className="min-w-0"><span className="block truncate text-[14px] font-[550]">{track.title}</span><span className="block truncate text-[12px] text-muted">{track.subtitle}</span></span>
          </button>
          <a className="icon-btn size-11 shrink-0" href={track.url} target="_blank" rel="noreferrer" aria-label={`Open ${track.title} in ${PROVIDERS[source]}`}><ExternalLink aria-hidden className="size-4" /></a>
        </li>)}</ul>
        {page?.next && <button className="btn btn-secondary mt-4 w-full" disabled={!online || loading} onClick={() => void load(page.next)}>{loading ? 'Loading…' : 'Load more'}</button>}
      </>}
      {error && <div className="mt-4 rounded-xl border border-line p-3"><p className="text-[13px] leading-5 text-muted">{error}</p><button className="mt-1 min-h-11 text-[13px] text-accent" disabled={!online || loading} onClick={() => void load()}>Try again</button></div>}
    </Sheet>
  </>
}
