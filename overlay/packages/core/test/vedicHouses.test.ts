// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  compoundRelationship,
  debilitationOf,
  dignityOf,
  EXALTATION,
  functionalNature,
  GRAHAS,
  HOUSE_TOPICS,
  houseFrom,
  housesOwned,
  LAGNA_NATURE,
  lordOfHouse,
  MOOLATRIKONA,
  naturalNature,
  naturalRelationship,
  OWN_SIGNS,
  printableHouseTopics,
  SIGN_LORD,
  SIGN_NAMES,
  vedicChartModel,
  yogakarakas,
  yogaLinks,
  type Graha,
  type Placement,
} from '../src/systems/vedic/houses.ts';

const FILE = JSON.parse(readFileSync(new URL('../src/forecast/data/rules.vedic.json', import.meta.url), 'utf8')) as { tables: Record<string, string> };
const DIGNITY_TEXT = FILE.tables.DIGNITY!;
const NATURE_TEXT = FILE.tables.LAGNA_NATURE!;
const TOPICS_TEXT = FILE.tables.HOUSE_TOPICS!;

describe('house arithmetic', () => {
  it('counts whole-sign houses and lords', () => {
    expect(houseFrom(0, 0)).toBe(1);
    expect(houseFrom(11, 0)).toBe(12);
    expect(houseFrom(0, 11)).toBe(2);
    expect(houseFrom(2, 9)).toBe(6);
    expect(lordOfHouse(0, 10)).toBe('Saturn'); // Capricorn from Aries
    expect(lordOfHouse(9, 1)).toBe('Saturn');
    expect(housesOwned(1, 'Saturn')).toEqual([9, 10]); // Taurus rising
    expect(housesOwned(0, 'Mars')).toEqual([1, 8]);
  });
  it('gives each planet its signs and every sign one lord', () => {
    for (const p of GRAHAS) for (const s of OWN_SIGNS[p]) expect(SIGN_LORD[s]).toBe(p);
    expect(SIGN_LORD).toHaveLength(12);
    expect(GRAHAS.reduce((n, p) => n + OWN_SIGNS[p].length, 0)).toBe(12);
  });
});

