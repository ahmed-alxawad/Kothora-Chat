/**
 * "Will I run out this month?", from the pace so far. A straight-line projection:
 * used so far / days elapsed x days in the month. Simple on purpose: with a handful of
 * days of data, a fancier model would only look more certain than it is.
 */
export type UsageForecast =
  | { kind: "on-track"; projected: number; limit: number }
  | { kind: "will-run-out"; projected: number; limit: number; runOutDay: number }
  | { kind: "used-up"; limit: number }

export function forecastMonth(used: number, limit: number, now: Date): UsageForecast {
  if (used >= limit) return { kind: "used-up", limit }
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  // Count today as a part-day, never as zero, so early-month projections stay finite.
  const elapsed = Math.max(now.getDate() - 1 + now.getHours() / 24, 0.5)
  const perDay = used / elapsed
  const projected = Math.round(perDay * daysInMonth)
  if (projected <= limit || perDay === 0) return { kind: "on-track", projected, limit }
  const runOutDay = Math.min(daysInMonth, Math.ceil(limit / perDay))
  return { kind: "will-run-out", projected, limit, runOutDay }
}

/** Midnight at the start of next month: when monthly allowances reset. */
export function nextMonthStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
}
