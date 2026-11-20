// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import {
  agreementCells,
  agreementBaseline,
  AGREEMENT_BEARING,
  attachModifiers,
  buildReadings,
  clockGroupOf,
  CLOCKS,
  countAgreeing,
  dedupe,
  evaluate,
  fillTemplate,
  forecastTracks,
  groupLabel,
  isAgree,
  mergeWords,
  narrate,
  overlapFraction,
  overlaps,
  renderAgreement,
  reportJson,
  restsOnSignals,
  seededRandom,
  signalsFromFirings,
  slicesOf,
  UnboundSlotError,
  verdictOf,
  wordFor,
  BadFiringError,
  type ForecastResult,
  type ReadingWord,
  type Signal,
  type Tradition,
} from '../../src/forecast/index.ts';
import { tallyOf } from '../../src/forecast/readings.ts';
import { tallyText } from '../../src/forecast/phrasebook.ts';
import { FROM, input, R, registry, TO, yearFiring } from './synthetic.ts';

const idx = (year: number): number => year - FROM;
const run = (traditions: readonly Tradition[] = ['bazi', 'vedic', 'iching'], extra = {}): ForecastResult => evaluate(input(), { registry: registry(), traditions, topics: ['wealth'], runs: 200, ...extra });
const signalsOf = (r: ForecastResult, ruleId: string): Signal[] => r.signals.filter((s) => s.ruleId === ruleId);

describe('sentences', () => {
  it('equal the rule template with the facts filled in, and nothing else', () => {
    const r = run();
    const s = signalsOf(r, R.luck.id).find((x) => x.startUtcMs === Date.UTC(2033, 0, 1))!;
    expect(s.sentence).toBe('The Jupiter period brings a gain in 2033.');
    expect(s.sentence).toBe(fillTemplate(R.luck.id, R.luck.template, s.facts));
    expect(s.sentence).not.toMatch(/[{}]/);
  });

  it('an unbound slot throws, naming the rule and the slot', () => {
    const f = { ...yearFiring(2033, 'luck'), facts: [{ key: 'planet', label: 'Planet', value: 'Jupiter' }] };
    expect(() => signalsFromFirings(R.luck, [f], { forecastConventions: input().forecastConventions, span: input().span })).toThrow(UnboundSlotError);
    try {
      signalsFromFirings(R.luck, [f], { forecastConventions: input().forecastConventions, span: input().span });
    } catch (e) {
      expect((e as UnboundSlotError).slot).toBe('thing');
      expect((e as UnboundSlotError).ruleId).toBe(R.luck.id);
    }
  });

  it('a dedupe key with a slot is filled from the facts too, and throws when the fact is missing', () => {
    const keyed = { ...R.luck, dedupeKey: 'cue:{year}' };
    const s = signalsFromFirings(keyed, [yearFiring(2033, 'luck')], { forecastConventions: input().forecastConventions, span: input().span });
    expect(s[0]!.dedupeKey.startsWith('cue:2033#')).toBe(true);
    const bad = { ...keyed, dedupeKey: 'cue:{nothing}' };
    expect(() => signalsFromFirings(bad, [yearFiring(2033, 'luck')], { forecastConventions: input().forecastConventions, span: input().span })).toThrow(UnboundSlotError);
  });

  it('re-evaluating gives the same facts and the same ids', () => {
    const a = run();
    const b = run();
    expect(a.signals.map((s) => [s.id, s.sentence, s.facts])).toEqual(b.signals.map((s) => [s.id, s.sentence, s.facts]));
  });

  it('refuses a firing that is malformed', () => {
    const o = { forecastConventions: input().forecastConventions, span: input().span };
    expect(() => signalsFromFirings(R.luck, [{ ...yearFiring(2033, 'luck'), endUtcMs: 1 }], o)).toThrow(BadFiringError);
    expect(() => signalsFromFirings(R.luck, [{ ...yearFiring(2033, 'luck'), startUtcMs: null }], o)).toThrow(BadFiringError);
    expect(() => signalsFromFirings(R.luck, [{ ...yearFiring(2033, 'luck'), topics: ['career'] }], o)).toThrow(BadFiringError);
    expect(() => signalsFromFirings(R.luck, [{ ...yearFiring(2033, 'luck'), clock: 'nonsense' as never }], o)).toThrow(BadFiringError);
    expect(() => signalsFromFirings(R.luck, [{ ...yearFiring(2033, 'luck'), facts: [{ key: 'a', label: 'A', value: 1 }, { key: 'a', label: 'A', value: 2 }] }], o)).toThrow(BadFiringError);
  });

  it('refuses a rule that carries a gate, since no sourced gate exists', () => {
    expect(() => signalsFromFirings({ ...R.luck, gatedBy: ['x.y'] }, [], { forecastConventions: input().forecastConventions, span: input().span })).toThrow(/gate/);
  });

  it('drops firings outside the span and keeps natal ones; every signal says it is ungated', () => {
    const o = { forecastConventions: input().forecastConventions, span: input().span };
    expect(signalsFromFirings(R.luck, [yearFiring(2020, 'luck')], o)).toEqual([]);
    const r = run();
    expect(r.signals.every((s) => s.gate.state === 'ungated' && s.badges.includes('no promise rule applied'))).toBe(true);
    const natal = signalsOf(r, R.natal.id);
    expect(natal).toHaveLength(1);
    expect(natal[0]!.startUtcMs).toBeNull();
    expect(natal[0]!.id).toBe('synth.bazi-natal@natal@wealth');
  });

  it('gives a second signal at the same instant a numbered id', () => {
    const o = { forecastConventions: input().forecastConventions, span: input().span };
    const s = signalsFromFirings(R.luck, [yearFiring(2033, 'luck'), yearFiring(2033, 'luck', 'another gain')], o);
    expect(s.map((x) => x.id)).toEqual([`synth.bazi-luck@${Date.UTC(2033, 0, 1)}@wealth`, `synth.bazi-luck@${Date.UTC(2033, 0, 1)}@wealth#2`]);
  });

  it('keeps the rule\'s strength as an internal ordering key: it is on no badge and in no sentence', () => {
    const a = signalsOf(run(), R.luck.id)[0]!;
    expect(a.orderKey).toBe(3);
    for (const x of [a.badges.join(' '), a.sentence]) expect(x).not.toMatch(/weight|strength/i);
  });

  it('marks experimental, convention-dependent and unopened signals', () => {
    const r = evaluate(input(), { registry: registry(), traditions: ['iching', 'bazi'], topics: ['wealth'], runs: 50 });
    expect(signalsOf(r, R.iching.id).every((s) => s.badges.includes('experimental'))).toBe(true);
    const rel = evaluate(input({ forecastConventions: { baziSexConvention: 'male-chart' } }), { registry: registry(), traditions: ['bazi'], topics: ['relationships'], runs: 50 });
    expect(signalsOf(rel, R.spouse.id)[0]!.badges).toContain('convention-dependent');
  });
});

