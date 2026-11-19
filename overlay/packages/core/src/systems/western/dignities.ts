// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Essential dignities in the Hellenistic and early medieval form: domicile, exaltation,
 * Dorothean triplicity lords, Egyptian bounds and Chaldean faces.
 */
import type { Planet } from '../../substrate/sky.ts';

export const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;
export type Sign = (typeof SIGNS)[number];

// Each glyph is followed by U+FE0E (text presentation), so that it is drawn as a plain
// character and not swapped for a colour emoji.
export const SIGN_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'].map((g) => `${g}\uFE0E`);

export const PLANET_GLYPHS: Record<Planet, string> = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄',
};

/** Chaldean order, slowest to fastest. */
export const CHALDEAN: readonly Planet[] = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'];

export const DOMICILE: readonly Planet[] = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
];

/** Exaltations with their traditional degrees (sign index, degree within the sign). */
export const EXALTATION: Partial<Record<Planet, { sign: number; degree: number }>> = {
  Sun: { sign: 0, degree: 19 },
  Moon: { sign: 1, degree: 3 },
  Mercury: { sign: 5, degree: 15 },
  Venus: { sign: 11, degree: 27 },
  Mars: { sign: 9, degree: 28 },
  Jupiter: { sign: 3, degree: 15 },
  Saturn: { sign: 6, degree: 21 },
};

/** Dorothean triplicity lords by element: day lord, night lord, participating lord. */
export const TRIPLICITY: Record<'Fire' | 'Earth' | 'Air' | 'Water', readonly [Planet, Planet, Planet]> = {
  Fire: ['Sun', 'Jupiter', 'Saturn'],
  Earth: ['Venus', 'Moon', 'Mars'],
  Air: ['Saturn', 'Mercury', 'Jupiter'],
  Water: ['Venus', 'Mars', 'Moon'],
};

export const SIGN_ELEMENT = ['Fire', 'Earth', 'Air', 'Water'] as const;

/**
 * Egyptian bounds: for each sign, the lord and the degree at which its bound ends.
 * The planets' totals over the zodiac are the "greater years": Saturn 57, Jupiter 79,
 * Mars 66, Venus 82, Mercury 76 (a test checks this).
 */
export const EGYPTIAN_BOUNDS: readonly (readonly [Planet, number])[][] = [
  [['Jupiter', 6], ['Venus', 12], ['Mercury', 20], ['Mars', 25], ['Saturn', 30]],
  [['Venus', 8], ['Mercury', 14], ['Jupiter', 22], ['Saturn', 27], ['Mars', 30]],
  [['Mercury', 6], ['Jupiter', 12], ['Venus', 17], ['Mars', 24], ['Saturn', 30]],
  [['Mars', 7], ['Venus', 13], ['Mercury', 19], ['Jupiter', 26], ['Saturn', 30]],
  [['Jupiter', 6], ['Venus', 11], ['Saturn', 18], ['Mercury', 24], ['Mars', 30]],
  [['Mercury', 7], ['Venus', 17], ['Jupiter', 21], ['Mars', 28], ['Saturn', 30]],
  [['Saturn', 6], ['Mercury', 14], ['Jupiter', 21], ['Venus', 28], ['Mars', 30]],
  [['Mars', 7], ['Venus', 11], ['Mercury', 19], ['Jupiter', 24], ['Saturn', 30]],
  [['Jupiter', 12], ['Venus', 17], ['Mercury', 21], ['Saturn', 26], ['Mars', 30]],
  [['Mercury', 7], ['Jupiter', 14], ['Venus', 22], ['Saturn', 26], ['Mars', 30]],
  [['Mercury', 7], ['Venus', 13], ['Jupiter', 20], ['Mars', 25], ['Saturn', 30]],
  [['Venus', 12], ['Jupiter', 16], ['Mercury', 19], ['Mars', 28], ['Saturn', 30]],
];

/** Chaldean faces (decans): ten degrees each, in descending planetary order from Mars at 0 Aries. */
const FACE_ORDER: readonly Planet[] = ['Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter'];
export function faceLord(longitude: number): Planet {
  return FACE_ORDER[Math.floor(longitude / 10) % 7]!;
}

export function boundLord(longitude: number): Planet {
  const sign = Math.floor(longitude / 30) % 12;
  const deg = longitude - sign * 30;
  for (const [planet, end] of EGYPTIAN_BOUNDS[sign]!) if (deg < end) return planet;
  return EGYPTIAN_BOUNDS[sign]![4]![0];
}

export interface Dignity {
  domicile: Planet;
  exaltation: Planet | null;
  triplicity: readonly [Planet, Planet, Planet];
  bound: Planet;
  face: Planet;
  detriment: Planet;
  fall: Planet | null;
}

/** The lords of every dignity at a longitude. */
export function dignitiesAt(longitude: number): Dignity {
  const sign = Math.floor(longitude / 30) % 12;
  const exalted = (Object.entries(EXALTATION) as [Planet, { sign: number }][]).find(([, e]) => e.sign === sign);
  const fallen = (Object.entries(EXALTATION) as [Planet, { sign: number }][]).find(([, e]) => (e.sign + 6) % 12 === sign);
  return {
    domicile: DOMICILE[sign]!,
    exaltation: exalted ? exalted[0] : null,
    triplicity: TRIPLICITY[SIGN_ELEMENT[sign % 4]!],
    bound: boundLord(longitude),
    face: faceLord(longitude),
    detriment: DOMICILE[(sign + 6) % 12]!,
    fall: fallen ? fallen[0] : null,
  };
}

/** Which dignities and debilities a planet holds at its own longitude. */
export function holds(planet: Planet, longitude: number, isDayChart: boolean): string[] {
  const d = dignitiesAt(longitude);
  const out: string[] = [];
  if (d.domicile === planet) out.push('domicile');
  if (d.exaltation === planet) out.push('exaltation');
  if (d.triplicity[isDayChart ? 0 : 1] === planet) out.push('triplicity');
  else if (d.triplicity[2] === planet) out.push('triplicity (participating)');
  if (d.bound === planet) out.push('bound');
  if (d.face === planet) out.push('face');
  if (d.detriment === planet && d.domicile !== planet) out.push('detriment');
  if (d.fall === planet) out.push('fall');
  return out;
}
