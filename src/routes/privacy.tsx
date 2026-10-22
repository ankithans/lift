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
      <p className="mt-6">Lift stores your training log and the optional connections you choose, so you can train and see your progress.</p>
      <h2 className="mt-8 t-title text-ink">What we keep</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Your name, email and profile picture from Google (or the email you sign up with).</li>
        <li>The training data you enter, or that AI agents you authorize enter on your behalf.</li>
        <li>Access tokens you create for AI tools (stored only as a hash).</li>
      </ul>
      <h2 className="mt-8 t-title text-ink">Optional music connections</h2>
      <p className="mt-2">Spotify and YouTube authorization is separate from Google sign-in. When you connect Spotify, Lift reads your favourites, playlists and current playback, and sends playback commands you choose. When you connect YouTube, Lift requests read-only access to your YouTube account to list playlists and liked videos. Music likes may include non-music videos.</p>
      <p className="mt-2">OAuth access and refresh tokens stay on Convex servers. The Spotify browser player receives a short-lived access token in memory; it is never saved to browser storage. Lift caches library metadata for five minutes and removes expired cache entries within an hour. Disconnect in Settings → Connections to immediately stop Lift access and delete its connection and cached metadata. You can also revoke access in your Spotify account or <a className="underline" href="https://myaccount.google.com/permissions">Google Account permissions</a>.</p>
      <p className="mt-2">Playing a YouTube video loads the official YouTube player, which shares playback and device information with Google and may show ads. Your use is subject to <a className="underline" href="https://www.youtube.com/t/terms">YouTube’s Terms of Service</a> and <a className="underline" href="https://policies.google.com/privacy">Google’s Privacy Policy</a>. Lift’s use of Google API information follows the <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including Limited Use requirements. Lift does not sell music data or use it to train AI models.</p>
      <h2 className="mt-8 t-title text-ink">What we don’t do</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>No Lift ads or sale of your data. Optional music providers process playback as described above.</li>
        <li>No tracking scripts.</li>
      </ul>
      <h2 className="mt-8 t-title text-ink">Your control</h2>
      <p className="mt-2">You can delete any workout or measurement in the app. To delete your account and all data, email ankithans1947@gmail.com.</p>
      <p className="mt-10 text-[13px] text-subtle">Data is stored with Convex and served via Cloudflare. Last updated October 2026.</p>
    </main>
  )
}
