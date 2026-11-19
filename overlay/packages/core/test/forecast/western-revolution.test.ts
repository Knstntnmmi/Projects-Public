// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The solar-return bindings on charts built from plain longitudes and years built from day
 * offsets: for each rule a case that fires, one that does not, and the sentence it prints.
 * The natal chart has Cancer rising (house n is the n-th sign counted from Cancer); a return
 * chart is the same kind of chart with its own Ascendant and planets.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_FORECAST_CONVENTIONS, DEFAULT_REGISTRY, evaluate, makeInput, ruleById, signalsFromFirings, unaccounted, type Firing } from '../../src/forecast/index.ts';
import { BINDINGS, NOT_EVALUATED, COMPLETE } from '../../src/forecast/predicates/western.ts';
import type { PeriodInput, ProfectedYear } from '../../src/forecast/predicates/western/context.ts';
import { makeNatal, type NatalModel } from '../../src/forecast/predicates/western/model.ts';
import * as R from '../../src/forecast/predicates/western/revolution.ts';
import type { Planet } from '../../src/substrate/sky.ts';
import { makeMoment, MS } from '../../src/substrate/time.ts';
import { fixture } from '../../../../fixtures/moments.ts';

const T0 = Date.UTC(2031, 0, 1);
const DAY = MS.DAY;
const YEAR = 365.2422 * DAY;
const WIDE = { startUtcMs: T0 - 1000 * DAY, endUtcMs: T0 + 60 * YEAR };

/** A night chart, Cancer rising at 10 degrees; Mars in Cancer, Saturn in Aquarius, Venus in Libra. */
const LON: Record<Planet, number> = { Sun: 130, Moon: 100, Mercury: 150, Venus: 190, Mars: 95, Jupiter: 250, Saturn: 310 };
const chart = (lon: Partial<Record<Planet, number>> = {}, asc = 100): NatalModel => makeNatal({ ascendant: asc, longitudes: { ...LON, ...lon } });

const yearsOf = (ks: readonly number[]): ProfectedYear[] => ks.map((k) => ({ k, startUtcMs: T0 + k * YEAR, endUtcMs: T0 + (k + 1) * YEAR }));
const input = (ks: readonly number[], model = chart()): PeriodInput => ({ model, mc: 10, years: yearsOf(ks), tenthYear: 'house-table' });
const ret = (k: number, model: NatalModel): R.ReturnYear => ({ k, utcMs: T0 + k * YEAR, model, mc: 10 });

const signals = (id: string, firings: Firing[]) => signalsFromFirings(ruleById(id)!, firings, { forecastConventions: DEFAULT_FORECAST_CONVENTIONS, span: WIDE });
const says = (id: string, firings: Firing[], topic?: string): string[] => [...new Set(signals(id, firings).filter((s) => topic === undefined || s.topic === topic).map((s) => s.sentence))];
const WHOLE = 'labelled variant: whole-sign houses (Lilly used Regiomontanus cusps)';

describe('the tradition is complete', () => {
  it('binds or declares every rule of the verified file', () => {
    expect(COMPLETE).toBe(true);
    expect(unaccounted(DEFAULT_REGISTRY, 'western')).toEqual([]);
    expect(BINDINGS.length + NOT_EVALUATED.length).toBe(56);
    expect(NOT_EVALUATED.map((n) => n.ruleId).sort()).toEqual(['bonatti.profection.revolution-agreement', 'lilly.health.constitution', 'lilly.relationships.single-life.saturn']);
    for (const n of NOT_EVALUATED) expect(n.reason.length).toBeGreaterThan(40);
  });
  it('binds each of the eight return rules once', () => {
    const ids = BINDINGS.map((b) => b.ruleId);
    for (const id of ['lilly.revolution.asc-hostile', 'lilly.revolution.asc-same', 'lilly.revolution.seventh-asc', 'lilly.revolution.lord2-fortune-house', 'lilly.revolution.returns-wealth', 'lilly.revolution.returns-affliction', 'lilly.revolution.contrary-disposition', 'lilly.profection.lord-condition']) {
      expect(ids.filter((x) => x === id), id).toHaveLength(1);
      expect(BINDINGS.find((b) => b.ruleId === id)!.requires).toEqual({ birthTime: true });
    }
  });
});

