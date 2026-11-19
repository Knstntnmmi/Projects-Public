// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The sidereal layer: Lahiri ayanamsa, the twenty-seven nakshatras and the vimshottari
 * dasha sequence that follows from the Moon's place among them.
 */
import { longitudeOf, norm360 } from '../../substrate/sky.ts';
import { astroTime, MS, type Moment } from '../../substrate/time.ts';

/**
 * Nutation in longitude (IAU 1980, the model that the Swiss Ephemeris documentation
 * reports the Indian Astronomical Ephemeris uses): the largest terms of the series
 * tabulated in Meeus, Astronomical Algorithms, 2nd ed., table 22.A. The coefficients were
 * typed from memory of the book, which has not been opened. Each term left out is below
 * 0.003 arcsecond; the sum is off by 0.006 against Meeus's worked example (10 April 1987,
 * 0h TD, -3.788 arcseconds, also recalled), and the ayanamsa tests below check it
 * independently to 0.3 arcsecond against published true values.
 * Columns: multiples of D, M, M', F and the lunar node, then the coefficients in units
 * of 0.0001 arcsecond (constant and per Julian century).
 */
const NUTATION_TERMS: readonly (readonly [number, number, number, number, number, number, number])[] = [
  [0, 0, 0, 0, 1, -171996, -174.2], [-2, 0, 0, 2, 2, -13187, -1.6], [0, 0, 0, 2, 2, -2274, -0.2],
  [0, 0, 0, 0, 2, 2062, 0.2], [0, 1, 0, 0, 0, 1426, -3.4], [0, 0, 1, 0, 0, 712, 0.1],
  [-2, 1, 0, 2, 2, -517, 1.2], [0, 0, 0, 2, 1, -386, -0.4], [0, 0, 1, 2, 2, -301, 0],
  [-2, -1, 0, 2, 2, 217, -0.5], [-2, 0, 1, 0, 0, -158, 0], [-2, 0, 0, 2, 1, 129, 0.1],
  [0, 0, -1, 2, 2, 123, 0], [2, 0, 0, 0, 0, 63, 0], [0, 0, 1, 0, 1, 63, 0.1],
  [2, 0, -1, 2, 2, -59, 0], [0, 0, -1, 0, 1, -58, -0.1], [0, 0, 1, 2, 1, -51, 0],
  [-2, 0, 2, 0, 0, 48, 0], [0, 0, -2, 2, 1, 46, 0], [2, 0, 0, 2, 2, -38, 0],
  [0, 0, 2, 2, 2, -31, 0], [0, 0, 2, 0, 0, 29, 0], [-2, 0, 1, 2, 2, 29, 0],
  [0, 0, 0, 2, 0, 26, 0], [-2, 0, 0, 2, 0, -22, 0],
];

/** Nutation in longitude in degrees at the given Julian centuries from J2000 (TT). */
export function nutationInLongitude(T: number): number {
  const rad = Math.PI / 180;
  const D = (297.85036 + 445267.11148 * T - 0.0019142 * T * T + (T * T * T) / 189474) * rad;
  const M = (357.52772 + 35999.05034 * T - 0.0001603 * T * T - (T * T * T) / 300000) * rad;
  const Mp = (134.96298 + 477198.867398 * T + 0.0086972 * T * T + (T * T * T) / 56250) * rad;
  const F = (93.27191 + 483202.017538 * T - 0.0036825 * T * T + (T * T * T) / 327270) * rad;
  const O = (125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000) * rad;
  let sum = 0;
  for (const [d, m, mp, f, o, a, b] of NUTATION_TERMS) {
    sum += (a + b * T) * Math.sin(d * D + m * M + mp * Mp + f * F + o * O);
  }
  return sum / 10000 / 3600;
}

// The epoch of the definition: 21 March 1956, 0h Ephemeris Time, taken as 0h TT, which is
// Julian Day 2435553.5; here in Julian centuries from J2000.0 (JD 2451545.0).
const LAHIRI_EPOCH_T = (2435553.5 - 2451545) / 36525;
/**
 * The value fixed at that epoch: 23 degrees 15 minutes 00.658 seconds, true (nutation
 * included). The Calendar Reform Committee's 1955 report fixed 23 degrees 15 minutes
 * 00 seconds; the Indian Astronomical Ephemeris has used the 0.658 arcsecond revision
 * since 1985. See lahiriAyanamsa for what is established about it and what is not.
 */
