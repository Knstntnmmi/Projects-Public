// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The readable forms of a forecast: tallies, levels, the statement list, the year view, the
 * agreement display and the period character. Each point is proved twice: on invented rules
 * whose answers are known, and once on a sample moment with the real rules.
 */
import { describe, expect, it } from 'vitest';
import {
  agreementDisplay,
  allPhrases,
  auditRegistry,
  BadFiringError,
  bannedIn,
  buildLevelReadings,
  buildReadings,
  DEFAULT_REGISTRY,
  evaluate,
  LEVEL_IDS,
  LEVEL_LABEL,
  levelNeedsField,
  levelOfFiring,
  makeInput,
  narrate,
  periodCharacter,
  pointerLabel,
  reportJson,
  signalsFromFirings,
  statementList,
  tallyOf,
  tallyText,
  TEXT,
  yearView,
  MAX_WINDOW_DAYS,
  type ForecastResult,
  type Firing,
  type LevelId,
  type Rule,
  type RuleBinding,
  type Tradition,
} from '../../src/forecast/index.ts';
import { createRegistry, type TraditionModule } from '../../src/forecast/registry.ts';
import { MS, makeMoment } from '../../src/substrate/time.ts';
import { fixture } from '../../../../fixtures/moments.ts';
import { input, rule } from './synthetic.ts';

// ---------------------------------------------------------------------------
// An invented world with known answers (span 2031 to 2040)
// ---------------------------------------------------------------------------

const Y = (y: number, m = 0, d = 1): number => Date.UTC(y, m, d);

const facts = [{ key: 'thing', label: 'Thing', value: 'a gain' }];
const say = (name: string): Rule['template'] => `${name} says something.`;

interface Spec {
  id: string;
  tradition: Tradition;
  direction?: Rule['direction'];
  stage?: Rule['stage'];
  dedupeKey?: string;
  strength?: 1 | 2 | 3;
  /** [clock, start, end, level?] */
  fires: Array<[Firing['clock'], number | null, number | null, Firing['level']?]>;
}

function world(specs: Spec[], moduleExtra: Partial<Record<Tradition, Partial<TraditionModule>>> = {}) {
  const rules = specs.map((s) => rule({ id: s.id, tradition: s.tradition, direction: s.direction ?? 'favourable', stage: s.stage ?? 'period-lord', dedupeKey: s.dedupeKey, strength: s.strength ?? 2, template: say(s.id) }));
  const bindings = (t: Tradition): RuleBinding[] =>
    specs
      .filter((s) => s.tradition === t)
      .map((s) => ({
        ruleId: s.id,
        tradition: t,
        fire: () => s.fires.map(([clock, a, b, level]) => ({ clock, startUtcMs: a, endUtcMs: b, level, facts, dedupeInstance: `${a}-${b}` }) as Firing),
      }));
  const files = (['bazi', 'vedic', 'iching', 'western'] as const).map((t) => ({ tradition: t, method: 'synthetic', topicDefinitions: [], tables: {}, rules: rules.filter((r) => r.tradition === t) }));
  const mod = (t: Tradition): TraditionModule => ({ BINDINGS: bindings(t), NOT_EVALUATED: [], buildContext: () => undefined, COMPLETE: false, ...moduleExtra[t] });
  return createRegistry(files, { bazi: mod('bazi'), vedic: mod('vedic'), iching: mod('iching'), western: mod('western') });
}

