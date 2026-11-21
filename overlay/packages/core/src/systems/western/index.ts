// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Traditional Western astrology, limited to what is a matter of calculation: positions,
 * whole-sign houses, sect, essential dignities and the two time-lord systems that need
 * no further judgement (annual profections and firdaria).
 */
import type { Conventions } from '../../conventions.ts';
import {
  angles,
  bisectChange,
  longitudeOf,
  meanNodeLongitude,
  nextSunEvent,
  nextSunLongitude,
  norm360,
  PLANETS,
  speedOf,
  latitudeOf,
  type Planet,
} from '../../substrate/sky.ts';
import { MS, type Moment } from '../../substrate/time.ts';
import { CHALDEAN, dignitiesAt, DOMICILE, holds, SIGNS, type Sign } from './dignities.ts';

export * from './dignities.ts';

export interface Position {
  planet: Planet;
  longitude: number;
  latitude: number;
  sign: Sign;
  signIndex: number;
  /** Degrees within the sign. */
  degree: number;
  speed: number;
  retrograde: boolean;
  /** Whole-sign house, 1 to 12. */
  house: number;
  dignities: string[];
}

export interface Chart {
  ascendant: number;
  midheaven: number;
  ascendantSign: Sign;
  /** A day chart has the Sun above the horizon. */
  isDayChart: boolean;
  positions: Position[];
  northNode: number;
  /** Lot of Fortune: Asc + Moon - Sun by day, Asc + Sun - Moon by night. */
  fortune: number;
}

export function signOf(longitude: number): { sign: Sign; index: number; degree: number } {
  const l = norm360(longitude);
  const index = Math.floor(l / 30) % 12;
  return { sign: SIGNS[index]!, index, degree: l - index * 30 };
}

export function formatLongitude(longitude: number): string {
  const { sign, degree } = signOf(longitude);
  const d = Math.floor(degree);
  const m = Math.floor((degree - d) * 60);
  return `${d}°${String(m).padStart(2, '0')}′ ${sign}`;
}

export function chart(moment: Moment): Chart {
  const a = angles(moment.utcMs, moment.place);
  const ascSign = signOf(a.ascendant).index;
  const sun = longitudeOf('Sun', moment.utcMs);
  // Above the horizon means between the descendant and the ascendant by way of the midheaven.
  const isDayChart = norm360(sun - a.ascendant) > 180;
  const positions = PLANETS.map((planet): Position => {
    const longitude = longitudeOf(planet, moment.utcMs);
    const s = signOf(longitude);
    const speed = speedOf(planet, moment.utcMs);
    return {
      planet,
      longitude,
      latitude: latitudeOf(planet, moment.utcMs),
      sign: s.sign,
      signIndex: s.index,
      degree: s.degree,
      speed,
      retrograde: speed < 0,
      house: ((s.index - ascSign + 12) % 12) + 1,
      dignities: holds(planet, longitude, isDayChart),
    };
  });
  const moon = positions[1]!.longitude;
  return {
    ascendant: a.ascendant,
    midheaven: a.midheaven,
    ascendantSign: SIGNS[ascSign]!,
    isDayChart,
    positions,
    northNode: meanNodeLongitude(moment.utcMs),
    fortune: norm360(isDayChart ? a.ascendant + moon - sun : a.ascendant + sun - moon),
  };
}

// ---------------------------------------------------------------------------
// Time lords
// ---------------------------------------------------------------------------

export interface LordSpan {
  label: string;
  lord: string;
  startUtcMs: number;
  endUtcMs: number;
  detail?: string;
}

/** Solar returns: the instants at which the Sun regains its natal longitude. */
export function solarReturns(moment: Moment, count: number): number[] {
  const natal = longitudeOf('Sun', moment.utcMs);
  const out = [moment.utcMs];
  for (let i = 1; i <= count; i++) out.push(nextSunLongitude(natal, out[i - 1]! + 360 * MS.DAY));
  return out;
}

/**
 * Annual profections: the ascendant advances one whole sign at each solar return, and
 * the domicile lord of the sign it reaches is lord of that year. Turning the year at a
 * tropical solar return is a modern convention; Valens, Anthology IV, was not opened, so
 * what he does is not established here.
 */
export function profections(moment: Moment, years: number): LordSpan[] {
  const asc = signOf(angles(moment.utcMs, moment.place).ascendant).index;
  const returns = solarReturns(moment, years);
  return Array.from({ length: years }, (_, age) => {
    const sign = (asc + age) % 12;
    return {
      label: SIGNS[sign]!,
      lord: DOMICILE[sign]!,
      startUtcMs: returns[age]!,
      endUtcMs: returns[age + 1]!,
      detail: `age ${age}, house ${(age % 12) + 1}`,
    };
  });
}

const FIRDARIA_YEARS: Record<string, number> = {
  Sun: 10, Venus: 8, Mercury: 13, Moon: 9, Saturn: 11, Jupiter: 12, Mars: 7, 'North Node': 3, 'South Node': 2,
};
const TROPICAL_YEAR_MS = 365.2421897 * MS.DAY;

export function firdariaOrder(isDayChart: boolean, nodes: Conventions['firdariaNodes']): string[] {
  if (isDayChart) return ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'North Node', 'South Node'];
  return nodes === 'end'
    ? ['Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'North Node', 'South Node']
    : ['Moon', 'Saturn', 'Jupiter', 'Mars', 'North Node', 'South Node', 'Sun', 'Venus', 'Mercury'];
}

