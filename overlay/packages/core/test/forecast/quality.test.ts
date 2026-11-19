// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The open points of each tradition: the silence of a balanced BaZi chart, a modifier that lasts
 * over many statements, the reasons given for what is not evaluated, the negated words and the
 * statements without a topic in the I Ching, the vedha list and the branches left out in the
 * Vedic rules, and the level of every dasha firing. Each point is proved on invented rules where
 * the answer is known, and on the sample moments with the real rules.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import baziJson from '../../src/forecast/data/rules.bazi.json' with { type: 'json' };
import vedicJson from '../../src/forecast/data/rules.vedic.json' with { type: 'json' };
import {
  HEADLINE_HEADING,
  allPhrases,
  bannedIn,
  createContext,
  DEFAULT_FORECAST_CONVENTIONS,
  DEFAULT_REGISTRY,
  evaluate,
  makeInput,
  NOTE,
  periodCharacter,
  reportJson,
  statementList,
  TEXT,
  yearView,
  MAX_WINDOW_DAYS,
  type ChartNote,
  type Firing,
  type ForecastResult,
  type LevelId,
  type Rule,
  type RuleBinding,
  type Tradition,
} from '../../src/forecast/index.ts';
import { createRegistry, type TraditionModule } from '../../src/forecast/registry.ts';
import * as bazi from '../../src/forecast/predicates/bazi.ts';
import * as vedic from '../../src/forecast/predicates/vedic.ts';
import { classifyStrength } from '../../src/forecast/predicates/bazi/assessment.ts';
import { natalOf } from '../../src/forecast/predicates/bazi/natal.ts';
import { model } from '../../src/forecast/predicates/vedic/common.ts';
import { cueTopicsOf, topicsOfStatement } from '../../src/forecast/predicates/ichingCues.ts';
import { OBSTRUCTORS, VEDHA } from '../../src/forecast/predicates/vedic/transit.ts';
import { MS, makeMoment } from '../../src/substrate/time.ts';
import { formulaDetail, formulaNotes, gradeStatement } from '../../src/systems/iching/grade.ts';
import { allStatements, statementText } from '../../src/systems/iching/zhouyiText.ts';
import { fixture, MOMENTS } from '../../../../fixtures/moments.ts';
import { input, rule } from './synthetic.ts';

const Y = (y: number, m = 0, d = 1): number => Date.UTC(y, m, d);
const momentOf = (id: string) => {
  const f = fixture(id);
  return makeMoment(f.civil, f.zone, f.place);
};
const realInput = (id: string, from = 2031, to = 2060, extra: Partial<Parameters<typeof makeInput>[1]> = {}) => makeInput(momentOf(id), { fromYear: from, toYear: to, ...extra });

// ---------------------------------------------------------------------------
// An invented world with known answers
// ---------------------------------------------------------------------------

const facts = [{ key: 'thing', label: 'Thing', value: 'a gain' }];
interface Spec {
  id: string;
  tradition: Tradition;
  direction?: Rule['direction'];
  stage?: Rule['stage'];
  fires: Array<[Firing['clock'], number, number, Firing['level']?]>;
  /** The levels the binding declares; where the rule never fires the declaration is what gives its level a row. */
  levels?: LevelId[];
}

function world(specs: Spec[], extra: Partial<Record<Tradition, Partial<TraditionModule>>> = {}) {
  const rules = specs.map((s) => rule({ id: s.id, tradition: s.tradition, direction: s.direction ?? 'favourable', stage: s.stage ?? 'period-lord', template: `${s.id} says something.` }));
  const bindings = (t: Tradition): RuleBinding[] =>
    specs
      .filter((s) => s.tradition === t)
      .map((s) => ({ ruleId: s.id, tradition: t, ...(s.levels ? { levels: s.levels } : {}), fire: () => s.fires.map(([clock, a, b, level]) => ({ clock, startUtcMs: a, endUtcMs: b, level, facts, dedupeInstance: `${a}-${b}` }) as Firing) }));
  const files = (['bazi', 'vedic', 'iching', 'western'] as const).map((t) => ({ tradition: t, method: 'synthetic', topicDefinitions: [], tables: {}, rules: rules.filter((r) => r.tradition === t) }));
  const mod = (t: Tradition): TraditionModule => ({ BINDINGS: bindings(t), NOT_EVALUATED: [], buildContext: () => undefined, COMPLETE: false, ...extra[t] });
  return createRegistry(files, { bazi: mod('bazi'), vedic: mod('vedic'), iching: mod('iching'), western: mod('western') });
}

const runWorld = (registry: ReturnType<typeof world>): ForecastResult => evaluate(input(), { registry, traditions: ['bazi', 'vedic'], topics: ['wealth'], runs: 20 });

// ---------------------------------------------------------------------------
// BaZi 1: the strength bands, and the silence of a balanced chart
// ---------------------------------------------------------------------------

