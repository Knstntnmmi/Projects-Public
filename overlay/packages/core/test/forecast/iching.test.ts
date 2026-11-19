// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import ichingRules from '../../src/forecast/data/rules.iching.json' with { type: 'json' };
import {
  auditRegistry,
  bannedIn,
  createContext,
  DEFAULT_REGISTRY,
  evaluate,
  makeInput,
  report,
  TOPICS,
  type Firing,
  type Signal,
} from '../../src/forecast/index.ts';
import * as iching from '../../src/forecast/predicates/iching.ts';
import { AUDIENCE_CUES, GOODS_CUES, ILLNESS_CUES, MARRIAGE_CUES, TRAVEL_CUES, cueDirection, gradeClause } from '../../src/forecast/predicates/ichingCues.ts';
import { DEFAULT_CONVENTIONS } from '../../src/conventions.ts';
import { longitudeOf } from '../../src/substrate/sky.ts';
import { makeMoment } from '../../src/substrate/time.ts';
import { hexagramByName } from '../../src/systems/iching/hexagrams.ts';
import { CARDINAL_PARTS, HEXAGRAM_PARTS, PARTS_PER_DAY, SHORT_HEXAGRAM_PARTS, SOVEREIGN_SEQUENCE, YEAR_PARTS } from '../../src/systems/iching/wheels.ts';
import { statementText } from '../../src/systems/iching/zhouyiText.ts';
import { fixture } from '../../../../fixtures/moments.ts';

const momentOf = (id: string) => {
  const f = fixture(id);
  return makeMoment(f.civil, f.zone, f.place);
};
const inputFor = (id: string, extra: Partial<Parameters<typeof makeInput>[1]> = {}) => makeInput(momentOf(id), { fromYear: 2031, toYear: 2033, ...extra });
const ctxFor = (id: string, extra: Partial<Parameters<typeof makeInput>[1]> = {}) => createContext(inputFor(id, extra), DEFAULT_REGISTRY.builders);

function fire(ruleId: string, id = 'j2000', extra: Partial<Parameters<typeof makeInput>[1]> = {}): Firing[] {
  const b = iching.BINDINGS.find((x) => x.ruleId === ruleId)!;
  const rule = DEFAULT_REGISTRY.rules.find((r) => r.id === ruleId)!;
  return b.fire(ctxFor(id, extra), rule);
}

const fact = (f: Firing, key: string): string | number => f.facts.find((x) => x.key === key)!.value;
const run = (id = 'j2000', extra: Partial<Parameters<typeof makeInput>[1]> = {}) => evaluate(inputFor(id, extra), { traditions: ['iching'], runs: 20, seed: 1, includePeriodRead: true });

describe('the I Ching bindings: what is bound and what is not', () => {
  it('binds ten rules and lists the grading method as not evaluated, with a reason', () => {
    expect(iching.BINDINGS.map((b) => b.ruleId).sort()).toEqual(
      ['dayan.cardinal-line-by-term', 'yiwei.cardinal-hexagram-arms', 'yiwei.growing-waning-sovereign', 'zhouyi.cue-audience', 'zhouyi.cue-goods', 'zhouyi.cue-illness', 'zhouyi.cue-marriage', 'zhouyi.cue-travel', 'zhouyi.line-of-day-reconstruction', 'zhouyi.period-hexagram-judgment'].sort(),
    );
    expect(iching.NOT_EVALUATED.map((n) => n.ruleId)).toEqual(['zhouyi.statement-grade']);
    expect(iching.NOT_EVALUATED[0]!.reason.length).toBeGreaterThan(20);
    expect(iching.COMPLETE).toBe(true);
    expect(ichingRules.rules).toHaveLength(11);
  });

  it('reports coverage per topic: one rule for wealth, none for learning, as the rule file says', () => {
    const r = report(DEFAULT_REGISTRY, { traditions: ['iching'], sex: null, birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60 });
    expect(r.counts.iching).toMatchObject({ total: 11, bound: 10, unbound: 0 });
    expect(r.coverage.iching).toEqual({ wealth: 1, career: 2, relationships: 1, health: 1, learning: 0, 'home-travel': 1, general: 5 });
  });

  it('passes the registry audit, with and without a sex convention', () => {
    for (const id of ['j2000', 'jiazi-1984', 'southern', 'equator', 'late-zi']) for (const sex of ['none', 'male-chart', 'female-chart'] as const) {
      expect(auditRegistry(DEFAULT_REGISTRY, inputFor(id, { forecastConventions: { baziSexConvention: sex } }), { traditions: ['iching'] }), `${id} ${sex}`).toEqual([]);
    }
  });
});

