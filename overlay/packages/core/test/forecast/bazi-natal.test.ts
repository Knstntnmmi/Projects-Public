// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import baziJson from '../../src/forecast/data/rules.bazi.json' with { type: 'json' };
import { auditRegistry, createContext, DEFAULT_REGISTRY, evaluate, fillTemplate, makeInput, report, signalsFromFirings, type Firing } from '../../src/forecast/index.ts';
import { classifyStrength } from '../../src/forecast/predicates/bazi/assessment.ts';
import { NATAL_BINDINGS, NATAL_NOT_EVALUATED } from '../../src/forecast/predicates/bazi/natal.ts';
import { STAR_BINDINGS } from '../../src/forecast/predicates/bazi/starBindings.ts';
import { BLADE, horseOf, LU, NOBLE, peachOf } from '../../src/forecast/predicates/bazi/stars.ts';
import * as baziModule from '../../src/forecast/predicates/bazi.ts';
import { BRANCHES, STEMS } from '../../src/systems/bazi/index.ts';
import { makeMoment } from '../../src/substrate/time.ts';
import { MOMENTS, fixture } from '../../../../fixtures/moments.ts';
import { assess, chart, factOf, fire, randomCharts, ruleOf } from './bazi-charts.ts';

// The worked chart: the pillars of the fixture 'jiazi-1984', typed here by hand.
const WORKED = chart('甲子', '丙寅', '己巳', '庚午');
const input = (id: string, o: { sex?: 'none' | 'male-chart' | 'female-chart'; minutes?: number | null; fromYear?: number; toYear?: number; fc?: object } = {}) => {
  const f = fixture(id);
  return makeInput(makeMoment(f.civil, f.zone, f.place), {
    fromYear: o.fromYear ?? 2031,
    toYear: o.toYear ?? 2040,
    birthTimeUncertaintyMinutes: o.minutes === undefined ? 0 : o.minutes,
    forecastConventions: { baziSexConvention: o.sex ?? 'none', ...(o.fc ?? {}) },
  });
};
const sentenceOf = (id: string, firing: Firing): string => fillTemplate(id, ruleOf(id).template, firing.facts);

describe('the natal assessment of a hand-worked chart (甲子 丙寅 己巳 庚午)', () => {
  const a = assess(WORKED);

  it('weighs the seven characters by the stated scheme and gets the sums by hand', () => {
    // support (比劫 and 印), in eighths of the rule file's unit: 丙 stem 8, 寅 hides 丙 12 and 戊 6, 巳 hides 丙 12 and 戊 3, 午 hides 丁 8 and 己 4
    expect(a.support8).toBe(53);
    // drain: 甲 stem 8, 子 hides 癸 8, 寅 hides 甲 24, 巳 hides 庚 6, 庚 stem 8
    expect(a.drain8).toBe(54);
    expect(a.total8).toBe(107);
    expect(a.score).toBeCloseTo(49.53, 2);
    expect(a.strengthClass).toBe('balanced');
  });

  it('puts the month branch main qi at 3.0, the day branch at 1.5, the year and hour branches at 1.0, and the hidden stems at one half and one quarter', () => {
    const w = (pillar: string, order: number) => a.chars.find((c) => c.pillar === pillar && c.place === 'hidden' && c.order === order)!.weight8 / 8;
    expect([w('month', 0), w('month', 1), w('month', 2)]).toEqual([3, 1.5, 0.75]);
    expect([w('day', 0), w('day', 1), w('day', 2)]).toEqual([1.5, 0.75, 0.375]);
    expect([w('year', 0), w('hour', 0), w('hour', 1)]).toEqual([1, 1, 0.5]);
    expect(a.chars.filter((c) => c.place === 'stem').map((c) => c.weight8)).toEqual([8, 8, 8]);
    expect(a.chars).toHaveLength(3 + 1 + 3 + 3 + 2);
  });

  it('takes the month state from the season and counts it once, through the month weight alone', () => {
    expect(a.monthState).toEqual({ state: '死', deLing: false });
    // no extra multiplier for the season: the score is a plain share of the characters
    expect(a.score).toBeCloseTo((100 * a.support8) / a.total8, 10);
  });

  it('finds the roots and the stem support the rule asks for', () => {
    expect(a.roots.map((c) => `${STEMS[c.stem]!.hanzi}${c.pillar}`)).toEqual(['丙month', '戊month', '丙day', '戊day', '丁hour', '己hour']);
    expect(a.stemSupport.map((c) => STEMS[c.stem]!.hanzi)).toEqual(['丙']);
    expect(a.followerCandidate).toBe(false);
    expect(a.voidPair.map((b) => BRANCHES[b]!.hanzi)).toEqual(['戌', '亥']);
  });

  it('weighs the elements over all eight characters, the day stem counting 1.0', () => {
    expect(a.elementTotal8).toBe(a.total8 + 8);
    expect(a.elementWeight8.Earth).toBeGreaterThanOrEqual(8);
  });
});

