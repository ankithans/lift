import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

declare const __BUILD_ID__: string

const CHECK_MS = 15 * 60_000

// Reloading mid-workout would drop keypad drafts and timers; wait until they leave it.
const inWorkout = () => location.pathname.startsWith('/workout')

/**
 * Keeps long-lived tabs on the current deploy. A tab left open for days otherwise keeps
 * running whatever build it loaded, including bugs already fixed on the server side.
 * Hidden tabs reload as soon as a new build is seen; a visible one waits for its next
 * navigation (or for being hidden) so nothing changes under the user's finger.
 */
export function useFreshBuild() {
  const router = useRouter()
  useEffect(() => {
    if (__BUILD_ID__ === 'dev') return
    let stale = false
    const reloadIfIdle = () => {
      if (stale && document.hidden && !inWorkout()) location.reload()
    }
    const check = async () => {
      if (stale || !navigator.onLine) return
      try {
        const res = await fetch('/version.json', { cache: 'no-store' })
        if (!res.ok) return
        const { id } = (await res.json()) as { id?: string }
        stale = Boolean(id) && id !== __BUILD_ID__
      } catch {
        return
      }
      reloadIfIdle()
    }
    const onVisibility = () => (document.hidden ? reloadIfIdle() : void check())
    const unsubscribe = router.subscribe('onResolved', ({ pathChanged }) => {
      if (stale && pathChanged && !inWorkout()) location.reload()
    })
    const timer = setInterval(() => void check(), CHECK_MS)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      unsubscribe()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [router])
}
