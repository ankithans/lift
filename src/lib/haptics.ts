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