describe('strength bands', () => {
  it('do not overlap: a score of exactly 45 or exactly 55 is balanced, and every support lands in one class', () => {
    expect(classifyStrength(110, 200)).toBe('balanced'); // 55.0
    expect(classifyStrength(111, 200)).toBe('strong');
    expect(classifyStrength(90, 200)).toBe('balanced'); // 45.0
    expect(classifyStrength(89, 200)).toBe('weak');
    expect(classifyStrength(11, 20)).toBe('balanced'); // 55 as a fraction that floats can round
    expect(classifyStrength(9, 20)).toBe('balanced');
    for (const total of [40, 107, 200, 333]) for (let s = 0; s <= total; s++) expect(['strong', 'weak', 'balanced']).toContain(classifyStrength(s, total));
    const classes = (total: number) => Array.from({ length: total + 1 }, (_, s) => classifyStrength(s, total));
    for (const c of classes(107)) expect(typeof c).toBe('string');
    // the classes are ordered and contiguous: weak, then balanced, then strong
    const seq = classes(107).join(',').replace(/(\w+)(,\1)+/g, '$1');
    expect(seq).toBe('weak,balanced,strong');
  });

  it('flags a follower candidate only when no hidden stem is a root and the score is under 20, and gives no verdict', () => {
    // 甲 day master with metal and fire and water all round and no wood or water hidden anywhere
    const p = chart('庚午', '丙午', '甲午', '庚午');
    const a = assess(p);
    expect(a.roots).toEqual([]);
    expect(a.score).toBeLessThan(20);
    expect(a.followerCandidate).toBe(true);
    const [f] = fire('bazi.strength-score', p);
    expect(f!.badges).toEqual(['follower candidate (從格): a flag, no verdict']);
    expect(factOf(f!, 'class')).toBe('weak');
  });
});

describe('month state', () => {
  it('states the day master and the season as the rule\'s template does', () => {
    const [f] = fire('bazi.month-state', WORKED);
    expect(sentenceOf('bazi.month-state', f!)).toBe('The day master 己 is 死 in the 寅 month (失令).');
    expect(f!.startUtcMs).toBeNull();
  });
});

describe('the twelve stages and the hidden stems', () => {
  it('gives one stage per natal branch, with the source\'s class', () => {
    const fs = fire('bazi.twelve-stages', WORKED);
    expect(fs.map((f) => sentenceOf('bazi.twelve-stages', f))).toEqual([
      'The day master sits in 絕 (四忌) in the year branch (子).',
      'The day master sits in 死 (四忌) in the month branch (寅).',
      'The day master sits in 帝旺 (四貴) in the day branch (巳).',
      'The day master sits in 臨官 (四平) in the hour branch (午).',
    ]);
  });

  it('follows the earth school named by the convention and the yin direction', () => {
    const water = fire('bazi.twelve-stages', WORKED, null, { baziEarthStages: 'water-earth' });
    // 己 長生 卯 backward: 巳 is 胎, 子 is 死 ... the day branch moves from 帝旺 to 胎
    expect(factOf(water[2]!, 'stage')).toBe('胎');
    const forward = fire('bazi.twelve-stages', WORKED, null, { baziYinStageReverse: false });
    expect(factOf(forward[2]!, 'stage')).not.toBe('帝旺');
    expect(fire('bazi.twelve-stages', WORKED)[0]!.conventionsUsed).toEqual(['baziEarthStages', 'baziYinStageReverse']);
  });

  it('names the roots of each branch from the engine\'s hidden stems, and says nothing for a branch with none', () => {
    const fs = fire('bazi.hidden-stems', WORKED);
    expect(fs.map((f) => sentenceOf('bazi.hidden-stems', f))).toEqual([
      'The month branch 寅 hides 甲 正官, 丙 正印, 戊 劫財, giving the day master a root through 丙, 戊.',
      'The day branch 巳 hides 丙 正印, 庚 傷官, 戊 劫財, giving the day master a root through 丙, 戊.',
      'The hour branch 午 hides 丁 偏印, 己 比肩, giving the day master a root through 丁, 己.',
    ]);
  });
});

