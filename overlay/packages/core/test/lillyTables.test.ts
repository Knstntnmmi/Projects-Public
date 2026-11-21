// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import { RULE_FILES } from '../src/forecast/index.ts';
import { ASPECT_ANGLES, aspectBetween, isApplying, isPartile, moiety, MAX_ELONGATION, ORB_COLUMNS, separation, SUN_PROXIMITY } from '../src/systems/western/aspects.ts';
import { SIGNS } from '../src/systems/western/dignities.ts';
import {
  ESSENTIAL_SCORES,
  essentialItems,
  essentialScore,
  faceLord,
  holdsDignity,
  LILLY_TABLE_A,
  mutualReception,
  rowAt,
  strengthClass,
  termLord,
  triplicityLord,
} from '../src/systems/western/lillyDignity.ts';
import { accidentalItems, accidentalScore, HOUSE_FORTITUDE, isOriental, moonIncreasing, type BodyState, type FortitudeChart } from '../src/systems/western/lillyFortitude.ts';
import type { Planet } from '../src/substrate/sky.ts';

const tables = RULE_FILES.find((f) => f.tradition === 'western')!.tables as Record<string, unknown>;
const A = tables.A_essentialDignities as { rows: string[]; scores: string; triplicity: string; exaltationDegrees: string };
const B = tables.B_accidentalFortitudes as string;
const C = tables.C_aspectsOrbs as string;

const body = (s: string): string => (s.startsWith("Dragon's Head") ? 'Head' : s.startsWith("Dragon's Tail") ? 'Tail' : s.trim());

describe('Lilly table A: every cell against the verified file', () => {
  it('has the twelve signs in order', () => {
    expect(A.rows).toHaveLength(12);
    expect(LILLY_TABLE_A.map((r) => r.sign)).toEqual([...SIGNS]);
  });

  A.rows.forEach((line, i) => {
    const cells = line.split('|').map((c) => c.trim());
    const [sign, house, exalt, trip, terms, faces, det, fall] = cells as [string, string, string, string, string, string, string, string];
    const row = LILLY_TABLE_A[i]!;
    describe(sign, () => {
      it('house lord and its diurnal or nocturnal mark', () => {
        expect(row.sign).toBe(sign);
        const m = /^(\w+)(?: \((D|N)\))?$/.exec(house)!;
        expect(row.house).toBe(m[1]);
        expect(row.houseSect).toBe(m[2] ?? null);
      });
      it('exaltation and its degree', () => {
        if (exalt === 'none') expect(row.exaltation).toBeNull();
        else {
          const m = /^(Dragon's Head|Dragon's Tail|\w+) (\d+)$/.exec(exalt)!;
          expect(row.exaltation).toEqual({ body: body(m[1]!), degree: Number(m[2]) });
        }
      });
      it('triplicity rulers by day and by night', () => {
        expect([...row.triplicity]).toEqual(trip.split('/').map((s) => s.trim()));
      });
      it('the five terms with their end degrees', () => {
        const want = terms.split(',').map((t) => {
          const [p, e] = t.trim().split(' ');
          return [p, Number(e)];
        });
        expect(row.terms.map(([p, e]) => [p, e])).toEqual(want);
        expect(row.terms[4]![1]).toBe(30);
      });
      it('the three faces', () => {
        expect([...row.faces]).toEqual(faces.split(',').map((s) => s.trim()));
      });
      it('detriment and fall', () => {
        expect(row.detriment).toBe(det.replace('det ', ''));
        const f = fall.replace('fall ', '');
        expect(row.fall).toBe(f === 'none' ? null : body(f));
      });
    });
  });

  it('terms and faces are looked up by degree exactly as the table runs, at each edge', () => {
    for (const [i, row] of LILLY_TABLE_A.entries()) {
      let start = 0;
      for (const [lord, end] of row.terms) {
        expect(termLord(i * 30 + start), `${row.sign} ${start}`).toBe(lord);
        expect(termLord(i * 30 + end - 0.0001), `${row.sign} ${end}-`).toBe(lord);
        start = end;
      }
      for (let k = 0; k < 3; k++) {
        expect(faceLord(i * 30 + k * 10)).toBe(row.faces[k]);
        expect(faceLord(i * 30 + k * 10 + 9.999)).toBe(row.faces[k]);
      }
    }
  });

  it('the triplicity rulers match the text of the table, element by element', () => {
    expect(A.triplicity).toContain('Fire: Sun by day, Jupiter by night');
    expect(A.triplicity).toContain('Earth: Venus by day, Moon by night');
    expect(A.triplicity).toContain('Air: Saturn by day, Mercury by night');
    expect(A.triplicity).toContain('Water: Mars by day and night');
    const by: Record<string, [string, string]> = { Fire: ['Sun', 'Jupiter'], Earth: ['Venus', 'Moon'], Air: ['Saturn', 'Mercury'], Water: ['Mars', 'Mars'] };
    const element = ['Fire', 'Earth', 'Air', 'Water'];
    for (let i = 0; i < 12; i++) expect([...LILLY_TABLE_A[i]!.triplicity]).toEqual(by[element[i % 4]!]);
  });

  it('the exaltation degrees match the text of the table', () => {
    const m = [...A.exaltationDegrees.matchAll(/(Sun|Moon|Jupiter|Mercury|Saturn|Mars|Venus|Dragon's Head|Dragon's Tail) (\d+) (\w+)/g)];
    expect(m).toHaveLength(9);
    for (const [, who, deg, sign] of m) {
      const row = LILLY_TABLE_A[SIGNS.indexOf(sign as (typeof SIGNS)[number])]!;
      expect(row.exaltation, `${who} in ${sign}`).toEqual({ body: body(who!), degree: Number(deg) });
    }
  });

  it('the scores are the ones the table states', () => {
    expect(A.scores).toMatch(/own house \+5/);
    expect(A.scores).toMatch(/exaltation \+4/);
    expect(A.scores).toMatch(/triplicity \+3/);
    expect(A.scores).toMatch(/term \+2/);
    expect(A.scores).toMatch(/face \+1/);
    expect(A.scores).toMatch(/detriment -5; fall -4; peregrine -5/);
    expect(ESSENTIAL_SCORES).toEqual({ house: 5, exaltation: 4, triplicity: 3, term: 2, face: 1, detriment: -5, fall: -4, peregrine: -5 });
  });
});

