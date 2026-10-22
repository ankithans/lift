/**
 * Back button closes overlays (sheets, keypad) instead of leaving the page.
 *
 * While any overlay is open we keep exactly one extra history entry. Pressing
 * Back pops it: we close the top-most overlay and, if others remain, push it
 * again. Closing overlays from the UI removes the entry with history.back().
 * Changes are reconciled on a timeout so "close one, open another" in the same
 * tick (menu → picker) doesn't bounce the history.
 */
type Overlay = { id: number; close: () => void }

const stack: Overlay[] = []
const countListeners = new Set<() => void>()
const emitCount = () => countListeners.forEach((l) => l())

/** Number of open overlays (sheets, keypad), for layout decisions like toast placement. */
export function subscribeOverlays(l: () => void) {
  countListeners.add(l)
  return () => {
    countListeners.delete(l)
  }
}
export const overlayCount = () => stack.length
let pushed = false
let ignoreNextPop = false
let scheduled = false
let nextId = 1
let listening = false

function reconcile() {
  scheduled = false
  if (typeof window === 'undefined') return
  if (stack.length > 0 && !pushed) {
    window.history.pushState({ ...(window.history.state ?? {}), liftOverlay: true }, '')
    pushed = true
  } else if (stack.length === 0 && pushed) {
    pushed = false
    // If the app navigated while the overlay was open, our entry is no longer
    // current; going back would leave the new page. Leave history alone then.
    if (window.history.state?.liftOverlay) {
      ignoreNextPop = true
      window.history.back()
    }
  }
}

function schedule() {
  if (scheduled) return
  scheduled = true
  setTimeout(reconcile, 0)
}

function onPop() {
  if (ignoreNextPop) {
    ignoreNextPop = false
    return
  }
  if (!pushed) return
  pushed = false
  const top = stack[stack.length - 1]
  top?.close()
  schedule()
}

/** Register an open overlay. Returns a function to call when it closes. */
export function openOverlay(close: () => void) {
  if (!listening && typeof window !== 'undefined') {
    window.addEventListener('popstate', onPop)
    listening = true
  }
  const entry = { id: nextId++, close }
  stack.push(entry)
  // Push synchronously so a Back pressed immediately can never leave the page.
  if (!pushed && typeof window !== 'undefined') {
    window.history.pushState({ ...(window.history.state ?? {}), liftOverlay: true }, '')
    pushed = true
  }
  schedule()
  emitCount()
  return () => {
    const i = stack.findIndex((o) => o.id === entry.id)
    if (i >= 0) stack.splice(i, 1)
    schedule()
    emitCount()
  }
}