describe('the favourable elements', () => {
  it('give a balanced chart no favourite and say so in the sentence and the badge', () => {
    const [f] = fire('bazi.favourable-fuyi', WORKED);
    expect(sentenceOf('bazi.favourable-fuyi', f!)).toBe(
      'For this balanced day master the favourable elements are none (balanced: no favourite chosen) and the unfavourable are none (balanced: no dislike chosen, period signs from fav() are silent).',
    );
    expect(f!.badges).toEqual(['balanced: no favourite chosen']);
    expect(assess(WORKED).favourites.favourable).toEqual([]);
  });

  it('names the elements of 食傷 財 官殺 for a strong day master and 印 比劫 for a weak one', () => {
    const strong = chart('丙寅', '乙卯', '乙酉', '丁卯');
    expect(assess(strong).strengthClass).toBe('strong');
    expect(sentenceOf('bazi.favourable-fuyi', fire('bazi.favourable-fuyi', strong)[0]!)).toBe('For this strong day master the favourable elements are Fire 火, Earth 土, Metal 金 and the unfavourable are Wood 木, Water 水.');
    const weak = chart('壬午', '癸酉', '丙辰', '辛丑');
    expect(assess(weak).strengthClass).toBe('weak');
    expect(sentenceOf('bazi.favourable-fuyi', fire('bazi.favourable-fuyi', weak)[0]!)).toBe('For this weak day master the favourable elements are Fire 火, Wood 木 and the unfavourable are Earth 土, Metal 金, Water 水.');
  });

  it('reports a locked pair and the element that would connect it, and changes no favourite', () => {
    const p = chart('戊辰', '癸亥', '壬戌', '乙未');
    const fs = fire('bazi.tongguan', p);
    expect(fs.map((f) => sentenceOf('bazi.tongguan', f))).toEqual(['Earth 土 and Water 水 are locked against each other and Metal 金 would connect them.']);
    expect(assess(p).favourites.favourable).toEqual(assess(p).favourites.favourable);
  });
});

