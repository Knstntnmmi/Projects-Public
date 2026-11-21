// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import baziJson from '../../src/forecast/data/rules.bazi.json' with { type: 'json' };
import { auditRegistry, DEFAULT_REGISTRY, evaluate, fillTemplate, makeInput, report, signalsFromFirings, type Firing } from '../../src/forecast/index.ts';
import { dedupe, tallyOf, wordFor } from '../../src/forecast/readings.ts';
import { bannedIn, MORTALITY_WORDS } from '../../src/forecast/phrasebook.ts';
import { remedyOf, coverCutOf, routeTopics, PALACE_TOPICS } from '../../src/forecast/predicates/bazi/periods.ts';
import * as baziModule from '../../src/forecast/predicates/bazi.ts';
import { BRANCHES, sixtyCycle, STEMS } from '../../src/systems/bazi/index.ts';
import { makeMoment } from '../../src/substrate/time.ts';
import { MOMENTS, fixture } from '../../../../fixtures/moments.ts';
import { assess, chart, cycleIndex, DAY_MS, factOf, firePeriod, periodContext, ruleOf, T0, yearAt, yearOfMs } from './bazi-charts.ts';

// Invented charts, read as a 甲 day master. S is strong (favourable: 火 土 金; unfavourable: 木 水),
// W is weak (favourable: 木 水; unfavourable: 火 土 金), B is balanced (no favourite at all).
const S = chart('甲寅', '乙卯', '甲寅', '己巳');
const W = chart('庚申', '庚申', '甲申', '庚午');
const B = chart('甲子', '丙寅', '己巳', '庚午');
const sentenceOf = (id: string, f: Firing): string => fillTemplate(id, ruleOf(id).template, f.facts);
const year = (pillar: string, d = 0, days = 365) => yearAt(pillar, d, days);
// strong, with wood and water only: no 財 at all, no earth, no remedy for fire
const PLAIN = chart('乙亥', '乙亥', '甲子', '乙亥');

describe('the charts these tests stand on', () => {
  it('are strong, weak and balanced as the tests assume', () => {
    expect(assess(S).strengthClass).toBe('strong');
    expect(assess(W).strengthClass).toBe('weak');
    expect(assess(B).strengthClass).toBe('balanced');
    expect(assess(S).favourites.favourable).toEqual(['Fire', 'Earth', 'Metal']);
    expect(assess(W).favourites.favourable).toEqual(['Wood', 'Water']);
  });
});

describe('bazi.luck-pillar-judgement', () => {
  const luck = (pillar: string) => periodContext(S, { sex: 'male', luck: [yearAt(pillar, 0, 3650)] });
  const fire = (pillar: string, chartOf = S) => firePeriod('bazi.luck-pillar-judgement', periodContext(chartOf, { sex: 'male', luck: [yearAt(pillar, 0, 3650)] }));

  it('calls a luck pillar good when branch and stem are both favourable, and prints the sentence', () => {
    const [f] = fire('丙午');
    expect(f!.direction).toBe('favourable');
    expect(f!.clock).toBe('luck');
    expect(f!.startUtcMs).toBe(T0);
    expect(sentenceOf('bazi.luck-pillar-judgement', f!)).toBe('The luck pillar 丙午 (食神/傷官) is good for this chart: the branch is favourable, the stem favourable.');
  });

  it('calls it bad when both are unfavourable', () => {
    const [f] = fire('壬子');
    expect(f!.direction).toBe('unfavourable');
    expect(sentenceOf('bazi.luck-pillar-judgement', f!)).toBe('The luck pillar 壬子 (偏印/正印) is bad for this chart: the branch is unfavourable, the stem unfavourable.');
  });

  it('weights the branch 0.6 and the stem 0.4, so a split pillar is mixed whichever half is favourable', () => {
    for (const p of ['丙子', '壬午']) {
      const [f] = fire(p);
      expect(f!.direction, p).toBe('mixed');
      expect(factOf(f!, 'grade')).toBe('mixed');
    }
    // 0.6 * 1 + 0.4 * -1 = 0.2, in tenths
    expect(factOf(fire('壬午')[0]!, 'score')).toBe(2);
  });

  it('says nothing for a balanced chart, and nothing without luck pillars', () => {
    expect(fire('丙午', B)).toEqual([]);
    expect(firePeriod('bazi.luck-pillar-judgement', periodContext(S, { sex: null, luck: [yearAt('丙午', 0, 3650)] }))).toEqual([]);
    expect(luck('丙午')).toBeTruthy();
  });

  it('is withheld without a sex convention and bound with one', () => {
    const none = report(DEFAULT_REGISTRY, { traditions: ['bazi'], sex: null, birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60 });
    expect(none.statuses.find((s) => s.ruleId === 'bazi.luck-pillar-judgement')).toMatchObject({ state: 'withheld' });
    const male = report(DEFAULT_REGISTRY, { traditions: ['bazi'], sex: 'male', birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60 });
    expect(male.statuses.find((s) => s.ruleId === 'bazi.luck-pillar-judgement')!.state).toBe('bound');
  });
});

