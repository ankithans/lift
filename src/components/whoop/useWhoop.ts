import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { WhoopWeek } from '../../../convex/whoop/model'
import { useMe } from '#/lib/me'
import { useOnline } from '#/lib/convex'
import { useNow } from '#/lib/useNow'
import { toast } from '#/lib/toast'

const PREFIX = 'lift:whoop:'
export type WhoopView = { data: WhoopWeek | undefined; online: boolean; stale: boolean; timezone: string; now: number }
export function clearWhoopCache() {
  try { Object.keys(localStorage).filter(k => k.startsWith(PREFIX) && !k.includes('dismiss')).forEach(k => localStorage.removeItem(k)) } catch { /* Private storage may be unavailable. */ }
}
export function useWhoop(start: number, end: number): WhoopView {
  const me = useMe()
  const timezone = me.profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const localNow = new Date()
  const todayAt = new Date(localNow.getFullYear(), localNow.getMonth(), localNow.getDate()).getTime()
  const data = useQuery(api.whoop.week, { start, end, timezone, todayAt })
  const online = useOnline()
  const now = useNow(60_000)
  const key = `${PREFIX}${me.userId}:${start}:${timezone}`
  const [cached, setCached] = useState<WhoopWeek>()
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as WhoopWeek | null
      setCached(saved && Array.isArray(saved.days) && Array.isArray(saved.trend) ? saved : undefined)
    } catch { setCached(undefined) }
  }, [key])
  useEffect(() => {
    if (!data) return
    if (data.status === 'disconnected') { clearWhoopCache(); setCached(undefined); return }
    try {
      localStorage.setItem(key, JSON.stringify(data))
      localStorage.setItem(`${PREFIX}latest`, JSON.stringify(data))
      // Keep a bounded cache (8 weeks), with no tokens or provider identifiers.
      const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX) && !k.includes('dismiss') && !k.endsWith(':latest')).sort((a,b) => Number(b.split(':')[3])-Number(a.split(':')[3]))
      keys.slice(8).forEach(k => localStorage.removeItem(k))
    } catch { /* Display live data even when the browser cannot cache it. */ }
    setCached(data)
  }, [data, key])
  useEffect(() => {
    const url = new URL(location.href)
    const outcome = url.searchParams.get('whoop')
    if (!outcome) return
    const reason = url.searchParams.get('whoop_reason')
    if (import.meta.env.DEV && reason && /^(authorize|token|profile|store)_(\d{3}|invalid_response)$/.test(reason)) console.warn('WHOOP callback stage:', reason)
    toast(outcome === 'connected' ? 'WHOOP connected. Importing your last 60 days.' : outcome === 'cancelled' ? 'WHOOP connection cancelled.' : 'Could not connect WHOOP. Please try again.', { tone: outcome === 'error' ? 'error' : undefined })
    url.searchParams.delete('whoop')
    url.searchParams.delete('whoop_reason')
    history.replaceState(history.state, '', url)
  }, [])
  const current = data ?? (!online ? cached : undefined)
  return { data: current, online, timezone, now, stale: !online || !current?.lastSyncedAt || now - current.lastSyncedAt > 90 * 60_000 || current.status === 'reconnect' || current.status === 'error' }
}
export const dayKey = (at: number, timezone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
export const sleepLabel = (ms?: number) => ms === undefined ? '—' : `${Math.floor(ms / 3600000)}h ${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}`
export const valueLabel = (n?: number, unit = '', digits = 0) => n === undefined ? '—' : `${n.toFixed(digits)}${unit}`
export const bandColor = (n?: number) => n === undefined ? 'var(--color-muted)' : n >= 67 ? 'var(--whoop-green, #75d99b)' : n >= 34 ? 'var(--whoop-yellow, #eed477)' : 'var(--whoop-red, #ff8e8e)'
export const STRAIN_COLOR = 'var(--whoop-blue, #93baff)'
