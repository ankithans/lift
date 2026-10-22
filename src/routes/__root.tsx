import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { useEffect, useState, type ReactNode } from 'react'
import { getConvex } from '#/lib/convex'
import { Splash } from '#/components/Splash'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content' },
      { title: 'Lift' },
      { name: 'description', content: 'A quiet, fast workout log. Plan, lift, progress.' },
      { name: 'theme-color', content: '#000000' },
      { name: 'color-scheme', content: 'dark' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: 'Lift' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'preconnect', href: 'https://app-static.builtwithscience.com' },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => {})
    // Interrupted view transitions reject harmlessly; keep them out of error reports.
    const onRejection = (e: PromiseRejectionEvent) => {
      if (String(e.reason?.message ?? e.reason).includes('Transition was skipped')) e.preventDefault()
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [])
  if (!mounted) return <Splash />
  return (
    <ConvexAuthProvider client={getConvex()}>
      <Outlet />
    </ConvexAuthProvider>
  )
}
