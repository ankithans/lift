import { useEffect } from 'react'

/** Per-screen document title, e.g. "Push · Lift". */
export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return
    document.title = `${title} · Lift`
  }, [title])
}
