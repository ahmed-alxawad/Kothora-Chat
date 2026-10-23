import { describe, expect, it } from "vitest"
import { forecastMonth, nextMonthStart } from "./forecast"

describe("forecastMonth", () => {
  it("projects the month from the pace so far", () => {
    // 10 full days elapsed in a 31-day month, 100 used: 10/day -> 310 projected.
    const result = forecastMonth(100, 500, new Date(2026, 9, 11, 0))
    expect(result).toEqual({ kind: "on-track", projected: 310, limit: 500 })
  })

  it("says when the allowance would run out", () => {
    // 20/day against 500 runs out on day 25.
    expect(forecastMonth(200, 500, new Date(2026, 9, 11, 0))).toEqual({
      kind: "will-run-out",
      projected: 620,
      limit: 500,
      runOutDay: 25,
    })
  })

  it("handles a used-up allowance and the first hours of a month", () => {
    expect(forecastMonth(500, 500, new Date(2026, 9, 20))).toEqual({ kind: "used-up", limit: 500 })
    const early = forecastMonth(1, 500, new Date(2026, 9, 1, 0, 30))
    expect(early.kind).toBe("on-track")
  })

  it("finds the next reset", () => {
    expect(nextMonthStart(new Date(2026, 11, 15))).toEqual(new Date(2027, 0, 1))
  })
})
