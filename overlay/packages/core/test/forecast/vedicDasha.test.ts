// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The dasha and antardasha bindings, one rule at a time, on invented charts: each rule on a
 * case that fires, a case that does not, and the sentence it prints. The chart is given as
 * sidereal sign and degree per planet, and the dasha spans are given by hand, so the
 * expected answers are worked out from the rule text and not from the engine.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_FORECAST_CONVENTIONS, ruleById, signalsFromFirings, type ForecastContext, type Signal } from '../../src/forecast/index.ts';
import { BINDINGS } from '../../src/forecast/predicates/vedic.ts';
import { ANTAR_DUSTHANA, ANTAR_GOOD_PLACES, EFFECT, placementVerdict } from '../../src/forecast/predicates/vedic/dasha.ts';
import type { VedicContext } from '../../src/forecast/predicates/vedic/natal.ts';
import { vedicChartModel, type Placement } from '../../src/systems/vedic/houses.ts';
import type { DashaSpan } from '../../src/systems/vedic/index.ts';

const DAY = 86_400_000;
const T0 = 10 ** 12;
const SPAN = { startUtcMs: T0 - DAY, endUtcMs: T0 + 4000 * DAY };

/** Signs by index: 0 Aries, 1 Taurus, 2 Gemini, 3 Cancer, 4 Leo, 5 Virgo, 6 Libra, 7 Scorpio, 8 Sagittarius, 9 Capricorn, 10 Aquarius, 11 Pisces. */
const BASE: Record<string, [number, number]> = {
  Sun: [4, 5],
  Moon: [3, 10],
  Mars: [0, 5],
  Mercury: [2, 15],
  Jupiter: [8, 5],
  Venus: [1, 10],
  Saturn: [10, 25],
  Rahu: [11, 10],
  Ketu: [5, 10],
};

interface Setup {
  lagna?: number;
  planets?: Record<string, [number, number]>;
  maha?: string[];
  antar?: [string, string][];
  utcMs?: number;
}

function ctxOf(o: Setup): ForecastContext {
  const lagna = o.lagna ?? 0;
  const put = { ...BASE, ...o.planets };
  const placements: Placement[] = Object.entries(put).map(([planet, [signIndex, degree]]) => ({ planet, signIndex, degree }));
  const model = vedicChartModel(lagna, placements);
  const maha: DashaSpan[] = (o.maha ?? []).map((lord, i) => ({ label: lord, lord, startUtcMs: T0 + i * 3000 * DAY, endUtcMs: T0 + (i + 1) * 3000 * DAY }));
  const antar: DashaSpan[] = (o.antar ?? []).map(([m, a], i) => ({ label: `${m} / ${a}`, lord: a, startUtcMs: T0 + i * 300 * DAY, endUtcMs: T0 + (i + 1) * 300 * DAY }));
  const ext: VedicContext = { model };
  return {
    input: { span: SPAN, moment: { utcMs: o.utcMs ?? 946_728_000_000 } },
    dashas: () => ({ maha, antar }),
    extension: () => ext,
    memo: (_k: string, c: () => unknown) => c(),
  } as unknown as ForecastContext;
}

function run(ruleId: string, o: Setup): Signal[] {
  const rule = ruleById(ruleId)!;
  const b = BINDINGS.find((x) => x.ruleId === ruleId)!;
  return signalsFromFirings(rule, b.fire(ctxOf(o), rule), { forecastConventions: DEFAULT_FORECAST_CONVENTIONS, span: SPAN });
}

const sentences = (s: Signal[], topic?: string): string[] => s.filter((x) => !topic || x.topic === topic).map((x) => x.sentence);
const topics = (s: Signal[]): string[] => [...new Set(s.map((x) => x.topic))].sort();

