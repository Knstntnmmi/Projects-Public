// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The two modifier rules of the file, which describe the chart and date nothing: each planet's
 * strength class on Lilly's scores, and the aspects between the planets by his orbs. Both are
 * undated natal context, listed beside the periods and never giving a reading its sign.
 */
import { PLANETS } from '../../../substrate/sky.ts';
import { isPartileMinute } from '../../../systems/western/aspects.ts';
import type { Firing } from '../../types.ts';
import type { NatalModel } from './model.ts';
import { BADGE, fact, natal } from './natal.ts';

/** A planet is flagged afflicted when its accidental score is -5 or lower (derived, as the rule says). */
export const AFFLICTED_AT = -5;

/** One firing per planet whose essential score gives it a class; a score of zero is unclassed and says nothing. */
export function strengthClasses(m: NatalModel): Firing[] {
  const out: Firing[] = [];
  for (const p of PLANETS) {
    const cls = m.cls(p);
    if (cls === 'unclassed') continue;
    const a = m.accidental(p);
    out.push(
      natal(
        [fact('planet', 'Planet', p), fact('class', 'Class', cls), fact('E', 'Essential score', m.essential(p)), fact('A', 'Accidental score', a), fact('afflictedFlag', 'Afflicted', a <= AFFLICTED_AT ? ', afflicted' : '')],
        [BADGE.wholeSign, BADGE.derivedClass, 'derived threshold: afflicted is read from an accidental score of -5 or lower', 'the accidental score leaves out swift and slow motion and the fixed stars, which the engine cannot score'],
        `class:${p}`,
      ),
    );
  }
  return out;
}

/** The orb is shown to two decimals of a degree, as the distance from the exact aspect. */
const round2 = (x: number): number => Math.round(x * 100) / 100;

/** One firing per pair of planets in aspect by the first column of Lilly's orbs. */
export function aspectList(m: NatalModel): Firing[] {
  const out: Firing[] = [];
  for (let i = 0; i < PLANETS.length; i++) {
    for (let j = i + 1; j < PLANETS.length; j++) {
      const a = PLANETS[i]!;
      const b = PLANETS[j]!;
      const asp = m.aspect(a, b);
      if (asp === null) continue;
      const partile = isPartileMinute(m.lon(a), m.lon(b), asp.angle);
      out.push(natal([fact('planet1', 'Planet', a), fact('aspect', 'Aspect', asp.aspect), fact('planet2', 'Planet', b), fact('partile or platick', 'Kind', partile ? 'partile' : 'platick'), fact('orb', 'Distance from exact, degrees', round2(asp.distance))], [], `aspect:${a}-${b}`));
    }
  }
  return out;
}
