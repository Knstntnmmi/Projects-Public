// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The Parashari chart as the forecast rules read it: whole-sign houses from the sidereal
 * rising sign, house lords, dignity of each planet, natural and functional nature, the
 * kendra-trikona links, and houses counted from the natal Moon.
 *
 * Every table here is typed from data/rules.vedic.json (tables.DIGNITY, tables.LAGNA_NATURE,
 * tables.HOUSE_TOPICS), which a checker compared with the English translation of the Brihat
 * Parashara Hora Shastra; the tests compare each entry back to that file. Nothing here is
 * the author's own doctrine: where the source does not speak the answer is 'unstated'.
 *
 * The functions take plain sign indices (0 = Aries) and degrees within the sign, so that
 * they do not depend on the forecast layer that uses them.
 */

export const SIGN_NAMES = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

export const GRAHAS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const;
export type Graha = (typeof GRAHAS)[number];
export const NODES = ['Rahu', 'Ketu'] as const;

/** A planet or node in the sidereal zodiac: sign index 0 to 11 and degree within the sign. */
export interface Placement {
  planet: string;
  signIndex: number;
  degree: number;
}

export const isGraha = (p: string): p is Graha => (GRAHAS as readonly string[]).includes(p);

/** Lord of each sign, Aries first (tables.DIGNITY, Ch.3 sl.49-55). */
export const SIGN_LORD: readonly Graha[] = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];

/** The signs a planet owns, in zodiac order. */
export const OWN_SIGNS: Readonly<Record<Graha, readonly number[]>> = {
  Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10],
};

export const KENDRA: readonly number[] = [1, 4, 7, 10];
export const TRIKONA: readonly number[] = [1, 5, 9];
/** Houses the source calls evil-lordship houses (tables.HOUSE_TOPICS, Ch.11 sl.14-16). */
export const EVIL_HOUSES: readonly number[] = [3, 6, 8, 11, 12];
export const DUSTHANA: readonly number[] = [6, 8, 12];

/** House 1 to 12 of a sign counted by whole sign from a reference sign. */
export const houseFrom = (signIndex: number, fromSign: number): number => ((((signIndex - fromSign) % 12) + 12) % 12) + 1;

/** The sign that is house h from a reference sign. */
export const signOfHouse = (h: number, fromSign: number): number => (fromSign + h - 1) % 12;

export const lordOfHouse = (lagnaSign: number, h: number): Graha => SIGN_LORD[signOfHouse(h, lagnaSign)]!;

/** The houses a planet owns from the rising sign, ascending. */
export function housesOwned(lagnaSign: number, planet: Graha): number[] {
  return OWN_SIGNS[planet].map((s) => houseFrom(s, lagnaSign)).sort((a, b) => a - b);
}

/**
 * Whole-sign seventh aspect: two bodies in opposite signs. The full seventh is the only
 * aspect the rules use (the aspect chapter of the source was not opened).
 */
export const aspectsSeventh = (a: number, b: number): boolean => houseFrom(a, b) === 7;

// ---------------------------------------------------------------- house topics

/**
 * tables.HOUSE_TOPICS, BPHS Ch.11 sl.2-13: what each house is about, as the table lists it.
 * Index 0 is house 1.
 */
export const HOUSE_TOPICS: readonly (readonly string[])[] = [
  ['body', 'appearance', 'intellect', 'vigour', 'innate nature'],
  ['wealth', 'grain', 'family', 'metals', 'gems', 'death', 'enemies'],
  ['valour', 'servants', 'brothers and sisters', 'initiation', 'journey', "parents' death"],
  ['conveyances', 'relatives', 'mother', 'happiness', 'treasure', 'lands', 'buildings'],
  ['amulets', 'mantra', 'learning', 'knowledge', 'sons', 'authority', 'fall of position'],
  ['maternal uncle', 'enemies', 'ulcers', 'step-mother', 'doubts about death'],
  ['wife', 'travel', 'trade', 'loss of sight', 'death'],
  ['longevity', 'battle', 'enemies', 'forts', 'wealth of the dead'],
  ['fortune', "wife's brother (also brother's wife)", 'religion', 'visits to shrines'],
  ['authority', 'place', 'profession', 'honour', 'father', 'living in foreign lands', 'debts'],
  ['articles', "son's wife", 'income', 'prosperity', 'quadrupeds'],
  ['expenses', 'history of enemies', "one's own death"],
];