describe('dedupe and de-duplication in readings', () => {
  it('two rules with one dedupe key count once, the stronger rule kept and the other listed', () => {
    const r = run();
    const { kept, alsoReportedBy } = dedupe(r.signals);
    const t = Date.UTC(2033, 0, 1);
    const luck33 = kept.filter((s) => s.startUtcMs === t && s.tradition === 'bazi' && s.stage === 'period-lord');
    expect(luck33.map((s) => s.ruleId)).toEqual([R.luck.id]);
    expect(alsoReportedBy[luck33[0]!.id]).toEqual([signalsOf(r, R.luckAgain.id)[0]!.id]);
    const reading = r.readings.find((x) => x.tradition === 'bazi' && x.group === null && x.slice === idx(2033))!;
    expect(reading.signalIds).toEqual([luck33[0]!.id]);
    expect(reading.alsoReportedBy[luck33[0]!.id]).toHaveLength(1);
  });

  it('the choice does not depend on the order the signals arrive in', () => {
    const r = run();
    const forward = dedupe(r.signals).kept.map((s) => s.id).sort();
    const backward = dedupe([...r.signals].reverse()).kept.map((s) => s.id).sort();
    expect(backward).toEqual(forward);
  });

  it('different instances of one key are different facts', () => {
    const r = run();
    const luckIds = dedupe(r.signals).kept.filter((s) => s.ruleId === R.luck.id).map((s) => s.id);
    expect(luckIds).toHaveLength(2);
  });
});