describe('the calendar does not depend on the nativity', () => {
  it('gives the same signals for any birth moment, and the same twice', () => {
    const key = (s: Signal[]) => s.map((x) => [x.id, x.sentence, x.direction, x.topic].join('|'));
    const a = key(run('j2000').signals);
    expect(key(run('southern').signals)).toEqual(a);
    expect(key(run('j2000').signals)).toEqual(a);
    expect(a.length).toBeGreaterThan(1000);
  });
});

describe('the sovereign hexagrams, golden against the engine table', () => {
  // Month branch from 子 to 亥, hexagram, and whether the Yi wei calls it growing (息) or waning (消).
  const GOLDEN: Array<[number, string, boolean]> = [
    [0, '復', true], [1, '臨', true], [2, '泰', true], [3, '大壯', true], [4, '夬', true], [5, '乾', true],
    [6, '姤', false], [7, '遯', false], [8, '否', false], [9, '觀', false], [10, '剝', false], [11, '坤', false],
  ];

  it('is the standard twelve in the engine table, six growing and six waning', () => {
    expect(SOVEREIGN_SEQUENCE.map((h) => h.hanzi)).toEqual(GOLDEN.map((g) => g[1]));
    // Structure, independent of the list: growing hexagrams have 1 to 6 yang lines rising from the bottom,
    // waning ones 1 to 6 yin lines rising from the bottom.
    for (const [i, h] of SOVEREIGN_SEQUENCE.entries()) {
      const n = (i % 6) + 1;
      const rising = i < 6 ? 1 : 0;
      expect(h.lines.slice(0, n).every((l) => l === rising), h.hanzi).toBe(true);
      expect(h.lines.slice(n).every((l) => l === 1 - rising), h.hanzi).toBe(true);
    }
  });

  it('fires the right word for each hexagram, under both boundary conventions', () => {
    for (const boundary of ['jie', 'zhongqi'] as const) {
      const firings = fire('yiwei.growing-waning-sovereign', 'j2000', { conventions: { ...DEFAULT_CONVENTIONS, sovereignBoundary: boundary } });
      const seen = new Map<string, string>();
      for (const f of firings) seen.set(String(fact(f, 'hexName')), String(fact(f, 'growing_or_waning')));
      expect(seen.size, boundary).toBe(12);
      for (const [, name, growing] of GOLDEN) {
        const h = hexagramByName(name);
        expect(seen.get(`${h.hanzi} (${h.number})`), `${boundary} ${name}`).toBe(growing ? 'growing' : 'waning');
      }
      for (const f of firings) {
        const growing = fact(f, 'growing_or_waning') === 'growing';
        expect(f.direction).toBe(growing ? 'favourable' : 'unfavourable');
        expect(fact(f, 'emolument_or_punishment')).toBe(growing ? 'emolument (祿)' : 'punishment (刑)');
      }
    }
  });

  it('starts 復 at the Sun\'s longitude 255 under the jie and 270 under the zhongqi', () => {
    for (const [boundary, start] of [['jie', 255], ['zhongqi', 270]] as const) {
      const firings = fire('yiwei.growing-waning-sovereign', 'j2000', { conventions: { ...DEFAULT_CONVENTIONS, sovereignBoundary: boundary } });
      const fu = firings.find((f) => String(fact(f, 'hexName')).startsWith('復') && f.startUtcMs! > Date.UTC(2031, 6, 1))!;
      expect(Math.abs(longitudeOf('Sun', fu.startUtcMs!) - start), boundary).toBeLessThan(0.01);
    }
  });

  it('covers career and general, the two topics of the rule', () => {
    const topics = new Set(run().signals.filter((s) => s.ruleId === 'yiwei.growing-waning-sovereign').map((s) => s.topic));
    expect([...topics].sort()).toEqual(['career', 'general']);
  });
});

