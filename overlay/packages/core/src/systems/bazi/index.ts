// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * BaZi (Four Pillars), computed from the substrate rather than from a calendar table.
 *
 * The year and month pillars depend only on the instant (they follow the Sun's
 * longitude). The day and hour pillars depend on a clock reading, and so on the
 * `timeBasis` and `dayBoundary` conventions.
 */
import type { Conventions } from '../../conventions.ts';
import { longitudeOf, norm360 } from '../../substrate/sky.ts';
import { lichun, lichunYear, termsAround, termsBetween, solarTermInstant } from '../../substrate/terms.ts';
import {
  addCalendar,
  basisOffsetMinutes,
  civilToUtcMs,
  clockReading,
  fieldsFromUtcMs,
  julianDayNumber,
  MS,
  zoneOffsetMinutes,
  type CivilTime,
  type Moment,
} from '../../substrate/time.ts';
import { BRANCHES, sixtyCycle, sixtyIndex, STEMS, tenGod, type SixtyCycle, type TenGod } from './tables.ts';

export * from './tables.ts';

export interface Pillar extends SixtyCycle {
  /** What the pillar's stem is to the day master (absent for the day pillar itself). */
  stemGod: TenGod | null;
  hidden: Array<{ stem: (typeof STEMS)[number]; god: TenGod }>;
}

export interface FourPillars {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar;
  /** The clock reading the day and hour were taken from. */
  clock: CivilTime;
  /** That clock's offset from UTC in minutes. */
  clockOffsetMinutes: number;
  /** The BaZi year number (Lichun to Lichun). */
  cycleYear: number;
  /** Sun's longitude, which fixes the month. */
  sunLongitude: number;
}

/** Sexagenary index of the day whose Julian Day Number is given. */
export function dayIndexFromJdn(jdn: number): number {
  return (((jdn - 11) % 60) + 60) % 60;
}

/** Sexagenary index of the BaZi year. */
export function yearIndex(cycleYear: number): number {
  return (((cycleYear - 4) % 60) + 60) % 60;
}

/** Month number 0 (Yin, opening at Lichun) to 11 (Chou), from the Sun's longitude. */
export function monthNumberFromLongitude(sunLongitude: number): number {
  return Math.floor(norm360(sunLongitude - 315) / 30) % 12;
}

/** Sexagenary index of month `m` (0 = Yin month) in a year with the given stem. */
export function monthIndex(yearStem: number, m: number): number {
  const firstStem = ((yearStem % 5) * 2 + 2) % 10;
  return sixtyIndex((firstStem + m) % 10, (m + 2) % 12);
}

function decorate(index: number, dayMaster: number, isDay: boolean): Pillar {
  const base = sixtyCycle(index);
  return {
    ...base,
    stemGod: isDay ? null : tenGod(dayMaster, base.stem.index),
    hidden: base.branch.hidden.map((s) => ({ stem: STEMS[s]!, god: tenGod(dayMaster, s) })),
  };
}

/** Day and hour sexagenary indices from a clock reading. */
export function dayAndHourIndices(clock: CivilTime, dayBoundary: Conventions['dayBoundary']): { day: number; hour: number } {
  const jdn = julianDayNumber(clock.year, clock.month, clock.day);
  const late = clock.hour >= 23;
  // The hour stem is always derived from the day that the Zi hour opens.
  const hourDay = dayIndexFromJdn(jdn + (late ? 1 : 0));
  const day = dayBoundary === 'zi23' ? hourDay : dayIndexFromJdn(jdn);
  const hourBranch = Math.floor((clock.hour + 1) / 2) % 12;
  const firstHourStem = ((hourDay % 10) % 5) * 2;
  const hour = sixtyIndex((firstHourStem + hourBranch) % 10, hourBranch);
  return { day, hour };
}

export function fourPillars(moment: Moment, conventions: Conventions): FourPillars {
  const sunLongitude = longitudeOf('Sun', moment.utcMs);
  const cycleYear = lichunYear(moment.utcMs);
  const yIdx = yearIndex(cycleYear);
  // Take the month from the term table rather than the raw longitude, so that the
  // month and year can never disagree within a second of Lichun.
  const jie = termsAround(moment.utcMs, true).previous;
  const m = jie.term.index / 2;
  const mIdx = monthIndex(yIdx % 10, m);

  const clock = clockReading(moment, conventions.timeBasis);
  const { day, hour } = dayAndHourIndices(clock, conventions.dayBoundary);
  const dm = day % 10;
  return {
    year: decorate(yIdx, dm, false),
    month: decorate(mIdx, dm, false),
    day: decorate(day, dm, true),
    hour: decorate(hour, dm, false),
    clock,
    clockOffsetMinutes: basisOffsetMinutes(moment, conventions.timeBasis),
    cycleYear,
    sunLongitude,
  };
}

export function pillarsText(p: FourPillars): string {
  return `${p.year.hanzi} ${p.month.hanzi} ${p.day.hanzi} ${p.hour.hanzi}`;
}

// ---------------------------------------------------------------------------
// Luck pillars
// ---------------------------------------------------------------------------

export type Sex = 'male' | 'female';