describe('readings', () => {
  const sig = (direction: Signal['direction'], stage: Signal['stage'] = 'period-lord'): Signal => {
    const [s] = signalsFromFirings({ ...R.luck, direction, stage }, [yearFiring(2033, 'luck')], { forecastConventions: input().forecastConventions, span: input().span });
    return s!;
  };

  it('a rule that itself states a mixed result makes its technique read mixed, even beside a rule that supports', () => {
    expect(wordFor([sig('favourable'), sig('mixed')])).toEqual({ word: 'mixed', note: 'a rule here states a mixed result' });
    expect(tallyText(tallyOf([sig('favourable'), sig('mixed')]))).toBe('1 rule supports, 1 is stated as mixed');
  });

  it('words follow section 5.1 and carry no number', () => {
    expect(wordFor([])).toEqual({ word: 'nothing-said', note: null });
    expect(wordFor([sig('favourable')]).word).toBe('supports');
    expect(wordFor([sig('favourable'), sig('favourable', 'activation')]).word).toBe('supports');
    expect(wordFor([sig('unfavourable')]).word).toBe('cautions');
    expect(wordFor([sig('mixed')]).word).toBe('mixed');
    expect(wordFor([sig('favourable'), sig('unfavourable')])).toEqual({ word: 'mixed', note: 'rules conflict' });
    expect(wordFor([sig('favourable', 'period-lord'), sig('unfavourable', 'activation')])).toEqual({ word: 'mixed', note: 'supports from the period lord, cautions from the trigger' });
    expect(wordFor([sig('activates', 'activation')])).toEqual({ word: 'nothing-said', note: 'topic active' });
    expect(wordFor([sig('favourable', 'modifier')])).toEqual({ word: 'nothing-said', note: 'topic active' });
  });

  it('a signal counts in every slice it overlaps, with the overlap fraction, and once per slice', () => {
    const o = { forecastConventions: input().forecastConventions, span: input().span };
    const long = signalsFromFirings(R.luck, [{ clock: 'luck', startUtcMs: Date.UTC(2033, 6, 1), endUtcMs: Date.UTC(2035, 0, 1), facts: yearFiring(2033, 'luck').facts }], o);
    const slices = slicesOf(input().span);
    const readings = buildReadings(long, slices, { coverage: run().registry.coverage, traditions: ['bazi'], topics: ['wealth'] });
    const total = readings.filter((r) => r.group === null);
    expect(total.filter((r) => r.word === 'supports').map((r) => r.slice)).toEqual([idx(2033), idx(2034)]);
    const frac = total.find((r) => r.slice === idx(2033))!.overlaps[long[0]!.id]!;
    expect(frac).toBeGreaterThan(0.49);
    expect(frac).toBeLessThan(0.51);
    expect(overlaps(long[0]!, Date.UTC(2035, 0, 1), Date.UTC(2036, 0, 1))).toBe(false);
    expect(overlapFraction(long[0]!, Date.UTC(2035, 0, 1), Date.UTC(2036, 0, 1))).toBe(0);
  });

  it('natal signals never enter a slice and modifiers never decide a word', () => {
    const r = run();
    const bazi = r.readings.filter((x) => x.tradition === 'bazi' && x.group === null);
    expect(bazi.flatMap((x) => x.signalIds)).not.toContain('synth.bazi-natal@natal@wealth');
    const y2033 = bazi.find((x) => x.slice === idx(2033))!;
    expect(y2033.modifierIds).toEqual([signalsOf(r, R.modifier.id)[0]!.id]);
    expect(y2033.word).toBe('supports');
    const luck33 = signalsOf(r, R.luck.id).find((s) => s.startUtcMs === Date.UTC(2033, 0, 1))!;
    expect(luck33.modifiedBy).toEqual([signalsOf(r, R.modifier.id)[0]!.id]);
    const copy = r.signals.map((s) => ({ ...s, modifiedBy: [] as string[] }));
    attachModifiers(copy);
    expect(copy.find((s) => s.id === luck33.id)!.modifiedBy).toHaveLength(1);
  });

  it('reports the bound-rule coverage behind each reading', () => {
    const r = run();
    const reading = r.readings.find((x) => x.tradition === 'bazi' && x.topic === 'wealth')!;
    expect(reading.boundRules).toBe(r.registry.coverage.bazi.wealth);
    expect(reading.boundRules).toBeGreaterThan(0);
  });
});

