// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Bindings of the activation rules that test an incoming branch (of a luck pillar or a
 * year) against the natal branches: clash, six-combination and three-harmony, and the note
 * on the spouse palace. The topic of a clash or combination comes from the single palace
 * table (periods.ts, PALACE_TOPICS); the sign of a clash comes from the main qi of the struck
 * branch and the favourable elements.
 */
import { BRANCHES, STEMS } from '../../../systems/bazi/index.ts';
import { clashOf, combinationOf, fav, harmonyGroupOf, kinOf, mainQi, PILLAR_NAMES, type PillarName } from '../../../systems/bazi/relations.ts';
import type { Direction, Firing, Rule, RuleBinding } from '../../types.ts';
import { dayBranchVoid, bind, fact, natalOf } from './natal.ts';
import { periodFiring } from './periodBindings.ts';
import { branchElement, palaceMeaning, periodsOf, routeTopics, stemElement } from './periods.ts';

const natalHanzi = (b: number): string => BRANCHES[b]!.hanzi;
const natalBranch = (a: ReturnType<typeof natalOf>, pillar: PillarName): number => a.pillars[pillar].branch.index;

/** The dedupe instance of a relation at a palace: the day palace shares the window with 反吟 and the spouse note; the others are their own facts. */
const instanceOf = (pillar: PillarName, start: number, end: number): string | undefined => (pillar === 'day' ? undefined : `${start}-${end}:${pillar}`);

const chong = bind('bazi.branch-chong', (ctx, rule: Rule) => {
  const a = natalOf(ctx);
  const out: Firing[] = [];
  for (const p of periodsOf(ctx)) {
    for (const pillar of PILLAR_NAMES) {
      const struck = natalBranch(a, pillar);
      if (clashOf(struck) !== p.cycle.branch.index) continue;
      const route = routeTopics(pillar, rule.topics);
      // the main qi of the struck branch decides: a clash removes a favourable element and relieves an unfavourable one
      const struckEl = STEMS[mainQi(struck)]!.element;
      const f = fav(a.favourites, struckEl);
      const direction: Direction = f === 1 ? 'unfavourable' : f === -1 ? 'favourable' : 'activates';
      out.push(
        periodFiring(
          p,
          [fact('incoming', 'Incoming branch', p.cycle.branch.hanzi), fact('periodName', 'Period', p.periodName), fact('pillarName', 'Palace', pillar), fact('natalBranch', 'Natal branch', a.pillars[pillar].branch.hanzi), fact('palaceMeaning', 'Stands for', palaceMeaning(pillar))],
          { direction, topics: route.topics, badges: route.badges, dedupeInstance: instanceOf(pillar, p.startUtcMs, p.endUtcMs), conventionsUsed: ['baziStrengthThresholds'] },
        ),
      );
    }
  }
  return out;
});

const liuhe = bind('bazi.branch-liuhe', (ctx, rule: Rule) => {
  const a = natalOf(ctx);
  const out: Firing[] = [];
  for (const p of periodsOf(ctx)) {
    const clashed = PILLAR_NAMES.filter((n) => clashOf(natalBranch(a, n)) === p.cycle.branch.index);
    for (const pillar of PILLAR_NAMES) {
      const partner = natalBranch(a, pillar);
      if (combinationOf(partner) !== p.cycle.branch.index) continue;
      const route = routeTopics(pillar, rule.topics);
      const badges = [...route.badges];
      // when one incoming branch both combines and clashes, both are listed and neither is signed
      if (clashed.length > 0) badges.push(`the same incoming branch also clashes the natal ${clashed.join(' and ')} branch (see 六沖): both are listed, neither is signed`);
      out.push(
        periodFiring(
          p,
          [fact('incoming', 'Incoming branch', p.cycle.branch.hanzi), fact('periodName', 'Period', p.periodName), fact('pillarName', 'Palace', pillar), fact('natalBranch', 'Natal branch', a.pillars[pillar].branch.hanzi), fact('palaceMeaning', 'Stands for', palaceMeaning(pillar))],
          { topics: route.topics, badges },
        ),
      );
    }
  }
  return out;
});

const sanhe = bind('bazi.branch-sanhe', (ctx) => {
  const a = natalOf(ctx);
  const natal = PILLAR_NAMES.map((n) => ({ pillar: n, branch: natalBranch(a, n) }));
  const out: Firing[] = [];
  for (const p of periodsOf(ctx)) {
    const group = harmonyGroupOf(p.cycle.branch.index);
    if (natal.some((n) => n.branch === p.cycle.branch.index)) continue; // the group is completed by the third, so the natal chart must lack it
    const others = group.branches.filter((b) => b !== p.cycle.branch.index);
    const held = others.map((b) => natal.find((n) => n.branch === b));
    if (held.some((h) => h === undefined)) continue;
    const f = fav(a.favourites, group.element);
    const direction: Direction = f === 1 ? 'favourable' : f === -1 ? 'unfavourable' : 'activates';
    const names = group.branches.map((b) => natalHanzi(b)).join('');
    out.push(
      periodFiring(
        p,
        [
          fact('incoming', 'Incoming branch', p.cycle.branch.hanzi),
          fact('groupName', 'Group', names),
          fact('element', 'Element', group.element),
          fact('natalBranches', 'Natal branches', held.map((h) => `${natalHanzi(h!.branch)} (${h!.pillar})`).join(' and ')),
          fact('periodName', 'Period', p.periodName),
        ],
        { direction, conventionsUsed: ['baziStrengthThresholds'] },
      ),
    );
  }
  return out;
});

const dayClashSpouse = bind(
  'bazi.day-clash-spouse',
  (ctx) => {
    const a = natalOf(ctx);
    const day = natalBranch(a, 'day');
    const male = ctx.sex === 'male';
    const out: Firing[] = [];
    for (const p of periodsOf(ctx)) {
      const how = clashOf(day) === p.cycle.branch.index ? 'clashed' : combinationOf(day) === p.cycle.branch.index ? 'combined' : null;
      if (how === null) continue;
      // for a man the spouse star is 財, for a woman 官殺: does the arrival bring it
      const star = male ? 'wealth' : 'officer';
      const brings = [stemElement(p.cycle), branchElement(p.cycle)].some((e) => kinOf(a.dayElement, e) === star);
      const note = `${how} by the ${p.periodName} ${p.cycle.hanzi}; the day branch ${dayBranchVoid(a) ? 'is' : 'is not'} void (空亡) in the year pillar's cycle; the arrival ${brings ? `brings ${male ? '財, the wife star' : '官殺, the husband star'}` : `does not bring ${male ? '財, the wife star' : '官殺, the husband star'}`}`;
      out.push(periodFiring(p, [fact('dayBranch', 'Day branch', a.pillars.day.branch.hanzi), fact('note', 'Note', note)]));
    }
    return out;
  },
  { sex: true, birthTime: true },
);

export const RELATION_BINDINGS: readonly RuleBinding[] = [chong, liuhe, sanhe, dayClashSpouse];
