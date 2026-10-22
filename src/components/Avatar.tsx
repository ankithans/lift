import { useMe } from '#/lib/me'

export function Avatar({ size = 36 }: { size?: number }) {
  const me = useMe()
  const initial = (me.name ?? me.email ?? '?').trim().charAt(0).toUpperCase()
  return me.image ? (
    <img
      src={me.image}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className="shrink-0 rounded-full bg-raised object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-raised font-[650] text-muted"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  )
}
