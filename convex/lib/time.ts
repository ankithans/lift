/** Offset (ms) of a time zone from UTC at a given instant. */
export function tzOffsetMs(at: number, timeZone: string | undefined) {
  if (!timeZone) return 0;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(at));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return asUtc - Math.floor(at / 1000) * 1000;
  } catch {
    return 0;
  }
}

/** 8 local-midnight boundaries for the week containing `now`. */
export function weekBoundaries(now: number, timeZone: string | undefined, weekStartsOn: number) {
  const local = new Date(now + tzOffsetMs(now, timeZone));
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate() - ((local.getUTCDay() - weekStartsOn + 7) % 7);
  return Array.from({ length: 8 }, (_, i) => {
    const utcMidnight = Date.UTC(y, m, d + i);
    return utcMidnight - tzOffsetMs(utcMidnight, timeZone);
  });
}