const SPECS: Spec[] = [
  // a three-year statement on the luck clock, with a modifier on top of it in 2033
  { id: 'b.luck', tradition: 'bazi', fires: [['luck', Y(2033), Y(2036)]] },
  { id: 'b.luck-mod', tradition: 'bazi', stage: 'modifier', direction: 'activates', fires: [['luck', Y(2033, 3), Y(2033, 9)]] },
  // two year-pillar statements of the same stage that disagree in 2034
  { id: 'b.year-up', tradition: 'bazi', fires: [['solar-longitude', Y(2034), Y(2035)]] },
  { id: 'b.year-down', tradition: 'bazi', direction: 'unfavourable', fires: [['solar-longitude', Y(2034), Y(2035)]] },
  // the same fact reported twice counts once
  { id: 'b.year-same-a', tradition: 'bazi', dedupeKey: 'same-fact', strength: 3, fires: [['solar-longitude', Y(2037), Y(2038)]] },
  { id: 'b.year-same-b', tradition: 'bazi', dedupeKey: 'same-fact', strength: 1, fires: [['solar-longitude', Y(2037), Y(2038)]] },
  // a modifier that no statement of its tradition covers
  { id: 'b.orphan', tradition: 'bazi', stage: 'modifier', direction: 'activates', fires: [['luck', Y(2039), Y(2039, 6)]] },
  // undated
  { id: 'b.natal', tradition: 'bazi', stage: 'natal-promise', fires: [['birthday', null, null]] },
  // one clock, two nested periods: the binding says which
  { id: 'v.maha', tradition: 'vedic', direction: 'unfavourable', fires: [['dasha', Y(2029, 6), Y(2032, 6), 'vedic-maha']] },
  { id: 'v.antar', tradition: 'vedic', fires: [['dasha', Y(2031), Y(2031, 6), 'vedic-antar']] },
  { id: 'v.saturn', tradition: 'vedic', direction: 'unfavourable', fires: [['saturn-sidereal', Y(2039, 6), Y(2042)]] },
  { id: 'v.jupiter', tradition: 'vedic', fires: [['jupiter-sidereal', Y(2034, 2), Y(2034, 8)]] },
  { id: 'v.active', tradition: 'vedic', stage: 'activation', direction: 'activates', fires: [['dasha', Y(2036), Y(2037), 'vedic-maha']] },
  { id: 'w.transit', tradition: 'western', fires: [['jupiter-tropical', Y(2034, 2), Y(2034, 8)]] },
];

const ichingFires: string[] = [];
const ICHING: Spec = { id: 'i.period', tradition: 'iching', fires: [['solar-longitude', Y(2033), Y(2034)]] };
const withIching = (): ReturnType<typeof world> =>
  world([...SPECS, ICHING], {
    iching: {
      PERIOD_READ: true,
      BINDINGS: [
        {
          ruleId: ICHING.id,
          tradition: 'iching',
          fire: () => {
            ichingFires.push('called');
            return [{ clock: 'solar-longitude', startUtcMs: Y(2033), endUtcMs: Y(2034), facts }];
          },
        },
      ],
    },
  });

const TOPIC = 'wealth' as const;
const run = (extra: Parameters<typeof evaluate>[1] = {}): ForecastResult => evaluate(input(), { registry: withIching(), traditions: ['bazi', 'vedic', 'western', 'iching'], topics: [TOPIC], runs: 50, ...extra });
const idx = (year: number): number => year - 2031;

// ---------------------------------------------------------------------------
// Decision 2: the tally
// ---------------------------------------------------------------------------

describe('the tally', () => {
  it('prints the counts with the verb agreeing, and only the first clause naming the rules', () => {
    expect(tallyText({ supports: 3, cautions: 1, mixed: 0, active: 0 })).toBe('3 rules support, 1 cautions');
    expect(tallyText({ supports: 1, cautions: 1, mixed: 0, active: 0 })).toBe('1 rule supports, 1 cautions');
    expect(tallyText({ supports: 0, cautions: 2, mixed: 0, active: 0 })).toBe('2 rules caution');
    // pointers (the statements that only mark the topic) are no part of a tally text: they are counted apart, with their own label
    expect(tallyText({ supports: 1, cautions: 2, mixed: 1, active: 3 })).toBe('1 rule supports, 2 caution, 1 is stated as mixed');
    expect(tallyText({ supports: 0, cautions: 0, mixed: 2, active: 1 })).toBe('2 rules are stated as mixed');
    expect(tallyText({ supports: 0, cautions: 0, mixed: 0, active: 3 })).toBe('no rule speaks');
    expect(tallyText({ supports: 0, cautions: 0, mixed: 0, active: 0 })).toBe('no rule speaks');
  });

  it('counts the deciding statements after de-duplication and never the modifiers', () => {
    const r = run();
    const reading = (tradition: Tradition, year: number) => r.readings.find((x) => x.tradition === tradition && x.group === null && x.topic === TOPIC && x.slice === idx(year))!;
    // 2034: two year-pillar rules disagree, and the luck statement is still running
    expect(reading('bazi', 2034).tally).toEqual({ supports: 2, cautions: 1, mixed: 0, active: 0 });
    // 2037: two rules report one fact, counted once
    expect(reading('bazi', 2037).tally).toEqual({ supports: 1, cautions: 0, mixed: 0, active: 0 });
    // 2033: the modifier is listed on the reading but not counted
    expect(reading('bazi', 2033).tally).toEqual({ supports: 1, cautions: 0, mixed: 0, active: 0 });
    expect(reading('bazi', 2033).modifierIds).toHaveLength(1);
    // an activating statement is counted as only marking the topic
    expect(reading('vedic', 2036).tally).toEqual({ supports: 0, cautions: 0, mixed: 0, active: 1 });
  });

  it('changes no word: tally and word come from the same statements', () => {
    const r = run();
    for (const x of r.readings) {
      const t = x.tally;
      if (x.word === 'supports') expect(t.supports).toBeGreaterThan(0), expect(t.cautions + t.mixed).toBe(0);
      if (x.word === 'cautions') expect(t.cautions).toBeGreaterThan(0), expect(t.supports + t.mixed).toBe(0);
      if (x.word === 'nothing-said') expect(t.supports + t.cautions + t.mixed).toBe(0);
      expect(t.supports + t.cautions + t.mixed + t.active).toBe(x.signalIds.length);
    }
    expect(tallyOf([])).toEqual({ supports: 0, cautions: 0, mixed: 0, active: 0 });
  });
});

