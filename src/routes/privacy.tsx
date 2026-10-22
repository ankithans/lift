import { createFileRoute } from '@tanstack/react-router'
import { Logo } from '#/components/Logo'

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: 'Privacy · Lift' }] }),
  component: Privacy,
})

function Privacy() {
  return (
    <main className="mx-auto max-w-[640px] px-6 py-16 text-[15px] leading-7 text-muted">
      <a href="/" className="inline-flex items-center gap-3 text-ink">
        <Logo size={32} /> <span className="text-[18px] font-[680]">Lift</span>
      </a>
      <h1 className="mt-10 t-large text-ink">Privacy</h1>
      <p className="mt-6">Lift stores what you log — workouts, sets, programs, body measurements — so you can see your progress. That’s it.</p>
      <h2 className="mt-8 t-title text-ink">What we keep</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Your name, email and profile picture from Google (or the email you sign up with).</li>
        <li>The training data you enter, or that AI agents you authorize enter on your behalf.</li>
        <li>Access tokens you create for AI tools (stored only as a hash).</li>
      </ul>
      <h2 className="mt-8 t-title text-ink">What we don’t do</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>No ads, no selling or sharing your data.</li>
        <li>No tracking scripts.</li>
      </ul>
      <h2 className="mt-8 t-title text-ink">Your control</h2>
      <p className="mt-2">You can delete any workout or measurement in the app. To delete your account and all data, email ankithans1947@gmail.com.</p>
      <p className="mt-10 text-[13px] text-subtle">Data is stored with Convex and served via Cloudflare. Last updated October 2026.</p>
    </main>
  )
}