describe('tables.DIGNITY', () => {
  it('has the exaltation signs and degrees the rule file states', () => {
    const stated: [Graha, string, number][] = [['Sun', 'Aries', 10], ['Moon', 'Taurus', 3], ['Mars', 'Capricorn', 28], ['Mercury', 'Virgo', 15], ['Jupiter', 'Cancer', 5], ['Venus', 'Pisces', 27], ['Saturn', 'Libra', 20]];
    for (const [p, sign, deg] of stated) {
      expect(SIGN_NAMES[EXALTATION[p].signIndex]).toBe(sign);
      expect(EXALTATION[p].degree).toBe(deg);
      expect(DIGNITY_TEXT).toContain(`${p} ${sign} ${deg}`);
    }
    expect(DIGNITY_TEXT).toContain('Debilitation the seventh sign, same degree');
    expect(SIGN_NAMES[debilitationOf('Sun').signIndex]).toBe('Libra');
    expect(SIGN_NAMES[debilitationOf('Saturn').signIndex]).toBe('Aries');
    expect(debilitationOf('Venus')).toEqual({ signIndex: 5, degree: 27 });
  });
  it('has the moolatrikona spans the rule file states', () => {
    const stated: [Graha, string, number, number][] = [['Sun', 'Leo', 0, 20], ['Moon', 'Taurus', 3, 30], ['Mars', 'Aries', 0, 12], ['Mercury', 'Virgo', 15, 20], ['Jupiter', 'Sagittarius', 0, 10], ['Venus', 'Libra', 0, 15], ['Saturn', 'Aquarius', 0, 20]];
    for (const [p, sign, from, to] of stated) {
      expect(MOOLATRIKONA[p]).toEqual({ signIndex: SIGN_NAMES.indexOf(sign as (typeof SIGN_NAMES)[number]), from, to });
      expect(DIGNITY_TEXT).toContain(`${p} ${sign} ${from}-${to}`);
    }
  });
  it('has the sign lords the rule file states', () => {
    const text = 'Aries and Scorpio Mars; Taurus and Libra Venus; Gemini and Virgo Mercury; Cancer Moon; Leo Sun; Sagittarius and Pisces Jupiter; Capricorn and Aquarius Saturn';
    expect(DIGNITY_TEXT).toContain(text);
    const built = GRAHAS.map((p) => `${OWN_SIGNS[p].map((s) => SIGN_NAMES[s]).join(' and ')} ${p}`);
    for (const part of built) expect(text).toContain(part);
  });
  it('classifies a position once, with the overlap cases of the table', () => {
    const all = (sun: [number, number], moon: [number, number], merc: [number, number], extra: Placement[] = []): Placement[] => [
      { planet: 'Sun', signIndex: sun[0], degree: sun[1] },
      { planet: 'Moon', signIndex: moon[0], degree: moon[1] },
      { planet: 'Mercury', signIndex: merc[0], degree: merc[1] },
      { planet: 'Mars', signIndex: 0, degree: 0 }, { planet: 'Jupiter', signIndex: 8, degree: 0 }, { planet: 'Venus', signIndex: 1, degree: 0 }, { planet: 'Saturn', signIndex: 10, degree: 0 },
      ...extra,
    ];
    const pos = all([0, 10], [1, 2], [5, 14]);
    expect(dignityOf('Sun', 0, 10, pos).kind).toBe('exalted');
    expect(dignityOf('Sun', 0, 10, pos).fromDeepPoint).toBe(0);
    expect(dignityOf('Sun', 6, 10, pos).kind).toBe('debilitated');
    expect(dignityOf('Sun', 4, 19.99, pos).kind).toBe('moolatrikona');
    expect(dignityOf('Sun', 4, 20, pos).kind).toBe('own sign');
    expect(dignityOf('Moon', 1, 2.99, pos).kind).toBe('exalted');
    expect(dignityOf('Moon', 1, 3, pos).kind).toBe('moolatrikona');
    expect(dignityOf('Moon', 3, 12, pos).kind).toBe('own sign');
    expect(dignityOf('Mercury', 5, 14.99, pos).kind).toBe('exalted');
    expect(dignityOf('Mercury', 5, 15, pos).kind).toBe('moolatrikona');
    expect(dignityOf('Mercury', 5, 20, pos).kind).toBe('own sign');
    expect(dignityOf('Mercury', 2, 5, pos).kind).toBe('own sign');
    expect(dignityOf('Mercury', 11, 27, pos).kind).toBe('debilitated');
    expect(dignityOf('Mars', 0, 12, pos).kind).toBe('own sign');
    expect(dignityOf('Mars', 9, 28, pos).kind).toBe('exalted');
    expect(dignityOf('Saturn', 10, 20, pos).kind).toBe('own sign');
    expect(dignityOf('Jupiter', 8, 9.9, pos).kind).toBe('moolatrikona');
    expect(dignityOf('Venus', 6, 14.9, pos).kind).toBe('moolatrikona');
    expect(dignityOf('Venus', 1, 29, pos).kind).toBe('own sign');
  });
  it('derives the natural friendships of the source count and agrees with the matrix usually tabulated', () => {
    // Written out once, as the long-standing tabulation; the derivation above must reproduce it.
    const friends: Record<Graha, Graha[]> = {
      Sun: ['Moon', 'Mars', 'Jupiter'], Moon: ['Sun', 'Mercury'], Mars: ['Sun', 'Moon', 'Jupiter'], Mercury: ['Sun', 'Venus'],
      Jupiter: ['Sun', 'Moon', 'Mars'], Venus: ['Mercury', 'Saturn'], Saturn: ['Mercury', 'Venus'],
    };
    const enemies: Record<Graha, Graha[]> = {
      Sun: ['Venus', 'Saturn'], Moon: [], Mars: ['Mercury'], Mercury: ['Moon'], Jupiter: ['Mercury', 'Venus'], Venus: ['Sun', 'Moon'], Saturn: ['Sun', 'Moon', 'Mars'],
    };
    for (const x of GRAHAS) {
      for (const y of GRAHAS) {
        if (x === y) continue;
        const want = friends[x].includes(y) ? 'friend' : enemies[x].includes(y) ? 'enemy' : 'neutral';
        expect(naturalRelationship(x, y), `${x} to ${y}`).toBe(want);
      }
    }
  });
  it('combines natural and temporary friendship as sl.57-58 state', () => {
    expect(compoundRelationship('friend', true)).toBe('great friend');
    expect(compoundRelationship('neutral', true)).toBe('friend');
    expect(compoundRelationship('enemy', true)).toBe('neutral');
    expect(compoundRelationship('friend', false)).toBe('neutral');
    expect(compoundRelationship('neutral', false)).toBe('enemy');
    expect(compoundRelationship('enemy', false)).toBe('great enemy');
  });
  it('names a relationship when the sign belongs to another planet', () => {
    // Sun in Cancer (Moon's sign): Moon is a natural friend; Moon is in the 12th from the Sun's sign, a temporary friend.
    const pos: Placement[] = [
      { planet: 'Sun', signIndex: 3, degree: 5 }, { planet: 'Moon', signIndex: 3, degree: 8 }, { planet: 'Mars', signIndex: 0, degree: 0 },
      { planet: 'Mercury', signIndex: 2, degree: 0 }, { planet: 'Jupiter', signIndex: 8, degree: 0 }, { planet: 'Venus', signIndex: 1, degree: 0 }, { planet: 'Saturn', signIndex: 10, degree: 0 },
    ];
    expect(dignityOf('Sun', 3, 5, pos)).toMatchObject({ kind: 'neutral', relationship: 'neutral' }); // Moon in the same sign: not a temporary friend
    const pos2 = pos.map((p) => (p.planet === 'Moon' ? { ...p, signIndex: 2 } : p)); // Moon in Gemini, 12th from Cancer
    expect(dignityOf('Sun', 3, 5, pos2).kind).toBe('great friend');
  });
});