/** Entries naming death or the dead are in the table above and are not printed (the method notes: mortality statements are never printed). */
const MORTALITY_ENTRY = /\b(death|dead)\b/i;

/** What house h is about, as printed: the table's entries without those that name death. */
export function printableHouseTopics(h: number): string[] {
  return HOUSE_TOPICS[h - 1]!.filter((t) => !MORTALITY_ENTRY.test(t));
}

// ---------------------------------------------------------------- dignity

/** tables.DIGNITY: exaltation sign and deep degree; debilitation is the seventh sign, same degree. */
export const EXALTATION: Readonly<Record<Graha, { signIndex: number; degree: number }>> = {
  Sun: { signIndex: 0, degree: 10 },
  Moon: { signIndex: 1, degree: 3 },
  Mars: { signIndex: 9, degree: 28 },
  Mercury: { signIndex: 5, degree: 15 },
  Jupiter: { signIndex: 3, degree: 5 },
  Venus: { signIndex: 11, degree: 27 },
  Saturn: { signIndex: 6, degree: 20 },
};

export const debilitationOf = (p: Graha): { signIndex: number; degree: number } => ({ signIndex: (EXALTATION[p].signIndex + 6) % 12, degree: EXALTATION[p].degree });

/** tables.DIGNITY moolatrikona spans in degrees within the sign, from inclusive to exclusive; the rest of the sign, where the planet owns it, is own sign. */
export const MOOLATRIKONA: Readonly<Record<Graha, { signIndex: number; from: number; to: number }>> = {
  Sun: { signIndex: 4, from: 0, to: 20 },
  Moon: { signIndex: 1, from: 3, to: 30 },
  Mars: { signIndex: 0, from: 0, to: 12 },
  Mercury: { signIndex: 5, from: 15, to: 20 },
  Jupiter: { signIndex: 8, from: 0, to: 10 },
  Venus: { signIndex: 6, from: 0, to: 15 },
  Saturn: { signIndex: 10, from: 0, to: 20 },
};

export type Relationship = 'great friend' | 'friend' | 'neutral' | 'enemy' | 'great enemy';
export type DignityKind = 'exalted' | 'debilitated' | 'moolatrikona' | 'own sign' | Relationship;

export interface Dignity {
  planet: Graha;
  signIndex: number;
  degree: number;
  kind: DignityKind;
  /** Degrees from the deep exaltation or deep fall point when the sign is the exaltation or debilitation sign, else null. */
  fromDeepPoint: number | null;
  /** The sign lord's relationship to the planet when the sign is not one of its own, else null. */
  relationship: Relationship | null;
}

const FRIEND_OFFSETS = [2, 4, 5, 8, 9, 12];

/**
 * Natural relationship of planet x to planet y (Ch.3 sl.55). Friends are the lords of signs
 * 2, 4, 5, 8, 9 and 12 from x's moolatrikona sign and the lord of x's exaltation sign; the
 * lords of the other signs are enemies; a planet that is a friend by one of its signs (or
 * as lord of the exaltation sign) and an enemy by another is neutral.
 */
export function naturalRelationship(x: Graha, y: Graha): 'friend' | 'neutral' | 'enemy' {
  const mt = MOOLATRIKONA[x].signIndex;
  let friend = SIGN_LORD[EXALTATION[x].signIndex] === y;
  let enemy = false;
  for (const s of OWN_SIGNS[y]) {
    if (FRIEND_OFFSETS.includes(houseFrom(s, mt))) friend = true;
    else enemy = true;
  }
  return friend && enemy ? 'neutral' : friend ? 'friend' : 'enemy';
}

/** Temporary friend (sl.56): y sits in the 2nd, 3rd, 4th, 10th, 11th or 12th sign from x. */
export const temporaryFriend = (xSign: number, ySign: number): boolean => [2, 3, 4, 10, 11, 12].includes(houseFrom(ySign, xSign));

