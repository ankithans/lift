import { useEffect, useRef } from 'react'
import { loadYouTube, type Item } from './providers'

/** The official player is visible, unobstructed and >=200×200. Never background audio. */
export function YouTubePlayer({ item, playing, onPlaying, onEnded, onError }: {
  item: Item; playing: boolean; onPlaying: (p: boolean) => void; onEnded: () => void; onError: (message: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const player = useRef<InstanceType<NonNullable<Window['YT']>['Player']> | null>(null)
  const latest = useRef({ item, playing, onPlaying, onEnded, onError })
  latest.current = { item, playing, onPlaying, onEnded, onError }
  const loaded = useRef('')
  const switching = useRef(false)
  useEffect(() => {
    let disposed = false
    const node = document.createElement('div')
    host.current?.appendChild(node)
    void loadYouTube().then(() => {
      if (disposed || !window.YT) return
      const initialId = latest.current.item.id
      player.current = new window.YT.Player(node, { width: '100%', height: '200', videoId: initialId,
        playerVars: { playsinline: 1, origin: location.origin, autoplay: 0, controls: 1 },
        events: {
          onReady: () => {
            loaded.current = latest.current.item.id
            if (initialId !== loaded.current) { switching.current = true; player.current?.loadVideoById(loaded.current) }
            if (latest.current.playing && document.visibilityState === 'visible') player.current?.playVideo(); else player.current?.pauseVideo()
          },
          onStateChange: e => {
            if (disposed) return
            if (e.data === 0 && !switching.current) latest.current.onEnded()
            else if (e.data === 1) { switching.current = false; latest.current.onPlaying(true) }
            // loadVideoById can emit the old video's PAUSED event before the new
            // video starts. That event must not cancel the user's skip intent.
            else if (e.data === 2 && !switching.current) latest.current.onPlaying(false)
          },
          onError: () => { if (!disposed) { switching.current = false; latest.current.onPlaying(false); latest.current.onError('This video cannot play in Lift. Choose another track or open it in YouTube Music.') } },
          onAutoplayBlocked: () => { if (!disposed) { switching.current = false; latest.current.onPlaying(false); latest.current.onError('Tap play in the visible YouTube player to start audio.') } },
        },
      })
    }).catch(() => { if (!disposed) latest.current.onError('YouTube could not load. Try again or open YouTube Music.') })
    const pause = () => { player.current?.pauseVideo(); latest.current.onPlaying(false) }
    const visibility = () => { if (document.visibilityState !== 'visible') pause() }
    document.addEventListener('visibilitychange', visibility)
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.intersectionRatio < 0.95)) pause() }, { threshold: [0, 0.95, 1] })
    if (host.current) observer.observe(host.current)
    return () => { disposed = true; observer.disconnect(); document.removeEventListener('visibilitychange', visibility); player.current?.pauseVideo(); player.current?.destroy(); player.current = null; loaded.current = ''; node.remove() }
  }, [])
  useEffect(() => {
    if (!player.current || !loaded.current) return
    if (loaded.current !== item.id) { switching.current = true; loaded.current = item.id; player.current.loadVideoById(item.id) }
    if (playing && document.visibilityState === 'visible') player.current.playVideo(); else player.current.pauseVideo()
  }, [item.id, playing])
  return <div ref={host} className="h-[200px] min-w-[200px] w-full overflow-hidden rounded-xl bg-black" aria-label="YouTube video player" />
}
