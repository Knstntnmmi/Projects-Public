// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import {
  ALL_RULES,
  auditRegistry,
  createContext,
  createRegistry,
  DEFAULT_REGISTRY,
  evaluate,
  HELD_BACK,
  makeInput,
  needsSex,
  report,
  RegistryError,
  RULE_FILES,
  rulesLine,
  statusOf,
  TOPICS,
  TRADITIONS,
  unaccounted,
  type RunConfig,
  type RuleBinding,
  type Tradition,
} from '../../src/forecast/index.ts';
import { makeMoment } from '../../src/substrate/time.ts';
import { fixture } from '../../../../fixtures/moments.ts';
import * as bazi from '../../src/forecast/predicates/bazi.ts';
import * as iching from '../../src/forecast/predicates/iching.ts';
import * as vedic from '../../src/forecast/predicates/vedic.ts';
import * as western from '../../src/forecast/predicates/western.ts';
import { binding, FILES, input, modules, R, registry, yearFiring } from './synthetic.ts';

const config = (o: Partial<RunConfig> = {}): RunConfig => ({ traditions: ['bazi', 'vedic', 'iching'], sex: null, birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60, ...o });

const MODULES = { bazi, vedic, iching, western };
const WESTERN_RULES = RULE_FILES.find((f) => f.tradition === 'western')!.rules.length;
const STUB = { BINDINGS: [], NOT_EVALUATED: [], buildContext: () => undefined, COMPLETE: false };

describe('the registry over the real rule data', () => {
  it('accounts for every rule exactly once, and for every held-back entry', () => {
    const r = report(DEFAULT_REGISTRY, config());
    const ruleStates = r.statuses.filter((s) => s.state !== 'held-back');
    expect(ruleStates.map((s) => s.ruleId).sort()).toEqual(ALL_RULES.map((x) => x.id).sort());
    expect(r.statuses.filter((s) => s.state === 'held-back')).toHaveLength(HELD_BACK.length);
    for (const t of TRADITIONS) {
      const c = r.counts[t];
      expect(c.bound + c.withheld + c.unbound, t).toBe(c.total);
      expect(c.total).toBe(RULE_FILES.find((f) => f.tradition === t)!.rules.length);
    }
  });

  it('carries Western as withheld pending verification, with its count, and the other traditions as not yet bound', () => {
    const r = report(DEFAULT_REGISTRY, config());
    expect(r.switchedOff).toEqual([{ tradition: 'western', count: WESTERN_RULES, reason: 'withheld pending verification' }]);
    expect(r.counts.western.withheld).toBe(WESTERN_RULES);
    const bazi = r.statuses.find((s) => s.ruleId === 'bazi.topic-spouse-man')!;
    expect(bazi).toMatchObject({ state: 'withheld', reason: 'needs-sex-convention' });
    expect(r.statuses.find((s) => s.ruleId === 'bazi.day-clash-spouse')).toMatchObject({ state: 'withheld', reason: 'needs-sex-convention' });
  });

  it('prints coverage per tradition and topic, taken from the bound rules', () => {
    const r = report(DEFAULT_REGISTRY, config());
    // A tradition nobody has bound yet covers nothing; one that has covers what it bound.
    for (const t of TRADITIONS) if (MODULES[t].BINDINGS.length === 0) for (const topic of TOPICS) expect(r.coverage[t][topic]).toBe(0);
    expect(r.declared.vedic.wealth).toBeGreaterThan(0);
    expect(r.declared.bazi.wealth).toBeGreaterThan(0);
  });

  it('evaluates without any binding and says how many rules are available and withheld (Western is on by default now)', () => {
    const stubs = createRegistry(RULE_FILES, { bazi: STUB, vedic: STUB, iching: STUB, western: STUB }, HELD_BACK);
    const res = evaluate(input(), { registry: stubs, runs: 20 });
    expect(res.signals).toEqual([]);
    expect(res.availableCount).toBe(0);
    expect(res.withheldCount).toBe(HELD_BACK.length);
    expect(rulesLine(res.availableCount, res.withheldCount)).toBe(`0 rules available, ${HELD_BACK.length} withheld because their source could not be checked`);
    expect(res.agreement.every((c) => c.verdict === 'silent')).toBe(true);
  });

  it('has a stub module for each tradition nobody has bound yet, with the shape colleagues fill in', () => {
    for (const m of [bazi, vedic, iching, western]) {
      if (m.BINDINGS.length > 0) continue;
      expect(m.NOT_EVALUATED).toEqual([]);
      expect(m.COMPLETE).toBe(false);
      expect(m.buildContext(undefined as never)).toBeUndefined();
    }
  });

  it('passes the audit that colleagues run on their bindings', () => {
    // Every sample moment, with and without a sex convention: the audit colleagues' bindings face.
    for (const id of ['j2000', 'jiazi-1984', 'southern', 'equator', 'late-zi']) {
      const f = fixture(id);
      for (const sex of ['none', 'male-chart', 'female-chart'] as const) {
        const i = makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2031, toYear: 2040, forecastConventions: { baziSexConvention: sex } });
        expect(auditRegistry(DEFAULT_REGISTRY, i), `${id} ${sex}`).toEqual([]);
      }
    }
    // Western is partly bound and not yet complete: what is left is neither bound nor declared.
    expect(unaccounted(DEFAULT_REGISTRY, 'western').length).toBe(WESTERN_RULES - western.BINDINGS.length - western.NOT_EVALUATED.length);
  });
});