describe('the topic promises: each grade is reachable and the grades exclude each other', () => {
  const wealth = (hanzi: string[], sex: 'male' | 'female' | null = null) => fire('bazi.topic-wealth-promise', chart(hanzi[0]!, hanzi[1]!, hanzi[2]!, hanzi[3]!), sex);
  const grade = (fs: Firing[]) => fs.map((f) => factOf(f, 'grade'));

  it('wealth: absent, too heavy, robbed, present and carried, with the signs the condition states', () => {
    expect(grade(wealth(['庚午', '辛丑', '庚戌', '己巳']))).toEqual(['absent']);
    expect(wealth(['庚午', '辛丑', '庚戌', '己巳'])[0]!.direction).toBe('activates');
    expect(grade(wealth(['壬午', '癸酉', '丙辰', '辛丑']))).toEqual(['too heavy']);
    expect(wealth(['壬午', '癸酉', '丙辰', '辛丑'])[0]!.direction).toBe('unfavourable');
    // 戊 weighs 2.5 against 甲 and 乙 at 3.25, and nothing of 官殺 or 食傷 checks them
    expect(grade(wealth(['甲子', '癸亥', '甲辰', '戊子']))).toEqual(['robbed']);
    expect(wealth(['甲子', '癸亥', '甲辰', '戊子'])[0]!.direction).toBe('unfavourable');
    const carried = wealth(['丙寅', '乙卯', '乙酉', '丁卯']);
    expect(grade(carried)).toEqual(['present and carried']);
    expect(carried[0]!.direction).toBe('favourable');
    expect(carried[0]!.topics).toEqual(['wealth']);
    expect(carried[0]!.badges).toEqual(['strengthened by 食傷, the source of wealth']);
  });

  it('wealth: a robbed chart that has 官殺 or 食傷 is not robbed, and a balanced chart with wealth carried says nothing', () => {
    // as the robbed chart, with a 庚 stem to check the peers
    const checked = wealth(['甲子', '癸亥', '甲辰', '庚子']);
    expect(grade(checked)).not.toContain('robbed');
    const worked = fire('bazi.topic-wealth-promise', WORKED);
    expect(assess(WORKED).strengthClass).toBe('balanced');
    expect(worked).toEqual([]);
  });

  it('wealth: sentences are the template filled from the facts', () => {
    expect(sentenceOf('bazi.topic-wealth-promise', wealth(['庚午', '辛丑', '庚戌', '己巳'])[0]!)).toBe('Wealth promise is absent: 財 stars none, day master strong.');
  });

  it('career: every grade in the stated precedence', () => {
    const career = (a: string, b: string, c: string, d: string) => fire('bazi.topic-career-promise', chart(a, b, c, d));
    expect(grade(career('己亥', '甲子', '己卯', '乙卯'))).toEqual(['overpowering']);
    expect(career('己亥', '甲子', '己卯', '乙卯')[0]!.direction).toBe('unfavourable');
    expect(grade(career('丙寅', '乙卯', '乙酉', '丁卯'))).toEqual(['weak or absent']);
    const mixed = career('乙未', '丙辰', '戊子', '壬寅');
    expect(grade(mixed)).toEqual(['mixed']);
    // 官殺混雜 is a flag: it carries no sign
    expect(mixed[0]!.direction).toBe('activates');
    expect(sentenceOf('bazi.topic-career-promise', mixed[0]!)).toContain('a flag only, no sign');
    const controlled = career('戊寅', '戊午', '庚子', '己未');
    expect(grade(controlled)).toEqual(['controlled']);
    expect(controlled[0]!.direction).toBe('favourable');
    const clear = career('乙未', '壬申', '丁巳', '辛卯');
    expect(grade(clear)).toEqual(['clear officer']);
    expect(clear[0]!.direction).toBe('favourable');
  });

  it('career: a stem combination that removes one of 官 and 殺 takes the chart out of the mixed grade', () => {
    // as the mixed chart with the year stem 乙 able to combine with a 庚 in the hour: no longer a flag-only mixture
    const p = chart('乙未', '丙辰', '戊子', '庚寅');
    expect(grade(fire('bazi.topic-career-promise', p))).not.toContain('mixed');
  });

  it('learning: supported, excess, absent, with the academy flag as a derived convention', () => {
    const l = (a: string, b: string, c: string, d: string) => fire('bazi.topic-learning', chart(a, b, c, d));
    expect(grade(l('戊辰', '癸亥', '壬戌', '乙未'))).toEqual(['supported']);
    expect(grade(l('甲寅', '丁卯', '丁酉', '乙亥'))).toEqual(['excess']);
    expect(grade(l('丙寅', '乙卯', '乙酉', '丁卯'))).toEqual(['absent']);
    // 辛 is 長生 in 子 (backward run); 子 stands in the chart, unclashed (no 午) and not void (辛巳 is in the cycle that leaves 申酉 empty)
    expect(factOf(l('戊子', '己卯', '辛巳', '戊子')[0]!, 'academy')).toBe('學堂 子');
    expect(factOf(l('丙寅', '乙卯', '乙酉', '丁卯')[0]!, 'academy')).toBe('none');
  });

  it('health: flags are tendencies in organ terms, harmony is favourable, and the thresholds are exact', () => {
    const h = (a: string, b: string, c: string, d: string) => fire('bazi.topic-health', chart(a, b, c, d));
    const cut = h('丙寅', '乙卯', '乙酉', '丁卯');
    expect(cut.every((f) => f.direction === 'unfavourable' && f.topics!.join() === 'health')).toBe(true);
    expect(cut.map((f) => sentenceOf('bazi.topic-health', f)).join(' ')).toContain('腎 (kidney)');
    const harmonious = h('戊辰', '癸亥', '壬戌', '乙未');
    expect(harmonious.map((f) => f.direction)).toEqual(['favourable']);
    expect(sentenceOf('bazi.topic-health', harmonious[0]!)).toBe(
      'Health tendency: none flagged because no element has under one twentieth or over two fifths of the chart weight, and no unfavourable element is unchecked.',
    );
    // the bounds hold on every chart of a sample: harmony means every element between 0.05 and 0.4, a cut-off element is under 0.05 and has no root
    for (const p of randomCharts(5, 2000)) {
      const a = assess(p);
      const t = a.elementTotal8;
      const fs = fire('bazi.topic-health', p);
      const lopsided = Object.values(a.elementWeight8).some((w) => 20 * w < t || 5 * w > 2 * t);
      if (fs.some((f) => f.direction === 'favourable')) expect(lopsided).toBe(false);
      if (!lopsided) expect(fs.every((f) => f.direction === 'favourable' || factOf(f, 'organList') !== 'none')).toBe(true);
      for (const f of fs.filter((x) => String(factOf(x, 'reason')).includes('no root in a hidden stem'))) {
        const e = (['Wood', 'Fire', 'Earth', 'Metal', 'Water'] as const).find((x) => String(factOf(f, 'reason')).startsWith(x))!;
        expect(20 * a.elementWeight8[e]).toBeLessThan(t);
        expect(a.hiddenElements.has(e)).toBe(false);
      }
    }
  });

  it('peers: help for a weak day master with roots, strong at four tenths or more', () => {
    const p = fire('bazi.peers-rivals', chart('戊辰', '癸亥', '壬戌', '乙未'));
    expect(p.map((f) => factOf(f, 'helpOrStrong'))).toContain('helping the weak day master');
    const strong = fire('bazi.peers-rivals', chart('丙寅', '乙卯', '乙酉', '丁卯'));
    expect(strong.map((f) => factOf(f, 'helpOrStrong'))).toContain('strong, holding two fifths or more of the chart');
  });

  it('any chart gets at most one grade per promise rule, and a grade it can state in the rule\'s own words', () => {
    const ids = ['bazi.topic-wealth-promise', 'bazi.topic-career-promise', 'bazi.topic-learning'] as const;
    const allowed: Record<string, string[]> = {
      'bazi.topic-wealth-promise': ['absent', 'too heavy', 'robbed', 'present and carried'],
      'bazi.topic-career-promise': ['overpowering', 'weak or absent', 'mixed', 'controlled', 'clear officer'],
      'bazi.topic-learning': ['supported', 'excess', 'absent'],
    };
    const seen = new Set<string>();
    for (const p of randomCharts(7, 30000)) {
      for (const id of ids) {
        const fs = fire(id, p);
        expect(fs.length).toBeLessThanOrEqual(1);
        for (const f of fs) {
          expect(allowed[id]).toContain(factOf(f, 'grade'));
          seen.add(`${id}:${factOf(f, 'grade')}`);
        }
      }
    }
    // every grade of the three rules turned up in the sample, so the check above covered them all
    expect([...seen].sort()).toEqual([...Object.entries(allowed)].flatMap(([id, gs]) => gs.map((g) => `${id}:${g}`)).sort());
  });

  it('a balanced chart has an empty favourite set however the sample falls', () => {
    for (const p of randomCharts(3, 500)) {
      const a = assess(p);
      if (a.strengthClass === 'balanced') {
        expect(a.favourites.favourable).toEqual([]);
        expect(a.favourites.unfavourable).toEqual([]);
        expect(factOf(fire('bazi.favourable-fuyi', p)[0]!, 'favourable')).toContain('no favourite chosen');
      }
    }
  });
});

