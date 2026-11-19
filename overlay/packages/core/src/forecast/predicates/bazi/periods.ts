// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * What the period rules share: the luck pillars and annual pillars of a span as one list of
 * windows, the element a pillar's branch stands for, the good-mixed-bad grade of a pillar
 * by the favourable elements, the cover-and-cut test of a luck pillar and the table that
 * routes an incoming branch to a topic by the natal palace it strikes. Pure arithmetic on
 * the assessment; nothing here is worded.
 */
import { STEMS, tenGod, type Element, type SixtyCycle } from '../../../systems/bazi/index.ts';
import { elementIndex, fav, generatedBy, mainQi, overcomeBy, PILLAR_PALACES, type Favourites, type Kin, type PillarName } from '../../../systems/bazi/relations.ts';
import type { ForecastContext } from '../../context.ts';
import type { ClockId, Topic } from '../../types.ts';
import { controllerOf, ELEMENT_ZH, type NatalAssessment } from './assessment.ts';

/** One luck pillar or annual pillar and the window it stands over. */
export interface Period {
  kind: 'luck' | 'year';
  /** As the sentences name it. */
  periodName: 'luck pillar' | 'year pillar';
  clock: ClockId;
  cycle: SixtyCycle;
  startUtcMs: number;
  endUtcMs: number;
}

/** Luck pillars (when a sex convention gives their direction) and annual pillars over the span, luck first. */
export function periodsOf(ctx: ForecastContext): Period[] {
  return ctx.memo('bazi:periods', () => {
    const out: Period[] = [];
    const luck = ctx.luck();
    if (luck) for (const p of luck.pillars) out.push({ kind: 'luck', periodName: 'luck pillar', clock: 'luck', cycle: p.cycle, startUtcMs: p.startUtcMs, endUtcMs: p.endUtcMs });
    for (const p of ctx.annualPillars()) out.push({ kind: 'year', periodName: 'year pillar', clock: 'solar-longitude', cycle: p.cycle, startUtcMs: p.startUtcMs, endUtcMs: p.endUtcMs });
    return out;
  });
}

/** An annual pillar with the luck pillar that stands over the same stretch (null before the first luck pillar opens, or without a sex convention). */
export interface YearInLuck {
  year: Period;
  luck: Period | null;
  startUtcMs: number;
  endUtcMs: number;
}

/**
 * Each annual pillar cut at the boundaries of the luck pillars: a year pillar and a luck
 * pillar turn on different days, so the pair that holds is only true for the overlap.
 */
export function yearsInLuck(ctx: ForecastContext): YearInLuck[] {
  return ctx.memo('bazi:years-in-luck', () => {
    const periods = periodsOf(ctx);
    const lucks = periods.filter((p) => p.kind === 'luck');
    const out: YearInLuck[] = [];
    for (const year of periods.filter((p) => p.kind === 'year')) {
      let cursor = year.startUtcMs;
      for (const l of lucks.filter((x) => x.endUtcMs > year.startUtcMs && x.startUtcMs < year.endUtcMs).sort((a, b) => a.startUtcMs - b.startUtcMs)) {
        const start = Math.max(l.startUtcMs, year.startUtcMs);
        const end = Math.min(l.endUtcMs, year.endUtcMs);
        if (start > cursor) out.push({ year, luck: null, startUtcMs: cursor, endUtcMs: start });
        out.push({ year, luck: l, startUtcMs: start, endUtcMs: end });
        cursor = end;
      }
      if (cursor < year.endUtcMs) out.push({ year, luck: null, startUtcMs: cursor, endUtcMs: year.endUtcMs });
    }
    return out;
  });
}

/** The calendar year an annual pillar opens in (the year the pillar is named after). */
export const yearNumber = (p: Period): number => new Date(p.startUtcMs).getUTCFullYear();

export const stemHanzi = (c: SixtyCycle): string => c.stem.hanzi;
export const branchHanzi = (c: SixtyCycle): string => c.branch.hanzi;

/** The element of a pillar's stem. */
export const stemElement = (c: SixtyCycle): Element => c.stem.element;

/** The element a pillar's branch stands for: its main qi, from the engine's hidden stems. */
export const branchElement = (c: SixtyCycle): Element => STEMS[mainQi(c.branch.index)]!.element;

/** The ten god of a pillar's stem and of its branch's main qi, for a day master. */
export const stemGod = (a: NatalAssessment, c: SixtyCycle): string => tenGod(a.dayStem, c.stem.index).hanzi;
export const branchGod = (a: NatalAssessment, c: SixtyCycle): string => tenGod(a.dayStem, mainQi(c.branch.index)).hanzi;

export const favWord = (v: -1 | 0 | 1): string => (v === 1 ? 'favourable' : v === -1 ? 'unfavourable' : 'neutral');

export type PillarGrade = 'good' | 'mixed' | 'bad';

/**
 * The grade of a pillar: S = weight of the stem, B = weight of the branch (tenths). The
 * score is S * fav(stem element) + B * fav(branch main-qi element), compared with 0.5 and
 * -0.5; in tenths that is 5 and -5, so nothing rounds. A balanced chart has no favourite and
 * the caller says nothing.
 */