describe('the mahadasha house-lord rules', () => {
  it('wealth-5-9: the 5th or 9th lord, or a planet joined to it, if not debilitated and not in 6, 8, 12', () => {
    const id = 'parashari.wealth-5-9-lord-dasha';
    expect(sentences(run(id, { maha: ['Jupiter'] }))).toEqual(["Jupiter, being the lord of the 9th house, runs the period; Parashara's rule says such planets give wealth in their periods."]);
    expect(sentences(run(id, { maha: ['Sun'] }))[0]).toMatch(/^Sun, being the lord of the 5th house/);
    // Mercury standing with the 5th lord (Sun, Leo) is joined to it.
    expect(sentences(run(id, { maha: ['Mercury'], planets: { Mercury: [4, 20] } }))).toEqual(["Mercury, joined with the lord of the 5th house, runs the period; Parashara's rule says such planets give wealth in their periods."]);
    // Debilitated (Jupiter in Capricorn) and in the 6th (Jupiter in Virgo): nothing.
    expect(run(id, { maha: ['Jupiter'], planets: { Jupiter: [9, 5] } })).toEqual([]);
    expect(run(id, { maha: ['Jupiter'], planets: { Jupiter: [5, 5] } })).toEqual([]);
    expect(run(id, { maha: ['Moon'] })).toEqual([]);
    expect(topics(run(id, { maha: ['Jupiter'] }))).toEqual(['wealth']);
  });

  it('wealth-5-9: a lord of two houses is settled by the per-Lagna list, and left unsaid where the list is silent', () => {
    const id = 'parashari.wealth-5-9-lord-dasha';
    // Gemini rising: Venus owns the 5th and the 12th and the list calls it auspicious; Saturn owns the 9th and the 8th and the list does not name it.
    const gem = { lagna: 2, planets: { Venus: [2, 10], Saturn: [10, 10] } as Record<string, [number, number]> };
    expect(sentences(run(id, { ...gem, maha: ['Venus'] }))).toHaveLength(1);
    expect(run(id, { ...gem, maha: ['Saturn'] })).toEqual([]);
  });

  it('wealth-5-9: the antardasha version is the extension, labelled, and runs on the antardasha span', () => {
    const s = run('parashari.wealth-5-9-lord-dasha', { maha: ['Moon'], antar: [['Moon', 'Jupiter']] });
    expect(s).toHaveLength(1);
    expect(s[0]!.badges).toContain('extension (antardasha)');
    expect(s[0]!.endUtcMs! - s[0]!.startUtcMs!).toBe(300 * DAY);
    expect(s[0]!.clock).toBe('dasha');
    const m = run('parashari.wealth-5-9-lord-dasha', { maha: ['Jupiter'] });
    expect(m[0]!.badges).not.toContain('extension (antardasha)');
  });

  it('career-10: the 10th lord, not debilitated, not in 6, 8, 12', () => {
    const id = 'parashari.dasha-lord-career-10';
    expect(sentences(run(id, { maha: ['Saturn'] }))).toEqual(['Saturn, lord of the 10th house, runs the period; recognition and position from authority are indicated.']);
    expect(run(id, { maha: ['Saturn'], planets: { Saturn: [0, 20] } })).toEqual([]); // debilitated in Aries
    expect(run(id, { maha: ['Saturn'], planets: { Saturn: [5, 5] } })).toEqual([]); // in the 6th
    expect(run(id, { maha: ['Jupiter'] })).toEqual([]);
    expect(topics(run(id, { maha: ['Saturn'] }))).toEqual(['career']);
  });

  it('education-5-9: the 5th and 9th lords, with the house in the sentence', () => {
    const id = 'parashari.dasha-lord-education-5-9';
    expect(sentences(run(id, { maha: ['Sun'] }))).toEqual(['Sun, lord of the 5th house, runs the period; progress in study is indicated.']);
    expect(sentences(run(id, { maha: ['Jupiter'] }))[0]).toMatch(/lord of the 9th house/);
    expect(run(id, { maha: ['Moon'] })).toEqual([]);
    expect(topics(run(id, { maha: ['Sun'] }))).toEqual(['learning']);
  });

  it('4th-home: the 4th lord when it is neither debilitated nor in 6, 8, 12', () => {
    const id = 'parashari.dasha-lord-4th-home';
    expect(sentences(run(id, { maha: ['Moon'] }))).toEqual(['Moon, lord of the 4th house, runs the period; acquisition of house, land or conveyance is indicated.']);
    expect(run(id, { maha: ['Moon'], planets: { Moon: [7, 10] } })).toEqual([]); // debilitated in Scorpio
    expect(run(id, { maha: ['Sun'] })).toEqual([]);
  });

  it('travel: owns or occupies 3, 7, 9 or 10, once per house, for the mahadasha and the antardasha lords', () => {
    const id = 'parashari.dasha-lord-travel';
    // Jupiter owns and occupies the 9th: one firing, not two.
    expect(sentences(run(id, { maha: ['Jupiter'] }))).toEqual(['Jupiter connects to the 9th house, a house of journeys; travel or a move is a live topic in this period.']);
    // Mercury owns the 3rd and the 6th and sits in the 3rd: the 3rd once.
    expect(sentences(run(id, { maha: ['Mercury'] }))).toHaveLength(1);
    expect(run(id, { maha: ['Moon'] })).toEqual([]);
    const both = run(id, { maha: ['Moon'], antar: [['Moon', 'Saturn']] });
    expect(both).toHaveLength(1);
    expect(both[0]!.badges).not.toContain('extension (antardasha)');
    expect(both[0]!.direction).toBe('activates');
  });

  it('7th-partnership: strong, weak, neither, or of mixed strength, as the lord stands', () => {
    const id = 'parashari.dasha-lord-7th-partnership';
    const word = (p: Setup['planets']): string => sentences(run(id, { maha: ['Venus'], planets: p }))[0]!.replace(/^.*the lord is /, '');
    expect(word({})).toBe('neither strong nor weak.'); // Venus in Taurus, the 2nd, own sign, alone
    expect(word({ Venus: [8, 12] })).toBe('strong.'); // the 9th, with Jupiter
    expect(word({ Venus: [5, 27] })).toBe('weak.'); // debilitated and in the 6th
    expect(word({ Venus: [11, 27] })).toBe('of mixed strength.'); // exalted, but in the 12th
    expect(run(id, { maha: ['Moon'] })).toEqual([]);
    expect(sentences(run(id, { maha: ['Venus'] }))[0]).toMatch(/^Venus, lord of the 7th house, runs the period; the partnership topic is live/);
  });

  it('maraka: owns the 2nd or 7th; health only; the sentence says it is not a prediction', () => {
    const id = 'parashari.dasha-lord-2nd-7th-maraka';
    const s = run(id, { maha: ['Venus'] });
    expect(sentences(s, 'health')).toEqual(['Venus is a maraka planet (lord of 2) and runs the period; strain on health is flagged, not a prediction of death.', 'Venus is a maraka planet (lord of 7) and runs the period; strain on health is flagged, not a prediction of death.']);
    expect(topics(s)).toEqual(['health']);
    expect(run(id, { maha: ['Saturn'] })).toEqual([]);
  });

  it('6-8-12: an unredeemed lord reads as named; the 8th lord is a wealth caution and the others a health caution', () => {
    const id = 'parashari.dasha-lord-6-8-12-lord';
    // Aries rising: Mercury owns the 3rd and the 6th (both evil houses, so no precedence is needed).
    const s = run(id, { maha: ['Mercury'] });
    expect(sentences(s, 'health')).toEqual([`Mercury, lord of the 6th house, runs the period; Parashara reads this dasha as ${EFFECT[6]}.`]);
    expect(topics(s)).toEqual(['general', 'health']);
    // Mars owns the Lagna and the 8th: the list does not call it malefic, so it is left unsaid.
    expect(run(id, { maha: ['Mars'] })).toEqual([]);
    // Jupiter owns the 9th and the 12th and the list calls it auspicious: the 9th wins.
    expect(run(id, { maha: ['Jupiter'] })).toEqual([]);
    // Capricorn rising: the Sun owns the 8th and is exempt; Mercury owns the 6th and the 9th and the list calls it auspicious.
    expect(run(id, { lagna: 9, maha: ['Sun'] })).toEqual([]);
    // Taurus rising: Jupiter owns the 8th and the 11th (both evil), so the 8th lord's wealth caution is printed.
    const eighth = run(id, { lagna: 1, maha: ['Jupiter'] });
    expect(topics(eighth)).toEqual(['general', 'wealth']);
    expect(sentences(eighth, 'wealth')[0]).toBe(`Jupiter, lord of the 8th house, runs the period; Parashara reads this dasha as ${EFFECT[8]}.`);
  });

  it('6-8-12 redeemed: joined to a trikona lord turns it, and the unredeemed rule then stays silent', () => {
    // Mercury stands in Sagittarius with Jupiter, the 9th lord.
    const o: Setup = { maha: ['Mercury'], planets: { Mercury: [8, 15] } };
    expect(sentences(run('parashari.dasha-lord-6-8-12-redeemed', o))).toEqual(['Mercury, normally unfavourable as lord of 6, is redeemed by Jupiter; the period is read as favourable.']);
    expect(run('parashari.dasha-lord-6-8-12-lord', o)).toEqual([]);
    expect(run('parashari.dasha-lord-6-8-12-redeemed', { maha: ['Mercury'] })).toEqual([]);
    // Fully aspected (seventh) by the 5th lord: Mercury in Aquarius opposite the Sun in Leo, with a kendra lord in a trikona.
    const aspect = run('parashari.dasha-lord-6-8-12-redeemed', { maha: ['Mercury'], planets: { Mercury: [10, 15], Saturn: [4, 25], Sun: [4, 5] } });
    expect(aspect).toHaveLength(1);
  });

  it('3-11: owns the 3rd, 6th or 11th; the 11th gives no wealth signal; a lord of a good house needs the list to call it a malefic', () => {
    const id = 'parashari.dasha-lord-3-11-lord';
    const mer = run(id, { maha: ['Mercury'] });
    expect(topics(mer)).toEqual(['general', 'wealth']);
    expect(sentences(mer, 'wealth')).toEqual(['Mercury owns the 3rd house, which gives evil results in its dasha; effect is reduced when the planet is strong.', 'Mercury owns the 6th house, which gives evil results in its dasha; effect is reduced when the planet is strong.']);
    // Saturn owns the 10th and the 11th; the Aries list calls it malefic, so the 11th counts, for the general topic only.
    expect(topics(run(id, { maha: ['Saturn'] }))).toEqual(['general']);
    // Cancer rising: Jupiter owns the 6th and the 9th and the list calls it auspicious.
    expect(run(id, { lagna: 3, maha: ['Jupiter'] })).toEqual([]);
    expect(run(id, { maha: ['Moon'] })).toEqual([]);
  });
});