describe('clocks and independence groups', () => {
  it('luck, birthday and dasha clocks are one group; each sky clock is its own', () => {
    for (const c of ['luck', 'birthday', 'dasha', 'solar-longitude', 'calendar-year'] as const) expect(clockGroupOf(c)).toBe('birth-arithmetic');
    expect(clockGroupOf('jupiter-tropical')).toBe('jupiter-tropical');
    expect(clockGroupOf('jupiter-sidereal')).toBe('jupiter-sidereal');
    expect(clockGroupOf('jupiter-tropical')).not.toBe(clockGroupOf('jupiter-sidereal'));
    expect(clockGroupOf('saturn-tropical')).not.toBe(clockGroupOf('saturn-sidereal'));
    expect(groupLabel('birth-arithmetic')).toMatch(/birth moment/);
    expect(Object.keys(CLOCKS)).toHaveLength(14);
  });

  it('luck and dasha readings are merged into one group in a cell', () => {
    const r = run();
    const cell = r.agreement.find((c) => c.slice === idx(2036))!;
    const group = cell.entries.find((e) => e.group === 'birth-arithmetic')!;
    expect(cell.entries.filter((e) => e.group === 'birth-arithmetic')).toHaveLength(1);
    expect(group.twoVerdicts).toBe(true);
    expect(group.word).toBe('mixed');
    expect(cell.notes.join(' ')).toContain('the techniques inside this one group give different signs');
  });

  it('the tropical and sidereal Jupiter clocks are different groups but print the one-planet note', () => {
    const r = run(['bazi', 'vedic', 'iching', 'western']);
    const cell = r.agreement.find((c) => c.slice === idx(2037))!;
    expect(cell.entries.map((e) => e.group).sort()).toEqual(['birth-arithmetic', 'jupiter-sidereal', 'jupiter-tropical']);
    expect(cell.verdict).toBe('agree-supports');
    expect(cell.notes).toContain("two traditions read the same planet's movement, so they count once");
    const alone = r.agreement.find((c) => c.slice === idx(2033))!;
    expect(alone.notes).not.toContain("two traditions read the same planet's movement, so they count once");
  });
});

describe('agreement', () => {
  const r = run();
  const verdict = (y: number): string => r.agreement.find((c) => c.slice === idx(y))!.verdict;

  it('gives the verdicts the specification defines', () => {
    expect(verdict(2033)).toBe('agree-supports');
    expect(verdict(2034)).toBe('single');
    expect(verdict(2036)).toBe('single');
    expect(verdict(2037)).toBe('single');
    expect(verdict(2038)).toBe('contradiction');
    expect(verdict(2031)).toBe('silent');
  });

  it('counts groups by word and names the silent traditions', () => {
    const c = r.agreement.find((x) => x.slice === idx(2033))!;
    expect(c.groups).toEqual({ supports: 2, cautions: 0, mixed: 0, silent: 0 });
    const d = r.agreement.find((x) => x.slice === idx(2034))!;
    expect(d.silentTraditions).toEqual(['vedic']);
    expect(d.groups.supports).toBe(1);
  });

  it('never counts the I Ching toward agreement', () => {
    expect(AGREEMENT_BEARING).not.toContain('iching');
    expect(r.agreement.every((c) => c.entries.every((e) => !e.traditions.includes('iching')))).toBe(true);
    // the I Ching speaks every year, yet 2031 is silent
    expect(r.readings.filter((x) => x.tradition === 'iching' && x.group === null).every((x) => x.word === 'supports')).toBe(true);
    expect(verdict(2031)).toBe('silent');
  });

  it('merges words and verdicts by the rules', () => {
    expect(mergeWords(['supports', 'nothing-said'])).toEqual({ word: 'supports', twoVerdicts: false });
    expect(mergeWords(['supports', 'cautions'])).toEqual({ word: 'mixed', twoVerdicts: true });
    expect(mergeWords(['nothing-said'])).toEqual({ word: 'nothing-said', twoVerdicts: false });
    expect(verdictOf(['supports', 'supports'])).toBe('agree-supports');
    expect(verdictOf(['cautions', 'cautions', 'nothing-said'])).toBe('agree-cautions');
    expect(verdictOf(['supports', 'cautions'])).toBe('contradiction');
    expect(verdictOf(['mixed', 'supports'])).toBe('no-agreement');
    expect(verdictOf(['mixed'])).toBe('single');
    expect(verdictOf([])).toBe('silent');
    expect(isAgree('contradiction')).toBe(false);
  });

  it('never renders an agree verdict without its baseline line', () => {
    expect(() => renderAgreement(r.agreement.filter((c) => c.topic === 'wealth'), null, 10)).toThrow(/baseline/);
    const lines = renderAgreement(r.agreement, r.baselines.wealth!, 10);
    const text = lines.join('\n');
    expect(text).toMatch(/found 1 agreeing year; about [\d.]+ would be expected if the groups were unrelated; 1 topic looked at on this page/);
    expect(text).toContain('Agreement means that techniques counted on different time scales');
    expect(text).toContain('Full text');
    expect(renderAgreement([], null, 10).length).toBe(3);
  });
});

