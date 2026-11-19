// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The decade grid, the year headline, pointers, the edge of a year, joined spans, rules read by
 * period, declared levels, plain words in the agreement display and the JSON: each point proved
 * on invented rules whose answers are known. The same points on a sample moment, with the real
 * rules, are in gridSample.test.ts.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  agreementDisplay,
  createRegistry,
  declareLevels,
  decadeGrid,
  DEFAULT_FORECAST_CONVENTIONS,
  DEFAULT_REGISTRY,
  evaluate,
  FORECAST_CONVENTION_SPECS,
  GRID_GLYPH,
  groupsSentence,
  gridText,
  headlineOf,
  joinSpans,
  levelCoverage,
  mixedLevelPhrase,
  narrate,
  NOTE,
  periodCharacter,
  pointerLabel,
  RegistryError,
  reportJson,
  runConfig,
  sharesOf,
  statementList,
  TEXT,
  VERDICT_TEXT,
  WORD,
  yearHeadline,
  yearView,
  countsIn,
  type Firing,
  type ForecastResult,
  type LevelId,
  type Rule,
  type RuleBinding,
  type StatementEntry,
  type Topic,
  type Tradition,
} from '../../src/forecast/index.ts';
import type { TraditionModule } from '../../src/forecast/registry.ts';
import { MS } from '../../src/substrate/time.ts';
import { input, rule } from './synthetic.ts';

const Y = (y: number, m = 0, d = 1, h = 0): number => Date.UTC(y, m, d, h);
const DAY = MS.DAY;

// ---------------------------------------------------------------------------
// An invented world with known answers (span 2031 to 2040)
// ---------------------------------------------------------------------------

const facts = [{ key: 'thing', label: 'Thing', value: 'a gain' }];

interface Spec {
  id: string;
  tradition: Tradition;
  direction?: Rule['direction'];
  stage?: Rule['stage'];
  topics?: Topic[];
  inputs?: string[];
  levels?: LevelId[];
  periodRead?: boolean;
  /** [clock, start, end, level?, direction?] */
  fires: Array<[Firing['clock'], number | null, number | null, Firing['level']?, Firing['direction']?]>;
  extraFacts?: Firing['facts'];
}

const calls: Record<string, number> = {};

function world(specs: Spec[], moduleExtra: Partial<Record<Tradition, Partial<TraditionModule>>> = {}) {
  const rules = specs.map((s) => rule({ id: s.id, tradition: s.tradition, direction: s.direction ?? 'favourable', stage: s.stage ?? 'period-lord', topics: s.topics ?? ['wealth'], inputs: s.inputs ?? [], template: `${s.id} says something.` }));
  const bindings = (t: Tradition): RuleBinding[] =>
    specs
      .filter((s) => s.tradition === t)
      .map((s) => ({
        ruleId: s.id,
        tradition: t,
        ...(s.levels ? { levels: s.levels } : {}),
        ...(s.periodRead ? { periodRead: true } : {}),
        fire: () => {
          calls[s.id] = (calls[s.id] ?? 0) + 1;
          return s.fires.map(([clock, a, b, level, direction]) => ({ clock, startUtcMs: a, endUtcMs: b, level, direction, facts: [...facts, ...(s.extraFacts ?? [])], dedupeInstance: `${a}-${b}` }) as Firing);
        },
      }));
  const files = (['bazi', 'vedic', 'iching', 'western'] as const).map((t) => ({ tradition: t, method: 'synthetic', topicDefinitions: [], tables: {}, rules: rules.filter((r) => r.tradition === t) }));
  const mod = (t: Tradition): TraditionModule => ({ BINDINGS: bindings(t), NOT_EVALUATED: [], buildContext: () => undefined, COMPLETE: false, ...moduleExtra[t] });
  return createRegistry(files, { bazi: mod('bazi'), vedic: mod('vedic'), iching: mod('iching'), western: mod('western') });
}

const SPECS: Spec[] = [
  { id: 'b.year-up', tradition: 'bazi', levels: ['bazi-year'], fires: [['solar-longitude', Y(2034), Y(2035)]] },
  { id: 'b.year-down', tradition: 'bazi', direction: 'unfavourable', levels: ['bazi-year'], fires: [['solar-longitude', Y(2034), Y(2035)]] },
  { id: 'b.luck', tradition: 'bazi', levels: ['bazi-luck'], fires: [['luck', Y(2033), Y(2036)]] },
  { id: 'v.maha', tradition: 'vedic', direction: 'unfavourable', levels: ['vedic-maha', 'vedic-antar'], fires: [['dasha', Y(2035), Y(2036), 'vedic-maha']] },
  { id: 'v.point-a', tradition: 'vedic', stage: 'activation', direction: 'activates', levels: ['vedic-maha'], fires: [['dasha', Y(2036), Y(2037), 'vedic-maha']] },
  { id: 'v.point-b', tradition: 'vedic', stage: 'activation', direction: 'activates', levels: ['vedic-maha'], fires: [['dasha', Y(2036), Y(2037), 'vedic-maha']] },
  { id: 'v.jupiter-never', tradition: 'vedic', levels: ['jupiter-moon'], fires: [] },
  { id: 'w.prof', tradition: 'western', levels: ['western-profection'], fires: [['birthday', Y(2033), Y(2034), 'western-profection']] },
  { id: 'b.natal', tradition: 'bazi', stage: 'natal-promise', levels: ['natal'], fires: [['birthday', null, null]] },
  { id: 'b.natal-pointer', tradition: 'bazi', stage: 'natal-promise', direction: 'activates', levels: ['natal'], fires: [['birthday', null, null]] },
];

