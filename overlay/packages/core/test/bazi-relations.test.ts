// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import rulesJson from '../src/forecast/data/rules.bazi.json' with { type: 'json' };
import { BRANCHES, STEMS, tenGod } from '../src/systems/bazi/index.ts';
import {
  branchAtStage,
  changSheng,
  clashOf,
  combinationOf,
  elementOfKin,
  fav,
  favourites,
  generatedBy,
  harmonyGroupOf,
  inSeason,
  kinOf,
  KIN_ORDER,
  mainQi,
  overcomeBy,
  SIX_CLASHES,
  SIX_COMBINATIONS,
  seasonalState,
  stemsCombine,
  THREE_HARMONY,
  TWELVE_STAGES,
  twelveStage,
  voidBranches,
} from '../src/systems/bazi/relations.ts';

// The rule file is the source of truth for the tables; these helpers read its strings.
const T = rulesJson.tables as Record<string, any>;
const stemIdx = (c: string): number => STEMS.findIndex((s) => s.hanzi === c);
const branchIdx = (c: string): number => BRANCHES.findIndex((b) => b.hanzi === c);
const pairs = (text: string): [number, number][] => text.split(/\s+/).filter(Boolean).map((p) => [branchIdx(p[0]!), branchIdx(p[1]!)] as [number, number]);

describe('clashes, combinations and harmony groups', () => {
  it('has the six clashes the rule file states, and each branch clashes with exactly one other', () => {
    const stated = pairs(T.sixClashes).map(([a, b]) => [a, b].sort((x, y) => x - y).join());
    const mine = SIX_CLASHES.map(([a, b]) => [a, b].sort((x, y) => x - y).join());
    expect(mine.sort()).toEqual(stated.sort());
    for (const [a, b] of pairs(T.sixClashes)) {
      expect(clashOf(a)).toBe(b);
      expect(clashOf(b)).toBe(a);
    }
    expect(BRANCHES.map((b) => clashOf(clashOf(b.index)))).toEqual(BRANCHES.map((b) => b.index));
  });

  it('has the six combinations the rule file states, and combines each branch with exactly one other', () => {
    const stated = pairs(T.sixCombinations.split('(')[0]);
    expect(SIX_COMBINATIONS.map(([a, b]) => [a, b].sort((x, y) => x - y).join()).sort()).toEqual(stated.map(([a, b]) => [a, b].sort((x, y) => x - y).join()).sort());
    for (const [a, b] of stated) {
      expect(combinationOf(a)).toBe(b);
      expect(combinationOf(b)).toBe(a);
    }
    expect(new Set(SIX_COMBINATIONS.flat()).size).toBe(12);
  });

  it('has the four three-harmony groups of the rule file, each branch in exactly one', () => {
    const stated = [...(T.threeHarmony as string).matchAll(/([子丑寅卯辰巳午未申酉戌亥]{3}) ([水木火金])/g)];
    expect(stated).toHaveLength(4);
    const elementOf: Record<string, string> = { 水: 'Water', 木: 'Wood', 火: 'Fire', 金: 'Metal' };
    for (const m of stated) {
      const group = THREE_HARMONY.find((g) => g.element === elementOf[m[2]!])!;
      expect([...group.branches].sort((a, b) => a - b)).toEqual([...m[1]!].map(branchIdx).sort((a, b) => a - b));
      // the branches are named in the source's order, so the middle one is the cardinal branch
      expect([...group.branches].map((b) => BRANCHES[b]!.hanzi).join('')).toBe(m[1]);
    }
    for (const b of BRANCHES) expect(THREE_HARMONY.filter((g) => g.branches.includes(b.index))).toHaveLength(1);
    expect(harmonyGroupOf(branchIdx('午')).element).toBe('Fire');
  });

  it('has the five stem combinations the rule file states', () => {
    for (const pair of (T.stemCombinations as string).split(/\s+/)) {
      expect(stemsCombine(stemIdx(pair[0]!), stemIdx(pair[1]!))).toBe(true);
      expect(stemsCombine(stemIdx(pair[1]!), stemIdx(pair[0]!))).toBe(true);
    }
    expect(stemsCombine(0, 1)).toBe(false);
    expect(stemsCombine(0, 0)).toBe(false);
  });
});