describe('essential score E, worked by hand from the table', () => {
  it('a planet in its own house, sect triplicity and nothing else', () => {
    // Sun 5 Leo: house +5; fire triplicity is the Sun's by day, Jupiter's by night; the term (Saturn) and face (Saturn) are not his.
    expect(essentialItems('Sun', 125, true).map((i) => i.kind)).toEqual(['house', 'triplicity']);
    expect(essentialScore('Sun', 125, true)).toBe(8);
    expect(essentialScore('Sun', 125, false)).toBe(5);
  });
  it('exaltation, triplicity by night, term and face are all counted', () => {
    // Moon 3 Taurus: exaltation +4; earth triplicity is the Moon's by night (+3); term Venus, face Mercury.
    expect(essentialScore('Moon', 33, false)).toBe(7);
    expect(essentialScore('Moon', 33, true)).toBe(4);
  });
  it('a term runs up to but not including its end degree (the p.105 worked words)', () => {
    // Aries: Jupiter 6, Venus 14. Jupiter 5.99 is in his own term, 6.0 is Venus's.
    expect(termLord(5.99)).toBe('Jupiter');
    expect(termLord(6)).toBe('Venus');
    // Jupiter in 13 Pisces is in his own term and 14 Pisces is Mercury's (Venus 8, Jupiter 14, Mercury 20).
    expect(essentialItems('Jupiter', 343.5, true).map((i) => i.kind)).toEqual(['house', 'term', 'face']);
    expect(essentialItems('Jupiter', 344, true).map((i) => i.kind)).toEqual(['house', 'face']);
  });
  it('a fall and a triplicity add up: Mars in 15 Cancer', () => {
    // Fall -4, water triplicity (Mars by day and by night) +3, term Mercury, face Mercury.
    expect(essentialItems('Mars', 105, true).map((i) => i.kind)).toEqual(['triplicity', 'fall']);
    expect(essentialScore('Mars', 105, true)).toBe(-1);
    expect(essentialScore('Mars', 105, false)).toBe(-1);
  });
  it('a planet in its detriment with no dignity is peregrine as well', () => {
    // Saturn in 10 Cancer: detriment -5, and no house, exaltation, triplicity, term or face: peregrine -5.
    expect(essentialItems('Saturn', 100, true).map((i) => i.kind)).toEqual(['detriment', 'peregrine']);
    expect(essentialScore('Saturn', 100, true)).toBe(-10);
  });
  it('a planet in its own face or term is not peregrine (p.103)', () => {
    // Venus in 15 Virgo by night: fall -4, but the face (10 to 20) is Venus's: +1.
    expect(essentialItems('Venus', 165, false).map((i) => i.kind)).toEqual(['face', 'fall']);
    expect(essentialScore('Venus', 165, false)).toBe(-3);
  });
  it('the node cells of the table never score a planet', () => {
    // The Head is exalted in Gemini and the Tail in Sagittarius: no planet holds these.
    for (const p of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const) {
      expect(essentialItems(p, 63, true).some((i) => i.kind === 'exaltation')).toBe(false);
    }
  });
  it('the triplicity lord is the sect lord', () => {
    expect(triplicityLord(5, true)).toBe('Sun');
    expect(triplicityLord(5, false)).toBe('Jupiter');
    expect(triplicityLord(215, true)).toBe('Mars');
    expect(triplicityLord(215, false)).toBe('Mars');
    expect(rowAt(365)).toBe(LILLY_TABLE_A[0]);
  });
  it('classes on E alone', () => {
    expect([8, 3, 2, 1, 0, -1, -10].map(strengthClass)).toEqual(['strong', 'strong', 'moderate', 'moderate', 'unclassed', 'weak', 'weak']);
  });
  it('dignity of a planet is any of the five, and reception is by house or by exaltation', () => {
    expect(holdsDignity('Venus', 35, true)).toBe(true);
    expect(holdsDignity('Venus', 5, true)).toBe(false);
    // Mars in Libra and Venus in Aries: each in the other's house.
    expect(mutualReception('Mars', 185, 'Venus', 5)).toBe('house');
    // Sun in Libra is in its fall, Saturn in Aries too, but the Sun is not in a sign Saturn is exalted in: Libra is Saturn's exaltation.
    expect(mutualReception('Sun', 185, 'Saturn', 5)).toBe('exaltation'); // Sun in Libra (Saturn exalted), Saturn in Aries (Sun exalted)
    expect(mutualReception('Mars', 185, 'Venus', 185)).toBeNull();
    expect(mutualReception('Mars', 5, 'Mars', 5)).toBeNull();
  });
});