describe('bazi.cover-cut', () => {
  const E = { wood: 'Wood', fire: 'Fire', earth: 'Earth', metal: 'Metal', water: 'Water' } as const;
  const tables = (baziJson.tables as any).coverCutByWantedElement as { gaiTou: Record<string, string>; jieJiao: Record<string, string> };

  it('reproduces every 蓋頭 pillar the source lists for each wanted element, by relation', () => {
    for (const [el, list] of Object.entries(tables.gaiTou)) {
      for (const name of list.split(' ')) {
        const hits = coverCutOf(sixtyCycle(cycleIndex(name)), [E[el as keyof typeof E]]);
        expect(hits.map((h) => h.kind), `${name} wanting ${el}`).toContain('蓋頭');
      }
    }
  });

  it('reproduces every 截腳 pillar the source lists for each wanted element, by relation', () => {
    for (const [el, list] of Object.entries(tables.jieJiao)) {
      for (const name of list.split(' ')) {
        const hits = coverCutOf(sixtyCycle(cycleIndex(name)), [E[el as keyof typeof E]]);
        expect(hits.map((h) => h.kind), `${name} wanting ${el}`).toContain('截腳');
      }
    }
  });

  it('lets one pillar be 蓋頭 for one wanted element and 截腳 for another', () => {
    // 丙申: metal under a fire stem is covered when metal is wanted, and the fire stem is cut when fire is wanted
    const c = sixtyCycle(cycleIndex('丙申'));
    expect(coverCutOf(c, ['Metal']).map((h) => h.kind)).toEqual(['蓋頭']);
    expect(coverCutOf(c, ['Fire']).map((h) => h.kind)).toEqual(['截腳']);
  });

  it('does not cut a stem that sits on its own element or on the element that makes it', () => {
    expect(coverCutOf(sixtyCycle(cycleIndex('甲寅')), ['Wood'])).toEqual([]);
    expect(coverCutOf(sixtyCycle(cycleIndex('甲子')), ['Wood'])).toEqual([]);
    expect(coverCutOf(sixtyCycle(cycleIndex('丙午')), ['Fire'])).toEqual([]);
  });

  it('fires on a luck pillar that cuts a wanted stem, with the sentence, and halves the force', () => {
    expect(assess(PLAIN).strengthClass).toBe('strong');
    const ctx = periodContext(PLAIN, { sex: 'male', luck: [yearAt('庚午', 0, 3650)] });
    const [f] = firePeriod('bazi.cover-cut', ctx);
    expect(sentenceOf('bazi.cover-cut', f!)).toBe('庚午 is 截腳 (cut): the stem 庚 (Metal 金) is weakened by the branch 午 (Fire 火).');
    expect(factOf(f!, 'multiplier')).toBe(0.5);
    expect(f!.direction).toBeUndefined(); // the rule's own direction, mixed, is not altered
  });

  it('halves the loss again where a natal stem holds a remedy', () => {
    // a 己 stem drains the fire that cuts the metal
    expect(remedyOf(assess(S), 'Fire')).toBe('己');
    expect(remedyOf(assess(PLAIN), 'Fire')).toBeNull(); // no natal stem is water or earth
    expect(remedyOf(assess(W), 'Fire')).toBeNull(); // W holds only 庚 and 甲
    const [f] = firePeriod('bazi.cover-cut', periodContext(S, { sex: 'male', luck: [yearAt('庚午', 0, 3650)] }));
    expect(factOf(f!, 'remedy')).toBe('己: the loss is halved again');
    expect(factOf(f!, 'multiplier')).toBe(0.25);
  });

  it('says nothing for a pillar that cuts nothing wanted, and nothing for a balanced chart', () => {
    expect(firePeriod('bazi.cover-cut', periodContext(S, { sex: 'male', luck: [yearAt('丙午', 0, 3650)] }))).toEqual([]);
    expect(firePeriod('bazi.cover-cut', periodContext(B, { sex: 'male', luck: [yearAt('庚午', 0, 3650)] }))).toEqual([]);
  });
});

describe('bazi.year-judgement', () => {
  it('weights the stem 0.6 and the branch 0.4, names the year and combines with the luck grade', () => {
    const ctx = periodContext(S, { sex: 'male', luck: [yearAt('丙午', -1000, 3650)], years: [yearAt('丙午', 0, 365)] });
    const [f] = firePeriod('bazi.year-judgement', ctx);
    expect(f!.direction).toBe('favourable');
    expect(sentenceOf('bazi.year-judgement', f!)).toBe(`The ${yearOfMs(T0)} year (丙午) brings 食神 (stem) and 傷官 (branch), favourable for this chart; the luck pillar is good, so this is a supported year.`);
  });

  it('calls two bad halves a doubly bad year', () => {
    const ctx = periodContext(S, { sex: 'male', luck: [yearAt('壬子', -1000, 3650)], years: [yearAt('甲子', 0, 365)] });
    const [f] = firePeriod('bazi.year-judgement', ctx);
    expect(f!.direction).toBe('unfavourable');
    expect(sentenceOf('bazi.year-judgement', f!)).toContain('the luck pillar is bad, so this is a doubly bad year.');
  });

  it('cuts a year at the luck pillar boundary, so each stretch is read against the pillar that holds', () => {
    const ctx = periodContext(S, { sex: 'male', luck: [yearAt('丙午', -1000, 1100), yearAt('壬子', 100, 3650)], years: [yearAt('戊辰', 0, 365)] });
    const fs = firePeriod('bazi.year-judgement', ctx);
    expect(fs).toHaveLength(2);
    expect(fs.map((f) => [f.startUtcMs, f.endUtcMs])).toEqual([
      [T0, T0 + 100 * DAY_MS],
      [T0 + 100 * DAY_MS, T0 + 365 * DAY_MS],
    ]);
    expect(factOf(fs[0]!, 'luckGrade')).toBe('good, so this is a supported year');
    expect(factOf(fs[1]!, 'luckGrade')).toBe('bad');
  });

  it('reads the year alone, and says why the luck pillar was not read, without a sex convention', () => {
    const [f] = firePeriod('bazi.year-judgement', periodContext(S, { years: [year('丙午')] }));
    expect(factOf(f!, 'luckGrade')).toBe('not read, because no sex convention gives the luck pillars their direction');
  });

  it('is silent for a balanced chart', () => {
    expect(firePeriod('bazi.year-judgement', periodContext(B, { sex: 'male', luck: [yearAt('丙午', -9, 3650)], years: [year('丙午')] }))).toEqual([]);
  });
});

