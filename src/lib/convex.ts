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
