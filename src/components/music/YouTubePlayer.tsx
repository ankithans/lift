import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { loadYouTube, type Item, type YTPlayer } from './providers'

export interface YouTubeHandle { play: () => void; pause: () => void; load: (item: Item) => void }

/** Kept in a body portal. A 200×200 viewport is YouTube's absolute minimum. */
export function YouTubePlayer({ item, playing, onPlaying, onEnded, onError, ref }: {
  item?: Item; playing: boolean; onPlaying: (p: boolean) => void; onEnded: () => void
  onError: (message: string) => void; ref: Ref<YouTubeHandle>
}) {
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null), ready = useRef(false)
  const latest = useRef({ item, playing, onPlaying, onEnded, onError })
  latest.current = { item, playing, onPlaying, onEnded, onError }
  const loaded = useRef(''), switching = useRef(false)
  const initialVideo = useRef('')
  if (item && !initialVideo.current) initialVideo.current = item.id
  const initialId = initialVideo.current
  useImperativeHandle(ref, () => ({
    play: () => { if (ready.current) player.current?.playVideo() },
    pause: () => { if (ready.current) player.current?.pauseVideo() },
    load: next => {
      if (!ready.current || !player.current) return
      loaded.current = next.id; switching.current = true; player.current.loadVideoById(next.id)
    },
  }), [])
  useEffect(() => {
    if (!initialId) { void loadYouTube().catch(() => {}); return }
    let disposed = false
    const node = document.createElement('div')
    host.current?.appendChild(node)
    void loadYouTube().then(() => {
      if (disposed || !window.YT) return
      player.current = new window.YT.Player(node, { width: '200', height: '200', videoId: initialId,
        playerVars: { playsinline: 1, origin: location.origin, autoplay: 0, controls: 1 },
        events: {
          onReady: () => {
            if (disposed) return
            ready.current = true
            const current = latest.current
            loaded.current = initialId
            if (current.item && current.item.id !== initialId) { switching.current = true; loaded.current = current.item.id; player.current?.loadVideoById(current.item.id) }
            if (current.playing && document.visibilityState === 'visible') player.current?.playVideo()
          },
          onStateChange: e => {
            if (disposed) return
            if (e.data === 0 && !switching.current) latest.current.onEnded()
            else if (e.data === 1) { switching.current = false; latest.current.onPlaying(true) }
            else if (e.data === 2 && !switching.current) latest.current.onPlaying(false)
          },
          onError: () => { if (!disposed) { switching.current = false; latest.current.onPlaying(false); latest.current.onError('This video cannot play in Lift. Choose another track.') } },
          onAutoplayBlocked: () => { if (!disposed) { switching.current = false; latest.current.onPlaying(false); latest.current.onError('Tap Play in the visible YouTube player to allow audio.') } },
        },
      })
    }).catch(() => { if (!disposed) latest.current.onError('YouTube could not load. Check your connection and try again.') })
    // YouTube disallows hidden/background players. Modal/keypad docking does not pause.
    const visibility = () => { if (document.visibilityState !== 'visible') { player.current?.pauseVideo(); latest.current.onPlaying(false) } }
    document.addEventListener('visibilitychange', visibility)
    return () => { disposed = true; ready.current = false; document.removeEventListener('visibilitychange', visibility); player.current?.destroy(); player.current = null; loaded.current = ''; node.remove() }
  }, [initialId])
  useEffect(() => {
    if (!ready.current || !player.current || !item) return
    if (loaded.current !== item.id) { switching.current = true; loaded.current = item.id; player.current.loadVideoById(item.id) }
    if (playing && document.visibilityState === 'visible') player.current.playVideo(); else player.current.pauseVideo()
  }, [item?.id, playing])
  return <div ref={host} className="h-[200px] w-[200px] bg-black" aria-label="YouTube video player" />
}