describe('tables.LAGNA_NATURE', () => {
  const stated: [string, string[], string[]][] = [
    ['Aries', ['Jupiter', 'Sun'], ['Saturn', 'Mercury', 'Venus']],
    ['Taurus', ['Saturn', 'Sun'], ['Jupiter', 'Venus', 'Moon']],
    ['Gemini', ['Venus'], ['Mars', 'Jupiter', 'Sun']],
    ['Cancer', ['Mars', 'Jupiter', 'Moon'], ['Venus', 'Mercury']],
    ['Leo', ['Mars', 'Jupiter', 'Sun'], ['Mercury', 'Venus', 'Saturn']],
    ['Virgo', ['Mercury', 'Venus'], ['Mars', 'Jupiter', 'Moon']],
    ['Libra', ['Saturn', 'Mercury'], ['Jupiter', 'Sun', 'Mars']],
    ['Scorpio', ['Jupiter', 'Moon'], ['Venus', 'Mercury', 'Saturn']],
    ['Sagittarius', ['Mars', 'Sun'], ['Venus']],
    ['Capricorn', ['Venus', 'Mercury'], ['Mars', 'Jupiter', 'Moon']],
    ['Aquarius', ['Venus', 'Saturn'], ['Jupiter', 'Moon', 'Mars']],
    ['Pisces', ['Mars', 'Moon'], ['Saturn', 'Venus', 'Sun', 'Mercury']],
  ];
  it('matches the per-Lagna lists the rule file states, sign by sign', () => {
    const body = NATURE_TEXT.slice(NATURE_TEXT.indexOf('): ') + 3);
    const starts = SIGN_NAMES.map((n, i) => (i === 0 ? body.indexOf('Aries ') : 0));
    let cursor = 0;
    for (let i = 0; i < 12; i++) {
      starts[i] = body.indexOf(`${SIGN_NAMES[i]} `, cursor);
      cursor = starts[i]! + 1;
    }
    const sections = starts.map((st, i) => body.slice(st, i === 11 ? undefined : starts[i + 1]));
    expect(stated).toHaveLength(12);
    stated.forEach(([sign, good, bad], i) => {
      expect(SIGN_NAMES[i]).toBe(sign);
      expect([...LAGNA_NATURE[i]!.auspicious].sort()).toEqual([...good].sort());
      expect([...LAGNA_NATURE[i]!.malefic].sort()).toEqual([...bad].sort());
      const segment = sections[i]!;
      expect(segment, sign).toMatch(new RegExp(`malefic ${bad.join(', ')}(?: only)?[;.]`));
      const aus = segment.slice(segment.indexOf('auspicious'));
      for (const g of good) expect(aus, `${sign} ${g}`).toContain(g);
    });
  });
  it('keeps the yoga notes as the table words them', () => {
    expect(NATURE_TEXT).toContain('Saturn (yogakaraka)');
    expect(NATURE_TEXT).toContain('Mars (yogakaraka)');
    expect(NATURE_TEXT).toContain('Sun and Moon yogakarakas');
    expect(NATURE_TEXT).toContain('Venus+Mercury yoga');
    expect(NATURE_TEXT).toContain('Moon+Mercury raja yoga');
    expect(NATURE_TEXT).toContain('Venus (superior yoga)');
    expect(NATURE_TEXT).toContain('Venus the only raja-yoga planet');
  });
  it('is silent, not neutral, for the planets it does not name, and for the nodes', () => {
    expect(functionalNature(0, 'Mars')).toBe('unstated');
    expect(functionalNature(0, 'Moon')).toBe('unstated');
    expect(functionalNature(0, 'Rahu')).toBe('unstated');
    expect(functionalNature(1, 'Venus')).toBe('malefic'); // as printed, though Venus rules Taurus
    expect(functionalNature(1, 'Saturn')).toBe('benefic');
  });
  it('names the yogakaraka as a planet owning a kendra and a trikona', () => {
    expect(yogakarakas(1)).toEqual(['Saturn']); // Taurus: 9 and 10
    expect(yogakarakas(3)).toEqual(['Mars']); // Cancer: 5 and 10
    expect(yogakarakas(9)).toEqual(['Venus']); // Capricorn: 5 and 10
    expect(yogakarakas(7)).toEqual([]); // Scorpio: the table's yogakarakas are the Sun and Moon, singly kendra or trikona lords
    expect(yogakarakas(0)).toEqual([]);
  });
});

