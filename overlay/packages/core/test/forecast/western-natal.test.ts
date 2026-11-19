// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The Western natal-promise bindings on charts built directly from longitudes (no date):
 * for each rule a case that fires, a case that does not, and the sentence it prints.
 * Aries rises in every chart below, so house n is the n-th sign counted from Aries.
 */
import { describe, expect, it } from 'vitest';
import { auditRegistry, DEFAULT_FORECAST_CONVENTIONS, DEFAULT_REGISTRY, evaluate, makeInput, report, RULE_FILES, ruleById, signalsFromFirings, unaccounted, type Firing } from '../../src/forecast/index.ts';
import { BINDINGS, COMPLETE, NOT_EVALUATED } from '../../src/forecast/predicates/western.ts';
import { makeNatal, type NatalModel, type NatalSpec } from '../../src/forecast/predicates/western/model.ts';
import { BADGE, NATAL_RULES, dignityGroup, honourSignificators, marriageSignificators, wealthSignificators } from '../../src/forecast/predicates/western/natal.ts';
import { PLANETS, type Planet } from '../../src/substrate/sky.ts';
import { makeMoment } from '../../src/substrate/time.ts';
import { MOMENTS } from '../../../../fixtures/moments.ts';

/** A night chart (the Sun is below the horizon) with Venus ruling the 2nd and the Part of Fortune in Taurus. */
const BASE: Record<Planet, number> = { Sun: 130, Moon: 100, Mercury: 150, Venus: 190, Mars: 300, Jupiter: 100, Saturn: 280 };
const chart = (lon: Partial<Record<Planet, number>> = {}, o: Partial<NatalSpec> = {}): NatalModel => makeNatal({ ascendant: 0, longitudes: { ...BASE, ...lon }, ...o });

const SPAN = { startUtcMs: Date.UTC(2031, 0, 1), endUtcMs: Date.UTC(2032, 0, 1) };
const fire = (id: string, m: NatalModel, sex: 'male' | 'female' | null = 'male'): Firing[] => NATAL_RULES[id]!(m, sex);
const sentences = (id: string, firings: Firing[]): string[] =>
  signalsFromFirings(ruleById(id)!, firings, { forecastConventions: DEFAULT_FORECAST_CONVENTIONS, span: SPAN }).map((s) => s.sentence);
const says = (id: string, m: NatalModel, sex: 'male' | 'female' | null = 'male'): string[] => sentences(id, fire(id, m, sex));
const badgesOf = (f: Firing[]): string[] => f.flatMap((x) => x.badges ?? []);

describe('the chart builder', () => {
  it('numbers whole-sign houses from the Ascendant sign and reads the sect from the Sun', () => {
    const m = chart();
    expect(m.houseOf('Sun')).toBe(5);
    expect(m.houseOf('Saturn')).toBe(10);
    expect(m.isDay).toBe(false);
    expect(chart({ Sun: 200 }).isDay).toBe(true);
    expect(makeNatal({ ascendant: 95, longitudes: { ...BASE, Moon: 95 } }).houseOf('Moon')).toBe(1);
    expect(m.lordOfHouse(2)).toBe('Venus');
    expect(m.lordOfHouse(10)).toBe('Saturn');
  });
  it('computes the Part of Fortune as the rule says: Asc + Moon - Sun by day, Asc + Sun - Moon by night', () => {
    expect(chart().fortune()).toBe(30);
    expect(chart({ Sun: 200, Moon: 250 }).fortune()).toBe(50);
  });
});