/** Compound relationship (sl.57-58), natural and temporary together. */
export function compoundRelationship(natural: 'friend' | 'neutral' | 'enemy', temporaryIsFriend: boolean): Relationship {
  if (temporaryIsFriend) return natural === 'friend' ? 'great friend' : natural === 'neutral' ? 'friend' : 'neutral';
  return natural === 'friend' ? 'neutral' : natural === 'neutral' ? 'enemy' : 'great enemy';
}

/**
 * The dignity of one planet at a sidereal position, computed once and reused by every rule.
 * Order of tests: moolatrikona span, exaltation sign, debilitation sign, own sign, then the
 * relationship to the sign lord. The moolatrikona test comes first because the table
 * gives Moon in Taurus exaltation only below 3 degrees and Mercury in Virgo below 15, where
 * the moolatrikona span begins.
 */
export function dignityOf(planet: Graha, signIndex: number, degree: number, positions: readonly Placement[]): Dignity {
  const base = { planet, signIndex, degree };
  const mt = MOOLATRIKONA[planet];
  if (signIndex === mt.signIndex && degree >= mt.from && degree < mt.to) return { ...base, kind: 'moolatrikona', fromDeepPoint: null, relationship: null };
  const ex = EXALTATION[planet];
  // Where the exaltation sign holds the moolatrikona span too, exaltation covers only the part before it; the rest, once past the span, is own sign.
  if (signIndex === ex.signIndex && !(signIndex === mt.signIndex && degree >= mt.from)) return { ...base, kind: 'exalted', fromDeepPoint: round(Math.abs(degree - ex.degree)), relationship: null };
  const de = debilitationOf(planet);
  if (signIndex === de.signIndex) return { ...base, kind: 'debilitated', fromDeepPoint: round(Math.abs(degree - de.degree)), relationship: null };
  if (OWN_SIGNS[planet].includes(signIndex)) return { ...base, kind: 'own sign', fromDeepPoint: null, relationship: null };
  const lord = SIGN_LORD[signIndex]!;
  const lordAt = positions.find((p) => p.planet === lord);
  if (!lordAt) throw new Error(`no placement for ${lord}`);
  const rel = compoundRelationship(naturalRelationship(planet, lord), temporaryFriend(signIndex, lordAt.signIndex));
  return { ...base, kind: rel, fromDeepPoint: null, relationship: rel };
}

const round = (x: number): number => Math.round(x * 100) / 100;

// ---------------------------------------------------------------- nature

export type Nature = 'benefic' | 'malefic' | 'unstated';

/**
 * Natural nature (Ch.34 sl.8-10): Jupiter, Venus benefic; Sun, Saturn, Mars malefic; the Moon
 * benefic when full and malefic when waning; Mercury benefic with benefics. The nodes follow
 * lordship and conjunction (sl.16), which the source does not turn into a rule: unstated.
 * 'Full' is read as the Moon waxing, that is, 0 to 180 degrees ahead of the Sun; the source
 * gives no finer cut.
 */
export function naturalNature(planet: string, placements: readonly Placement[]): Nature {
  const lon = (p: string): number | null => {
    const at = placements.find((x) => x.planet === p);
    return at ? at.signIndex * 30 + at.degree : null;
  };
  const moonBenefic = (): boolean => {
    const sun = lon('Sun');
    const moon = lon('Moon');
    if (sun === null || moon === null) return false;
    return (((moon - sun) % 360) + 360) % 360 < 180;
  };
  switch (planet) {
    case 'Jupiter': case 'Venus': return 'benefic';
    case 'Sun': case 'Saturn': case 'Mars': return 'malefic';
    case 'Moon': return moonBenefic() ? 'benefic' : 'malefic';
    case 'Mercury': {
      const own = placements.find((p) => p.planet === 'Mercury');
      if (!own) return 'unstated';
      const withBenefic = placements.some((p) => p.signIndex === own.signIndex && (p.planet === 'Jupiter' || p.planet === 'Venus' || (p.planet === 'Moon' && moonBenefic())));
      return withBenefic ? 'benefic' : 'unstated';
    }
    default: return 'unstated';
  }
}