/**
 * Firdaria: nine periods totalling seventy-five years, opening with the sect light.
 * Each planetary period is shared in seven equal parts among the planets in Chaldean
 * order, beginning with the period's own lord; the nodal periods are not subdivided.
 * The scheme and the two node orderings follow a secondary summary of medieval sources
 * (Abu Ma'shar, Shahmardan); none of those texts has been read for this project.
 */
export function firdaria(moment: Moment, conventions: Conventions, untilAge = 150): { major: LordSpan[]; minor: LordSpan[] } {
  const order = firdariaOrder(chart(moment).isDayChart, conventions.firdariaNodes);
  const major: LordSpan[] = [];
  const minor: LordSpan[] = [];
  let t = moment.utcMs;
  for (let cycle = 0; (t - moment.utcMs) / TROPICAL_YEAR_MS < untilAge; cycle++) {
    for (const lord of order) {
      const length = FIRDARIA_YEARS[lord]! * TROPICAL_YEAR_MS;
      major.push({ label: lord, lord, startUtcMs: t, endUtcMs: t + length });
      if (!lord.endsWith('Node')) {
        const first = CHALDEAN.indexOf(lord as Planet);
        for (let k = 0; k < 7; k++) {
          const sub = CHALDEAN[(first + k) % 7]!;
          minor.push({
            label: `${lord} / ${sub}`,
            lord: sub,
            startUtcMs: t + (length * k) / 7,
            endUtcMs: t + (length * (k + 1)) / 7,
          });
        }
      }
      t += length;
    }
  }
  return { major, minor };
}

/** Spans during which a planet occupies one sign, overlapping [startMs, endMs). */
export function signIngresses(planet: Planet, startMs: number, endMs: number, stepDays = 5): LordSpan[] {
  const signAt = (ms: number): number => signOf(longitudeOf(planet, ms)).index;
  const step = stepDays * MS.DAY;
  // Walk back to the start of the sign occupied at startMs.
  let t = startMs;
  let cur = signAt(t);
  let spanStart = startMs;
  for (let back = t - step, n = 0; n < 5000; back -= step, n++) {
    if (signAt(back) !== cur) {
      spanStart = bisectChange(signAt, back, back + step);
      break;
    }
  }
  const out: LordSpan[] = [];
  while (t < endMs) {
    const next = t + step;
    const s = signAt(next);
    if (s !== cur) {
      const change = bisectChange(signAt, t, next);
      out.push({ label: SIGNS[cur]!, lord: planet, startUtcMs: spanStart, endUtcMs: change });
      spanStart = change;
      cur = s;
    }
    t = next;
  }
  // Close the last span at the next change after endMs.
  let closing = t;
  for (let n = 0; n < 5000 && signAt(closing) === cur; n++) closing += step;
  out.push({ label: SIGNS[cur]!, lord: planet, startUtcMs: spanStart, endUtcMs: bisectChange(signAt, closing - step, closing) });
  return out;
}

const WEEKDAY_RULERS: readonly Planet[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

export interface PlanetaryHour {
  dayRuler: Planet;
  hourRuler: Planet;
  /** 1 to 24, counted from sunrise. */
  hourNumber: number;
  isDaytime: boolean;
  startUtcMs: number;
  endUtcMs: number;
}

/**
 * Planetary day and hour. The day runs from sunrise to sunrise and takes the ruler of
 * the weekday on which it began; daylight and darkness are each cut into twelve equal
 * hours ruled in descending Chaldean order from the day ruler. Null where the Sun
 * neither rises nor sets.
 */
export function planetaryHour(moment: Moment): PlanetaryHour | null {
  const { place, utcMs } = moment;
  const rise = lastEvent('rise', utcMs, moment);
  if (rise === null) return null;
  const set = nextSunEvent('set', rise, place);
  const nextRise = nextSunEvent('rise', rise + MS.HOUR, place);
  if (set === null || nextRise === null || set > nextRise) return null;
  // Weekday of the local mean date on which that sunrise fell.
  const localDay = Math.floor((rise + place.longitude * 4 * MS.MIN) / MS.DAY);
  const weekday = (((localDay + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday.
  const dayRuler = WEEKDAY_RULERS[weekday]!;
  const isDaytime = utcMs < set;
  const [a, b] = isDaytime ? [rise, set] : [set, nextRise];
  const k = Math.min(11, Math.floor(((utcMs - a) / (b - a)) * 12));
  const hourNumber = (isDaytime ? 0 : 12) + k + 1;
  const hourRuler = CHALDEAN[(CHALDEAN.indexOf(dayRuler) + hourNumber - 1) % 7]!;
  return {
    dayRuler,
    hourRuler,
    hourNumber,
    isDaytime,
    startUtcMs: a + ((b - a) * k) / 12,
    endUtcMs: a + ((b - a) * (k + 1)) / 12,
  };
}

function lastEvent(kind: 'rise' | 'set', utcMs: number, moment: Moment): number | null {
  let t = nextSunEvent(kind, utcMs - 26 * MS.HOUR, moment.place);
  if (t === null || t > utcMs) return null;
  for (;;) {
    const n = nextSunEvent(kind, t + MS.HOUR, moment.place);
    if (n === null || n > utcMs) return t;
    t = n;
  }
}

export { dignitiesAt };