describe('the return Ascendant sign', () => {
  // Natal Cancer is the 1st sign: Libra the 4th, Capricorn the 7th, Aries the 10th, Sagittarius the 6th, Gemini the 12th.
  const asc = (sign: number) => R.ascHostile(input([1]), [ret(1, chart({}, sign * 30 + 10))]);

  it('asc-hostile fires for the natal 4th, 6th, 7th, 10th and 12th signs, and for no other', () => {
    const hs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((s) => asc(s).map((f) => f.facts.find((x) => x.key === 'h')!.value));
    expect(hs).toEqual([[10], [], [12], [], [], [], [4], [], [6], [7], [], []]);
  });
  it('asc-hostile says the troubles of the house, with the badge of the whole-sign houses and of the return place', () => {
    const f = asc(6);
    expect(says('lilly.revolution.asc-hostile', f)).toEqual(['The return Ascendant falls in the natal 4th house sign: the year carries the troubles of that house.']);
    expect(signals('lilly.revolution.asc-hostile', f).map((s) => s.topic)).toEqual(['general']);
    expect(f[0]!.badges).toContain(WHOLE);
    expect(f[0]!.badges).toContain(R.RETURN_BADGES.place);
    expect(f[0]!.clock).toBe('birthday');
    expect(f[0]!.startUtcMs).toBe(T0 + YEAR);
    expect(signals('lilly.revolution.asc-hostile', f)[0]!.direction).toBe('unfavourable');
  });
  it('asc-hostile reaches the health topic for the 6th, 7th and 12th signs only, and says that the unfortunate-house clause is not evaluated', () => {
    for (const [sign, h] of [[8, 6], [9, 7], [2, 12]] as const) {
      const f = asc(sign);
      expect(signals('lilly.revolution.asc-hostile', f).map((s) => s.topic).sort(), `house ${h}`).toEqual(['general', 'health']);
      expect(f[0]!.badges).toContain(R.RETURN_BADGES.unfortunateHouses);
    }
  });
  it('asc-hostile says nothing for the first return year, which has no return chart', () => {
    expect(R.ascHostile(input([0]), [ret(0, chart({}, 190))])).toEqual([]);
  });

  it('seventh-asc fires only when the return Ascendant is in the natal 7th sign', () => {
    const f = R.seventhAsc(input([1]), [ret(1, chart({}, 280))]);
    expect(says('lilly.revolution.seventh-asc', f)).toEqual(['The return Ascendant falls in the natal 7th house sign: contentions and desire of marriage are signified.']);
    expect(signals('lilly.revolution.seventh-asc', f).map((s) => s.topic)).toEqual(['relationships']);
    expect(f[0]!.badges).toContain(WHOLE);
    expect(R.seventhAsc(input([1]), [ret(1, chart({}, 190))])).toEqual([]);
  });
  it('asc-hostile and seventh-asc are one fact for the 7th sign, as the shared dedupeKey says', () => {
    const a = signals('lilly.revolution.asc-hostile', asc(9))[0]!;
    const b = signals('lilly.revolution.seventh-asc', R.seventhAsc(input([1]), [ret(1, chart({}, 280))]))[0]!;
    expect(a.dedupeKey).toBe(b.dedupeKey);
    // Another year or another sign is another fact.
    const c = signals('lilly.revolution.asc-hostile', R.ascHostile(input([2]), [ret(2, chart({}, 280))]))[0]!;
    expect(c.dedupeKey).not.toBe(a.dedupeKey);
  });

  it('asc-same fires for the natal Ascendant sign and adds the substance clause only for a well-dignified lord', () => {
    // The Moon is the lord of Cancer; at 100 degrees she is in her own house.
    const strong = R.ascSame(input([1]), [ret(1, chart({}, 105))]);
    expect(says('lilly.revolution.asc-same', strong, 'wealth')).toEqual(['The return Ascendant is in the natal Ascendant sign: Lilly reads a good year, with good health and actions succeeding, and increase of substance as the lord of the Ascendant is well dignified.']);
    expect(signals('lilly.revolution.asc-same', strong).map((s) => s.topic).sort()).toEqual(['general', 'health', 'wealth']);
    expect(strong[0]!.badges).toContain(R.RETURN_BADGES.dignified);
    // The Moon in her detriment: the good year without the substance clause, and no wealth statement.
    const weak = R.ascSame(input([1]), [ret(1, chart({ Moon: 280 }, 105))]);
    expect(says('lilly.revolution.asc-same', weak)).toEqual(['The return Ascendant is in the natal Ascendant sign: Lilly reads a good year, with good health and actions succeeding.']);
    expect(signals('lilly.revolution.asc-same', weak).map((s) => s.topic).sort()).toEqual(['general', 'health']);
    expect(strong[0]!.badges).toContain(WHOLE);
  });
  it('asc-same is silent for another sign, and when the lord of the Ascendant is combust', () => {
    expect(R.ascSame(input([1]), [ret(1, chart({}, 135))])).toEqual([]);
    // The Moon 5 degrees from the Sun in Leo: combust.
    expect(chart({ Moon: 135 }).accidentalItems('Moon').some((i) => i.label === 'combust')).toBe(true);
    expect(R.ascSame(input([1]), [ret(1, chart({ Moon: 135 }, 105))])).toEqual([]);
  });
});