describe('bazi.sui-yun-bing-lin', () => {
  const run = (yearPillar: string, luckPillar: string, fc: object = {}, chartOf = S) =>
    firePeriod('bazi.sui-yun-bing-lin', periodContext(chartOf, { sex: 'male', luck: [yearAt(luckPillar, -10, 3650)], years: [year(yearPillar)], fc }));

  it('fires only where the year pillar equals the luck pillar', () => {
    expect(run('庚申', '庚午')).toEqual([]);
    expect(run('庚申', '庚申')).toHaveLength(1);
  });

  it('signs by the ten god as the source gives it: 七殺 bad, 印 and 財 good, 比劫 and 食傷 unsigned', () => {
    const [bad] = run('庚申', '庚申');
    expect(bad!.direction).toBe('unfavourable');
    expect(sentenceOf('bazi.sui-yun-bing-lin', bad!)).toBe('The year pillar repeats the luck pillar 庚申, which is a 七殺 for the day master: bad (ten-god sign of the source).');
    const [good] = run('壬申', '壬申');
    expect(good!.direction).toBe('favourable');
    expect(factOf(good!, 'tenGod')).toBe('偏印');
    const [peer] = run('甲子', '甲子');
    expect(peer!.direction).toBe('activates');
    expect(factOf(peer!, 'goodOrBad')).toBe('unsigned');
    const [output] = run('丙午', '丙午');
    expect(output!.direction).toBe('activates');
  });

  it('treats the blade branch as 羊刃, which is bad', () => {
    // the blade of 甲 is 卯; 己卯 has a 財 stem and the blade branch
    const [f] = run('己卯', '己卯');
    expect(factOf(f!, 'tenGod')).toBe('羊刃');
    expect(f!.direction).toBe('unfavourable');
  });

  it('names the sign convention used, and the favourable-element alternative can disagree with the source', () => {
    const [byGods] = run('庚申', '庚申');
    const [byElement] = run('庚申', '庚申', { suiYunSign: 'favourable-element' });
    expect(byGods!.direction).toBe('unfavourable');
    expect(byElement!.direction).toBe('favourable'); // 庚 is metal, favourable for the strong chart S
    expect(factOf(byElement!, 'signConvention')).toBe('favourable-element sign');
    expect(byElement!.conventionsUsed).toContain('suiYunSign');
  });

  it('is withheld without a sex convention', () => {
    expect(firePeriod('bazi.sui-yun-bing-lin', periodContext(S, { sex: null, luck: [yearAt('庚申', 0, 3650)], years: [year('庚申')] }))).toEqual([]);
  });
});

describe('bazi.tian-ke-di-chong', () => {
  const run = (luckPillar: string, yearPillar: string, chartOf = S) => firePeriod('bazi.tian-ke-di-chong', periodContext(chartOf, { sex: 'male', luck: [yearAt(luckPillar, -10, 3650)], years: [year(yearPillar)] }));

  it('fires only when a stem overcomes the other and the branches clash', () => {
    expect(run('庚午', '甲子')).toHaveLength(1);
    expect(run('庚午', '乙卯')).toEqual([]); // 午 and 卯 do not clash
    expect(run('丙子', '丙午')).toEqual([]); // the branches clash, the stems are equal
    expect(run('庚午', '壬子')).toEqual([]); // 庚 makes 壬, it does not overcome it
  });

  it('applies the day master test first: a strong chart takes no harm', () => {
    const [f] = run('庚午', '甲子', S);
    expect(f!.direction).toBe('activates');
    expect(sentenceOf('bazi.tian-ke-di-chong', f!)).toBe('Luck 庚午 and year 甲子 are in 天剋地沖: the luck pillar 庚午 strikes the year pillar 甲子; because Wood 木 is not weighed, since the day master is strong, it is no harm.');
  });

  it('for a weak chart signs by whether the struck element is favourable: struck favourable is bad, struck unfavourable good', () => {
    const [bad] = run('庚午', '甲子', W);
    expect(bad!.direction).toBe('unfavourable');
    expect(sentenceOf('bazi.tian-ke-di-chong', bad!)).toBe('Luck 庚午 and year 甲子 are in 天剋地沖: the luck pillar 庚午 strikes the year pillar 甲子; because Wood 木 is favourable, it is bad.');
    const [good] = run('壬子', '丙午', W);
    expect(good!.direction).toBe('favourable');
    expect(factOf(good!, 'goodOrBad')).toBe('good');
  });

  it('names the year as the striker when the year stem overcomes the luck stem', () => {
    const [f] = run('甲子', '庚午', W);
    expect(factOf(f!, 'striker')).toBe('the year pillar 庚午');
    expect(f!.direction).toBe('unfavourable'); // wood, the struck luck stem, is favourable for W
  });

  it('gives a balanced chart no sign', () => {
    const [f] = run('庚午', '甲子', B);
    expect(f!.direction).toBe('activates');
    expect(factOf(f!, 'goodOrBad')).toBe('not signed');
  });
});

describe('bazi.year-vs-day-clash', () => {
  const run = (yearPillar: string, chartOf: ReturnType<typeof chart>) => firePeriod('bazi.year-vs-day-clash', periodContext(chartOf, { years: [year(yearPillar)] }));

  it('fires when the day stem overcomes the year stem, and not when the year stem overcomes the day stem', () => {
    expect(run('戊辰', S)).toHaveLength(1);
    expect(run('庚申', S)).toEqual([]); // 歲君犯日: the template has no sentence for it, so the rule does not fire for it
    expect(run('丙午', S)).toEqual([]);
  });

  it('signs by the strength of the day master: a harm for a weak one, no harm for a strong one', () => {
    const [weak] = run('戊辰', W);
    expect(weak!.direction).toBe('unfavourable');
    expect(sentenceOf('bazi.year-vs-day-clash', weak!)).toBe('甲 overcomes the year stem 戊: the day master offends the year, which is a harm, since the day master is weak.');
    const [strong] = run('戊辰', S);
    expect(strong!.direction).toBe('activates');
    expect(sentenceOf('bazi.year-vs-day-clash', strong!)).toContain('without harm, since the day master is strong');
  });
});