describe('wealth: the promise', () => {
  it('the significators are the lord of the 2nd, planets in it, the lord of the Part of Fortune sign and Jupiter, without repeats', () => {
    expect(wealthSignificators(chart())).toEqual(['Venus', 'Jupiter']);
    // Mercury in Taurus (the 2nd) joins them.
    expect(wealthSignificators(chart({ Mercury: 40 }))).toEqual(['Venus', 'Mercury', 'Jupiter']);
  });

  it('promise-strong fires when more than half stand in angles and are strong, and prints the sentence', () => {
    const m = chart(); // Venus 10 Libra (house 7, E 5) and Jupiter 10 Cancer (house 4, exalted)
    expect(m.cls('Venus')).toBe('strong');
    expect(m.cls('Jupiter')).toBe('strong');
    const f = fire('lilly.wealth.promise-strong', m);
    expect(f).toHaveLength(1);
    expect(sentences('lilly.wealth.promise-strong', f)).toEqual(['The significators of wealth (Venus and Jupiter) are strong, with 2 angular: the nativity promises a very great estate.']);
    expect(badgesOf(f)).toContain(BADGE.wholeSign);
    expect(badgesOf(f)).toContain(BADGE.derivedClass);
    expect(f[0]!.startUtcMs).toBeNull();
  });
  it('promise-strong does not fire when the strong significators are not in angles', () => {
    const m = chart({ Jupiter: 255 }); // Jupiter 15 Sagittarius: strong, in the 9th, a cadent house
    expect(m.cls('Jupiter')).toBe('strong');
    expect(fire('lilly.wealth.promise-strong', m)).toEqual([]);
  });
  it('promise-strong does not fire for angular planets that are not strong', () => {
    const m = chart({ Venus: 205, Jupiter: 195 }); // Venus 25 Libra, E 5, the 7th; Jupiter 15 Libra, E 2, the 7th
    expect([m.cls('Venus'), m.cls('Jupiter')]).toEqual(['strong', 'moderate']);
    expect(fire('lilly.wealth.promise-strong', m)).toEqual([]); // one strong of two is not more than half
  });

  it('promise-moderate fires when every significator is moderate', () => {
    const m = chart({ Venus: 75, Jupiter: 195 }); // both E 2
    expect([m.cls('Venus'), m.cls('Jupiter')]).toEqual(['moderate', 'moderate']);
    expect(says('lilly.wealth.promise-moderate', m)).toEqual(['The significators of wealth (Venus and Jupiter) are moderately fortified: neither abundance nor want is promised.']);
    expect(fire('lilly.wealth.promise-moderate', chart())).toEqual([]);
  });

  it('promise-weak.all fires when every significator is weak', () => {
    const m = chart({ Venus: 125, Jupiter: 215 }); // both E -5
    expect(says('lilly.wealth.promise-weak.all', m)).toEqual(['All significators of wealth (Venus and Jupiter) are weak: the nativity promises want.']);
    expect(fire('lilly.wealth.promise-weak.all', chart({ Venus: 125 }))).toEqual([]); // Jupiter is strong
  });

  it('promise-mixed fires on as many weak as strong, and needs at least one of each', () => {
    const m = chart({ Jupiter: 70 }); // Jupiter 10 Gemini: detriment, own term: E -3
    expect([m.cls('Venus'), m.cls('Jupiter')]).toEqual(['strong', 'weak']);
    expect(says('lilly.wealth.promise-mixed', m)).toEqual(['As many significators of wealth are weak as strong (Venus and Jupiter): an inconstant fortune is promised.']);
    // Moderate planets only: no strong and no weak. The moderate rule speaks and this one does not.
    expect(fire('lilly.wealth.promise-mixed', chart({ Venus: 75, Jupiter: 195 }))).toEqual([]);
    expect(fire('lilly.wealth.promise-mixed', chart())).toEqual([]);
  });

  it('the four promise rules never speak together on one chart, and combinations they do not cover are silent', () => {
    const ids = ['lilly.wealth.promise-strong', 'lilly.wealth.promise-moderate', 'lilly.wealth.promise-weak.all', 'lilly.wealth.promise-mixed'];
    let silent = 0;
    for (let v = 0; v < 360; v += 5) for (let j = 0; j < 360; j += 15) {
      const m = chart({ Venus: v, Jupiter: j });
      const n = ids.filter((id) => fire(id, m).length > 0).length;
      expect(n, `Venus ${v} Jupiter ${j}`).toBeLessThanOrEqual(1);
      if (n === 0) silent++;
    }
    expect(silent).toBeGreaterThan(0);
  });

  it('promise-weak.majority needs both Infortunes in angles and both Fortunes in succedent houses', () => {
    const m = chart({ Saturn: 280, Mars: 100, Venus: 140, Jupiter: 220 }); // houses 10, 4, 5, 8
    expect(says('lilly.wealth.promise-weak.majority', m)).toEqual(['The Infortunes stand in angles and the Fortunes in succedent houses: Lilly lists this among the signs of poverty.']);
    expect(fire('lilly.wealth.promise-weak.majority', chart({ Saturn: 280, Mars: 100, Venus: 160, Jupiter: 220 }))).toEqual([]); // Venus cadent
    expect(fire('lilly.wealth.promise-weak.majority', chart({ Saturn: 280, Mars: 100, Venus: 140, Jupiter: 160 }))).toEqual([]); // Jupiter cadent (Lilly: succedent, not cadent)
    expect(fire('lilly.wealth.promise-weak.majority', chart({ Saturn: 280, Mars: 70, Venus: 140, Jupiter: 220 }))).toEqual([]); // Mars cadent
  });

  it('promise-weak.moon-combust: clause (a), the Moon combust with an Infortune as dispositor', () => {
    const m = chart({ Sun: 290, Moon: 295 }); // Moon in Capricorn, 5 degrees from the Sun; Saturn rules Capricorn
    expect(m.moonCombust()).toBe(true);
    const f = fire('lilly.wealth.promise-weak.moon-combust', m);
    expect(sentences('lilly.wealth.promise-weak.moon-combust', f)).toEqual(['The Moon is combust and her dispositor Saturn is an Infortune (or the lunation point is oppressed): loss of estate is promised.']);
    expect(badgesOf(f).join(' ')).toMatch(/clause \(a\) only/);
    expect(fire('lilly.wealth.promise-weak.moon-combust', chart({ Sun: 290, Moon: 305 }))).toEqual([]); // 15 away
    expect(fire('lilly.wealth.promise-weak.moon-combust', chart({ Sun: 299.9, Moon: 301 }))).toEqual([]); // close, but in another sign
    expect(fire('lilly.wealth.promise-weak.moon-combust', chart({ Sun: 290, Moon: 290.1 }))).toEqual([]); // cazimi is not combust
    expect(fire('lilly.wealth.promise-weak.moon-combust', chart({ Sun: 130, Moon: 135 }))).toEqual([]); // combust, but the Sun disposes of her
  });
});