/**
 * tables.LAGNA_NATURE, BPHS Ch.34 sl.19-44, as printed in the translation read. Planets the
 * text does not mention for a rising sign are unstated, not neutral; Mars for Aries is
 * described only as helping the auspicious. 'yoga' keeps the named yoga planets exactly as
 * the table words them. Index 0 is Aries.
 */
export const LAGNA_NATURE: readonly { auspicious: readonly Graha[]; malefic: readonly Graha[]; yoga: string }[] = [
  { auspicious: ['Jupiter', 'Sun'], malefic: ['Saturn', 'Mercury', 'Venus'], yoga: '' },
  { auspicious: ['Saturn', 'Sun'], malefic: ['Jupiter', 'Venus', 'Moon'], yoga: 'Saturn is the yogakaraka' },
  { auspicious: ['Venus'], malefic: ['Mars', 'Jupiter', 'Sun'], yoga: '' },
  { auspicious: ['Mars', 'Jupiter', 'Moon'], malefic: ['Venus', 'Mercury'], yoga: 'Mars is the yogakaraka' },
  { auspicious: ['Mars', 'Jupiter', 'Sun'], malefic: ['Mercury', 'Venus', 'Saturn'], yoga: '' },
  { auspicious: ['Mercury', 'Venus'], malefic: ['Mars', 'Jupiter', 'Moon'], yoga: 'Venus and Mercury form a yoga' },
  { auspicious: ['Saturn', 'Mercury'], malefic: ['Jupiter', 'Sun', 'Mars'], yoga: 'Moon and Mercury form a raja yoga' },
  { auspicious: ['Jupiter', 'Moon'], malefic: ['Venus', 'Mercury', 'Saturn'], yoga: 'Sun and Moon are yogakarakas' },
  { auspicious: ['Mars', 'Sun'], malefic: ['Venus'], yoga: '' },
  { auspicious: ['Venus', 'Mercury'], malefic: ['Mars', 'Jupiter', 'Moon'], yoga: 'Venus gives a superior yoga' },
  { auspicious: ['Venus', 'Saturn'], malefic: ['Jupiter', 'Moon', 'Mars'], yoga: 'Venus is the only raja-yoga planet' },
  { auspicious: ['Mars', 'Moon'], malefic: ['Saturn', 'Venus', 'Sun', 'Mercury'], yoga: '' },
];

/** The functional nature of a planet for a rising sign, from the per-Lagna table; 'unstated' where the table is silent (and for the nodes). */
export function functionalNature(lagnaSign: number, planet: string): Nature {
  const row = LAGNA_NATURE[lagnaSign]!;
  if (!isGraha(planet)) return 'unstated';
  return row.auspicious.includes(planet) ? 'benefic' : row.malefic.includes(planet) ? 'malefic' : 'unstated';
}

/** A single planet owning both a kendra (4, 7, 10) and a trikona (5, 9) house is the yogakaraka (Ch.34 sl.11-17). The Lagna lord alone does not count. */
export function yogakarakas(lagnaSign: number): Graha[] {
  return GRAHAS.filter((p) => {
    const owned = housesOwned(lagnaSign, p);
    return owned.some((h) => h === 4 || h === 7 || h === 10) && owned.some((h) => h === 5 || h === 9);
  });
}

// ---------------------------------------------------------------- kendra-trikona link

export type LinkVia = 'exchange of signs' | 'conjunction in a kendra or trikona' | 'one in a house of the other kind' | 'full seventh aspect';

export interface YogaLink {
  kendraLord: Graha;
  trikonaLord: Graha;
  kendraHouse: number;
  trikonaHouse: number;
  via: LinkVia[];
  /** Evil houses (3, 6, 8, 11, 12) owned by either lord. */
  evilHouses: number[];
  /** True when an evil house is owned and the per-Lagna list does not call the owner auspicious. */
  cancelled: boolean;
}

/**
 * The links of Ch.34 sl.11-17: two different planets, one lord of a kendra (4, 7, 10) and
 * one of a trikona (5, 9), that (a) exchange signs, (b) are conjunct in a kendra or
 * trikona, (c) one sits in a house of the other kind, or (d) aspect by the full seventh.
 * The Lagna counts as both kinds. A link is cancelled when either lord also owns an evil
 * house, unless the per-Lagna list calls that lord auspicious. One entry per pair of
 * houses; the clause for Rahu and Ketu is not evaluated.
 */