describe('the rules that need a sex convention', () => {
  it('give the man\'s spouse grades for a male chart only, and the children grades for a female chart only', () => {
    const grade = (id: string, p: ReturnType<typeof chart>, sex: 'male' | 'female') => fire(id, p, sex).map((f) => factOf(f, 'grade'));
    expect(grade('bazi.topic-spouse-man', chart('戊寅', '戊午', '庚子', '己未'), 'male')).toEqual(['supported']);
    expect(grade('bazi.topic-spouse-man', chart('戊寅', '戊午', '庚子', '己未'), 'female')).toEqual([]);
    expect(grade('bazi.topic-spouse-man', chart('庚午', '辛丑', '庚戌', '己巳'), 'male')).toEqual(['absent']);
    expect(grade('bazi.topic-spouse-man', chart('壬午', '癸酉', '丙辰', '辛丑'), 'male')).toEqual(['burdened']);
    expect(grade('bazi.topic-spouse-man', chart('甲子', '癸亥', '甲辰', '戊子'), 'male')).toEqual(['rivalled']);
    expect(grade('bazi.topic-children', chart('丙寅', '乙卯', '乙酉', '丁卯'), 'female')).toEqual(['supported']);
    expect(grade('bazi.topic-children', chart('辛未', '辛卯', '辛卯', '庚午'), 'female')).toEqual(['thin']);
    expect(grade('bazi.topic-children', chart('辛未', '辛卯', '辛卯', '庚午'), 'male')).toEqual([]);
  });

  it('are withheld without a convention and listed as needing it', () => {
    const r = report(DEFAULT_REGISTRY, { traditions: ['bazi'], sex: null, birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60 });
    for (const id of ['bazi.topic-spouse-man', 'bazi.topic-children']) expect(r.statuses.find((s) => s.ruleId === id)).toMatchObject({ state: 'withheld', reason: 'needs-sex-convention' });
    const male = report(DEFAULT_REGISTRY, { traditions: ['bazi'], sex: 'male', birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60 });
    expect(male.statuses.find((s) => s.ruleId === 'bazi.topic-spouse-man')!.state).toBe('bound');
  });

  it('leaves the woman\'s spouse rule unbound on purpose, with the reason', () => {
    expect(NATAL_NOT_EVALUATED.map((n) => n.ruleId)).toEqual(['bazi.topic-spouse-woman']);
    expect(baziModule.NOT_EVALUATED.map((n) => n.ruleId)).toContain('bazi.topic-spouse-woman');
    expect(baziModule.BINDINGS.map((b) => b.ruleId)).not.toContain('bazi.topic-spouse-woman');
  });

  it('writes the ten gods by topic with the spouse and children meanings only when a sex is given', () => {
    const none = fire('bazi.ten-gods-by-topic', WORKED);
    const female = fire('bazi.ten-gods-by-topic', WORKED, 'female');
    const male = fire('bazi.ten-gods-by-topic', WORKED, 'male');
    expect(none.map((f) => f.topics!.join('+'))).toEqual(['career', 'learning', 'general']);
    expect(female.map((f) => f.topics!.join('+'))).toEqual(['career+relationships', 'learning', 'general+relationships']);
    expect(male.map((f) => f.topics!.join('+'))).toEqual(['career', 'learning', 'general']);
    expect(sentenceOf('bazi.ten-gods-by-topic', none[1]!)).toBe('丙 (month stem) is 正印 to the 己 day master, so it stands for learning and support.');
  });
});

