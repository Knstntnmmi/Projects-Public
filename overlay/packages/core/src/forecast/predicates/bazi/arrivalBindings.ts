// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Bindings of the topic arrival rules: a luck pillar or a year brings a kin of the day
 * master (財, 官殺, 印, 食傷, 比劫) by its stem or by the main qi of its branch, and the rule
 * reads that arrival for its own topic. These rules own their topics for the span: the
 * general judgements of the luck pillar and the year are 'general' only, so a topic and a
 * span never get both paths. The sign comes from the favourable elements (喜忌), as the
 * source instructs; a balanced chart has none and these rules say nothing by it.
 */
import { fav, kinOf, type Kin } from '../../../systems/bazi/relations.ts';
import type { Direction, Firing, RuleBinding, Topic } from '../../types.ts';
import { careerGradeOf, bind, fact, natalOf, wealthGradeOf } from './natal.ts';
import { kinChars, starsOf, type NatalAssessment } from './assessment.ts';
import { branchElement, branchGod, periodsOf, stemElement, stemGod, type Period } from './periods.ts';
import { periodFiring } from './periodBindings.ts';

/** What a period brings of one kin: the stem and the main qi of the branch, with their gods. */
interface Arrival {
  gods: string[];
  /** 'stem', 'branch' or both: which halves bring the kin. */
  halves: ('stem' | 'branch')[];
  element: ReturnType<typeof stemElement>;
  /** The god of each half that is not of this kin, for the rules that read a second kin beside the first. */
  otherGods: string[];
}

function arrivalOf(a: NatalAssessment, p: Period, kin: readonly Kin[]): Arrival | null {
  const halves: ('stem' | 'branch')[] = [];
  const gods: string[] = [];
  const others: string[] = [];
  const stemKin = kinOf(a.dayElement, stemElement(p.cycle));
  const branchKin = kinOf(a.dayElement, branchElement(p.cycle));
  if (kin.includes(stemKin)) {
    halves.push('stem');
    gods.push(`${stemGod(a, p.cycle)} (stem)`);
  } else others.push(stemGod(a, p.cycle));
  if (kin.includes(branchKin)) {
    halves.push('branch');
    gods.push(`${branchGod(a, p.cycle)} (main qi of the branch)`);
  } else others.push(branchGod(a, p.cycle));
  if (halves.length === 0) return null;
  return { gods, halves, element: halves[0] === 'stem' ? stemElement(p.cycle) : branchElement(p.cycle), otherGods: others };
}

const plainGods = (arr: Arrival): string[] => arr.gods.map((g) => g.split(' ')[0]!);

const arrivalFacts = (a: NatalAssessment, p: Period, arr: Arrival, extra: Firing['facts']): Firing['facts'] => [
  fact('periodName', 'Period', p.periodName),
  fact('pillar', 'Pillar', p.cycle.hanzi),
  fact('tenGod', 'Ten god', arr.gods.join(', ')),
  fact('favOrNot', 'Element', likeWord(fav(a.favourites, arr.element))),
  ...extra,
];

/** The sentences say "in a {favOrNot} element", so the word must take "a": favoured and disliked (喜 and 忌), not favourable and unfavourable. */
const likeWord = (v: -1 | 0 | 1): string => (v === 1 ? 'favoured' : v === -1 ? 'disliked' : 'neutral');

const periodsFor = (ctx: Parameters<RuleBinding['fire']>[0]): Period[] => periodsOf(ctx);

// ---------------------------------------------------------------------------

