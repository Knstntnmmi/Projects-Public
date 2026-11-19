// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Bindings of the BaZi period judgements: the luck pillar, the cover-and-cut test, the year,
 * the year that repeats the luck pillar (歲運並臨), luck against year (天剋地沖), the year
 * against the day stem, the year that combines with the day pillar, and 伏吟 and 反吟 of the
 * day pillar. They read the favourable elements of the natal assessment; a balanced chart has
 * none, and the rules that need a favourite say nothing for it.
 */
import { combinationOf, clashOf, fav, overcomeBy, stemsCombine } from '../../../systems/bazi/relations.ts';
import type { Direction, Firing, RuleBinding } from '../../types.ts';
import {
  branchElement,
  branchGod,
  branchHanzi,
  coverCutOf,
  directionOfGrade,
  elementName,
  favWord,
  gradeOf,
  LUCK_WEIGHTS,
  periodsOf,
  remedyOf,
  samePillar,
  stemElement,
  stemGod,
  stemHanzi,
  stemSteps,
  yearNumber,
  yearsInLuck,
  YEAR_WEIGHTS,
  type Period,
  type PillarGrade,
} from './periods.ts';
import { bind, fact, natalOf } from './natal.ts';
import { bladeOf } from './stars.ts';

/** A firing over a stretch of a luck pillar or annual pillar; the badge names which. */
export function windowFiring(p: Pick<Period, 'kind' | 'clock'>, startUtcMs: number, endUtcMs: number, facts: Firing['facts'], rest: Partial<Firing> = {}): Firing {
  const badges = [...(rest.badges ?? []), p.kind === 'luck' ? 'luck pillar' : 'annual pillar'];
  return { clock: p.clock, startUtcMs, endUtcMs, facts, ...rest, badges };
}

export const periodFiring = (p: Period, facts: Firing['facts'], rest: Partial<Firing> = {}): Firing => windowFiring(p, p.startUtcMs, p.endUtcMs, facts, rest);

const hanzi = (p: Period): string => p.cycle.hanzi;
const WORD_OF: Readonly<Record<PillarGrade, string>> = { good: 'good', mixed: 'mixed', bad: 'bad' };

// ---------------------------------------------------------------------------
// Luck pillar
// ---------------------------------------------------------------------------

const luckJudgement = bind(
  'bazi.luck-pillar-judgement',
  (ctx) => {
    const a = natalOf(ctx);
    if (a.strengthClass === 'balanced') return []; // no favourite chosen: nothing to judge by
    return periodsOf(ctx)
      .filter((p) => p.kind === 'luck')
      .map((p) => {
        const g = gradeOf(a.favourites, p.cycle, LUCK_WEIGHTS);
        return periodFiring(
          p,
          [
            fact('pillar', 'Luck pillar', hanzi(p)),
            fact('tenGodStem', 'Ten god of the stem', stemGod(a, p.cycle)),
            fact('tenGodBranch', 'Ten god of the branch (main qi)', branchGod(a, p.cycle)),
            fact('grade', 'Grade', WORD_OF[g.grade]),
            fact('branchFav', 'Branch', favWord(g.branchFav)),
            fact('stemFav', 'Stem', favWord(g.stemFav)),
            fact('score', 'Score (tenths)', g.score10),
          ],
          { direction: directionOfGrade(g.grade), conventionsUsed: ['baziLuckWeights', 'baziStrengthThresholds'] },
        );
      });
  },
  { sex: true, birthTime: true },
);

const coverCut = bind(
  'bazi.cover-cut',
  (ctx) => {
    const a = natalOf(ctx);
    const out: Firing[] = [];
    for (const p of periodsOf(ctx).filter((x) => x.kind === 'luck')) {
      const hits = coverCutOf(p.cycle, a.favourites.favourable);
      if (hits.length === 0) continue;
      const half = (which: 'stem' | 'branch'): string => (which === 'stem' ? `stem ${stemHanzi(p.cycle)} (${elementName(stemElement(p.cycle))})` : `branch ${branchHanzi(p.cycle)} (${elementName(branchElement(p.cycle))})`);
      const kinds = [...new Set(hits.map((h) => h.kind))];
      // the remedy is looked for against the element of the hostile half
      const remedies = hits.map((h) => remedyOf(a, h.hostile === 'stem' ? stemElement(p.cycle) : branchElement(p.cycle)));
      const remedy = remedies.find((r) => r !== null) ?? null;
      out.push(
        periodFiring(
          p,
          [
            fact('pillar', 'Luck pillar', hanzi(p)),
            fact('capOrCut', 'Kind', kinds.length === 2 ? '蓋頭 (cover) and 截腳 (cut), for different wanted elements' : kinds[0] === '蓋頭' ? '蓋頭 (cover)' : '截腳 (cut)'),
            fact('favouredHalf', 'Favoured half', [...new Set(hits.map((h) => half(h.favoured)))].join(' and ')),
            fact('hostileHalf', 'Hostile half', [...new Set(hits.map((h) => half(h.hostile)))].join(' and ')),
            fact('wanted', 'Wanted element', [...new Set(hits.map((h) => elementName(h.wanted)))].join(', ')),
            fact('multiplier', 'Force kept', remedy === null ? 0.5 : 0.25),
            fact('remedy', 'Remedy in the natal stems', remedy === null ? 'none' : `${remedy}: the loss is halved again`),
          ],
          { conventionsUsed: ['baziStrengthThresholds'] },
        ),
      );
    }
    return out;
  },
  { sex: true, birthTime: true },
);

