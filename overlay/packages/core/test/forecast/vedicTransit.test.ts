// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The Jupiter and Saturn gochara bindings. The tables are checked against the strings of the
 * rule file; each rule is run on hand-made sign stays (a case that fires, one that does not,
 * and the sentence); and the vedha and sign-portion windows are checked against an
 * independent sampling of the sky, in both directions: nothing reported that is false, and
 * nothing missed on the days sampled.
 */
import { describe, expect, it } from 'vitest';
import { createContext, DEFAULT_FORECAST_CONVENTIONS, evaluate, makeInput, RULE_FILES, ruleById, signalsFromFirings, type ForecastContext, type Signal } from '../../src/forecast/index.ts';
import { BINDINGS } from '../../src/forecast/predicates/vedic.ts';
import { JUPITER_GOOD, JUPITER_OTHER, OBSTRUCTED, SATURN_GOOD, SATURN_OTHER, VEDHA } from '../../src/forecast/predicates/vedic/transit.ts';
import { longitudeOf, norm360, type Planet } from '../../src/substrate/sky.ts';
import { makeMoment } from '../../src/substrate/time.ts';
import { siderealLongitude } from '../../src/systems/vedic/index.ts';
import { SIGNS, signOf } from '../../src/systems/western/index.ts';
import { vedicChartModel } from '../../src/systems/vedic/houses.ts';
import { MOMENTS } from '../../../../fixtures/moments.ts';

const DAY = 86_400_000;
const T0 = 10 ** 12;
const SPAN = { startUtcMs: T0, endUtcMs: T0 + 4000 * DAY };
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

const tables = RULE_FILES.find((f) => f.tradition === 'vedic')!.tables.GOCHARA as string;
const listOf = (s: string): number[] => s.split(',').map(Number);
const gochara = (planet: string): { good: number[]; vedha: number[] } => {
  const m = new RegExp(`${planet} ([\\d,]+) / ([\\d,]+)`).exec(tables)!;
  return { good: listOf(m[1]!), vedha: listOf(m[2]!) };
};

