// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import { auditRegistry, DEFAULT_REGISTRY, evaluate, makeInput, report, RULE_FILES, type Signal } from '../../src/forecast/index.ts';
import { BINDINGS, COMPLETE } from '../../src/forecast/predicates/vedic.ts';
import { GRAHAS, LAGNA_NATURE, SIGN_NAMES } from '../../src/systems/vedic/houses.ts';
import { makeMoment } from '../../src/substrate/time.ts';
import { MOMENTS } from '../../../../fixtures/moments.ts';

const NATAL_IDS = ['parashari.house-topic-map', 'parashari.lagna-functional-nature', 'parashari.yogakaraka-kendra-trikona', 'parashari.planet-dignity'];

const run = (id: string): Signal[] => {
  const f = MOMENTS.find((m) => m.id === id)!;
  const moment = makeMoment(f.civil, f.zone, f.place);
  const r = evaluate(makeInput(moment, { fromYear: 2031, toYear: 2033, birthTimeUncertaintyMinutes: 0 }), { traditions: ['vedic'], topics: ['general', 'wealth', 'career'] });
  return r.signals.filter((s) => NATAL_IDS.includes(s.ruleId));
};

describe('the vedic natal bindings', () => {
  it('bind the four natal-promise rules, each needing the birth time, and every other rule of the file is bound as well', () => {
    const all = RULE_FILES.find((f) => f.tradition === 'vedic')!.rules;
    const natal = all.filter((r) => r.stage === 'natal-promise').map((r) => r.id);
    expect(natal.sort()).toEqual([...NATAL_IDS].sort());
    for (const id of NATAL_IDS) expect(BINDINGS.find((b) => b.ruleId === id)?.requires?.birthTime).toBe(true);
    expect(BINDINGS.map((b) => b.ruleId).sort()).toEqual(all.map((r) => r.id).sort());
    expect(COMPLETE).toBe(true);
  });

  it('pass the registry audit over the sample moments', () => {
    const problems = auditRegistry(DEFAULT_REGISTRY, makeInput(makeMoment(MOMENTS[0]!.civil, MOMENTS[0]!.zone, MOMENTS[0]!.place), { fromYear: 2031, toYear: 2040 }));
    expect(problems.filter((p) => JSON.stringify(p).includes('parashari'))).toEqual([]);
  });

  it('count every rule as bound, and report coverage per topic', () => {
    const r = report(DEFAULT_REGISTRY, { traditions: ['vedic'], sex: null, birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60 });
    const all = RULE_FILES.find((f) => f.tradition === 'vedic')!.rules;
    expect(r.counts.vedic.bound).toBe(all.length);
    expect(r.counts.vedic.unbound).toBe(0);
    for (const topic of ['general', 'wealth', 'career', 'health', 'learning', 'relationships', 'home-travel'] as const) {
      expect(r.coverage.vedic[topic]).toBe(all.filter((x) => x.topics.includes(topic)).length);
    }
  });

  it('give undated signals only, with the citation and no quotation', () => {
    const s = run('j2000');
    expect(s.length).toBeGreaterThan(0);
    for (const x of s) {
      expect(x.startUtcMs).toBeNull();
      expect(x.endUtcMs).toBeNull();
      expect(x.source.quote).toBe('');
      expect(x.source.locator).not.toBe('');
      expect(x.gate.state).toBe('ungated');
    }
  });

  it('say the template with the facts, for each rule', () => {
    const s = run('j2000');
    for (const x of s) {
      expect(x.sentence).not.toMatch(/\{|\}/);
      expect(x.sentence).not.toMatch(/\b(death|dead|likely|probably|chance|percent|probability|confidence|will)\b/i);
    }
    const dig = s.filter((x) => x.ruleId === 'parashari.planet-dignity' && x.topic === 'general');
    expect(dig).toHaveLength(7);
    for (const g of GRAHAS) expect(dig.some((x) => x.sentence.startsWith(`${g} is `))).toBe(true);
    for (const x of dig) expect(x.sentence).toMatch(/^\w+ is .+ at \d+(\.\d+)? \w+\.$/);
  });

  it('give the functional nature that the per-Lagna list states, for the rising sign of the chart', () => {
    for (const m of ['j2000', 'southern', 'equator', 'jiazi-1984']) {
      const s = run(m).filter((x) => x.ruleId === 'parashari.lagna-functional-nature' && x.topic === 'general');
      expect(s.length).toBeGreaterThan(0);
      const lagna = String(s[0]!.facts.find((f) => f.key === 'lagna')!.value);
      const row = LAGNA_NATURE[SIGN_NAMES.indexOf(lagna as (typeof SIGN_NAMES)[number])]!;
      expect(s).toHaveLength(row.auspicious.length + row.malefic.length);
      for (const x of s) {
        const p = String(x.facts.find((f) => f.key === 'planet')!.value);
        const nature = String(x.facts.find((f) => f.key === 'nature')!.value);
        expect(nature).toBe((row.auspicious as readonly string[]).includes(p) ? 'benefic' : 'malefic');
        expect(x.sentence).toBe(`For a ${lagna} Lagna, ${p} is a functional ${nature} (lord of ${x.facts.find((f) => f.key === 'houses')!.value}).`);
      }
    }
  });

  it('give one signal per planet and house for the house map, with each of the topics of that house and no death entry', () => {
    const s = run('j2000').filter((x) => x.ruleId === 'parashari.house-topic-map');
    expect(s.length).toBeGreaterThanOrEqual(9);
    const ids = new Set(s.map((x) => x.id));
    expect(ids.size).toBe(s.length);
    for (const x of s) expect(x.sentence).not.toMatch(/death|dead/);
    // every planet is placed in some house, every house of the chart is owned by someone
    for (const p of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']) expect(s.some((x) => x.sentence.startsWith(`${p} owns or occupies`))).toBe(true);
  });

  it('are repeatable, and the yoga link names the yogakaraka or says no single planet is', () => {
    expect(run('equator').map((x) => x.sentence)).toEqual(run('equator').map((x) => x.sentence));
    for (const m of MOMENTS) {
      for (const x of run(m.id).filter((y) => y.ruleId === 'parashari.yogakaraka-kendra-trikona' && y.topic === 'wealth')) {
        expect(x.sentence).toMatch(/form a kendra-trikona link; .+ (is|are) the yogakaraka of this chart\.$|no single planet is the yogakaraka of this chart\.$/);
      }
    }
  });
});
