// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The Western period, transit and modifier bindings on charts built from plain longitudes and
 * years built from day offsets: for each rule a case that fires, one that does not, and the
 * sentence it prints. Cancer rises in the chart below, so house n is the n-th sign counted
 * from Cancer (Leo is the 2nd, Virgo the 3rd, and so on round to Gemini, the 12th).
 */
import { describe, expect, it } from 'vitest';
import { auditRegistry, DEFAULT_FORECAST_CONVENTIONS, DEFAULT_REGISTRY, dedupe, HELD_BACK, evaluate, makeInput, report, ruleById, signalsFromFirings, unaccounted, type Firing } from '../../src/forecast/index.ts';
import { bannedIn, MORTALITY_WORDS } from '../../src/forecast/phrasebook.ts';
import { BINDINGS, NOT_EVALUATED } from '../../src/forecast/predicates/western.ts';
import type { PeriodInput, ProfectedYear } from '../../src/forecast/predicates/western/context.ts';
import { firdariaLordCondition, SUB_ORDER, subPeriods } from '../../src/forecast/predicates/western/firdaria.ts';
import { makeNatal, type NatalModel } from '../../src/forecast/predicates/western/model.ts';
import { aspectList, strengthClasses } from '../../src/forecast/predicates/western/modifiers.ts';
import * as P from '../../src/forecast/predicates/western/profection.ts';
import * as T from '../../src/forecast/predicates/western/transits.ts';
import { PLANETS, longitudeOf, type Planet } from '../../src/substrate/sky.ts';
import { makeMoment, MS } from '../../src/substrate/time.ts';
import { isPartileMinute } from '../../src/systems/western/aspects.ts';
import { SIGNS } from '../../src/systems/western/dignities.ts';
import type { LordSpan } from '../../src/systems/western/index.ts';
import { prenatalSyzygy } from '../../src/systems/western/syzygy.ts';
import { MOMENTS } from '../../../../fixtures/moments.ts';

const T0 = Date.UTC(2031, 0, 1);
const DAY = MS.DAY;
const YEAR = 365.2422 * DAY;
const WIDE = { startUtcMs: T0 - 1000 * DAY, endUtcMs: T0 + 60 * YEAR };

/** A night chart, Cancer rising at 10 degrees; Mars in Cancer, Saturn in Aquarius, Venus in Libra. */
const LON: Record<Planet, number> = { Sun: 130, Moon: 100, Mercury: 150, Venus: 190, Mars: 95, Jupiter: 250, Saturn: 310 };
const chart = (lon: Partial<Record<Planet, number>> = {}, asc = 100): NatalModel => makeNatal({ ascendant: asc, longitudes: { ...LON, ...lon } });