describe('the mahadasha placement rules', () => {
  it('placement-natal: house and dignity, read as favourable, unfavourable or mixed; the sentence carries the reading', () => {
    const id = 'parashari.dasha-lord-placement-natal';
    expect(sentences(run(id, { maha: ['Jupiter'] }), 'general')).toEqual(['Jupiter is in its moolatrikona in the 9th house; its period is read as favourable.']);
    // Saturn debilitated in Aries, which is the 1st house: a good house and a bad dignity.
    expect(sentences(run(id, { maha: ['Saturn'], planets: { Saturn: [0, 20] } }), 'general')[0]).toBe('Saturn is debilitated in the 1st house; its period is read as mixed.');
    // The 6th house and the sign of an enemy or debilitation: unfavourable.
    expect(sentences(run(id, { maha: ['Jupiter'], planets: { Jupiter: [9, 5] } }), 'general')[0]).toMatch(/debilitated in the 10th house; its period is read as mixed/);
    // Debilitated in Scorpio, which is the 8th house: both bad.
    expect(sentences(run(id, { maha: ['Moon'], planets: { Moon: [7, 10] } }), 'general')[0]).toBe('Moon is debilitated in the 8th house; its period is read as unfavourable.');
    expect(sentences(run(id, { maha: ['Sun'], planets: { Sun: [5, 5] } }))[0]).toMatch(/in the 6th house/);
    // The nodes are not assessed here.
    expect(run(id, { maha: ['Rahu'] })).toEqual([]);
  });

  it('placement-natal: the 2nd and 11th count as good houses for wealth only', () => {
    const m = (house: number, kind: string) => ({ houseOf: () => house, dignity: () => ({ kind }) }) as never;
    expect(placementVerdict(m(11, 'neutral'), 'Mars', true)).toBe('favourable');
    expect(placementVerdict(m(11, 'neutral'), 'Mars', false)).toBeNull();
    expect(placementVerdict(m(2, 'neutral'), 'Mars', true)).toBe('favourable');
    expect(placementVerdict(m(6, 'neutral'), 'Mars', true)).toBe('unfavourable');
    expect(placementVerdict(m(6, 'exalted'), 'Mars', true)).toBe('mixed');
    expect(placementVerdict(m(9, 'enemy'), 'Mars', false)).toBe('mixed');
    expect(placementVerdict(m(9, 'own sign'), 'Mars', false)).toBe('favourable');
    expect(placementVerdict(m(12, 'great enemy'), 'Mars', false)).toBe('unfavourable');
  });

  it('placement-at-start: the sign of the lord when the dasha begins, from the sky at that instant', () => {
    // At the epoch J2000 the sidereal Lahiri position of Jupiter is early Aries (tropical 25 degrees Aries less about 24 degrees of ayanamsa).
    const rule = ruleById('parashari.dasha-lord-placement-at-start')!;
    const b = BINDINGS.find((x) => x.ruleId === rule.id)!;
    const ctx = ctxOf({ maha: ['Jupiter'], lagna: 0 });
    // Move the dasha start to the J2000 instant itself.
    const moved = { ...ctx, dashas: () => ({ maha: [{ label: 'Jupiter', lord: 'Jupiter', startUtcMs: 946_728_000_000, endUtcMs: 946_728_000_000 + 3000 * DAY }], antar: [] }) } as unknown as ForecastContext;
    const s = signalsFromFirings(rule, b.fire(moved, rule), { forecastConventions: DEFAULT_FORECAST_CONVENTIONS, span: { startUtcMs: 946_728_000_000 - DAY, endUtcMs: 946_728_000_000 + 3000 * DAY } });
    expect(s).toHaveLength(1);
    // Jupiter in Aries is the Lagna for an Aries ascendant, in the sign of Mars, a friend of Jupiter.
    expect(s[0]!.sentence).toBe('At the start of the Jupiter period, Jupiter stood in the 1st house from the Lagna, in the sign of a great friend.');
    // The same sky counted from a Cancer Lagna: Aries is the 10th house.
    const lagna3 = signalsFromFirings(rule, b.fire({ ...moved, extension: () => ({ model: vedicChartModel(3, Object.entries(BASE).map(([planet, [signIndex, degree]]) => ({ planet, signIndex, degree }))) }) } as unknown as ForecastContext, rule), { forecastConventions: DEFAULT_FORECAST_CONVENTIONS, span: { startUtcMs: 946_728_000_000 - DAY, endUtcMs: 946_728_000_000 + 3000 * DAY } });
    expect(lagna3[0]!.sentence).toMatch(/stood in the 10th house from the Lagna/);
  });

  it('wealth-houses: Sun, Moon, Mars, and the nodes in the places the rule file records', () => {
    const id = 'parashari.dasha-lord-in-wealth-houses';
    const away = { Saturn: [9, 5] } as Record<string, [number, number]>; // keep Saturn from afflicting
    const sun = run(id, { maha: ['Sun'], planets: { ...away, Sun: [10, 10] } });
    expect(sentences(sun)).toEqual(['Sun, placed in the 11th house, runs the period; Parashara says a strong planet there gives gain of wealth.']);
    expect(sun[0]!.badges).toContain('school conflict');
    // Joined to Saturn, a malefic: afflicted, so nothing.
    expect(run(id, { maha: ['Sun'], planets: { Sun: [10, 10] } })).toEqual([]);
    // Moon in the 2nd with a benefic seventh aspect: Venus in Scorpio looks at Taurus.
    expect(sentences(run(id, { maha: ['Moon'], planets: { ...away, Moon: [1, 5], Venus: [7, 5] } }))[0]).toMatch(/^Moon, placed in the 2nd house/);
    expect(run(id, { maha: ['Moon'], planets: { ...away, Moon: [1, 5] } })).toEqual([]);
    // Mars strong in a kendra.
    expect(sentences(run(id, { maha: ['Mars'], planets: away }))[0]).toMatch(/^Mars, placed in the 1st house/);
    // Mars in its own sign in the 6th (Gemini rising, Mars in Scorpio): the sentence names the clause that held, not the house.
    const own = sentences(run(id, { maha: ['Mars'], lagna: 2, planets: { ...away, Mars: [7, 14] } }));
    expect(own).toEqual(['Mars, placed in the 6th house, runs the period; Parashara says a strong Mars that is in its own sign gives gain of wealth.']);
    // Rahu in the 11th is good, with no conflict note.
    const rahu = run(id, { maha: ['Rahu'], planets: { Rahu: [10, 10] } });
    expect(rahu).toHaveLength(1);
    expect(rahu[0]!.badges).not.toContain('school conflict');
    expect(run(id, { maha: ['Rahu'] })).toEqual([]);
    // Planets the rule file does not record say nothing.
    expect(run(id, { maha: ['Jupiter'] })).toEqual([]);
  });

  it('association: joined by a lord of a good house raises, by a lord of 6, 8, 12 or a malefic lowers', () => {
    const id = 'parashari.dasha-lord-association';
    const j = (extra: Record<string, [number, number]>): string[] => sentences(run(id, { maha: ['Jupiter'], planets: extra }));
    expect(j({ Venus: [8, 20] })).toEqual(['Jupiter is joined by Venus, which raises its period.']); // owns the 2nd and 7th, a natural benefic
    expect(j({ Mercury: [8, 20] })).toEqual(['Jupiter is joined by Mercury, which lowers its period.']); // owns the 6th
    expect(j({ Mars: [8, 20] })).toEqual(['Jupiter is joined by Mars, which lowers its period.']); // owns the 8th
    expect(j({ Saturn: [8, 20] })).toEqual(['Jupiter is joined by Saturn, which lowers its period.']); // owns the 10th and a malefic: the list decides
    expect(j({ Rahu: [8, 20] })).toEqual([]); // the nodes own no house and have no natural nature
    expect(j({})).toEqual([]);
  });
});