describe('createRegistry', () => {
  const build = (m: ReturnType<typeof modules>) => () => createRegistry(FILES, m, []);
  it('accepts the synthetic registry', () => {
    const r = registry();
    expect(r.bindings.size).toBe(Object.values(modules()).reduce((n, m) => n + m.BINDINGS.length, 0));
    expect(r.notEvaluated.get(R.westernUnbound.id)).toMatch(/house system/);
  });
  it('rejects a binding without a rule, a binding in the wrong tradition, a rule bound twice, and a rule both bound and not evaluated', () => {
    const stray: RuleBinding = { ruleId: 'synth.nothing', tradition: 'bazi', fire: () => [] };
    expect(build(modules({ bazi: { BINDINGS: [stray] } }))).toThrow(/no such rule/);
    const wrong = binding(R.jupiter, 'dasha', []);
    expect(build(modules({ bazi: { BINDINGS: [wrong] } }))).toThrow(/rule is vedic/);
    const twice = [binding(R.luck, 'luck', []), binding(R.luck, 'luck', [])];
    expect(build(modules({ bazi: { BINDINGS: twice } }))).toThrow(/bound twice/);
    expect(build(modules({ bazi: { NOT_EVALUATED: [{ ruleId: R.luck.id, reason: 'x' }] } }))).toThrow(/both bound and declared not evaluated/);
    expect(build(modules({ bazi: { NOT_EVALUATED: [{ ruleId: R.luck.id, reason: '' }], BINDINGS: [] } }))).toThrow(RegistryError);
    expect(build(modules({ vedic: { NOT_EVALUATED: [{ ruleId: R.luck.id, reason: 'x' }] } }))).toThrow(/no such rule of vedic/);
  });
});

describe('statusOf', () => {
  const reg = registry();
  const s = (id: string, c: RunConfig = config()) => statusOf(reg, reg.rules.find((r) => r.id === id)!, c);
  it('says why a rule did not run', () => {
    expect(s(R.luck.id)).toMatchObject({ state: 'bound' });
    expect(s(R.western.id)).toMatchObject({ state: 'withheld', reason: 'tradition-off' });
    expect(s(R.western.id, config({ traditions: ['western'] }))).toMatchObject({ state: 'bound' });
    expect(s(R.westernUnbound.id, config({ traditions: ['western'] }))).toMatchObject({ state: 'withheld', reason: 'not-computable', detail: expect.stringContaining('house system') });
    expect(s(R.spouse.id)).toMatchObject({ state: 'withheld', reason: 'needs-sex-convention' });
    expect(s(R.spouse.id, config({ sex: 'female' }))).toMatchObject({ state: 'bound' });
    expect(s(R.night.id, config({ birthTimeUncertaintyMinutes: null }))).toMatchObject({ state: 'withheld', reason: 'birth-time-uncertain' });
    expect(s(R.night.id, config({ birthTimeUncertaintyMinutes: 61 }))).toMatchObject({ state: 'withheld', reason: 'birth-time-uncertain' });
    expect(s(R.night.id, config({ birthTimeUncertaintyMinutes: 60 }))).toMatchObject({ state: 'bound' });
    expect(s(R.vedicUnbound.id)).toMatchObject({ state: 'unbound' });
  });
  it('lets a binding say it does not need the sex that the rule lists among its inputs', () => {
    const rule = { ...R.spouse };
    expect(needsSex(rule, undefined)).toBe(true);
    expect(needsSex(rule, { ruleId: rule.id, tradition: 'bazi', fire: () => [], requires: { sex: false } })).toBe(false);
    expect(needsSex(R.luck, undefined)).toBe(false);
  });
  it('counts bound rules per tradition and topic from what can actually run', () => {
    const r = report(reg, config());
    expect(r.coverage.bazi.wealth).toBe(5);
    expect(r.coverage.bazi.relationships).toBe(0);
    expect(report(reg, config({ sex: 'male' })).coverage.bazi.relationships).toBe(1);
    expect(r.coverage.western.wealth).toBe(0);
    expect(r.counts.vedic.unbound).toBe(1);
  });
});