const LAHIRI_EPOCH_TRUE = 23 + 15 / 60 + 0.658 / 3600;
/** General precession in longitude, arcseconds, from J2000 (IAU 2006 polynomial). */
const precessionArcsec = (T: number) => 5028.796195 * T + 1.1054348 * T * T;

/**
 * Lahiri (Chitrapaksha) ayanamsa in degrees, the TRUE ayanamsa: mean ayanamsa plus the
 * nutation in longitude.
 *
 * Why true: every longitude in this project is measured from the true equinox of date,
 * nutation included. The ayanamsa is meant to anchor the zodiac to the stars, which do
 * not nod with the equinox, so the nutation has to come off with it; subtracting a mean
 * ayanamsa instead would leave the nutation (up to about 17 arcseconds) in every
 * sidereal longitude. The Swiss Ephemeris documentation reports that the Indian
 * Astronomical Ephemeris 2019 tabulates true ayanamsa values (p. 427) and mean ones
 * (p. 429); the Ephemeris itself has not been seen.
 *
 * What is defined: the Indian Calendar Reform Committee (report submitted 1955) set the
 * start of the religious solar year at a tropical longitude of the Sun of 23 degrees 15
 * minutes (p. 251 of the CSIR reprint of Part C of the report, Saha and Lahiri; that
 * reading was made once for this project and not independently confirmed, and the
 * source audit did not reach the report), which is an ayanamsa of 23 degrees 15 minutes
 * for 1956. The Swiss Ephemeris documentation (section 2.8.5, appendix E) says the
 * zero point was chosen opposite the star Spica (Chitra) and states the definition as
 * exactly 23 degrees 15 minutes 00 seconds on 21 March 1956, 0h Ephemeris Time. It
 * reports that the Indian Astronomical Ephemeris has used 23 degrees 15 minutes
 * 00.658 seconds since 1985; that revised value is used here. The difference is
 * 0.658 arcsecond.
 *
 * What is not established: whether that epoch value is a TRUE or a MEAN ayanamsa. As the
 * Swiss Ephemeris documentation quotes it, the Ephemeris's own footnote says the 0.658
 * value is used for the mean ayanamsa, and another page gives 23 degrees 15 minutes
 * 00 seconds exactly. The Swiss Ephemeris authors conclude from the true values that the
 * Ephemeris publishes for 2019, which they reproduce to 0.1 arcsecond only if the epoch
 * value is true, that it is a true value, and follow that. So do we. Read as a mean
 * value, every result here would move by the 1956 nutation, about 16 arcseconds.
 *
 * What is derived: the value at any other time, by carrying the epoch value along the
 * IAU 2006 general precession in longitude and adding the nutation. The Ephemeris
 * states that it uses the IAU 1976 precession rate, which is about 0.3 arcsecond per
 * century larger, so the two part by about 0.2 arcsecond in 2020. The mean value at
 * J2000 comes out at 23 degrees 51 minutes 25.4 seconds; the Ephemeris prints 25.53. The
 * previous constant here, 23 degrees 51 minutes 11 seconds, had no source and was 14
 * arcseconds low at J2000; it gave a value 30 arcseconds under the definition when run
 * back to 1956.
 *
 * Remaining error: at most about 0.3 arcsecond against the published values compared in
 * the tests (1989 to 2020), from the precession rate and the truncated nutation series.
 * The uncertainty about true against mean, above, is not included in that figure. The
 * sensitivity report shows when a boundary is close enough for either to matter.
 */
export function lahiriAyanamsa(utcMs: number): number {
  const T = astroTime(utcMs).tt / 36525;
  return lahiriMeanAyanamsa(utcMs) + nutationInLongitude(T);
}

/** The mean ayanamsa (no nutation), for comparison with tabulated mean values. */
export function lahiriMeanAyanamsa(utcMs: number): number {
  const T = astroTime(utcMs).tt / 36525;
  const meanAtEpoch = LAHIRI_EPOCH_TRUE - nutationInLongitude(LAHIRI_EPOCH_T);
  return meanAtEpoch + (precessionArcsec(T) - precessionArcsec(LAHIRI_EPOCH_T)) / 3600;
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