export function yogaLinks(lagnaSign: number, placements: readonly Placement[]): YogaLink[] {
  const sign = (p: Graha): number => {
    const at = placements.find((x) => x.planet === p);
    if (!at) throw new Error(`no placement for ${p}`);
    return at.signIndex;
  };
  const out: YogaLink[] = [];
  for (const hk of [4, 7, 10]) {
    for (const ht of [5, 9]) {
      const k = lordOfHouse(lagnaSign, hk);
      const t = lordOfHouse(lagnaSign, ht);
      if (k === t) continue;
      const via: LinkVia[] = [];
      if (OWN_SIGNS[t].includes(sign(k)) && OWN_SIGNS[k].includes(sign(t))) via.push('exchange of signs');
      if (sign(k) === sign(t) && [...KENDRA, ...TRIKONA].includes(houseFrom(sign(k), lagnaSign))) via.push('conjunction in a kendra or trikona');
      if (TRIKONA.includes(houseFrom(sign(k), lagnaSign)) || KENDRA.includes(houseFrom(sign(t), lagnaSign))) via.push('one in a house of the other kind');
      if (aspectsSeventh(sign(k), sign(t))) via.push('full seventh aspect');
      if (via.length === 0) continue;
      const evilHouses = [...new Set([...housesOwned(lagnaSign, k), ...housesOwned(lagnaSign, t)].filter((h) => EVIL_HOUSES.includes(h)))].sort((a, b) => a - b);
      const evilOwners = [k, t].filter((p) => housesOwned(lagnaSign, p).some((h) => EVIL_HOUSES.includes(h)));
      const cancelled = evilOwners.some((p) => functionalNature(lagnaSign, p) !== 'benefic');
      out.push({ kendraLord: k, trikonaLord: t, kendraHouse: hk, trikonaHouse: ht, via, evilHouses, cancelled });
    }
  }
  return out;
}

// ---------------------------------------------------------------- the chart

export interface VedicChartModel {
  lagnaSign: number;
  moonSign: number;
  placements: readonly Placement[];
  /** House of a planet from the rising sign. */
  houseOf(planet: string): number;
  /** House of a planet counted from the natal Moon's sign (the gochara count). */
  houseFromMoon(planet: string): number;
  /** House of any sign counted from the natal Moon. */
  signHouseFromMoon(signIndex: number): number;
  lordOf(h: number): Graha;
  housesOwnedBy(planet: Graha): number[];
  dignity(planet: Graha): Dignity;
  functionalNature(planet: string): Nature;
  naturalNature(planet: string): Nature;
  yogakarakas(): Graha[];
  yogaLinks(): YogaLink[];
}

/** Builds the model once; dignity is computed once per planet and reused. */
export function vedicChartModel(lagnaSign: number, placements: readonly Placement[]): VedicChartModel {
  const at = (p: string): Placement => {
    const x = placements.find((q) => q.planet === p);
    if (!x) throw new Error(`no placement for ${p}`);
    return x;
  };
  const moonSign = at('Moon').signIndex;
  const dignities = new Map<Graha, Dignity>();
  return {
    lagnaSign,
    moonSign,
    placements,
    houseOf: (p) => houseFrom(at(p).signIndex, lagnaSign),
    houseFromMoon: (p) => houseFrom(at(p).signIndex, moonSign),
    signHouseFromMoon: (s) => houseFrom(s, moonSign),
    lordOf: (h) => lordOfHouse(lagnaSign, h),
    housesOwnedBy: (p) => housesOwned(lagnaSign, p),
    dignity: (p) => {
      let d = dignities.get(p);
      if (!d) {
        const x = at(p);
        d = dignityOf(p, x.signIndex, x.degree, placements);
        dignities.set(p, d);
      }
      return d;
    },
    functionalNature: (p) => functionalNature(lagnaSign, p),
    naturalNature: (p) => naturalNature(p, placements),
    yogakarakas: () => yogakarakas(lagnaSign),
    yogaLinks: () => yogaLinks(lagnaSign, placements),
  };
}
