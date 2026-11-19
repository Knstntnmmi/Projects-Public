// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The firdaria rule (Bonatti, Pars V p.813-814). The major periods, their lords and their
 * years (10, 8, 13, 9, 11, 12, 7, 3 and 2, seventy-five in all) and the node order come from
 * the engine's firdaria() under its named firdariaNodes convention; the seven parts of a
 * planetary period are cut here, because the rule file gives their order as Sun, Venus,
 * Mercury, Moon, Saturn, Jupiter, Mars starting with the major lord, which is not the
 * Chaldean order the engine's own subdivision uses.
 */
import type { LordSpan } from '../../../systems/western/index.ts';
import type { Planet } from '../../../substrate/sky.ts';
import type { Firing } from '../../types.ts';
import { isoDate } from './profection.ts';
import type { NatalModel } from './model.ts';
import { BADGE, CONVENTIONS, fact } from './natal.ts';

/** The order of the seven parts of a period (the day order of the planets without the nodes). */
export const SUB_ORDER: readonly Planet[] = ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'];

export interface SubPeriod {
  major: Planet;
  minor: Planet;
  startUtcMs: number;
  endUtcMs: number;
}

/** The seven equal parts of each planetary major period; the periods of the nodes are not divided. */
export function subPeriods(majors: readonly LordSpan[]): SubPeriod[] {
  const out: SubPeriod[] = [];
  for (const span of majors) {
    const first = SUB_ORDER.indexOf(span.lord as Planet);
    if (first < 0) continue;
    const part = (span.endUtcMs - span.startUtcMs) / 7;
    for (let k = 0; k < 7; k++) {
      out.push({ major: span.lord as Planet, minor: SUB_ORDER[(first + k) % 7]!, startUtcMs: span.startUtcMs + part * k, endUtcMs: k === 6 ? span.endUtcMs : span.startUtcMs + part * (k + 1) });
    }
  }
  return out;
}

const VERDICT = {
  well: 'well disposed, so it increases fortunes and decreases misfortunes',
  badly: 'badly disposed, so it decreases fortunes and increases misfortunes',
} as const;

/**
 * One firing per seventh of a planetary period that overlaps the span. The disposition is that
 * of the major lord, class strong or moderate read as well disposed and weak as badly disposed
 * (derived, as the rule says); a lord of class zero, and the periods of the nodes, have no
 * class and say nothing. The class of the sub-lord is not read: the verdict names the major lord.
 */
export function firdariaLordCondition(m: NatalModel, majors: readonly LordSpan[], span: { startUtcMs: number; endUtcMs: number }): Firing[] {
  const out: Firing[] = [];
  for (const s of subPeriods(majors)) {
    if (s.endUtcMs <= span.startUtcMs || s.startUtcMs >= span.endUtcMs) continue;
    const cls = m.cls(s.major);
    if (cls === 'unclassed') continue;
    out.push({
      clock: 'birthday',
      startUtcMs: s.startUtcMs,
      endUtcMs: s.endUtcMs,
      facts: [
        fact('major', 'Major lord', s.major),
        fact('minor', 'Sub-lord', s.minor),
        fact('date', 'Sub-period ends', isoDate(s.endUtcMs)),
        fact('class', 'Class of the major lord', cls),
        fact('verdict', 'Bonatti reads its disposition as', cls === 'weak' ? VERDICT.badly : VERDICT.well),
      ],
      conventionsUsed: [...CONVENTIONS, 'firdariaNodes'],
      badges: [
        BADGE.derivedClass,
        'well disposed is read as class strong or moderate, badly disposed as weak (derived)',
        'the class of the sub-lord is not read; the periods of the nodes have no class and are not read',
      ],
    });
  }
  return out;
}
