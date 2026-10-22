import { useEffect, useState } from 'react'

/** Re-render on an interval, aligned to wall-clock seconds. */
export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(Date.now())
      timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs) + 5)
    }
    timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs) + 5)
    return () => clearTimeout(timer)
  }, [intervalMs, enabled])
  return now
}