const yearsOf = (ks: readonly number[]): ProfectedYear[] => ks.map((k) => ({ k, startUtcMs: T0 + k * YEAR, endUtcMs: T0 + (k + 1) * YEAR }));
const input = (o: Partial<PeriodInput> = {}): PeriodInput => ({ model: chart(), mc: 10, years: yearsOf([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), tenthYear: 'house-table', ...o });
const only = (k: number, o: Partial<PeriodInput> = {}): PeriodInput => input({ years: yearsOf([k]), ...o });

/** The signals of a rule's firings, as the framework builds them. */
const signals = (id: string, firings: Firing[]) => signalsFromFirings(ruleById(id)!, P.withHouseDirection(ruleById(id)!.directionByHouse, firings), { forecastConventions: DEFAULT_FORECAST_CONVENTIONS, span: WIDE });
const says = (id: string, firings: Firing[], topic?: string): string[] => [...new Set(signals(id, firings).filter((s) => topic === undefined || s.topic === topic).map((s) => s.sentence))];
const dirs = (id: string, firings: Firing[]): string[] => [...new Set(signals(id, firings).map((s) => s.direction))];

describe('the bindings the second part adds', () => {
  it('leave no rule of the tradition unaccounted for, now that the return rules are bound', () => {
    expect(unaccounted(DEFAULT_REGISTRY, 'western')).toEqual([]);
    expect(BINDINGS).toHaveLength(56 - NOT_EVALUATED.length);
  });
  it('cover every rule of the file that is neither natal nor needs the return chart, each exactly once', () => {
    const ids = BINDINGS.map((b) => b.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['lilly.score.strength-classes', 'lilly.aspects.orbs-table', 'firdaria.lord-condition', 'lilly.transit.daily-cusps', 'valens.critical-year-node']) expect(ids).toContain(id);
  });
});

describe('lilly.profection.lord-of-year-by-degree', () => {
  it('names the lord of the profected sign until the day the Ascendant has crossed the sign, then the next lord', () => {
    // 10 degrees of Cancer: 20 degrees remain, 20 x 12.1747 = 243.49 days, truncated to 243.
    const f = P.lordOfYearByDegree(only(0));
    expect(f).toHaveLength(1);
    const day = new Date(T0 + 243 * DAY).toISOString().slice(0, 10);
    expect(says('lilly.profection.lord-of-year-by-degree', f)).toEqual([`Annual profection to Cancer: Lord of the year Moon until ${day}, then Sun.`]);
    expect(f[0]!.clock).toBe('birthday');
    expect(f[0]!.startUtcMs).toBe(T0);
    expect(f[0]!.endUtcMs).toBe(T0 + YEAR);
  });
  it('moves one sign a year and gives each year its own lord', () => {
    const f = P.lordOfYearByDegree(only(3));
    expect(says('lilly.profection.lord-of-year-by-degree', f)[0]).toMatch(/^Annual profection to Libra: Lord of the year Venus until .*, then Mars\.$/);
  });
  it('truncates the days as Lilly does: 23 deg 23 min remaining is 284 days, not 285 (p.727)', () => {
    // 6 deg 37 min of Aries rising leaves 23 deg 23 min.
    const asc = 6 + 37 / 60;
    const f = P.lordOfYearByDegree(only(0, { model: chart({}, asc) }));
    expect(f[0]!.facts.find((x) => x.key === 'date')!.value).toBe(new Date(T0 + 284 * DAY).toISOString().slice(0, 10));
    expect((30 - (asc % 30)) * P.DAYS_PER_DEGREE).toBeGreaterThan(284.5);
  });
  it('gives one lord for a year that begins at 0 degrees of a sign, ending on the return', () => {
    const f = P.lordOfYearByDegree(only(0, { model: chart({}, 90) }));
    expect(says('lilly.profection.lord-of-year-by-degree', f)[0]).toBe(`Annual profection to Cancer: Lord of the year Moon until ${new Date(T0 + YEAR).toISOString().slice(0, 10)}, then Sun.`);
    expect(f[0]!.badges).toContain('the year begins at 0 degrees of a sign: one lord, the date is the return');
  });
  it('is one fact with valens.profection.transmission-lord and the Ascendant start of topic-start in one year', () => {
    const a = signals('lilly.profection.lord-of-year-by-degree', P.lordOfYearByDegree(only(2)))[0]!;
    const b = signals('valens.profection.transmission-lord', P.transmissionLord(only(2))).find((s) => s.facts.some((f) => f.key === 'start' && f.value === 'Ascendant'))!;
    const c = signals('valens.transmission.topic-start', P.topicStart(only(2))).find((s) => s.facts.some((f) => f.key === 'start' && f.value === 'the Ascendant') && s.topic === 'general')!;
    expect(a.dedupeKey).toBe(b.dedupeKey);
    expect(a.dedupeKey).toBe(c.dedupeKey);
    expect(dedupe([a, b, c]).kept.map((s) => s.ruleId)).toEqual(['lilly.profection.lord-of-year-by-degree']);
    // The Sun's profected sign is another fact, not the Ascendant's.
    const sun = signals('valens.profection.transmission-lord', P.transmissionLord(only(2))).find((s) => s.facts.some((f) => f.key === 'start' && f.value === 'Sun'))!;
    expect(sun.dedupeKey).not.toBe(a.dedupeKey);
  });
});

describe('the house tables of the profected Ascendant', () => {
  it('house-money: the 2nd, 4th, 10th and 11th houses, each with the direction the rule gives it', () => {
    const at = (k: number) => P.houseMoney(only(k));
    expect(says('lilly.profection.house-money', at(1), 'wealth')).toEqual(['Profected Ascendant stands in the 2nd house (Leo): a year favourable for buying and selling and the increase of estate.']);
    expect(dirs('lilly.profection.house-money', at(1))).toEqual(['favourable']);
    expect(dirs('lilly.profection.house-money', at(3))).toEqual(['mixed']);
    expect(says('lilly.profection.house-money', at(3), 'career')[0]).toBe('Profected Ascendant stands in the 4th house (Libra): a year favourable for inheritance, a new house and the search for wealth in the earth, though sorrowful and fearful.');
    expect(says('lilly.profection.house-money', at(10), 'career')[0]).toBe('Profected Ascendant stands in the 11th house (Taurus): a year favourable for all worldly affairs, the year very prosperous.');
    for (const k of [0, 2, 4, 5, 6, 7, 8, 11]) expect(at(k), `house ${k + 1}`).toEqual([]);
    expect(signals('lilly.profection.house-money', at(1)).map((s) => s.topic).sort()).toEqual(['career', 'wealth']);
    expect(at(1)[0]!.badges).toContain('labelled variant: whole-sign houses (Lilly used Regiomontanus cusps)');
  });
  it('house-relationships: the 7th and 5th houses, activating', () => {
    expect(says('lilly.profection.house-relationships', P.houseRelationships(only(6)))[0]).toMatch(/^Profected Ascendant stands in the 7th house: froward and impatient.*good to marry, the other significators concurring\.$/);
    expect(says('lilly.profection.house-relationships', P.houseRelationships(only(4)))[0]).toBe('Profected Ascendant stands in the 5th house: pleasure according to age, at school with equals or with women if capable; covenants, letters and accounts good.');
    expect(dirs('lilly.profection.house-relationships', P.houseRelationships(only(6)))).toEqual(['activates']);
    expect(P.houseRelationships(only(1))).toEqual([]);
  });
  it('house-learning: the 9th favourable, the 5th only activating', () => {
    expect(says('lilly.profection.house-learning', P.houseLearning(only(8)))).toEqual(['Profected Ascendant stands in the 9th house: a convenient time for long journeys, good to study and to follow learning, familiar with church-men.']);
    expect(dirs('lilly.profection.house-learning', P.houseLearning(only(8)))).toEqual(['favourable']);
    expect(dirs('lilly.profection.house-learning', P.houseLearning(only(4)))).toEqual(['activates']);
    expect(P.houseLearning(only(0))).toEqual([]);
  });
  it('house-travel: the 3rd, 4th, 6th, 9th and 10th houses', () => {
    const at = (k: number) => P.houseTravel(only(k));
    expect(says('lilly.profection.house-travel', at(2))).toEqual(['Profected Ascendant stands in the 3rd house: may prosper in journeys.']);
    expect(dirs('lilly.profection.house-travel', at(2))).toEqual(['favourable']);
    expect(dirs('lilly.profection.house-travel', at(3))).toEqual(['mixed']);
    expect(dirs('lilly.profection.house-travel', at(5))).toEqual(['unfavourable']);
    expect(says('lilly.profection.house-travel', at(5))).toEqual(['Profected Ascendant stands in the 6th house: make no journeys.']);
    expect(at(0)).toEqual([]);
    expect(at(6)).toEqual([]);
  });
  it('house-loss: the 6th, 8th and 12th houses, each under the topics the house names', () => {
    const at = (k: number) => P.houseLoss(only(k));
    expect(signals('lilly.profection.house-loss', at(5)).map((s) => s.topic)).toEqual(['wealth']);
    expect(says('lilly.profection.house-loss', at(5))).toEqual(['Profected Ascendant stands in the 6th house: a year of caution for merchandise, contracts and bargains.']);
    expect(signals('lilly.profection.house-loss', at(7)).map((s) => s.topic).sort()).toEqual(['health', 'wealth']);
    expect(dirs('lilly.profection.house-loss', at(11))).toEqual(['unfavourable']);
    expect(at(11)[0]!.badges).toContain('the exception "unless the twelfth house in the radix was fortunate" is not evaluated: Lilly gives it no definition');
    expect(at(0)).toEqual([]);
    expect(at(1)).toEqual([]);
  });
  it('house-health: the 1st, 6th, 8th and 12th houses, in tendency wording', () => {
    const at = (k: number) => P.houseHealth(only(k));
    expect(says('lilly.profection.house-health', at(0))).toEqual(['Profected Ascendant stands in the 1st house: cheerful, a fit year to provide what the body needs.']);
    expect(dirs('lilly.profection.house-health', at(0))).toEqual(['favourable']);
    expect(says('lilly.profection.house-health', at(11))).toEqual(['Profected Ascendant stands in the 12th house: sickly, the cause hard to find.']);
    expect(dirs('lilly.profection.house-health', at(5))).toEqual(['unfavourable']);
    expect(at(1)).toEqual([]);
    for (const k of [0, 5, 7, 11]) for (const s of signals('lilly.profection.house-health', at(k))) expect(MORTALITY_WORDS.test(s.sentence)).toBe(false);
  });
  it('shares one dedupe key per house, so the 12th house is one fact for house-loss and house-health in the health topic', () => {
    const loss = signals('lilly.profection.house-loss', P.houseLoss(only(11))).find((s) => s.topic === 'health')!;
    const health = signals('lilly.profection.house-health', P.houseHealth(only(11)))[0]!;
    expect(loss.dedupeKey).toBe(health.dedupeKey);
    expect(dedupe([loss, health]).kept).toHaveLength(1);
  });
});

describe('the profected Midheaven and Sun (lilly.profection.mc-career)', () => {
  it('reads each profected point through the radical houses, with the rule\'s direction per house', () => {
    // Midheaven in Aries (the 10th house, since Cancer rises): after 1 year in Taurus, the 11th.
    const f = P.mcCareer(only(1));
    expect(says('lilly.profection.mc-career', f)).toContain('Profected Midheaven stands in the 11th house: kindness to friends, mutual respect.');
    // The Sun in Leo (the 2nd house) after 1 year is in Virgo, the 3rd.
    expect(says('lilly.profection.mc-career', f)).toContain('Profected Sun stands in the 3rd house: an indifferent condition (loss of kindred, robbery in journeying).');
    const byPoint = Object.fromEntries(signals('lilly.profection.mc-career', f).map((s) => [s.facts.find((x) => x.key === 'point')!.value, s.direction]));
    expect(byPoint).toEqual({ Midheaven: 'activates', Sun: 'unfavourable' });
  });
  it('gives each point its own reading even when both stand in one house', () => {
    const m = chart({ Sun: 10 }); // the Sun in Aries, as the Midheaven
    const s = signals('lilly.profection.mc-career', P.mcCareer(only(0, { model: m })));
    expect(s).toHaveLength(2);
    expect(new Set(s.map((x) => x.dedupeKey)).size).toBe(2);
  });
});

describe('lilly.profection.fortune-sign-wealth', () => {
  it('advances the Part of Fortune and the sign of the 2nd house one sign a year and reads the houses', () => {
    const m = chart();
    // Night chart: Fortune = Asc + Sun - Moon = 130 in Leo; the 2nd house sign is Leo too: one reading, both bases named.
    expect(m.fortune()).toBeCloseTo(130, 6);
    const f = P.fortuneSignWealth(only(0, { model: m }));
    expect(says('lilly.profection.fortune-sign-wealth', f)).toEqual(['Profected Part of Fortune (and, in the same sign, the sign of the 2nd house) stands in the 2nd house: goods long expected fall to him; he may buy and sell and augment his patrimony.']);
    expect(dirs('lilly.profection.fortune-sign-wealth', f)).toEqual(['favourable']);
    expect(f).toHaveLength(1);
  });
  it('gives two readings when the two bases stand in different signs, and the 8th house is mixed', () => {
    const m = chart({ Sun: 300, Moon: 140 }); // a day chart: Fortune = Asc + Moon - Sun = 300, Aquarius, the 8th house; the 2nd house sign is Leo
    expect(m.isDay).toBe(true);
    const f = P.fortuneSignWealth(only(0, { model: m }));
    expect(f).toHaveLength(2);
    expect(says('lilly.profection.fortune-sign-wealth', f)).toEqual([
      'Profected Part of Fortune stands in the 8th house: wealth by legacy; an ill year to lend money.',
      'Profected sign of the 2nd house stands in the 2nd house: goods long expected fall to him; he may buy and sell and augment his patrimony.',
    ]);
    expect(f.map((x) => signals('lilly.profection.fortune-sign-wealth', [x])[0]!.direction)).toEqual(['mixed', 'favourable']);
  });
  it('uses the sign of the profected base as the dedupe sign', () => {
    const s = signals('lilly.profection.fortune-sign-wealth', P.fortuneSignWealth(only(0)))[0]!;
    expect(s.dedupeKey).toMatch(/^profected-fortune:Leo#/);
  });
});

describe('lilly.profection.angle-aspect-years', () => {
  it('reads the profected Ascendant and Midheaven against the radical ones by whole signs', () => {
    // Cancer rising, Aries at the Midheaven. After 2 years Ascendant and Midheaven are each a sextile from their own.
    const f = P.angleAspectYears(only(2));
    expect(says('lilly.profection.angle-aspect-years', f)).toEqual([
      'Profected Ascendant stands in sextile to the natal Ascendant: Lilly calls such years prosperous.',
      'Profected Midheaven stands in sextile to the natal Midheaven: Lilly calls such years prosperous.',
    ]);
    expect(dirs('lilly.profection.angle-aspect-years', f)).toEqual(['favourable']);
    expect(f[0]!.badges).toContain('labelled variant: whole-sign houses (Lilly used Regiomontanus cusps)');
  });
  it('calls a square or an opposition unhappy and is silent when the signs are in no aspect', () => {
    const f = P.angleAspectYears(only(3));
    expect(says('lilly.profection.angle-aspect-years', f)).toEqual([
      'Profected Ascendant stands in square to the natal Ascendant: Lilly calls such years unhappy.',
      'Profected Ascendant stands in opposition to the natal Midheaven: Lilly calls such years unhappy.',
      'Profected Midheaven stands in square to the natal Midheaven: Lilly calls such years unhappy.',
    ]);
    expect(dirs('lilly.profection.angle-aspect-years', f)).toEqual(['unfavourable']);
    // Year 2: the profected Ascendant (Leo) is in no aspect to the radical Ascendant (Cancer); it is in a trine to the Midheaven (Aries).
    const next = P.angleAspectYears(only(1));
    expect(next.some((x) => x.facts.some((y) => y.key === 'point' && y.value === 'Ascendant') && x.facts.some((y) => y.key === 'angle' && y.value === 'Ascendant'))).toBe(false);
    expect(next.map((x) => x.facts.find((y) => y.key === 'aspect')!.value)).toContain('trine');
  });
  it('keeps each pair of points a separate fact', () => {
    const keys = signals('lilly.profection.angle-aspect-years', P.angleAspectYears(only(3))).map((s) => s.dedupeKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('the named convention westernTenthYear: the profected tenth house', () => {
  // The 10th house is Aries; k = 9 brings the profected Ascendant there, and the profected Midheaven (Aries) to Gemini + ... see below.
  it('house-table (the default) reads the tenth house as the table says and not as an unhappy square to the Ascendant', () => {
    const table = input({ years: yearsOf([9]), tenthYear: 'house-table' });
    expect(says('lilly.profection.house-money', P.houseMoney(table), 'career')[0]).toMatch(/^Profected Ascendant stands in the 10th house \(Aries\): a year favourable for preferment/);
    expect(dirs('lilly.profection.house-money', P.houseMoney(table))).toEqual(['favourable']);
    expect(says('lilly.profection.house-travel', P.houseTravel(table))[0]).toMatch(/10th house: may journey by land or sea/);
    const aspects = P.angleAspectYears(table);
    expect(aspects.some((f) => f.facts.some((x) => x.key === 'point' && x.value === 'Ascendant') && f.facts.some((x) => x.key === 'angle' && x.value === 'Ascendant'))).toBe(false);
    expect(P.houseMoney(table)[0]!.conventionsUsed).toContain('westernTenthYear');
    expect(P.houseMoney(table)[0]!.badges).toContain(P.BADGES.tenth);
  });
  it('angle-aspect reads the same year as an unhappy square to the Ascendant and leaves the house table out', () => {
    const angle = input({ years: yearsOf([9]), tenthYear: 'angle-aspect' });
    expect(P.houseMoney(angle)).toEqual([]);
    expect(P.houseTravel(angle)).toEqual([]);
    const f = P.angleAspectYears(angle).find((x) => x.facts.some((y) => y.key === 'point' && y.value === 'Ascendant') && x.facts.some((y) => y.key === 'angle' && y.value === 'Ascendant'))!;
    expect(says('lilly.profection.angle-aspect-years', [f])).toEqual(['Profected Ascendant stands in square to the natal Ascendant: Lilly calls such years unhappy.']);
    expect(f.conventionsUsed).toContain('westernTenthYear');
  });
  it('applies the same choice to the profected Midheaven and Sun in the tenth house', () => {
    // The Midheaven in Aries is in the 10th house at once (k = 0).
    const table = P.mcCareer(only(0, { tenthYear: 'house-table' }));
    expect(says('lilly.profection.mc-career', table)).toContain('Profected Midheaven stands in the 10th house: a very successful and famous year.');
    const angle = P.mcCareer(only(0, { tenthYear: 'angle-aspect' }));
    expect(says('lilly.profection.mc-career', angle).some((x) => x.includes('10th house'))).toBe(false);
  });
  it('leaves every other house alone under either value', () => {
    for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11]) {
      expect(P.houseMoney(only(k, { tenthYear: 'angle-aspect' }))).toEqual(P.houseMoney(only(k, { tenthYear: 'house-table' })));
    }
  });
});

describe('valens.profection.transmission-lord', () => {
  it('counts year 23 (remainder 11) from an Aries Ascendant to Aquarius where Saturn stands', () => {
    const m = chart({ Saturn: 310, Mars: 100, Moon: 200 }, 10); // Aries rises; Saturn alone in Aquarius
    const f = P.transmissionLord(only(22, { model: m }));
    expect(says('valens.profection.transmission-lord', f)).toContain('Year 23: Ascendant transmits to Saturn (in Aquarius).');
  });
  it('counts a year of remainder 0 as 12 and a year 13 as the sign itself', () => {
    expect(says('valens.profection.transmission-lord', P.transmissionLord(only(11)))[0]).toMatch(/^Year 12: Ascendant transmits to .* \(in Gemini\)\.$/);
    expect(says('valens.profection.transmission-lord', P.transmissionLord(only(12)))[0]).toMatch(/^Year 13: Ascendant transmits to Moon and Mars \(in Cancer\)\.$/);
  });
  it('gives the receiving sign\'s ruler only when the sign is empty', () => {
    // Year 2 from the Ascendant is Leo, where the Sun stands: the Sun receives, not the Sun as ruler.
    expect(says('valens.profection.transmission-lord', P.transmissionLord(only(1)))[0]).toBe('Year 2: Ascendant transmits to Sun (in Leo).');
    // Year 3 reaches Virgo: Mercury stands in Leo here, so Virgo is empty and its lord Mercury receives as ruler.
    const m = chart({ Mercury: 200 });
    expect(says('valens.profection.transmission-lord', P.transmissionLord(only(2, { model: m })))[0]).toBe('Year 3: Ascendant transmits to Mercury (in Virgo).');
    expect(P.receivers(m, 5)).toEqual(['Mercury']);
    // Sun and Moon are start points too.
    expect(says('valens.profection.transmission-lord', P.transmissionLord(only(0))).length).toBe(3);
  });
});

describe('valens.transmission.topic-start', () => {
  it('counts the year from the point Valens names for each matter and files it under topics', () => {
    const f = P.topicStart(only(0, { model: chart({ Moon: 10 }) }));
    const all = signals('valens.transmission.topic-start', f);
    expect(all.map((s) => s.sentence)).toContain('For rank, preeminence, the father, great personages, Valens counts the year from the Sun: year 1 reaches Leo.');
    expect(all.filter((s) => s.topic === 'wealth').map((s) => s.facts.find((x) => x.key === 'start')!.value).sort()).toEqual(['Saturn', 'the Imum Coeli', 'the Lot of Fortune', 'the Midheaven']);
    expect(f.every((x) => x.badges?.includes(P.BADGES.topicAssigned))).toBe(true);
  });
  it('does not state a health sentence that would name the sign Cancer, which the audit\'s mortality list refuses', () => {
    const s = signals('valens.transmission.topic-start', P.topicStart(only(0)));
    expect(s.filter((x) => x.topic === 'health').every((x) => !/Cancer/.test(x.sentence))).toBe(true);
    // The Ascendant start reaches Cancer in year 1 and is then filed under general only.
    const asc = s.filter((x) => x.facts.some((y) => y.key === 'start' && y.value === 'the Ascendant'));
    expect(asc.map((x) => x.topic)).toEqual(['general']);
  });
});

describe('bonatti.profection.topic-significator', () => {
  it('names each matter, its base and the profected sign', () => {
    const s = signals('bonatti.profection.topic-significator', P.topicSignificator(only(1)));
    const text = s.map((x) => x.sentence);
    expect(text).toContain('For honours and annual dignities Bonatti reads the profection from the Sun: now in Virgo.');
    expect(text).toContain('For magistracies and offices Bonatti reads the profection from the Midheaven: now in Taurus.');
    expect(text).toContain('For gain and prosperity Bonatti reads the profection from the Part of Fortune: now in Virgo.');
    expect(text).toContain('For gain and prosperity Bonatti reads the profection from the 2nd house: now in Virgo.');
    expect(text).toContain('For hidden enemies Bonatti reads the profection from the 12th house: now in Cancer.');
    expect(s.every((x) => x.direction === 'activates')).toBe(true);
    expect(P.topicSignificator(only(1)).length).toBe(15);
    // Year 1 puts the Moon's profection in Cancer, which the audit's health list would refuse: the body-and-soul statement is not made.
    expect(P.topicSignificator(only(0)).length).toBe(14);
  });
  it('keeps every base a fact of its own', () => {
    const keys = signals('bonatti.profection.topic-significator', P.topicSignificator(only(1))).map((s) => `${s.topic}|${s.dedupeKey}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('firdaria.lord-condition', () => {
  const span = { startUtcMs: T0, endUtcMs: T0 + 30 * YEAR };
  const saturn: LordSpan = { label: 'Saturn', lord: 'Saturn', startUtcMs: T0, endUtcMs: T0 + 11 * YEAR };
  it('cuts a planetary period in seven in the order of the rule file, beginning with the major lord', () => {
    const subs = subPeriods([saturn]);
    expect(subs.map((s) => s.minor)).toEqual(['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon']);
    expect(SUB_ORDER).toEqual(['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars']);
    expect(subs[0]!.endUtcMs - subs[0]!.startUtcMs).toBeCloseTo((11 * YEAR) / 7, -2);
    expect(subs[6]!.endUtcMs).toBe(saturn.endUtcMs);
  });
  it('reads a weak major lord as badly disposed and prints the sub-period', () => {
    const m = chart({ Saturn: 100 }); // Saturn in Cancer, its detriment
    expect(m.cls('Saturn')).toBe('weak');
    const f = firdariaLordCondition(m, [saturn], span);
    expect(f).toHaveLength(7);
    const day = new Date(f[0]!.endUtcMs!).toISOString().slice(0, 10);
    expect(says('firdaria.lord-condition', f)[0]).toBe(`Firdaria: major lord Saturn, sub-lord Saturn until ${day}; the major lord is weak: Bonatti reads its disposition as badly disposed, so it decreases fortunes and increases misfortunes.`);
    expect(f[0]!.clock).toBe('birthday');
    expect(dirs('firdaria.lord-condition', f)).toEqual(['mixed']);
  });
  it('reads a strong or moderate major lord as well disposed', () => {
    const m = chart({ Saturn: 300 }); // Saturn in Aquarius, its house
    expect(m.cls('Saturn')).toBe('strong');
    expect(says('firdaria.lord-condition', firdariaLordCondition(m, [saturn], span))[0]).toMatch(/the major lord is strong: Bonatti reads its disposition as well disposed, so it increases fortunes and decreases misfortunes\.$/);
  });
  it('says nothing for the nodes, for a lord of class zero and for periods outside the span', () => {
    const head: LordSpan = { label: 'North Node', lord: 'North Node', startUtcMs: T0, endUtcMs: T0 + 3 * YEAR };
    expect(firdariaLordCondition(chart(), [head], span)).toEqual([]);
    const m = chart({ Saturn: 0 }); // Saturn in Aries scores 0 on the table? checked below
    if (m.cls('Saturn') === 'unclassed') expect(firdariaLordCondition(m, [saturn], span)).toEqual([]);
    expect(firdariaLordCondition(chart({ Saturn: 300 }), [saturn], { startUtcMs: T0 + 20 * YEAR, endUtcMs: T0 + 21 * YEAR })).toEqual([]);
  });
});

describe('the modifier rules', () => {
  it('strength-classes: one undated statement per planet that has a class, with both scores', () => {
    const m = chart();
    const f = strengthClasses(m);
    const s = signals('lilly.score.strength-classes', f);
    const venus = s.find((x) => x.sentence.startsWith('Venus'))!;
    expect(venus.sentence).toBe(`Venus is ${m.cls('Venus')} in this chart (essential ${m.essential('Venus')}, accidental ${m.accidental('Venus')}${m.accidental('Venus') <= -5 ? ', afflicted' : ''}).`);
    expect(s.every((x) => x.startUtcMs === null && x.stage === 'modifier')).toBe(true);
    expect(f.length).toBe(PLANETS.filter((p) => m.cls(p) !== 'unclassed').length);
    for (const p of PLANETS) if (m.cls(p) === 'unclassed') expect(f.some((x) => x.facts.some((y) => y.key === 'planet' && y.value === p))).toBe(false);
  });
  it('strength-classes: flags a planet whose accidental score is -5 or lower', () => {
    const m = chart({ Saturn: 100, Sun: 105 }); // Saturn in the 1st and combust in Cancer
    const f = strengthClasses(m).find((x) => x.facts.some((y) => y.key === 'planet' && y.value === 'Saturn'))!;
    const a = m.accidental('Saturn');
    expect(f.facts.find((y) => y.key === 'afflictedFlag')!.value).toBe(a <= -5 ? ', afflicted' : '');
  });
  it('orbs-table: lists each pair in aspect with partile or platick and the orb', () => {
    const m = chart({ Sun: 100, Moon: 102.5, Mercury: 250, Venus: 10, Mars: 320, Jupiter: 205, Saturn: 280 });
    const s = signals('lilly.aspects.orbs-table', aspectList(m)).map((x) => x.sentence);
    expect(s).toContain('Sun conjunction Moon, platick, orb 2.5.');
    expect(s.every((x) => /^(Sun|Moon|Mercury|Venus|Mars|Jupiter) (conjunction|sextile|square|trine|opposition) \w+, (partile|platick), orb [0-9.]+\.$/.test(x))).toBe(true);
    const partile = signals('lilly.aspects.orbs-table', aspectList(chart({ Sun: 100.5, Moon: 100.51 }))).map((x) => x.sentence);
    expect(partile).toContain('Sun conjunction Moon, partile, orb 0.01.');
    expect(aspectList(chart({ Sun: 0, Moon: 45, Mercury: 75, Venus: 150, Mars: 235, Jupiter: 330, Saturn: 195 })).filter((x) => x.facts.some((y) => y.key === 'planet1' && y.value === 'Sun' ) && x.facts.some((y) => y.key === 'planet2' && y.value === 'Moon'))).toEqual([]);
  });
  it('partile by minute: the same degree and the same minute of signs in the aspect', () => {
    expect(isPartileMinute(100.5, 100.5 + 0.01, 0)).toBe(true);
    expect(isPartileMinute(100.5, 100.54, 0)).toBe(false); // the next minute
    expect(isPartileMinute(100.5, 220.5, 120)).toBe(true);
    expect(isPartileMinute(100.5, 220.5, 90)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Transits
// ---------------------------------------------------------------------------

const spansFrom = (table: Partial<Record<Planet, Array<[number, number, number]>>>) => (p: Planet): LordSpan[] =>
  (table[p] ?? [[0, -2000, 20000]]).map(([sign, a, b]) => ({ label: SIGNS[sign]!, lord: p, startUtcMs: T0 + a * DAY, endUtcMs: T0 + b * DAY }));
const sky = (o: Partial<T.SkyAccess> = {}): T.SkyAccess => ({
  span: { startUtcMs: T0, endUtcMs: T0 + 2 * YEAR },
  spans: () => [],
  lon: () => 0,
  node: () => 0,
  syzygy: { kind: 'new', utcMs: T0 - 5000 * DAY, signIndex: 0 },
  ...o,
});

describe('valens.transit.jupiter-year-sign', () => {
  // Mars (in Cancer) holds the year in year 1 (the Ascendant sign, an operative place).
  it('fires while Jupiter stands in the year sign or its square or opposition and the time-lord is in an operative place', () => {
    const s = sky({ spans: spansFrom({ Jupiter: [[3, -100, 200], [6, 200, 500], [4, 500, 800]] }) });
    const f = T.jupiterYearSign(only(0), s);
    expect(f.map((x) => [x.startUtcMs, x.endUtcMs])).toEqual([[T0, T0 + 200 * DAY], [T0 + 200 * DAY, T0 + YEAR]]);
    expect(says('valens.transit.jupiter-year-sign', f)).toEqual([
      'Transiting Jupiter stands in Cancer, conjunct to the year sign Cancer, and the year\'s time-lords Moon and Mars stand in an operative place: Valens reads public service and high rank.',
      'Transiting Jupiter stands in Libra, square to the year sign Cancer, and the year\'s time-lords Moon and Mars stand in an operative place: Valens reads public service and high rank.',
    ]);
    expect(f[0]!.clock).toBe('jupiter-tropical');
    expect(dirs('valens.transit.jupiter-year-sign', f)).toEqual(['favourable']);
    expect(signals('valens.transit.jupiter-year-sign', f).map((x) => x.topic).sort()).toEqual(['career', 'career', 'general', 'general']);
  });
  it('is silent when Jupiter is in no such sign or no receiver stands in an operative place', () => {
    expect(T.jupiterYearSign(only(0), sky({ spans: spansFrom({ Jupiter: [[4, -100, 800]] }) }))).toEqual([]);
    // Year 2 reaches Leo, where the Sun stands: the Sun is in the 2nd, which is no operative place when the Part of Fortune is in Cancer.
    const away = chart({ Moon: 140 });
    expect(T.operativeSigns(only(1, { model: away }))).toEqual([3, 0, 1, 7, 3]);
    expect(T.jupiterYearSign(only(1, { model: away }), sky({ spans: spansFrom({ Jupiter: [[4, -100, 800]] }) }))).toEqual([]);
    expect(T.operativeSigns(only(0))).toEqual([3, 0, 1, 7, 4]);
  });
});

describe('valens.transit.benefic-malefic-year-lord', () => {
  // Saturn in Cancer holds the year when Saturn is the only planet there.
  it('lets a benefic in the year sign bring relief and another malefic intensify the evil, for a malefic that holds the year', () => {
    const m2 = chart({ Mars: 200, Moon: 250, Saturn: 105 }); // only Saturn in Cancer
    const s = sky({ spans: spansFrom({ Venus: [[3, 50, 120]], Mars: [[3, 10, 60]], Jupiter: [[3, -50, 400]] }) });
    const f = T.beneficMaleficYearLord(only(0, { model: m2 }), s);
    expect(says('valens.transit.benefic-malefic-year-lord', f).sort()).toEqual([
      'Jupiter transits the year sign Cancer while the malefic Saturn holds the year: it brings relief and help.',
      'Mars transits the year sign Cancer while the malefic Saturn holds the year: it intensifies the evil.',
      'Venus transits the year sign Cancer while the malefic Saturn holds the year: it brings relief and help.',
    ]);
    expect(f.map((x) => x.clock).sort()).toEqual(['jupiter-tropical', 'mars', 'venus']);
    expect(dirs('valens.transit.benefic-malefic-year-lord', f)).toEqual(['mixed']);
  });
  it('is silent when the time-lord is not a malefic, and a malefic does not count as another malefic to itself', () => {
    // The Moon and Mars hold the year (Mars is a malefic; Saturn is the other); Moon is no malefic.
    const s = sky({ spans: spansFrom({ Mars: [[3, 10, 60]] }) });
    expect(T.beneficMaleficYearLord(only(0, { model: chart({ Mars: 200, Saturn: 310 }) }), s)).toEqual([]);
    const benefic = chart({ Jupiter: 100, Mars: 200, Moon: 250, Saturn: 5 });
    expect(T.beneficMaleficYearLord(only(0, { model: benefic }), sky({ spans: spansFrom({ Venus: [[3, 10, 60]] }) }))).toEqual([]);
  });
});

describe('valens.critical-year-syzygy', () => {
  it('fires for a year whose sign is the prenatal lunation\'s or its square or opposition, and says when Saturn passes before an angle', () => {
    // New Moon in Aries; year 1 is Cancer, a square. Saturn is in Gemini (before the 1st house) for 100 days, then in Cancer.
    const s = sky({ spans: spansFrom({ Saturn: [[2, -300, 100], [3, 100, 900]] }) });
    const f = T.criticalYearSyzygy(only(0), s);
    expect(says('valens.critical-year-syzygy', f)).toEqual([
      'Year 1 is in the sign of the prenatal new Moon or its square or opposition, with Saturn passing one of the four signs before the angles: a critical year, a health caution.',
      'Year 1 is in the sign of the prenatal new Moon or its square or opposition: a critical year, a health caution.',
    ]);
    expect(f.map((x) => x.clock)).toEqual(['saturn-tropical', 'birthday']);
    expect(f[0]!.endUtcMs).toBe(T0 + 100 * DAY);
    expect(dirs('valens.critical-year-syzygy', f)).toEqual(['unfavourable']);
    expect(signals('valens.critical-year-syzygy', f).every((x) => x.topic === 'health' && !MORTALITY_WORDS.test(x.sentence))).toBe(true);
  });
  it('is silent for a year in no such relation, and a full Moon is named as such', () => {
    const s = sky({ spans: spansFrom({}) });
    expect(T.criticalYearSyzygy(only(1), s)).toEqual([]);
    const full = T.criticalYearSyzygy(only(0), sky({ spans: spansFrom({}), syzygy: { kind: 'full', utcMs: T0, signIndex: 9 } }));
    expect(says('valens.critical-year-syzygy', full)).toEqual(['Year 1 is in the sign of the prenatal full Moon or its square or opposition: a critical year, a health caution.']);
  });
  it('finds the last new or full Moon before a moment from the engine\'s longitudes', () => {
    for (const f of MOMENTS) {
      const m = makeMoment(f.civil, f.zone, f.place);
      const z = prenatalSyzygy(m.utcMs);
      expect(z.utcMs).toBeLessThanOrEqual(m.utcMs);
      expect(m.utcMs - z.utcMs).toBeLessThan(15 * DAY);
      const sun = longitudeOf('Sun', z.utcMs);
      const moon = longitudeOf('Moon', z.utcMs);
      const elong = (((moon - sun) % 360) + 360) % 360;
      expect(z.kind === 'new' ? Math.min(elong, 360 - elong) : Math.abs(elong - 180)).toBeLessThan(0.001);
      // Nothing between it and the moment is a syzygy: the other kind comes later, so the elongation at the moment is on the far side.
      const e = (((longitudeOf('Moon', m.utcMs) - longitudeOf('Sun', m.utcMs)) % 360) + 360) % 360;
      expect(z.kind === 'new' ? e < 180 : e >= 180).toBe(true);
    }
  });
});

describe('valens.critical-year-node', () => {
  it('fires only where Saturn is within a degree of the node or of a square to it, and not in the same sign', () => {
    // Saturn stands at 100 degrees; the node moves from 0 by 0.1 degree a day, so its square (node + 90) crosses Saturn on day 100.
    const s = sky({ span: { startUtcMs: T0, endUtcMs: T0 + 400 * DAY }, lon: () => 100, node: (ms) => ((ms - T0) / DAY) * 0.1 });
    const f = T.criticalYearNode(input(), s);
    // The sign form is gone: one pass, from day 90 to day 110 (a degree either side at 0.1 degree a day).
    expect(f).toHaveLength(1);
    expect(f[0]!.facts.find((y) => y.key === 'degreeMatch')!.value).toBe('within 1 degree');
    expect((f[0]!.startUtcMs! - T0) / DAY).toBeCloseTo(90, 1);
    expect((f[0]!.endUtcMs! - T0) / DAY).toBeCloseTo(110, 1);
    expect(says('valens.critical-year-node', f)).toEqual(['Saturn stands at the ascending node or its square (within 1 degree): a critical period.']);
    expect(f[0]!.clock).toBe('saturn-tropical');
    expect(dirs('valens.critical-year-node', f)).toEqual(['unfavourable']);
  });
  it('carries the badge of a derived threshold for the closeness that counts as "at"', () => {
    const s = sky({ span: { startUtcMs: T0, endUtcMs: T0 + 100 * DAY }, lon: () => 190, node: () => 10 });
    const [f] = T.criticalYearNode(input(), s);
    expect(f!.badges!.some((b) => b.startsWith('derived threshold:') && b.includes('1 degree'))).toBe(true);
  });
  it('names the descending node for the opposition, and is silent when Saturn is in the same sign but not within a degree', () => {
    const s = sky({ span: { startUtcMs: T0, endUtcMs: T0 + 100 * DAY }, lon: () => 190, node: () => 10 });
    expect(says('valens.critical-year-node', T.criticalYearNode(input(), s))).toEqual(['Saturn stands at the descending node or its square (within 1 degree): a critical period.']);
    expect(T.criticalYearNode(input(), sky({ span: { startUtcMs: T0, endUtcMs: T0 + 100 * DAY }, lon: () => 45, node: () => 10 }))).toEqual([]);
    // 5 degrees from the node, in its sign: the extension of the weak form is not read.
    expect(T.criticalYearNode(input(), sky({ span: { startUtcMs: T0, endUtcMs: T0 + 100 * DAY }, lon: () => 15, node: () => 10 }))).toEqual([]);
  });
  it('lists the same-sign branch as held back, with the reason', () => {
    const h = HELD_BACK.find((x) => x.id === 'valens.critical-year-node.same-sign')!;
    expect(h.tradition).toBe('western');
    expect(h.reason).toMatch(/Moon/);
  });
});

describe('lilly.transit.daily-cusps', () => {
  /** Jupiter at 125 degrees moving 0.1 degree a day; the Ascendant is at 130 degrees (10 degrees of Leo). */
  const rising = (): PeriodInput => input({ model: chart({}, 130) });
  const jupiterSky = (): T.SkyAccess =>
    sky({ span: { startUtcMs: T0, endUtcMs: T0 + 200 * DAY }, lon: (p, ms) => (p === 'Jupiter' ? 125 + ((ms - T0) / DAY) * 0.1 : 1000 + (p === 'Moon' ? 0 : 0)) });
  const jupiterFirings = (): Firing[] => T.dailyCusps(rising(), jupiterSky()).filter((f) => f.clock === 'jupiter-tropical');
  it('dates the pass of Jupiter over the Ascendant by the day of the closest sample and reads Lilly\'s sentence', () => {
    const over = jupiterFirings().filter((f) => f.facts.some((x) => x.key === 'point' && x.value === 'Ascendant') && f.facts.some((x) => x.key === 'aspect' && x.value === 'conjoins'));
    expect(over).toHaveLength(1);
    expect(says('lilly.transit.daily-cusps', over)).toEqual(['Transiting Jupiter conjoins the natal Ascendant: a healthful, cheerful, successful day.']
    );
    expect(over[0]!.facts.find((x) => x.key === 'date')!.value).toBe(new Date(T0 + 50 * DAY).toISOString().slice(0, 10));
    expect(over[0]!.direction).toBe('favourable');
    // Within the moiety of 6 degrees either side: days -10 to 110.
    expect((over[0]!.startUtcMs! - T0) / DAY).toBeCloseTo(-10, 0);
    expect((over[0]!.endUtcMs! - T0) / DAY).toBeCloseTo(110, 0);
    expect(over[0]!.conventionsUsed).toEqual(['westernOrbs']);
  });
  it('reads the sextile and trine of Jupiter to the angles as a fortunate day, and nothing for a square', () => {
    const jup = (s: Firing[], aspect: string) => s.filter((f) => f.facts.some((x) => x.key === 'aspect' && x.value === aspect));
    const all = jupiterFirings();
    expect(jup(all, 'squares')).toEqual([]);
    for (const f of [...jup(all, 'sextiles'), ...jup(all, 'trines')]) expect(f.facts.find((x) => x.key === 'meaning')!.value).toBe('a fortunate day');
  });
  it('gives Mars over the Ascendant both of Lilly\'s sentences, as two separate statements of one pass', () => {
    const mars = T.dailyCusps(rising(), sky({ span: { startUtcMs: T0, endUtcMs: T0 + 200 * DAY }, lon: (p, ms) => (p === 'Mars' ? 128 + ((ms - T0) / DAY) * 0.05 : 1000) })).filter((f) => f.clock === 'mars' && f.facts.some((x) => x.key === 'aspect' && x.value === 'conjoins') && f.facts.some((x) => x.key === 'point' && x.value === 'Ascendant'));
    expect(says('lilly.transit.daily-cusps', mars).map((x) => x).sort()).toEqual(['Transiting Mars conjoins the natal Ascendant: an unsuccessful day.', 'Transiting Mars conjoins the natal Ascendant: choler or passion for two or three days.']);
    expect(new Set(mars.map((x) => x.dedupeInstance)).size).toBe(2);
    // The sign is the one Lilly's own word gives: unsuccessful is a caution, choler names a temper and has no sign, so no day reading is labelled mixed.
    const dirOf = (word: string) => mars.filter((f) => f.facts.some((x) => x.key === 'meaning' && String(x.value).startsWith(word))).map((f) => f.direction);
    expect(new Set(dirOf('an unsuccessful'))).toEqual(new Set(['unfavourable']));
    expect(new Set(dirOf('choler'))).toEqual(new Set(['activates']));
    expect(T.dailyCusps(rising(), jupiterSky()).every((f) => f.direction !== 'mixed')).toBe(true);
  });
  it('gives the healthful, choler and gravity readings to the passage over the Ascendant only, in Lilly\'s words', () => {
    const wide = (lon: (p: Planet, ms: number) => number): Firing[] => T.dailyCusps(rising(), sky({ span: { startUtcMs: T0, endUtcMs: T0 + 400 * DAY }, lon }));
    const sat = wide((p, ms) => (p === 'Saturn' ? 120 + ((ms - T0) / DAY) * 0.05 : 1000));
    const meanings = (fs: Firing[]) => [...new Set(fs.map((f) => `${f.facts.find((x) => x.key === 'aspect')!.value} ${f.facts.find((x) => x.key === 'point')!.value}: ${f.facts.find((x) => x.key === 'meaning')!.value}`))].sort();
    const own = meanings(sat.filter((f) => f.clock === 'saturn-tropical'));
    expect(own).toContain('conjoins Ascendant: gravity, soberness, melancholy');
    // gravity is read for the passage over the Ascendant and for no other point or aspect
    expect(own.filter((m) => m.includes('gravity'))).toEqual(['conjoins Ascendant: gravity, soberness, melancholy']);
  });
  it('restricts the fortunate days to sextile and trine and the unsuccessful days to passage, square and opposition', () => {
    // Every pass of every body over a sweep of the whole zodiac, so that every aspect occurs somewhere.
    const sweep = (p: Planet): Firing[] => T.dailyCusps(rising(), sky({ span: { startUtcMs: T0, endUtcMs: T0 + 720 * DAY }, lon: (q, ms) => (q === p ? 130 + ((ms - T0) / DAY) * 0.5 : 1000) })).filter((f) => f.clock === (p === 'Sun' ? 'solar-longitude' : p.toLowerCase()) || f.clock === `${p.toLowerCase()}-tropical`);
    const aspects = (fs: Firing[], meaning: string) => [...new Set(fs.filter((f) => f.facts.some((x) => x.key === 'meaning' && x.value === meaning)).map((f) => f.facts.find((x) => x.key === 'aspect')!.value))].sort();
    for (const p of ['Jupiter', 'Venus', 'Sun', 'Moon'] as Planet[]) expect(aspects(sweep(p), 'a fortunate day'), p).toEqual(['sextiles', 'trines']);
    for (const p of ['Saturn', 'Mars'] as Planet[]) expect(aspects(sweep(p), 'an unsuccessful day'), p).toEqual(['conjoins', 'opposes', 'squares']);
  });
  it('gives the two or three days to Mars alone, counted from the day of the pass', () => {
    const run = (planet: Planet): Firing[] => T.dailyCusps(rising(), sky({ span: { startUtcMs: T0, endUtcMs: T0 + 200 * DAY }, lon: (p, ms) => (p === planet ? 128 + ((ms - T0) / DAY) * 0.05 : 1000) })).filter((f) => f.facts.some((x) => x.key === 'point' && x.value === 'Ascendant') && f.facts.some((x) => x.key === 'aspect' && x.value === 'conjoins'));
    const mars = run('Mars').filter((f) => f.facts.some((x) => x.key === 'meaning' && x.value === 'choler or passion for two or three days'));
    expect(mars).toHaveLength(1);
    expect((mars[0]!.endUtcMs! - mars[0]!.startUtcMs!) / DAY).toBe(3);
    const closest = Date.parse(String(mars[0]!.facts.find((x) => x.key === 'date')!.value));
    expect(Math.abs(mars[0]!.startUtcMs! - closest)).toBeLessThan(DAY);
    expect(mars[0]!.badges!.some((b) => b.startsWith('derived threshold') && b.includes('3 days'))).toBe(true);
    // no other body's reading mentions the days
    for (const p of ['Saturn', 'Jupiter', 'Venus'] as Planet[]) for (const f of run(p)) expect(String(f.facts.find((x) => x.key === 'meaning')!.value), p).not.toMatch(/days/);
    // the unsuccessful day of the same Mars pass keeps the orb window
    const bad = run('Mars').find((f) => f.facts.some((x) => x.key === 'meaning' && x.value === 'an unsuccessful day'))!;
    expect((bad.endUtcMs! - bad.startUtcMs!) / DAY).toBeGreaterThan(10);
  });
  it('is silent when no planet comes within its orb of a point in the span', () => {
    const quiet = Array.from({ length: 360 }, (_v, x) => x).filter((x) => T.dailyCusps(rising(), sky({ span: { startUtcMs: T0, endUtcMs: T0 + 5 * DAY }, lon: () => x })).length === 0);
    expect(quiet.length).toBeGreaterThan(0);
  });
  it('finds the passes of the Moon, which lasts about a day, on a half-day scan', () => {
    const moonSky = sky({ span: { startUtcMs: T0, endUtcMs: T0 + 30 * DAY }, lon: (p, ms) => (p === 'Moon' ? 13.2 * ((ms - T0) / DAY) : 1000) });
    const moon = T.dailyCusps(input({ model: chart({}, 0) }), moonSky).filter((f) => f.clock === 'moon' && f.facts.some((x) => x.key === 'point' && x.value === 'Ascendant') && f.facts.some((x) => x.key === 'aspect' && x.value === 'sextiles'));
    // Over 30 days the Moon at 13.2 degrees a day passes 60 degrees once (and 300 degrees once).
    expect(moon).toHaveLength(2);
    expect(moon[0]!.endUtcMs! - moon[0]!.startUtcMs!).toBeGreaterThan(0.8 * DAY);
  });
  it('places the edges of a pass between the samples either side of it', () => {
    const lons = Float64Array.from({ length: 8 }, (_v, i) => i * 10);
    const [p] = T.gridPasses(lons, 0, 10, 35, 12);
    expect(p!.startUtcMs).toBeCloseTo(23, 6);
    expect(p!.endUtcMs).toBeCloseTo(47, 6);
    expect(p!.closestUtcMs).toBe(30);
    expect(T.gridPasses(lons, 0, 10, 500, 5)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The tradition on every sample moment
// ---------------------------------------------------------------------------

describe('the Western tradition on the sample moments, 2031 to 2060', () => {
  it('prints no unfilled slot and no banned word, counts no fact twice, and passes the audit', { timeout: 120_000 }, () => {
    for (const f of MOMENTS) {
      const i = makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2031, toYear: 2060, birthTimeUncertaintyMinutes: 0, forecastConventions: { baziSexConvention: 'male-chart' } });
      expect(auditRegistry(DEFAULT_REGISTRY, i, { traditions: ['western'] }), f.id).toEqual([]);
      const r = evaluate(i, { traditions: ['western'], runs: 20 });
      expect(r.signals.length, f.id).toBeGreaterThan(1000);
      const ids = new Set<string>();
      const facts = new Set<string>();
      for (const s of r.signals) {
        expect(s.sentence, s.id).not.toMatch(/[{}]|undefined|NaN/);
        expect(bannedIn(s.sentence), s.id).toBeNull();
        if (s.topic === 'health') expect(MORTALITY_WORDS.test(s.sentence), s.id).toBe(false);
        expect(ids.has(s.id), s.id).toBe(false);
        ids.add(s.id);
        // The same rule never reports one fact twice in a topic.
        // Only the profected-sign key may be shared inside one rule: Valens's several matters read one sign, which is one fact.
        const key = `${s.ruleId}|${s.topic}|${s.dedupeKey}`;
        if (!s.dedupeKey.startsWith('profected-sign@year#')) expect(facts.has(key), key).toBe(false);
        facts.add(key);
        if (s.startUtcMs !== null) expect(s.endUtcMs! >= s.startUtcMs!).toBe(true);
      }
      // One profected sign is one fact: the Ascendant's profection read by three rules is kept once.
      const group = r.signals.filter((s) => s.topic === 'general' && s.dedupeKey.startsWith('profected-sign@year#'));
      const kept = dedupe(group).kept;
      expect(new Set(kept.map((s) => s.dedupeKey)).size).toBe(kept.length);
      expect(kept.length).toBeLessThan(group.length);
      expect(r.readings.every((x) => x.word !== undefined)).toBe(true);
    }
  });
  it('lists the rules that are bound, withheld and unbound by topic', () => {
    const r = report(DEFAULT_REGISTRY, { traditions: ['western'], sex: 'male', birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60 });
    expect(r.counts.western.unbound).toBe(0);
    expect(r.counts.western.bound).toBe(56 - NOT_EVALUATED.length);
    expect(r.coverage.western.wealth).toBeGreaterThan(14);
  });
  it('withholds a rule that needs the birth time when the time is not given, and runs the node rule without it', () => {
    const none = report(DEFAULT_REGISTRY, { traditions: ['western'], sex: null, birthTimeUncertaintyMinutes: null, birthTimeLimitMinutes: 60 });
    expect(none.statuses.find((s) => s.ruleId === 'lilly.profection.house-money')).toMatchObject({ state: 'withheld', reason: 'birth-time-uncertain' });
    expect(none.statuses.find((s) => s.ruleId === 'valens.critical-year-node')).toMatchObject({ state: 'bound' });
    expect(none.statuses.find((s) => s.ruleId === 'lilly.aspects.orbs-table')).toMatchObject({ state: 'bound' });
  });
});
