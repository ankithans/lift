export type Unit = 'kg' | 'lb'

const LB_PER_KG = 2.20462262185

export function toDisplayWeight(kg: number | null | undefined, unit: Unit) {
  if (kg === null || kg === undefined) return null
  // lb shows to the nearest 0.5 (plates/dumbbells); kg keeps 1.25 kg plates exact.
  if (unit === 'lb') return Math.round(kg * LB_PER_KG * 2) / 2
  return Math.round(kg * 100) / 100
}

export function fromDisplayWeight(value: number, unit: Unit) {
  return unit === 'lb' ? Math.round((value / LB_PER_KG) * 1000) / 1000 : value
}

export function fmtNum(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}

export function fmtWeight(kg: number | null | undefined, unit: Unit) {
  const v = toDisplayWeight(kg, unit)
  return v === null ? '—' : `${fmtNum(v)}`
}

export function fmtVolume(kg: number, unit: Unit) {
  const v = toDisplayWeight(kg, unit) ?? 0
  if (v >= 10000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return Math.round(v).toLocaleString()
}

export function fmtDuration(sec: number) {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m === 0) return '<1 min'
  return `${m} min`
}

export function fmtClock(sec: number) {
  const s = Math.max(0, Math.ceil(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  return `${m}:${String(r).padStart(2, '0')}`
}

export function fmtReps(low?: number | null, high?: number | null) {
  if (!low && !high) return ''
  if (low && high && low !== high) return `${low}–${high}`
  return String(high || low)
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function fmtDate(ms: number, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, opts).format(new Date(ms))
}

export function fmtRelativeDay(ms: number, now = Date.now()) {
  const day = 86400000
  const startOf = (t: number) => {
    const d = new Date(t)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  const diff = Math.round((startOf(now) - startOf(ms)) / day)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff > 1 && diff < 7) return fmtDate(ms, { weekday: 'long' })
  return fmtDate(ms, { month: 'short', day: 'numeric', year: new Date(ms).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' })
}

export const RIR_LABELS: Record<number, string> = {
  0: 'Failure',
  1: '1 left',
  2: '2 left',
  3: '3 left',
  4: '4+ left',
}

/** "+10 × 8" for added load on bodyweight moves, "BW × 8" without load, "60 × 8" otherwise. */
export function fmtSet(
  set: { weightKg?: number | null; reps?: number | null; durationSec?: number | null },
  tracking: string,
  unit: Unit,
  sep = ' × ',
) {
  if (tracking === 'duration' || (set.durationSec && !set.reps)) return `${fmtNum(set.durationSec ?? null)}s`
  const reps = set.reps ?? '—'
  if (tracking === 'reps') return `${reps} reps`
  if (!set.weightKg) return `BW${sep}${reps}`
  return `${tracking === 'weighted_bodyweight' ? '+' : ''}${fmtWeight(set.weightKg, unit)}${sep}${reps}`
}

/** The implement that defines an exercise (dumbbell over the bench it's done on). */
export function mainEquipment(list: string[]) {
  const main = list.find((e) => /dumbbell|barbell|cable|machine|band|kettlebell|smith|ez|trap bar|plate/i.test(e))
  return main ?? list[0] ?? ''
}