describe('bazi.hui-he-year', () => {
  const day = chart('甲寅', '乙卯', '甲子', '乙亥');
  const run = (yearPillar: string) => firePeriod('bazi.hui-he-year', periodContext(day, { years: [year(yearPillar)] }));

  it('fires only when the stem and the branch of the year both combine with the day pillar', () => {
    const [f] = run('己丑');
    expect(sentenceOf('bazi.hui-he-year', f!)).toBe('The year pillar 己丑 combines with the day pillar 甲子: a year of delay (晦).');
    expect(run('己未')).toEqual([]); // the stems combine, the branches do not
    expect(run('丁丑')).toEqual([]); // the branches combine, the stems do not
  });
});

describe('bazi.fan-yin-fu-yin', () => {
  const day = chart('甲寅', '乙卯', '甲子', '乙亥');
  const run = (yearPillar: string, luckPillar?: string) => firePeriod('bazi.fan-yin-fu-yin', periodContext(day, { sex: luckPillar ? 'male' : null, luck: luckPillar ? [yearAt(luckPillar, -9, 3650)] : [], years: [year(yearPillar)] }));

  it('finds 伏吟 where the pillar repeats the day pillar', () => {
    const [f] = run('甲子');
    expect(sentenceOf('bazi.fan-yin-fu-yin', f!)).toBe('The year pillar 甲子 is a 伏吟 (repetition) of the day pillar 甲子.');
    expect(f!.topics).toBeUndefined(); // the rule's own topics: relationships and wealth
  });

  it('finds 反吟 where the branch clashes and the stem is four or six places away, in either direction', () => {
    expect(run('庚午')).toHaveLength(1); // 甲 to 庚 is six places
    expect(run('戊午')).toHaveLength(1); // 甲 to 戊 is four places
    expect(factOf(run('庚午')[0]!, 'fuOrFan')).toBe('反吟 (opposition)');
    expect(run('丙午')).toEqual([]); // two places
    expect(run('庚子')).toEqual([]); // not clashing: the same branch
  });

  it('reads luck pillars as well as years', () => {
    const fs = run('丙寅', '庚午');
    expect(fs).toHaveLength(1);
    expect(fs[0]!.clock).toBe('luck');
  });

  it('counts the branch half once with the clash of the day branch', () => {
    const ctx = periodContext(day, { years: [year('庚午')] });
    const fan = signalsFromFirings(ruleOf('bazi.fan-yin-fu-yin'), firePeriod('bazi.fan-yin-fu-yin', ctx), { forecastConventions: ctx.input.forecastConventions, span: { startUtcMs: T0 - DAY_MS, endUtcMs: T0 + 400 * DAY_MS } });
    const chong = signalsFromFirings(ruleOf('bazi.branch-chong'), firePeriod('bazi.branch-chong', ctx), { forecastConventions: ctx.input.forecastConventions, span: { startUtcMs: T0 - DAY_MS, endUtcMs: T0 + 400 * DAY_MS } });
    const dayChong = chong.filter((s) => s.topic === 'relationships');
    expect(dayChong).toHaveLength(1);
    const same = fan.find((s) => s.topic === 'relationships')!;
    expect(same.dedupeKey).toBe(dayChong[0]!.dedupeKey);
    const { kept, alsoReportedBy } = dedupe([...dayChong, same]);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.ruleId).toBe('bazi.branch-chong'); // the larger ordering key
    expect(Object.values(alsoReportedBy).flat()).toEqual([same.id]);
  });
});

