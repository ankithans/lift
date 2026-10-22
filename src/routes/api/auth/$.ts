import { createFileRoute } from '@tanstack/react-router'

// OAuth runs on lift.ankithans.com (CUSTOM_AUTH_SITE_URL) so Google shows our domain;
// requests are forwarded verbatim (cookies, redirects) to the Convex HTTP actions.
const upstream = import.meta.env.VITE_CONVEX_SITE_URL as string

async function proxy({ request }: { request: Request }) {
  const url = new URL(request.url)
  const headers = new Headers(request.headers)
  headers.delete('host')
  const res = await fetch(upstream + url.pathname + url.search, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    redirect: 'manual',
  })
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers })
}

export const Route = createFileRoute('/api/auth/$')({
  server: { handlers: { GET: proxy, POST: proxy } },
})
