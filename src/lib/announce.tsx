import { useSyncExternalStore } from 'react'

// One polite live region for the whole app. Short, meaningful sentences only.
let message = ''
let seq = 0
const listeners = new Set<() => void>()

export function announce(text: string) {
  // Toggle a zero-width suffix so repeating the same sentence is announced again.
  seq++
  message = text + (seq % 2 ? '​' : '')
  listeners.forEach((l) => l())
}

export function Announcer() {
  const text = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => message,
    () => '',
  )
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </div>
  )
}
