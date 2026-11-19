// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The twenty-four solar terms, defined astronomically: term k is the instant at which
 * the Sun's apparent longitude reaches 315 + 15k degrees. Index 0 is Lichun, the start
 * of the BaZi year. Even indices are the twelve "jie" (which open the BaZi months) and
 * odd indices are the twelve "zhongqi" (which coincide with the tropical sign ingresses).
 */
import { nextSunLongitude, norm360 } from './sky.ts';
import { utcMsFromFields, MS } from './time.ts';

export interface SolarTermInfo {
  index: number;
  hanzi: string;
  pinyin: string;
  english: string;
  longitude: number;
  isJie: boolean;
}

const RAW: Array<[string, string, string]> = [
  ['立春', 'Lichun', 'Beginning of Spring'],
  ['雨水', 'Yushui', 'Rain Water'],
  ['驚蟄', 'Jingzhe', 'Awakening of Insects'],
  ['春分', 'Chunfen', 'Spring Equinox'],
  ['清明', 'Qingming', 'Clear and Bright'],
  ['穀雨', 'Guyu', 'Grain Rain'],
  ['立夏', 'Lixia', 'Beginning of Summer'],
  ['小滿', 'Xiaoman', 'Grain Full'],
  ['芒種', 'Mangzhong', 'Grain in Ear'],
  ['夏至', 'Xiazhi', 'Summer Solstice'],
  ['小暑', 'Xiaoshu', 'Minor Heat'],
  ['大暑', 'Dashu', 'Major Heat'],
  ['立秋', 'Liqiu', 'Beginning of Autumn'],
  ['處暑', 'Chushu', 'End of Heat'],
  ['白露', 'Bailu', 'White Dew'],
  ['秋分', 'Qiufen', 'Autumn Equinox'],
  ['寒露', 'Hanlu', 'Cold Dew'],
  ['霜降', 'Shuangjiang', 'Descent of Frost'],
  ['立冬', 'Lidong', 'Beginning of Winter'],
  ['小雪', 'Xiaoxue', 'Minor Snow'],
  ['大雪', 'Daxue', 'Major Snow'],
  ['冬至', 'Dongzhi', 'Winter Solstice'],
  ['小寒', 'Xiaohan', 'Minor Cold'],
  ['大寒', 'Dahan', 'Major Cold'],
];

export const SOLAR_TERMS: readonly SolarTermInfo[] = RAW.map(([hanzi, pinyin, english], index) => ({
  index,
  hanzi,
  pinyin,
  english,
  longitude: norm360(315 + 15 * index),
  isJie: index % 2 === 0,
}));

export interface TermInstant {
  term: SolarTermInfo;
  /** The Lichun-to-Lichun cycle year the term belongs to (terms 22 and 23 fall in the next January). */
  cycleYear: number;
  utcMs: number;
}

const cache = new Map<string, number>();

/** Instant of solar term `index` in the cycle that opens with Lichun of the given Gregorian year. */
export function solarTermInstant(cycleYear: number, index: number): number {
  const key = `${cycleYear}:${index}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  // Lichun falls on about 4 February; terms are spaced by roughly 15.2 days.
  const approx = utcMsFromFields(cycleYear, 2, 4) + index * 15.2184 * MS.DAY;
  const ms = nextSunLongitude(SOLAR_TERMS[index]!.longitude, approx - 6 * MS.DAY);
  cache.set(key, ms);
  return ms;
}

function cycleTerms(cycleYear: number): TermInstant[] {
  return SOLAR_TERMS.map((term) => ({ term, cycleYear, utcMs: solarTermInstant(cycleYear, term.index) }));
}

/** All solar terms with instants in [startMs, endMs), in order. */
export function termsBetween(startMs: number, endMs: number): TermInstant[] {
  const y0 = new Date(startMs).getUTCFullYear() - 1;
  const y1 = new Date(endMs).getUTCFullYear();
  const out: TermInstant[] = [];
  for (let y = y0; y <= y1; y++) {
    for (const t of cycleTerms(y)) if (t.utcMs >= startMs && t.utcMs < endMs) out.push(t);
  }
  return out;
}

/** The term in force at the instant, and the one that follows it. */
export function termsAround(utcMs: number, onlyJie = false): { previous: TermInstant; next: TermInstant } {
  const y = new Date(utcMs).getUTCFullYear();
  const all = [...cycleTerms(y - 2), ...cycleTerms(y - 1), ...cycleTerms(y), ...cycleTerms(y + 1)].filter(
    (t) => !onlyJie || t.term.isJie,
  );
  let i = all.length - 1;
  while (i > 0 && all[i]!.utcMs > utcMs) i--;
  return { previous: all[i]!, next: all[i + 1]! };
}

/** Lichun of the given Gregorian year. */
export function lichun(year: number): number {
  return solarTermInstant(year, 0);
}

/** The BaZi year (the Gregorian year whose Lichun most recently passed). */
export function lichunYear(utcMs: number): number {
  const y = new Date(utcMs).getUTCFullYear();
  if (utcMs >= lichun(y + 1)) return y + 1;
  return utcMs >= lichun(y) ? y : y - 1;
}