describe('wealth: inheritance', () => {
  it('a: Saturn in the 8th by day aspecting a Fortune', () => {
    const m = chart({ Sun: 200, Saturn: 220, Jupiter: 225 });
    expect(m.isDay).toBe(true);
    expect(says('lilly.wealth.inheritance-8th.a', m)).toEqual(['Saturn stands in the 8th house by day with an aspect to a Fortune: an estate by inheritance is signified.']);
    expect(fire('lilly.wealth.inheritance-8th.a', chart({ Sun: 130, Saturn: 220, Jupiter: 225 }))).toEqual([]); // night
    expect(fire('lilly.wealth.inheritance-8th.a', chart({ Sun: 200, Saturn: 220, Jupiter: 70, Venus: 5 }))).toEqual([]); // no aspect
    expect(fire('lilly.wealth.inheritance-8th.a', chart({ Sun: 200, Saturn: 190, Jupiter: 195 }))).toEqual([]); // not in the 8th
  });
  it('b: the lord of the 8th is dignified and in the 10th', () => {
    const m = chart({ Mars: 285 }); // Mars rules Scorpio, the 8th; exalted in Capricorn, the 10th
    expect(says('lilly.wealth.inheritance-8th.b', m)).toEqual(['The lord of the 8th is dignified and stands in the 10th: an estate by inheritance is signified.']);
    expect(fire('lilly.wealth.inheritance-8th.b', chart({ Mars: 100 }))).toEqual([]);
    expect(fire('lilly.wealth.inheritance-8th.b', chart({ Mars: 275 })).length).toBe(1); // 5 Capricorn: exalted, E 4
  });
  it('c: the lord of the Part of Fortune in the 8th and the lord of the Ascendant aspecting him', () => {
    const m = chart({ Venus: 225, Mars: 230 }); // Part of Fortune in Taurus: Venus, in Scorpio (the 8th); Mars rules the Ascendant
    expect(says('lilly.wealth.inheritance-8th.c', m)).toEqual(['The lord of the Part of Fortune stands in the 8th and the lord of the Ascendant aspects him: wealth by inheritance is signified.']);
    expect(fire('lilly.wealth.inheritance-8th.c', chart({ Venus: 225, Mars: 330 }))).toEqual([]);
    expect(fire('lilly.wealth.inheritance-8th.c', chart({ Venus: 190, Mars: 195 }))).toEqual([]); // not in the 8th
  });
});

