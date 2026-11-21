// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * What the Vedic dasha and transit bindings share: the chart model of the context, date
 * wording, the two ways a dignity is worded in a sentence, and the Ch.34 sl.2-7 precedence
 * for a planet that owns two houses.
 */
import type { ForecastContext } from '../../context.ts';
import { DUSTHANA, EVIL_HOUSES, isGraha, type Dignity, type Graha, type VedicChartModel } from '../../../systems/vedic/houses.ts';
import type { VedicContext } from './natal.ts';

export const model = (ctx: ForecastContext): VedicChartModel => ctx.extension<VedicContext>('vedic')!.model;

export const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const join = (xs: readonly (string | number)[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export const BADGES = { extension: 'extension (antardasha)', schoolConflict: 'school conflict' } as const;

/** "Mars is exalted / in its own sign / in the sign of a friend ..." */
export function dignityIs(kind: Dignity['kind']): string {
  switch (kind) {
    case 'exalted': case 'debilitated': return kind;
    case 'moolatrikona': return 'in its moolatrikona';
    case 'own sign': return 'in its own sign';
    case 'neutral': return 'in a neutral sign';
    case 'enemy': return 'in the sign of an enemy';
    default: return `in the sign of a ${kind}`;
  }
}

/** "... stood in exaltation / in its own sign ..." */
export function dignityIn(kind: Dignity['kind']): string {
  return kind === 'exalted' ? 'exaltation' : kind === 'debilitated' ? 'debilitation' : dignityIs(kind).replace(/^in /, '');
}

export const DIGNITY_GOOD: readonly Dignity['kind'][] = ['exalted', 'own sign', 'moolatrikona', 'friend', 'great friend'];
export const DIGNITY_BAD: readonly Dignity['kind'][] = ['debilitated', 'enemy', 'great enemy'];

export const signOf = (m: VedicChartModel, p: string): number => m.placements.find((x) => x.planet === p)!.signIndex;

/** The other planets (nodes included) in the sign of a planet: the text's "joined to". */
export const companions = (m: VedicChartModel, p: string): string[] => m.placements.filter((x) => x.planet !== p && x.signIndex === signOf(m, p)).map((x) => x.planet);

/**
 * Ch.34 sl.2-7: a planet that owns two houses gives the result of the predominant one. The
 * rule file does not say which is predominant, so the per-Lagna list, which is the source's own
 * application of that precedence, settles it. Where the list is silent the case is undecided
 * and the binding gives no firing rather than a guess.
 *
 * For a rule about a good house: passes when the planet owns no 6th, 8th or 12th, or the list
 * calls it auspicious.
 */
export function goodSideHolds(m: VedicChartModel, planet: string): boolean {
  if (!isGraha(planet)) return true;
  return !m.housesOwnedBy(planet).some((h) => DUSTHANA.includes(h)) || m.functionalNature(planet) === 'benefic';
}

/** For a rule about an evil house: passes when the planet owns no good house (not 3, 6, 8, 11, 12), or the list calls it a malefic. */
export function evilSideHolds(m: VedicChartModel, planet: Graha): boolean {
  return !m.housesOwnedBy(planet).some((h) => !EVIL_HOUSES.includes(h)) || m.functionalNature(planet) === 'malefic';
}
