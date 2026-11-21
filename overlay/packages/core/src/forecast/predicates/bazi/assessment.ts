// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The natal assessment of a BaZi chart that the natal-promise rules rest on: which seven
 * characters stand around the day master and what each is to it, the season, the strength
 * score and its class, the favourable elements, and the element weights. Pure arithmetic on
 * the four pillars; no rule is evaluated here and nothing is worded.
 *
 * Weights are kept in eighths of the unit the rule file states, so that every comparison
 * with a stated threshold is exact integer arithmetic and a score of exactly 45 or 55 is
 * balanced however the division would round.
 */
import type { ForecastConventions } from '../../conventions.ts';
import { BRANCHES, STEMS, type Element, type FourPillars } from '../../../systems/bazi/index.ts';
import {
  elementIndex,
  favourites,
  inSeason,
  kinOf,
  PILLAR_NAMES,
  seasonalState,
  voidBranches,
  type EarthStageSchool,
  type Favourites,
  type Kin,
  type PillarName,
  type SeasonalState,
  type StrengthClass,
} from '../../../systems/bazi/relations.ts';

/** The pillars as English words, for the sentences. */
export const ELEMENT_ZH: Readonly<Record<Element, string>> = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };
export const elementLabel = (e: Element): string => `${e} ${ELEMENT_ZH[e]}`;

/** One of the seven characters around the day master: a stem of another pillar or a hidden stem of a branch. */
export interface NatalChar {
  pillar: PillarName;
  place: 'stem' | 'hidden';
  /** The branch it hides in, for a hidden stem. */
  branch: number | null;
  /** 0 for a stem and for a branch's main qi, 1 and 2 for the next hidden stems. */
  order: number;
  stem: number;
  element: Element;
  kin: Kin;
  /** The ten god's name, from the engine. */
  god: string;
  /** In eighths: 8 is the weight 1.0 of the rule file. */
  weight8: number;
}

/** The weight of a branch's main qi in eighths: month 3.0, day 1.5, year and hour 1.0. */
const BRANCH_WEIGHT8: Readonly<Record<PillarName, number>> = { year: 8, month: 24, day: 12, hour: 8 };
/** The second hidden stem counts half, the third a quarter. */
const HIDDEN_FRACTION: readonly number[] = [1, 0.5, 0.25];
const STEM_WEIGHT8 = 8;

/**
 * The class of a score S = 100 * support / total: strong above 55, weak below 45, balanced
 * from 45 to 55 inclusive. Cross-multiplied so that nothing rounds: exactly 45 or 55 is balanced.
 */
export function classifyStrength(support: number, total: number): StrengthClass {
  if (20 * support > 11 * total) return 'strong';
  if (20 * support < 9 * total) return 'weak';
  return 'balanced';
}

export interface NatalAssessment {
  pillars: FourPillars;
  dayStem: number;
  dayElement: Element;
  school: EarthStageSchool;
  yinReverse: boolean;
  /** The seven characters other than the day stem. */
  chars: NatalChar[];
  monthState: { state: SeasonalState; deLing: boolean };
  /** Weight of each kin among the seven characters, in eighths. */
  kinWeight8: Record<Kin, number>;
  support8: number;
  drain8: number;
  total8: number;
  /** 100 * support / (support + drain). */
  score: number;
  strengthClass: StrengthClass;
  /** 從格 candidate: no hidden stem of 比劫 or 印 element and a score under 20. A flag, never a verdict. */
  followerCandidate: boolean;
  /** Hidden stems that equal or generate the day master's element (得地). */
  roots: NatalChar[];
  /** Stems of other pillars that equal or generate it (得勢). */
  stemSupport: NatalChar[];
  favourites: Favourites;
  /** Weight of each element over all eight characters, the day stem counting 1.0, in eighths. */
  elementWeight8: Record<Element, number>;
  elementTotal8: number;
  /** Elements that appear as some branch's hidden stem. */
  hiddenElements: ReadonlySet<Element>;
  /** The two branches empty in the day pillar's ten-day cycle. */
  voidPair: readonly [number, number];
  /** The year pillar's void pair, the secondary variant the day branch is tested against. */
  yearVoidPair: readonly [number, number];
}