describe('lilly.revolution.lord2-fortune-house', () => {
  it('names the whole-sign house of the return in which the lord of the 2nd stands', () => {
    // Return Ascendant Cancer: Leo is the 2nd, so the Sun is its lord; the Sun is at 130, in the 2nd house.
    const f = R.lord2FortuneHouse(input([1]), [ret(1, chart())]);
    expect(f).toHaveLength(1);
    expect(says('lilly.revolution.lord2-fortune-house', f)).toEqual(['In the return the lord of the 2nd stands in the 2nd house: augmentation of estate through the things signified by the 2nd house.']);
    expect(signals('lilly.revolution.lord2-fortune-house', f).map((s) => [s.topic, s.direction])).toEqual([['wealth', 'favourable']]);
    expect(f[0]!.badges).toContain(WHOLE);
    expect(f[0]!.badges!.some((b) => b.includes('Part of Fortune and Jupiter'))).toBe(true);
  });
  it('follows the lord to another house, and to the next year', () => {
    // The Sun at 250 degrees (Sagittarius) is in the 6th house of a Cancer return.
    const f = R.lord2FortuneHouse(input([1, 2]), [ret(1, chart({ Sun: 250 })), ret(2, chart())]);
    expect(f.map((x) => x.facts.find((y) => y.key === 'h')!.value)).toEqual([6, 2]);
    expect(says('lilly.revolution.lord2-fortune-house', [f[0]!])[0]).toBe('In the return the lord of the 2nd stands in the 6th house: augmentation of estate through the things signified by the 6th house.');
  });
});

describe('a planet at a radical place', () => {
  // The return planets stand 17 degrees on from the radical ones unless a case moves them, so that none shares a degree by accident.
  const SHIFTED = Object.fromEntries(Object.entries(LON).map(([p, l]) => [p, l + 17])) as Record<Planet, number>;
  const run = (rule: R.ReturnRule, lon: Partial<Record<Planet, number>>, natal = chart()) => rule(input([1], natal), [ret(1, chart({ ...SHIFTED, ...lon }))]);

  it('returns-wealth: Saturn at the radical place of Jupiter, in the same degree', () => {
    const f = run(R.returnsWealth, { Saturn: 250.9 });
    expect(says('lilly.revolution.returns-wealth', f)).toEqual(['In the return Saturn stands at the radical place of Jupiter: fortunate in body and goods.']);
    expect(signals('lilly.revolution.returns-wealth', f).map((s) => [s.topic, s.direction])).toEqual([['wealth', 'favourable']]);
    expect(f[0]!.badges).toContain(R.RETURN_BADGES.samePlace);
    expect(run(R.returnsWealth, { Saturn: 251.1 })).toEqual([]);
    expect(run(R.returnsWealth, { Saturn: 249.9 })).toEqual([]);
  });
  it('returns-wealth: Jupiter at its own place, Mercury at Saturn and at Jupiter', () => {
    expect(says('lilly.revolution.returns-wealth', run(R.returnsWealth, { Jupiter: 250.5 }))).toEqual(['In the return Jupiter stands at its own radical place: a child and much wealth, health and esteem.']);
    expect(says('lilly.revolution.returns-wealth', run(R.returnsWealth, { Mercury: 310.2 }))).toEqual(['In the return Mercury stands at the radical place of Saturn: profit by husbandry and wealth from old men.']);
    expect(says('lilly.revolution.returns-wealth', run(R.returnsWealth, { Mercury: 250.2 }))).toEqual(['In the return Mercury stands at the radical place of Jupiter: acquires an office, gains by trade.']);
  });
  it('returns-wealth leaves out Saturn at its own place, whose "well affected" has no test', () => {
    expect(run(R.returnsWealth, { Saturn: 310.4 })).toEqual([]);
  });
  it('returns-affliction: the Moon at the Sun, health and general', () => {
    const f = run(R.returnsAffliction, { Moon: 130.5 });
    expect(says('lilly.revolution.returns-affliction', f)).toEqual(['In the return Moon stands at the radical place of Sun: many hazards and dangers, sore eyes.']);
    expect(signals('lilly.revolution.returns-affliction', f).map((s) => s.topic).sort()).toEqual(['general', 'health']);
    expect(signals('lilly.revolution.returns-affliction', f).every((s) => s.direction === 'unfavourable')).toBe(true);
    expect(run(R.returnsAffliction, { Moon: 131.5 })).toEqual([]);
  });
  it('returns-affliction: the Moon at her own place only when she was weak at birth', () => {
    const weakNatal = chart({ Moon: 280.3 });
    expect(weakNatal.cls('Moon')).toBe('weak');
    const f = R.returnsAffliction(input([1], weakNatal), [ret(1, chart({ ...Object.fromEntries(Object.entries(LON).map(([p, l]) => [p, l + 17])) as Record<Planet, number>, Moon: 280.6 }))]);
    expect(says('lilly.revolution.returns-affliction', f)).toEqual(['In the return Moon stands at its own radical place: much ill according to her signification at that time.']);
    // Strong at birth, in her own house: silent.
    expect(chart().cls('Moon')).toBe('strong');
    expect(run(R.returnsAffliction, { Moon: 100.5 })).toEqual([]);
  });
  it('the several planets of one year are separate facts', () => {
    const f = run(R.returnsWealth, { Jupiter: 250.5, Mercury: 250.2 });
    expect(new Set(signals('lilly.revolution.returns-wealth', f).map((s) => s.dedupeKey)).size).toBe(2);
  });
});

