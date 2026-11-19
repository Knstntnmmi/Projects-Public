// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * William Lilly's essential dignities, Christian Astrology (London, 1647), Book I p.101-105:
 * the table "according to Ptolomy" and the scores. This is a different school from the
 * Dorothean triplicities, Egyptian bounds and Chaldean faces of dignities.ts, which the
 * engine keeps; the rules of the Lilly family run on this module and on nothing from there.
 *
 * Every cell is checked against the verified rule file by test/lillyTables.test.ts.
 */
import type { Planet } from '../../substrate/sky.ts';
import type { Sign } from './dignities.ts';

/** The nodes appear in the table only as exalted and fallen bodies. */
export type TableBody = Planet | 'Head' | 'Tail';

export interface LillyRow {
  sign: Sign;
  /** Lord of the sign. */
  house: Planet;
  /** Mercury, Venus, Mars, Saturn and Jupiter have one diurnal and one nocturnal house; the table marks which. */
  houseSect: 'D' | 'N' | null;
  exaltation: { body: TableBody; degree: number } | null;
  /** Triplicity rulers by day and by night; there is no participating ruler. */
  triplicity: readonly [Planet, Planet];
  /** Lord and end degree: a term runs from the previous end (the first from 0) up to but not including its end. */
  terms: readonly (readonly [Planet, number])[];
  /** Lords of 0 to 10, 10 to 20 and 20 to 30 degrees. */
  faces: readonly [Planet, Planet, Planet];
  detriment: Planet;
  fall: TableBody | null;
}

type Raw = readonly [Sign, Planet, 'D' | 'N' | null, readonly [TableBody, number] | null, readonly [Planet, Planet], readonly (readonly [Planet, number])[], readonly [Planet, Planet, Planet], Planet, TableBody | null];

const RAW: readonly Raw[] = [
  ['Aries', 'Mars', 'D', ['Sun', 19], ['Sun', 'Jupiter'], [['Jupiter', 6], ['Venus', 14], ['Mercury', 21], ['Mars', 26], ['Saturn', 30]], ['Mars', 'Sun', 'Venus'], 'Venus', 'Saturn'],
  ['Taurus', 'Venus', 'N', ['Moon', 3], ['Venus', 'Moon'], [['Venus', 8], ['Mercury', 15], ['Jupiter', 22], ['Saturn', 26], ['Mars', 30]], ['Mercury', 'Moon', 'Saturn'], 'Mars', null],
  ['Gemini', 'Mercury', 'D', ['Head', 3], ['Saturn', 'Mercury'], [['Mercury', 7], ['Jupiter', 14], ['Venus', 21], ['Saturn', 25], ['Mars', 30]], ['Jupiter', 'Mars', 'Sun'], 'Jupiter', 'Tail'],
  ['Cancer', 'Moon', null, ['Jupiter', 15], ['Mars', 'Mars'], [['Mars', 6], ['Jupiter', 13], ['Mercury', 20], ['Venus', 27], ['Saturn', 30]], ['Venus', 'Mercury', 'Moon'], 'Saturn', 'Mars'],
  ['Leo', 'Sun', null, null, ['Sun', 'Jupiter'], [['Saturn', 6], ['Mercury', 13], ['Venus', 19], ['Jupiter', 25], ['Mars', 30]], ['Saturn', 'Jupiter', 'Mars'], 'Saturn', null],
  ['Virgo', 'Mercury', 'N', ['Mercury', 15], ['Venus', 'Moon'], [['Mercury', 7], ['Venus', 13], ['Jupiter', 18], ['Saturn', 24], ['Mars', 30]], ['Sun', 'Venus', 'Mercury'], 'Jupiter', 'Venus'],
  ['Libra', 'Venus', 'D', ['Saturn', 21], ['Saturn', 'Mercury'], [['Saturn', 6], ['Venus', 11], ['Jupiter', 19], ['Mercury', 24], ['Mars', 30]], ['Moon', 'Saturn', 'Jupiter'], 'Mars', 'Sun'],
  ['Scorpio', 'Mars', 'N', null, ['Mars', 'Mars'], [['Mars', 6], ['Jupiter', 14], ['Venus', 21], ['Mercury', 27], ['Saturn', 30]], ['Mars', 'Sun', 'Venus'], 'Venus', 'Moon'],
  ['Sagittarius', 'Jupiter', 'D', ['Tail', 3], ['Sun', 'Jupiter'], [['Jupiter', 8], ['Venus', 14], ['Mercury', 19], ['Saturn', 25], ['Mars', 30]], ['Mercury', 'Moon', 'Saturn'], 'Mercury', 'Head'],
  ['Capricorn', 'Saturn', 'N', ['Mars', 28], ['Venus', 'Moon'], [['Venus', 6], ['Mercury', 12], ['Jupiter', 19], ['Mars', 25], ['Saturn', 30]], ['Jupiter', 'Mars', 'Sun'], 'Moon', 'Jupiter'],
  ['Aquarius', 'Saturn', 'D', null, ['Saturn', 'Mercury'], [['Saturn', 6], ['Mercury', 12], ['Venus', 20], ['Jupiter', 25], ['Mars', 30]], ['Venus', 'Mercury', 'Moon'], 'Sun', null],
  ['Pisces', 'Jupiter', 'N', ['Venus', 27], ['Mars', 'Mars'], [['Venus', 8], ['Jupiter', 14], ['Mercury', 20], ['Mars', 26], ['Saturn', 30]], ['Saturn', 'Jupiter', 'Mars'], 'Mercury', 'Mercury'],
];

