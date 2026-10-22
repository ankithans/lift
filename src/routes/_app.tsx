import { Outlet, createFileRoute, useNavigate, useRouterState } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../../convex/_generated/api'
import { AppShell } from '#/components/AppShell'
import { Splash } from '#/components/Splash'
import { MeProvider } from '#/lib/me'
import { Toaster } from '#/lib/toast'
import { Announcer } from '#/lib/announce'
import { replayOutbox } from '#/lib/outbox'
import { useOnline } from '#/lib/convex'
import { OfflineWorkout } from '#/components/OfflineWorkout'

export const Route = createFileRoute('/_app')({
  ssr: false,
  component: AppLayout,
})

function AppLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const me = useQuery(api.profile.me, isAuthenticated ? {} : 'skip')
  const ensure = useMutation(api.profile.ensure)
  const update = useMutation(api.profile.update)

  const online = useOnline()
  useEffect(() => {
    if (!isLoading && !isAuthenticated && online) navigate({ to: '/signin', replace: true })
  }, [isLoading, isAuthenticated, online, navigate])

  // Remember the unit so the offline screen can format weights without the server.
  useEffect(() => {
    if (me?.profile?.unit) localStorage.setItem('lift:unit', me.profile.unit)
  }, [me?.profile?.unit])

  // Replay set changes a previous session couldn't deliver (offline reload, killed tab).
  useEffect(() => {
    if (isAuthenticated) void replayOutbox()
  }, [isAuthenticated])

  useEffect(() => {
    if (me && !me.profile) {
      void ensure({}).then(() =>
        update({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      )
    }
  }, [me, ensure, update])

  useEffect(() => {
    if (me?.profile && !me.profile.activeProgramId && !me.profile.onboardedAt && pathname !== '/welcome') {
      navigate({ to: '/welcome', replace: true })
    }
  }, [me, pathname, navigate])

  // No signal and no session yet (app reopened in a basement gym): show what we have locally.
  if (!online && (isLoading || !me)) return <OfflineWorkout />
  if (isLoading || !isAuthenticated || !me || !me.profile) return <Splash />
  // Decide onboarding before rendering, so new accounts never flash an empty Train screen.
  if (!me.profile.activeProgramId && !me.profile.onboardedAt && pathname !== '/welcome') return <Splash />

  return (
    <MeProvider value={me}>
      <AppShell>
        <Outlet />
      </AppShell>
      <Toaster />
      <Announcer />
    </MeProvider>
  )
}