const ICHING: Spec = { id: 'i.period', tradition: 'iching', levels: ['iching-period'], fires: [['solar-longitude', Y(2033), Y(2034)]] };
const withIching = (specs: Spec[]) => world([...specs, ICHING], { iching: { PERIOD_READ: true } });

const TOPIC = 'wealth' as const;
const run = (specs: Spec[] = SPECS, extra: Parameters<typeof evaluate>[1] = {}, inputExtra: Parameters<typeof input>[0] = {}): ForecastResult =>
  evaluate(input(inputExtra), { registry: withIching(specs), traditions: ['bazi', 'vedic', 'western', 'iching'], topics: [TOPIC], runs: 30, ...extra });
const idx = (year: number): number => year - 2031;

// ---------------------------------------------------------------------------
// Decision 1: the decade grid
// ---------------------------------------------------------------------------

describe('the decade grid', () => {
  const res = run();
  const grid = decadeGrid(res, TOPIC);
  const row = (level: LevelId) => grid.rows.find((r) => r.level === level)!;
  const cell = (level: LevelId, year: number) => row(level).cells[idx(year)]!;

  it('has one row per level in a fixed order, grouped by tradition, and one column per year', () => {
    expect(grid.years).toEqual([2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040]);
    expect(grid.rows.map((r) => r.level)).toEqual(['bazi-luck', 'bazi-year', 'vedic-maha', 'vedic-antar', 'jupiter-moon', 'western-profection']);
    expect(grid.groups.map((g) => [g.tradition, g.name, g.rows.map((r) => r.level)])).toEqual([
      ['bazi', 'BaZi', ['bazi-luck', 'bazi-year']],
      ['vedic', 'Vedic astrology', ['vedic-maha', 'vedic-antar', 'jupiter-moon']],
      ['western', 'Western astrology', ['western-profection']],
    ]);
    for (const r of grid.rows) expect(r.cells.map((c) => c.year)).toEqual(grid.years);
  });

  it('gives a level that is declared but never fires a row of silent cells, and a level that fires a row of words', () => {
    // v.jupiter-never declares jupiter-moon and v.maha declares vedic-antar, and neither speaks in the span
    for (const level of ['jupiter-moon', 'vedic-antar'] as const) {
      expect(row(level).cells.every((c) => c.word === 'nothing-said' && c.pointers === null && c.entryIds.length === 0)).toBe(true);
      expect(row(level).note).toBeNull();
      expect(row(level).cells[0]!.silentReason).toBeNull();
    }
    expect(row('western-profection').cells.map((c) => c.word)).toEqual(['nothing-said', 'nothing-said', 'supports', 'nothing-said', 'nothing-said', 'nothing-said', 'nothing-said', 'nothing-said', 'nothing-said', 'nothing-said']);
  });

  it('puts the word, the plain counts, the shares, the ids and the note in a cell', () => {
    const c = cell('bazi-year', 2034);
    expect(c).toMatchObject({ year: 2034, slice: idx(2034), word: 'mixed', wordText: 'mixed', note: NOTE.rulesConflict, tally: { supports: 1, cautions: 1, mixed: 0, active: 0 }, tallyText: '1 rule supports, 1 cautions' });
    expect(c.shares).toEqual({ supports: 0.5, cautions: 0.5, mixed: 0 });
    expect(c.entryIds).toHaveLength(2);
    expect(c.entryIds.every((id) => /^b\.year-(up|down)@/.test(id))).toBe(true);
    expect(c.signalIds).toEqual(c.entryIds);
    // a silent cell reads as such, in the phrasebook's words
    expect(cell('bazi-year', 2031)).toMatchObject({ word: 'nothing-said', wordText: WORD['nothing-said'], tallyText: 'no rule speaks', entryIds: [], pointers: null });
  });

  it('draws shares that are fractions of the deciding statements, all zero for a cell with none', () => {
    expect(sharesOf({ supports: 3, cautions: 1, mixed: 0, active: 0 })).toEqual({ supports: 0.75, cautions: 0.25, mixed: 0 });
    expect(sharesOf({ supports: 1, cautions: 1, mixed: 2, active: 9 })).toEqual({ supports: 0.25, cautions: 0.25, mixed: 0.5 });
    expect(sharesOf({ supports: 0, cautions: 0, mixed: 0, active: 4 })).toEqual({ supports: 0, cautions: 0, mixed: 0 });
  });

  it('keeps the period-read line for the I Ching as one fixed line under the grid, and no row for it', () => {
    expect(grid.periodRead).toEqual([{ tradition: 'iching', line: TEXT.ichingByPeriod }]);
    expect(grid.rows.some((r) => r.level === 'iching-period')).toBe(false);
    expect(gridText(grid).at(-1)).toBe(TEXT.ichingByPeriod);
  });

  it('draws the table with + for supports, - for cautions, ~ for mixed and . for silent', () => {
    expect(GRID_GLYPH).toEqual({ supports: '+', cautions: '-', mixed: '~', 'nothing-said': '.' });
    const lines = gridText(grid);
    const prof = lines.find((l) => l.startsWith('Western annual profection'))!;
    expect(prof.replace(/\s+/g, ' ')).toBe('Western annual profection . . + . . . . . . .');
    expect(lines.find((l) => l.startsWith('BaZi year pillar'))!.replace(/\s+/g, ' ')).toBe('BaZi year pillar . . . ~ . . . . . .');
  });

  it('carries the grid and the headlines in the JSON report, and keeps the schema name', () => {
    const j = reportJson(res, TOPIC) as Record<string, unknown>;
    expect(j.schema).toBe('overlay-forecast/1');
    expect(j.grid).toEqual(grid);
    expect(j.headlines).toEqual(yearView(res, TOPIC).years.map((y) => ({ year: y.year, headline: y.headline })));
    expect(JSON.parse(JSON.stringify(j))).toEqual(j);
  });
});