describe('baseline', () => {
  const series = (word: ReadingWord, positions: number[], n: number): ReadingWord[] => Array.from({ length: n }, (_, i) => (positions.includes(i) ? word : 'nothing-said'));

  it('a fixed seed reproduces, another seed need not', () => {
    const s = { a: series('supports', [0, 1, 2, 10], 30), b: series('supports', [0, 1, 2, 20], 30) };
    const x = agreementBaseline(s, { seed: 7, runs: 300, cellsLooked: 1 });
    const y = agreementBaseline(s, { seed: 7, runs: 300, cellsLooked: 1 });
    expect(y).toEqual(x);
    expect(agreementBaseline(s, { seed: 8, runs: 300, cellsLooked: 1 }).expected).not.toBe(x.expected);
    expect(x.runs).toBe(300);
    expect(agreementBaseline(s, { cellsLooked: 1 }).runs).toBe(1000);
  });

  it('the generator is deterministic and uniform enough', () => {
    const a = seededRandom(1);
    const b = seededRandom(1);
    const xs = Array.from({ length: 2000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 2000 }, () => b()));
    expect(xs.every((v) => v >= 0 && v < 1)).toBe(true);
    const mean = xs.reduce((p, v) => p + v, 0) / xs.length;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.03);
  });

  it('for independent random series the found count is near the expected count', () => {
    const rand = seededRandom(99);
    const make = (n: number, rate: number): ReadingWord[] => {
      const out: ReadingWord[] = [];
      for (let i = 0; i < n; i++) out.push(rand() < rate ? (rand() < 0.6 ? 'supports' : 'cautions') : 'nothing-said');
      return out;
    };
    let diff = 0;
    const trials = 40;
    for (let t = 0; t < trials; t++) {
      const b = agreementBaseline({ a: make(120, 0.4), b: make(120, 0.3) }, { seed: t + 1, runs: 300, cellsLooked: 1 });
      diff += b.found - b.expected;
    }
    // Each trial's difference has mean 0; the mean of 40 stays well inside one slice.
    expect(Math.abs(diff / trials)).toBeLessThan(1);
  });

  it('keeps speaking rate and direction mix, so aligned series beat the baseline and unaligned ones do not', () => {
    const aligned = agreementBaseline({ a: series('supports', [3, 4, 5, 6, 7, 8], 60), b: series('supports', [3, 4, 5, 6, 7, 8], 60) }, { seed: 3, runs: 500, cellsLooked: 1 });
    expect(aligned.found).toBe(6);
    expect(aligned.expected).toBeLessThan(2);
    expect(aligned.shareAtLeast).toBeLessThan(0.1);
    const apart = agreementBaseline({ a: series('supports', [3, 4, 5, 6, 7, 8], 60), b: series('supports', [30, 31, 32, 33, 34, 35], 60) }, { seed: 3, runs: 500, cellsLooked: 1 });
    expect(apart.found).toBe(0);
    expect(apart.shareAtLeast).toBe(1);
    // a shifted series has the same number of speaking slices and the same words
    expect(countAgreeing([series('supports', [0, 1], 10), series('cautions', [0, 1], 10)], 10)).toBe(0);
  });

  it('says there is nothing to compare when fewer than two groups speak, and refuses series of unequal length', () => {
    const one = agreementBaseline({ a: series('supports', [1, 2], 10), b: series('supports', [], 10) }, { cellsLooked: 2 });
    expect(one.speakingGroups).toBe(1);
    expect(one.expected).toBe(0);
    expect(one.cellsLooked).toBe(2);
    expect(() => agreementBaseline({ a: series('supports', [1], 10), b: series('supports', [1], 9) }, { cellsLooked: 1 })).toThrow(RangeError);
  });

  it('the evaluation reports it once per topic, with the number of cells looked at', () => {
    const r = run();
    expect(r.baselines.wealth).toMatchObject({ found: 1, runs: 200, seed: 1, cellsLooked: 1, speakingGroups: 2 });
    const two = evaluate(input(), { registry: registry(), traditions: ['bazi', 'vedic'], topics: ['wealth', 'career'], runs: 50 });
    expect(two.baselines.wealth!.cellsLooked).toBe(2);
  });
});