const wealthStar = bind('bazi.wealth-star-in-luck', (ctx) => {
  const a = natalOf(ctx);
  const promise = wealthGradeOf(a);
  const out: Firing[] = [];
  for (const p of periodsFor(ctx)) {
    const arr = arrivalOf(a, p, ['wealth']);
    if (!arr) continue;
    const f = fav(a.favourites, arr.element);
    const robbedOrHeavy = promise !== null && (promise.grade === 'robbed' || promise.grade === 'too heavy');
    const favourable = f === 1 && promise?.grade !== 'absent';
    const unfavourable = f === -1 || robbedOrHeavy;
    if (!favourable && !unfavourable) continue; // a balanced chart, or a favourite with no natal wealth: no clause of the condition holds
    const direction: Direction = favourable && unfavourable ? 'mixed' : favourable ? 'favourable' : 'unfavourable';
    const badges: string[] = [];
    if (favourable && !unfavourable && arr.otherGods.some((g) => g === '食神' || g === '傷官')) badges.push('食傷 beside it strengthens the source of wealth');
    if (favourable && unfavourable) badges.push('both clauses hold: a favourable element, and natal wealth that is robbed or too heavy');
    out.push(periodFiring(p, arrivalFacts(a, p, arr, [fact('goodOrBad', 'Reading', direction === 'favourable' ? 'good' : direction === 'unfavourable' ? 'bad' : 'mixed')]), { direction, badges, conventionsUsed: ['baziStrengthThresholds'] }));
  }
  return out;
});

const officerStar = bind('bazi.officer-star-in-luck', (ctx) => {
  const a = natalOf(ctx);
  const career = careerGradeOf(a);
  const female = ctx.sex === 'female';
  const hasDirect = starsOf(a, '正官').length > 0;
  const hasKilling = starsOf(a, '七殺').length > 0;
  const out: Firing[] = [];
  for (const p of periodsFor(ctx)) {
    const arr = arrivalOf(a, p, ['officer']);
    if (!arr) continue;
    const f = fav(a.favourites, arr.element);
    const gods = plainGods(arr);
    // the other of 正官 and 七殺 already stands in the chart: 官殺混雜
    const mixing = (gods.includes('正官') && hasKilling) || (gods.includes('七殺') && hasDirect);
    const favourable = f === 1 && career?.grade !== 'mixed' && career?.grade !== 'overpowering';
    const unfavourable = f === -1 || mixing;
    if (!favourable && !unfavourable) continue;
    const direction: Direction = favourable && unfavourable ? 'mixed' : favourable ? 'favourable' : 'unfavourable';
    const badges: string[] = [];
    if (mixing) badges.push('官殺混雜: the arrival adds the other of 正官 and 七殺 to the chart');
    if (favourable && unfavourable) badges.push('both clauses hold: a favourable element, and a mixing of 官 and 殺');
    // Both clauses hold and the source states no precedence: the reading is mixed and the sentence names both clauses.
    const clauseNote = favourable && unfavourable ? ' (two clauses hold: the element is favoured, and the arrival mixes 正官 with 七殺 (官殺混雜); the source does not say which prevails)' : '';
    const topics: Topic[] = female ? ['career', 'relationships'] : ['career'];
    out.push(
      periodFiring(p, arrivalFacts(a, p, arr, [fact('goodOrBad', 'Reading', direction === 'favourable' ? 'good' : direction === 'unfavourable' ? 'bad' : 'mixed'), fact('clauseNote', 'Both clauses', clauseNote), fact('womanNote', 'Note', female ? ', and for a woman it is also the husband star' : '')]), {
        direction,
        topics,
        badges,
        conventionsUsed: ['baziStrengthThresholds', 'baziSexConvention'],
      }),
    );
  }
  return out;
});

const resourceStar = bind('bazi.resource-in-luck', (ctx) => {
  const a = natalOf(ctx);
  const out: Firing[] = [];
  for (const p of periodsFor(ctx)) {
    const arr = arrivalOf(a, p, ['resource']);
    if (!arr) continue;
    const f = fav(a.favourites, arr.element);
    if (f === 0) continue;
    out.push(periodFiring(p, arrivalFacts(a, p, arr, [fact('goodOrBad', 'Reading', f === 1 ? 'good' : 'bad')]), { direction: f === 1 ? 'favourable' : 'unfavourable', conventionsUsed: ['baziStrengthThresholds'] }));
  }
  return out;
});