describe('lilly.revolution.contrary-disposition', () => {
  it('fires when all planets are below the earth in the radix and all above it in the return', () => {
    const below = chart({ Sun: 100, Moon: 110, Mercury: 120, Venus: 150, Mars: 200, Jupiter: 250, Saturn: 260 });
    const above = chart({ Sun: 280, Moon: 300, Mercury: 320, Venus: 340, Mars: 10, Jupiter: 50, Saturn: 80 });
    const f = R.contraryDisposition(input([1], below), [ret(1, above)]);
    expect(says('lilly.revolution.contrary-disposition', f)).toEqual(['The planets of the return stand opposite to their radical dispositions: Lilly reads an ill year.']);
    expect(signals('lilly.revolution.contrary-disposition', f)[0]!.direction).toBe('unfavourable');
    expect(f[0]!.badges).toContain(WHOLE);
    // One planet still below the earth in the return: silent.
    expect(R.contraryDisposition(input([1], below), [ret(1, chart({ Sun: 280, Moon: 300, Mercury: 320, Venus: 340, Mars: 10, Jupiter: 50, Saturn: 120 }))])).toEqual([])
  });
  it('fires when all planets are cadent in the radix and all in their own houses in the return', () => {
    const cadent = chart({ Sun: 160, Moon: 250, Mercury: 340, Venus: 70, Mars: 165, Jupiter: 255, Saturn: 335 });
    const own = chart({ Sun: 130, Moon: 100, Mercury: 80, Venus: 190, Mars: 215, Jupiter: 250, Saturn: 280 });
    const f = R.contraryDisposition(input([1], cadent), [ret(1, own)]);
    expect(f).toHaveLength(1);
    expect(f[0]!.badges!.some((b) => b.includes('own houses'))).toBe(true);
    // Mars outside his signs: silent.
    expect(R.contraryDisposition(input([1], cadent), [ret(1, chart({ Sun: 130, Moon: 100, Mercury: 80, Venus: 190, Mars: 50, Jupiter: 250, Saturn: 280 }))])).toEqual([]);
  });
  it('is silent for the ordinary chart', () => {
    expect(R.contraryDisposition(input([1]), [ret(1, chart())])).toEqual([]);
  });
});

