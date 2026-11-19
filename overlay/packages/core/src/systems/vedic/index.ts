// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The sidereal layer: Lahiri ayanamsa, the twenty-seven nakshatras and the vimshottari
 * dasha sequence that follows from the Moon's place among them.
 */
import { longitudeOf, norm360 } from '../../substrate/sky.ts';
import { astroTime, MS, type Moment } from '../../substrate/time.ts';

/**
 * Lahiri (Chitrapaksha) ayanamsa in degrees: 23 degrees 51 minutes 11 seconds at J2000,
 * carried by the IAU general precession in longitude. Nutation is left out, which keeps
 * it within about twenty arcseconds of the published true value; the sensitivity report
 * shows when a boundary is close enough for that to matter.
 */
export function lahiriAyanamsa(utcMs: number): number {
  const T = astroTime(utcMs).tt / 36525;
  return 23.853056 + (5028.796195 * T + 1.1054348 * T * T) / 3600;
}

export function siderealLongitude(tropical: number, utcMs: number): number {
  return norm360(tropical - lahiriAyanamsa(utcMs));
}

export const NAKSHATRAS: readonly { name: string; lord: string }[] = [
  ['Ashwini', 'Ketu'], ['Bharani', 'Venus'], ['Krittika', 'Sun'], ['Rohini', 'Moon'], ['Mrigashira', 'Mars'],
  ['Ardra', 'Rahu'], ['Punarvasu', 'Jupiter'], ['Pushya', 'Saturn'], ['Ashlesha', 'Mercury'],
  ['Magha', 'Ketu'], ['Purva Phalguni', 'Venus'], ['Uttara Phalguni', 'Sun'], ['Hasta', 'Moon'], ['Chitra', 'Mars'],
  ['Swati', 'Rahu'], ['Vishakha', 'Jupiter'], ['Anuradha', 'Saturn'], ['Jyeshtha', 'Mercury'],
  ['Mula', 'Ketu'], ['Purva Ashadha', 'Venus'], ['Uttara Ashadha', 'Sun'], ['Shravana', 'Moon'], ['Dhanishta', 'Mars'],
  ['Shatabhisha', 'Rahu'], ['Purva Bhadrapada', 'Jupiter'], ['Uttara Bhadrapada', 'Saturn'], ['Revati', 'Mercury'],
].map(([name, lord]) => ({ name: name!, lord: lord! }));

export const NAKSHATRA_ARC = 360 / 27;

export const DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'] as const;
export const DASHA_YEARS: Record<(typeof DASHA_ORDER)[number], number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};

export interface NakshatraPosition {
  index: number;
  name: string;
  lord: string;
  /** Quarter (pada), 1 to 4. */
  pada: number;
  /** Fraction of the nakshatra already traversed. */
  fraction: number;
  siderealLongitude: number;
}

export function nakshatraOf(tropicalLongitude: number, utcMs: number): NakshatraPosition {
  const sid = siderealLongitude(tropicalLongitude, utcMs);
  const index = Math.min(26, Math.floor(sid / NAKSHATRA_ARC));
  const fraction = sid / NAKSHATRA_ARC - index;
  return {
    index,
    name: NAKSHATRAS[index]!.name,
    lord: NAKSHATRAS[index]!.lord,
    pada: Math.min(4, Math.floor(fraction * 4) + 1),
    fraction,
    siderealLongitude: sid,
  };
}

export interface DashaSpan {
  label: string;
  lord: string;
  startUtcMs: number;
  endUtcMs: number;
}

const DASHA_YEAR_MS = 365.25 * MS.DAY;

/**
 * Vimshottari mahadashas and their antardashas. The lord of the Moon's nakshatra rules
 * at birth, with the part of its period already elapsed in proportion to the Moon's
 * progress through the nakshatra; a year is taken as 365.25 days.
 */
export function vimshottari(moment: Moment, untilAge = 120): { maha: DashaSpan[]; antar: DashaSpan[] } {
  const moon = nakshatraOf(longitudeOf('Moon', moment.utcMs), moment.utcMs);
  let i = DASHA_ORDER.indexOf(moon.lord as (typeof DASHA_ORDER)[number]);
  let t = moment.utcMs - moon.fraction * DASHA_YEARS[DASHA_ORDER[i]!] * DASHA_YEAR_MS;
  const maha: DashaSpan[] = [];
  const antar: DashaSpan[] = [];
  const end = moment.utcMs + untilAge * DASHA_YEAR_MS;
  while (t < end) {
    const lord = DASHA_ORDER[i]!;
    const length = DASHA_YEARS[lord] * DASHA_YEAR_MS;
    maha.push({ label: lord, lord, startUtcMs: t, endUtcMs: t + length });
    let s = t;
    for (let k = 0; k < 9; k++) {
      const sub = DASHA_ORDER[(i + k) % 9]!;
      const subLength = (length * DASHA_YEARS[sub]) / 120;
      antar.push({ label: `${lord} / ${sub}`, lord: sub, startUtcMs: s, endUtcMs: s + subLength });
      s += subLength;
    }
    t += length;
    i = (i + 1) % 9;
  }
  return { maha, antar };
}