describe('the exchange, node and timing rules', () => {
  it('exchange: the Lagna lord and the 9th or 10th lord in each other\'s houses; both dashas', () => {
    const id = 'parashari.lagna-karma-lord-exchange';
    // Mars, lord of the Lagna, in Sagittarius (the 9th); Jupiter, lord of the 9th, in Aries (the Lagna).
    const nine = { planets: { Mars: [8, 5], Jupiter: [0, 5] } as Record<string, [number, number]> };
    expect(sentences(run(id, { ...nine, maha: ['Mars', 'Jupiter', 'Moon'] }), 'general')).toEqual(['The lords of the Lagna and the 9th exchange places; the dashas of both are strongly favourable.', 'The lords of the Lagna and the 9th exchange places; the dashas of both are strongly favourable.']);
    expect(topics(run(id, { ...nine, maha: ['Mars'] }))).toEqual(['general']);
    const ten = run(id, { planets: { Mars: [9, 5], Saturn: [0, 5] }, maha: ['Saturn'] });
    expect(topics(ten)).toEqual(['career', 'general']);
    expect(ten[0]!.sentence).toContain('the 10th');
    expect(run(id, { maha: ['Mars', 'Jupiter'] })).toEqual([]);
  });

  it('node-dasha: Rahu by house and company; Ketu says nothing', () => {
    const id = 'parashari.node-dasha';
    const g = (o: Setup): string[] => sentences(run(id, o), 'general');
    expect(g({ maha: ['Rahu'] })).toEqual(['Rahu runs the period from the 12th house, joined by no planet; read as unfavourable.']);
    expect(g({ maha: ['Rahu'], planets: { Rahu: [9, 10] } })).toEqual([]); // the 10th, alone: nothing stated
    expect(g({ maha: ['Rahu'], planets: { Rahu: [9, 10], Jupiter: [9, 12] } })).toEqual(['Rahu runs the period from the 10th house, joined by Jupiter; read as favourable.']);
    expect(g({ maha: ['Rahu'], planets: { Rahu: [10, 10], Saturn: [10, 12] } })[0]).toMatch(/joined by Saturn; read as mixed/); // the 11th is good, a malefic is bad
    expect(g({ maha: ['Rahu'], planets: { Rahu: [2, 10], Venus: [2, 12], Mercury: [5, 15] } })[0]).toMatch(/the 3rd house, joined by Venus; read as mixed/); // the 3rd is good for Rahu; Venus owns the 2nd and 7th, a maraka lord
    expect(g({ maha: ['Ketu'] })).toEqual([]);
  });

  it('timing: the third of the period from the natal degree; the nodes reverse', () => {
    const id = 'parashari.dasha-timing-within-period';
    const third = (p: string, deg: number): [number, number] => {
      const s = run(id, { maha: [p], planets: { [p]: [BASE[p]![0], deg] } })[0]!;
      return [(s.startUtcMs! - T0) / DAY, (s.endUtcMs! - T0) / DAY];
    };
    expect(third('Sun', 5)).toEqual([0, 1000]);
    expect(third('Sun', 15)).toEqual([1000, 2000]);
    expect(third('Sun', 25)).toEqual([2000, 3000]);
    expect(third('Rahu', 5)).toEqual([2000, 3000]);
    expect(third('Ketu', 25)).toEqual([0, 1000]);
    expect(third('Rahu', 15)).toEqual([1000, 2000]);
    const s = run(id, { maha: ['Sun'] })[0]!;
    expect(s.sentence).toBe("The effects of Sun's period fall mostly in the first third of the period.");
    expect(s.direction).toBe('activates');
  });

  it('timing: a planet retrograde at birth reverses; Mars at the J2000 epoch moved forward', () => {
    // Saturn was retrograde near the J2000 epoch (it turned direct at the end of the month) and Mars was direct.
    const id = 'parashari.dasha-timing-within-period';
    const first = (p: string): number => (run(id, { maha: [p], planets: { [p]: [BASE[p]![0], 5] } })[0]!.startUtcMs! - T0) / DAY;
    expect(first('Mars')).toBe(0);
    expect(first('Saturn')).toBe(2000);
  });
});