describe('natural nature', () => {
  const base = (moon: number, extra: Placement[] = []): Placement[] => [
    { planet: 'Sun', signIndex: 0, degree: 0 }, { planet: 'Moon', signIndex: moon, degree: 0 }, { planet: 'Mercury', signIndex: 5, degree: 0 }, ...extra,
  ];
  it('follows Ch.34 sl.8-10', () => {
    expect(naturalNature('Jupiter', base(1))).toBe('benefic');
    expect(naturalNature('Venus', base(1))).toBe('benefic');
    for (const p of ['Sun', 'Mars', 'Saturn']) expect(naturalNature(p, base(1))).toBe('malefic');
    expect(naturalNature('Moon', base(3))).toBe('benefic'); // 90 degrees ahead of the Sun
    expect(naturalNature('Moon', base(9))).toBe('malefic'); // 270 degrees ahead: waning
    expect(naturalNature('Rahu', base(1))).toBe('unstated');
  });
  it('makes Mercury benefic only with benefics', () => {
    expect(naturalNature('Mercury', base(1, [{ planet: 'Jupiter', signIndex: 5, degree: 3 }]))).toBe('benefic');
    expect(naturalNature('Mercury', base(1, [{ planet: 'Saturn', signIndex: 5, degree: 3 }]))).toBe('unstated');
    expect(naturalNature('Mercury', base(1))).toBe('unstated');
  });
});

describe('tables.HOUSE_TOPICS', () => {
  it('has each house as the rule file lists it', () => {
    expect(HOUSE_TOPICS).toHaveLength(12);
    const rebuilt = HOUSE_TOPICS.map((t, i) => `${i + 1} ${t.join(', ')}`).join('; ');
    expect(TOPICS_TEXT.startsWith(`BPHS Ch.11 sl.2-13, whole-sign houses from the sidereal Lagna: ${rebuilt}.`)).toBe(true);
  });
  it('does not print the entries that name death', () => {
    for (let h = 1; h <= 12; h++) expect(printableHouseTopics(h).join(' ')).not.toMatch(/death|dead/);
    expect(printableHouseTopics(2)).toEqual(['wealth', 'grain', 'family', 'metals', 'gems', 'enemies']);
    expect(printableHouseTopics(12)).toEqual(['expenses', 'history of enemies']);
    expect(printableHouseTopics(10)).toEqual([...HOUSE_TOPICS[9]!]);
  });
});