describe('the star tables', () => {
  const T = baziJson.tables as unknown as Record<string, any>;
  const name = (b: number) => BRANCHES[b]!.hanzi;
  const stem = (c: string) => STEMS.findIndex((s) => s.hanzi === c);

  it('are read from the rule file and agree with the values it states', () => {
    for (const [s, bs] of Object.entries(T.tianYiGuiRen as Record<string, string>)) expect(NOBLE.get(stem(s))!.map(name).join(''), s).toBe(bs);
    expect([...NOBLE.keys()]).toHaveLength(10);
    for (const [s, b] of Object.entries(T.luShen as Record<string, string>)) expect(name(LU.get(stem(s))!), s).toBe(b);
    for (const [s, b] of Object.entries(T.yangRen['yang stems (子平 school)'] as Record<string, string>)) expect(name(BLADE.get(stem(s))!), s).toBe(b);
    expect([...BLADE.keys()].map((k) => STEMS[k]!.hanzi)).toEqual(['甲', '丙', '戊', '庚', '壬']);
  });

  it('put the blade one branch after the 祿 for every yang stem, as the source says', () => {
    for (const [s, b] of BLADE) expect(b).toBe((LU.get(s)! + 1) % 12);
  });

  it('give 驛馬 and 咸池 by three-harmony group, for every branch', () => {
    const horse: Record<string, string> = { 寅午戌: '申', 申子辰: '寅', 巳酉丑: '亥', 亥卯未: '巳' };
    const peach: Record<string, string> = { 寅午戌: '卯', 巳酉丑: '午', 申子辰: '酉', 亥卯未: '子' };
    for (const [group, h] of Object.entries(horse)) for (const c of group) expect(name(horseOf(BRANCHES.findIndex((b) => b.hanzi === c)))).toBe(h);
    for (const [group, p] of Object.entries(peach)) for (const c of group) expect(name(peachOf(BRANCHES.findIndex((b) => b.hanzi === c)))).toBe(p);
  });
});

