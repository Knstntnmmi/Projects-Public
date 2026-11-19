// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Lilly's aspects and orbs, Christian Astrology (1647), Book I p.105-107 and p.113-114
 * (table C of the verified rule file). Five aspects; each planet has an orb of its rays and
 * half of it is its moiety; two planets aspect platickly when they lie within the sum of
 * their moieties of the exact aspect, and partilely when they stand in the same degree.
 * Lilly uses now one column of orbs and now the other (p.107); the first is the default.
 */
import type { Planet } from '../../substrate/sky.ts';

export const ASPECT_ANGLES = [
  { name: 'conjunction', angle: 0 },
  { name: 'sextile', angle: 60 },
  { name: 'square', angle: 90 },
  { name: 'trine', angle: 120 },
  { name: 'opposition', angle: 180 },
] as const;
export type AspectName = (typeof ASPECT_ANGLES)[number]['name'];

/** Orbs of the rays in degrees: the first column of p.107 and the "according to others" column. */
export const ORB_COLUMNS = {
  first: { Saturn: 10, Jupiter: 12, Mars: 7.5, Sun: 17, Venus: 8, Mercury: 7, Moon: 12.5 },
  second: { Saturn: 9, Jupiter: 9, Mars: 7, Sun: 15, Venus: 7, Mercury: 7, Moon: 12 },
} as const satisfies Record<string, Record<Planet, number>>;
export type OrbColumn = keyof typeof ORB_COLUMNS;

/** Combustion, beams and cazimi (p.113), in degrees; and the greatest elongations (p.114). */
export const SUN_PROXIMITY = { combust: 8.5, beams: 17, cazimi: 17 / 60 } as const;
export const MAX_ELONGATION = { Mercury: 28, Venus: 48 } as const;

export const moiety = (planet: Planet, column: OrbColumn = 'first'): number => ORB_COLUMNS[column][planet] / 2;

const norm360 = (x: number): number => ((x % 360) + 360) % 360;
/** Signed difference in (-180, 180]. */
const circ = (x: number): number => {
  const d = norm360(x);
  return d > 180 ? d - 360 : d;
};

/** Angular separation of two longitudes, 0 to 180. */
export const separation = (a: number, b: number): number => Math.abs(circ(a - b));

export interface Aspect {
  aspect: AspectName;
  angle: number;
  /** Degrees from the exact aspect. */
  distance: number;
  /** The sum of the two moieties: the greatest distance at which the aspect holds. */
  allowed: number;
  /** Within the sum of the moieties. */
  platick: boolean;
  /** In the same degree of two signs that stand in the aspect. */
  partile: boolean;
}

const signIndex = (l: number): number => Math.floor(norm360(l) / 30) % 12;
const degreeOf = (l: number): number => Math.floor(norm360(l) - signIndex(l) * 30);

/** Partile: the planets stand in the same degree of signs that are in the aspect by sign (Table B uses this reading, p.115). */
export function isPartile(lonA: number, lonB: number, angle: number): boolean {
  const apart = (((signIndex(lonB) - signIndex(lonA)) % 12) + 12) % 12;
  return (apart === angle / 30 || apart === (12 - angle / 30) % 12) && degreeOf(lonA) === degreeOf(lonB);
}

/**
 * The aspect between two planets at two longitudes, if one holds by the orbs of the column
 * (platick, which includes partile); null otherwise. No two aspects can both hold: the
 * widest sum of moieties is 14.75 degrees and the aspects are 30 or more degrees apart.
 */
export function aspectBetween(a: Planet, lonA: number, b: Planet, lonB: number, column: OrbColumn = 'first'): Aspect | null {
  const sep = separation(lonA, lonB);
  const allowed = moiety(a, column) + moiety(b, column);
  for (const { name, angle } of ASPECT_ANGLES) {
    const distance = Math.abs(sep - angle);
    if (distance <= allowed) return { aspect: name, angle, distance, allowed, platick: true, partile: isPartile(lonA, lonB, angle) };
  }
  return null;
}

/**
 * Whether the aspect between two planets is applying: the distance from the exact aspect is
 * shrinking, judged from their daily motions over a thousandth of a day.
 */
export function isApplying(lonA: number, speedA: number, lonB: number, speedB: number, angle: number): boolean {
  const dist = (x: number, y: number): number => Math.abs(separation(x, y) - angle);
  const dt = 0.001;
  return dist(lonA + speedA * dt, lonB + speedB * dt) < dist(lonA, lonB);
}

/**
 * Partile as the orbs rule states it (p.106): the same degree and the same minute of signs
 * that stand in the aspect. Table B reads the coarser same-degree test above.
 */
export function isPartileMinute(lonA: number, lonB: number, angle: number): boolean {
  const apart = (((signIndex(lonB) - signIndex(lonA)) % 12) + 12) % 12;
  if (apart !== angle / 30 && apart !== (12 - angle / 30) % 12) return false;
  const minute = (l: number): number => Math.floor(((norm360(l) % 30) * 60) + 1e-9);
  return minute(lonA) === minute(lonB);
}