// ---------------------------------------------------------------------------
// Year
// ---------------------------------------------------------------------------

const yearJudgement = bind('bazi.year-judgement', (ctx) => {
  const a = natalOf(ctx);
  if (a.strengthClass === 'balanced') return [];
  return yearsInLuck(ctx).map((s) => {
    const y = gradeOf(a.favourites, s.year.cycle, YEAR_WEIGHTS);
    let luckGrade: string;
    if (s.luck) {
      const l = gradeOf(a.favourites, s.luck.cycle, LUCK_WEIGHTS).grade;
      luckGrade = l === 'good' && y.grade === 'good' ? 'good, so this is a supported year' : l === 'bad' && y.grade === 'bad' ? 'bad, so this is a doubly bad year' : WORD_OF[l];
    } else luckGrade = ctx.sex === null ? 'not read, because no sex convention gives the luck pillars their direction' : 'not read, because no luck pillar has opened yet';
    return windowFiring(
      s.year,
      s.startUtcMs,
      s.endUtcMs,
      [
        fact('year', 'Year', yearNumber(s.year)),
        fact('pillar', 'Year pillar', hanzi(s.year)),
        fact('tenGodStem', 'Ten god of the stem', stemGod(a, s.year.cycle)),
        fact('tenGodBranch', 'Ten god of the branch (main qi)', branchGod(a, s.year.cycle)),
        fact('favourableOrNot', 'For this chart', y.grade === 'good' ? 'favourable' : y.grade === 'bad' ? 'unfavourable' : 'mixed'),
        fact('luckGrade', 'Luck pillar', luckGrade),
        fact('score', 'Score (tenths)', y.score10),
      ],
      { direction: directionOfGrade(y.grade), conventionsUsed: ['baziLuckWeights', 'baziStrengthThresholds'] },
    );
  });
}, { birthTime: true });

const suiYun = bind(
  'bazi.sui-yun-bing-lin',
  (ctx) => {
    const a = natalOf(ctx);
    const convention = ctx.input.forecastConventions.suiYunSign;
    const out: Firing[] = [];
    for (const s of yearsInLuck(ctx)) {
      if (!s.luck || !samePillar(s.year.cycle, s.luck.cycle)) continue;
      const blade = bladeOf(a.dayStem);
      const isBlade = blade !== null && s.year.cycle.branch.index === blade;
      const god = isBlade ? '羊刃' : stemGod(a, s.year.cycle);
      let sign: 'good' | 'bad' | 'unsigned';
      if (convention === 'source-tengod') {
        sign = isBlade || god === '七殺' ? 'bad' : ['正財', '偏財', '正官', '正印', '偏印'].includes(god) ? 'good' : 'unsigned';
      } else {
        const g = a.strengthClass === 'balanced' ? 'mixed' : gradeOf(a.favourites, s.year.cycle, YEAR_WEIGHTS).grade;
        sign = g === 'good' ? 'good' : g === 'bad' ? 'bad' : 'unsigned';
      }
      const direction: Direction = sign === 'good' ? 'favourable' : sign === 'bad' ? 'unfavourable' : 'activates';
      out.push(
        windowFiring(s.year, s.startUtcMs, s.endUtcMs, [fact('pillar', 'Pillar', hanzi(s.year)), fact('tenGod', 'Ten god', god), fact('goodOrBad', 'Sign', sign), fact('signConvention', 'Sign convention', convention === 'source-tengod' ? 'ten-god sign of the source' : 'favourable-element sign')], {
          direction,
          conventionsUsed: ['suiYunSign'],
        }),
      );
    }
    return out;
  },
  { sex: true, birthTime: true },
);

// ---------------------------------------------------------------------------
// Luck against year, year against day
// ---------------------------------------------------------------------------