describe('the topic arrival rules', () => {
  const run = (id: string, chartOf: ReturnType<typeof chart>, yearPillar: string, sex: 'male' | 'female' | null = null, luckPillar?: string) =>
    firePeriod(id, periodContext(chartOf, { sex, luck: luckPillar ? [yearAt(luckPillar, -9, 3650)] : [], years: [year(yearPillar)] }));

  describe('bazi.wealth-star-in-luck', () => {
    it('is favourable when 財 arrives in a favourable element and the natal wealth is not absent', () => {
      const [f] = run('bazi.wealth-star-in-luck', S, '己丑');
      expect(f!.direction).toBe('favourable');
      expect(sentenceOf('bazi.wealth-star-in-luck', f!)).toBe('The year pillar 己丑 brings 正財 (stem), 正財 (main qi of the branch) (財) in a favoured element: a good period for wealth.');
      expect(f!.badges!.join(' ')).not.toMatch(/weight/);
    });

    it('is unfavourable when the 財 element is unfavourable', () => {
      const [f] = run('bazi.wealth-star-in-luck', W, '己丑');
      expect(f!.direction).toBe('unfavourable');
      expect(factOf(f!, 'goodOrBad')).toBe('bad');
    });

    it('prints no weight on a badge, whichever half brings the 財, and marks 食傷 beside a favourable 財', () => {
      for (const y of ['己丑', '乙丑', '己卯']) expect((run('bazi.wealth-star-in-luck', S, y)[0]!.badges ?? []).join(' '), y).not.toMatch(/weight|strength/);
      expect(run('bazi.wealth-star-in-luck', S, '乙丑')[0]!.direction).toBe('favourable');
      expect(run('bazi.wealth-star-in-luck', S, '己卯')[0]!.direction).toBe('favourable');
      expect(run('bazi.wealth-star-in-luck', S, '丁丑')[0]!.badges).toContain('食傷 beside it strengthens the source of wealth');
    });

    it('says nothing when no clause of the condition holds: a balanced chart, or a favourite with no natal wealth', () => {
      expect(run('bazi.wealth-star-in-luck', B, '己丑')).toEqual([]);
      expect(assess(PLAIN).favourites.favourable).toContain('Earth');
      expect(run('bazi.wealth-star-in-luck', PLAIN, '己丑')).toEqual([]);
    });

    it('reads luck pillars too, with their own clock and window', () => {
      const fs = run('bazi.wealth-star-in-luck', S, '丙午', 'male', '己丑');
      expect(fs).toHaveLength(1);
      expect(fs[0]!.clock).toBe('luck');
      expect(sentenceOf('bazi.wealth-star-in-luck', fs[0]!)).toMatch(/^The luck pillar 己丑 brings/);
    });
  });

  describe('bazi.officer-star-in-luck', () => {
    it('is favourable career when 官殺 arrives in a favourable element and the natal grade is not mixed or overpowering', () => {
      const [f] = run('bazi.officer-star-in-luck', S, '庚申');
      expect(f!.direction).toBe('favourable');
      expect(f!.topics).toEqual(['career']);
      expect(sentenceOf('bazi.officer-star-in-luck', f!)).toBe('The year pillar 庚申 brings 七殺 (stem), 七殺 (main qi of the branch) (官殺) in a favoured element: a good period for career.');
    });

    it('is unfavourable in an unfavourable element', () => {
      expect(run('bazi.officer-star-in-luck', W, '庚申')[0]!.direction).toBe('unfavourable');
    });

    it('flags 官殺混雜 where the arrival adds the other of 正官 and 七殺, and says both clauses hold', () => {
      const [f] = run('bazi.officer-star-in-luck', S, '辛酉'); // 正官 arrives in a chart that holds 七殺
      expect(f!.direction).toBe('mixed');
      expect(f!.badges).toContain('官殺混雜: the arrival adds the other of 正官 and 七殺 to the chart');
    });

    it('reads mixed, and names both clauses in the sentence, when a favoured element and a 官殺混雜 hold together; it picks no winner', () => {
      const [f] = run('bazi.officer-star-in-luck', S, '辛酉');
      expect(sentenceOf('bazi.officer-star-in-luck', f!)).toBe(
        'The year pillar 辛酉 brings 正官 (stem), 正官 (main qi of the branch) (官殺) in a favoured element: a mixed period for career (two clauses hold: the element is favoured, and the arrival mixes 正官 with 七殺 (官殺混雜); the source does not say which prevails).',
      );
      // a woman's reading says the same for the husband star
      const [w] = run('bazi.officer-star-in-luck', S, '辛酉', 'female');
      expect(w!.direction).toBe('mixed');
      expect(sentenceOf('bazi.officer-star-in-luck', w!)).toMatch(/which prevails\), and for a woman it is also the husband star\.$/);
    });

    it('gives the same outcome for every class of chart: the word is mixed exactly where both clauses hold, whatever the chart', () => {
      // every year pillar, for a strong, a weak and a balanced chart, and for either sex convention
      const counts = { strong: 0, weak: 0, balanced: 0 };
      for (const [name, c] of [['strong', S], ['weak', W], ['balanced', B]] as const) {
        for (let i = 0; i < 60; i++) {
          const y = sixtyCycle(i).hanzi;
          for (const sex of [null, 'female'] as const) {
            for (const f of run('bazi.officer-star-in-luck', c, y, sex)) {
              const both = (f.badges ?? []).some((b) => b.startsWith('both clauses hold'));
              expect(f.direction === 'mixed', `${name} ${y}`).toBe(both);
              const said = sentenceOf('bazi.officer-star-in-luck', f);
              expect(said.includes('the source does not say which prevails'), `${name} ${y}`).toBe(both);
              if (both) {
                expect(said).toContain('the element is favoured');
                expect(said).toContain('官殺混雜');
                counts[name]++;
              }
            }
          }
        }
      }
      // the strong chart likes 官殺, so it reaches both clauses; the others never do, and their mixing alone is unfavourable
      expect(counts.strong).toBeGreaterThan(0);
      expect(counts.balanced).toBe(0);
      expect(assess(S).strengthClass).toBe('strong');
      expect(run('bazi.officer-star-in-luck', W, '辛酉')[0]!.direction).toBe('unfavourable');
    });

    it('also reads relationships for a woman, deduped with the career reading by the shared key', () => {
      const [f] = run('bazi.officer-star-in-luck', S, '庚申', 'female');
      expect(f!.topics).toEqual(['career', 'relationships']);
      expect(sentenceOf('bazi.officer-star-in-luck', f!)).toMatch(/period for career, and for a woman it is also the husband star\.$/);
    });
  });

  describe('bazi.resource-in-luck', () => {
    it('is good in a favourable element and bad in an unfavourable one, and silent for a balanced chart', () => {
      const [bad] = run('bazi.resource-in-luck', S, '壬子');
      expect(bad!.direction).toBe('unfavourable');
      expect(sentenceOf('bazi.resource-in-luck', bad!)).toBe('The year pillar 壬子 brings 偏印 (stem), 正印 (main qi of the branch) (印) in a disliked element: a bad period for learning and support.');
      expect(run('bazi.resource-in-luck', W, '壬子')[0]!.direction).toBe('favourable');
      expect(run('bazi.resource-in-luck', B, '丙午')).toEqual([]);
    });
  });

  describe('bazi.output-in-luck', () => {
    it('signs 食傷 by the favourable element for career, relationships and wealth', () => {
      const [f] = run('bazi.output-in-luck', S, '丙午');
      expect(f!.direction).toBe('favourable');
      expect(f!.topics).toEqual(['career', 'relationships', 'wealth']);
      expect(sentenceOf('bazi.output-in-luck', f!)).toBe('The year pillar 丙午 brings 食神 (stem), 傷官 (main qi of the branch) (食傷) in a favoured element: productive for a strong day master.');
      expect(run('bazi.output-in-luck', W, '丙午')[0]!.direction).toBe('unfavourable');
    });

    it('reads 傷官見官 as unfavourable for a woman\'s marriage only, and needs no sex convention otherwise', () => {
      const fs = run('bazi.output-in-luck', B, '庚申', 'female'); // 傷官 arrives in a chart with 正官; balanced, so no other sign
      expect(fs).toHaveLength(1);
      expect(fs[0]!.topics).toEqual(['relationships']);
      expect(fs[0]!.direction).toBe('unfavourable');
      expect(sentenceOf('bazi.output-in-luck', fs[0]!)).toContain("傷官 meets the natal 正官 (傷官見官), unfavourable for a woman's marriage");
      expect(run('bazi.output-in-luck', B, '庚申', 'male')).toEqual([]);
      expect(run('bazi.output-in-luck', B, '庚申', null)).toEqual([]);
      expect(run('bazi.output-in-luck', S, '丙午', null)).toHaveLength(1);
      expect(baziModule.BINDINGS.find((b) => b.ruleId === 'bazi.output-in-luck')!.requires).toMatchObject({ sex: false });
    });
  });

  describe('bazi.peer-in-luck', () => {
    it('is supportive in a favourable element, for relationships and for wealth', () => {
      const fs = run('bazi.peer-in-luck', W, '甲子');
      expect(fs.map((f) => f.topics)).toEqual([['relationships'], ['wealth']]);
      expect(fs.every((f) => f.direction === 'favourable')).toBe(true);
    });

    it('is a rivalry for wealth in an unfavourable element when 財 is in the chart', () => {
      const [f] = run('bazi.peer-in-luck', S, '甲子');
      expect(f!.topics).toEqual(['wealth']);
      expect(f!.direction).toBe('unfavourable');
      expect(sentenceOf('bazi.peer-in-luck', f!)).toContain('rivalry for wealth');
    });

    it('is silent in an unfavourable element when the chart holds no 財', () => {
      expect(run('bazi.peer-in-luck', PLAIN, '甲子')).toEqual([]);
    });

    it('does not merge a peer star with a wealth star of the same pillar: they are two facts and the plain count says so', () => {
      // 己卯 for a strong 甲: 己 is 正財 (stem), and the main qi of 卯 is 乙, 劫財 (branch)
      const wealth = run('bazi.wealth-star-in-luck', S, '己卯')[0]!;
      const peer = run('bazi.peer-in-luck', S, '己卯').find((f) => f.topics![0] === 'wealth')!;
      expect(wealth.direction).toBe('favourable');
      expect(peer.direction).toBe('unfavourable');
      expect(ruleOf('bazi.wealth-star-in-luck').dedupeKey).not.toBe(ruleOf('bazi.peer-in-luck').dedupeKey);
      const o = { forecastConventions: periodContext(S, { years: [year('己卯')] }).input.forecastConventions, span: { startUtcMs: T0 - DAY_MS, endUtcMs: T0 + 400 * DAY_MS } };
      const signals = [...signalsFromFirings(ruleOf('bazi.wealth-star-in-luck'), [wealth], o), ...signalsFromFirings(ruleOf('bazi.peer-in-luck'), [peer], o)].filter((s) => s.topic === 'wealth');
      expect(signals).toHaveLength(2);
      const { kept, alsoReportedBy } = dedupe(signals);
      expect(kept).toHaveLength(2);
      expect(alsoReportedBy).toEqual({});
      expect(wordFor(kept)).toEqual({ word: 'mixed', note: 'rules conflict' });
      expect(tallyOf(kept)).toEqual({ supports: 1, cautions: 1, mixed: 0, active: 0 });
    });

    it('reads 劫財 over a natal 正財 as a wealth loss, and says so when it is also supportive', () => {
      expect(run('bazi.peer-in-luck', S, '乙卯')[0]!.direction).toBe('unfavourable');
      const both = run('bazi.peer-in-luck', W, '乙卯').find((f) => f.topics![0] === 'wealth')!;
      expect(both.direction).toBe('mixed');
      expect(both.badges!.join(' ')).toContain('both clauses hold');
    });
  });

  it('keeps each arrival rule off the topics the other rules own', () => {
    // the general rules list only general; the arrival rules list no general
    for (const id of ['bazi.luck-pillar-judgement', 'bazi.cover-cut', 'bazi.year-judgement']) expect(ruleOf(id).topics).toEqual(['general']);
    for (const id of ['bazi.wealth-star-in-luck', 'bazi.officer-star-in-luck', 'bazi.resource-in-luck', 'bazi.output-in-luck', 'bazi.peer-in-luck']) expect(ruleOf(id).topics).not.toContain('general');
  });
});