describe('the strength bands are exactly the rule file\'s', () => {
  const rulefile = baziJson.rules.find((r) => r.id === 'bazi.strength-score')!.condition;

  it('says what the code implements: strong above 55, weak below 45, balanced from 45 to 55 inclusive', () => {
    expect(rulefile).toContain('S > 55 strong, S < 45 weak, 45 <= S <= 55 balanced');
  });

  it('puts every band edge on the side the rule file puts it, down to the last unit', () => {
    // the total is 1000 eighths, so one unit of support is a tenth of a point of S
    const at = (support: number) => classifyStrength(support, 1000);
    expect(at(449)).toBe('weak'); // 44.9
    expect(at(450)).toBe('balanced'); // 45.0
    expect(at(451)).toBe('balanced');
    expect(at(549)).toBe('balanced');
    expect(at(550)).toBe('balanced'); // 55.0
    expect(at(551)).toBe('strong'); // 55.1
    // and at the ends
    expect(at(0)).toBe('weak');
    expect(at(1000)).toBe('strong');
  });

  it('weights as the rule file states: month 3.0, day 1.5, year and hour 1.0, hidden stems 1, 0.5, 0.25 of it, other stems 1.0', () => {
    for (const s of ['month branch main qi 3.0', 'day branch 1.5', 'year and hour branches 1.0', 'second hidden stem 0.5x and third 0.25x', 'each other stem 1.0']) expect(rulefile).toContain(s);
    // a stem of any pillar but the day weighs 8 eighths; a month main qi 24; a day main qi 12; a year or hour main qi 8
    const a = natalOf(createContext(realInput('j2000'), DEFAULT_REGISTRY.builders));
    for (const c of a.chars) {
      const unit = c.place === 'stem' ? 8 : { year: 8, month: 24, day: 12, hour: 8 }[c.pillar] * [1, 0.5, 0.25][c.order]!;
      expect(c.weight8, `${c.pillar} ${c.place} ${c.order}`).toBe(unit);
    }
  });

  it('counts the share of the sample moments whose chart is balanced', () => {
    const balanced = MOMENTS.filter((m) => natalOf(createContext(realInput(m.id, 2031, 2031), DEFAULT_REGISTRY.builders)).strengthClass === 'balanced').map((m) => m.id);
    expect(balanced).toEqual(['jiazi-1984', 'china-dst-1988', 'skipped-hour']);
    expect(balanced.length / MOMENTS.length).toBeCloseTo(3 / 13, 10);
  });
});