// ---------------------------------------------------------------------------
// Declared levels: what a binding can say does not depend on what fired
// ---------------------------------------------------------------------------

describe('levels declared by the bindings', () => {
  it('give a level a row for a topic only if a rule of that topic declares it', () => {
    const w = world([
      { id: 'b.quiet', tradition: 'bazi', levels: ['bazi-year'], topics: ['career'], fires: [] },
      { id: 'v.quiet', tradition: 'vedic', levels: ['jupiter-moon'], fires: [] },
    ]);
    const res = evaluate(input(), { registry: w, traditions: ['bazi', 'vedic'], topics: ['wealth', 'career'], runs: 5 });
    expect(decadeGrid(res, 'wealth').rows.map((r) => r.level)).toEqual(['jupiter-moon']);
    expect(decadeGrid(res, 'career').rows.map((r) => r.level)).toEqual(['bazi-year']);
  });

  it('count the bound and the withheld rules of a level, leave out the traditions that are off and the rules read by period', () => {
    const w = world([
      { id: 'b.a', tradition: 'bazi', levels: ['bazi-luck'], fires: [] },
      { id: 'b.sex', tradition: 'bazi', levels: ['bazi-luck'], inputs: ['sex'], fires: [] },
      { id: 'w.day', tradition: 'western', levels: ['western-transits'], periodRead: true, fires: [] },
      { id: 'v.a', tradition: 'vedic', levels: ['vedic-maha'], fires: [] },
    ]);
    const cov = levelCoverage(w, runConfig(input(), ['bazi', 'western']), ['wealth']);
    expect(cov).toEqual([{ level: 'bazi-luck', topic: 'wealth', bound: 1, withheld: ['needs-sex-convention'] }]);
  });

  it('show a level whose rules are all withheld as silent with the stated reason, and drop the reason once the convention is named', () => {
    const w = world([{ id: 'b.sex', tradition: 'bazi', levels: ['bazi-luck'], inputs: ['sex'], fires: [['luck', Y(2033), Y(2034)]] }]);
    const none = decadeGrid(evaluate(input(), { registry: w, traditions: ['bazi'], topics: [TOPIC], runs: 5 }), TOPIC);
    expect(none.rows).toHaveLength(1);
    expect(none.rows[0]!.note).toBe(NOTE.needsSexConvention);
    expect(none.rows[0]!.cells.every((c) => c.word === 'nothing-said' && c.silentReason === NOTE.needsSexConvention)).toBe(true);
    const named = decadeGrid(evaluate(input({ forecastConventions: { baziSexConvention: 'male-chart' } }), { registry: w, traditions: ['bazi'], topics: [TOPIC], runs: 5 }), TOPIC);
    expect(named.rows[0]!.note).toBeNull();
    expect(named.rows[0]!.cells[idx(2033)]!.word).toBe('supports');
  });

  it('say the birth time is needed where it is unknown', () => {
    const w = {
      ...world([{ id: 'w.t', tradition: 'western', levels: ['western-profection'], fires: [] }]),
    };
    const b = w.bindings.get('w.t')!;
    const timed = createRegistry(
      [{ tradition: 'western', method: 's', topicDefinitions: [], tables: {}, rules: [rule({ id: 'w.t', tradition: 'western' })] }],
      { bazi: { BINDINGS: [], NOT_EVALUATED: [], buildContext: () => undefined, COMPLETE: false }, vedic: { BINDINGS: [], NOT_EVALUATED: [], buildContext: () => undefined, COMPLETE: false }, iching: { BINDINGS: [], NOT_EVALUATED: [], buildContext: () => undefined, COMPLETE: false }, western: { BINDINGS: [{ ...b, requires: { birthTime: true } }], NOT_EVALUATED: [], buildContext: () => undefined, COMPLETE: false } },
    );
    const g = decadeGrid(evaluate(input({ birthTimeUncertaintyMinutes: null }), { registry: timed, traditions: ['western'], topics: [TOPIC], runs: 5 }), TOPIC);
    expect(g.rows[0]!.note).toBe(NOTE.needsBirthTime);
  });

  it('refuse a level of another tradition, an empty list, and a binding or a row that the table does not match', () => {
    const files = [{ tradition: 'bazi' as const, method: 's', topicDefinitions: [], tables: {}, rules: [rule({ id: 'b.x', tradition: 'bazi' })] }];
    const mod = (BINDINGS: RuleBinding[]): Record<Tradition, TraditionModule> => {
      const m = (t: Tradition): TraditionModule => ({ BINDINGS: t === 'bazi' ? BINDINGS : [], NOT_EVALUATED: [], buildContext: () => undefined, COMPLETE: false });
      return { bazi: m('bazi'), vedic: m('vedic'), iching: m('iching'), western: m('western') };
    };
    const base: RuleBinding = { ruleId: 'b.x', tradition: 'bazi', fire: () => [] };
    expect(() => createRegistry(files, mod([{ ...base, levels: ['vedic-maha'] }]))).toThrow(RegistryError);
    expect(() => createRegistry(files, mod([{ ...base, levels: [] }]))).toThrow(/levels is empty/);
    expect(() => createRegistry(files, mod([{ ...base, levels: ['bazi-year', 'natal'] }]))).not.toThrow();
    expect(() => declareLevels([base], {})).toThrow(/declares no levels/);
    expect(() => declareLevels([base], { 'b.x': ['bazi-year'], 'b.gone': ['bazi-year'] })).toThrow(/not bound/);
    expect(declareLevels([base], { 'b.x': ['bazi-year'] })[0]!.levels).toEqual(['bazi-year']);
  });
});