describe('the palace table and the relation rules', () => {
  const run = (id: string, chartOf: ReturnType<typeof chart>, yearPillar: string, sex: 'male' | 'female' | null = null) => firePeriod(id, periodContext(chartOf, { sex, years: [year(yearPillar)] }));

  it('states the palace table as the rule file does: year, month, day and hour', () => {
    expect(PALACE_TOPICS).toEqual({ year: ['home-travel', 'general'], month: ['career', 'home-travel'], day: ['relationships', 'health'], hour: ['relationships', 'career'] });
    const cond: string = baziJson.rules.find((r) => r.id === 'bazi.pillar-palaces')!.condition;
    expect(cond).toContain('year branch -> home-travel, general; month branch -> career, home-travel; day branch -> relationships, health; hour branch -> relationships, career');
  });

  it('routes a topic by the struck palace, keeping only topics the rule lists, and falls back to general with a badge', () => {
    expect(routeTopics('day', ['general', 'relationships', 'career', 'home-travel']).topics).toEqual(['relationships']);
    expect(routeTopics('month', ['general', 'relationships'])).toMatchObject({ topics: ['general'] });
    expect(routeTopics('month', ['general', 'relationships']).badges.join(' ')).toContain('outside this rule');
  });

  describe('bazi.branch-chong', () => {
    it('fires for each natal branch the incoming branch clashes, with the topic of that palace', () => {
      const fs = run('bazi.branch-chong', S, '庚申'); // 申 clashes 寅 in the year and in the day pillars
      expect(fs.map((f) => f.topics)).toEqual([['home-travel', 'general'], ['relationships']]);
      expect(sentenceOf('bazi.branch-chong', fs[0]!)).toBe('The 申 year pillar clashes the natal year branch 寅 (ancestors).');
      expect(sentenceOf('bazi.branch-chong', fs[1]!)).toBe('The 申 year pillar clashes the natal day branch 寅 (spouse).');
    });

    it('routes the month and the hour palaces to their own topics', () => {
      expect(run('bazi.branch-chong', S, '辛酉')[0]!.topics).toEqual(['career', 'home-travel']); // 酉 clashes 卯 in the month
      expect(run('bazi.branch-chong', S, '乙亥')[0]!.topics).toEqual(['relationships', 'career']); // 亥 clashes 巳 in the hour
    });

    it('signs by the main qi of the struck branch: removing a favourite is unfavourable, removing a dislike favourable', () => {
      // 寅's main qi is 甲 wood: an unfavourite of the strong chart S, a favourite of the weak chart W
      expect(run('bazi.branch-chong', S, '庚申')[0]!.direction).toBe('favourable');
      const w = chart('庚寅', '庚申', '甲寅', '庚午');
      expect(assess(w).strengthClass).toBe('weak');
      expect(run('bazi.branch-chong', w, '庚申')[0]!.direction).toBe('unfavourable');
    });

    it('gives a balanced chart no sign, and fires nothing when nothing clashes', () => {
      const [f] = run('bazi.branch-chong', B, '戊午'); // 午 clashes 子
      expect(f!.direction).toBe('activates');
      expect(run('bazi.branch-chong', S, '丙午')).toEqual([]);
    });

    it('shares the day palace window with the day clash note and gives the other palaces their own instance', () => {
      const [year_, day] = run('bazi.branch-chong', S, '庚申');
      expect(year_!.dedupeInstance).toMatch(/:year$/);
      expect(day!.dedupeInstance).toBeUndefined();
    });
  });

  describe('bazi.branch-liuhe', () => {
    it('flags a combination with the natal palace it ties, without a sign', () => {
      const fs = run('bazi.branch-liuhe', S, '乙亥'); // 亥 combines with 寅 in the year and day pillars
      expect(fs).toHaveLength(2);
      expect(fs[0]!.direction).toBeUndefined();
      expect(sentenceOf('bazi.branch-liuhe', fs[0]!)).toBe('The 亥 branch combines with the natal year branch 寅, tying the ancestors.');
      expect(sentenceOf('bazi.branch-liuhe', fs[1]!)).toBe('The 亥 branch combines with the natal day branch 寅, tying the spouse.');
    });

    it('lists a combination and a clash of one incoming branch together and signs neither', () => {
      const fs = run('bazi.branch-liuhe', S, '庚申'); // 申 combines with 巳 and clashes 寅
      expect(fs).toHaveLength(1);
      expect(fs[0]!.badges!.join(' ')).toContain('also clashes the natal year and day branch');
    });

    it('reads the month palace as general with a badge, because career and home are not among its topics', () => {
      const [f] = run('bazi.branch-liuhe', S, '戊戌'); // 戌 combines with 卯 in the month
      expect(f!.topics).toEqual(['general']);
      expect(f!.badges!.join(' ')).toContain('read as general');
    });
  });

  describe('bazi.branch-sanhe', () => {
    const chartFire = chart('甲寅', '乙卯', '甲午', '乙亥');

    it('completes a group the natal chart holds two of, and signs by the group element', () => {
      const a = assess(chartFire);
      expect(a.strengthClass).toBe('strong');
      const [f] = run('bazi.branch-sanhe', chartFire, '甲戌');
      expect(sentenceOf('bazi.branch-sanhe', f!)).toBe('The incoming 戌 completes the 寅午戌 group (Fire) with the natal 寅 (year) and 午 (day).');
      expect(f!.direction).toBe('favourable'); // fire is a favourite of the strong chart
      expect(run('bazi.branch-sanhe', B, '戊戌')[0]!.direction).toBe('activates'); // balanced: no favourite
    });

    it('does not fire when a member is missing or the natal chart already holds the incoming branch', () => {
      expect(run('bazi.branch-sanhe', S, '甲戌')).toEqual([]); // only 寅 of 寅午戌
      expect(run('bazi.branch-sanhe', chart('甲寅', '甲戌', '甲午', '乙亥'), '甲戌')).toEqual([]);
    });
  });

  describe('bazi.day-clash-spouse', () => {
    it('notes a clash or combination of the day branch, void status and whether the spouse star arrives', () => {
      const [f] = run('bazi.day-clash-spouse', S, '戊申', 'male');
      expect(sentenceOf('bazi.day-clash-spouse', f!)).toBe("The day branch 寅 is the spouse palace (clashed by the year pillar 戊申; the day branch is not void (空亡) in the year pillar's cycle; the arrival brings 財, the wife star).");
      const [g] = run('bazi.day-clash-spouse', S, '庚申', 'female');
      expect(factOf(g!, 'note')).toContain('brings 官殺, the husband star');
      const [h] = run('bazi.day-clash-spouse', S, '乙亥', 'male');
      expect(factOf(h!, 'note')).toContain('combined by the year pillar 乙亥');
      expect(factOf(h!, 'note')).toContain('does not bring 財, the wife star');
    });

    it('is silent when the day branch is not touched, and needs a sex convention', () => {
      expect(run('bazi.day-clash-spouse', S, '丙午', 'male')).toEqual([]);
      expect(baziModule.BINDINGS.find((b) => b.ruleId === 'bazi.day-clash-spouse')!.requires?.sex).toBe(true);
    });
  });
});