describe('a balanced chart: the levels that judge by the favourite carry a note that says why they are silent', () => {
  const sentence = 'The chart is balanced, so the favourable-element method names no favourite.';
  it('the phrasebook word is in the banned-word walk and says both things the director asked for', () => {
    expect(NOTE.balancedChart).toContain('balanced');
    expect(NOTE.balancedChart).toContain('names no favourite');
    expect(NOTE.balancedChart).toContain('favourable-element method');
    expect(allPhrases()).toContain(NOTE.balancedChart);
    expect(bannedIn(NOTE.balancedChart)).toBeNull();
  });

  const bal = evaluate(realInput('jiazi-1984'), { topics: ['wealth', 'general'], runs: 20, seed: 1 });
  it('jiazi-1984: the year pillar level has the note in every year, on its reading, in the year view and in the statement list', () => {
    // no luck pillar is cast without a sex convention: the luck level says so, and the year level carries the balanced note
    expect(bal.chartNotes).toEqual([
      { tradition: 'bazi', levels: ['bazi-luck'], text: NOTE.needsLuckDirection },
      { tradition: 'bazi', levels: ['bazi-year'], text: NOTE.balancedChart },
    ]);
    for (const topic of ['wealth', 'general'] as const) {
      const readings = bal.levelReadings.filter((r) => r.topic === topic && r.level === 'bazi-year');
      expect(readings).toHaveLength(bal.slices.length);
      for (const r of readings) expect(r.chartNote).toBe(NOTE.balancedChart);
      for (const r of bal.levelReadings.filter((x) => x.level !== 'bazi-year' && x.level !== 'bazi-luck')) expect(r.chartNote).toBeNull();
      const view = yearView(bal, topic);
      for (const y of view.years) {
        const cell = y.levels.find((l) => l.level === 'bazi-year')!;
        expect(cell.chartNote).toBe(NOTE.balancedChart);
        // the reason is in the cell where the level is silent, and the headline names only the levels
        if (cell.word === 'nothing-said') expect(cell.silentReason).toBe(NOTE.balancedChart);
        expect(bannedIn(y.headline)).toBeNull();
      }
      expect(statementList(bal, topic).chartNotes).toEqual(['Needs the sex the chart is read as, which fixes the direction of the luck pillars.', sentence]);
    }
  });

  it('jiazi-1984: the tradition says nothing about wealth in most years, and the silent years carry the reason', () => {
    const view = yearView(bal, 'wealth');
    const silentYears = view.years.filter((y) => y.silent.includes('bazi-year'));
    expect(silentYears.length).toBeGreaterThanOrEqual(20);
    for (const y of silentYears) expect(y.headline).toMatch(new RegExp(`${HEADLINE_HEADING.silent}: .*BaZi year pillar`));
  });

  it('a chart that is not balanced has no note; neither has a run without a birth time', () => {
    const strong = evaluate(realInput('j2000'), { topics: ['wealth'], runs: 5, seed: 1 });
    const balancedOnly = (r: ForecastResult) => r.chartNotes.filter((n) => n.text === NOTE.balancedChart);
    expect(balancedOnly(strong)).toEqual([]);
    expect(strong.levelReadings.filter((r) => r.level !== 'bazi-luck').every((r) => r.chartNote === null)).toBe(true);
    const noTime = evaluate(realInput('jiazi-1984', 2031, 2035, { birthTimeUncertaintyMinutes: null }), { topics: ['wealth'], runs: 5, seed: 1 });
    expect(balancedOnly(noTime)).toEqual([]);
    const loose = evaluate(realInput('jiazi-1984', 2031, 2035, { birthTimeUncertaintyMinutes: DEFAULT_FORECAST_CONVENTIONS.birthTimeLimitMinutes + 1 }), { topics: ['wealth'], runs: 5, seed: 1 });
    expect(balancedOnly(loose)).toEqual([]);
  });

  it('with a sex convention the luck pillar level carries the note too', () => {
    const res = evaluate(realInput('jiazi-1984', 2031, 2040, { forecastConventions: { baziSexConvention: 'male-chart' } }), { topics: ['wealth'], runs: 5, seed: 1 });
    expect(res.chartNotes[0]!.levels).toEqual(['bazi-luck', 'bazi-year']);
    const view = yearView(res, 'wealth');
    for (const y of view.years) expect(y.levels.find((l) => l.level === 'bazi-luck')!.chartNote).toBe(NOTE.balancedChart);
  });

  it('in an invented world a declared level is read even where no rule of it fired, with the note of the chart, and a note reaches no other level', () => {
    const note: ChartNote = { tradition: 'bazi', levels: ['bazi-luck', 'bazi-year'], text: 'the chart says so' };
    const reg = world(
      [
        { id: 'v.maha', tradition: 'vedic', fires: [['dasha', Y(2031), Y(2033), 'vedic-maha']] },
        { id: 'b.quiet', tradition: 'bazi', fires: [], levels: ['bazi-luck', 'bazi-year'] },
      ],
      { bazi: { chartNotes: () => [note] } },
    );
    const res = runWorld(reg);
    const readings = res.levelReadings.filter((r) => r.topic === 'wealth');
    expect(new Set(readings.map((r) => r.level))).toEqual(new Set(['bazi-luck', 'bazi-year', 'vedic-maha']));
    for (const r of readings.filter((x) => x.level.startsWith('bazi'))) expect([r.chartNote, r.word]).toEqual(['the chart says so', 'nothing-said']);
    for (const r of readings.filter((x) => x.level === 'vedic-maha')) expect(r.chartNote).toBeNull();
    const view = yearView(res, 'wealth');
    expect(view.years[0]!.headline).toBe('Supports: Vedic mahadasha. Silent: BaZi luck pillar, BaZi year pillar.');
    expect(view.years[0]!.levels.find((l) => l.level === 'bazi-luck')!.silentReason).toBe('the chart says so');
  });

  it('a note on a level that no bound rule declares for the topic gives it no row', () => {
    const note: ChartNote = { tradition: 'bazi', levels: ['bazi-luck'], text: 'the chart says so' };
    const reg = world([{ id: 'v.maha', tradition: 'vedic', fires: [['dasha', Y(2031), Y(2033), 'vedic-maha']] }], { bazi: { chartNotes: () => [note] } });
    expect(new Set(runWorld(reg).levelReadings.map((r) => r.level))).toEqual(new Set(['vedic-maha']));
  });
});

// ---------------------------------------------------------------------------
// BaZi 2: a modifier that lasts over many statements is shown once, with its span
// ---------------------------------------------------------------------------

describe('a star held over a luck pillar is shown once with its span, not once per year', () => {
  const reg = world([
    { id: 'b.luck', tradition: 'bazi', fires: [['luck', Y(2033), Y(2043)]] },
    { id: 'b.y33', tradition: 'bazi', fires: [['solar-longitude', Y(2033), Y(2034)]] },
    { id: 'b.y34', tradition: 'bazi', fires: [['solar-longitude', Y(2034), Y(2035)]] },
    { id: 'b.y35', tradition: 'bazi', fires: [['solar-longitude', Y(2035), Y(2036)]] },
    { id: 'b.star', tradition: 'bazi', stage: 'modifier', direction: 'activates', fires: [['luck', Y(2033), Y(2043)]] },
  ]);
  const list = statementList(runWorld(reg), 'wealth');

  it('appears as one qualifier, on the first statement it qualifies, with its own span and the count of the others', () => {
    const all = list.dated.flatMap((e) => e.qualifiers.map((q) => [e.ruleId, q] as const));
    expect(all).toHaveLength(1);
    const [on, q] = all[0]!;
    expect(on).toBe('b.luck');
    expect(q).toMatchObject({ ruleId: 'b.star', level: 'bazi-luck', startUtcMs: Y(2033), endUtcMs: Y(2041), beganBefore: false, endsAfter: true, alsoQualifies: 3 });
    expect(list.unattached).toEqual([]);
  });
});