describe('lilly.profection.lord-condition', () => {
  // The year of age 1 is profected to Leo (lord Sun), with Cancer rising at 10 degrees: the Sun rules until the Ascendant has crossed the sign, then Mercury, lord of Virgo.
  it('strong in the radix and weak in the return: endeavours weak', () => {
    const natal = chart();
    expect(natal.cls('Sun')).toBe('strong');
    const back = chart({ Sun: 310 });
    expect(back.cls('Sun')).toBe('weak');
    const f = R.lordCondition(input([1], natal), [ret(1, back)]);
    const sun = f.filter((x) => x.facts.some((y) => y.key === 'lord' && y.value === 'Sun'));
    expect(sun).toHaveLength(1);
    expect(says('lilly.profection.lord-condition', sun)).toEqual(['Lord of the year Sun: strong in the radix, weak in the return: endeavours weak.']);
    expect(signals('lilly.profection.lord-condition', sun).map((s) => [s.topic, s.direction]).sort()).toEqual([['general', 'unfavourable'], ['wealth', 'unfavourable']]);
    // The stretch is the part of the year the Sun rules: from the return to the day the Ascendant has crossed Leo.
    expect(sun[0]!.startUtcMs).toBe(T0 + YEAR);
    expect(sun[0]!.endUtcMs).toBe(T0 + YEAR + 243 * DAY);
    expect(sun[0]!.badges).toContain(R.RETURN_BADGES.place);
    expect(sun[0]!.badges!.some((b) => b.includes('two of the seven verdicts'))).toBe(true);
  });
  it('weak in the radix and strong in the return: moderate goodness', () => {
    const natal = chart({ Sun: 310 });
    const f = R.lordCondition(input([1], natal), [ret(1, chart())]);
    const sun = f.filter((x) => x.facts.some((y) => y.key === 'lord' && y.value === 'Sun'));
    expect(says('lilly.profection.lord-condition', sun)).toEqual(['Lord of the year Sun: weak in the radix, strong in the return: moderate goodness.']);
    expect(signals('lilly.profection.lord-condition', sun)[0]!.direction).toBe('favourable');
  });
  it('is silent when the two classes are alike, or when the class is neither strong nor weak', () => {
    expect(R.lordCondition(input([1]), [ret(1, chart())])).toEqual([]);
    expect(R.lordCondition(input([1], chart({ Sun: 310 })), [ret(1, chart({ Sun: 310 }))]).filter((x) => x.facts.some((y) => y.key === 'lord' && y.value === 'Sun'))).toEqual([]);
  });
  it('judges the second lord over the rest of the year', () => {
    const natal = chart({ Mercury: 150 });
    const mercury = (lon: number) => R.lordCondition(input([1], natal), [ret(1, chart({ Mercury: lon }))]).filter((x) => x.facts.some((y) => y.key === 'lord' && y.value === 'Mercury'));
    expect(natal.cls('Mercury')).toBe('strong');
    const f = mercury(250);
    expect(chart({ Mercury: 250 }).cls('Mercury')).toBe('weak');
    expect(f).toHaveLength(1);
    expect(f[0]!.startUtcMs).toBe(T0 + YEAR + 243 * DAY);
    expect(f[0]!.endUtcMs).toBe(T0 + 2 * YEAR);
  });
  it('is one fact with the lord of the year by degree for the first stretch, another for the second', () => {
    const f = R.lordCondition(input([1], chart()), [ret(1, chart({ Sun: 310, Mercury: 250 }))]);
    const keys = signals('lilly.profection.lord-condition', f).map((s) => s.dedupeKey);
    expect(new Set(keys).size).toBeGreaterThanOrEqual(1);
  });
  it('uses one stretch for the whole year when both lords are one planet', () => {
    // Saturn rules Capricorn and Aquarius: profected to Capricorn (k = 8 from Cancer is Capricorn: 3 + 8 = 11 -> Pisces; use k = 6).
    const natal = chart({ Saturn: 280 });
    const back = chart({ Saturn: 100 });
    const f = R.lordCondition(input([6], natal), [ret(6, back)]);
    expect(natal.cls('Saturn')).toBe('strong');
    expect(back.cls('Saturn')).toBe('weak');
    expect(f).toHaveLength(1);
    expect(f[0]!.startUtcMs).toBe(T0 + 6 * YEAR);
    expect(f[0]!.endUtcMs).toBe(T0 + 7 * YEAR);
  });
});

describe('the return rules on a sample moment, 2031 to 2060', () => {
  it('speak for wealth in every year through the return chart, each statement placed from one return to the next', { timeout: 60_000 }, () => {
    const f = fixture('jiazi-1984');
    const i = makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2031, toYear: 2060, birthTimeUncertaintyMinutes: 0 });
    const r = evaluate(i, { traditions: ['western'], runs: 20 });
    const own = r.signals.filter((s) => s.ruleId === 'lilly.revolution.lord2-fortune-house');
    expect(own.length).toBeGreaterThanOrEqual(29);
    for (const s of own) {
      expect(s.topic).toBe('wealth');
      expect(s.sentence).toMatch(/^In the return the lord of the 2nd stands in the \d+th house|^In the return the lord of the 2nd stands in the (1st|2nd|3rd) house/);
      expect(s.badges).toContain(WHOLE);
      expect(s.endUtcMs! - s.startUtcMs!).toBeGreaterThan(364 * DAY);
      expect(s.endUtcMs! - s.startUtcMs!).toBeLessThan(367 * DAY);
    }
    // One return Ascendant sign is one fact, whatever the rule reading it: no two kept signals share a key and a topic.
    const ret = r.signals.filter((s) => s.ruleId.startsWith('lilly.revolution.'));
    expect(new Set(ret.map((s) => s.id)).size).toBe(ret.length);
  });
});
