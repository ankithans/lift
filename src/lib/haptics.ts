/** Tiny haptic taps where supported (Android Chrome). Silently no-ops elsewhere. */
export function tap(kind: 'light' | 'success' | 'heavy' = 'light') {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
  try {
    navigator.vibrate(kind === 'light' ? 8 : kind === 'success' ? [10, 40, 18] : 24)
  } catch {
    // ignore
  }
}

let ctx: AudioContext | null = null

/** Call from a tap handler: browsers (iOS especially) only allow audio started by a gesture. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    // ignore
  }
}

/** Ask once (from a gesture) for permission to alert when rest ends while Lift is in the background. */
export function askNotifyPermission() {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
    if (localStorage.getItem('lift:notify-asked')) return
    localStorage.setItem('lift:notify-asked', '1')
    void Notification.requestPermission()
  } catch {
    // ignore
  }
}

/** System notification via the service worker (works while the tab is hidden). */
export async function notify(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, tag: 'lift-rest', icon: '/icon-192.png', badge: '/icon-192.png', silent: false })
    else new Notification(title, { body, tag: 'lift-rest', icon: '/icon-192.png' })
  } catch {
    // ignore
  }
}

/** Short soft chime for rest completion. */
export function chime() {
  try {
    ctx ??= new AudioContext()
    const now = ctx.currentTime
    for (const [i, f] of [880, 1320].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      gain.gain.setValueAtTime(0.0001, now + i * 0.12)
      gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.35)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.12)
      osc.stop(now + i * 0.12 + 0.4)
    }
  } catch {
    // ignore
  }
}