describe('evaluation as a whole', () => {
  it('lists the withheld traditions and counts, and Western can be switched on without redesign', () => {
    const r = run();
    expect(r.registry.switchedOff).toEqual([{ tradition: 'western', count: 2, reason: 'withheld pending verification' }]);
    expect(r.withheldCount).toBe(2);
    expect(r.signals.some((s) => s.tradition === 'western')).toBe(false);
    const on = run(['bazi', 'vedic', 'iching', 'western']);
    expect(on.signals.some((s) => s.tradition === 'western')).toBe(true);
    expect(on.registry.switchedOff).toEqual([]);
  });

  it('only runs bound rules: the rule with a sex requirement waits for a convention', () => {
    const none = evaluate(input(), { registry: registry(), traditions: ['bazi'], topics: ['relationships'], runs: 50 });
    expect(none.signals).toEqual([]);
    expect(none.registry.statuses.find((s) => s.ruleId === R.spouse.id)).toMatchObject({ state: 'withheld', reason: 'needs-sex-convention' });
    const man = evaluate(input({ forecastConventions: { baziSexConvention: 'male-chart' } }), { registry: registry(), traditions: ['bazi'], topics: ['relationships'], runs: 50 });
    expect(man.signals.map((s) => s.ruleId)).toEqual([R.spouse.id]);
  });

  it('a rule that needs the birth time is not run when none is given or the uncertainty is large', () => {
    const base = { registry: registry(), traditions: ['vedic'] as const, topics: ['wealth'] as const, runs: 50 };
    expect(evaluate(input(), base).registry.statuses.find((s) => s.ruleId === R.night.id)!.state).toBe('bound');
    expect(evaluate(input({ birthTimeUncertaintyMinutes: null }), base).registry.statuses.find((s) => s.ruleId === R.night.id)).toMatchObject({ state: 'withheld', reason: 'birth-time-uncertain' });
    expect(evaluate(input({ birthTimeUncertaintyMinutes: 90 }), base).registry.statuses.find((s) => s.ruleId === R.night.id)).toMatchObject({ state: 'withheld', reason: 'birth-time-uncertain' });
  });

  it('puts topic coverage in every result and the JSON follows the specification', () => {
    const r = run();
    const j = reportJson(r, 'wealth') as Record<string, unknown>;
    expect(Object.keys(j)).toEqual(['schema', 'rulesetVersion', 'conventions', 'topic', 'span', 'coverage', 'notEvaluated', 'withheldCount', 'signals', 'readings', 'agreement', 'baseline', 'statements', 'grid', 'headlines', 'yearView', 'agreementDisplay']);
    expect(j.schema).toBe('overlay-forecast/1');
    expect(j.coverage).toEqual({ bazi: 5, vedic: 4, iching: 1, western: 0 });
    const text = JSON.stringify(j);
    expect(text).not.toMatch(/j2000|latitude|"place":|"civil":|"zone":|"nativity":/i);
    expect((j.notEvaluated as Array<{ ruleId: string }>).map((x) => x.ruleId)).toContain(R.vedicUnbound.id);
  });

  it('puts the ordering key, source and variants on every signal', () => {
    const r = run();
    for (const s of r.signals) {
      expect(s.source.citation).toBe('synthetic');
      expect([1, 2, 3]).toContain(s.orderKey);
      expect(s.variants).toBe('none');
      expect(s.verification).toBe('confirmed');
    }
  });
});