describe('main qi and the void pairs', () => {
  it('takes the main qi from the engine and agrees with the rule file, including the five checked branches', () => {
    const stated = T.hiddenStems.mainQi as Record<string, string>;
    for (const b of BRANCHES) expect(STEMS[mainQi(b.index)]!.hanzi, b.hanzi).toBe(stated[b.hanzi]);
    // the five hidden-stem pairs: 丑 己, 辰 戊, 巳 丙, 未 己, 戌 戊
    expect(['丑', '辰', '巳', '未', '戌'].map((c) => STEMS[mainQi(branchIdx(c))]!.hanzi)).toEqual(['己', '戊', '丙', '己', '戊']);
  });

  it('holds exactly the verse set of hidden stems, in any order', () => {
    const verse = T.hiddenStems.verseSet as Record<string, string>;
    for (const b of BRANCHES) expect([...verse[b.hanzi]!].sort(), b.hanzi).toEqual(b.hidden.map((s) => STEMS[s]!.hanzi).sort());
  });

  it('gives the void pair of each ten-day cycle as the rule file states', () => {
    const stated = [...(T.voidBranches as string).matchAll(/(甲[子戌申午辰寅])旬 ([子丑寅卯辰巳午未申酉戌亥]{2})/g)];
    expect(stated).toHaveLength(6);
    for (const m of stated) {
      // the cycle opens at the pillar named; every pillar of its ten shares its void pair
      const open = [...Array(60).keys()].find((i) => STEMS[i % 10]!.hanzi + BRANCHES[i % 12]!.hanzi === m[1])!;
      for (let k = 0; k < 10; k++) expect([...voidBranches(open + k)].map((b) => BRANCHES[b]!.hanzi).join(''), `${m[1]}+${k}`).toBe(m[2]);
    }
    expect(voidBranches(0)).toEqual([10, 11]);
    expect(voidBranches(59)).toEqual([0, 1]);
    expect(voidBranches(60)).toEqual(voidBranches(0));
  });
});