// ---------------------------------------------------------------------------
// Decision 3: levels
// ---------------------------------------------------------------------------

describe('levels', () => {
  it('follow from tradition and clock, and from the binding where one clock carries two periods', () => {
    const at = (tradition: Tradition, f: Partial<Firing> & Pick<Firing, 'clock'>) => levelOfFiring(tradition, { startUtcMs: 1, level: undefined, ...f });
    expect(at('bazi', { clock: 'luck' })).toBe('bazi-luck');
    expect(at('bazi', { clock: 'solar-longitude' })).toBe('bazi-year');
    expect(at('vedic', { clock: 'saturn-sidereal' })).toBe('saturn-moon');
    expect(at('vedic', { clock: 'jupiter-sidereal' })).toBe('jupiter-moon');
    expect(at('vedic', { clock: 'dasha', level: 'vedic-antar' })).toBe('vedic-antar');
    expect(at('vedic', { clock: 'dasha', level: 'vedic-maha' })).toBe('vedic-maha');
    expect(at('western', { clock: 'birthday', level: 'western-firdaria' })).toBe('western-firdaria');
    expect(at('western', { clock: 'jupiter-tropical' })).toBe('western-transits');
    expect(at('western', { clock: 'node' })).toBe('western-transits');
    expect(at('iching', { clock: 'solar-longitude' })).toBe('iching-period');
    expect(levelOfFiring('vedic', { clock: 'dasha', startUtcMs: null })).toBe('natal');
  });

  it('says which clocks need the field, and refuses a level that does not run on the firing clock', () => {
    expect(levelNeedsField('vedic', 'dasha')).toBe(true);
    expect(levelNeedsField('western', 'birthday')).toBe(true);
    expect(levelNeedsField('bazi', 'luck')).toBe(false);
    const r = rule({ id: 'x.vedic', tradition: 'vedic', template: say('x') });
    const f: Firing = { clock: 'luck', level: 'vedic-antar', startUtcMs: Y(2033), endUtcMs: Y(2034), facts };
    expect(() => signalsFromFirings(r, [f], { forecastConventions: input().forecastConventions, span: input().span })).toThrow(BadFiringError);
  });

  it('have plain labels: no clock, stage, gate, dedupe or strength, and no banned word', () => {
    expect(Object.keys(LEVEL_LABEL).sort()).toEqual([...LEVEL_IDS].sort());
    for (const label of Object.values(LEVEL_LABEL)) {
      expect(label, label).not.toMatch(/\b(clock|stage|gate|dedupe|strength)\b/i);
      expect(bannedIn(label)).toBeNull();
    }
    expect(LEVEL_LABEL['saturn-moon']).toBe('Saturn from the Moon');
  });

  it('are built per level and slice with the same word rule and the tally', () => {
    const r = run();
    const lr = (level: LevelId, year: number) => r.levelReadings.find((x) => x.topic === TOPIC && x.level === level && x.slice === idx(year))!;
    expect(lr('bazi-year', 2034)).toMatchObject({ word: 'mixed', note: 'rules conflict', tally: { supports: 1, cautions: 1, mixed: 0, active: 0 } });
    expect(lr('bazi-luck', 2034)).toMatchObject({ word: 'supports', tally: { supports: 1 } });
    expect(lr('vedic-maha', 2031)).toMatchObject({ word: 'cautions' });
    expect(lr('vedic-antar', 2031)).toMatchObject({ word: 'supports' });
    expect(lr('vedic-maha', 2036)).toMatchObject({ word: 'nothing-said', note: 'topic active', tally: { active: 1 } });
    expect(lr('western-transits', 2034).word).toBe('supports');
    expect(buildLevelReadings([], r.slices, [TOPIC])).toEqual([]);
  });

  it('is set by the real Vedic dasha bindings on every dated dasha firing', () => {
    for (const id of ['j2000', 'jiazi-1984', 'southern']) {
      const f = fixture(id);
      const inp = makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2031, toYear: 2040 });
      expect(auditRegistry(DEFAULT_REGISTRY, inp, { traditions: ['vedic'] }), id).toEqual([]);
      const res = evaluate(inp, { runs: 10, seed: 1 });
      const dasha = res.signals.filter((s) => s.tradition === 'vedic' && s.clock === 'dasha' && s.startUtcMs !== null);
      expect(dasha.length, id).toBeGreaterThan(0);
      expect(dasha.every((s) => s.level === 'vedic-maha' || s.level === 'vedic-antar'), id).toBe(true);
      // a rule that is about the antardasha says so in its own id
      expect(dasha.filter((s) => s.ruleId.includes('antardasha')).every((s) => s.level === 'vedic-antar'), id).toBe(true);
      expect(res.signals.filter((s) => s.clock === 'saturn-sidereal' && s.startUtcMs !== null).every((s) => s.level === 'saturn-moon')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Decision 4: the statement list
// ---------------------------------------------------------------------------

describe('the statement list', () => {
  const r = run();
  const list = statementList(r, TOPIC);

  it('starts with the undated statements under the phrasebook heading', () => {
    expect(list.natalHeading).toBe(TEXT.natalPromiseHeading);
    expect(list.natal.map((e) => e.ruleId)).toEqual(['b.natal']);
    expect(list.natal[0]).toMatchObject({ startUtcMs: null, endUtcMs: null, level: 'natal', levelLabel: 'natal chart', word: 'supports' });
  });

  it('has one entry per statement, however many years it lasts', () => {
    const ids = list.dated.map((e) => e.signalId);
    expect(new Set(ids).size).toBe(ids.length);
    const luck = list.dated.filter((e) => e.ruleId === 'b.luck');
    expect(luck).toHaveLength(1);
    expect(luck[0]).toMatchObject({ startUtcMs: Y(2033), endUtcMs: Y(2036), beganBefore: false, endsAfter: false });
  });

  it('clips to the requested span and flags what began before it or ends after it', () => {
    const maha = list.dated.find((e) => e.ruleId === 'v.maha')!;
    expect(maha).toMatchObject({ startUtcMs: Y(2031), endUtcMs: Y(2032, 6), beganBefore: true, endsAfter: false });
    const saturn = list.dated.find((e) => e.ruleId === 'v.saturn')!;
    expect(saturn).toMatchObject({ startUtcMs: Y(2039, 6), endUtcMs: Y(2041), beganBefore: false, endsAfter: true });
  });

  it('orders by start, then tradition, then level', () => {
    const key = (e: (typeof list.dated)[number]): number[] => [e.startUtcMs!, ['bazi', 'vedic', 'iching', 'western'].indexOf(e.tradition), LEVEL_IDS.indexOf(e.level)];
    for (let i = 1; i < list.dated.length; i++) {
      const a = key(list.dated[i - 1]!);
      const b = key(list.dated[i]!);
      const cmp = a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!;
      expect(cmp, `${list.dated[i - 1]!.ruleId} before ${list.dated[i]!.ruleId}`).toBeLessThanOrEqual(0);
    }
    // 2031-01-01: the vedic mahadasha (clipped) then the antardasha, both the same day
    const first = list.dated.filter((e) => e.startUtcMs === Y(2031)).map((e) => e.level);
    expect(first).toEqual(['vedic-maha', 'vedic-antar']);
  });

  it('carries tradition, level label, word, sentence, badges, signal id, the count of other rules and qualifiers', () => {
    const e = list.dated.find((x) => x.ruleId === 'b.year-same-a')!;
    expect(e).toMatchObject({ tradition: 'bazi', level: 'bazi-year', levelLabel: 'BaZi year pillar', word: 'supports', sentence: 'b.year-same-a says something.', alsoReportedBy: 1 });
    expect(e.signalId).toMatch(/^b\.year-same-a@/);
    expect(e.badges).toContain('no promise rule applied');
    expect(list.dated.find((x) => x.ruleId === 'b.year-same-b')).toBeUndefined();
  });

  it('shows a modifier only as a qualifier of the statement it attaches to, with its sentence', () => {
    expect(list.dated.some((e) => e.ruleId === 'b.luck-mod')).toBe(false);
    const luck = list.dated.find((e) => e.ruleId === 'b.luck')!;
    // a qualifier now also carries its own span and level; the sentence and ids are as before
    expect(luck.qualifiers).toEqual([
      {
        signalId: expect.stringMatching(/^b\.luck-mod@/),
        ruleId: 'b.luck-mod',
        sentence: 'b.luck-mod says something.',
        level: 'bazi-luck',
        levelLabel: 'BaZi luck pillar',
        startUtcMs: expect.any(Number),
        endUtcMs: expect.any(Number),
        beganBefore: false,
        endsAfter: false,
        alsoQualifies: 0,
      },
    ]);
  });

  it('folds modifiers that attach to nothing into one group per tradition with a count', () => {
    expect(list.unattached).toHaveLength(1);
    expect(list.unattached[0]).toMatchObject({ tradition: 'bazi', count: 1, line: 'BaZi: 1 modifier does not attach to any statement shown.' });
  });

  it('never contains a period-read tradition', () => {
    const withAll = evaluate(input(), { registry: withIching(), traditions: ['bazi', 'iching'], topics: [TOPIC], runs: 10, includePeriodRead: true });
    expect(withAll.signals.some((s) => s.tradition === 'iching')).toBe(true);
    expect(statementList(withAll, TOPIC).dated.some((e) => e.tradition === 'iching')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Decision 5: the year view
// ---------------------------------------------------------------------------

describe('the year view', () => {
  const r = run();
  const view = yearView(r, TOPIC);
  const year = (y: number) => view.years[idx(y)]!;

  it('has one row per year and lists every level that has a statement for the topic, in fixed order', () => {
    expect(view.years.map((y) => y.year)).toEqual([2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040]);
    expect(year(2034).levels.map((l) => l.level)).toEqual(['bazi-luck', 'bazi-year', 'vedic-maha', 'vedic-antar', 'saturn-moon', 'jupiter-moon', 'western-transits']);
  });

  it('gives each level its word, tally, and the entries active in the year, flagging those that begin in it', () => {
    const luck33 = year(2033).levels.find((l) => l.level === 'bazi-luck')!;
    const luck34 = year(2034).levels.find((l) => l.level === 'bazi-luck')!;
    expect(luck33.entries).toEqual([{ signalId: expect.stringMatching(/^b\.luck@/), begins: true }]);
    expect(luck34.entries).toEqual([{ signalId: luck33.entries[0]!.signalId, begins: false }]);
    const yr = year(2034).levels.find((l) => l.level === 'bazi-year')!;
    expect(yr).toMatchObject({ word: 'mixed', tally: { supports: 1, cautions: 1 }, tallyText: '1 rule supports, 1 cautions' });
    expect(yr.entries.every((e) => e.begins)).toBe(true);
    // a statement that began before the span does not begin in the first year
    const maha31 = year(2031).levels.find((l) => l.level === 'vedic-maha')!;
    expect(maha31.entries.map((e) => e.begins)).toEqual([false]);
  });

  it('carries the cross-group agreement cell of the year', () => {
    expect(year(2034).agreement).toBe(r.agreement.find((c) => c.topic === TOPIC && c.slice === idx(2034)));
  });

  it('writes one headline that groups the level labels by word, in a fixed order, and lists the silent levels last', () => {
    expect(year(2034).headline).toBe(
      'Supports: BaZi luck pillar, Jupiter from the Moon, Western transits. Mixed: BaZi year pillar (1 rule supports, 1 cautions). Silent: Vedic mahadasha, Vedic antardasha, Saturn from the Moon.',
    );
    expect(year(2034).headline).not.toMatch(/groups differ/);
    expect(year(2031).silent).toEqual(['bazi-luck', 'bazi-year', 'saturn-moon', 'jupiter-moon', 'western-transits']);
  });

  it('keeps a level that has pointers only silent, with the pointers folded into one group that lists them', () => {
    // v.active marks the topic in 2036 on the mahadasha level and says nothing more; v.maha (cautions) ends in 2032
    const maha = year(2036).levels.find((l) => l.level === 'vedic-maha')!;
    expect(maha.word).toBe('nothing-said');
    expect(maha.note).toBe('topic active');
    expect(maha.tallyText).toBe('no rule speaks');
    expect(maha.pointers).toMatchObject({ count: 1, label: pointerLabel(1) });
    expect(maha.pointers!.entries.map((e) => e.sentence)).toEqual(['v.active says something.']);
    expect(maha.entries).toEqual([]);
    expect(year(2036).silent).toContain('vedic-maha');
    expect(year(2036).headline).toMatch(/Silent: .*Vedic mahadasha/);
    expect(year(2036).headline).not.toMatch(/active|pointer/);
    // the pointer is no entry of the list
    expect(statementList(r, TOPIC).dated.some((e) => e.ruleId === 'v.active')).toBe(false);
    expect(statementList(r, TOPIC).pointers.map((e) => e.ruleId)).toEqual(['v.active']);
  });

  it('gives period-read traditions one fixed line and no cell', () => {
    expect(view.periodRead).toEqual([{ tradition: 'iching', line: TEXT.ichingByPeriod }]);
    expect(view.years.every((y) => y.levels.every((l) => l.level !== 'iching-period'))).toBe(true);
  });

  it('replaces "the groups differ" in the written forecast', () => {
    const text = narrate(r, TOPIC);
    expect(text.some((s) => /groups differ/.test(s.text))).toBe(false);
    const s = text.find((x) => x.kind === 'summary' && x.slice === idx(2034))!;
    expect(s.text).toBe(year(2034).headline);
    expect(s.signalIds.length).toBeGreaterThan(0);
    // said once: the three-year luck statement is one sentence, not three
    expect(text.filter((x) => x.kind === 'signal' && x.text.startsWith('b.luck says')).length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Decision 6: traditions read by period
// ---------------------------------------------------------------------------

describe('traditions read by period', () => {
  it('carries a registry flag, set for the I Ching', () => {
    expect(DEFAULT_REGISTRY.periodRead).toEqual({ bazi: false, vedic: false, iching: true, western: false });
    expect(withIching().periodRead.iching).toBe(true);
    expect(world(SPECS).periodRead.iching).toBe(false);
  });

  it('never runs the rules of a period-read tradition for a span, so a long span is not slowed', () => {
    ichingFires.length = 0;
    const res = run();
    expect(ichingFires).toEqual([]);
    expect(res.periodRead).toEqual(['iching']);
    expect(res.signals.some((s) => s.tradition === 'iching')).toBe(false);
    expect(res.readings.some((x) => x.tradition === 'iching')).toBe(false);
    run({ includePeriodRead: true });
    expect(ichingFires.length).toBeGreaterThan(0);
  });

  it('keeps the real I Ching out of every yearly form on a sample moment', () => {
    const f = fixture('j2000');
    const inp = makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2031, toYear: 2060 });
    const res = evaluate(inp, { topics: ['wealth'], runs: 20, seed: 1 });
    expect(res.periodRead).toEqual(['iching']);
    expect(res.signals.some((s) => s.tradition === 'iching')).toBe(false);
    expect(yearView(res, 'wealth').periodRead).toHaveLength(1);
    expect(res.registry.coverage.iching.wealth).toBe(1);
  });

  const f = fixture('j2000');
  const moment = makeMoment(f.civil, f.zone, f.place);
  const base = moment.utcMs + 9000 * MS.DAY;
  const inp = makeInput(moment, { fromYear: 2031, toYear: 2033 });

  it('returns the character of a short window: periods, sovereign, cardinal markers and a line for each day', () => {
    const c = periodCharacter(inp, { startUtcMs: base, endUtcMs: base + 30 * MS.DAY }).iching;
    expect(c.periods.length).toBeGreaterThanOrEqual(5);
    expect(c.sovereign.length).toBeGreaterThanOrEqual(1);
    expect(c.days.length).toBeGreaterThanOrEqual(29);
    for (const e of [...c.periods, ...c.sovereign, ...c.cardinal, ...c.days]) {
      expect(e.text).toMatch(/[一-鿿]/);
      expect(e.badges).toContain('experimental');
      expect(Number.isFinite(e.grade)).toBe(true);
      expect(e.gradeText).toMatch(/^[+-]?\d/);
    }
    expect(c.periods.every((p) => p.line === 0 && p.endUtcMs > base && p.startUtcMs < base + 30 * MS.DAY)).toBe(true);
    expect(c.days.every((d) => d.line >= 1 && d.line <= 6)).toBe(true);
    expect(c.badges).toEqual(['experimental']);
    expect(c.note).toBe(TEXT.experimentalWindow);
  });

  it('shows the cardinal hexagrams only where the convention gives them a period of their own', () => {
    const jf = makeInput(moment, { fromYear: 2031, toYear: 2033, conventions: { ...inp.conventions, guaQi: 'jing-fang' } });
    const a = periodCharacter(jf, { startUtcMs: Y(2032, 1, 20), endUtcMs: Y(2032, 3, 10) });
    expect(a.iching.cardinal.length).toBeGreaterThan(0);
    expect(periodCharacter(inp, { startUtcMs: Y(2032, 1, 20), endUtcMs: Y(2032, 3, 10) }).iching.cardinal).toEqual([]);
  });

  it('accepts 62 days and refuses more with a clear error', () => {
    expect(() => periodCharacter(inp, { startUtcMs: base, endUtcMs: base + MAX_WINDOW_DAYS * MS.DAY })).not.toThrow();
    expect(() => periodCharacter(inp, { startUtcMs: base, endUtcMs: base + 63 * MS.DAY })).toThrow(/too long.*at most 62 days/);
    expect(() => periodCharacter(inp, { startUtcMs: base, endUtcMs: base })).toThrow(RangeError);
  });

  it('does not depend on the nativity', () => {
    const other = fixture('jiazi-1984');
    const b = makeInput(makeMoment(other.civil, other.zone, other.place), { fromYear: 2031, toYear: 2033 });
    const w = { startUtcMs: base, endUtcMs: base + 20 * MS.DAY };
    expect(periodCharacter(b, w).iching).toEqual(periodCharacter(inp, w).iching);
  });
});

// ---------------------------------------------------------------------------
// Decision 7: the agreement display
// ---------------------------------------------------------------------------

describe('the agreement display', () => {
  it('says that agreement needs at least three groups, and shows no strip, when fewer speak', () => {
    const d = agreementDisplay(run(), TOPIC);
    // bazi and vedic's dasha are one birth-arithmetic group, Saturn and Jupiter are two sky groups: three speak
    expect(d.speakingGroups).toBeGreaterThanOrEqual(3);
    const two = evaluate(input(), { registry: world(SPECS.filter((s) => s.tradition === 'bazi' || s.id === 'v.jupiter')), traditions: ['bazi', 'vedic'], topics: [TOPIC], runs: 20 });
    const few = agreementDisplay(two, TOPIC);
    expect(few).toEqual({ topic: TOPIC, shown: false, speakingGroups: 2, line: TEXT.needsThreeGroups, groupsLine: expect.stringContaining('Everything counted from the birth moment is one group') });
    expect('years' in few).toBe(false);
  });

  it('otherwise shows the strip per year, the baseline line and the three fixed sentences', () => {
    const r = run();
    const d = agreementDisplay(r, TOPIC);
    if (!d.shown) throw new Error('expected a strip');
    expect(d.years).toHaveLength(10);
    expect(d.years[idx(2034)]!.verdict).toBe(r.agreement.find((c) => c.slice === idx(2034))!.verdict);
    expect(d.baselineLine).toMatch(/^found \d+ agreeing years?; about \d\.\d would be expected if the groups were unrelated; 1 topic looked at on this page/);
    expect(d.sentences).toEqual([TEXT.agreementA, TEXT.agreementB, TEXT.agreementC]);
  });

  it('keeps the no-agreement verdict for groups that speak but do not agree', () => {
    const r = evaluate(
      input(),
      {
        registry: world([
          { id: 'a', tradition: 'bazi', fires: [['luck', Y(2033), Y(2034)]] },
          { id: 'b', tradition: 'vedic', direction: 'mixed', fires: [['jupiter-sidereal', Y(2033), Y(2034)]] },
          { id: 'c', tradition: 'vedic', fires: [['saturn-sidereal', Y(2033), Y(2034)]] },
        ]),
        traditions: ['bazi', 'vedic'],
        topics: [TOPIC],
        runs: 20,
      },
    );
    const d = agreementDisplay(r, TOPIC);
    if (!d.shown) throw new Error('expected a strip');
    expect(d.years[idx(2033)]).toMatchObject({ verdict: 'no-agreement', text: 'groups speak but no two give the same sign' });
  });

  it('on a sample moment decides by the number of speaking groups', () => {
    const f = fixture('j2000');
    const res = evaluate(makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2031, toYear: 2040 }), { topics: ['wealth'], runs: 50, seed: 1 });
    const d = agreementDisplay(res, 'wealth');
    expect(d.shown).toBe(d.speakingGroups >= 3);
    if (!d.shown) expect(d.line).toBe(TEXT.needsThreeGroups);
    else expect(d.years).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// Decision 8: the JSON
// ---------------------------------------------------------------------------

describe('the JSON report', () => {
  it('keeps its schema name and gains the three readable forms, with nothing natal added', () => {
    const r = run();
    const j = reportJson(r, TOPIC) as Record<string, unknown>;
    expect(j.schema).toBe('overlay-forecast/1');
    expect(j.statements).toEqual(statementList(r, TOPIC));
    expect(j.yearView).toEqual(yearView(r, TOPIC));
    expect(j.agreementDisplay).toEqual(agreementDisplay(r, TOPIC));
    expect(JSON.parse(JSON.stringify(j))).toEqual(j);
    expect(JSON.stringify(j)).not.toMatch(/j2000|latitude|"place":|"civil":|"zone":|"nativity":/i);
  });

  it('on a sample moment is the same text as the forms it carries', () => {
    const f = fixture('jiazi-1984');
    const res = evaluate(makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2031, toYear: 2040, forecastConventions: { baziSexConvention: 'male-chart' } }), { topics: ['wealth'], runs: 30, seed: 1 });
    const j = reportJson(res, 'wealth') as { yearView: ReturnType<typeof yearView>; statements: ReturnType<typeof statementList> };
    expect(j.yearView.years).toHaveLength(10);
    expect(j.statements.dated.length).toBeGreaterThan(5);
    expect(j.yearView.years.every((y) => y.headline.length > 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Sample moment: one test per point on the real rules
// ---------------------------------------------------------------------------

describe('on the sample moment j2000, wealth, 2031 to 2040', () => {
  const f = fixture('j2000');
  const res = evaluate(makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2031, toYear: 2040 }), { topics: ['wealth'], runs: 50, seed: 1 });
  const list = statementList(res, 'wealth');
  const view = yearView(res, 'wealth');

  it('tally: every reading and level reading counts exactly its deciding statements', () => {
    for (const x of res.readings) expect(x.tally.supports + x.tally.cautions + x.tally.mixed + x.tally.active).toBe(x.signalIds.length);
    for (const x of res.levelReadings) expect(x.tally.supports + x.tally.cautions + x.tally.mixed + x.tally.active).toBe(x.signalIds.length);
    expect(res.levelReadings.some((x) => x.tally.supports > 0 && x.tally.cautions > 0)).toBe(true);
  });

  it('levels: the real rules reach the BaZi, Vedic dasha and sky levels', () => {
    const levels = new Set(res.signals.filter((s) => s.startUtcMs !== null).map((s) => s.level));
    for (const l of ['bazi-year', 'vedic-maha', 'vedic-antar', 'saturn-moon', 'jupiter-moon'] as const) expect(levels.has(l), l).toBe(true);
    expect(levels.has('iching-period')).toBe(false);
  });

  it('statement list: each statement once, far fewer lines than one per year', () => {
    const ids = list.dated.map((e) => e.signalId);
    expect(new Set(ids).size).toBe(ids.length);
    const perYear = view.years.reduce((n, y) => n + y.levels.reduce((m, l) => m + l.entries.length, 0), 0);
    expect(list.dated.length).toBeLessThan(perYear);
    expect(list.dated.some((e) => e.qualifiers.length > 0) || list.unattached.length > 0).toBe(true);
    expect(list.dated.every((e) => e.tradition !== 'iching')).toBe(true);
  });

  it('year view: ten rows, a headline grouped by word, no "groups differ"', () => {
    expect(view.years).toHaveLength(10);
    for (const y of view.years) {
      expect(y.headline).not.toMatch(/groups differ/);
      expect(bannedIn(y.headline)).toBeNull();
      for (const l of y.levels) for (const e of l.entries) expect(list.dated.some((d) => d.signalIds.includes(e.signalId))).toBe(true);
    }
    expect(view.years.some((y) => /(Supports|Cautions|Mixed): [^.]*Saturn from the Moon/.test(y.headline))).toBe(true);
  });

  it('period read: the I Ching appears once, as a fixed line', () => {
    expect(view.periodRead).toEqual([{ tradition: 'iching', line: TEXT.ichingByPeriod }]);
  });

  it('agreement display: decided by the number of speaking groups', () => {
    const d = agreementDisplay(res, 'wealth');
    expect(d.shown).toBe(d.speakingGroups >= 3);
  });

  it('written forecast: every sentence is traceable, none is repeated per year', () => {
    const text = narrate(res, 'wealth');
    const signalSentences = text.filter((s) => s.kind === 'signal' && s.slice !== null);
    expect(signalSentences.length).toBe(list.dated.length);
    for (const s of text) expect(bannedIn(s.text)).toBeNull();
  });

  it('the phrasebook still passes the banned-word test with the new phrases', () => {
    for (const p of allPhrases()) expect(bannedIn(p), p).toBeNull();
  });
});

describe('the reading builder', () => {
  it('still builds readings for a given list of signals', () => {
    const r = run();
    expect(buildReadings(r.signals, r.slices, { coverage: r.registry.coverage, traditions: ['bazi'], topics: [TOPIC] }).every((x) => x.tradition === 'bazi')).toBe(true);
  });
});