export interface LuckPillar {
  ordinal: number;
  cycle: SixtyCycle;
  startUtcMs: number;
  endUtcMs: number;
}

export interface Luck {
  forward: boolean;
  /** The jie the count runs to, and how far away it is. */
  jie: { hanzi: string; utcMs: number };
  secondsToJie: number;
  /** The scaled interval: the age at which the first luck pillar opens. */
  startAge: { years: number; months: number; days: number; hours: number; minutes: number };
  startUtcMs: number;
  pillars: LuckPillar[];
}

/**
 * Luck pillars. Direction is forward for a Yang year stem with a male chart or a Yin
 * year stem with a female chart, otherwise backward. The interval to the next (or
 * previous) jie is scaled at three days to the year and added to the birth date on the
 * civil calendar; each pillar then lasts ten calendar years.
 */
export function luck(moment: Moment, conventions: Conventions, sex: Sex, count = 10): Luck {
  const pillars = fourPillars(moment, conventions);
  const yangYear = pillars.year.stem.polarity === 'Yang';
  const forward = (yangYear && sex === 'male') || (!yangYear && sex === 'female');
  const around = termsAround(moment.utcMs, true);
  const jie = forward ? around.next : around.previous;
  let seconds = Math.floor(Math.abs(jie.utcMs - moment.utcMs) / 1000);
  const secondsToJie = seconds;
  const years = Math.floor(seconds / 259_200);
  seconds %= 259_200;
  const months = Math.floor(seconds / 21_600);
  seconds %= 21_600;
  const days = Math.floor(seconds / 720);
  seconds %= 720;
  const hours = Math.floor(seconds / 30);
  seconds %= 30;
  const minutes = seconds * 2;

  const offset = zoneOffsetMinutes(moment.utcMs, moment.zone);
  const birthCivil = fieldsFromUtcMs(moment.utcMs + offset * MS.MIN);
  const startCivil = addCalendar(birthCivil, { years, months, days, hours, minutes });
  const toUtc = (c: CivilTime): number => civilToUtcMs(c, moment.zone).utcMs;
  const startUtcMs = toUtc(startCivil);

  const out: LuckPillar[] = [];
  for (let i = 0; i < count; i++) {
    const idx = pillars.month.index + (forward ? i + 1 : -(i + 1));
    out.push({
      ordinal: i + 1,
      cycle: sixtyCycle(idx),
      startUtcMs: toUtc(addCalendar(startCivil, { years: 10 * i })),
      endUtcMs: toUtc(addCalendar(startCivil, { years: 10 * (i + 1) })),
    });
  }
  return {
    forward,
    jie: { hanzi: jie.term.hanzi, utcMs: jie.utcMs },
    secondsToJie,
    startAge: { years, months, days, hours, minutes },
    startUtcMs,
    pillars: out,
  };
}

// ---------------------------------------------------------------------------
// Running pillars over a span of time
// ---------------------------------------------------------------------------

export interface PillarSpan {
  cycle: SixtyCycle;
  startUtcMs: number;
  endUtcMs: number;
}

/** Annual pillars (Lichun to Lichun) overlapping [startMs, endMs). */
export function annualPillars(startMs: number, endMs: number): PillarSpan[] {
  const out: PillarSpan[] = [];
  for (let y = lichunYear(startMs); lichun(y) < endMs; y++) {
    out.push({ cycle: sixtyCycle(yearIndex(y)), startUtcMs: lichun(y), endUtcMs: lichun(y + 1) });
  }
  return out;
}

/** Monthly pillars (jie to jie) overlapping [startMs, endMs). */
export function monthlyPillars(startMs: number, endMs: number): PillarSpan[] {
  const first = termsAround(startMs, true).previous;
  const jies = [first, ...termsBetween(first.utcMs + 1, endMs).filter((t) => t.term.isJie)];
  return jies.map((j) => {
    const m = j.term.index / 2;
    const nextMs = m === 11 ? solarTermInstant(j.cycleYear + 1, 0) : solarTermInstant(j.cycleYear, j.term.index + 2);
    return {
      cycle: sixtyCycle(monthIndex(yearIndex(j.cycleYear) % 10, m)),
      startUtcMs: j.utcMs,
      endUtcMs: nextMs,
    };
  });
}

/** Day pillars for each day of the given clock, overlapping [startMs, endMs). */
export function dayPillars(startMs: number, endMs: number, moment: Moment, conventions: Conventions): PillarSpan[] {
  const offset = basisOffsetMinutes(moment, conventions.timeBasis) * MS.MIN;
  const shift = conventions.dayBoundary === 'zi23' ? MS.HOUR : 0;
  const out: PillarSpan[] = [];
  let dayStart = Math.floor((startMs + offset + shift) / MS.DAY) * MS.DAY - shift - offset;
  for (; dayStart < endMs; dayStart += MS.DAY) {
    const c = fieldsFromUtcMs(dayStart + offset + shift + MS.HOUR * 2);
    out.push({
      cycle: sixtyCycle(dayIndexFromJdn(julianDayNumber(c.year, c.month, c.day))),
      startUtcMs: dayStart,
      endUtcMs: dayStart + MS.DAY,
    });
  }
  return out;
}

export { BRANCHES };