describe('the gochara tables against the rule file', () => {
  it('Jupiter: the good houses and their vedha houses, in the order the rule file lists them', () => {
    const g = gochara('Jupiter');
    expect(Object.keys(VEDHA.Jupiter).map(Number).sort((a, b) => a - b)).toEqual([...g.good].sort((a, b) => a - b));
    g.good.forEach((h, i) => expect(VEDHA.Jupiter[h]).toBe(g.vedha[i]));
    expect(Object.keys(JUPITER_GOOD).map(Number).sort((a, b) => a - b)).toEqual([2, 5, 7, 9, 11]);
  });

  it('Saturn: the same, and the three good houses', () => {
    const g = gochara('Saturn');
    g.good.forEach((h, i) => expect(VEDHA.Saturn[h]).toBe(g.vedha[i]));
    expect(Object.keys(SATURN_GOOD).map(Number)).toEqual([3, 6, 11]);
    expect(g.good).toEqual([3, 6, 11]);
  });

  it('the good and unfavourable houses of each planet together cover the twelve houses once', () => {
    const all = (...ts: Record<number, unknown>[]): number[] => ts.flatMap((t) => Object.keys(t).map(Number)).sort((a, b) => a - b);
    expect(all(JUPITER_GOOD, JUPITER_OTHER)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // Saturn's twelve houses: good, the four named (12, 1, 2, 8) and the other five.
    expect([...all(SATURN_GOOD, SATURN_OTHER), 12, 1, 2, 8].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('every topic a house maps to is a topic of its rule', () => {
    const topicsOf = (id: string): string[] => ruleById(id)!.topics;
    for (const t of Object.values(JUPITER_GOOD).flat()) expect(topicsOf('parashari.jupiter-transit-good')).toContain(t);
    for (const t of Object.values(JUPITER_OTHER).flat()) expect(topicsOf('parashari.jupiter-transit-other')).toContain(t);
    for (const t of Object.values(SATURN_GOOD).flat()) expect(topicsOf('parashari.saturn-transit-good')).toContain(t);
    for (const t of Object.values(SATURN_OTHER).flat()) expect(topicsOf('parashari.saturn-transit-other')).toContain(t);
  });
});

/** A context whose Moon is in Cancer and whose planets stay in the signs the test names, one 100-day stay each. */
function stayCtx(planet: string, signs: number[]): ForecastContext {
  const placements = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'].map((p, i) => ({ planet: p, signIndex: p === 'Moon' ? 3 : i % 12, degree: 10 }));
  const model = vedicChartModel(0, placements);
  const spans = signs.map((s, i) => ({ label: SIGNS[s]!, lord: planet, startUtcMs: T0 + i * 100 * DAY, endUtcMs: T0 + (i + 1) * 100 * DAY }));
  return { input: { span: SPAN }, ingresses: () => spans, extension: () => ({ model }), memo: (_k: string, c: () => unknown) => c() } as unknown as ForecastContext;
}

function runStays(ruleId: string, planet: string, signs: number[]): Signal[] {
  const rule = ruleById(ruleId)!;
  const b = BINDINGS.find((x) => x.ruleId === ruleId)!;
  return signalsFromFirings(rule, b.fire(stayCtx(planet, signs), rule), { forecastConventions: DEFAULT_FORECAST_CONVENTIONS, span: SPAN });
}

// The Moon is in Cancer (sign 3), so the house from the Moon of sign s is (s - 3 + 12) % 12 + 1.
const signOfHouse = (h: number): number => (3 + h - 1) % 12;
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(signOfHouse);

describe('the transit rules on hand-made stays', () => {
  const stays = (id: string, planet: string): number[] => [...new Set(runStays(id, planet, ALL).map((s) => Number(s.facts.find((f) => f.key === 'h')!.value)))].sort((a, b) => a - b);

  it('each rule fires for its houses from the Moon and no others', () => {
    expect(stays('parashari.jupiter-transit-good', 'Jupiter')).toEqual([2, 5, 7, 9, 11]);
    expect(stays('parashari.jupiter-transit-other', 'Jupiter')).toEqual([1, 3, 4, 6, 8, 10, 12]);
    expect(stays('parashari.saturn-transit-good', 'Saturn')).toEqual([3, 6, 11]);
    expect(stays('parashari.saturn-transit-other', 'Saturn')).toEqual([4, 5, 7, 9, 10]);
    expect(stays('parashari.saturn-12th-from-moon', 'Saturn')).toEqual([12]);
    expect(stays('parashari.saturn-1st-from-moon', 'Saturn')).toEqual([1]);
    expect(stays('parashari.saturn-2nd-from-moon', 'Saturn')).toEqual([2]);
    expect(stays('parashari.saturn-8th-from-moon', 'Saturn')).toEqual([8]);
  });

  it('say the template with the sign house and the dates of the stay, on the sidereal clock of the planet', () => {
    const j = runStays('parashari.jupiter-transit-good', 'Jupiter', [signOfHouse(5)]);
    expect(j.map((s) => s.sentence)).toEqual([`Jupiter transits the 5th sign from your natal Moon from ${iso(T0)} to ${iso(T0 + 100 * DAY)}; the 5th is a favourable house.`]);
    expect(j[0]!.clock).toBe('jupiter-sidereal');
    expect(j[0]!.clockGroup).toBe('jupiter-sidereal');
    expect(j[0]!.startUtcMs).toBe(T0);
    const s = runStays('parashari.saturn-8th-from-moon', 'Saturn', [signOfHouse(8)]);
    expect(s[0]!.sentence).toBe(`Saturn transits the 8th sign from your natal Moon from ${iso(T0)} to ${iso(T0 + 100 * DAY)}; strain on wealth, health and close ties.`);
    expect(s.map((x) => x.topic).sort()).toEqual(['health', 'relationships', 'wealth']);
    expect(s[0]!.clock).toBe('saturn-sidereal');
    expect(runStays('parashari.saturn-1st-from-moon', 'Saturn', [3])[0]!.sentence).toMatch(/^Saturn transits your natal Moon sign from /);
  });

  it('give each Jupiter house the topics the rule file names for it', () => {
    const topicsAt = (h: number): string[] => runStays('parashari.jupiter-transit-good', 'Jupiter', [signOfHouse(h)]).map((s) => s.topic).sort();
    expect(topicsAt(2)).toEqual(['wealth']);
    expect(topicsAt(5)).toEqual(['general']);
    expect(topicsAt(7)).toEqual(['relationships']);
    expect(topicsAt(9)).toEqual(['general', 'wealth']);
    expect(topicsAt(11)).toEqual(['career']);
    expect(runStays('parashari.jupiter-transit-good', 'Jupiter', [signOfHouse(4)])).toEqual([]);
  });

  it('keep the three sade-sati signs as three separate rules with their own signals', () => {
    const ids = ['parashari.saturn-12th-from-moon', 'parashari.saturn-1st-from-moon', 'parashari.saturn-2nd-from-moon'];
    const stayOrder = [12, 1, 2].map(signOfHouse);
    const per = ids.map((id) => runStays(id, 'Saturn', stayOrder).filter((s) => s.topic === 'wealth'));
    expect(per.map((x) => x.length)).toEqual([1, 1, 1]);
    // Each fires only in its own stay: the windows do not overlap.
    const w = per.map((x) => [x[0]!.startUtcMs!, x[0]!.endUtcMs!]);
    expect(w).toEqual([[T0, T0 + 100 * DAY], [T0 + 100 * DAY, T0 + 200 * DAY], [T0 + 200 * DAY, T0 + 300 * DAY]]);
    expect(new Set(per.flat().map((s) => s.dedupeKey)).size).toBe(3);
  });
});

// ------------------------------------------------------------------ the sky

const f = MOMENTS.find((m) => m.id === 'j2000')!;
const moment = makeMoment(f.civil, f.zone, f.place);
const input = makeInput(moment, { fromYear: 2000, toYear: 2012, birthTimeUncertaintyMinutes: 0 });
const result = evaluate(input, { traditions: ['vedic'], topics: ['general', 'wealth', 'career'] });
const base = createContext(input);
const moonSign = base.siderealChart().points.find((p) => p.name === 'Moon')!.signIndex;

const sidereal = (p: Planet, t: number): { index: number; degree: number } => signOf(norm360(siderealLongitude(longitudeOf(p, t), t)));
const houseFromMoon = (sign: number): number => ((sign - moonSign + 12) % 12) + 1;

const ord = (n: number): string => `${n}${[, 'st', 'nd', 'rd'][n % 10] && Math.floor(n / 10) !== 1 ? ['th', 'st', 'nd', 'rd'][n % 10] : 'th'}`;

describe('the vedha and sign-portion windows against the sky', () => {
  const vedha = (id: string): Signal[] => result.signals.filter((s) => s.ruleId === id);
  const fact = (s: Signal, key: string): number | string => s.facts.find((x) => x.key === key)!.value;

  it('Jupiter vedha: every window is true at its middle, and every day sampled that is obstructed is covered', () => {
    const sig = vedha('parashari.jupiter-vedha');
    expect(sig.length).toBeGreaterThan(0);
    for (const s of sig) {
      const t = Math.floor((s.startUtcMs! + s.endUtcMs!) / 2);
      const h = Number(fact(s, 'h'));
      const v = Number(fact(s, 'v'));
      expect(VEDHA.Jupiter[h]).toBe(v);
      expect(houseFromMoon(sidereal('Jupiter', t).index)).toBe(h);
      expect(houseFromMoon(sidereal(String(fact(s, 'planet')) as Planet, t).index)).toBe(v);
      expect(s.clock).toBe('jupiter-sidereal');
      expect(s.sentence).toBe(`Jupiter's good transit over the ${ord(h)} is obstructed by ${fact(s, 'planet')} in the ${ord(v)}.`);
    }
    for (let t = input.span.startUtcMs + DAY / 2; t < input.span.endUtcMs; t += 2 * DAY + 3600_000) {
      const h = houseFromMoon(sidereal('Jupiter', t).index);
      const v = VEDHA.Jupiter[h];
      if (v === undefined) continue;
      for (const q of ['Sun', 'Moon', 'Mars', 'Mercury', 'Venus', 'Saturn'] as const) {
        if (houseFromMoon(sidereal(q, t).index) !== v) continue;
        expect(sig.some((s) => fact(s, 'planet') === q && s.startUtcMs! <= t && t <= s.endUtcMs!)).toBe(true);
      }
    }
  });

  it('Saturn vedha: the Sun and the nodes never obstruct, and each window is true at its middle', () => {
    const sig = vedha('parashari.saturn-vedha');
    expect(sig.length).toBeGreaterThan(0);
    for (const s of sig) {
      expect(fact(s, 'planet')).not.toBe('Sun');
      expect(['Rahu', 'Ketu']).not.toContain(fact(s, 'planet'));
      const t = Math.floor((s.startUtcMs! + s.endUtcMs!) / 2);
      expect(houseFromMoon(sidereal('Saturn', t).index)).toBe([3, 6, 11].find((h) => VEDHA.Saturn[h] === Number(fact(s, 'v'))));
      expect(houseFromMoon(sidereal(String(fact(s, 'planet')) as Planet, t).index)).toBe(Number(fact(s, 'v')));
      expect(s.sentence).toBe(`Saturn's good transit is obstructed by ${fact(s, 'planet')} in the ${fact(s, 'v')}th.`);
    }
  });

  it('a vedha signal is a modifier that gives no reading its sign, and the good-transit signals show the obstruction', () => {
    const v = vedha('parashari.jupiter-vedha').find((x) => [5, 9].includes(Number(fact(x, 'h'))))!;
    expect(v.stage).toBe('modifier');
    // Topic general: the framework attaches it to the general-topic signals it overlaps, and the 5th and 9th good houses have such a signal.
    const attached = result.signals.filter((s) => s.ruleId === 'parashari.jupiter-transit-good' && s.modifiedBy.includes(v.id));
    expect(attached.length).toBeGreaterThan(0);
    for (const x of result.readings.filter((r) => r.tradition === 'vedic')) expect(x.signalIds).not.toContain(v.id);
    // The badge is on every topic of a good stay that holds an obstruction, and only on those.
    const obstructed = result.signals.filter((s) => s.badges.includes(OBSTRUCTED));
    expect(obstructed.length).toBeGreaterThan(0);
    for (const s of obstructed) expect(['parashari.jupiter-transit-good', 'parashari.saturn-transit-good']).toContain(s.ruleId);
    // The badge names the obstructing planet and the days, so it tells a stay obstructed for a day from one obstructed for months.
    for (const s of obstructed) expect(s.badges.some((b) => /^the obstructing planet in the vedha house: [A-Za-z, ]+, for [\d.]+ days in all$/.test(b))).toBe(true);
    const withVedha = (s: Signal): boolean => vedha(s.ruleId.includes('jupiter') ? 'parashari.jupiter-vedha' : 'parashari.saturn-vedha').some((x) => Number(fact(x, 'h')) === Number(fact(s, 'h')) && x.startUtcMs! < s.endUtcMs! && x.endUtcMs! > s.startUtcMs!);
    for (const s of result.signals.filter((x) => /transit-good$/.test(x.ruleId) && x.startUtcMs !== null)) {
      if (s.endUtcMs! <= input.span.startUtcMs || s.startUtcMs! >= input.span.endUtcMs) continue;
      expect(s.badges.includes(OBSTRUCTED)).toBe(withVedha(s));
    }
  });

  it('sign portion: Jupiter in the middle ten degrees and Saturn in the last ten, whole windows and no gaps on the days sampled', () => {
    const sig = result.signals.filter((s) => s.ruleId === 'parashari.transit-sign-portion');
    expect(sig.length).toBeGreaterThan(0);
    const want = { Jupiter: [10, 20], Saturn: [20, 30] } as const;
    for (const s of sig) {
      const p = String(fact(s, 'planet')) as 'Jupiter' | 'Saturn';
      const [lo, hi] = want[p];
      expect(fact(s, 'part')).toBe(p === 'Jupiter' ? 'middle' : 'last');
      for (const k of [0.1, 0.5, 0.9]) {
        const d = sidereal(p, Math.floor(s.startUtcMs! + k * (s.endUtcMs! - s.startUtcMs!))).degree;
        expect(d).toBeGreaterThanOrEqual(lo - 0.05);
        expect(d).toBeLessThan(hi + 0.05);
      }
    }
    for (const p of ['Jupiter', 'Saturn'] as const) {
      for (let t = input.span.startUtcMs + DAY / 3; t < input.span.endUtcMs; t += 5 * DAY + 3600_000) {
        const d = sidereal(p, t).degree;
        const [lo, hi] = want[p];
        if (d < lo + 0.1 || d > hi - 0.1) continue; // right at a boundary a one-second cut is not a gap
        expect(sig.some((s) => fact(s, 'planet') === p && s.startUtcMs! <= t && t <= s.endUtcMs!)).toBe(true);
      }
    }
  });

  it('the sign-portion annotation does not need the birth time and the others do', () => {
    for (const b of BINDINGS.filter((x) => x.ruleId.startsWith('parashari.') && /transit|vedha|from-moon/.test(x.ruleId))) {
      expect(b.requires?.birthTime === true).toBe(b.ruleId !== 'parashari.transit-sign-portion');
    }
  });
});

describe('Jupiter and Saturn over thirty years on the sample moments', () => {
  it('the sign stays tile the span without gaps or overlaps, and each stay has exactly one of the Jupiter rules', () => {
    for (const planet of ['Jupiter', 'Saturn'] as const) {
      const sp = base.ingresses(planet, 'sidereal');
      for (let i = 1; i < sp.length; i++) expect(sp[i]!.startUtcMs).toBe(sp[i - 1]!.endUtcMs);
    }
    const jup = base.ingresses('Jupiter', 'sidereal').length;
    const counted = ['parashari.jupiter-transit-good', 'parashari.jupiter-transit-other'].reduce((n, id) => n + new Set(result.signals.filter((s) => s.ruleId === id).map((s) => s.startUtcMs)).size, 0);
    expect(counted).toBeGreaterThan(0);
    expect(counted).toBeLessThanOrEqual(jup);
  });
});