describe('the gua qi hexagram of the period and the line of the day', () => {
  it('names the period hexagram, its grade and the reading of the text', () => {
    const f = fire('zhouyi.period-hexagram-judgment');
    expect(f.length).toBeGreaterThanOrEqual(3 * 60);
    for (const x of f) {
      expect(x.direction).toBeDefined();
      expect(x.clock).toBe('solar-longitude');
      expect(x.conventionsUsed).toEqual(['guaQi']);
    }
    const first = f[0]!;
    expect(String(fact(first, 'start'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // A hexagram that opens the equal-longitude scheme is 中孚; 63 is graded negative by its final 終亂.
    const jiji = f.find((x) => String(fact(x, 'hexName')).startsWith('既濟'));
    expect(jiji).toBeDefined();
    expect(jiji!.direction).toBe('unfavourable');
  });

  it('cuts each period into six equal slices and gives them lines one to six', () => {
    const periods = iching.buildContext(ctxFor('j2000')).periods;
    const lines = iching.buildContext(ctxFor('j2000')).slices;
    const inside = periods.filter((p) => p.startUtcMs > Date.UTC(2031, 1, 1) && p.endUtcMs < Date.UTC(2033, 10, 1));
    for (const p of inside.slice(0, 40)) {
      const mine = lines.filter((s) => s.hexagram.number === p.hexagram.number && s.startUtcMs >= p.startUtcMs && s.endUtcMs <= p.endUtcMs);
      expect(mine.map((s) => s.line)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(mine[0]!.startUtcMs).toBe(p.startUtcMs);
      expect(mine[5]!.endUtcMs).toBe(p.endUtcMs);
      for (let k = 1; k < 6; k++) expect(mine[k]!.startUtcMs).toBe(mine[k - 1]!.endUtcMs);
      // The rule's formula, line = 1 + floor(6 (t - t0) / (t1 - t0)), at a few instants inside the period.
      for (const q of [0.01, 0.1, 0.34, 0.51, 0.67, 0.99]) {
        const t = p.startUtcMs + q * (p.endUtcMs - p.startUtcMs);
        const line = 1 + Math.floor((6 * (t - p.startUtcMs)) / (p.endUtcMs - p.startUtcMs));
        expect(mine.find((s) => s.startUtcMs <= t && t < s.endUtcMs)!.line, `${p.hexagram.hanzi} at ${q}`).toBe(line);
      }
    }
  });

  it('fires the line statement of the day and says it is a reconstruction', () => {
    const f = fire('zhouyi.line-of-day-reconstruction');
    expect(f.length).toBeGreaterThan(3 * 360);
    for (const x of f.slice(0, 50)) {
      expect(x.badges).toContain('reconstruction');
      const [n, l] = String(fact(x, 'id')).split('.').map(Number);
      expect(fact(x, 'text')).toBe(statementText(n!, l!));
      expect(l).toBe(fact(x, 'line'));
    }
    const sentence = run().signals.find((s) => s.ruleId === 'zhouyi.line-of-day-reconstruction')!.sentence;
    expect(sentence).toMatch(/Modern reconstruction, not a Han assignment\.$/);
  });

  it('marks a period whose hexagram is also the month\'s sovereign one', () => {
    const marked = fire('zhouyi.period-hexagram-judgment').filter((x) => x.badges?.includes('also the sovereign hexagram of the month'));
    expect(marked.length).toBeGreaterThanOrEqual(30);
    expect(marked.length).toBeLessThanOrEqual(40);
    for (const x of marked) expect(['復', '臨', '泰', '大壯', '夬', '乾', '姤', '遯', '否', '觀', '剝', '坤'].some((n) => String(fact(x, 'hexName')).startsWith(n))).toBe(true);
  });
});

describe('the Dayan cardinal line by solar term', () => {
  it('gives 坎 lines 1 to 6 from the winter solstice, then 震, 離, 兌, one term to a line', () => {
    const f = fire('dayan.cardinal-line-by-term');
    const first = f.findIndex((x) => Math.abs(longitudeOf('Sun', x.startUtcMs!) - 270) < 0.01);
    expect(first).toBeGreaterThanOrEqual(0);
    const year = f.slice(first, first + 24);
    expect(year.map((x) => String(fact(x, 'hexName')).split(' ')[0])).toEqual([...'坎'.repeat(6), ...'震'.repeat(6), ...'離'.repeat(6), ...'兌'.repeat(6)]);
    expect(year.map((x) => fact(x, 'line'))).toEqual(Array.from({ length: 24 }, (_, k) => (k % 6) + 1));
    // The terms follow each other with no gap, and the year is 24 terms long.
    for (let k = 1; k < 24; k++) expect(year[k]!.startUtcMs).toBe(year[k - 1]!.endUtcMs);
    expect(String(fact(year[0]!, 'term'))).toContain('冬至');
    expect(String(fact(year[5]!, 'term'))).toContain('驚蟄');
    expect(String(fact(year[6]!, 'term'))).toContain('春分');
    expect(String(fact(year[12]!, 'term'))).toContain('夏至');
    expect(String(fact(year[18]!, 'term'))).toContain('秋分');
    for (const x of year) {
      expect(x.badges).toContain('inference from one sentence');
      expect(x.direction).toBeUndefined();
    }
    expect(run().signals.filter((s) => s.ruleId === 'dayan.cardinal-line-by-term').every((s) => s.direction === 'activates')).toBe(true);
  });

  it('opens each term where the Sun reaches 270 + 15 k degrees', () => {
    const f = fire('dayan.cardinal-line-by-term');
    for (const x of f) {
      const lon = longitudeOf('Sun', x.startUtcMs!);
      expect(Math.abs(((lon + 180 - 270) % 15 + 15) % 15), String(fact(x, 'term'))).toSatisfy((d: number) => d < 0.01 || d > 14.99);
    }
  });
});

describe('the cardinal marker', () => {
  it('never fires under the default convention, where no gua qi hexagram is a cardinal one', () => {
    expect(fire('yiwei.cardinal-hexagram-arms')).toEqual([]);
  });

  it('fires for 坎 震 離 兌 under Jing Fang\'s allotment, about a day each, and lines are not cut for them', () => {
    const conventions = { ...DEFAULT_CONVENTIONS, guaQi: 'jing-fang' as const };
    const f = fire('yiwei.cardinal-hexagram-arms', 'j2000', { conventions });
    expect(new Set(f.map((x) => String(fact(x, 'hexName')).split(' ')[0]))).toEqual(new Set(['坎', '震', '離', '兌']));
    expect(f.length).toBeGreaterThanOrEqual(11);
    expect(f.length).toBeLessThanOrEqual(13);
    for (const x of f) {
      const days = (x.endUtcMs! - x.startUtcMs!) / 86_400_000;
      // 73 eightieths of a day.
      expect(days).toBeGreaterThan(0.85);
      expect(days).toBeLessThan(0.97);
    }
    const lines = fire('zhouyi.line-of-day-reconstruction', 'j2000', { conventions });
    expect(lines.some((x) => ['坎', '震', '離', '兌'].includes(String(fact(x, 'hexName')).split(' ')[0]!))).toBe(false);
    const res = run('j2000', { conventions });
    expect(res.signals.some((s) => s.ruleId === 'yiwei.cardinal-hexagram-arms' && s.direction === 'unfavourable' && s.stage === 'modifier')).toBe(true);
  });

  it('the Han arithmetic of the allotment adds up to a year of 365.25 days', () => {
    expect(4 * CARDINAL_PARTS + 4 * SHORT_HEXAGRAM_PARTS + 56 * HEXAGRAM_PARTS).toBe(YEAR_PARTS);
    expect(YEAR_PARTS / PARTS_PER_DAY).toBe(365.25);
    expect(HEXAGRAM_PARTS / PARTS_PER_DAY).toBe(6.0875);
    expect(60 * 6.0875).toBe(365.25);
    expect((4 * 73) / 80 + 4 * 5.175 + 56 * 6.0875).toBeCloseTo(365.25, 10);
  });
});

describe('the cue rules map a statement to a topic only where the text names it', () => {
  const cueTables = (ichingRules.tables as { topicCueIds: Record<string, string> }).topicCueIds;
  const ids = (k: string) => cueTables[k]!.split(' ');

  it('finds exactly the journey statements the rule lists, except 25.0 as a positive go-ahead', () => {
    const got = (pred: (c: (typeof TRAVEL_CUES)[number]) => boolean) => TRAVEL_CUES.filter(pred).map((c) => c.id);
    expect(got((c) => c.stated === 'favourable' && !c.goAhead)).toEqual(ids('crossingPositive'));
    expect(got((c) => c.stated === 'unfavourable' && !c.goAhead).sort()).toEqual(ids('crossingNegative').sort());
    // The list of positive go-aheads has 25.0 in it, but 25.0 says 不利有攸往: 利有攸往 is there only inside the negative.
    const goPos = got((c) => c.stated === 'favourable' && c.goAhead);
    // 42.0 has both phrases and is listed with the crossings.
    const expected = ids('goAheadPositive').filter((x) => x !== '25.0' && !ids('crossingPositive').includes(x));
    expect(goPos.sort()).toEqual(expected.sort());
    expect(got((c) => c.stated === 'unfavourable' && c.goAhead).sort()).toEqual(ids('goAheadNegative').sort());
    expect(ids('goAheadNegative')).toContain('25.0');
  });

  it('finds exactly the audience, marriage, illness and goods statements the rule lists', () => {
    expect(AUDIENCE_CUES.map((c) => c.id)).toEqual(ids('audience'));
    expect(MARRIAGE_CUES.map((c) => c.id).sort()).toEqual(ids('marriage').sort());
    expect(ILLNESS_CUES.map((c) => c.id).sort()).toEqual([...ids('illnessCertain'), ...ids('illnessAmbiguous')].sort());
    expect(ILLNESS_CUES.map((c) => c.id)).not.toContain('36.3');
    expect(ILLNESS_CUES.map((c) => c.id)).not.toContain('50.2');
    expect(GOODS_CUES.map((c) => c.id).sort()).toEqual(ids('goods').sort());
    expect(GOODS_CUES).toHaveLength(9);
  });

  it('keeps every clause inside its statement', () => {
    for (const c of [...TRAVEL_CUES, ...AUDIENCE_CUES, ...MARRIAGE_CUES, ...ILLNESS_CUES, ...GOODS_CUES]) {
      const [n, l] = c.id.split('.').map(Number);
      const text = statementText(n!, l!)!;
      for (const part of c.clause.split('、')) expect(text, `${c.id} ${part}`).toContain(part);
    }
  });

  it('grades the clause and not the whole statement: 6.0 is -3 as a whole and favourable as an audience cue', () => {
    expect(gradeClause('利見大人').grade).toBeGreaterThan(0);
    const cue = AUDIENCE_CUES.find((c) => c.id === '6.0')!;
    expect(cueDirection(cue, gradeClause(cue.clause))).toBe('favourable');
    const signal = run().signals.find((s) => s.ruleId === 'zhouyi.cue-audience' && s.facts.some((f) => f.key === 'id' && f.value === '6.0'));
    // 訟 holds a period of its own every year, so it is in play.
    expect(signal?.direction).toBe('favourable');
  });

  it('gives the marriage signs the rule states: 取女吉 and 女歸吉 favourable, 勿用取女 unfavourable, 婦人吉夫子凶 mixed', () => {
    const dir = (id: string) => {
      const c = MARRIAGE_CUES.find((x) => x.id === id)!;
      return cueDirection(c, gradeClause(c.clause));
    };
    expect(dir('31.0')).toBe('favourable');
    expect(dir('53.0')).toBe('favourable');
    expect(dir('4.3')).toBe('unfavourable');
    expect(dir('44.0')).toBe('unfavourable');
    expect(dir('32.5')).toBe('mixed');
    // A phrase with no verdict word has no sign: the topic is touched, nothing is said of its outcome.
    expect(dir('3.2')).toBe('activates');
    expect(dir('51.6')).toBe('activates');
  });

  it('gives the illness cues the grades of their clauses', () => {
    const grade = (id: string) => gradeClause(ILLNESS_CUES.find((c) => c.id === id)!.clause).grade;
    expect(grade('25.5')).toBe(1);
    expect(grade('33.3')).toBe(-1.5);
    expect(grade('41.4')).toBe(1);
    expect(grade('58.4')).toBe(1);
    for (const id of ['24.0', '55.2', '58.4']) expect(ILLNESS_CUES.find((c) => c.id === id)!.note).toBe('ambiguous cue');
  });

  it('gives the goods cues their stated gains and losses, and leaves 9.5 and 11.4 without a sign', () => {
    const d = (id: string) => {
      const c = GOODS_CUES.find((x) => x.id === id)!;
      return cueDirection(c, gradeClause(c.clause));
    };
    expect(d('56.4')).toBe('favourable');
    for (const id of ['57.6', '56.6', '34.5', '51.2', '56.3']) expect(d(id), id).toBe('unfavourable');
    expect(d('9.5')).toBe('activates');
    expect(d('11.4')).toBe('activates');
  });

  it('emits the clause direction or the grade, one signal per statement and topic, never both', () => {
    const res = run();
    const cue = res.signals.filter((s) => s.ruleId.startsWith('zhouyi.cue-'));
    expect(cue.length).toBeGreaterThan(100);
    const seen = new Set<string>();
    for (const s of cue) {
      const key = `${s.ruleId}|${s.startUtcMs}|${s.facts.find((f) => f.key === 'id')!.value}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
    const topicOf: Record<string, string> = { 'zhouyi.cue-travel': 'home-travel', 'zhouyi.cue-audience': 'career', 'zhouyi.cue-marriage': 'relationships', 'zhouyi.cue-illness': 'health', 'zhouyi.cue-goods': 'wealth' };
    for (const s of cue) expect(s.topic).toBe(topicOf[s.ruleId]);
  });

  it('never maps anything to learning', () => {
    expect(run().signals.filter((s) => s.topic === 'learning')).toEqual([]);
  });
});

describe('the output is labelled experimental, kept out of agreement, and is sane over three years', () => {
  it('badges every signal experimental and ungated, and says relationships are convention-dependent', () => {
    for (const id of ['j2000', 'late-zi']) {
      const res = run(id);
      for (const s of res.signals) {
        expect(s.badges).toContain('experimental');
        expect(s.gate.state).toBe('ungated');
        expect(s.tradition).toBe('iching');
        if (s.topic === 'relationships') expect(s.badges).toContain('convention-dependent');
      }
    }
  });

  it('counts for nothing in agreement: with the I Ching alone no cell speaks', () => {
    const res = run();
    expect(res.agreement.every((c) => c.verdict === 'silent')).toBe(true);
  });

  it('has one signal per statement window, about 60 hexagram periods and 365 line days a year, over every sample moment', () => {
    for (const id of ['j2000', 'jiazi-1984', 'southern', 'equator', 'late-zi']) {
      const res = run(id);
      const count = (rule: string, topic = 'general') => res.signals.filter((s) => s.ruleId === rule && s.topic === topic).length;
      expect(count('zhouyi.period-hexagram-judgment'), id).toBeGreaterThanOrEqual(3 * 60);
      expect(count('zhouyi.period-hexagram-judgment'), id).toBeLessThanOrEqual(3 * 61 + 2);
      expect(count('zhouyi.line-of-day-reconstruction'), id).toBeGreaterThanOrEqual(3 * 360);
      expect(count('zhouyi.line-of-day-reconstruction'), id).toBeLessThanOrEqual(3 * 370 + 12);
      expect(count('dayan.cardinal-line-by-term'), id).toBeGreaterThanOrEqual(72);
      expect(count('dayan.cardinal-line-by-term'), id).toBeLessThanOrEqual(74);
      expect(count('yiwei.growing-waning-sovereign'), id).toBeGreaterThanOrEqual(36);
      expect(count('yiwei.growing-waning-sovereign'), id).toBeLessThanOrEqual(38);
    }
  });

  it('has every sentence equal to its rule template with the facts put in, without banned words', () => {
    const res = run();
    const rules = new Map(DEFAULT_REGISTRY.rules.map((r) => [r.id, r]));
    for (const s of res.signals.slice(0, 600)) {
      const rule = rules.get(s.ruleId)!;
      const expected = rule.template.replace(/\{([^{}]+)\}/g, (_m, k: string) => String(s.facts.find((f) => f.key === k)!.value));
      expect(s.sentence).toBe(expected);
      expect(s.sentence).not.toMatch(/\{|\}/);
      expect(bannedIn(s.sentence), s.sentence).toBeNull();
    }
    for (const s of res.signals) expect(bannedIn(s.sentence)).toBeNull();
  });

  it('covers every topic of the rule file except learning', () => {
    const res = run();
    const have = new Set(res.signals.map((s) => s.topic));
    for (const t of TOPICS) expect(have.has(t), t).toBe(t !== 'learning');
  });

  it('keeps the dates of the first period inside the span and in order', () => {
    const f = fire('zhouyi.period-hexagram-judgment');
    for (let k = 1; k < f.length; k++) expect(f[k]!.startUtcMs).toBe(f[k - 1]!.endUtcMs);
  });
});