describe('the stars over a span', () => {
  const ctxOf = (id: string, sex: 'none' | 'male-chart' | 'female-chart' = 'none') => createContext(input(id, { sex }), DEFAULT_REGISTRY.builders);
  const binding = (id: string) => STAR_BINDINGS.find((b) => b.ruleId === id)!;

  it('flag exactly the annual pillars whose branch is the star branch, and no others', () => {
    const ctx = ctxOf('jiazi-1984');
    const dayStem = ctx.pillars().day.stem.index; // 己
    const lu = LU.get(dayStem)!;
    const fired = binding('bazi.lushen').fire(ctx, ruleOf('bazi.lushen')).filter((f) => f.startUtcMs !== null);
    const expected = ctx.annualPillars().filter((p) => p.cycle.branch.index === lu);
    expect(fired.map((f) => f.startUtcMs)).toEqual(expected.map((p) => p.startUtcMs));
    expect(expected.length).toBeGreaterThan(0);
    for (const f of fired) expect(f.clock).toBe('solar-longitude');
  });

  it('flag a luck pillar only when a sex convention gives the luck pillars', () => {
    const none = binding('bazi.lushen').fire(ctxOf('jiazi-1984'), ruleOf('bazi.lushen'));
    const male = binding('bazi.lushen').fire(ctxOf('jiazi-1984', 'male-chart'), ruleOf('bazi.lushen'));
    expect(none.some((f) => f.clock === 'luck')).toBe(false);
    expect(male.some((f) => f.clock === 'luck')).toBe(true);
  });

  it('give each star its own dedupe instance so that two bases and two windows stay apart', () => {
    const ctx = ctxOf('jiazi-1984', 'male-chart');
    for (const b of STAR_BINDINGS) {
      const fs = b.fire(ctx, ruleOf(b.ruleId));
      const keys = fs.flatMap((f) => (f.topics ?? ruleOf(b.ruleId).topics).map((t) => `${t}|${f.dedupeInstance}`));
      expect(new Set(keys).size, b.ruleId).toBe(keys.length);
    }
  });

  it('flag the void branches of the day pillar\'s ten-day cycle (戌 and 亥 for 己巳)', () => {
    const ctx = ctxOf('jiazi-1984');
    const fs = binding('bazi.kongwang').fire(ctx, ruleOf('bazi.kongwang'));
    expect(fs.length).toBeGreaterThan(0);
    for (const f of fs) expect(['戌', '亥']).toContain(factOf(f, 'branch'));
    const first = fs.find((f) => f.startUtcMs !== null)!;
    expect(sentenceOf('bazi.kongwang', first)).toMatch(/^[戌亥] is void \(空亡\) for the 己巳 day, so the incoming annual pillar palace is empty\.$/);
  });

  it('gives the blade no direction, and the sentence says which branch it is and where a 官殺 star stands', () => {
    const f = (p: ReturnType<typeof chart>) => fire('bazi.yangren', p);
    const say = (p: ReturnType<typeof chart>) => fillTemplate('bazi.yangren', ruleOf('bazi.yangren').template, f(p)[0]!.facts);
    expect(ruleOf('bazi.yangren').direction).toBe('activates');
    // 甲 day master with the blade 卯 in the month; strong, weak or held by a star, the firing gives no sign
    expect(assess(chart('甲寅', '乙卯', '甲寅', '乙亥')).strengthClass).toBe('strong');
    for (const p of [chart('甲寅', '乙卯', '甲寅', '乙亥'), chart('甲寅', '乙卯', '甲寅', '庚午'), chart('甲寅', '乙卯', '甲寅', '乙酉')]) {
      expect(f(p)).toHaveLength(1);
      expect(f(p)[0]!.direction).toBeUndefined();
    }
    // no 官殺 star at all; one revealed in a stem (庚); one only hidden in a branch (辛 in 酉)
    expect(say(chart('甲寅', '乙卯', '甲寅', '乙亥'))).toBe('卯 is the blade (羊刃) of the 甲 day master; no 官殺 star is in the chart.');
    expect(say(chart('甲寅', '乙卯', '甲寅', '庚午'))).toBe('卯 is the blade (羊刃) of the 甲 day master; a 官殺 star stands revealed in a stem of the chart.');
    expect(say(chart('甲寅', '乙卯', '甲寅', '乙酉'))).toBe('卯 is the blade (羊刃) of the 甲 day master; a 官殺 star is in the chart but only hidden in a branch.');
    // the sentence never speaks of excess or conflict, and the firing says that the source gives no sign
    expect(say(chart('甲寅', '乙卯', '甲寅', '庚午'))).not.toMatch(/excess|conflict/);
    expect(f(chart('甲寅', '乙卯', '甲寅', '庚午'))[0]!.badges).toContain('the source does not say when a 官殺 star holds the blade: no direction given');
    // a yin day master has no blade in this school
    expect(f(chart('丙寅', '乙卯', '乙酉', '丁卯'))).toEqual([]);
  });
});