describe('wealth: durability of the estate', () => {
  const ids = ['benefic-strong', 'weak', 'infortune-strong', 'infortune-weak'].map((k) => `lilly.wealth.durability.${k}`);
  const which = (m: NatalModel): string[] => ids.filter((id) => fire(id, m).length > 0).map((id) => id.split('.').pop()!);

  it('a strong Fortune alone in the 2nd: continues undisturbed', () => {
    const m = chart({ Venus: 35 }); // 5 Taurus, her own sign
    expect(which(m)).toEqual(['benefic-strong']);
    expect(says(ids[0]!, m)).toEqual(['The principal significator of substance, Venus, is strong: the estate is promised to continue undisturbed all the life.']);
  });
  it('a strong planet in a Fortune\'s dignities counts as benevolent', () => {
    const m = chart({ Moon: 35 }); // the Moon exalted in Taurus, Venus's sign
    expect(m.inFortuneDignity('Moon')).toBe(true);
    expect(which(m)).toEqual(['benefic-strong']);
  });
  it('a weak planet that is not an Infortune: riches continue with great hazard', () => {
    const m = chart({ Mercury: 45 }); // 15 Taurus: E -5
    expect(which(m)).toEqual(['weak']);
    expect(says(ids[1]!, m)).toEqual(['The principal significator of substance, Mercury, is weak: the estate is promised to continue but with great hazard: much labour to preserve it, good store got and suddenly lost.']);
  });
  it('a strong Infortune: continues with difficulty', () => {
    const m = chart({ Saturn: 55 }); // 25 Taurus: E 3
    expect(which(m)).toEqual(['infortune-strong']);
    expect(says(ids[2]!, m)).toEqual(['The principal significator of substance, Saturn, is strong: the estate is promised to continue but with difficulty, the native subject rather to lose than to lay up.']);
  });
  it('a weak Infortune: overthrown, and only the Infortune branch speaks for it', () => {
    const m = chart({ Mars: 45 }); // 15 Taurus: Mars in detriment and peregrine
    expect(which(m)).toEqual(['infortune-weak']);
    expect(says(ids[3]!, m)).toEqual(['The principal significator of substance, Mars, is weak: the estate is promised to be overthrown, not to continue.'.replace('to be overthrown, not to continue', 'not to continue but to be overthrown')]);
  });
  it('is silent when no planet or several planets stand in the 2nd', () => {
    expect(which(chart())).toEqual([]);
    expect(which(chart({ Venus: 35, Mercury: 45 }))).toEqual([]);
  });
  it('is silent for a moderate planet', () => {
    expect(chart({ Mercury: 35 }).cls('Mercury')).toBe('moderate'); // 5 Taurus: face only, E 1
    expect(which(chart({ Mercury: 35 }))).toEqual([]);
  });
});

describe('wealth: the phase of life', () => {
  it('names the phase of the houses most significators stand in', () => {
    expect(says('lilly.wealth.life-phase', chart({ Venus: 300, Jupiter: 280 }))).toEqual(['The significators of wealth stand in houses 10 and 11: Lilly places gain of estate in youth.']);
    expect(says('lilly.wealth.life-phase', chart({ Venus: 190, Jupiter: 220 }))).toEqual(['The significators of wealth stand in houses 7 and 8: Lilly places gain of estate in manhood, from 25 to 35 or 40.']);
    expect(says('lilly.wealth.life-phase', chart({ Venus: 150, Jupiter: 120 }))).toEqual(['The significators of wealth stand in houses 5 and 6: Lilly places gain of estate in the years nearer old age, after 40 and before 55.']);
    expect(says('lilly.wealth.life-phase', chart({ Venus: 10, Jupiter: 70 }))).toEqual(['The significators of wealth stand in houses 1 and 3: Lilly places gain of estate in the time towards the latter end.']);
  });
  it('is silent when no group holds more than half', () => {
    expect(fire('lilly.wealth.life-phase', chart({ Venus: 300, Jupiter: 100 }))).toEqual([]);
  });
});

