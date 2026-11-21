// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The solar return (the revolution of the year, Lilly's name for it): the instant at which the
 * Sun regains its natal longitude, and the chart of that instant. The instant comes from the
 * engine's own Sun-longitude search (substrate/sky.ts), the same one the profection years
 * are cut by, so the return and the year boundary are one fact. The chart is cast for the
 * birth place, with whole-sign houses counted from the return Ascendant: a labelled variant
 * of Lilly's Regiomontanus cusps, as everywhere in the Western rules.
 */
import { longitudeOf, nextSunLongitude } from '../../substrate/sky.ts';
import { MS, type Moment } from '../../substrate/time.ts';
import { chart, type Chart } from './index.ts';

/** The return of the given age (1 is the first birthday); the instant of birth for age 0. */
export function solarReturnInstant(moment: Moment, age: number): number {
  const natal = longitudeOf('Sun', moment.utcMs);
  let t = moment.utcMs;
  // One tropical year is never less than 360 days, which keeps the search from finding the same return twice.
  for (let i = 0; i < age; i++) t = nextSunLongitude(natal, t + 360 * MS.DAY);
  return t;
}

/** The chart of an instant for the birth place. */
export function chartAt(moment: Moment, utcMs: number): Chart {
  return chart({ ...moment, utcMs, notes: [] });
}

export interface SolarReturn {
  age: number;
  utcMs: number;
  chart: Chart;
}

/** The solar return of the given age, with its chart for the birth place. */
export function solarReturn(moment: Moment, age: number): SolarReturn {
  const utcMs = solarReturnInstant(moment, age);
  return { age, utcMs, chart: chartAt(moment, utcMs) };
}

/** Solar returns for a run of ages, found one from the next so each search starts where the last ended. */
export function solarReturnsFor(moment: Moment, ages: readonly number[]): SolarReturn[] {
  const natal = longitudeOf('Sun', moment.utcMs);
  const sorted = [...ages].sort((a, b) => a - b);
  const out: SolarReturn[] = [];
  let age = 0;
  let t = moment.utcMs;
  for (const wanted of sorted) {
    while (age < wanted) {
      t = nextSunLongitude(natal, t + 360 * MS.DAY);
      age++;
    }
    out.push({ age: wanted, utcMs: t, chart: chartAt(moment, t) });
  }
  return out;
}