describe('what is bound, listed and withheld in the finished tradition', () => {
  it('has every rule of the file bound or listed, and the module declares itself complete', () => {
    const bound = new Set(baziModule.BINDINGS.map((b) => b.ruleId));
    const listed = new Set(baziModule.NOT_EVALUATED.map((n) => n.ruleId));
    for (const r of baziJson.rules) expect(bound.has(r.id) !== listed.has(r.id), r.id).toBe(true);
    expect([...listed].sort()).toEqual(['bazi.pillar-palaces', 'bazi.topic-spouse-woman']);
    expect(baziModule.COMPLETE).toBe(true);
    expect(baziJson.rules).toHaveLength(bound.size + listed.size);
  });

  it('withholds every luck-pillar rule without a sex convention and says so', () => {
    const none = report(DEFAULT_REGISTRY, { traditions: ['bazi'], sex: null, birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60 });
    for (const id of ['bazi.luck-pillar-judgement', 'bazi.cover-cut', 'bazi.sui-yun-bing-lin', 'bazi.tian-ke-di-chong', 'bazi.day-clash-spouse', 'bazi.topic-spouse-man', 'bazi.topic-children']) {
      expect(none.statuses.find((s) => s.ruleId === id), id).toMatchObject({ state: 'withheld' });
    }
    for (const id of ['bazi.year-judgement', 'bazi.fan-yin-fu-yin', 'bazi.branch-chong', 'bazi.wealth-star-in-luck', 'bazi.output-in-luck']) {
      expect(none.statuses.find((s) => s.ruleId === id)!.state, id).toBe('bound');
    }
  });

  it('passes the registry audit on the sample moments with and without a sex convention', () => {
    for (const sex of ['none', 'male-chart', 'female-chart'] as const) {
      const f = fixture('jiazi-1984');
      const input = makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2031, toYear: 2040, forecastConventions: { baziSexConvention: sex } });
      const audit = auditRegistry(DEFAULT_REGISTRY, input, { traditions: ['bazi'] });
      expect(audit, sex).toEqual([]);
    }
  });
});