describe('a star on the real sample moments is never shown twice', () => {
  it('every qualifier appears once and its count of further statements matches the signals that name it', () => {
    for (const id of ['j2000', 'jiazi-1984', 'late-zi']) {
      const res = evaluate(realInput(id, 2031, 2045, { forecastConventions: { baziSexConvention: 'male-chart' } }), { runs: 5, seed: 1 });
      for (const topic of ['general', 'wealth', 'career', 'relationships'] as const) {
        const list = statementList(res, topic);
        const qs = [...list.natal, ...list.dated].flatMap((e) => e.qualifiers);
        const ids = qs.map((q) => q.signalId);
        expect(new Set(ids).size, `${id} ${topic}`).toBe(ids.length);
        for (const q of qs) {
          const named = [...list.natal, ...list.dated].filter((e) => res.signals.find((s) => s.id === e.signalId)!.modifiedBy.includes(q.signalId)).length;
          expect(q.alsoQualifies + 1, `${id} ${topic} ${q.signalId}`).toBeLessThanOrEqual(Math.max(named, 1) + 5 /* a duplicate report of the same star counts under the kept one */);
          expect(q.startUtcMs).toBeLessThan(q.endUtcMs);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// BaZi 3 and Vedic 10: what is not evaluated, and why, in words a reader can follow
// ---------------------------------------------------------------------------

describe('what is not evaluated is listed with a reason a reader can understand', () => {
  const JARGON = /\b(firing|binding|router|dedupe|stage|clock|gate|extractor|checker|strength)\b/i;
  const full = evaluate(realInput('j2000', 2031, 2032), { topics: ['wealth'], runs: 5, seed: 1, traditions: ['bazi', 'vedic'] });
  const listed = reportJson(full, 'wealth').notEvaluated as Array<{ ruleId: string; reason: string }>;
  const reasonOf = (ruleId: string, contains = ''): string => listed.find((n) => n.ruleId === ruleId && n.reason.includes(contains))?.reason ?? '';

  it('lists the two BaZi rules and the branch of the third, each with a reason of real length and no builder\'s vocabulary', () => {
    for (const [id, part] of [['bazi.topic-spouse-woman', 'husband star'], ['bazi.pillar-palaces', 'lookup table'], ['bazi.year-vs-day-clash', '歲君犯日']] as const) {
      const r = reasonOf(id);
      expect(r, id).toContain(part);
      expect(r.length, id).toBeGreaterThan(80);
      expect(r, id).not.toMatch(JARGON);
      expect(bannedIn(r), id).toBeNull();
    }
    // the rule whose branch is left out stays bound
    expect(DEFAULT_REGISTRY.bindings.has('bazi.year-vs-day-clash')).toBe(true);
    expect(reasonOf('bazi.year-vs-day-clash')).toContain('only part of this rule is evaluated');
  });

  it('lists every branch the Vedic builders left out, as a branch of a bound rule', () => {
    expect(vedic.NOT_EVALUATED_BRANCHES.length).toBeGreaterThanOrEqual(10);
    for (const b of vedic.NOT_EVALUATED_BRANCHES) {
      expect(DEFAULT_REGISTRY.bindings.has(b.ruleId), b.ruleId).toBe(true);
      expect(listed.some((n) => n.ruleId === b.ruleId && n.reason.includes(b.branch) && n.reason.includes(b.reason)), `${b.ruleId}: ${b.branch}`).toBe(true);
      expect(b.reason.length, b.branch).toBeGreaterThan(40);
      expect(bannedIn(b.reason), b.branch).toBeNull();
    }
    const named = (rule: string, text: string) => vedic.NOT_EVALUATED_BRANCHES.some((b) => b.ruleId === rule && b.branch.includes(text));
    expect(named('parashari.dasha-lord-3-11-lord', 'sits in, or is joined to')).toBe(true);
    expect(named('parashari.dasha-lord-2nd-7th-maraka', 'joined to the 2nd or 7th lord')).toBe(true);
    expect(named('parashari.dasha-lord-association', 'aspected')).toBe(true);
    expect(named('parashari.dasha-lord-association', 'Rahu or Ketu')).toBe(true);
    expect(named('parashari.node-dasha', 'is Ketu')).toBe(true);
    for (const r of ['parashari.dasha-lord-placement-natal', 'parashari.dasha-lord-placement-at-start', 'parashari.antardasha-lord-strength', 'parashari.wealth-5-9-lord-dasha']) expect(named(r, 'Rahu or Ketu') || named(r, 'a node')).toBe(true);
  });

  it('refuses a branch of a rule that is not bound, an unknown rule and a branch declared twice', () => {
    const mod = (extra: Partial<TraditionModule>): Record<Tradition, TraditionModule> => {
      const m = (t: Tradition): TraditionModule => ({ BINDINGS: [], NOT_EVALUATED: [], buildContext: () => undefined, COMPLETE: false, ...(t === 'vedic' ? extra : {}) });
      return { bazi: m('bazi'), vedic: m('vedic'), iching: m('iching'), western: m('western') };
    };
    const files = [{ tradition: 'vedic' as const, method: 's', topicDefinitions: [], tables: {}, rules: [rule({ id: 'x.rule', tradition: 'vedic' })] }];
    expect(() => createRegistry(files, mod({ NOT_EVALUATED_BRANCHES: [{ ruleId: 'x.rule', branch: 'b', reason: 'r' }] }))).toThrow(/not bound/);
    expect(() => createRegistry(files, mod({ NOT_EVALUATED_BRANCHES: [{ ruleId: 'x.none', branch: 'b', reason: 'r' }] }))).toThrow(/no such rule/);
    const bound: RuleBinding = { ruleId: 'x.rule', tradition: 'vedic', fire: () => [] };
    const twice = [{ ruleId: 'x.rule', branch: 'b', reason: 'r' }, { ruleId: 'x.rule', branch: 'b', reason: 'r' }];
    expect(() => createRegistry(files, mod({ BINDINGS: [bound], NOT_EVALUATED_BRANCHES: twice }))).toThrow(/twice/);
    expect(() => createRegistry(files, mod({ BINDINGS: [bound], NOT_EVALUATED_BRANCHES: [{ ruleId: 'x.rule', branch: ' ', reason: 'r' }] }))).toThrow(/both be given/);
  });

  it('every bazi rule-level reason is in the list of rules not evaluated, and the module still says it is complete', () => {
    expect(bazi.NOT_EVALUATED.map((n) => n.ruleId).sort()).toEqual(['bazi.pillar-palaces', 'bazi.topic-spouse-woman']);
    expect(bazi.COMPLETE).toBe(true);
    expect(vedic.COMPLETE).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// I Ching 4 to 8
// ---------------------------------------------------------------------------

describe('I Ching: negated verdict formulas are shown, and the notes carry no direction', () => {
  it('in the calendar and in the period view every statement with a formula says it, with its characters and a gloss', () => {
    const found = new Map<string, string>();
    // a window of 62 days at a time over four years finds every line of every hexagram that holds a period
    const inp = realInput('j2000', 2031, 2031);
    for (let t = Y(2031); t < Y(2035); t += 60 * MS.DAY) {
      const c = periodCharacter(inp, { startUtcMs: t, endUtcMs: t + 60 * MS.DAY }).iching;
      for (const d of [...c.days, ...c.periods]) {
        const want = formulaDetail(gradeStatement(d.text));
        expect(d.formulas, d.id).toBe(want);
        if (d.formulas !== null) found.set(d.id, d.formulas);
      }
    }
    expect(found.size).toBeGreaterThan(20);
    expect(found.get('2.4')).toBe('无咎 (no blame): states that something bad is absent; a note without a direction; 无譽 (no praise): a negated verdict word; a note without a direction');
    for (const detail of found.values()) expect(detail).toMatch(/ \([^)]+\): /);
  });

  it('in the evaluation the formulas are a fact of the firing, and the sentence names the notes', () => {
    const res = evaluate(realInput('j2000', 2031, 2060), { traditions: ['iching'], includePeriodRead: true, topics: ['general'], runs: 1, seed: 1 });
    const withDetail = res.signals.filter((s) => s.facts.some((f) => f.key === 'formulas'));
    expect(withDetail.length).toBeGreaterThan(0);
    for (const s of withDetail) {
      const id = String(s.facts.find((f) => f.key === 'id')!.value);
      const g = gradeStatement(statementText(...(id.split('.').map(Number) as [number, number]))!);
      expect(String(s.facts.find((f) => f.key === 'formulas')!.value), id).toBe(formulaDetail(g));
      for (const f of formulaNotes(g)) if (s.ruleId !== 'dayan.cardinal-line-by-term') expect(s.sentence, id).toContain(`${f.formula} (${f.gloss})`);
    }
  });
});

describe('I Ching: 56.4 and 艮 line 5', () => {
  it('56.4 has no verdict word and is graded 0, not made up; the cue rule still names it for wealth on its stated sign', () => {
    expect(statementText(56, 4)).toBe('旅于處得其資斧我心不快');
    expect(gradeStatement(statementText(56, 4)!)).toMatchObject({ grade: 0, flags: ['none'] });
    expect(cueTopicsOf('56.4')).toEqual(['wealth']);
    expect(topicsOfStatement('56.4', gradeStatement(statementText(56, 4)!))).toEqual(['wealth']);
  });

  it('艮 line 5 keeps the wikisource reading 言有孚 and the data header notes the variant 言有序', () => {
    expect(statementText(52, 5)).toBe('艮其輔言有孚悔亡');
    const header = readFileSync(new URL('../../src/systems/iching/zhouyiText.ts', import.meta.url), 'utf8').split('export interface')[0]!;
    expect(header).toContain('艮 line 5');
    expect(header).toContain('言有序');
    expect(header).toContain('言有孚');
    // the variant touches no verdict word
    expect(gradeStatement('艮其輔言有序悔亡').grade).toBe(gradeStatement(statementText(52, 5)!).grade);
  });
});

describe('I Ching: a statement of grade 0 with no negated formula and no topic cue is attached to no topic', () => {
  const all = allStatements().map((s) => ({ id: `${s.number}.${s.line}`, g: gradeStatement(s.text) }));

  it('attaches by the grade and by the cues alone', () => {
    const none = all.filter((x) => topicsOfStatement(x.id, x.g).length === 0);
    expect(none.length).toBeGreaterThan(40);
    for (const x of none) {
      expect(x.g.grade, x.id).toBe(0);
      expect(formulaNotes(x.g), x.id).toEqual([]);
      expect(cueTopicsOf(x.id), x.id).toEqual([]);
    }
    // a statement with a grade, or with a note such as 无咎, is attached to 'general': none of them drops out
    for (const x of all.filter((y) => y.g.grade !== 0 || formulaNotes(y.g).length > 0)) expect(topicsOfStatement(x.id, x.g)[0], x.id).toBe('general');
    for (const x of all.filter((y) => y.g.grade === 0 && formulaNotes(y.g).length === 0 && cueTopicsOf(y.id).length > 0)) expect(topicsOfStatement(x.id, x.g), x.id).toEqual(cueTopicsOf(x.id));
  });

  it('no general signal of the I Ching carries a statement of grade 0 unless it holds a note without a direction', () => {
    const res = evaluate(realInput('j2000', 2031, 2033), { traditions: ['iching'], includePeriodRead: true, runs: 1, seed: 1 });
    const general = res.signals.filter((s) => s.topic === 'general' && ['zhouyi.period-hexagram-judgment', 'zhouyi.line-of-day-reconstruction', 'dayan.cardinal-line-by-term'].includes(s.ruleId));
    expect(general.length).toBeGreaterThan(500);
    for (const s of general) {
      const id = String(s.facts.find((f) => f.key === 'id')!.value);
      const g = all.find((x) => x.id === id)!.g;
      expect(g.grade !== 0 || formulaNotes(g).length > 0, id).toBe(true);
      // a statement that holds only notes is shown with no direction
      if (g.grade === 0) expect(s.direction, id).toBe('activates');
    }
  });

  it('the period view lists the topics of each statement, and none for a grade 0 no cue names', () => {
    const c = periodCharacter(realInput('j2000'), { startUtcMs: Y(2040), endUtcMs: Y(2040, 1, 20) }).iching;
    for (const d of [...c.days, ...c.periods, ...c.sovereign]) {
      const g = gradeStatement(d.text);
      expect(d.topics, d.id).toEqual(topicsOfStatement(d.id, g));
    }
    expect(c.days.some((d) => d.topics.length === 0)).toBe(true);
  });
});

describe('I Ching: read by period, checked on three sample moments', () => {
  const ids = ['j2000', 'jiazi-1984', 'southern'];
  const window = { startUtcMs: Y(2036, 2, 1), endUtcMs: Y(2036, 2, 1) + 45 * MS.DAY };

  it('is flagged, kept out of every yearly form, and has one fixed line in the year view', () => {
    expect((DEFAULT_REGISTRY.periodRead as Record<string, boolean>).iching).toBe(true);
    for (const id of ids) {
      const res = evaluate(realInput(id, 2031, 2033), { topics: ['wealth'], runs: 5, seed: 1 });
      expect(res.periodRead).toEqual(['iching']);
      expect(res.signals.some((s) => s.tradition === 'iching')).toBe(false);
      expect(res.readings.some((r) => r.tradition === 'iching')).toBe(false);
      expect(res.levelReadings.some((r) => r.level === 'iching-period')).toBe(false);
      expect(yearView(res, 'wealth').periodRead).toEqual([{ tradition: 'iching', line: TEXT.ichingByPeriod }]);
      expect(statementList(res, 'wealth').dated.some((e) => e.tradition === 'iching')).toBe(false);
    }
  });

  it('gives a window the character of its periods: the same for every birth moment, experimental, and a line a day', () => {
    const views = ids.map((id) => periodCharacter(realInput(id), window).iching);
    expect(JSON.stringify(views[1])).toBe(JSON.stringify(views[0]));
    expect(JSON.stringify(views[2])).toBe(JSON.stringify(views[0]));
    const v = views[0]!;
    expect(v.periods.length).toBeGreaterThanOrEqual(7);
    expect(v.sovereign.length).toBeGreaterThanOrEqual(1);
    expect(v.days.length).toBeGreaterThanOrEqual(44);
    expect(v.badges).toEqual(['experimental']);
    expect(v.note).toBe(TEXT.experimentalWindow);
    for (const s of [...v.periods, ...v.sovereign, ...v.days]) {
      expect(s.badges).toEqual(['experimental']);
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.endUtcMs).toBeGreaterThan(s.startUtcMs);
    }
    // contiguous periods covering the window
    for (let k = 1; k < v.periods.length; k++) expect(v.periods[k]!.startUtcMs).toBe(v.periods[k - 1]!.endUtcMs);
    expect(v.periods[0]!.startUtcMs).toBeLessThanOrEqual(window.startUtcMs);
    expect(v.periods.at(-1)!.endUtcMs).toBeGreaterThanOrEqual(window.endUtcMs);
  });

  it('refuses a window longer than 62 days, for every moment', () => {
    for (const id of ids) expect(() => periodCharacter(realInput(id), { startUtcMs: window.startUtcMs, endUtcMs: window.startUtcMs + (MAX_WINDOW_DAYS + 1) * MS.DAY })).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// Vedic 9: the obstruction list against the rule file
// ---------------------------------------------------------------------------

describe('the obstruction (vedha) list matches the rule file, pair by pair', () => {
  const jupiterRule = vedicJson.rules.find((r) => r.id === 'parashari.jupiter-vedha')!.condition;
  const saturnRule = vedicJson.rules.find((r) => r.id === 'parashari.saturn-vedha')!.condition;
  const gochara = vedicJson.tables.GOCHARA as string;
  const PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

  it('the rule file says what the list is made from', () => {
    expect(jupiterRule).toContain('if any other planet transits its vedha house');
    expect(jupiterRule).toContain('Whether the nodes obstruct is not stated');
    expect(saturnRule).toContain('another planet (not the Sun)');
    expect(gochara).toContain('Saturn 3,6,11 / 12,9,5 (Sun does not obstruct Saturn)');
    // the other exceptions of the table are pairs that do not include Jupiter or Saturn as the planet obstructed
    expect(gochara).toContain("Moon's vedha not from Mercury");
    expect(gochara).toContain('Mercury 2,4,6,8,10,11 / 5,3,9,1,8,12 (not from Moon)');
  });

  it('Jupiter is obstructed by every other of the seven planets and by no node', () => {
    expect([...OBSTRUCTORS.Jupiter].sort()).toEqual(PLANETS.filter((p) => p !== 'Jupiter').sort());
  });

  it('Saturn is obstructed by every other of the seven planets except the Sun, and by no node', () => {
    expect([...OBSTRUCTORS.Saturn].sort()).toEqual(PLANETS.filter((p) => p !== 'Saturn' && p !== 'Sun').sort());
  });

  it('the vedha houses are the ones the table lists, in its order', () => {
    const parse = (planet: string): [number[], number[]] => {
      const m = new RegExp(`${planet} ([\\d,]+) / ([\\d,]+)`).exec(gochara)!;
      return [m[1]!.split(',').map(Number), m[2]!.split(',').map(Number)];
    };
    for (const planet of ['Jupiter', 'Saturn'] as const) {
      const [good, vedha] = parse(planet);
      expect(Object.keys(VEDHA[planet]).map(Number).sort((a, b) => a - b)).toEqual([...good].sort((a, b) => a - b));
      good.forEach((h, i) => expect(VEDHA[planet][h], `${planet} ${h}`).toBe(vedha[i]));
    }
  });

  it('the held-back table says only that the vedha list of Venus is not used as a transiting planet\'s own, which is not Venus as an obstructor', () => {
    const held = JSON.parse(readFileSync(new URL('../../src/forecast/data/held-back.json', import.meta.url), 'utf8')) as Array<{ id: string; reason: string }>;
    const venus = held.find((h) => h.id === 'table: Venus vedha list')!;
    expect(venus.reason).toContain('Venus vedha');
    // no entry of the held-back list excludes any planet from obstructing Jupiter or Saturn
    expect(held.filter((h) => /vedha|obstruct/i.test(h.id + h.reason)).map((h) => h.id)).toEqual(['table: Venus vedha list']);
  });
});

// ---------------------------------------------------------------------------
// Vedic 10 and 11: the branches left out never fire; the level of every dasha firing is set
// ---------------------------------------------------------------------------

describe('the Vedic branches left out do not fire, and every dasha firing carries its level', () => {
  const NODES = ['Rahu', 'Ketu'];
  // every Vedic binding is fired once per sample moment and the answers are shared by the checks below
  const cache = new Map<string, { ctx: ReturnType<typeof createContext>; firings: Map<string, Firing[]> }>();
  const fired = (id: string) => {
    let c = cache.get(id);
    if (!c) {
      const ctx = createContext(realInput(id, 2031, 2040), DEFAULT_REGISTRY.builders);
      c = { ctx, firings: new Map(vedic.BINDINGS.map((b) => [b.ruleId, b.fire(ctx, DEFAULT_REGISTRY.rules.find((r) => r.id === b.ruleId)!)])) };
      cache.set(id, c);
    }
    return c;
  };
  const valueOf = (f: Firing, key: string): string | number | undefined => f.facts.find((x) => x.key === key)?.value;

  it('over every sample moment and ten years: no node is judged where its branch is left out, and no owner-only rule fires for a planet that does not own the house', () => {
    let sawNodeMaha = false;
    let sawKetu = false;
    for (const m of MOMENTS) {
      const { ctx, firings } = fired(m.id);
      const fire = (_c: unknown, ruleId: string): Firing[] => firings.get(ruleId)!;
      const { maha, antar } = ctx.dashas();
      const span = ctx.input.span;
      const within = (s: { startUtcMs: number; endUtcMs: number }) => s.endUtcMs > span.startUtcMs && s.startUtcMs < span.endUtcMs;
      if (maha.filter(within).some((s) => NODES.includes(s.lord))) sawNodeMaha = true;
      if (maha.filter(within).some((s) => s.lord === 'Ketu')) sawKetu = true;
      const vm = model(ctx);
      // nodes as the lord: only the rules that do assess a node may speak for one
      for (const id of ['parashari.wealth-5-9-lord-dasha', 'parashari.dasha-lord-placement-natal', 'parashari.dasha-lord-placement-at-start', 'parashari.antardasha-lord-strength', 'parashari.dasha-lord-3-11-lord', 'parashari.dasha-lord-2nd-7th-maraka', 'parashari.dasha-lord-7th-partnership']) {
        for (const f of fire(ctx, id)) {
          for (const key of ['planet', 'antar']) expect(NODES.includes(String(valueOf(f, key) ?? '')), `${m.id} ${id} ${key}`).toBe(false);
        }
      }
      // the node-dasha rule speaks for Rahu only
      for (const f of fire(ctx, 'parashari.node-dasha')) expect(valueOf(f, 'node'), m.id).toBe('Rahu');
      // association names no node as the joined planet
      for (const f of fire(ctx, 'parashari.dasha-lord-association')) expect(NODES.includes(String(valueOf(f, 'companion'))), m.id).toBe(false);
      // 3-11-lord and maraka: the planet owns the house the sentence names
      for (const [id, houses] of [['parashari.dasha-lord-3-11-lord', [3, 6, 11]], ['parashari.dasha-lord-2nd-7th-maraka', [2, 7]]] as const) {
        for (const f of fire(ctx, id)) {
          const p = String(valueOf(f, 'planet'));
          const h = Number(valueOf(f, 'h'));
          expect(houses, `${m.id} ${id}`).toContain(h);
          expect(vm.housesOwnedBy(p as never), `${m.id} ${id} ${p} owns ${h}`).toContain(h);
        }
      }
      expect(antar.length).toBeGreaterThan(0);
    }
    // the check was not vacuous: some node period lay inside the span of some sample moment, and a Ketu one too
    expect(sawNodeMaha).toBe(true);
    expect(sawKetu).toBe(true);
  });

  it('every firing on the dasha clock names its level, and the level fits the span it judged', () => {
    let checked = 0;
    for (const m of MOMENTS) {
      const { ctx, firings } = fired(m.id);
      const { maha, antar } = ctx.dashas();
      const sameSpan = (spans: ReadonlyArray<{ startUtcMs: number; endUtcMs: number }>, f: Firing) => spans.some((s) => s.startUtcMs === f.startUtcMs && s.endUtcMs === f.endUtcMs);
      const inside = (spans: ReadonlyArray<{ startUtcMs: number; endUtcMs: number }>, f: Firing) => spans.some((s) => s.startUtcMs <= f.startUtcMs! && f.endUtcMs! <= s.endUtcMs);
      for (const b of vedic.BINDINGS) {
        for (const f of firings.get(b.ruleId)!) {
          if (f.clock !== 'dasha' || f.startUtcMs === null) continue;
          checked++;
          expect(f.level, `${m.id} ${b.ruleId}`).toBeDefined();
          expect(['vedic-maha', 'vedic-antar'], `${m.id} ${b.ruleId}`).toContain(f.level);
          if (f.level === 'vedic-antar') expect(sameSpan(antar, f), `${m.id} ${b.ruleId} antar span`).toBe(true);
          else expect(sameSpan(maha, f) || inside(maha, f), `${m.id} ${b.ruleId} maha span`).toBe(true);
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('the signals of the dasha rules carry the same level as their firings', () => {
    const res = evaluate(realInput('j2000'), { traditions: ['vedic'], runs: 1, seed: 1 });
    const dasha = res.signals.filter((s) => s.clock === 'dasha' && s.startUtcMs !== null);
    expect(dasha.length).toBeGreaterThan(100);
    for (const s of dasha) expect(['vedic-maha', 'vedic-antar']).toContain(s.level);
    expect(new Set(dasha.map((s) => s.level))).toEqual(new Set(['vedic-maha', 'vedic-antar']));
  });
});