describe('the twelve stages', () => {
  const FIRE = { school: 'fire-earth', yinReverse: true } as const;
  const WATER = { school: 'water-earth', yinReverse: true } as const;

  it('has the long-sheng table of the rule file for the eight stems without a school', () => {
    const stated = T.twelveStages.changSheng as Record<string, string>;
    for (const s of STEMS) {
      if (s.hanzi === '戊' || s.hanzi === '己') continue;
      expect(BRANCHES[changSheng(s.index, 'fire-earth')]!.hanzi, s.hanzi).toBe(stated[s.hanzi]);
      expect(changSheng(s.index, 'water-earth')).toBe(changSheng(s.index, 'fire-earth'));
    }
  });

  it('has both schools for 戊 and 己, as the rule file states them', () => {
    const wu = T.twelveStages.changSheng['戊'] as string;
    const ji = T.twelveStages.changSheng['己'] as string;
    expect(wu).toContain('寅 (fire-earth school)');
    expect(wu).toContain('申 (water-earth school');
    expect(ji).toContain('酉 (fire-earth school)');
    expect(ji).toContain('卯 (water-earth school)');
    expect(BRANCHES[changSheng(stemIdx('戊'), 'fire-earth')]!.hanzi).toBe('寅');
    expect(BRANCHES[changSheng(stemIdx('戊'), 'water-earth')]!.hanzi).toBe('申');
    expect(BRANCHES[changSheng(stemIdx('己'), 'fire-earth')]!.hanzi).toBe('酉');
    expect(BRANCHES[changSheng(stemIdx('己'), 'water-earth')]!.hanzi).toBe('卯');
  });

  it('lists the stages in the order of the rule file', () => {
    expect((T.twelveStages.sequence as string).split(', ')).toEqual([...TWELVE_STAGES]);
  });

  it('puts 帝旺 of the yang stems in the cardinal branch of their own element and 臨官 in the branch before it', () => {
    const lin = { 甲: '寅', 丙: '巳', 庚: '申', 壬: '亥' } as const;
    const di = { 甲: '卯', 丙: '午', 庚: '酉', 壬: '子' } as const;
    for (const s of Object.keys(lin) as (keyof typeof lin)[]) {
      expect(BRANCHES[branchAtStage(stemIdx(s), '臨官', FIRE)]!.hanzi).toBe(lin[s]);
      expect(BRANCHES[branchAtStage(stemIdx(s), '帝旺', FIRE)]!.hanzi).toBe(di[s]);
    }
  });

  it('runs the yin stems backward under the convention and forward without it', () => {
    // 乙 長生 午: backward gives 臨官 卯 and 帝旺 寅
    expect(BRANCHES[branchAtStage(stemIdx('乙'), '臨官', FIRE)]!.hanzi).toBe('卯');
    expect(BRANCHES[branchAtStage(stemIdx('乙'), '帝旺', FIRE)]!.hanzi).toBe('寅');
    expect(BRANCHES[branchAtStage(stemIdx('乙'), '帝旺', { school: 'fire-earth', yinReverse: false })]!.hanzi).toBe('戌');
    // yang stems are unaffected by the convention
    expect(twelveStage(0, 3, FIRE)).toEqual(twelveStage(0, 3, { school: 'fire-earth', yinReverse: false }));
  });

  it('follows each earth school through to 臨官: 戊 寅 then 巳 (fire) or 申 then 亥 (water); 己 酉 then 午, or 卯 then 子', () => {
    expect(BRANCHES[branchAtStage(stemIdx('戊'), '臨官', FIRE)]!.hanzi).toBe('巳');
    expect(BRANCHES[branchAtStage(stemIdx('戊'), '臨官', WATER)]!.hanzi).toBe('亥');
    expect(BRANCHES[branchAtStage(stemIdx('己'), '臨官', FIRE)]!.hanzi).toBe('午');
    expect(BRANCHES[branchAtStage(stemIdx('己'), '臨官', WATER)]!.hanzi).toBe('子');
  });

  it('classes the stages as the source does: 四貴 胎 生 旺 庫, 四忌 死 絕 病 敗, the rest 四平', () => {
    const cls = (name: (typeof TWELVE_STAGES)[number]): string => twelveStage(0, branchAtStage(0, name, FIRE), FIRE).class;
    expect(['胎', '長生', '帝旺', '墓'].map((n) => cls(n as never))).toEqual(['四貴', '四貴', '四貴', '四貴']);
    expect(['死', '絕', '病', '沐浴'].map((n) => cls(n as never))).toEqual(['四忌', '四忌', '四忌', '四忌']);
    expect(['冠帶', '臨官', '衰', '養'].map((n) => cls(n as never))).toEqual(['四平', '四平', '四平', '四平']);
  });

  it('visits each of the twelve stages once for every stem', () => {
    for (const s of STEMS) for (const school of ['fire-earth', 'water-earth'] as const) expect(new Set(BRANCHES.map((b) => twelveStage(s.index, b.index, { school, yinReverse: true }).index)).size).toBe(12);
  });
});

describe('seasonal state', () => {
  it('follows the rule file: same 旺, makes it 相, it makes the month 休, it overcomes the month 囚, the month overcomes it 死', () => {
    // wood in a wood month
    expect(seasonalState('Wood', branchIdx('寅'))).toBe('旺');
    // water makes wood: 相 in a water month
    expect(seasonalState('Wood', branchIdx('子'))).toBe('相');
    // wood makes fire: 休 in a fire month
    expect(seasonalState('Wood', branchIdx('午'))).toBe('休');
    // wood overcomes earth: 囚 in an earth month
    expect(seasonalState('Wood', branchIdx('辰'))).toBe('囚');
    // metal overcomes wood: 死 in a metal month
    expect(seasonalState('Wood', branchIdx('酉'))).toBe('死');
  });

  it('gives each element each of the five states exactly once across the five month elements', () => {
    for (const e of ['Wood', 'Fire', 'Earth', 'Metal', 'Water'] as const) {
      const states = [branchIdx('寅'), branchIdx('午'), branchIdx('辰'), branchIdx('申'), branchIdx('子')].map((b) => seasonalState(e, b));
      expect(new Set(states).size).toBe(5);
    }
  });

  it('makes earth 旺 in all four 季月 and in nothing else', () => {
    for (const c of ['辰', '戌', '丑', '未']) expect(seasonalState('Earth', branchIdx(c))).toBe('旺');
    for (const c of ['子', '寅', '卯', '巳', '午', '申', '酉', '亥']) expect(seasonalState('Earth', branchIdx(c))).not.toBe('旺');
  });

  it('counts the first two states as in season', () => {
    expect([...'旺相休囚死'].map((s) => inSeason(s as never))).toEqual([true, true, false, false, false]);
  });

  it('agrees with the element table of the rule file for the month branches', () => {
    const expected: Record<string, string> = { 寅: 'Wood', 卯: 'Wood', 巳: 'Fire', 午: 'Fire', 申: 'Metal', 酉: 'Metal', 亥: 'Water', 子: 'Water', 辰: 'Earth', 戌: 'Earth', 丑: 'Earth', 未: 'Earth' };
    for (const b of BRANCHES) expect(b.element).toBe(expected[b.hanzi]);
  });
});