describe('the antardasha rules', () => {

  it('from the dasha lord: the unfavourable places are planet by planet, and a planet not recorded says nothing', () => {
    const id = 'parashari.antardasha-from-dasha-lord-dusthana';
    // Moon (Cancer) from Jupiter (Sagittarius) is the 8th place, which the Moon verses call unfavourable.
    const moon = run(id, { antar: [['Jupiter', 'Moon']] });
    expect(sentences(moon, 'wealth')).toEqual(['The Moon sub-period lies in the 8th place from Jupiter, the dasha lord: an unfavourable sub-period.']);
    expect(topics(moon)).toEqual(['general', 'health', 'wealth']);
    // Venus (Taurus) from Jupiter is the 6th place, but no verse for Venus is recorded.
    expect(run(id, { antar: [['Jupiter', 'Venus']] })).toEqual([]);
    // Mars (Aries) from Jupiter is the 5th: not in its 8, 12 set.
    expect(run(id, { antar: [['Jupiter', 'Mars']] })).toEqual([]);
    // Jupiter's own verses give 6 and 8, so Jupiter in the 6th from Venus fires but in the 12th does not.
    expect(run(id, { antar: [['Venus', 'Jupiter']], planets: { Jupiter: [6, 5] } })).toHaveLength(3);
    expect(run(id, { antar: [['Venus', 'Jupiter']], planets: { Jupiter: [0, 5] } })).toEqual([]);
    expect(Object.keys(ANTAR_DUSTHANA).sort()).toEqual(['Jupiter', 'Mars', 'Moon', 'Rahu']);
  });

  it('from the dasha lord: the favourable places are the kendras, trikonas and the 11th', () => {
    const id = 'parashari.antardasha-from-dasha-lord-kendra';
    expect(ANTAR_GOOD_PLACES).toEqual([1, 4, 5, 7, 9, 10, 11]);
    // Mars (Aries) from Jupiter (Sagittarius) is the 5th place.
    const s = run(id, { antar: [['Jupiter', 'Mars']] });
    expect(sentences(s, 'wealth')).toEqual(['The Mars sub-period lies in the 5th place from Jupiter: a favourable sub-period.']);
    expect(topics(s)).toEqual(['general', 'relationships', 'wealth']);
    expect(run(id, { antar: [['Jupiter', 'Venus']] })).toEqual([]); // the 6th place
    expect(run(id, { antar: [['Jupiter', 'Jupiter']] })).toEqual([]); // one planet in both roles
  });

  it('lord-strength: counted from the Lagna; the same-planet case only for the Sun in the Sun', () => {
    const id = 'parashari.antardasha-lord-strength';
    // The Sun at 5 degrees of Leo is in its moolatrikona, in the 5th house, alone.
    expect(sentences(run(id, { antar: [['Jupiter', 'Sun']] }), 'general')).toEqual(['Sun, in its moolatrikona in the 5th house, gives a favourable sub-period.']);
    // Debilitated in the 6th with a malefic: unfavourable.
    expect(sentences(run(id, { antar: [['Jupiter', 'Venus']], planets: { Venus: [5, 27] } }), 'general')[0]).toBe('Venus, debilitated in the 6th house, gives a difficult sub-period.');
    expect(sentences(run(id, { antar: [['Sun', 'Sun']] }), 'general')).toHaveLength(1);
    expect(run(id, { antar: [['Mars', 'Mars']] })).toEqual([]);
    expect(run(id, { antar: [['Jupiter', 'Rahu']] })).toEqual([]);
  });

  it('maraka: the Sun, Moon and Mars, whose verses are read, when they own the 2nd or 7th', () => {
    const id = 'parashari.antardasha-maraka';
    // Taurus rising: Mars owns the 7th. Cancer rising: the Sun owns the 2nd.
    expect(sentences(run(id, { lagna: 1, antar: [['Jupiter', 'Mars']] }))).toEqual(['Mars is a maraka lord; health caution in this sub-period.']);
    expect(sentences(run(id, { lagna: 3, antar: [['Jupiter', 'Sun']] }))).toEqual(['Sun is a maraka lord; health caution in this sub-period.']);
    // Venus owns the 2nd and 7th for Aries rising, but its verses are not read.
    expect(run(id, { antar: [['Jupiter', 'Venus']] })).toEqual([]);
    expect(run(id, { antar: [['Jupiter', 'Moon']] })).toEqual([]);
  });
});