export function gradeOf(favs: Favourites, c: SixtyCycle, weights: { stem: number; branch: number }): { grade: PillarGrade; score10: number; stemFav: -1 | 0 | 1; branchFav: -1 | 0 | 1 } {
  const stemFav = fav(favs, stemElement(c));
  const branchFav = fav(favs, branchElement(c));
  const score10 = weights.stem * stemFav + weights.branch * branchFav;
  return { grade: score10 >= 5 ? 'good' : score10 <= -5 ? 'bad' : 'mixed', score10, stemFav, branchFav };
}

/** Luck: the branch counts 0.6 and the stem 0.4 (大運看支). Year: the stem 0.6 and the branch 0.4. */
export const LUCK_WEIGHTS = { stem: 4, branch: 6 } as const;
export const YEAR_WEIGHTS = { stem: 6, branch: 4 } as const;

export const directionOfGrade = (g: PillarGrade): 'favourable' | 'unfavourable' | 'mixed' => (g === 'good' ? 'favourable' : g === 'bad' ? 'unfavourable' : 'mixed');

// ---------------------------------------------------------------------------
// Cover and cut (蓋頭 and 截腳)
// ---------------------------------------------------------------------------

export interface CoverCutHit {
  kind: '蓋頭' | '截腳';
  wanted: Element;
  /** The half that carries the wanted element, and the half that weakens it. */
  favoured: 'stem' | 'branch';
  hostile: 'stem' | 'branch';
}

/**
 * Whether a pillar covers or cuts the wanted elements. 蓋頭: the stem overcomes the element
 * of the branch. 截腳: the branch overcomes the stem's element or fails to generate it, that
 * is, the branch is neither of the stem's element nor generating it. A stem that is wanted
 * is cut by its branch; a branch that is wanted is covered by its stem. Both are tested by
 * relation; the lists in the rule file are test cases, not the definition.
 */
export function coverCutOf(c: SixtyCycle, wanted: readonly Element[]): CoverCutHit[] {
  const s = stemElement(c);
  const b = branchElement(c);
  const out: CoverCutHit[] = [];
  const kind = kinBetween(s, b);
  const cuts = kind !== 'peer' && kind !== 'resource';
  const caps = overcomeBy(s) === b;
  for (const w of wanted) {
    if (w === s && cuts) out.push({ kind: '截腳', wanted: w, favoured: 'stem', hostile: 'branch' });
    if (w === b && caps) out.push({ kind: '蓋頭', wanted: w, favoured: 'branch', hostile: 'stem' });
  }
  return out;
}

/** What the branch element is to the stem element, counted along the generating cycle: peer, output, wealth, officer or resource. */
function kinBetween(stem: Element, branch: Element): Kin {
  return (['peer', 'output', 'wealth', 'officer', 'resource'] as const)[(elementIndex(branch) - elementIndex(stem) + 5) % 5]!;
}

/** A natal stem that overcomes the hostile element or drains it (the hostile element generates it) holds a remedy. */
export function remedyOf(a: NatalAssessment, hostile: Element): string | null {
  const stems = [a.pillars.year.stem, a.pillars.month.stem, a.pillars.day.stem, a.pillars.hour.stem];
  const found = stems.find((s) => s.element === controllerOf(hostile) || s.element === generatedBy(hostile));
  return found ? found.hanzi : null;
}

export const elementName = (e: Element): string => `${e} ${ELEMENT_ZH[e]}`;

// ---------------------------------------------------------------------------
// The palace table
// ---------------------------------------------------------------------------

/**
 * Which topics an incoming relation reads for, by the natal palace it strikes (the rule
 * bazi.pillar-palaces). Only year = ancestors, month = parents, day branch = spouse and
 * hour = children are attested; the topic of each is a later convention and the output
 * says so.
 */
export const PALACE_TOPICS: Readonly<Record<PillarName, readonly Topic[]>> = {
  year: ['home-travel', 'general'],
  month: ['career', 'home-travel'],
  day: ['relationships', 'health'],
  hour: ['relationships', 'career'],
};

export const palaceMeaning = (p: PillarName): string => PILLAR_PALACES[p];

/**
 * The topics a rule reads for a struck palace: the palace table's topics that the rule also
 * lists. If none is left, the rule's own catch-all `general`; the badge says so.
 */
export function routeTopics(pillar: PillarName, ruleTopics: readonly Topic[]): { topics: Topic[]; badges: string[] } {
  const topics = PALACE_TOPICS[pillar].filter((t) => ruleTopics.includes(t));
  const badges: string[] = [];
  if (pillar !== 'day') badges.push('topic routed by the palace table, which is a later convention (only the palace itself is attested)');
  if (topics.length === 0) {
    badges.push(`palace topics (${PALACE_TOPICS[pillar].join(', ')}) are outside this rule's topics: read as general`);
    return { topics: ['general'], badges };
  }
  return { topics, badges };
}

/** True if two sexagenary cycles have the same stem and branch. */
export const samePillar = (a: SixtyCycle, b: SixtyCycle): boolean => a.index === b.index;

/** How far apart two stems are in the ten-stem cycle, 0 to 9 going forward from a to b. */
export const stemSteps = (a: number, b: number): number => (((b - a) % 10) + 10) % 10;
