import { useAction, useQuery } from 'convex/react'
import { ChevronLeft, ChevronRight, ExternalLink, ListMusic, Music2, Pause, Play, SkipBack, SkipForward, Speaker, MoveUpRight, MoveDownRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../../convex/_generated/api'
import type { LibraryPage } from '../../../convex/music/model'
import { Sheet } from '#/components/Sheet'
import { announce } from '#/lib/announce'
import { useOnline } from '#/lib/convex'
import { ConnectMusic } from './MusicConnections'
import { musicError, PROVIDERS, type Item, type Source } from './providers'
import { YouTubePlayer, type YouTubeHandle } from './YouTubePlayer'
import { useSpotify } from './useSpotify'
import './music.css'

type Collection = 'liked' | 'top' | 'playlists' | 'recent' | 'playlist' | 'queue'
const LABELS = { liked: 'Liked', top: 'Top', playlists: 'Playlists', recent: 'Recent', playlist: 'Playlist', queue: 'Queue' }

export function WorkoutMusic({ open, editing, sheetOpen, restVisible, onOpen, onClose, onHeight }: {
  open: boolean; editing: boolean; sheetOpen: boolean; restVisible: boolean
  onOpen: () => void; onClose: () => void; onHeight: (height: number) => void
}) {
  const connections = useQuery(api.musicStore.connections)
  const online = useOnline()
  const [source, setSource] = useState<Source>('spotify')
  const connection = connections?.find(c => c.provider === source)
  const [collection, setCollection] = useState<Collection>('liked')
  const [playlist, setPlaylist] = useState<Item | null>(null)
  const [page, setPage] = useState<LibraryPage | null>(null)
  const [loading, setLoading] = useState(false), [error, setError] = useState('')
  const [deviceOpen, setDeviceOpen] = useState(false)
  const [queue, setQueue] = useState<Item[]>([]), [index, setIndex] = useState(-1), [ytPlaying, setYtPlaying] = useState(false)
  const [topDock, setTopDock] = useState(false), [mounted, setMounted] = useState(false)
  const [sheetMounted, setSheetMounted] = useState(false)
  const youtube = useRef<YouTubeHandle>(null)
  const requestId = useRef(0), sourceChosen = useRef(false)
  const spotifyLibrary = useAction(api.spotify.library), youtubeLibrary = useAction(api.youtube.library), getQueue = useAction(api.spotify.queue)
  const connected = connection?.status === 'connected'
  const spotifyConnected = connections?.some(c => c.provider === 'spotify' && c.status === 'connected') ?? false
  const youtubeConnected = connections?.some(c => c.provider === 'youtube' && c.status === 'connected') ?? false
  const spotify = useSpotify({ connected: spotifyConnected, enabled: source === 'spotify', online, onError: setError })
  const premium = connection?.premium !== false
  const item = source === 'spotify' ? spotify.item : queue[index]
  const playing = source === 'spotify' ? spotify.playback?.playing ?? false : ytPlaying
  const busy = source === 'spotify' && spotify.busy
  const video = source === 'youtube' && youtubeConnected && Boolean(item)
  const modal = sheetOpen || sheetMounted
  const dockedTop = topDock || editing || modal
  const capsuleVisible = connected && Boolean(item) && !editing && !modal
  const capsuleHeight = capsuleVisible ? 60 + (video && !dockedTop ? 252 : 0) : 0

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    // Sheet keeps its portal mounted for the closing animation. Keep music out
    // of that layer until the panel has actually left the document.
    const update = () => setSheetMounted(Boolean(document.querySelector('[role="dialog"]')))
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  useEffect(() => { onHeight(capsuleHeight) }, [capsuleHeight, onHeight])
  useEffect(() => () => onHeight(0), [onHeight])
  useEffect(() => {
    // Reserve clear space above every modal rather than hiding the playing video.
    if (video && modal) document.body.style.setProperty('--music-video-space', '268px')
    else document.body.style.removeProperty('--music-video-space')
    return () => { document.body.style.removeProperty('--music-video-space') }
  }, [video, modal])
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const outcome = params.get('music'), from = params.get('source')
    if (from === 'spotify' || from === 'youtube') { setSource(from); sourceChosen.current = true }
    if (outcome) {
      announce(outcome === 'connected' ? 'Music connected' : outcome === 'cancelled' ? 'Music connection cancelled' : 'Music could not connect. Try again in Settings.')
      for (const key of ['music', 'source', 'music_reason']) params.delete(key)
      history.replaceState(history.state, '', location.pathname + (params.size ? `?${params}` : ''))
    }
  }, [])
  useEffect(() => {
    if (!sourceChosen.current && connections) setSource(spotifyConnected ? 'spotify' : youtubeConnected ? 'youtube' : 'spotify')
    if (!youtubeConnected) { setQueue([]); setIndex(-1); setYtPlaying(false) }
  }, [connections, spotifyConnected, youtubeConnected])
  useEffect(() => { if (!online) { youtube.current?.pause(); setYtPlaying(false) } }, [online])

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

  const youtubeSkip = (delta: number, explicit: boolean) => {
    const next = index + delta
    if (next < 0 || next >= queue.length) { setYtPlaying(false); return }
    youtube.current?.load(queue[next]); setIndex(next); setYtPlaying(true)
    if (explicit) announce(delta > 0 ? 'Next song' : 'Previous song')
  }
  const transport = (command: 'play' | 'pause' | 'next' | 'previous') => {
    if (!online || busy) return
    if (source === 'youtube' && command !== 'pause' && document.visibilityState !== 'visible') return
    if (source === 'spotify') void spotify.act(command)
    else if (command === 'next' || command === 'previous') youtubeSkip(command === 'next' ? 1 : -1, true)
    else {
      if (command === 'play') youtube.current?.play(); else youtube.current?.pause()
      setYtPlaying(command === 'play'); announce(command === 'play' ? 'Music playing' : 'Music paused')
    }
  }
  const transportRef = useRef(transport); transportRef.current = transport
  useEffect(() => {
    if (!('mediaSession' in navigator) || !item) return
    navigator.mediaSession.metadata = new MediaMetadata({ title: item.title, artist: item.subtitle, album: PROVIDERS[source], artwork: item.image ? [{ src: item.image }] : [] })
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
    const actions = { play: 'play', pause: 'pause', nexttrack: 'next', previoustrack: 'previous' } as const
    for (const [action, command] of Object.entries(actions)) {
      try { navigator.mediaSession.setActionHandler(action as MediaSessionAction, () => transportRef.current(command)) } catch { /* browser does not expose this action */ }
    }
    return () => {
      for (const action of Object.keys(actions)) { try { navigator.mediaSession.setActionHandler(action as MediaSessionAction, null) } catch { /* unsupported */ } }
      navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'
    }
  }, [item, playing, source])

  const selectSource = async (p: Source) => {
    if (p === source) return
    if (source === 'spotify' && spotify.playback?.playing && online && !await spotify.act('pause')) return
    youtube.current?.pause(); setYtPlaying(false); sourceChosen.current = true
    setSource(p); setCollection('liked'); setPlaylist(null); setError(''); setDeviceOpen(false)
  }
  const chooseItem = (track: Item, list: Item[]) => {
    if (track.kind === 'playlist') { setPlaylist(track); setCollection('playlist'); return }
    setError('')
    if (source === 'spotify') {
      const start = Math.max(0, list.indexOf(track))
      void spotify.act('play', { uris: list.slice(start, start + 50).flatMap(x => x.uri ? [x.uri] : []), item: track })
    } else {
      const tracks = list.filter(x => x.kind === 'track')
      youtube.current?.load(track); setQueue(tracks); setIndex(Math.max(0, tracks.findIndex(x => x.id === track.id))); setYtPlaying(true); announce(`Playing ${track.title}`)
    }
  }
  const controlsDisabled = !online || busy || !connected || (source === 'spotify' && !premium) || !item
  const nextDisabled = controlsDisabled || (source === 'youtube' && index >= queue.length - 1)
  const controls = <div className="flex items-center justify-center gap-5 py-2" role="group" aria-label="Playback controls">
    <button className="icon-btn size-12" aria-label="Previous song" disabled={controlsDisabled || (source === 'youtube' && index <= 0)} onClick={() => transport('previous')}><SkipBack aria-hidden className="size-6" /></button>
    <button className="grid size-14 place-items-center rounded-full bg-ink text-canvas disabled:opacity-40" aria-label={playing ? 'Pause music' : 'Play music'} disabled={controlsDisabled} onClick={() => transport(playing ? 'pause' : 'play')}>{playing ? <Pause aria-hidden className="size-6" /> : <Play aria-hidden className="size-6" />}</button>
    <button className="icon-btn size-12" aria-label="Next song" disabled={nextDisabled} onClick={() => transport('next')}><SkipForward aria-hidden className="size-6" /></button>
  </div>
  const bottom = restVisible ? 88 : 12
  return <>
    {!item && <button className="mx-auto flex min-h-11 items-center gap-2 px-4 text-[13px] text-muted" onClick={onOpen} aria-label="Open workout music"><Music2 aria-hidden className="size-4" />Music</button>}
    {mounted && createPortal(<>
      {youtubeConnected && <aside className="music-ui music-pip" data-youtube-pip={video ? '' : undefined} style={{ display: video ? undefined : 'none', top: dockedTop ? `calc(var(--safe-top) + ${modal ? 12 : 76}px)` : undefined, bottom: dockedTop ? undefined : `calc(var(--safe-bottom) + ${bottom + 56}px)` }} aria-label="YouTube video">
        <YouTubePlayer ref={youtube} item={queue[index]} playing={ytPlaying} onPlaying={setYtPlaying} onEnded={() => youtubeSkip(1, false)} onError={setError} />
        <button className="flex h-11 w-full items-center justify-center gap-2 text-[12px] text-muted" onClick={() => setTopDock(!dockedTop)} aria-label={dockedTop ? 'Dock video above player' : 'Dock video to top corner'} disabled={editing || modal}>
          {dockedTop ? <MoveDownRight aria-hidden className="size-4" /> : <MoveUpRight aria-hidden className="size-4" />}Move video
        </button>
      </aside>}
      {capsuleVisible && <aside className="music-ui music-capsule" data-music-capsule style={{ bottom: `calc(var(--safe-bottom) + ${bottom}px)` }} aria-label="Workout music">
        <button className="flex h-12 min-w-0 flex-1 items-center gap-2 pl-2 text-left" aria-label={`Now playing: ${item!.title}, open music controls`} onClick={onOpen}>
          {item!.image ? <img src={item!.image} alt="" className="size-8 shrink-0 rounded-lg object-cover" /> : <Music2 aria-hidden className="size-5 shrink-0 text-muted" />}
          <span className="min-w-0"><span className="block truncate text-[13px] font-[550]">{item!.title}</span><span className={`block truncate text-[11px] ${error ? 'text-warning' : 'text-muted'}`}>{error ? source === 'spotify' && spotify.noDevice ? 'No Spotify device available' : error : item!.subtitle}</span></span>
        </button>
        {source === 'spotify' && spotify.noDevice ? <button className="h-11 shrink-0 px-3 text-[12px] text-accent" disabled={busy || !online} onClick={() => void spotify.retry()}>Retry</button> : <>
          <button className="icon-btn size-11 shrink-0" aria-label={playing ? 'Pause music' : 'Play music'} disabled={controlsDisabled} onClick={() => transport(playing ? 'pause' : 'play')}>{playing ? <Pause aria-hidden className="size-5" /> : <Play aria-hidden className="size-5" />}</button>
          <button className="icon-btn mr-0.5 size-11 shrink-0" aria-label="Next song" disabled={nextDisabled} onClick={() => transport('next')}><SkipForward aria-hidden className="size-5" /></button>
        </>}
      </aside>}
    </>, document.body)}
    <Sheet className="music-ui" open={open && !editing} onClose={onClose} title="Music" size="tall">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-raised p-1" role="group" aria-label="Music source">
        {(Object.keys(PROVIDERS) as Source[]).map(p => <button key={p} aria-pressed={source === p} onClick={() => void selectSource(p)} className={`min-h-11 rounded-lg px-2 text-[14px] font-[550] ${source === p ? 'bg-surface text-ink' : 'text-muted'}`}>{PROVIDERS[p]}</button>)}
      </div>
      {!online && <p className="mt-4 text-[13px] text-muted">Music needs a connection. Your workout is still available offline.</p>}
      {!connected ? <div className="py-6"><h3 className="text-[18px] font-[600]">Your music, between sets</h3><p className="mb-5 mt-2 text-[14px] leading-6 text-muted">{source === 'spotify' ? 'Connect to play favourites in Lift. Spotify Premium is required.' : 'Connect to play your YouTube favourites. A small video stays visible while you train.'}</p><ConnectMusic source={source} label={connection ? `Reconnect ${PROVIDERS[source]}` : undefined} /></div> : <>
        {item ? <div className="mt-5 flex min-w-0 items-center gap-3">
          {item.image && <img src={item.image} alt="" className="size-14 shrink-0 rounded-md object-cover" />}
          <div className="min-w-0"><p className="truncate text-[16px] font-[600]">{item.title}</p><p className="truncate text-[13px] text-muted">{item.subtitle}</p></div>
        </div> : <p className="mt-5 text-[14px] text-muted">Choose a favourite to set the mood.</p>}
        {controls}
        {source === 'spotify' && <>
          {!premium && <p className="my-3 text-[13px] leading-5 text-muted">Spotify Premium is needed for playback in Lift.</p>}
          {spotify.noDevice && <div className="my-3 rounded-xl border border-line p-3" data-spotify-no-device><p className="text-[13px] leading-5 text-muted">{error || 'No Spotify device available. Open Spotify on this phone once, then tap Retry.'}</p><button className="min-h-11 text-[13px] text-accent" disabled={!online || busy} onClick={() => void spotify.retry()}>Retry</button></div>}
          <button className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-[13px] text-muted" disabled={!online || busy} aria-expanded={deviceOpen} onClick={async () => {
            setDeviceOpen(!deviceOpen)
            if (!deviceOpen) { try { await spotify.listDevices() } catch (e) { setError(musicError(e)) } }
          }}><span className="flex min-w-0 items-center gap-2"><Speaker aria-hidden className="size-4 shrink-0" /><span className="truncate">{spotify.playback?.device ? `Listening on ${spotify.playback.device}` : busy ? 'Finding playback device…' : 'Playback devices'}</span></span><ChevronRight aria-hidden className="size-4" /></button>
          {deviceOpen && <div className="my-2 rounded-xl border border-line p-3">
            {!spotify.devices.length && <p className="text-[13px] leading-5 text-muted">No active devices. Open Spotify once, then Retry.</p>}
            {spotify.devices.map(d => <button key={d.id} disabled={d.restricted || busy || !online} onClick={() => { void spotify.chooseDevice(d.id); setDeviceOpen(false) }} className="flex min-h-12 w-full items-center justify-between gap-2 text-left text-[14px]"><span>{d.name}{d.restricted ? ' · unavailable' : ''}</span>{d.active && <span className="text-accent">Active</span>}</button>)}
          </div>}
          {premium && spotify.support && <button className="min-h-11 w-full text-left text-[13px] text-accent" disabled={!online || busy} onClick={() => void spotify.useBrowser()}>{spotify.browserDevice ? 'Play in Lift · this browser' : 'Try Lift browser player'}</button>}
          {spotify.support === false && <p className="my-2 text-[12px] leading-5 text-muted">This browser cannot run the Spotify player. Lift can control an active Spotify app or speaker without leaving this page.</p>}
          {spotify.sdkFailure && <p className="my-2 text-[12px] leading-5 text-muted">{spotify.sdkFailure}. Using Spotify Connect when available.</p>}
        </>}
        {source === 'youtube' && <p className="my-3 text-[12px] leading-5 text-muted">Video stays visible while you train. Audio pauses if you lock your screen or leave Lift, including on iOS.</p>}
        <div role="group" aria-label="Music favourites" className="mt-4 flex flex-wrap gap-1 border-b border-line pb-2">
          {(['liked', ...(source === 'spotify' ? ['top'] as const : []), 'playlists', ...(source === 'spotify' ? ['recent'] as const : []), 'queue'] as Collection[]).map(c => <button key={c} aria-pressed={collection === c} onClick={() => { setCollection(c); setPlaylist(null) }} className={`min-h-11 rounded-full px-3 text-[13px] ${collection === c ? 'bg-raised text-ink' : 'text-muted'}`}>{LABELS[c]}</button>)}
        </div>
        {playlist && <div className="mt-3"><button className="flex min-h-11 items-center gap-1 text-[13px] text-muted" onClick={() => { setPlaylist(null); setCollection('playlists') }}><ChevronLeft aria-hidden className="size-4" />Playlists</button><h3 className="text-[18px] font-[600]">{playlist.title}</h3>{source === 'spotify' && premium && <button className="btn btn-secondary my-3 w-full" disabled={!online || busy} onClick={() => void spotify.act('play', { contextUri: playlist.uri, item: playlist })}>Play playlist</button>}</div>}
        {page?.notice && <p className="mt-3 text-[13px] leading-5 text-muted">{page.notice}</p>}
        {loading && !page && <p className="py-6 text-[14px] text-muted" role="status">Loading favourites…</p>}
        {!loading && page?.items.length === 0 && <div className="py-8 text-center"><ListMusic aria-hidden className="mx-auto mb-2 size-6 text-muted" /><p className="text-[14px] text-muted">{collection === 'queue' ? 'Nothing queued yet.' : 'No favourites in this list yet.'}</p></div>}
        <ul className="mt-2">{page?.items.map((track, i) => <li key={`${track.id}-${i}`} className="flex min-h-[64px] items-center gap-2 border-b border-line">
          <button className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 text-left" disabled={!online || busy || (track.kind === 'track' && source === 'spotify' && !premium)} aria-label={`${track.kind === 'playlist' ? 'Open playlist' : 'Play'} ${track.title}, ${track.subtitle}`} onClick={() => chooseItem(track, page.items)}>
            {track.image ? <img loading="lazy" src={track.image} alt="" className="size-10 shrink-0 rounded object-cover" /> : <span className="grid size-10 shrink-0 place-items-center rounded bg-raised"><Music2 aria-hidden className="size-4 text-muted" /></span>}
            <span className="min-w-0"><span className="block truncate text-[14px] font-[550]">{track.title}</span><span className="block truncate text-[12px] text-muted">{track.subtitle}</span></span>
          </button>
        </li>)}</ul>
        {page?.next && <button className="btn btn-secondary mt-4 w-full" disabled={!online || loading} onClick={() => void load(page.next)}>{loading ? 'Loading…' : 'Load more'}</button>}
      </>}
      {item && <details className="mt-4 text-[12px] text-muted"><summary className="min-h-11 cursor-pointer py-3">More</summary><a className="inline-flex min-h-11 items-center gap-2 underline" href={item.url} target="_blank" rel="noreferrer">Open in {PROVIDERS[source]}<ExternalLink aria-hidden className="size-3" /></a></details>}
      {error && !(source === 'spotify' && spotify.noDevice) && <div className="mt-4 rounded-xl border border-line p-3"><p className="text-[13px] leading-5 text-muted">{error}</p><button className="mt-1 min-h-11 text-[13px] text-accent" disabled={!online || loading || busy} onClick={() => source === 'spotify' && item ? void spotify.retry() : void load()}>Try again</button></div>}
    </Sheet>
  </>
}