const outputStar = bind(
  'bazi.output-in-luck',
  (ctx) => {
    const a = natalOf(ctx);
    const female = ctx.sex === 'female';
    const hasDirect = starsOf(a, '正官').length > 0;
    const out: Firing[] = [];
    for (const p of periodsFor(ctx)) {
      const arr = arrivalOf(a, p, ['output']);
      if (!arr) continue;
      const f = fav(a.favourites, arr.element);
      const hurting = plainGods(arr).includes('傷官');
      // 傷官見官: the hurting officer beside an existing 正官, unfavourable for a woman's marriage
      const meetsOfficer = female && hurting && hasDirect;
      const topics: Topic[] = meetsOfficer ? ['career', 'wealth'] : ['career', 'relationships', 'wealth'];
      if (f !== 0) {
        out.push(
          periodFiring(p, arrivalFacts(a, p, arr, [fact('outputNote', 'Note', f === 1 ? 'productive for a strong day master' : 'it drains a weak day master')]), {
            direction: f === 1 ? 'favourable' : 'unfavourable',
            topics,
            conventionsUsed: ['baziStrengthThresholds'],
          }),
        );
      }
      if (meetsOfficer) {
        out.push(
          periodFiring(p, arrivalFacts(a, p, arr, [fact('outputNote', 'Note', '傷官 meets the natal 正官 (傷官見官), unfavourable for a woman\'s marriage')]), {
            direction: 'unfavourable',
            topics: ['relationships'],
            badges: ['傷官見官'],
            conventionsUsed: ['baziSexConvention'],
          }),
        );
      }
    }
    return out;
  },
  // the annual pillar alone is enough; luck pillars are added when a sex convention gives them
  { sex: false, birthTime: true },
);

const peerStar = bind('bazi.peer-in-luck', (ctx) => {
  const a = natalOf(ctx);
  const wealthPresent = kinChars(a, 'wealth').length > 0;
  const hasDirectWealth = starsOf(a, '正財').length > 0;
  const out: Firing[] = [];
  for (const p of periodsFor(ctx)) {
    const arr = arrivalOf(a, p, ['peer']);
    if (!arr) continue;
    const f = fav(a.favourites, arr.element);
    const robs = plainGods(arr).includes('劫財') && hasDirectWealth;
    const supportive = f === 1;
    const rivalry = f === -1 && wealthPresent;
    const wealthLoss = rivalry || robs;
    if (supportive) {
      out.push(periodFiring(p, arrivalFacts(a, p, arr, [fact('peerNote', 'Note', 'supportive for a weak day master')]), { direction: 'favourable', topics: ['relationships'], conventionsUsed: ['baziStrengthThresholds'] }));
    }
    if (supportive || wealthLoss) {
      const direction: Direction = supportive && wealthLoss ? 'mixed' : supportive ? 'favourable' : 'unfavourable';
      const note = robs && !rivalry ? '劫財 over the natal 正財 is a wealth loss' : rivalry ? `rivalry for wealth: a loss or competition, since the day master is strong and wealth is in the chart${robs ? '; 劫財 over the natal 正財 is also a wealth loss' : ''}` : 'supportive for a weak day master';
      const badges = supportive && wealthLoss ? ['both clauses hold: supportive as a favourable element, and a wealth loss from 劫財 over 正財'] : [];
      out.push(periodFiring(p, arrivalFacts(a, p, arr, [fact('peerNote', 'Note', supportive && wealthLoss ? `supportive for a weak day master, and ${note}` : note)]), { direction, topics: ['wealth'], badges, conventionsUsed: ['baziStrengthThresholds'] }));
    }
  }
  return out;
});

export const ARRIVAL_BINDINGS: readonly RuleBinding[] = [wealthStar, officerStar, resourceStar, outputStar, peerStar];
