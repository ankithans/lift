import { Logo } from './Logo'

export function Splash() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-black">
      <div className="animate-[fade_400ms_ease-out_both]">
        <Logo size={44} />
      </div>
    </div>
  )
}