describe('Lilly table C: orbs, moieties, platick and partile', () => {
  const grab = (text: string, from: string, to: string): string => text.slice(text.indexOf(from), text.indexOf(to));
  const nums = (s: string): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const m of s.matchAll(/(Saturn|Jupiter|Mars|Sun|Venus|Mercury|Moon) (\d+)(?: deg (\d+)')?/g)) out[m[1]!] = Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0);
    return out;
  };
  it('both columns of the orbs are the ones the file states', () => {
    const first = nums(grab(C, 'Orbs of rays (first column', 'Second column'));
    const second = nums(grab(C, 'Second column', 'Platick when'));
    expect(first).toEqual(ORB_COLUMNS.first);
    expect(second).toEqual(ORB_COLUMNS.second);
  });
  it('lists the five aspects at their angles', () => {
    expect(ASPECT_ANGLES.map((a) => a.angle)).toEqual([0, 60, 90, 120, 180]);
    expect(C).toContain('conjunction 0, sextile 60, square 90, trine 120, opposition 180');
  });
  it("Lilly's own example: Venus 10 Taurus and Saturn 18 Virgo, moieties 4 and 5, distance 8", () => {
    expect(moiety('Venus')).toBe(4);
    expect(moiety('Saturn')).toBe(5);
    const a = aspectBetween('Venus', 40, 'Saturn', 168)!;
    expect(a.aspect).toBe('trine');
    expect(a.distance).toBe(8);
    expect(a.allowed).toBe(9);
    expect(a.platick).toBe(true);
    expect(a.partile).toBe(false);
    // One degree further and the aspect no longer holds.
    expect(aspectBetween('Venus', 40, 'Saturn', 169.5)).toBeNull();
  });
  it('the second column gives smaller orbs where the file says so', () => {
    expect(moiety('Saturn', 'second')).toBe(4.5);
    expect(aspectBetween('Saturn', 0, 'Jupiter', 10.4, 'second')).toBeNull();
    expect(aspectBetween('Saturn', 0, 'Jupiter', 10.4, 'first')).not.toBeNull();
  });
  it('partile is the same degree of signs that stand in the aspect', () => {
    expect(isPartile(10.2, 10.9, 0)).toBe(true);
    expect(isPartile(10.2, 11.1, 0)).toBe(false);
    expect(isPartile(10.2, 70.9, 60)).toBe(true); // 10 Aries and 10 Gemini: sextile
    expect(isPartile(10.2, 70.9, 90)).toBe(false);
    expect(isPartile(10.2, 190.5, 180)).toBe(true);
    expect(isPartile(10.2, 130.9, 120)).toBe(true);
    expect(isPartile(10.2, 100.9, 90)).toBe(true);
    // Across a sign boundary the degree matches but the signs do not.
    expect(isPartile(29.5, 30.5, 0)).toBe(false);
  });
  it('separation is the shorter way round, and applying follows the daily motions', () => {
    expect(separation(350, 10)).toBe(20);
    // Fast planet behind a slow one closes on the conjunction; once past it, it separates.
    expect(isApplying(0, 1, 5, 0.1, 0)).toBe(true);
    expect(isApplying(6, 1, 5, 0.1, 0)).toBe(false);
    // Opposition: 178 apart and widening toward 180 is applying.
    expect(isApplying(183, 0.8, 5, 0.5, 180)).toBe(true);
    expect(isApplying(187, 0.8, 5, 0.5, 180)).toBe(false);
  });
  it('combustion, beams, cazimi and the elongation limits are the ones in the file', () => {
    expect(B).toContain("combust within 8 deg 30' of the Sun in the same sign");
    expect(B).toContain('under the beams to 17 degrees');
    expect(B).toContain('cazimi within 17 minutes');
    expect(SUN_PROXIMITY).toEqual({ combust: 8.5, beams: 17, cazimi: 17 / 60 });
    expect(MAX_ELONGATION).toEqual({ Mercury: 28, Venus: 48 });
    expect(tables.C_aspectsOrbs).toBeDefined();
    const rule = RULE_FILES.find((f) => f.tradition === 'western')!.rules.find((r) => r.id === 'lilly.aspects.orbs-table')!;
    expect(rule.condition).toContain('Mercury never more than 28 and Venus never more than 48');
  });
});

// Lilly table B on a chart built directly from longitudes. Aries rises, so house n is sign n.
const chartOf = (lon: Partial<Record<Planet, number>>, o: { retro?: Planet[]; isDay?: boolean; head?: number } = {}): FortitudeChart => {
  const full: Record<Planet, number> = { Sun: 130, Moon: 100, Mercury: 150, Venus: 190, Mars: 300, Jupiter: 100, Saturn: 280, ...lon };
  const bodies: BodyState[] = (Object.keys(full) as Planet[]).map((planet) => ({ planet, longitude: full[planet], retrograde: o.retro?.includes(planet) ?? false, house: Math.floor(full[planet] / 30) + 1 }));
  return { isDay: o.isDay ?? false, bodies, head: o.head ?? 0 };
};
const labels = (p: Planet, c: FortitudeChart): string[] => accidentalItems(p, c).map((i) => `${i.label}:${i.score}`);

describe('Lilly table B: accidental fortitudes and debilities', () => {
  it('the house scores are the ones the file states', () => {
    expect(B).toContain('in the Midheaven or Ascendant +5; 7th, 4th, 11th +4; 2nd, 5th +3; 9th +2; 3rd +1');
    expect(B).toContain('12th house -5; 8th and 6th -2');
    expect(HOUSE_FORTITUDE).toEqual({ 1: 5, 10: 5, 7: 4, 4: 4, 11: 4, 2: 3, 5: 3, 9: 2, 3: 1, 12: -5, 8: -2, 6: -2 });
  });
  it('direct and retrograde, void for the Lights', () => {
    const c = chartOf({ Jupiter: 100, Mars: 300 }, { retro: ['Mars'] });
    expect(labels('Jupiter', c)).toContain('direct:4');
    expect(labels('Mars', c)).toContain('retrograde:-5');
    expect(labels('Sun', c).some((l) => l.startsWith('direct') || l.startsWith('retrograde'))).toBe(false);
    expect(labels('Moon', c).some((l) => l.startsWith('direct') || l.startsWith('retrograde'))).toBe(false);
  });
  it('orientality: superior planets oriental +2, inferior occidental +2, the Moon by her light', () => {
    // Sun at 130. Saturn at 100 is behind the Sun (oriental); Venus at 190 is ahead (occidental).
    const c = chartOf({ Saturn: 100, Venus: 190, Moon: 100 });
    expect(labels('Saturn', c)).toContain('oriental of the Sun:2');
    expect(labels('Venus', c)).toContain('occidental of the Sun:2');
    expect(labels('Moon', c)).toContain('Moon decreasing in light:-2');
    expect(labels('Moon', chartOf({ Moon: 160 }))).toContain('Moon increasing in light:2');
    expect(labels('Mercury', chartOf({ Mercury: 100 }))).toContain('oriental of the Sun:-2');
    expect(labels('Jupiter', chartOf({ Jupiter: 200 }))).toContain('occidental of the Sun:-2');
    expect(isOriental('Sun', 130, 130)).toBeNull();
    expect(moonIncreasing(160, 130)).toBe(true);
  });
  it('cazimi, combust, under the beams and free: the four states against the Sun', () => {
    const at = (p: Planet, l: number): string[] => labels(p, chartOf({ [p]: l }));
    expect(at('Mercury', 130.2)).toContain('cazimi:5');
    expect(at('Mercury', 135)).toContain('combust:-5');
    // Within 17 degrees but in another sign: under the beams, not combust.
    expect(at('Mercury', 119)).toContain('under the beams:-4'); // the Sun is at 10 Leo (130); 119 is 29 Cancer, 11 away
    expect(at('Mercury', 140)).toContain('under the beams:-4'); // 10 degrees away in the same sign: past 8 30 and within 17
    expect(at('Mercury', 138.5)).toContain('combust:-5'); // exactly 8 30 away in the same sign
    expect(at('Mercury', 147.5)).toContain('free from combustion and beams:5'); // 17 30 away
    expect(at('Mercury', 130.2).some((l) => l.startsWith('combust') || l.startsWith('free'))).toBe(false); // cazimi is none of these
  });
  it('partile aspects to the fortunes, the infortunes and the nodes', () => {
    // Moon at 10 Cancer (100): Jupiter also at 10 Cancer is a partile conjunction (+5) and Saturn at 10 Libra a partile opposition... Libra is 190.
    const c = chartOf({ Moon: 100.3, Jupiter: 100.6, Saturn: 190.2, Mars: 220.4, Venus: 340.1 });
    const l = labels('Moon', c);
    expect(l).toContain('partile conjunction with Jupiter:5');
    expect(l).toContain('partile square with Saturn:-3'); // Saturn is 10 Libra, Moon 10 Cancer: signs 3 apart
    expect(l).not.toContain('partile opposition with Saturn:-4');
    const mars = labels('Mars', c);
    expect(mars).toContain('partile trine with Jupiter:4'); // Mars 10 Scorpio, Jupiter 10 Cancer: 4 signs
    // Sextile to Venus: Venus 10 Pisces (340), Moon 10 Cancer (100)? 4 signs, trine +4.
    expect(l).toContain('partile trine with Venus:4');
    // Nodes: Head at 10 Cancer.
    expect(labels('Moon', chartOf({ Moon: 100.3 }, { head: 100.9 }))).toContain("partile conjunction with the Dragon's Head:4");
    expect(labels('Moon', chartOf({ Moon: 100.3 }, { head: 280.9 }))).toContain("partile conjunction with the Dragon's Tail:-4");
  });
  it('besieged between Saturn and Mars', () => {
    // Venus at 190 with Saturn at 188 behind and Mars at 192 ahead and nobody else between.
    const c = chartOf({ Venus: 190, Saturn: 188, Mars: 192, Jupiter: 10, Moon: 20, Sun: 30, Mercury: 40 });
    expect(labels('Venus', c)).toContain('besieged by Saturn and Mars:-5');
    // A planet between breaks the siege.
    expect(labels('Venus', chartOf({ Venus: 190, Saturn: 188, Mars: 192, Jupiter: 191, Moon: 20, Sun: 30, Mercury: 40 })).some((l) => l.startsWith('besieged'))).toBe(false);
    // Two fortunes on either side do not besiege (the table lists only the Infortunes).
    expect(labels('Venus', chartOf({ Venus: 190, Saturn: 188, Jupiter: 192, Mars: 10, Moon: 20, Sun: 30, Mercury: 40 })).some((l) => l.startsWith('besieged'))).toBe(false);
  });
  it('adds up as a sum of its rows', () => {
    const c = chartOf({});
    for (const p of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const) {
      expect(accidentalScore(p, c)).toBe(accidentalItems(p, c).reduce((n, i) => n + i.score, 0));
    }
  });
});