describe('career: honour', () => {
  // Others are placed where none of them aspects either Light, so the significators are the Lights and the lord of the 10th.
  const quiet = { Mercury: 52, Venus: 52, Mars: 52, Jupiter: 80 };
  const POOR = chart({ Sun: 305, Moon: 215, Saturn: 5, ...quiet });
  const RECEIVED = chart({ Sun: 305, Moon: 215, Saturn: 125, ...quiet });
  const TIE = chart({ Sun: 125, Moon: 215, Saturn: 305, Venus: 285, Mercury: 52, Mars: 52, Jupiter: 80 });

  it('the significators are the Lights, planets aspecting them, the lord of the Midheaven and planets in it', () => {
    expect(honourSignificators(POOR)).toEqual(['Sun', 'Moon', 'Saturn']); // Saturn rules Capricorn, the 10th
    expect(honourSignificators(chart())).toEqual(['Sun', 'Moon', 'Venus', 'Mars', 'Jupiter', 'Saturn']);
    expect(honourSignificators(TIE)).toEqual(['Sun', 'Moon', 'Venus', 'Saturn']); // Venus is in the 10th
  });

  it('classifies a planet by house or exaltation or reception, by minor dignity, or as poor', () => {
    expect(dignityGroup(chart({ Sun: 125 }), 'Sun')).toBe('home'); // own house
    expect(dignityGroup(chart({ Mercury: 75 }), 'Mercury')).toBe('home'); // 15 Gemini: house
    expect(dignityGroup(chart({ Moon: 35 }), 'Moon')).toBe('home'); // exaltation
    expect(dignityGroup(chart({ Mars: 45, Venus: 100 }), 'Mars')).toBe('poor'); // detriment and peregrine
    // Mars in Taurus is poor, but with Venus in Aries the two stand in each other's houses: reception redeems.
    expect(dignityGroup(chart({ Mars: 45, Venus: 5 }), 'Mars')).toBe('home');
    expect(dignityGroup(chart({ Venus: 165 }), 'Venus')).toBe('unclassed'); // fall, but the face is hers
    expect(dignityGroup(chart({ Moon: 330, Jupiter: 250 }), 'Moon')).toBe('poor');
    // The Sun by day in 5 Sagittarius holds only the fire triplicity.
    expect(dignityGroup(chart({ Sun: 245 }, { isDay: true }), 'Sun')).toBe('minor');
  });

  it('honour-essential: a plurality of significators in house, exaltation or reception', () => {
    const f = fire('lilly.career.honour-essential', chart());
    expect(sentences('lilly.career.honour-essential', f)).toEqual([
      'The significators of honour (Sun, Moon, Venus, Mars, Jupiter and Saturn) stand in house, exaltation or mutual reception: honours, offices of public trust, great commands and favour among great persons, for a native born capable of it.',
    ]);
    expect(badgesOf(f).join(' ')).toMatch(/tie says nothing/);
  });
  it('honour-essential: peregrine and debilitated Lights and lord give the lowest group, and reception redeems', () => {
    expect(['Sun', 'Moon', 'Saturn'].map((p) => dignityGroup(POOR, p as Planet))).toEqual(['poor', 'poor', 'poor']);
    expect(sentences('lilly.career.honour-essential', fire('lilly.career.honour-essential', POOR))).toEqual([
      'The significators of honour (Sun, Moon and Saturn) stand in peregrine, detriment or fall: very small or no dignities.',
    ]);
    // The Sun in Aquarius and Saturn in Leo are in mutual reception by house: both rise to the first group.
    expect(['Sun', 'Moon', 'Saturn'].map((p) => dignityGroup(RECEIVED, p as Planet))).toEqual(['home', 'poor', 'home']);
    expect(sentences('lilly.career.honour-essential', fire('lilly.career.honour-essential', RECEIVED))[0]).toContain('house, exaltation or mutual reception');
  });
  it('honour-essential: a tie says nothing', () => {
    expect(honourSignificators(TIE).map((p) => dignityGroup(TIE, p))).toEqual(['home', 'poor', 'poor', 'home']);
    expect(fire('lilly.career.honour-essential', TIE)).toEqual([]);
  });

  it('honour-angularity: the group of most significators in angles, succedent houses, or the 8th and cadent houses', () => {
    expect(sentences('lilly.career.honour-angularity', fire('lilly.career.honour-angularity', chart()))).toEqual([
      'The significators of honour stand in angular houses: ample preferment.',
    ]);
    const cadent = chart({ Sun: 70, Moon: 160, Saturn: 250, Mercury: 24, Venus: 24, Mars: 24, Jupiter: 87 }); // houses 3, 6, 9
    expect(honourSignificators(cadent)).toEqual(['Sun', 'Moon', 'Saturn']);
    expect(sentences('lilly.career.honour-angularity', fire('lilly.career.honour-angularity', cadent))).toEqual([
      'The significators of honour stand in 8th or cadent houses: very little honour or reputation, a mean and obscure condition.',
    ]);
    const succ = chart({ Sun: 40, Moon: 130, Saturn: 40, Mercury: 24, Venus: 24, Mars: 24, Jupiter: 24 }); // houses 2, 5, 2
    expect(sentences('lilly.career.honour-angularity', fire('lilly.career.honour-angularity', succ))).toEqual([
      'The significators of honour stand in succedent houses: moderate esteem or little honour.',
    ]);
    // One of each group: no plurality, no statement.
    expect(fire('lilly.career.honour-angularity', chart({ Sun: 70, Moon: 130, Saturn: 280, Mercury: 24, Venus: 24, Mars: 24, Jupiter: 87 }))).toEqual([]);
  });

  it('lord1-lord10: the lord of the 1st in the 10th, or of the 10th in the 1st', () => {
    const one = chart({ Mars: 285, Saturn: 100 });
    expect(says('lilly.career.lord1-lord10', one)).toEqual(['The lord of the 1st stands in the 10th: good fame and reputation are signified.']);
    const other = chart({ Mars: 100, Saturn: 10 });
    expect(says('lilly.career.lord1-lord10', other)).toEqual(['The lord of the 10th stands in the 1st: good fame and reputation are signified.']);
    const both = chart({ Mars: 285, Saturn: 10 });
    expect(says('lilly.career.lord1-lord10', both)).toHaveLength(2);
    expect(fire('lilly.career.lord1-lord10', chart({ Mars: 100, Saturn: 100 }))).toEqual([]);
  });

  it('luminary-angularity.cadent: both Lights and all five planets in cadent houses', () => {
    const m = chart({ Sun: 70, Moon: 160, Mercury: 250, Venus: 340, Mars: 80, Jupiter: 170, Saturn: 260 });
    expect(says('lilly.career.luminary-angularity.cadent', m)).toEqual(['Both Lights and the planets stand in cadent houses: a humble standing is signified.']);
    expect(fire('lilly.career.luminary-angularity.cadent', chart({ Sun: 70, Moon: 160, Mercury: 250, Venus: 340, Mars: 80, Jupiter: 170, Saturn: 280 }))).toEqual([]);
  });
});