export const LILLY_TABLE_A: readonly LillyRow[] = RAW.map(([sign, house, houseSect, ex, triplicity, terms, faces, detriment, fall]) => ({
  sign,
  house,
  houseSect,
  exaltation: ex ? { body: ex[0], degree: ex[1] } : null,
  triplicity,
  terms,
  faces,
  detriment,
  fall,
}));

/** Scores, Book I p.101-103 and p.115. */
export const ESSENTIAL_SCORES = { house: 5, exaltation: 4, triplicity: 3, term: 2, face: 1, detriment: -5, fall: -4, peregrine: -5 } as const;

export type EssentialKind = keyof typeof ESSENTIAL_SCORES;

export interface EssentialItem {
  kind: EssentialKind;
  score: number;
}

const norm = (x: number): number => ((x % 360) + 360) % 360;

export function rowAt(longitude: number): LillyRow {
  return LILLY_TABLE_A[Math.floor(norm(longitude) / 30) % 12]!;
}

/** The lord of the term at a longitude. */
export function termLord(longitude: number): Planet {
  const l = norm(longitude);
  const deg = l - Math.floor(l / 30) * 30;
  for (const [planet, end] of rowAt(l).terms) if (deg < end) return planet;
  return rowAt(l).terms[4]![0];
}

export function faceLord(longitude: number): Planet {
  const l = norm(longitude);
  const deg = l - Math.floor(l / 30) * 30;
  return rowAt(l).faces[Math.min(2, Math.floor(deg / 10))]!;
}

/** The triplicity ruler that counts for the sect of the chart. */
export function triplicityLord(longitude: number, isDay: boolean): Planet {
  return rowAt(longitude).triplicity[isDay ? 0 : 1];
}

/** The domicile lord of a sign (by index 0 to 11). */
export function houseLord(signIndex: number): Planet {
  return LILLY_TABLE_A[((signIndex % 12) + 12) % 12]!.house;
}

/**
 * Which dignities and debilities a planet holds at a longitude, each with Lilly's score.
 * A planet in its own face or term is not peregrine (p.103). The scores of the debilities
 * are added to those of the dignities as the table lists them as separate lines, so a
 * planet in its detriment that holds no dignity scores detriment and peregrine both.
 */
export function essentialItems(planet: Planet, longitude: number, isDay: boolean): EssentialItem[] {
  const row = rowAt(longitude);
  const kinds: EssentialKind[] = [];
  if (row.house === planet) kinds.push('house');
  if (row.exaltation?.body === planet) kinds.push('exaltation');
  if (triplicityLord(longitude, isDay) === planet) kinds.push('triplicity');
  if (termLord(longitude) === planet) kinds.push('term');
  if (faceLord(longitude) === planet) kinds.push('face');
  const dignified = kinds.length > 0;
  if (row.detriment === planet) kinds.push('detriment');
  if (row.fall === planet) kinds.push('fall');
  if (!dignified) kinds.push('peregrine');
  return kinds.map((kind) => ({ kind, score: ESSENTIAL_SCORES[kind] }));
}

/** E: the essential score of a planet at a longitude. */
export function essentialScore(planet: Planet, longitude: number, isDay: boolean): number {
  return essentialItems(planet, longitude, isDay).reduce((n, i) => n + i.score, 0);
}

export type StrengthClass = 'strong' | 'moderate' | 'weak' | 'unclassed';

/**
 * The class of lilly.score.strength-classes, on E alone: strong from +3, moderate at +1 or +2,
 * weak below 0, and E = 0 unclassed. The thresholds are the rule file's derived
 * operationalisation, not Lilly's wording; only the scores in the table are his.
 */
export function strengthClass(e: number): StrengthClass {
  return e >= 3 ? 'strong' : e >= 1 ? 'moderate' : e < 0 ? 'weak' : 'unclassed';
}

/** Whether a planet holds any of the five dignities (house, exaltation, triplicity, term, face) at a longitude. */
export function holdsDignity(planet: Planet, longitude: number, isDay: boolean): boolean {
  return essentialItems(planet, longitude, isDay).some((i) => i.score > 0);
}

/**
 * Mutual reception by house (each stands in a sign ruled by the other) or by exaltation (each
 * stands in the sign where the other is exalted): the two receptions Lilly scores on p.115.
 */
export function mutualReception(a: Planet, lonA: number, b: Planet, lonB: number): 'house' | 'exaltation' | null {
  if (a === b) return null;
  if (rowAt(lonA).house === b && rowAt(lonB).house === a) return 'house';
  if (rowAt(lonA).exaltation?.body === b && rowAt(lonB).exaltation?.body === a) return 'exaltation';
  return null;
}
