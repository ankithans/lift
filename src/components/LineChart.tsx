import { useId, useMemo, useState } from 'react'
import { fmtDate, fmtNum } from '#/lib/format'

export type Point = { x: number; y: number }

/** Minimal, honest line chart: real points, light grid, tap to inspect. */
export function LineChart({
  points,
  height = 160,
  unit = '',
  color = 'var(--color-accent)',
}: {
  points: Point[]
  height?: number
  unit?: string
  color?: string
}) {
  const id = useId()
  const [hover, setHover] = useState<number | null>(null)
  const w = 600
  const h = height
  const pad = { t: 16, r: 12, b: 28, l: 12 }

  const geo = useMemo(() => {
    if (points.length === 0) return null
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    let minY = Math.min(...ys)
    let maxY = Math.max(...ys)
    if (minY === maxY) {
      minY -= 1
      maxY += 1
    }
    const spanY = maxY - minY
    minY -= spanY * 0.15
    maxY += spanY * 0.15
    const sx = (x: number) => pad.l + (maxX === minX ? (w - pad.l - pad.r) / 2 : ((x - minX) / (maxX - minX)) * (w - pad.l - pad.r))
    const sy = (y: number) => pad.t + (1 - (y - minY) / (maxY - minY)) * (h - pad.t - pad.b)
    const pts = points.map((p) => ({ ...p, px: sx(p.x), py: sy(p.y) }))
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ')
    const area = `${line} L${pts[pts.length - 1].px.toFixed(1)},${h - pad.b} L${pts[0].px.toFixed(1)},${h - pad.b} Z`
    return { pts, line, area, minX, maxX }
  }, [points, h])

  if (!geo) return null
  const active = hover !== null ? geo.pts[hover] : geo.pts[geo.pts.length - 1]

  return (
    <div className="relative select-none">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="num text-[26px] font-[680] tracking-[-0.03em]">
          {fmtNum(active.y)}
          <span className="ml-1 text-[14px] font-[550] text-subtle">{unit}</span>
        </div>
        <div className="text-[13px] text-subtle">{fmtDate(active.x, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      </div>
      <svg
        role="img"
        aria-label={`Line chart, ${points.length} points from ${fmtDate(geo.minX, { month: 'short', day: 'numeric' })} to ${fmtDate(geo.maxX, { month: 'short', day: 'numeric' })}. Latest ${fmtNum(points[points.length - 1].y)} ${unit}, highest ${fmtNum(Math.max(...points.map((p) => p.y)))} ${unit}.`}
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full touch-none overflow-visible"
        onPointerMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const x = ((e.clientX - rect.left) / rect.width) * w
          let best = 0
          for (let i = 1; i < geo.pts.length; i++) if (Math.abs(geo.pts[i].px - x) < Math.abs(geo.pts[best].px - x)) best = i
          setHover(best)
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad.l} x2={w - pad.r} y1={pad.t + f * (h - pad.t - pad.b)} y2={pad.t + f * (h - pad.t - pad.b)} stroke="#1c1c1e" strokeWidth="1" />
        ))}
        <path d={geo.area} fill={`url(#${id}-fill)`} />
        <path d={geo.line} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        {geo.pts.length <= 40 &&
          geo.pts.map((p, i) => <circle key={i} cx={p.px} cy={p.py} r={i === hover ? 5 : 2.6} fill={i === hover ? color : '#000'} stroke={color} strokeWidth="1.75" />)}
        {hover !== null && <line x1={active.px} x2={active.px} y1={pad.t} y2={h - pad.b} stroke="#3a3a3e" strokeDasharray="3 4" />}
        <text x={pad.l} y={h - 4} fill="#8a8a90" fontSize="17">
          {fmtDate(geo.minX, { month: 'short', day: 'numeric' })}
        </text>
        <text x={w - pad.r} y={h - 4} fill="#8a8a90" fontSize="17" textAnchor="end">
          {fmtDate(geo.maxX, { month: 'short', day: 'numeric' })}
        </text>
      </svg>
    </div>
  )
}
