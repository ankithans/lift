import { Dumbbell } from 'lucide-react'
import { useState } from 'react'

export function ExerciseThumb({ src, size = 44, className = '' }: { src?: string | null; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size }
  if (!src || failed) {
    return (
      <span className={`grid shrink-0 place-items-center rounded-[12px] bg-raised text-faint ${className}`} style={style}>
        <Dumbbell className="size-[45%]" strokeWidth={1.6} />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-[12px] bg-white object-cover ${className}`}
      style={style}
    />
  )
}
