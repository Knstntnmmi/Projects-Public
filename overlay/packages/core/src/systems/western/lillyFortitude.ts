// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Lilly's accidental fortitudes and debilities, Christian Astrology (1647), Book I p.115
 * (table B of the verified rule file), with the definitions of p.112-114.
 *
 * Not scored, because the verified file gives no threshold or no data for them: "swift" and
 * "slow" in motion (no mean motion is stated) and the three fixed-star rows (Cor Leonis,
 * Spica, Caput Algol: their positions in the table are those of 1647 and the engine has no
 * star data). A planet's accidental score is therefore the sum of the other rows.
 */
import type { Planet } from '../../substrate/sky.ts';
import { isPartile, separation, SUN_PROXIMITY, type AspectName } from './aspects.ts';

/** House fortitudes by whole-sign house: the Ascendant and the Midheaven stand for houses 1 and 10. */
export const HOUSE_FORTITUDE: Readonly<Record<number, number>> = {
  1: 5, 10: 5, 7: 4, 4: 4, 11: 4, 2: 3, 5: 3, 9: 2, 3: 1, 12: -5, 8: -2, 6: -2,
};

export interface BodyState {
  planet: Planet;
  /** Ecliptic longitude, degrees. */
  longitude: number;
  retrograde: boolean;
  /** Whole-sign house 1 to 12 (a labelled variant of Lilly's Regiomontanus houses). */
  house: number;
}

export interface FortitudeChart {
  isDay: boolean;
  /** All seven planets. */
  bodies: readonly BodyState[];
  /** Longitude of the Dragon's Head; the Tail is opposite. */
  head: number;
}

export interface AccidentalItem {
  label: string;
  score: number;
}

const FORTUNES: readonly Planet[] = ['Jupiter', 'Venus'];
const INFORTUNES: readonly Planet[] = ['Saturn', 'Mars'];

const norm360 = (x: number): number => ((x % 360) + 360) % 360;

/**
 * Oriental (rising before the Sun) means the planet's longitude is behind the Sun's by less
 * than half a circle. For Venus and Mercury Lilly words this as fewer degrees of the Sun's
 * sign or the sign before (p.114); the two agree except for Venus more than a sign and a
 * half behind, which the 48 degree limit allows. The Sun itself is neither.
 */
export function isOriental(planet: Planet, longitude: number, sunLongitude: number): boolean | null {
  if (planet === 'Sun') return null;
  const behind = norm360(sunLongitude - longitude);
  return behind > 0 && behind < 180;
}

/** The Moon is increasing in light when she is ahead of the Sun by less than half a circle. */
export const moonIncreasing = (moon: number, sun: number): boolean => norm360(moon - sun) < 180;

export function accidentalItems(planet: Planet, chart: FortitudeChart): AccidentalItem[] {
  const me = chart.bodies.find((b) => b.planet === planet)!;
  const sun = chart.bodies.find((b) => b.planet === 'Sun')!;
  const out: AccidentalItem[] = [];
  const add = (label: string, score: number): void => void out.push({ label, score });

  const h = HOUSE_FORTITUDE[me.house]!;
  add(`house ${me.house}`, h);

  if (planet !== 'Sun' && planet !== 'Moon') {
    if (me.retrograde) add('retrograde', -5);
    else add('direct', 4);
  }

  if (planet === 'Moon') {
    // Lilly's two Moon rows coincide: increasing in light is being occidental of the Sun.
    add(moonIncreasing(me.longitude, sun.longitude) ? 'Moon increasing in light' : 'Moon decreasing in light', moonIncreasing(me.longitude, sun.longitude) ? 2 : -2);
  } else if (planet !== 'Sun') {
    const east = isOriental(planet, me.longitude, sun.longitude)!;
    const superior = planet === 'Saturn' || planet === 'Jupiter' || planet === 'Mars';
    const good = superior ? east : !east;
    add(`${east ? 'oriental' : 'occidental'} of the Sun`, good ? 2 : -2);
  }

  if (planet !== 'Sun') {
    const sep = separation(me.longitude, sun.longitude);
    const sameSign = Math.floor(norm360(me.longitude) / 30) === Math.floor(norm360(sun.longitude) / 30);
    if (sep <= SUN_PROXIMITY.cazimi) add('cazimi', 5);
    else if (sameSign && sep <= SUN_PROXIMITY.combust) add('combust', -5);
    else if (sep <= SUN_PROXIMITY.beams) add('under the beams', -4);
    else add('free from combustion and beams', 5);
  }

  // Partile aspects to the fortunes, the infortunes and the nodes.
  const others = chart.bodies.filter((b) => b.planet !== planet);
  const partileKind = (a: number, b: number): AspectName | null => {
    for (const [name, angle] of [['conjunction', 0], ['sextile', 60], ['square', 90], ['trine', 120], ['opposition', 180]] as const) {
      if (isPartile(a, b, angle)) return name;
    }
    return null;
  };
  for (const o of others) {
    const kind = partileKind(me.longitude, o.longitude);
    if (!kind) continue;
    if (FORTUNES.includes(o.planet)) {
      const s = kind === 'conjunction' ? 5 : kind === 'trine' ? 4 : kind === 'sextile' ? 3 : 0;
      if (s) add(`partile ${kind} with ${o.planet}`, s);
    } else if (INFORTUNES.includes(o.planet)) {
      const s = kind === 'conjunction' ? -5 : kind === 'opposition' ? -4 : kind === 'square' ? -3 : 0;
      if (s) add(`partile ${kind} with ${o.planet}`, s);
    }
  }
  if (isPartile(me.longitude, chart.head, 0)) add("partile conjunction with the Dragon's Head", 4);
  if (isPartile(me.longitude, norm360(chart.head + 180), 0)) add("partile conjunction with the Dragon's Tail", -4);

  // Besieged: the nearest planet each side is Saturn and the other Mars.
  if (!INFORTUNES.includes(planet)) {
    const ahead = nearest(others, me.longitude, +1);
    const behind = nearest(others, me.longitude, -1);
    if (ahead && behind && INFORTUNES.includes(ahead) && INFORTUNES.includes(behind) && ahead !== behind) add('besieged by Saturn and Mars', -5);
  }
  return out;
}

/** The planet nearest to a longitude going forward (+1) or backward (-1) round the zodiac. */
function nearest(others: readonly BodyState[], from: number, dir: 1 | -1): Planet | null {
  let best: Planet | null = null;
  let bestGap = Infinity;
  for (const o of others) {
    const gap = dir === 1 ? norm360(o.longitude - from) : norm360(from - o.longitude);
    if (gap > 0 && gap < bestGap) {
      bestGap = gap;
      best = o.planet;
    }
  }
  return best;
}

/** A: the accidental score of a planet. */
export function accidentalScore(planet: Planet, chart: FortitudeChart): number {
  return accidentalItems(planet, chart).reduce((n, i) => n + i.score, 0);
}
