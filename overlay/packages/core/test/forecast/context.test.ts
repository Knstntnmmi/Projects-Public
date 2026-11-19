// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import { buildTracks } from '../../src/overlay/tracks.ts';
import { DEFAULT_CONVENTIONS } from '../../src/conventions.ts';
import { bisectChange } from '../../src/substrate/sky.ts';
import { signIngresses } from '../../src/systems/western/index.ts';
import { birthTimeSensitivity, sensitivityLines, SENSITIVITY_NOT_CHECKED, createContext, evaluate, ingressSpans, slicesOf, sliceSpan, sovereignSpans } from '../../src/forecast/index.ts';
import { fixture } from '../../../../fixtures/moments.ts';
import { makeMoment } from '../../src/substrate/time.ts';
import { input, moment, registry, R, yearFiring } from './synthetic.ts';

describe('slices', () => {
  it('are calendar years, cut at the first of January UTC, contiguous and labelled', () => {
    const span = sliceSpan(2031, 2040);
    const slices = slicesOf(span);
    expect(slices).toHaveLength(10);
    expect(slices[0]).toMatchObject({ index: 0, year: 2031, label: '2031', startUtcMs: Date.UTC(2031, 0, 1) });
    expect(slices[9]!.endUtcMs).toBe(Date.UTC(2041, 0, 1));
    expect(span).toEqual({ startUtcMs: Date.UTC(2031, 0, 1), endUtcMs: Date.UTC(2041, 0, 1) });
    for (let i = 1; i < slices.length; i++) expect(slices[i]!.startUtcMs).toBe(slices[i - 1]!.endUtcMs);
    expect(slicesOf(sliceSpan(2031, 2031))).toHaveLength(1);
    expect(() => sliceSpan(2040, 2031)).toThrow(RangeError);
  });
});

describe('the context', () => {
  it('computes each thing once and gives the same object back', () => {
    const ctx = createContext(input());
    expect(ctx.pillars()).toBe(ctx.pillars());
    expect(ctx.chart()).toBe(ctx.chart());
    expect(ctx.dashas()).toBe(ctx.dashas());
    expect(ctx.annualPillars()).toBe(ctx.annualPillars());
    let n = 0;
    expect(ctx.memo('k', () => ++n)).toBe(1);
    expect(ctx.memo('k', () => ++n)).toBe(1);
  });

  it('has the luck pillars only when a sex convention was named', () => {
    expect(createContext(input()).luck()).toBeNull();
    const l = createContext(input({ forecastConventions: { baziSexConvention: 'female-chart' } })).luck();
    expect(l).not.toBeNull();
    expect(l!.pillars.length).toBeGreaterThanOrEqual(10);
    expect(createContext(input({ forecastConventions: { baziSexConvention: 'female-chart' } })).sex).toBe('female');
  });

  it('has the annual pillars of the span, the chart, and the sidereal chart with whole-sign houses', () => {
    const ctx = createContext(input());
    const a = ctx.annualPillars();
    expect(a.length).toBeGreaterThanOrEqual(10);
    expect(a[0]!.startUtcMs).toBeLessThan(a[1]!.startUtcMs);
    const sc = ctx.siderealChart();
    expect(sc.lagna.house).toBe(1);
    expect(sc.points.map((p) => p.name)).toEqual(expect.arrayContaining(['Sun', 'Moon', 'Saturn', 'Rahu', 'Ketu']));
    for (const p of sc.points) {
      expect(p.house).toBeGreaterThanOrEqual(1);
      expect(p.house).toBeLessThanOrEqual(12);
      expect(p.house).toBe(((p.signIndex - sc.lagna.signIndex + 12) % 12) + 1);
    }
    const rahu = sc.points.find((p) => p.name === 'Rahu')!;
    const ketu = sc.points.find((p) => p.name === 'Ketu')!;
    expect((((ketu.longitude - rahu.longitude) % 360) + 360) % 360).toBeCloseTo(180, 6);
    // the sidereal sign of the Sun differs from the tropical one by about 24 degrees at this date
    const tropicalSun = ctx.chart().positions.find((p) => p.planet === 'Sun')!.longitude;
    expect(((tropicalSun - sc.points.find((p) => p.name === 'Sun')!.longitude + 360) % 360)).toBeGreaterThan(22);
  });

  it('has the dashas, the gua qi periods and the sovereign hexagram periods under the engine conventions', () => {
    const ctx = createContext(input());
    expect(ctx.dashas().maha.length).toBeGreaterThan(2);
    expect(ctx.dashas().maha.at(-1)!.endUtcMs).toBeGreaterThan(ctx.input.span.endUtcMs);
    expect(ctx.guaQi().length).toBeGreaterThan(50);
    expect(ctx.sovereign().length).toBeGreaterThanOrEqual(120);
    const z = createContext(input({ conventions: { ...DEFAULT_CONVENTIONS, sovereignBoundary: 'zhongqi' } }));
    expect(z.sovereign().length).toBeGreaterThan(ctx.sovereign().length);
  });

  it('draws the sovereign periods from the same arithmetic as the monthly track, under both boundary conventions', () => {
    const start = Date.UTC(2031, 0, 1);
    const end = Date.UTC(2033, 0, 1);
    for (const b of ['jie', 'zhongqi'] as const) {
      const conventions = { ...DEFAULT_CONVENTIONS, sovereignBoundary: b };
      const track = buildTracks(moment(), conventions, { startUtcMs: start, endUtcMs: end }).find((t) => t.id === 'bazi-month')!;
      const spans = sovereignSpans(start, end, b).filter((s) => s.endUtcMs > start && s.startUtcMs < end).map((s) => [s.startUtcMs, s.endUtcMs]);
      expect(track.intervals.map((i) => [i.startUtcMs, i.endUtcMs])).toEqual(spans);
    }
  });

  it('keeps the tropical and sidereal Jupiter boundaries apart as dates, and the tropical ones equal to the engine\'s', () => {
    const ctx = createContext(input());
    const trop = ctx.ingresses('Jupiter', 'tropical');
    const sid = ctx.ingresses('Jupiter', 'sidereal');
    const engine = signIngresses('Jupiter', Date.UTC(2031, 0, 1), Date.UTC(2041, 0, 1), 4);
    expect(trop.map((s) => [s.label, s.startUtcMs, s.endUtcMs])).toEqual(engine.map((s) => [s.label, s.startUtcMs, s.endUtcMs]));
    const tb = new Set(trop.map((s) => s.endUtcMs));
    expect(sid.some((s) => tb.has(s.endUtcMs))).toBe(false);
    expect(sid.length).toBeGreaterThan(5);
    expect(ingressSpans('Jupiter', 'tropical', Date.UTC(2031, 0, 1), Date.UTC(2041, 0, 1), 4)).toEqual(trop);
    expect(bisectChange).toBeTypeOf('function');
  });
});