export function assessNatal(pillars: FourPillars, fc: Pick<ForecastConventions, 'baziEarthStages' | 'baziYinStageReverse'>): NatalAssessment {
  const dayStem = pillars.day.stem.index;
  const dayElement = pillars.day.stem.element;
  const chars: NatalChar[] = [];
  for (const name of PILLAR_NAMES) {
    const p = pillars[name];
    if (name !== 'day') {
      chars.push({
        pillar: name,
        place: 'stem',
        branch: null,
        order: 0,
        stem: p.stem.index,
        element: p.stem.element,
        kin: kinOf(dayElement, p.stem.element),
        god: p.stemGod!.hanzi,
        weight8: STEM_WEIGHT8,
      });
    }
    p.branch.hidden.forEach((s, order) => {
      const stem = STEMS[s]!;
      const god = p.hidden[order]!.god.hanzi;
      chars.push({
        pillar: name,
        place: 'hidden',
        branch: p.branch.index,
        order,
        stem: s,
        element: stem.element,
        kin: kinOf(dayElement, stem.element),
        god,
        weight8: BRANCH_WEIGHT8[name] * HIDDEN_FRACTION[order]!,
      });
    });
  }
  const kinWeight8 = { peer: 0, output: 0, wealth: 0, officer: 0, resource: 0 } as Record<Kin, number>;
  for (const c of chars) kinWeight8[c.kin] += c.weight8;
  const support8 = kinWeight8.peer + kinWeight8.resource;
  const total8 = chars.reduce((n, c) => n + c.weight8, 0);
  const drain8 = total8 - support8;
  const score = (100 * support8) / total8;
  const strengthClass = classifyStrength(support8, total8);
  const hiddenChars = chars.filter((c) => c.place === 'hidden');
  const roots = hiddenChars.filter((c) => c.kin === 'peer' || c.kin === 'resource');
  const stemSupport = chars.filter((c) => c.place === 'stem' && (c.kin === 'peer' || c.kin === 'resource'));
  const elementWeight8 = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 } as Record<Element, number>;
  elementWeight8[dayElement] += STEM_WEIGHT8;
  for (const c of chars) elementWeight8[c.element] += c.weight8;
  const state = seasonalState(dayElement, pillars.month.branch.index);
  return {
    pillars,
    dayStem,
    dayElement,
    school: fc.baziEarthStages,
    yinReverse: fc.baziYinStageReverse,
    chars,
    monthState: { state, deLing: inSeason(state) },
    kinWeight8,
    support8,
    drain8,
    total8,
    score,
    strengthClass,
    followerCandidate: roots.length === 0 && 5 * support8 < total8,
    roots,
    stemSupport,
    favourites: favourites(dayElement, strengthClass),
    elementWeight8,
    elementTotal8: Object.values(elementWeight8).reduce((a, b) => a + b, 0),
    hiddenElements: new Set(hiddenChars.map((c) => c.element)),
    voidPair: voidBranches(pillars.day.index),
    yearVoidPair: voidBranches(pillars.year.index),
  };
}

// ---------------------------------------------------------------------------
// Questions the rules ask of the assessment
// ---------------------------------------------------------------------------

/** The characters whose ten god is one of the named gods. */
export const starsOf = (a: NatalAssessment, ...gods: string[]): NatalChar[] => a.chars.filter((c) => gods.includes(c.god));

/** The characters of one or more kin. */
export const kinChars = (a: NatalAssessment, ...kins: Kin[]): NatalChar[] => a.chars.filter((c) => kins.includes(c.kin));

/** A hidden stem is its own root; a stem is rooted if its element hides in some branch. */
export const isRooted = (a: NatalAssessment, c: NatalChar): boolean => c.place === 'hidden' || a.hiddenElements.has(c.element);

export const weightOf = (cs: readonly NatalChar[]): number => cs.reduce((n, c) => n + c.weight8, 0);

/** Weight in the unit the rule file states, for display. */
export const units = (weight8: number): number => weight8 / 8;

/** The element that overcomes the given one is present among the eight characters. */
export const elementPresent = (a: NatalAssessment, e: Element): boolean => a.elementWeight8[e] > 0;

/** The element that overcomes `e` (the one two places before it in the generating cycle). */
export const controllerOf = (e: Element): Element => (['Wood', 'Fire', 'Earth', 'Metal', 'Water'] as const)[(elementIndex(e) + 3) % 5]!;

export const BRANCH_HANZI = (b: number): string => BRANCHES[b]!.hanzi;

/** The natal branches by pillar. */
export function natalBranches(p: FourPillars): { pillar: PillarName; branch: number }[] {
  return PILLAR_NAMES.map((pillar) => ({ pillar, branch: p[pillar].branch.index }));
}

/** A character as a sentence names it: its god and stem, and where it stands. */
export function describeChar(c: NatalChar): string {
  const where = c.place === 'stem' ? `${c.pillar} stem` : `hidden in the ${c.pillar} branch ${BRANCHES[c.branch!]!.hanzi}`;
  return `${c.god} ${STEMS[c.stem]!.hanzi} (${where})`;
}

export const listChars = (cs: readonly NatalChar[]): string => (cs.length === 0 ? 'none' : cs.map(describeChar).join('; '));