describe('narration', () => {
  const r = run();
  const sentences = narrate(r, 'wealth');

  it('has no sentence without a signal id, except a silence, which names its reading', () => {
    expect(sentences.length).toBeGreaterThan(10);
    for (const s of sentences) {
      expect(restsOnSignals(s), s.text).toBe(true);
      if (s.kind === 'silence') {
        expect(s.signalIds).toEqual([]);
        expect(s.readingKey).toMatch(/^reading:/);
      } else expect(s.signalIds.length, s.text).toBeGreaterThan(0);
    }
  });

  it('a quiet year yields a silence sentence for the tradition that said nothing', () => {
    const q = sentences.filter((s) => s.kind === 'silence' && s.slice === idx(2031));
    expect(q.map((s) => s.text)).toEqual(['No rule of BaZi fired for wealth in 2031.', 'No rule of Vedic astrology fired for wealth in 2031.']);
    expect(q[0]!.boundRules).toBeGreaterThan(0);
  });

  it('summarises how the speaking groups stand, in the phrasebook words', () => {
    const s = sentences.find((x) => x.kind === 'summary' && x.slice === idx(2033))!;
    expect(s.text).toBe('In 2033, 2 of 2 speaking groups support wealth (counted from the birth moment, Jupiter (sidereal signs)).');
    expect(s.signalIds.length).toBeGreaterThanOrEqual(2);
    const one = sentences.find((x) => x.kind === 'summary' && x.slice === idx(2034))!;
    expect(one.text).toBe('In 2034, 1 of 1 speaking group supports wealth (counted from the birth moment); nothing was said by Vedic astrology.');
    const split = sentences.find((x) => x.kind === 'summary' && x.slice === idx(2038))!;
    // Where the groups do not stand together the summary names what each technique says.
    expect(split.text).toBe('Supports: Jupiter from the Moon, I Ching, read by period. Cautions: BaZi year pillar. Silent: BaZi luck pillar, Vedic mahadasha.');
  });

  it('says natal signals once, undated, and marks the I Ching experimental', () => {
    expect(sentences.filter((s) => s.slice === null).map((s) => s.text)).toEqual(['The natal chart carries a weak root. (cautions)']);
    expect(sentences.filter((s) => s.kind === 'signal' && s.tradition === 'iching').every((s) => s.text.endsWith('[experimental]'))).toBe(true);
  });

  it('health sentences carry the tendency wording', () => {
    const h = narrate(evaluate(input(), { registry: registry(), traditions: ['bazi'], topics: ['health'], runs: 50 }), 'health');
    expect(h.find((s) => s.kind === 'signal')!.text).toContain('a tendency only');
  });
});

describe('forecast tracks', () => {
  const r = run();
  const tracks = forecastTracks(r, 'wealth');

  it('are ordinary Track objects on known clocks, with the specified ids and tones', () => {
    const ids = tracks.map((t) => t.id);
    expect(ids).toContain('fc-wealth-bazi-luck');
    expect(ids).toContain('fc-wealth-vedic-jupiter-sidereal');
    expect(ids).toContain('fc-wealth-agreement');
    for (const t of tracks) {
      expect(Object.keys(CLOCKS)).toContain(t.clock);
      for (const iv of t.intervals) {
        expect(['supports', 'cautions', 'mixed', 'quiet']).toContain(iv.tone);
        expect(['+', '-', '~', '.']).toContain(iv.label);
        expect(iv.endUtcMs).toBeGreaterThan(iv.startUtcMs);
      }
    }
    const agreement = tracks.find((t) => t.id === 'fc-wealth-agreement')!;
    expect(agreement.intervals).toHaveLength(10);
    expect(agreement.intervals[idx(2033)]!.tone).toBe('supports');
    expect(agreement.intervals[idx(2038)]!.tone).toBe('mixed');
  });

  it('keep the intervals of one track from overlapping, by opening a second lane', () => {
    for (const t of tracks) {
      const sorted = [...t.intervals].sort((a, b) => a.startUtcMs - b.startUtcMs);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.startUtcMs).toBeGreaterThanOrEqual(sorted[i - 1]!.endUtcMs);
    }
  });
});

describe('group counting helper', () => {
  it('counts agreeing slices across series', () => {
    expect(countAgreeing([['supports', 'cautions', 'nothing-said'], ['supports', 'supports', 'nothing-said']], 3)).toBe(1);
  });
  it('agreementCells can be asked for traditions explicitly', () => {
    const r = run();
    const all = agreementCells(r.readings, r.slices, ['wealth'], ['bazi', 'vedic', 'iching']);
    expect(all.length).toBe(10);
    expect(TO - FROM + 1).toBe(10);
  });
});