describe('the whole tradition on the sample moments over thirty years', () => {
  for (const sex of ['none', 'male-chart', 'female-chart'] as const) {
    describe(`with sex convention ${sex}`, () => {
      for (const f of MOMENTS) {
        it(`${f.id}: every year has a reading, no sentence has an open slot, no fact is counted twice`, () => {
          const input = makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2025, toYear: 2054, birthTimeUncertaintyMinutes: 0, forecastConventions: { baziSexConvention: sex } });
          const res = evaluate(input, { traditions: ['bazi'], runs: 20 });
          expect(res.slices).toHaveLength(30);
          // a reading, or an explicit nothing-said, for every topic and every year
          const whole = res.readings.filter((r) => r.group === null);
          expect(whole).toHaveLength(30 * res.topics.length);
          for (const r of whole) expect(['supports', 'cautions', 'mixed', 'nothing-said']).toContain(r.word);
          // every sentence is the template and the facts, with nothing left open
          for (const s of res.signals) {
            expect(s.sentence, s.id).not.toMatch(/[{}]|undefined|NaN|null/);
            expect(bannedIn(s.sentence), `${s.id}: ${s.sentence}`).toBeNull();
            if (s.topic === 'health') expect(MORTALITY_WORDS.test(s.sentence), s.sentence).toBe(false);
            expect(s.sentence).toBe(fillTemplate(s.ruleId, ruleOf(s.ruleId).template, s.facts));
          }
          // no fact is counted twice in one reading: one signal per (topic, dedupe key) among those a reading lists
          const byId = new Map(res.signals.map((s) => [s.id, s]));
          expect(byId.size).toBe(res.signals.length);
          for (const r of res.readings) {
            const keys = [...r.signalIds].map((id) => `${byId.get(id)!.topic}|${byId.get(id)!.dedupeKey}`);
            expect(new Set(keys).size, `${r.topic} ${r.slice}`).toBe(keys.length);
          }
          // the period rules fired for the span: a year pillar judgement or an arrival, whatever the chart
          const dated = res.signals.filter((s) => s.startUtcMs !== null);
          expect(dated.length).toBeGreaterThan(0);
          // luck rules appear only with a sex convention
          const luckSignals = res.signals.filter((s) => s.clock === 'luck');
          if (sex === 'none') expect(luckSignals).toEqual([]);
        });
      }
    });
  }

  it('says nothing for a balanced chart where a sign would need a favourite, and states the balance', () => {
    const f = fixture('jiazi-1984');
    const input = makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2025, toYear: 2054, forecastConventions: { baziSexConvention: 'male-chart' } });
    const res = evaluate(input, { traditions: ['bazi'], runs: 20 });
    const ids = new Set(res.signals.map((s) => s.ruleId));
    expect(ids.has('bazi.luck-pillar-judgement')).toBe(false);
    expect(ids.has('bazi.year-judgement')).toBe(false);
    expect(res.signals.find((s) => s.ruleId === 'bazi.favourable-fuyi')!.facts.find((x) => x.key === 'favourable')!.value).toContain('balanced');
  });

  it('counts a clash that the year and the luck pillar both bring as two facts, one per window', () => {
    const f = fixture('equator');
    const input = makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2025, toYear: 2054, forecastConventions: { baziSexConvention: 'male-chart' } });
    const res = evaluate(input, { traditions: ['bazi'], runs: 20 });
    const chongs = res.signals.filter((s) => s.ruleId === 'bazi.branch-chong');
    expect(new Set(chongs.map((s) => s.id)).size).toBe(chongs.length);
    expect(new Set(chongs.map((s) => `${s.topic}|${s.dedupeKey}`)).size).toBe(chongs.length);
  });
});

describe('tables typed from the rule file', () => {
  it('names the elements of the branches the main qi rules read, as the rule file states', () => {
    const mainQi = Object.fromEntries(BRANCHES.map((b) => [b.hanzi, STEMS[b.hidden[0]!]!.hanzi]));
    expect(mainQi).toMatchObject({ 丑: '己', 辰: '戊', 巳: '丙', 未: '己', 戌: '戊' });
  });
});