describe('birth-time sensitivity', () => {
  it('lists the readings that change when the birth moment moves by the stated uncertainty', () => {
    // A binding that reads the birth instant: it fires in 2033 only if the instant is before a threshold set inside the uncertainty.
    const base = input({ birthTimeUncertaintyMinutes: 20 });
    const threshold = base.moment.utcMs - 5 * 60_000;
    const reg = registry({
      bazi: { BINDINGS: [{ ruleId: R.luck.id, tradition: 'bazi', fire: (ctx) => (ctx.input.moment.utcMs > threshold ? [yearFiring(2033, 'luck')] : []) }] },
    });
    const o = { registry: reg, traditions: ['bazi'] as const, topics: ['wealth'] as const, runs: 20 };
    const result = evaluate(base, o);
    const notes = birthTimeSensitivity(base, result, o);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ tradition: 'bazi', topic: 'wealth', slice: 2, from: 'supports', to: 'nothing-said', minutes: 20, text: 'would change if the birth time were 20 minutes off' });
    expect(birthTimeSensitivity(input({ birthTimeUncertaintyMinutes: 0 }), result, o)).toEqual([]);
    expect(birthTimeSensitivity(input({ birthTimeUncertaintyMinutes: null }), result, o)).toEqual([]);
    // What is printed: the tradition whose word turns, the years, the minutes; nothing checked when no uncertainty was given.
    expect(sensitivityLines(base, result, notes, 'wealth')).toEqual(['BaZi, 2033: would change if the birth time were 20 minutes off.']);
    expect(sensitivityLines(base, result, [], 'wealth')).toEqual(['No cell of this grid would change if the birth time were 20 minutes off.']);
    expect(sensitivityLines(input({ birthTimeUncertaintyMinutes: 0 }), result, [], 'wealth')).toEqual([SENSITIVITY_NOT_CHECKED]);
  });
});

describe('the sample moments', () => {
  it('give a context for every fixture without an error', () => {
    for (const id of ['j2000', 'southern', 'equator', 'far-west-zone']) {
      const f = fixture(id);
      const ctx = createContext({ ...input(), moment: makeMoment(f.civil, f.zone, f.place) });
      expect(ctx.siderealChart().points.length).toBe(ctx.chart().positions.length + 2);
    }
  });
});