describe('the audit the registry runs on a tradition\'s bindings', () => {
  const run = (bindings: RuleBinding[], complete = false) => auditRegistry(registry({ bazi: { BINDINGS: bindings, COMPLETE: complete } }), input(), { traditions: ['bazi'] });
  it('finds nothing wrong with the synthetic bindings', () => {
    expect(auditRegistry(registry(), input())).toEqual([]);
  });
  it('flags a complete tradition that leaves a rule unaccounted for', () => {
    const problems = auditRegistry(registry({ vedic: { COMPLETE: true } }), input(), { traditions: ['vedic'] });
    expect(problems).toEqual([`${R.vedicUnbound.id}: vedic says it is complete, but this rule is neither bound nor declared not evaluated`]);
  });
  it('flags a template slot no fact fills', () => {
    const bad: RuleBinding = { ruleId: R.luck.id, tradition: 'bazi', fire: () => [{ ...yearFiring(2033, 'luck'), facts: [] }] };
    expect(run([bad])).toEqual([expect.stringContaining('needs {planet}')]);
  });
  it('flags a binding that gives a different answer the second time', () => {
    let n = 0;
    const flaky: RuleBinding = { ruleId: R.luck.id, tradition: 'bazi', fire: () => [yearFiring(2033, 'luck', n++ === 0 ? 'a gain' : 'a loss')] };
    expect(run([flaky])).toEqual([expect.stringContaining('different firings')]);
  });
  it('flags a binding that throws, a non-finite fact, and a forbidden word in a sentence', () => {
    const boom: RuleBinding = { ruleId: R.luck.id, tradition: 'bazi', fire: () => { throw new Error('boom'); } };
    expect(run([boom])).toEqual([expect.stringContaining('boom')]);
    const nan: RuleBinding = { ruleId: R.luck.id, tradition: 'bazi', fire: () => [yearFiring(2033, 'luck', 'a gain', { facts: [{ key: 'planet', label: 'p', value: 'x' }, { key: 'thing', label: 't', value: 'x' }, { key: 'year', label: 'y', value: NaN }] })] };
    expect(run([nan])[0]).toMatch(/not a finite number/);
    const loud: RuleBinding = { ruleId: R.luck.id, tradition: 'bazi', fire: () => [yearFiring(2033, 'luck', 'a probable gain, will come')] };
    expect(run([loud])[0]).toMatch(/uses the word "will"/);
  });
  it('flags mortality wording in a health sentence, unless the rule is a listed exception', () => {
    const health: RuleBinding = { ruleId: R.health.id, tradition: 'bazi', fire: () => [{ ...yearFiring(2036, 'luck'), facts: [{ key: 'year', label: 'y', value: 2036 }] }] };
    expect(run([health])).toEqual([]);
  });
  it('refuses mortality wording in a health sentence that is not a listed exception', () => {
    const files = FILES.map((f) => ({ ...f, rules: f.rules.map((r) => (r.id === R.health.id ? { ...r, template: 'This points to death in {year}.' } : r)) }));
    const reg = createRegistry(files, modules({ bazi: { BINDINGS: [{ ruleId: R.health.id, tradition: 'bazi', fire: () => [{ ...yearFiring(2036, 'luck'), facts: [{ key: 'year', label: 'y', value: 2036 }] }] }] } }), []);
    expect(auditRegistry(reg, input(), { traditions: ['bazi'] })).toEqual([expect.stringContaining('mortality or diagnosis wording')]);
  });
  it('does not run a binding the run configuration withholds', () => {
    const spouse = binding(R.spouse, 'luck', [2035], { requires: { sex: true }, fire: () => { throw new Error('must not run'); } });
    expect(run([spouse])).toEqual([]);
  });
  it('gives each tradition\'s context builder the base context, once', () => {
    let calls = 0;
    const reg = registry({ vedic: { buildContext: (base) => { calls++; return { slices: base.slices.length }; } } });
    const ctx = createContext(input(), reg.builders);
    expect(ctx.extension<{ slices: number }>('vedic')).toEqual({ slices: 10 });
    expect(ctx.extension('vedic')).toEqual({ slices: 10 });
    expect(calls).toBe(1);
    expect(ctx.extension('bazi')).toBeUndefined();
  });
  it('lets a binding read what its own context builder made', () => {
    const reg = registry({
      bazi: {
        buildContext: () => ({ years: [2035] }),
        BINDINGS: [{ ruleId: R.luck.id, tradition: 'bazi', fire: (ctx) => ctx.extension<{ years: number[] }>('bazi')!.years.map((y) => yearFiring(y, 'luck')) }],
      },
    });
    const res = evaluate(input(), { registry: reg, traditions: ['bazi'], topics: ['wealth'], runs: 20 });
    expect(res.signals.map((s) => s.sentence)).toEqual(['The Jupiter period brings a gain in 2035.']);
  });
});

describe('types of tradition', () => {
  it('knows four', () => {
    const t: Tradition[] = [...TRADITIONS];
    expect(t).toEqual(['bazi', 'vedic', 'iching', 'western']);
  });
});
