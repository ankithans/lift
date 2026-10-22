import type { MusicItem } from '../../../convex/music/model'

export const PROVIDERS = { spotify: 'Spotify', youtube: 'YouTube Music' } as const
export type Source = keyof typeof PROVIDERS
export type Item = MusicItem
export function musicError(e: unknown) {
  const code = typeof e === 'object' && e && 'data' in e ? String(e.data) : String(e)
  for (const [key, message] of Object.entries({
    SIGN_IN: 'Sign in to connect your music.', NOT_CONFIGURED: 'This music connection is not configured yet.',
    RECONNECT: 'Your music access expired or was revoked. Reconnect in Settings.',
    RATE_LIMITED: 'Music is taking a short break. Try again in a minute.',
    PREMIUM: 'Spotify Premium is needed for playback here. You can still browse and open favourites in Spotify.',
    NO_DEVICE: 'Open Spotify on a device, or choose “Play on this browser” below.',
    REFRESH_BUSY: 'Your music connection is refreshing. Try again shortly.',
    UNAVAILABLE: 'The provider cannot play this here. Check your device, subscription or open it in the music app.',
    INVALID_RETURN: 'This Lift address is not registered for music connections.',
  })) if (code.includes(key)) return message
  return 'Could not reach your music. Check your connection and try again.'
}

type SpotifyListener = (event: { device_id?: string; message?: string }) => void
export interface SpotifyPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  activateElement(): Promise<void>
  addListener(event: string, cb: SpotifyListener): boolean
}
interface YTPlayer {
  loadVideoById(id: string): void
  playVideo(): void
  pauseVideo(): void
  destroy(): void
}
declare global {
  interface Window {
    Spotify?: { Player: new (options: { name: string; getOAuthToken: (cb: (token: string) => void) => void; volume: number }) => SpotifyPlayer }
    onSpotifyWebPlaybackSDKReady?: () => void
    YT?: { Player: new (node: HTMLElement, options: { width: string; height: string; videoId: string; playerVars: Record<string, string | number>; events: { onReady: () => void; onStateChange: (e: { data: number }) => void; onError: () => void; onAutoplayBlocked: () => void } }) => YTPlayer }
    onYouTubeIframeAPIReady?: () => void
  }
}
let spotifyLoad: Promise<void> | undefined
export function loadSpotify() {
  if (window.Spotify) return Promise.resolve()
  return spotifyLoad ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const timeout = setTimeout(() => { spotifyLoad = undefined; script.remove(); reject(new Error('SDK timeout')) }, 20_000)
    window.onSpotifyWebPlaybackSDKReady = () => { clearTimeout(timeout); resolve() }
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.onerror = () => { clearTimeout(timeout); spotifyLoad = undefined; script.remove(); reject(new Error('SDK unavailable')) }
    document.head.appendChild(script)
  })
}
let youtubeLoad: Promise<void> | undefined
export function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve()
  return youtubeLoad ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const timeout = setTimeout(() => { youtubeLoad = undefined; script.remove(); reject(new Error('Player timeout')) }, 20_000)
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); resolve() }
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = () => { clearTimeout(timeout); youtubeLoad = undefined; script.remove(); reject(new Error('Player unavailable')) }
    document.head.appendChild(script)
  })
}