describe('relationships: a man\'s nativity', () => {
  it('every rule needs the sex convention and the birth time, and is silent for a woman\'s chart', () => {
    for (const id of Object.keys(NATAL_RULES).filter((i) => i.startsWith('lilly.relationships.'))) {
      const b = BINDINGS.find((x) => x.ruleId === id)!;
      expect(b.requires, id).toEqual({ birthTime: true, sex: true });
      expect(fire(id, chart(), 'female'), id).toEqual([]);
      expect(fire(id, chart(), null), id).toEqual([]);
    }
    for (const b of BINDINGS.filter((x) => x.ruleId in NATAL_RULES && !x.ruleId.startsWith('lilly.relationships.'))) expect(b.requires, b.ruleId).toEqual({ birthTime: true, sex: false });
  });

  it('single-life.barren: Venus and the Moon in barren signs and in the 6th, 9th, 12th or 8th', () => {
    const m = chart({ Venus: 160, Moon: 170 }); // both in Virgo, the 6th
    expect(says('lilly.relationships.single-life.barren', m)).toEqual(["Venus and the Moon stand in barren signs and cadent houses: a single life is signified (man's chart)."]);
    expect(fire('lilly.relationships.single-life.barren', chart({ Venus: 160, Moon: 100 }))).toEqual([]);
    expect(fire('lilly.relationships.single-life.barren', chart({ Venus: 70, Moon: 80 }))).toEqual([]); // barren sign, but the 3rd is not in Lilly's list
  });

  it('single-life.moon-saturn: the precondition, then (a) or (b)', () => {
    // (a) the Moon in Scorpio square Saturn in Leo, the lord of the 7th (Venus) weak.
    const a = chart({ Moon: 215, Saturn: 125, Venus: 5 });
    expect(a.cls('Venus')).toBe('weak');
    expect(says('lilly.relationships.single-life.moon-saturn', a)).toEqual(["The Moon is afflicted by Saturn as Lilly describes: marriage is withheld (man's chart)."]);
    // Without the precondition (Venus strong, angular, in no barren sign) the rule does not fire.
    expect(fire('lilly.relationships.single-life.moon-saturn', chart({ Moon: 215, Saturn: 125, Venus: 185 }))).toEqual([]);
    // (b) the Moon combust of the Sun in Libra, opposite Saturn.
    const b = chart({ Sun: 195, Moon: 190, Saturn: 10, Venus: 5 });
    expect(b.moonCombust()).toBe(true);
    expect(fire('lilly.relationships.single-life.moon-saturn', b)).toHaveLength(1);
    expect(fire('lilly.relationships.single-life.moon-saturn', chart({ Sun: 130, Moon: 190, Saturn: 10, Venus: 5 }))).toEqual([]); // not combust
    // Saturn in Taurus is opposite Scorpio, never square to it: the second alternative of (a) cannot fire.
    for (let moon = 210; moon < 240; moon += 1) expect(fire('lilly.relationships.single-life.moon-saturn', chart({ Moon: moon, Saturn: 45, Venus: 5 }))).toEqual([]);
  });

  it('marriage-promised: the lord of the Ascendant applies to the lord of the 7th, in reception', () => {
    // Mars rules Aries, Venus rules Libra: Mars in Libra, Venus in Aries, in opposition and in mutual reception.
    const m = chart({ Mars: 183, Venus: 5 }, { speeds: { Mars: 0.8, Venus: 0.5 } });
    expect(m.receptionBetween('Mars', 'Venus')).toBe('house');
    expect(says('lilly.relationships.marriage-promised', m)).toEqual(["The lord of the Ascendant applies to the lord of the 7th with reception: marriage is desired (man's chart)."]);
    // Separating, slower, or out of reception: silent.
    expect(fire('lilly.relationships.marriage-promised', chart({ Mars: 187, Venus: 5 }, { speeds: { Mars: 0.8, Venus: 0.5 } }))).toEqual([]);
    expect(fire('lilly.relationships.marriage-promised', chart({ Mars: 183, Venus: 5 }, { speeds: { Mars: 0.3, Venus: 0.5 } }))).toEqual([]);
    expect(fire('lilly.relationships.marriage-promised', chart({ Mars: 183, Venus: 100 }, { speeds: { Mars: 0.8, Venus: 0.5 } }))).toEqual([]);
  });

  it('ease: most significators of marriage strong', () => {
    expect(marriageSignificators(chart())).toEqual(['Venus', 'Moon']);
    expect(says('lilly.relationships.ease', chart())).toEqual(['Most significators of marriage are strong: a wife is obtained easily.']);
    expect(fire('lilly.relationships.ease', chart({ Moon: 5 }))).toEqual([]);
  });

  it('age: significators oriental and in the oriental quarters, the Moon among them, or the reverse', () => {
    const early = chart({ Moon: 100, Venus: 120 }); // both behind the Sun (130), in houses 4 and 5
    expect(says('lilly.relationships.age', early)).toEqual(["The significators of marriage are oriental of the Sun: a marriage in youth, or to a young woman is signified (man's chart)."]);
    const late = chart({ Moon: 190, Venus: 195 }); // both ahead of the Sun, in the 7th
    expect(says('lilly.relationships.age', late)).toEqual(["The significators of marriage are occidental of the Sun: a marriage very late, or in youth to a widow or a very aged woman is signified (man's chart)."]);
    // Venus oriental but the Moon occidental: no statement.
    expect(fire('lilly.relationships.age', chart({ Moon: 160, Venus: 120 }))).toEqual([]);
  });
});

