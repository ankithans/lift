import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth } from 'convex/react'
import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, Loader2, Mail } from 'lucide-react'
import { Logo } from '#/components/Logo'

export const Route = createFileRoute('/signin')({
  ssr: false,
  component: SignIn,
})

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function SignIn() {
  const { signIn } = useAuthActions()
  const { isAuthenticated, isLoading } = useConvexAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'choose' | 'email'>('choose')
  const [flow, setFlow] = useState<'signIn' | 'signUp'>('signIn')
  const [busy, setBusy] = useState<null | 'google' | 'email'>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) navigate({ to: '/', replace: true })
  }, [isAuthenticated, navigate])

  async function google() {
    setBusy('google')
    setError(null)
    try {
      await signIn('google', { redirectTo: window.location.origin + '/' })
    } catch {
      setBusy(null)
      setError('Google sign-in is unavailable right now. Try email instead.')
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    data.set('flow', flow)
    setBusy('email')
    setError(null)
    try {
      await signIn('password', data)
    } catch {
      setError(flow === 'signIn' ? 'That email and password don’t match. New here? Create an account.' : 'Could not create the account. Use 8+ characters for the password.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-black">
      {/* Quiet backdrop: a single faint mint horizon */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[55dvh] bg-[radial-gradient(120%_70%_at_50%_0%,#b8f4d014,transparent_70%)]" />
      <div className="relative mx-auto flex min-h-dvh max-w-[420px] flex-col px-6 pb-[calc(var(--safe-bottom)+28px)] pt-[calc(var(--safe-top)+18vh)]">
        <div className="animate-rise">
          <Logo size={52} />
          <h1 className="mt-8 text-[44px] font-[720] leading-[1] tracking-[-0.045em]">Lift.</h1>
          <p className="mt-3 max-w-[300px] text-[17px] leading-[25px] text-muted">
            Your program, every set, every PR. Quiet, fast, and yours.
          </p>
        </div>

        <div className="mt-auto space-y-3 pt-12 animate-rise [animation-delay:80ms]">
          {mode === 'choose' ? (
            <>
              <button
                onClick={google}
                disabled={busy !== null || isLoading}
                className="btn w-full bg-white text-black hover:bg-white/90"
              >
                {busy === 'google' ? <Loader2 className="size-5 animate-spin" /> : <GoogleMark />}
                Continue with Google
              </button>
              <button onClick={() => setMode('email')} className="btn btn-secondary w-full">
                <Mail className="size-[18px]" strokeWidth={1.75} />
                Continue with email
              </button>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-3 animate-fade">
              <input name="email" type="email" autoComplete="email" required placeholder="Email" className="field" />
              <input
                name="password"
                type="password"
                autoComplete={flow === 'signIn' ? 'current-password' : 'new-password'}
                required
                minLength={8}
                placeholder="Password"
                className="field"
              />
              {flow === 'signUp' && (
                <input name="name" type="text" autoComplete="given-name" placeholder="First name (optional)" className="field" />
              )}
              <button type="submit" disabled={busy !== null} className="btn btn-primary w-full">
                {busy === 'email' ? <Loader2 className="size-5 animate-spin" /> : null}
                {flow === 'signIn' ? 'Sign in' : 'Create account'}
                {busy !== 'email' && <ArrowRight className="size-[18px]" />}
              </button>
              <div className="flex items-center justify-between pt-1 text-[14px]">
                <button type="button" className="text-muted hover:text-ink" onClick={() => setMode('choose')}>
                  Back
                </button>
                <button
                  type="button"
                  className="text-accent"
                  onClick={() => {
                    setFlow(flow === 'signIn' ? 'signUp' : 'signIn')
                    setError(null)
                  }}
                >
                  {flow === 'signIn' ? 'Create an account' : 'I have an account'}
                </button>
              </div>
            </form>
          )}
          {error && <p className="pt-1 text-center text-[14px] text-danger animate-fade">{error}</p>}
          <p className="pt-4 text-center text-[12px] leading-[18px] text-subtle">
            By continuing you agree to keep lifting. <a href="/privacy" className="underline decoration-faint underline-offset-2">Privacy</a>
          </p>
        </div>
      </div>
    </main>
  )
}
