// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The levels the bindings declare are the levels their rules speak at: every binding of the
 * default registry declares some, and no statement of a real run (the rules read by period
 * included) stands on a level its rule did not declare. A level that a rule declares and that
 * never fires is what gives the grid a silent row, so a missing declaration would hide a row.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_REGISTRY, evaluate, levelTradition, makeInput, TRADITIONS } from '../../src/forecast/index.ts';
import { makeMoment } from '../../src/substrate/time.ts';
import { fixture } from '../../../../fixtures/moments.ts';

describe('the levels declared by the bindings of the default registry', () => {
  it('are given for every binding, belong to the tradition of the rule, and a rule of undated statements declares natal', () => {
    expect(DEFAULT_REGISTRY.bindings.size).toBeGreaterThan(100);
    for (const [id, b] of DEFAULT_REGISTRY.bindings) {
      expect(b.levels?.length, id).toBeGreaterThan(0);
      for (const l of b.levels!) {
        const t = levelTradition(l);
        expect(t === null || t === b.tradition, `${id}: ${l}`).toBe(true);
      }
    }
    expect(TRADITIONS.every((t) => [...DEFAULT_REGISTRY.bindings.values()].some((b) => b.tradition === t))).toBe(true);
  });

  it.each(['j2000', 'jiazi-1984', 'southern'])('hold every statement of a thirty-year run on %s, with the luck pillars, the I Ching and the day passes switched on', { timeout: 300_000 }, (id) => {
    const f = fixture(id);
    const input = makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2031, toYear: 2060, forecastConventions: { baziSexConvention: 'male-chart' } });
    const res = evaluate(input, { runs: 1, includePeriodRead: true });
    const levelsSeen = new Set(res.signals.map((s) => s.level));
    for (const s of res.signals) {
      const declared = DEFAULT_REGISTRY.bindings.get(s.ruleId)!.levels!;
      expect(declared, `${s.ruleId} fired at ${s.level}`).toContain(s.level);
    }
    // the run reaches the dated levels, so the check above is not empty
    for (const l of ['bazi-luck', 'bazi-year', 'vedic-maha', 'vedic-antar', 'saturn-moon', 'jupiter-moon', 'western-profection', 'western-solar-return', 'western-transits', 'iching-period', 'natal'] as const) expect(levelsSeen.has(l), l).toBe(true);
  });
});