// ---------------------------------------------------------------------------
// Decision 2: the year headline
// ---------------------------------------------------------------------------

describe('the year headline', () => {
  const t = (supports: number, cautions: number, mixed = 0) => ({ supports, cautions, mixed, active: 0 });

  it('groups the level labels by word, in the documented order and form', () => {
    const cells = [
      { label: 'Vedic antardasha', word: 'supports' as const, tally: t(1, 0) },
      { label: 'Western solar return', word: 'supports' as const, tally: t(1, 0) },
      { label: 'Saturn from the Moon', word: 'cautions' as const, tally: t(0, 1) },
      { label: 'BaZi year pillar', word: 'mixed' as const, tally: t(3, 1) },
      { label: 'Vedic mahadasha', word: 'mixed' as const, tally: t(0, 0, 1) },
      { label: 'Jupiter from the Moon', word: 'nothing-said' as const, tally: t(0, 0) },
    ];
    expect(headlineOf(cells)).toBe('Supports: Vedic antardasha, Western solar return. Cautions: Saturn from the Moon. Mixed: BaZi year pillar (3 rules support, 1 cautions), Vedic mahadasha. Silent: Jupiter from the Moon.');
  });

  it('leaves out a group with no level, shows the tally of a mixed level only, and says where nothing speaks', () => {
    expect(yearHeadline({ supports: ['A'], cautions: [], mixed: [], silent: [] })).toBe('Supports: A.');
    expect(yearHeadline({ supports: [], cautions: ['B'], mixed: [], silent: ['C'] })).toBe('Cautions: B. Silent: C.');
    expect(yearHeadline({ supports: [], cautions: [], mixed: [], silent: ['C', 'D'] })).toBe(`${TEXT.nothingAtAnyLevel} Silent: C, D.`);
    // a level that is mixed because one rule says so itself needs no tally: it would repeat "Mixed"
    expect(mixedLevelPhrase('X', t(0, 0, 1))).toBe('X');
    expect(mixedLevelPhrase('X', t(1, 0, 1))).toBe('X (1 rule supports, 1 is stated as mixed)');
    expect(mixedLevelPhrase('X', t(0, 0, 2))).toBe('X (2 rules are stated as mixed)');
  });

  it('is the one sentence of the year view and of the written forecast, and the long summary is gone', () => {
    const res = run();
    const view = yearView(res, TOPIC);
    expect(view.years[idx(2034)]!.headline).toBe('Supports: BaZi luck pillar. Mixed: BaZi year pillar (1 rule supports, 1 cautions). Silent: Vedic mahadasha, Vedic antardasha, Jupiter from the Moon, Western annual profection.');
    expect(view.years[idx(2033)]!.headline).toBe('Supports: BaZi luck pillar, Western annual profection. Silent: BaZi year pillar, Vedic mahadasha, Vedic antardasha, Jupiter from the Moon.');
    expect('summary' in view.years[0]!).toBe(false);
    expect(decadeGrid(res, TOPIC).headlines).toEqual(view.years.map((y) => y.headline));
    // the written forecast: when the groups do not stand together it says the headline
    const text = narrate(res, TOPIC).filter((s) => s.kind === 'summary').map((s) => s.text);
    for (const s of text) expect(s).toMatch(/^(In \d{4}, |Supports: |Cautions: |Mixed: |No level says anything)/);
    expect(text).toContain(view.years[idx(2034)]!.headline);
  });
});

// ---------------------------------------------------------------------------
// Decision 3: pointers
// ---------------------------------------------------------------------------