describe('kendra-trikona links', () => {
  // Taurus rising: Saturn owns 9 and 10; Mercury 2 and 5; Mars 7 and 12; Sun 4; Moon 3; Jupiter 8 and 11; Venus 1 and 6.
  const placed = (map: Record<string, number>): Placement[] => Object.entries(map).map(([planet, signIndex]) => ({ planet, signIndex, degree: 10 }));
  it('finds each of the four ways to link and cancels by an evil house', () => {
    // Sun (4th lord) and Mercury (5th lord): Sun in Leo is house 4 from Taurus, Mercury in Gemini is house 2.
    const sunMercuryConjunct = placed({ Sun: 4, Mercury: 4, Moon: 0, Mars: 6, Jupiter: 8, Venus: 1, Saturn: 9 });
    const links = yogaLinks(1, sunMercuryConjunct);
    const l = links.find((x) => x.kendraLord === 'Sun' && x.trikonaLord === 'Mercury')!;
    expect(l.via).toContain('conjunction in a kendra or trikona');
    expect(l.cancelled).toBe(false); // Sun owns only the 4th; Mercury 2 and 5, neither evil
    // Mars (7th and 12th) with Saturn (9th): Mars owns the 12th, an evil house, and the Taurus list calls Mars unstated.
    const marsSaturn = placed({ Sun: 0, Mercury: 0, Moon: 0, Mars: 9, Jupiter: 8, Venus: 1, Saturn: 9 });
    const m = yogaLinks(1, marsSaturn).find((x) => x.kendraLord === 'Mars' && x.trikonaLord === 'Saturn')!;
    expect(m.evilHouses).toEqual([12]);
    expect(m.cancelled).toBe(true);
    // The Taurus list calls Saturn benefic: Saturn (9th, 10th) with a kendra lord who owns no evil house is not cancelled.
    const sunSaturn = yogaLinks(1, placed({ Sun: 9, Mercury: 0, Moon: 0, Mars: 6, Jupiter: 8, Venus: 1, Saturn: 9 })).find((x) => x.kendraLord === 'Sun' && x.trikonaLord === 'Saturn')!;
    expect(sunSaturn.via).toContain('conjunction in a kendra or trikona');
    expect(sunSaturn.cancelled).toBe(false);
  });
  it('detects exchange and the full seventh aspect, and never pairs a planet with itself', () => {
    // Capricorn rising: Mars owns 4 and 11, Moon 7, Venus 5 and 10, Mercury 6 and 9.
    const chart = (moon: number, mercury: number): Placement[] => [
      { planet: 'Saturn', signIndex: 1, degree: 1 }, { planet: 'Venus', signIndex: 10, degree: 1 }, { planet: 'Sun', signIndex: 0, degree: 1 }, { planet: 'Moon', signIndex: moon, degree: 1 },
      { planet: 'Mars', signIndex: 3, degree: 1 }, { planet: 'Mercury', signIndex: mercury, degree: 1 }, { planet: 'Jupiter', signIndex: 8, degree: 1 },
    ];
    const pair = (ps: Placement[]) => yogaLinks(9, ps).find((x) => x.kendraLord === 'Moon' && x.trikonaLord === 'Mercury');
    expect(yogaLinks(9, chart(5, 3)).every((x) => x.kendraLord !== x.trikonaLord)).toBe(true);
    const swap = pair(chart(5, 3)); // Moon in Virgo, Mercury in Cancer
    expect(swap?.via).toContain('exchange of signs');
    expect(swap?.cancelled).toBe(false); // Mercury owns the 6th but the Capricorn list calls it auspicious
    expect(pair(chart(11, 5))?.via).toContain('full seventh aspect'); // Pisces and Virgo are opposite
    expect(pair(chart(2, 5))?.via ?? []).not.toContain('exchange of signs');
  });
});

describe('the chart model', () => {
  const placements: Placement[] = [
    { planet: 'Sun', signIndex: 4, degree: 5 }, { planet: 'Moon', signIndex: 7, degree: 12 }, { planet: 'Mars', signIndex: 0, degree: 1 }, { planet: 'Mercury', signIndex: 5, degree: 17 },
    { planet: 'Jupiter', signIndex: 8, degree: 3 }, { planet: 'Venus', signIndex: 6, degree: 20 }, { planet: 'Saturn', signIndex: 9, degree: 28 }, { planet: 'Rahu', signIndex: 1, degree: 5 }, { planet: 'Ketu', signIndex: 7, degree: 5 },
  ];
  const m = vedicChartModel(3, placements); // Cancer rising
  it('counts houses from the rising sign and from the natal Moon', () => {
    expect(m.houseOf('Sun')).toBe(2);
    expect(m.houseOf('Ketu')).toBe(5);
    expect(m.moonSign).toBe(7);
    expect(m.houseFromMoon('Moon')).toBe(1);
    expect(m.houseFromMoon('Jupiter')).toBe(2);
    expect(m.houseFromMoon('Mars')).toBe(6);
    expect(m.signHouseFromMoon(6)).toBe(12);
    expect(m.lordOf(1)).toBe('Moon');
  });
  it('computes dignity once per planet and reuses it', () => {
    expect(m.dignity('Sun')).toBe(m.dignity('Sun'));
    expect(m.dignity('Sun').kind).toBe('moolatrikona');
    expect(m.dignity('Moon').kind).toBe('debilitated');
    expect(m.dignity('Moon').fromDeepPoint).toBe(9);
    expect(m.dignity('Mars').kind).toBe('moolatrikona');
    expect(m.dignity('Saturn').kind).toBe('own sign');
  });
  it('throws on a missing placement', () => {
    expect(() => vedicChartModel(0, placements.slice(2)).houseFromMoon('Sun')).toThrow();
  });
});