describe('journeys', () => {
  it('travel.promised: the lord of the 9th in the 1st, of the 1st in the 9th, or the two in conjunction', () => {
    expect(says('lilly.travel.promised', chart({ Jupiter: 10 }))).toEqual(['The significators of journeys stand as Lilly describes (the lord of the 9th in the 1st): travel is signified.']);
    expect(says('lilly.travel.promised', chart({ Mars: 250 }))).toEqual(['The significators of journeys stand as Lilly describes (the lord of the 1st in the 9th): travel is signified.']);
    expect(says('lilly.travel.promised', chart({ Mars: 100, Jupiter: 105 }))).toEqual(['The significators of journeys stand as Lilly describes (the lords of the 1st and 9th in conjunction): travel is signified.']);
    expect(fire('lilly.travel.promised', chart({ Mars: 300, Jupiter: 100 }))).toEqual([]);
  });
});

describe('the bindings as a whole', () => {
  const natalIds = RULE_FILES.find((f) => f.tradition === 'western')!.rules.filter((r) => r.stage === 'natal-promise').map((r) => r.id);

  it('account for all 26 natal-promise rules: 24 bound, 2 not, each with its reason', () => {
    expect(natalIds).toHaveLength(26);
    const bound = new Set(BINDINGS.map((b) => b.ruleId));
    const declared = new Map(NOT_EVALUATED.map((n) => [n.ruleId, n.reason]));
    expect(natalIds.filter((id) => bound.has(id))).toHaveLength(24);
    expect([...declared.keys()].sort()).toEqual(['bonatti.profection.revolution-agreement', 'lilly.health.constitution', 'lilly.relationships.single-life.saturn']);
    for (const id of natalIds) expect(bound.has(id) !== declared.has(id), id).toBe(true);
    for (const r of declared.values()) expect(r.length).toBeGreaterThan(40);
  });
  it('bind every natal-promise rule through NATAL_RULES', () => {
    const natalBound = BINDINGS.filter((b) => ruleById(b.ruleId)!.stage === 'natal-promise');
    expect(natalBound.map((b) => b.ruleId).sort()).toEqual(Object.keys(NATAL_RULES).sort());
    expect(COMPLETE).toBe(true);
  });
  it('mark every statement of a rule that names a house with the whole-sign badge', () => {
    const cases: Array<[string, NatalModel]> = [
      ['lilly.wealth.promise-strong', chart()],
      ['lilly.wealth.promise-weak.majority', chart({ Saturn: 280, Mars: 100, Venus: 140, Jupiter: 220 })],
      ['lilly.career.lord1-lord10', chart({ Mars: 285, Saturn: 10 })],
      ['lilly.career.luminary-angularity.cadent', chart({ Sun: 70, Moon: 160, Mercury: 250, Venus: 340, Mars: 80, Jupiter: 170, Saturn: 260 })],
      ['lilly.relationships.age', chart({ Moon: 100, Venus: 120 })],
      ['lilly.travel.promised', chart({ Jupiter: 10 })],
    ];
    for (const [id, m] of cases) {
      const f = fire(id, m);
      expect(f.length, id).toBeGreaterThan(0);
      for (const x of f) expect(x.badges, id).toContain(BADGE.wholeSign);
    }
  });
  it('run on the sample moments with a man\'s chart, give only undated signals with sources, and pass the audit', () => {
    let total = 0;
    for (const f of MOMENTS) {
      const input = makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2031, toYear: 2033, birthTimeUncertaintyMinutes: 0, forecastConventions: { baziSexConvention: 'male-chart' } });
      expect(auditRegistry(DEFAULT_REGISTRY, input, { traditions: ['western'] }), f.id).toEqual([]);
      const r = evaluate(input, { traditions: ['western'], topics: ['wealth', 'career', 'relationships', 'home-travel'], runs: 20 });
      for (const s of r.signals.filter((x) => x.stage === 'natal-promise')) {
        total++;
        expect(s.tradition).toBe('western');
        expect(s.startUtcMs).toBeNull();
        expect(s.sentence).not.toMatch(/[{}]/);
        expect(s.source.opened).toBe(true);
        expect(s.source.locator).not.toBe('');
        expect(s.clockGroup).toBe('birth-arithmetic');
      }
    }
    expect(total).toBeGreaterThan(0);
  });
  it('withhold the marriage rules without a sex convention and everything when the birth time is uncertain', () => {
    const base = makeInput(makeMoment(MOMENTS[0]!.civil, MOMENTS[0]!.zone, MOMENTS[0]!.place), { fromYear: 2031, toYear: 2033, birthTimeUncertaintyMinutes: 0 });
    const r = report(DEFAULT_REGISTRY, { traditions: ['western'], sex: null, birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60 });
    expect(r.statuses.find((s) => s.ruleId === 'lilly.relationships.ease')).toMatchObject({ state: 'withheld', reason: 'needs-sex-convention' });
    expect(r.statuses.find((s) => s.ruleId === 'lilly.wealth.promise-strong')).toMatchObject({ state: 'bound' });
    const late = report(DEFAULT_REGISTRY, { traditions: ['western'], sex: 'male', birthTimeUncertaintyMinutes: 90, birthTimeLimitMinutes: 60 });
    expect(late.statuses.find((s) => s.ruleId === 'lilly.wealth.promise-strong')).toMatchObject({ state: 'withheld', reason: 'birth-time-uncertain' });
    expect(base.span.startUtcMs).toBeLessThan(base.span.endUtcMs);
  });
  it('count the rules bound per topic as coverage', () => {
    const r = report(DEFAULT_REGISTRY, { traditions: ['western'], sex: 'male', birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60 });
    const natalIds = new Set(Object.keys(NATAL_RULES));
    const natalRules = r.statuses.filter((s) => natalIds.has(s.ruleId));
    expect(natalRules.filter((s) => s.state === 'bound')).toHaveLength(24);
    const per = (topic: string): number => natalRules.filter((s) => s.state === 'bound' && ruleById(s.ruleId)!.topics.includes(topic as never)).length;
    expect(per('wealth')).toBe(14);
    expect(per('career')).toBe(4);
    expect(per('relationships')).toBe(5);
    expect(per('home-travel')).toBe(1);
    expect(PLANETS).toHaveLength(7);
  });
});