describe('what is bound, withheld and covered', () => {
  it('binds the natal rules and the stars, and every other rule is bound or listed with its reason', () => {
    const ids = new Set(baziModule.BINDINGS.map((b) => b.ruleId));
    for (const id of [...NATAL_BINDINGS, ...STAR_BINDINGS].map((b) => b.ruleId)) expect(ids.has(id)).toBe(true);
    const natal = baziJson.rules.filter((r) => r.stage === 'natal-promise').map((r) => r.id);
    for (const id of natal) expect(ids.has(id) || baziModule.NOT_EVALUATED.some((n) => n.ruleId === id), id).toBe(true);
    // the period rules are bound by the second part (bazi-periods.test.ts); every rule of the file is accounted for
    for (const r of baziJson.rules) expect(ids.has(r.id) || baziModule.NOT_EVALUATED.some((n) => n.ruleId === r.id), r.id).toBe(true);
    expect(baziModule.COMPLETE).toBe(true);
  });

  it('prints a coverage that counts the bound rules per topic', () => {
    const r = report(DEFAULT_REGISTRY, { traditions: ['bazi'], sex: 'male', birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60 });
    expect(r.coverage.bazi.wealth).toBeGreaterThanOrEqual(4);
    expect(r.coverage.bazi.health).toBeGreaterThanOrEqual(2);
    const none = report(DEFAULT_REGISTRY, { traditions: ['bazi'], sex: null, birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60 });
    expect(none.coverage.bazi.relationships).toBeLessThan(r.coverage.bazi.relationships);
  });

  it('evaluates only the month state when no birth time is given, and says the others need it', () => {
    const res = evaluate(input('jiazi-1984', { minutes: null }), { traditions: ['bazi'], topics: ['general'], runs: 10 });
    expect(new Set(res.signals.map((s) => s.ruleId))).toEqual(new Set(['bazi.month-state']));
    const r = report(DEFAULT_REGISTRY, { traditions: ['bazi'], sex: null, birthTimeUncertaintyMinutes: null, birthTimeLimitMinutes: 60 });
    expect(r.statuses.find((s) => s.ruleId === 'bazi.strength-score')).toMatchObject({ state: 'withheld', reason: 'birth-time-uncertain' });
    expect(r.statuses.find((s) => s.ruleId === 'bazi.month-state')!.state).toBe('bound');
  });

  it('keeps natal signals out of every reading, since they carry no date', () => {
    const res = evaluate(input('jiazi-1984', { sex: 'male-chart' }), { traditions: ['bazi'], topics: ['wealth', 'career', 'health'], runs: 10 });
    const natal = res.signals.filter((s) => s.startUtcMs === null);
    expect(natal.length).toBeGreaterThan(0);
    const inReadings = new Set(res.readings.flatMap((r) => r.signalIds));
    for (const s of natal) expect(inReadings.has(s.id)).toBe(false);
  });

  it('passes the registry audit on every sample moment, with and without a sex convention and with an uncertain birth time', () => {
    for (const m of MOMENTS) {
      for (const sex of ['none', 'male-chart', 'female-chart'] as const) {
        const i = makeInput(makeMoment(m.civil, m.zone, m.place), { fromYear: 2031, toYear: 2040, forecastConventions: { baziSexConvention: sex } });
        expect(auditRegistry(DEFAULT_REGISTRY, i, { traditions: ['bazi'] }), `${m.id} ${sex}`).toEqual([]);
      }
    }
    const uncertain = makeInput(makeMoment(fixture('southern').civil, fixture('southern').zone, fixture('southern').place), { fromYear: 2031, toYear: 2035, birthTimeUncertaintyMinutes: 90 });
    expect(auditRegistry(DEFAULT_REGISTRY, uncertain, { traditions: ['bazi'] })).toEqual([]);
  });

  it('gives the same firings when the rule is evaluated twice, and every sentence is the template plus the facts', () => {
    for (const m of MOMENTS) {
      const ctx = createContext(makeInput(makeMoment(m.civil, m.zone, m.place), { fromYear: 2031, toYear: 2036, forecastConventions: { baziSexConvention: 'female-chart' } }), DEFAULT_REGISTRY.builders);
      for (const b of baziModule.BINDINGS) {
        const rule = ruleOf(b.ruleId);
        const first = b.fire(ctx, rule);
        expect(JSON.stringify(b.fire(ctx, rule))).toBe(JSON.stringify(first));
        const signals = signalsFromFirings(rule, first, { forecastConventions: ctx.input.forecastConventions, span: ctx.input.span });
        for (const s of signals) expect(s.sentence).toBe(fillTemplate(rule.id, rule.template, s.facts));
      }
    }
  });
});
