import { createFileRoute } from '@tanstack/react-router'

// Public MCP endpoint (https://lift.ankithans.com/mcp) proxied to the Convex HTTP action.
const target = `${import.meta.env.VITE_CONVEX_SITE_URL as string}/mcp`
const FORWARD = ['authorization', 'content-type', 'accept', 'mcp-protocol-version', 'mcp-session-id']

async function proxy({ request }: { request: Request }) {
  const headers = new Headers()
  for (const h of FORWARD) {
    const v = request.headers.get(h)
    if (v) headers.set(h, v)
  }
  const res = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'OPTIONS' ? undefined : await request.text(),
  })
  return new Response(res.body, { status: res.status, headers: res.headers })
}

export const Route = createFileRoute('/mcp')({
  server: { handlers: { GET: proxy, POST: proxy, OPTIONS: proxy } },
})