describe('kin and the favourable elements', () => {
  it('derives the ten gods for 甲 as the rule file checks them: 庚辛 官殺, 戊己 財, 壬癸 印, 丙丁 食傷, 甲乙 比劫', () => {
    const kinName: Record<string, string> = { peer: '比劫', output: '食傷', wealth: '財', officer: '官殺', resource: '印' };
    const dm = STEMS[0]!;
    const byKin = (kin: string): string => STEMS.filter((s) => kinName[kinOf(dm.element, s.element)] === kin).map((s) => s.hanzi).join('');
    expect(byKin('官殺')).toBe('庚辛');
    expect(byKin('財')).toBe('戊己');
    expect(byKin('印')).toBe('壬癸');
    expect(byKin('食傷')).toBe('丙丁');
    expect(byKin('比劫')).toBe('甲乙');
  });

  it('agrees with the engine\'s ten gods for every pair of stems', () => {
    const family: Record<string, string> = { 比肩: 'peer', 劫財: 'peer', 食神: 'output', 傷官: 'output', 偏財: 'wealth', 正財: 'wealth', 七殺: 'officer', 正官: 'officer', 偏印: 'resource', 正印: 'resource' };
    for (const d of STEMS) for (const o of STEMS) expect(kinOf(d.element, o.element), `${d.hanzi}${o.hanzi}`).toBe(family[tenGod(d.index, o.index).hanzi]);
  });

  it('inverts kin and element, and generating and overcoming follow the rule file', () => {
    for (const e of ['Wood', 'Fire', 'Earth', 'Metal', 'Water'] as const) for (const k of KIN_ORDER) expect(kinOf(e, elementOfKin(e, k))).toBe(k);
    expect(generatedBy('Wood')).toBe('Fire');
    expect(generatedBy('Water')).toBe('Wood');
    expect(['Wood', 'Earth', 'Water', 'Fire', 'Metal'].map((e) => overcomeBy(e as never))).toEqual(['Earth', 'Water', 'Fire', 'Metal', 'Wood']);
  });

  it('gives a strong day master 食傷 財 官殺 as favourable and 印 比劫 as unfavourable, and a weak one the reverse', () => {
    const strong = favourites('Wood', 'strong');
    expect(strong.favourable).toEqual(['Fire', 'Earth', 'Metal']);
    expect(strong.unfavourable).toEqual(['Wood', 'Water']);
    const weak = favourites('Wood', 'weak');
    expect(weak.favourable).toEqual(['Wood', 'Water']);
    expect(weak.unfavourable).toEqual(['Fire', 'Earth', 'Metal']);
    expect(['Wood', 'Fire', 'Earth', 'Metal', 'Water'].map((e) => fav(strong, e as never))).toEqual([-1, 1, 1, 1, -1]);
  });

  it('gives a balanced day master no favourite: both sets empty and fav() zero for every element', () => {
    const b = favourites('Metal', 'balanced');
    expect(b.favourable).toEqual([]);
    expect(b.unfavourable).toEqual([]);
    for (const e of ['Wood', 'Fire', 'Earth', 'Metal', 'Water'] as const) expect(fav(b, e)).toBe(0);
  });
});