const tianKeDiChong = bind(
  'bazi.tian-ke-di-chong',
  (ctx) => {
    const a = natalOf(ctx);
    const out: Firing[] = [];
    for (const s of yearsInLuck(ctx)) {
      if (!s.luck) continue;
      const P = s.luck.cycle;
      const Q = s.year.cycle;
      if (clashOf(P.branch.index) !== Q.branch.index) continue; // 地沖
      const pStrikes = overcomeBy(stemElement(P)) === stemElement(Q);
      const qStrikes = overcomeBy(stemElement(Q)) === stemElement(P);
      if (!pStrikes && !qStrikes) continue; // 天剋
      const striker = pStrikes ? `the luck pillar ${hanzi(s.luck)}` : `the year pillar ${hanzi(s.year)}`;
      const struck = pStrikes ? `the year pillar ${hanzi(s.year)}` : `the luck pillar ${hanzi(s.luck)}`;
      const struckEl = pStrikes ? stemElement(Q) : stemElement(P);
      let direction: Direction;
      let favOrNot: string;
      let goodOrBad: string;
      const badges: string[] = [];
      if (a.strengthClass === 'strong') {
        // the first test of the source: a strong day master takes no harm
        direction = 'activates';
        favOrNot = 'not weighed, since the day master is strong';
        goodOrBad = 'no harm';
        badges.push('strong day master: no harm');
      } else {
        const f = fav(a.favourites, struckEl);
        favOrNot = f === 1 ? 'favourable' : f === -1 ? 'unfavourable' : 'neutral (balanced chart: no favourite chosen)';
        // a struck favourite is a loss, a struck dislike a relief
        direction = f === 1 ? 'unfavourable' : f === -1 ? 'favourable' : 'activates';
        goodOrBad = f === 1 ? 'bad' : f === -1 ? 'good' : 'not signed';
      }
      out.push(
        windowFiring(
          s.year,
          s.startUtcMs,
          s.endUtcMs,
          [fact('luck', 'Luck pillar', hanzi(s.luck)), fact('year', 'Year pillar', hanzi(s.year)), fact('striker', 'Strikes', striker), fact('struck', 'Is struck', struck), fact('struckElement', 'Struck element', elementName(struckEl)), fact('favOrNot', 'For this chart', favOrNot), fact('goodOrBad', 'Reading', goodOrBad)],
          { direction, badges, conventionsUsed: ['baziStrengthThresholds'] },
        ),
      );
    }
    return out;
  },
  { sex: true, birthTime: true },
);

const yearVsDay = bind('bazi.year-vs-day-clash', (ctx) => {
  const a = natalOf(ctx);
  const out: Firing[] = [];
  for (const p of periodsOf(ctx).filter((x) => x.kind === 'year')) {
    // 日犯歲君 only: the template states that the day stem overcomes the year stem, so the other direction has no sentence to say it with
    if (overcomeBy(a.dayElement) !== stemElement(p.cycle)) continue;
    let direction: Direction;
    let severity: string;
    if (a.strengthClass === 'weak') {
      direction = 'unfavourable';
      severity = 'a harm, since the day master is weak';
    } else if (a.strengthClass === 'strong') {
      direction = 'activates';
      severity = 'without harm, since the day master is strong';
    } else {
      direction = 'activates';
      severity = 'not signed, since the chart is balanced';
    }
    out.push(periodFiring(p, [fact('dayStem', 'Day stem', a.pillars.day.stem.hanzi), fact('yearStem', 'Year stem', stemHanzi(p.cycle)), fact('severity', 'Severity', severity)], { direction, conventionsUsed: ['baziStrengthThresholds'] }));
  }
  return out;
}, { birthTime: true });

const huiHe = bind(
  'bazi.hui-he-year',
  (ctx) => {
    const a = natalOf(ctx);
    const day = a.pillars.day;
    return periodsOf(ctx)
      .filter((p) => p.kind === 'year')
      .filter((p) => stemsCombine(p.cycle.stem.index, day.stem.index) && combinationOf(p.cycle.branch.index) === day.branch.index)
      .map((p) => periodFiring(p, [fact('yearPillar', 'Year pillar', hanzi(p)), fact('dayPillar', 'Day pillar', day.hanzi)], { badges: ['晦: delay, a year of going back and forth'] }));
  },
);

const fanFuYin = bind(
  'bazi.fan-yin-fu-yin',
  (ctx) => {
    const day = natalOf(ctx).pillars.day;
    const out: Firing[] = [];
    for (const p of periodsOf(ctx)) {
      let kind: string | null = null;
      if (p.cycle.index === day.index) kind = '伏吟 (repetition)';
      else if (p.cycle.branch.index === clashOf(day.branch.index) && [4, 6].includes(stemSteps(day.stem.index, p.cycle.stem.index))) kind = '反吟 (opposition)';
      if (kind === null) continue;
      out.push(periodFiring(p, [fact('periodName', 'Period', p.periodName), fact('pillar', 'Pillar', hanzi(p)), fact('fuOrFan', 'Kind', kind), fact('dayPillar', 'Day pillar', day.hanzi)]));
    }
    return out;
  },
);

export const PERIOD_BINDINGS: readonly RuleBinding[] = [luckJudgement, coverCut, yearJudgement, suiYun, tianKeDiChong, yearVsDay, huiHe, fanFuYin];
