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
  useEffect(() => {
    let disposed = false
    const node = document.createElement('div')
    host.current?.appendChild(node)
    void loadYouTube().then(() => {
      if (disposed || !window.YT) return
      player.current = new window.YT.Player(node, { width: '100%', height: '200', videoId: latest.current.item.id,
        playerVars: { playsinline: 1, origin: location.origin, autoplay: 0, controls: 1 },
        events: {
          onReady: () => { loaded.current = latest.current.item.id; if (latest.current.playing && document.visibilityState === 'visible') player.current?.playVideo() },
          onStateChange: e => { if (disposed) return; if (e.data === 0) latest.current.onEnded(); else if (e.data === 1 || e.data === 2) latest.current.onPlaying(e.data === 1) },
          onError: () => { latest.current.onPlaying(false); latest.current.onError('This video cannot play in Lift. Choose another track or open it in YouTube Music.') },
          onAutoplayBlocked: () => { latest.current.onPlaying(false); latest.current.onError('Tap play in the visible YouTube player to start audio.') },
        },
      })
    }).catch(() => latest.current.onError('YouTube could not load. Try again or open YouTube Music.'))
    const pause = () => { player.current?.pauseVideo(); latest.current.onPlaying(false) }
    const visibility = () => { if (document.visibilityState !== 'visible') pause() }
    document.addEventListener('visibilitychange', visibility)
    const observer = new IntersectionObserver(entries => { if (entries.some(e => e.intersectionRatio < 0.95)) pause() }, { threshold: [0, 0.95, 1] })
    if (host.current) observer.observe(host.current)
    return () => { disposed = true; observer.disconnect(); document.removeEventListener('visibilitychange', visibility); player.current?.pauseVideo(); player.current?.destroy(); player.current = null; loaded.current = ''; node.remove() }
  }, [])
  useEffect(() => {
    if (!player.current || !loaded.current) return
    if (loaded.current !== item.id) { loaded.current = item.id; player.current.loadVideoById(item.id) }
    if (playing && document.visibilityState === 'visible') player.current.playVideo(); else player.current.pauseVideo()
  }, [item.id, playing])
  return <div ref={host} className="h-[200px] min-w-[200px] w-full overflow-hidden rounded-xl bg-black" aria-label="YouTube video player" />
}