describe('pointers', () => {
  const res = run();
  const list = statementList(res, TOPIC);
  const grid = decadeGrid(res, TOPIC);

  it('are no entry of the default list, and are listed once apart, each with its true dates', () => {
    expect(list.dated.some((e) => e.word === 'active')).toBe(false);
    expect(list.dated.map((e) => e.ruleId)).not.toContain('v.point-a');
    expect(list.pointers.map((e) => e.ruleId).sort()).toEqual(['v.point-a', 'v.point-b']);
    for (const e of list.pointers) expect([e.word, e.fullStartUtcMs, e.fullEndUtcMs]).toEqual(['active', Y(2036), Y(2037)]);
  });

  it('are folded into one group per level and year, with a count and the label of the phrasebook, and the group lists them', () => {
    const c = grid.rows.find((r) => r.level === 'vedic-maha')!.cells[idx(2036)]!;
    expect(c.pointers).toMatchObject({ count: 2, label: pointerLabel(2) });
    expect(c.pointers!.entries.map((e) => e.ruleId).sort()).toEqual(['v.point-a', 'v.point-b']);
    expect(c.pointers!.signalIds).toHaveLength(2);
    expect(pointerLabel(1)).toBe('1 note without a direction: a statement that marks the topic or says where a count reaches');
    // the other years of the level have no group
    expect(grid.rows.find((r) => r.level === 'vedic-maha')!.cells.filter((x) => x.pointers !== null)).toHaveLength(1);
  });

  it('leave the word rule alone: a level with pointers only reads as nothing said, with the note that the topic is active', () => {
    const c = grid.rows.find((r) => r.level === 'vedic-maha')!.cells[idx(2036)]!;
    expect(c).toMatchObject({ word: 'nothing-said', note: NOTE.topicActive, tallyText: 'no rule speaks', entryIds: [] });
    expect(c.tally.active).toBe(2);
  });

  it('appear in no headline and in no tally text', () => {
    const view = yearView(res, TOPIC);
    // in 2036 the mahadasha has two pointers and nothing else: it is silent, and nothing says "active"
    expect(view.years[idx(2036)]!.headline).toBe(`${TEXT.nothingAtAnyLevel} Silent: BaZi luck pillar, BaZi year pillar, Vedic mahadasha, Vedic antardasha, Jupiter from the Moon, Western annual profection.`);
    expect(view.years.every((y) => !/active|pointer/.test(y.headline))).toBe(true);
    for (const r of grid.rows) for (const c of r.cells) expect(c.tallyText).not.toMatch(/active|mark the topic/);
  });

  it('do not decide a word beside deciding statements: the pointer is counted apart and the word stays', () => {
    const w = run([
      { id: 'v.up', tradition: 'vedic', levels: ['vedic-maha'], fires: [['dasha', Y(2035), Y(2036), 'vedic-maha']] },
      { id: 'v.pointer', tradition: 'vedic', stage: 'activation', direction: 'activates', levels: ['vedic-maha'], fires: [['dasha', Y(2035), Y(2036), 'vedic-maha']] },
    ]);
    const c = decadeGrid(w, TOPIC).rows[0]!.cells[idx(2035)]!;
    expect(c).toMatchObject({ word: 'supports', note: null, tallyText: '1 rule supports', pointers: { count: 1 } });
    expect(c.entryIds).toHaveLength(1);
    expect(yearView(w, TOPIC).years[idx(2035)]!.headline).toBe('Supports: Vedic mahadasha.');
  });

  it('are kept out of the natal list too, and counted apart', () => {
    expect(list.natal.map((e) => e.ruleId)).toEqual(['b.natal']);
    expect(list.natalPointers.map((e) => e.ruleId)).toEqual(['b.natal-pointer']);
    expect(list.natalPointers[0]!.word).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// Decision 4: the edge of a year
// ---------------------------------------------------------------------------

describe('the edge of a year', () => {
  const E: Spec[] = [
    // twenty-two days of one year and the whole of the next: it counts at 15 days and not at 30
    { id: 'w.mid', tradition: 'western', levels: ['western-profection'], fires: [['birthday', Y(2031, 11, 10), Y(2032, 5, 1), 'western-profection']] },
    // a statement of two days across the turn of the year: it overlaps each year by one day and extends beyond both
    { id: 'w.turn', tradition: 'western', levels: ['western-profection'], fires: [['birthday', Y(2033, 11, 31), Y(2034, 0, 2), 'western-profection']] },
    // wholly inside a year: counts however short it is
    { id: 'w.short', tradition: 'western', levels: ['western-profection'], fires: [['birthday', Y(2035, 2, 1), Y(2035, 2, 3), 'western-profection']] },
    // twelve days of one year and the whole of the next
    { id: 'w.lead', tradition: 'western', levels: ['western-profection'], fires: [['birthday', Y(2036, 11, 20), Y(2037, 2, 1), 'western-profection']] },
    // a birthday statement from noon on 1 January: half a day of the year before
    { id: 'w.noon', tradition: 'western', levels: ['western-profection'], fires: [['birthday', Y(2038, 0, 1, 12), Y(2039, 0, 1, 12), 'western-profection']] },
    // a point in time inside a year
    { id: 'w.point', tradition: 'western', levels: ['western-profection'], fires: [['birthday', Y(2040, 5, 1), Y(2040, 5, 1), 'western-profection']] },
  ];
  const words = (r: ForecastResult): string[] => decadeGrid(r, TOPIC).rows.find((x) => x.level === 'western-profection')!.cells.map((c) => c.word[0]!);

  it('is a named convention, default 15 days, with its entry in the specs and in the generated document', () => {
    expect(DEFAULT_FORECAST_CONVENTIONS.sliceEdgeDays).toBe(15);
    const spec = FORECAST_CONVENTION_SPECS.find((s) => s.key === 'sliceEdgeDays')!;
    expect(spec.options.map((o) => o.value)).toEqual([0, 15, 30]);
    expect(readFileSync(new URL('../../../../docs/CONVENTIONS.md', import.meta.url), 'utf8')).toContain('Setting `sliceEdgeDays`');
  });

  it('keeps a statement that overlaps a year by fewer days and extends beyond it out of the word, and keeps a whole one in', () => {
    const r = run(E);
    // 2031: twenty-two days count at 15; 2033 and 2034: the two-day statement counts for neither; 2035: the short one counts;
    // 2036: twelve days do not; 2037: they do; 2038: the noon statement counts for 2038 and not for the year before it (2039 is the one it ends in, by half a day); 2040: the point counts
    expect(words(r)).toEqual(['s', 's', 'n', 'n', 's', 'n', 's', 's', 'n', 's']);
  });

  it('applies to the tally, the entries and the headline of the year, and to the readings agreement is made from', () => {
    const r = run(E);
    const c = decadeGrid(r, TOPIC).rows[0]!.cells;
    expect(c[idx(2033)]).toMatchObject({ word: 'nothing-said', entryIds: [], tally: { supports: 0 } });
    expect(c[idx(2037)]!.entryIds).toHaveLength(1);
    expect(yearView(r, TOPIC).years[idx(2033)]!.headline).toBe(`${TEXT.nothingAtAnyLevel} Silent: Western annual profection.`);
    expect(r.readings.find((x) => x.tradition === 'western' && x.group === null && x.slice === idx(2033))!.word).toBe('nothing-said');
  });

  it('never hides the statement: the list shows its true dates', () => {
    const list = statementList(run(E), TOPIC);
    const turn = list.dated.find((e) => e.ruleId === 'w.turn')!;
    expect([turn.fullStartUtcMs, turn.fullEndUtcMs]).toEqual([Y(2033, 11, 31), Y(2034, 0, 2)]);
    expect([turn.startUtcMs, turn.endUtcMs]).toEqual([Y(2033, 11, 31), Y(2034, 0, 2)]);
    expect(list.dated.map((e) => e.ruleId).sort()).toEqual(['w.lead', 'w.mid', 'w.noon', 'w.point', 'w.short', 'w.turn']);
  });

  it('changes with the convention: 0 counts any overlap, 30 asks for a month', () => {
    expect(words(run(E, {}, { forecastConventions: { sliceEdgeDays: 0 } }))).toEqual(['s', 's', 's', 's', 's', 's', 's', 's', 's', 's']);
    expect(words(run(E, {}, { forecastConventions: { sliceEdgeDays: 30 } }))).toEqual(['n', 's', 'n', 'n', 's', 'n', 's', 's', 'n', 's']);
  });

  it('is decided by countsIn, which treats a statement wholly inside a slice as counting and a statement outside as not', () => {
    const slice = { startUtcMs: Y(2034), endUtcMs: Y(2035) };
    expect(countsIn({ startUtcMs: Y(2034, 5), endUtcMs: Y(2034, 5, 2) }, slice, 15)).toBe(true);
    expect(countsIn({ startUtcMs: Y(2034, 5), endUtcMs: Y(2034, 5) }, slice, 15)).toBe(true);
    expect(countsIn({ startUtcMs: Y(2033), endUtcMs: Y(2034, 0, 15) }, slice, 15)).toBe(false);
    expect(countsIn({ startUtcMs: Y(2033), endUtcMs: Y(2034, 0, 16) }, slice, 15)).toBe(true);
    expect(countsIn({ startUtcMs: Y(2034, 11, 17), endUtcMs: Y(2036) }, slice, 15)).toBe(true);
    expect(countsIn({ startUtcMs: Y(2034, 11, 18), endUtcMs: Y(2036) }, slice, 15)).toBe(false);
    expect(countsIn({ startUtcMs: Y(2035), endUtcMs: Y(2036) }, slice, 0)).toBe(false);
    expect(countsIn({ startUtcMs: null, endUtcMs: null }, slice, 15)).toBe(false);
    expect(DAY).toBe(86_400_000);
  });
});

// ---------------------------------------------------------------------------
// Decision 5: joined spans
// ---------------------------------------------------------------------------

describe('joined spans', () => {
  const J: Spec[] = [
    { id: 'w.join', tradition: 'western', levels: ['western-profection'], fires: [['birthday', Y(2033), Y(2034), 'western-profection'], ['birthday', Y(2034), Y(2035), 'western-profection'], ['birthday', Y(2035), Y(2036), 'western-profection']] },
    { id: 'w.gap', tradition: 'western', levels: ['western-profection'], fires: [['birthday', Y(2037), Y(2038), 'western-profection'], ['birthday', Y(2039), Y(2040), 'western-profection']] },
    { id: 'w.turns', tradition: 'western', levels: ['western-profection'], fires: [['birthday', Y(2031), Y(2032), 'western-profection', 'favourable'], ['birthday', Y(2032), Y(2033), 'western-profection', 'unfavourable']] },
  ];
  const res = run(J);
  const list = statementList(res, TOPIC);

  it('show one entry with the joined span for periods of one rule that touch and say the same, and keep the ids of all the firings', () => {
    const joined = list.dated.filter((e) => e.ruleId === 'w.join');
    expect(joined).toHaveLength(1);
    expect(joined[0]!.signalIds).toHaveLength(3);
    expect([joined[0]!.startUtcMs, joined[0]!.endUtcMs]).toEqual([Y(2033), Y(2036)]);
    expect(joined[0]!.signalId).toBe(joined[0]!.signalIds[0]);
    for (const id of joined[0]!.signalIds) expect(list.entryOf[id]).toBe(joined[0]!.signalId);
  });

  it('do not join periods that do not touch, or that say something else', () => {
    expect(list.dated.filter((e) => e.ruleId === 'w.gap')).toHaveLength(2);
    // the same sentence with another word is another statement
    expect(list.dated.filter((e) => e.ruleId === 'w.turns').map((e) => e.word)).toEqual(['supports', 'cautions']);
  });

  it('leave the readings and the tallies as they were: each year counts its own firing', () => {
    const grid = decadeGrid(res, TOPIC);
    const cells = grid.rows[0]!.cells;
    for (const y of [2033, 2034, 2035]) expect(cells[idx(y)]!.tally.supports, String(y)).toBeGreaterThanOrEqual(1);
    const w = res.levelReadings.filter((r) => r.level === 'western-profection' && r.topic === TOPIC);
    // in 2034 the middle firing is the only one of w.join that counts
    expect(w[idx(2034)]!.signalIds.filter((id) => id.startsWith('w.join@'))).toHaveLength(1);
    // and the year view refers to the firing, which the list resolves to the joined entry
    const refs = yearView(res, TOPIC).years[idx(2034)]!.levels.find((l) => l.level === 'western-profection')!.entries.map((e) => e.signalId);
    const joined = list.dated.find((e) => e.ruleId === 'w.join')!;
    expect(refs.filter((id) => joined.signalIds.includes(id))).toHaveLength(1);
    expect(cells[idx(2034)]!.entryIds.filter((id) => id === joined.signalId)).toHaveLength(1);
  });

  it('is a pure function of the sorted entries, and keeps the true span of the clipped first firing', () => {
    const entry = (id: string, a: number, b: number): StatementEntry => ({ signalId: id, signalIds: [id], ruleId: 'r', tradition: 'bazi', level: 'bazi-year', levelLabel: 'x', word: 'supports', sentence: 's', badges: [], startUtcMs: a, endUtcMs: b, fullStartUtcMs: a, fullEndUtcMs: b, beganBefore: false, endsAfter: false, alsoReportedBy: 1, qualifiers: [] });
    const out = joinSpans([entry('b', 10, 20), entry('a', 0, 10), entry('c', 21_000, 30_000)]);
    expect(out.map((e) => [e.signalId, e.signalIds, e.fullStartUtcMs, e.fullEndUtcMs, e.alsoReportedBy])).toEqual([
      ['a', ['a', 'b'], 0, 20, 2],
      ['c', ['c'], 21_000, 30_000, 1],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Decision 6: read by period, per rule
// ---------------------------------------------------------------------------

describe('a rule read by period', () => {
  const dayFacts = [{ key: 'date', label: 'Day', value: '2035-03-10' }];
  const P: Spec[] = [
    { id: 'w.year', tradition: 'western', levels: ['western-profection'], fires: [['birthday', Y(2035), Y(2036), 'western-profection']] },
    { id: 'w.day', tradition: 'western', levels: ['western-transits'], periodRead: true, extraFacts: dayFacts, fires: [['moon', Y(2035, 2, 8), Y(2035, 2, 12)], ['moon', Y(2035, 4, 8), Y(2035, 4, 12)]] },
  ];

  it('is not computed when a long span is evaluated, and is in no yearly form', () => {
    calls['w.day'] = 0;
    const res = run(P);
    expect(calls['w.day']).toBe(0);
    expect(res.periodReadRules).toEqual(['w.day']);
    expect(res.signals.some((s) => s.ruleId === 'w.day')).toBe(false);
    expect(decadeGrid(res, TOPIC).rows.map((r) => r.level)).toEqual(['western-profection']);
    expect(statementList(res, TOPIC).dated.map((e) => e.ruleId)).toEqual(['w.year']);
  });

  it('runs when asked for, and still stays out of every reading, agreement and readable form', () => {
    const res = run(P, { includePeriodRead: true });
    expect(res.signals.filter((s) => s.ruleId === 'w.day')).toHaveLength(2);
    expect(statementList(res, TOPIC).dated.some((e) => e.ruleId === 'w.day')).toBe(false);
    expect(res.readings.every((r) => !r.signalIds.some((id) => id.startsWith('w.day@')))).toBe(true);
    expect(res.levelReadings.some((r) => r.level === 'western-transits')).toBe(false);
  });

  it('is flagged on the binding, and the flag is the only thing that sets it apart from the rest of its tradition', () => {
    const reg = withIching(P);
    expect([...reg.periodReadRules]).toEqual(['w.day']);
    expect(reg.periodRead.western).toBe(false);
    expect([...DEFAULT_REGISTRY.periodReadRules]).toEqual(['lilly.transit.daily-cusps']);
  });

  it('comes back from the short-window function beside the I Ching\'s, each tradition in its own part, the Western part without the badge "experimental"', () => {
    const reg = withIching(P);
    const window = { startUtcMs: Y(2035, 2, 1), endUtcMs: Y(2035, 2, 31) };
    const c = periodCharacter(input(), window, { registry: reg });
    expect(Object.keys(c)).toEqual(['window', 'iching', 'western']);
    expect(c.iching.badges).toEqual(['experimental']);
    expect(c.western.badges).toEqual([]);
    expect(c.western.note).toBe(TEXT.westernWindow);
    expect(c.western.unavailable).toBeNull();
    // only the day statement inside the window: the one of May is outside
    expect(c.western.statements.map((s) => s.sentence)).toEqual(['w.day says something.']);
    expect(c.western.statements[0]).toMatchObject({ ruleId: 'w.day', dayUtcMs: Y(2035, 2, 10), startUtcMs: Y(2035, 2, 8), endUtcMs: Y(2035, 2, 12), word: 'supports' });
    for (const s of c.western.statements) expect(s.badges).not.toContain('experimental');
    expect(TEXT.westernWindow).not.toContain('experimental');
  });

  it('refuses a window of more than 62 days for both parts, and says why the Western part is empty where the birth time is unknown', () => {
    const reg = world([{ id: 'w.day', tradition: 'western', periodRead: true, levels: ['western-transits'], fires: [['moon', Y(2035, 2, 8), Y(2035, 2, 12)]] }], { iching: { PERIOD_READ: true } });
    expect(() => periodCharacter(input(), { startUtcMs: Y(2035), endUtcMs: Y(2035, 5) }, { registry: reg })).toThrow(/too long/);
    const timed = createRegistry(
      [{ tradition: 'western', method: 's', topicDefinitions: [], tables: {}, rules: [rule({ id: 'w.day', tradition: 'western' })] }],
      {
        bazi: { BINDINGS: [], NOT_EVALUATED: [], buildContext: () => undefined, COMPLETE: false },
        vedic: { BINDINGS: [], NOT_EVALUATED: [], buildContext: () => undefined, COMPLETE: false },
        iching: { BINDINGS: [], NOT_EVALUATED: [], buildContext: () => undefined, COMPLETE: false, PERIOD_READ: true },
        western: { BINDINGS: [{ ruleId: 'w.day', tradition: 'western', periodRead: true, levels: ['western-transits'], requires: { birthTime: true }, fire: () => [] }], NOT_EVALUATED: [], buildContext: () => undefined, COMPLETE: false },
      },
    );
    const c = periodCharacter(input({ birthTimeUncertaintyMinutes: null }), { startUtcMs: Y(2035, 2, 1), endUtcMs: Y(2035, 2, 31) }, { registry: timed });
    expect(c.western.statements).toEqual([]);
    expect(c.western.unavailable).toMatch(/birth time/);
  });
});

// ---------------------------------------------------------------------------
// Decision 8: plain words, and the groups sentence
// ---------------------------------------------------------------------------

describe('plain words in the agreement display', () => {
  const INTERNAL = /\b(nothing-said|no-agreement|agree-supports|agree-cautions|contradiction|birth-arithmetic|jupiter-sidereal|saturn-sidereal)\b/;

  it('say no verdict twice and no internal token', () => {
    for (const [key, text] of Object.entries(VERDICT_TEXT)) {
      expect(text, key).not.toBe(key);
      expect(text, key).not.toMatch(INTERNAL);
    }
    expect(VERDICT_TEXT.contradiction).toBe('one group supports and another cautions');
  });

  const world3: Spec[] = [
    { id: 'b.a', tradition: 'bazi', levels: ['bazi-luck'], fires: [['luck', Y(2033), Y(2034)]] },
    { id: 'v.j', tradition: 'vedic', levels: ['jupiter-moon'], direction: 'unfavourable', fires: [['jupiter-sidereal', Y(2033), Y(2034)]] },
    { id: 'v.s', tradition: 'vedic', levels: ['saturn-moon'], fires: [['saturn-sidereal', Y(2033), Y(2034)]] },
  ];

  it('name the independent groups actually present for the nativity, in plain words, in both variants of the display', () => {
    const res = run(world3, { traditions: ['bazi', 'vedic'] });
    const d = agreementDisplay(res, TOPIC);
    expect(d.shown).toBe(true);
    expect(d.groupsLine).toBe(groupsSentence(['counted from the birth moment', 'Jupiter (sidereal signs)', 'Saturn (sidereal signs)']));
    expect(d.groupsLine).toContain('Everything counted from the birth moment is one group, and each planet whose real motion is read is one more');
    expect(d.groupsLine).not.toMatch(INTERNAL);
    if (d.shown) expect(d.years[idx(2033)]!.text).toBe(VERDICT_TEXT.contradiction);
    // fewer than three groups: no strip, and the sentence names the two there are
    const two = agreementDisplay(run(world3.slice(0, 2), { traditions: ['bazi', 'vedic'] }), TOPIC);
    expect(two.shown).toBe(false);
    expect(two.groupsLine).toContain('counted from the birth moment; Jupiter (sidereal signs).');
    expect(two.groupsLine).not.toContain('Saturn');
  });

  it('say so where no group has anything to say', () => {
    expect(groupsSentence([])).toMatch(/no group has anything to say for this nativity\.$/);
  });
});

// ---------------------------------------------------------------------------
// Decision 9: the baseline keeps its runs
// ---------------------------------------------------------------------------

describe('the baseline', () => {
  it('runs the specification\'s 1000 shifts by default, and fewer where asked', () => {
    expect(evaluate(input(), { registry: withIching(SPECS), topics: [TOPIC] }).baselines[TOPIC]!.runs).toBe(1000);
    expect(evaluate(input(), { registry: withIching(SPECS), topics: [TOPIC], runs: 20 }).baselines[TOPIC]!.runs).toBe(20);
  });
});

describe('the words a level cell shows', () => {
  it('map every reading word through the phrasebook', () => {
    const grid = decadeGrid(run(), TOPIC);
    const seen = new Set(grid.rows.flatMap((r) => r.cells.map((c) => [c.word, c.wordText].join('='))));
    for (const s of seen) {
      const [token, text] = s.split('=') as [keyof typeof WORD, string];
      expect(text).toBe(WORD[token]);
      expect(text).not.toMatch(/-/);
    }
  });
});
