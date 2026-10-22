import { useEffect, useState } from 'react'
import { ConvexReactClient } from 'convex/react'

const url = import.meta.env.VITE_CONVEX_URL as string | undefined

let client: ConvexReactClient | null = null

/** Browser-only Convex client (the app renders client-side behind auth). */
export function getConvex() {
  if (!url) throw new Error('VITE_CONVEX_URL is not set')
  client ??= new ConvexReactClient(url, { verbose: false })
  return client
}

/** Public MCP endpoint for AI agents. */
export const MCP_URL =
  (import.meta.env.VITE_MCP_URL as string | undefined) ??
  `${(import.meta.env.VITE_CONVEX_SITE_URL as string | undefined) ?? ''}/mcp`

/** True while the realtime connection is up (debounced so brief blips don't flash). */
export function useOnline() {
  const [socket, setSocket] = useState(true)
  const [network, setNetwork] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const client = getConvex()
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = (s: { isWebSocketConnected: boolean }) => {
      clearTimeout(timer)
      if (s.isWebSocketConnected) setSocket(true)
      else timer = setTimeout(() => setSocket(false), 2000)
    }
    const unsubscribe = client.subscribeToConnectionState(update)
    update(client.connectionState())
    // The browser knows about lost signal immediately; a half-open socket can take a while.
    const on = () => setNetwork(true)
    const off = () => setNetwork(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      unsubscribe()
      clearTimeout(timer)
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return socket && network
}
