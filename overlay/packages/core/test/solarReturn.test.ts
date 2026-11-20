// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/** The solar return on the sample moments: the instant, the chart for the birth place, and the agreement with the engine's profection years. */
import { describe, expect, it } from 'vitest';
import { angles, longitudeOf, norm360 } from '../src/substrate/sky.ts';
import { makeMoment, MS } from '../src/substrate/time.ts';
import { chart, solarReturns } from '../src/systems/western/index.ts';
import { chartAt, solarReturn, solarReturnInstant, solarReturnsFor } from '../src/systems/western/solarReturn.ts';
import { MOMENTS } from '../../../fixtures/moments.ts';

const ARCSEC = 1 / 3600;
/** Signed difference of two longitudes in (-180, 180]. */
const diff = (a: number, b: number): number => ((norm360(a - b) + 180) % 360) - 180;

describe('the solar return instant', () => {
  for (const f of MOMENTS) {
    it(`${f.id}: the Sun is at its natal longitude to within a second of arc, one year on`, () => {
      const m = makeMoment(f.civil, f.zone, f.place);
      const natal = longitudeOf('Sun', m.utcMs);
      for (const age of [1, 2, 17, 30]) {
        const t = solarReturnInstant(m, age);
        expect(Math.abs(diff(longitudeOf('Sun', t), natal)), `age ${age}`).toBeLessThan(ARCSEC);
        // A tropical year is 365.2422 days; the return falls within a day of that many years on.
        expect(Math.abs(t - (m.utcMs + age * 365.2422 * MS.DAY))).toBeLessThan(1.1 * MS.DAY);
      }
    });
  }
  it('is the same instant as the engine uses to turn the profected year', () => {
    const f = MOMENTS[0]!;
    const m = makeMoment(f.civil, f.zone, f.place);
    const engine = solarReturns(m, 8);
    for (let age = 0; age <= 8; age++) expect(solarReturnInstant(m, age)).toBe(engine[age]);
    expect(solarReturnInstant(m, 0)).toBe(m.utcMs);
  });
  it('finds a run of ages in one pass, in any order of asking', () => {
    const f = MOMENTS[2]!;
    const m = makeMoment(f.civil, f.zone, f.place);
    const run = solarReturnsFor(m, [5, 3, 4]);
    expect(run.map((r) => r.age)).toEqual([3, 4, 5]);
    for (const r of run) expect(r.utcMs).toBe(solarReturnInstant(m, r.age));
  });
});

describe('the solar return chart', () => {
  it('is the chart of the return instant at the birth place, with the Sun at its natal sign and degree', () => {
    for (const f of MOMENTS) {
      const m = makeMoment(f.civil, f.zone, f.place);
      const natal = chart(m);
      const r = solarReturn(m, 3);
      const sun = r.chart.positions.find((p) => p.planet === 'Sun')!;
      expect(Math.abs(diff(sun.longitude, natal.positions[0]!.longitude)), f.id).toBeLessThan(ARCSEC);
      expect(r.chart.ascendant, f.id).toBeCloseTo(angles(r.utcMs, f.place).ascendant, 9);
      expect(r.chart.midheaven, f.id).toBeCloseTo(angles(r.utcMs, f.place).midheaven, 9);
      expect(r.chart.positions).toHaveLength(7);
    }
  });
  it('numbers whole-sign houses from the return Ascendant sign', () => {
    const f = MOMENTS[2]!;
    const m = makeMoment(f.civil, f.zone, f.place);
    const c = chartAt(m, solarReturnInstant(m, 10));
    const ascSign = Math.floor(c.ascendant / 30);
    for (const p of c.positions) expect(p.house).toBe(((p.signIndex - ascSign + 12) % 12) + 1);
  });
  it('differs from the natal chart: the Ascendant is that of the return instant, not of birth', () => {
    const f = MOMENTS[2]!;
    const m = makeMoment(f.civil, f.zone, f.place);
    expect(chartAt(m, solarReturnInstant(m, 1)).ascendant).not.toBeCloseTo(chart(m).ascendant, 3);
  });
});
