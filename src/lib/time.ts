/** 8 local-midnight boundaries for the week containing `at` (offset by `weeks`). */
export function weekBoundaries(at: number, weekStartsOn: number, weeks = 0) {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() - weekStartsOn + 7) % 7) + weeks * 7)
  return Array.from({ length: 8 }, (_, i) => {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    return x.getTime()
  })
}

export function startOfDay(at: number) {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
