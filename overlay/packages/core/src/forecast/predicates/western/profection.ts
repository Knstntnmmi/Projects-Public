// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The annual profection rules of rules.western.json: Lilly's lord of the year by degree, his
 * house tables for the profected Ascendant, Midheaven and Sun, Valens's transmission and
 * Bonatti's list of what each profection reads. All of them count from the birthday (one
 * year runs from one solar return to the next) and are pure functions of a PeriodInput, so a
 * test can build the nativity from plain longitudes and the years from day offsets.
 *
 * Profections are counted in whole signs: the profected point keeps its degree and moves one
 * sign a year. That is Valens's and Bonatti's count; Lilly's by-degree count differs only in
 * that the Ascendant crosses into the next sign part-way through the year, which the
 * lord-of-the-year rule states as a second lord. The houses a rule names are whole-sign
 * houses, a labelled variant of Lilly's Regiomontanus cusps, and say so in a badge.
 *
 * The themes printed for a house are the rule file's own words for it (its condition text,
 * itself from the tables of Christian Astrology p.729-733), shortened and nothing added.
 */
import { MS } from '../../../substrate/time.ts';
import { houseLord } from '../../../systems/western/lillyDignity.ts';
import { SIGNS } from '../../../systems/western/dignities.ts';
import type { Direction, Fact, Firing, Topic } from '../../types.ts';
import type { PeriodInput, ProfectedYear } from './context.ts';
import { joinList, type NatalModel } from './model.ts';
import { BADGE, CONVENTIONS, fact, ordinal } from './natal.ts';
import type { Planet } from '../../../substrate/sky.ts';
import { PLANETS } from '../../../substrate/sky.ts';

/** The rule function of every profection rule: what it says about each year of the input. */
export type PeriodRule = (w: PeriodInput) => Firing[];

export const BADGES = {
  /** The tenth house is read by the named convention westernTenthYear; see conventions.ts. */
  tenth: 'convention westernTenthYear: Lilly contradicts himself on the profected tenth house (p.720 against p.730)',
  /** The assignment of a matter Valens or Bonatti names to one of the engine's topics is the implementer's. */
  topicAssigned: 'topic assigned by the implementer from the matter the source names',
} as const;

const norm12 = (x: number): number => ((x % 12) + 12) % 12;
const signIndexOf = (lon: number): number => Math.floor((((lon % 360) + 360) % 360) / 30) % 12;
const signName = (i: number): string => SIGNS[norm12(i)]!;
export const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** The whole-sign house, counted from the natal Ascendant sign, of a sign. */
export const houseOfSign = (m: NatalModel, sign: number): number => norm12(sign - m.ascSign) + 1;

/** The sign of a base after k years: one whole sign a year. */
const profected = (base: number, y: ProfectedYear): number => norm12(base + y.k);

/** The facts every dated profection firing is placed by; the instance names the physical fact it reads. */
const yearFiring = (y: ProfectedYear, facts: Fact[], badges: string[], instance: string | undefined, conventions: string[] = CONVENTIONS): Firing => ({
  clock: 'birthday',
  startUtcMs: y.startUtcMs,
  endUtcMs: y.endUtcMs,
  facts,
  dedupeInstance: instance,
  conventionsUsed: conventions,
  badges,
});

/** Specification 5.3: one profected sign in one year is one fact, however many rules read it. */
export const signInstance = (y: ProfectedYear, sign: number): string => `${y.startUtcMs}-${y.endUtcMs}@${norm12(sign)}`;

const houseFacts = (h: number, sign: number): Fact[] => [fact('h', 'House', h), fact('sign', 'Profected sign', signName(sign))];

// ---------------------------------------------------------------------------
// Lilly: the lord of the year by degree
// ---------------------------------------------------------------------------

/** A degree of profection is the tropical year over thirty: 12 days 4 hours 12 minutes (p.718). */
export const DAYS_PER_DEGREE = 365.2422 / 30;

/**
 * The lord of the year is the domicile lord of the sign the profected Ascendant stands in.
 * The profected Ascendant keeps its natal degree, so it has that many degrees of the sign
 * behind it when the year begins and the rest ahead: the first lord rules until it has
 * travelled the rest, at 12.17 days a degree counted in whole days with the hours dropped
 * (Lilly reads 284 days 16 hours as 284, decision 6), then the lord of the next sign until
 * the return. A year that begins at 0 degrees of a sign has one lord; the sentence then gives
 * the return date and the lord of the next year.
 */
/** The lords of one profected year: the sign it starts in, its lord, the day the lord changes and the next sign's lord. */
export function lordsOfYear(model: NatalModel, y: ProfectedYear): { sign: number; lord: Planet; changeMs: number; lord2: Planet; wholeSign: boolean } {
  const sign = profected(model.ascSign, y);
  const degree = model.ascendant % 30;
  const wholeSign = degree < 1e-9;
  const changeMs = wholeSign ? y.endUtcMs : y.startUtcMs + Math.trunc((30 - degree) * DAYS_PER_DEGREE) * MS.DAY;
  return { sign, lord: houseLord(sign), changeMs, lord2: houseLord(sign + 1), wholeSign };
}

export const lordOfYearByDegree: PeriodRule = (w) =>
  w.years.map((y) => {
    const { sign, lord, changeMs, lord2, wholeSign } = lordsOfYear(w.model, y);
    return yearFiring(
      y,
      [fact('sign', 'Profected Ascendant sign', signName(sign)), fact('lord', 'Lord of the year', lord), fact('date', 'First lord rules until', isoDate(changeMs)), fact('lord2', 'Lord of the next sign', lord2)],
      wholeSign ? ['the year begins at 0 degrees of a sign: one lord, the date is the return'] : [],
      signInstance(y, sign),
      [],
    );
  });

// ---------------------------------------------------------------------------
// Lilly: the profected Ascendant through the houses (p.729-730)
// ---------------------------------------------------------------------------

const MONEY: Readonly<Record<number, string>> = {
  2: 'buying and selling and the increase of estate',
  4: 'inheritance, a new house and the search for wealth in the earth, though sorrowful and fearful',
  10: 'preferment, and for the tradesman increase from his employment',
  11: 'all worldly affairs, the year very prosperous',
};

const RELATIONSHIPS: Readonly<Record<number, string>> = {
  7: 'froward and impatient, easily inclined to women and wantonness, many open enemies, wrangling and suits; good to marry, the other significators concurring',
  5: 'pleasure according to age, at school with equals or with women if capable; covenants, letters and accounts good',
};

const LEARNING: Readonly<Record<number, string>> = {
  9: 'a convenient time for long journeys, good to study and to follow learning, familiar with church-men',
  5: 'at school with his equals, according to his age',
};

const TRAVEL: Readonly<Record<number, string>> = {
  9: 'a convenient time to undertake long journeys',
  3: 'may prosper in journeys',
  10: 'may journey by land or sea with good safety and reputation',
  4: 'not good to go long journeys, danger of water',
  6: 'make no journeys',
};

/** Topics a house-loss reading is said to touch: house 6 names merchandise only, houses 8 and 12 the body and goods. */
const LOSS: Readonly<Record<number, { matter: string; topics: Topic[]; badges: string[] }>> = {
  6: { matter: 'merchandise, contracts and bargains', topics: ['wealth'], badges: [] },
  8: { matter: 'the body and goods, which suffer through slander and treachery, and for new contracts and adventurous trade', topics: ['wealth', 'health'], badges: [] },
  12: {
    matter: 'sickness, the enmity of ill neighbours, confinement or banishment, and dealing in great cattle',
    topics: ['wealth', 'health'],
    badges: ['the exception "unless the twelfth house in the radix was fortunate" is not evaluated: Lilly gives it no definition'],
  },
};

const HEALTH: Readonly<Record<number, string>> = {
  1: 'cheerful, a fit year to provide what the body needs',
  6: 'may fear a sickness; hatred of the vulgar',
  8: 'the body or goods suffer',
  12: 'sickly, the cause hard to find',
};

/** Under the convention westernTenthYear 'angle-aspect' the house table is not read for the tenth house. */
const tenthHeld = (w: PeriodInput, h: number): boolean => h === 10 && w.tenthYear === 'angle-aspect';

/** One firing per year in which the profected Ascendant stands in a house the table covers. */
function houseTable(w: PeriodInput, table: (h: number) => { facts: Fact[]; topics?: Topic[]; badges?: string[] } | null, extraConventions: string[] = []): Firing[] {
  const out: Firing[] = [];
  for (const y of w.years) {
    const sign = profected(w.model.ascSign, y);
    const h = houseOfSign(w.model, sign);
    const row = table(h);
    if (row === null) continue;
    if (tenthHeld(w, h)) continue;
    const badges = [BADGE.wholeSign, ...(h === 10 ? [BADGES.tenth] : []), ...(row.badges ?? [])];
    const f = yearFiring(y, [...houseFacts(h, sign), ...row.facts], badges, undefined, [...CONVENTIONS, ...(h === 10 ? ['westernTenthYear'] : []), ...extraConventions]);
    if (row.topics) f.topics = row.topics;
    out.push(f);
  }
  return out;
}

const from = (t: Readonly<Record<number, string>>, key: string, label: string) => (h: number) => (t[h] === undefined ? null : { facts: [fact(key, label, t[h]!)] });

export const houseMoney: PeriodRule = (w) => houseTable(w, from(MONEY, 'matter', 'What the year is favourable for'));
export const houseRelationships: PeriodRule = (w) => houseTable(w, from(RELATIONSHIPS, 'themes', 'What the house says'));
export const houseLearning: PeriodRule = (w) => houseTable(w, from(LEARNING, 'themes', 'What the house says'));
export const houseTravel: PeriodRule = (w) => houseTable(w, from(TRAVEL, 'themes', 'What the house says'));
export const houseHealth: PeriodRule = (w) => houseTable(w, from(HEALTH, 'tendency', 'Tendency'));
export const houseLoss: PeriodRule = (w) =>
  houseTable(w, (h) => (LOSS[h] === undefined ? null : { facts: [fact('matter', 'Matter', LOSS[h]!.matter)], topics: LOSS[h]!.topics, badges: LOSS[h]!.badges }));

// ---------------------------------------------------------------------------
// Lilly: the profected Midheaven and Sun (p.731-732)
// ---------------------------------------------------------------------------

const MC_TABLE: Readonly<Record<number, string>> = {
  1: 'good fortune by public employments, profession or service to a great person',
  2: 'the profits of former employment are received',
  3: 'an indifferent condition (loss of kindred, robbery in journeying)',
  4: 'fame and esteem called in question',
  5: 'merry, wanton, spending more than he gets',
  6: 'nothing succeeds in honourable matters',
  7: 'esteem and repute increase, favour of women of account',
  8: 'scandal and slander',
  9: 'long journeys for honour and renown',
  10: 'a very successful and famous year',
  11: 'kindness to friends, mutual respect',
  12: 'detriment in reputation, honour and fame',
};

/** The Midheaven and the Sun each profected, read through the radical houses; one reading per point and house. */
export const mcCareer: PeriodRule = (w) => {
  const mcSign = signIndexOf(w.mc);
  const points: Array<[string, number]> = [['Midheaven', mcSign], ['Sun', w.model.signOf('Sun')]];
  const out: Firing[] = [];
  for (const y of w.years) {
    for (const [point, base] of points) {
      const sign = profected(base, y);
      const h = houseOfSign(w.model, sign);
      if (tenthHeld(w, h)) continue;
      out.push(
        yearFiring(
          y,
          [fact('point', 'Profected point', point), fact('h', 'House', h), fact('sign', 'Profected sign', signName(sign)), fact('themes', 'What the house says', MC_TABLE[h]!)],
          [BADGE.wholeSign, ...(h === 10 ? [BADGES.tenth] : [])],
          `${y.startUtcMs}-${y.endUtcMs}@${point}`,
          [...CONVENTIONS, ...(h === 10 ? ['westernTenthYear'] : [])],
        ),
      );
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// Lilly: the Part of Fortune and the second house, profected (p.732-733)
// ---------------------------------------------------------------------------

const FORTUNE_TABLE: Readonly<Record<number, string>> = {
  1: 'an apt time to gather wealth which comes unexpectedly',
  2: 'goods long expected fall to him; he may buy and sell and augment his patrimony',
  3: 'kindred bestow some good thing',
  4: 'good from parents, increase by houses and inheritances',
  5: 'gain by friends, negotiations and writings',
  6: 'he thrives by servants and small cattle',
  7: 'gain by the wife and by suits at law',
  8: 'wealth by legacy; an ill year to lend money',
  9: 'long journeys profitably undertaken, gain by religious men',
  10: 'preferment where merit is',
  11: 'gain by friends and lending, a time to recover debts',
  12: 'danger of loss by great cattle and base acts',
};

/**
 * Two bases, each advanced one sign a year: the sign holding the Part of Fortune and the sign
 * of the 2nd house. When both reach one sign it is one reading, and the basis names both.
 */
export const fortuneSignWealth: PeriodRule = (w) => {
  const fortuneSign = signIndexOf(w.model.fortune());
  const secondSign = norm12(w.model.ascSign + 1);
  const out: Firing[] = [];
  for (const y of w.years) {
    const a = profected(fortuneSign, y);
    const b = profected(secondSign, y);
    const reads: Array<[string, number]> = a === b ? [['Part of Fortune (and, in the same sign, the sign of the 2nd house)', a]] : [['Part of Fortune', a], ['sign of the 2nd house', b]];
    for (const [basis, sign] of reads) {
      const h = houseOfSign(w.model, sign);
      out.push(
        yearFiring(
          y,
          [fact('basis', 'Profected base', basis), fact('h', 'House', h), fact('sign', 'Profected sign', signName(sign)), fact('themes', 'What the house says', FORTUNE_TABLE[h]!)],
          [BADGE.wholeSign],
          undefined,
        ),
      );
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// Lilly: aspects of the profected angles to the radical angles (p.720)
// ---------------------------------------------------------------------------

/** Whole-sign aspects by the number of signs apart; the two Lilly names with a verdict. */
const SIGN_ASPECT: Readonly<Record<number, { name: 'sextile' | 'trine' | 'square' | 'opposition'; good: boolean }>> = {
  2: { name: 'sextile', good: true },
  10: { name: 'sextile', good: true },
  4: { name: 'trine', good: true },
  8: { name: 'trine', good: true },
  3: { name: 'square', good: false },
  9: { name: 'square', good: false },
  6: { name: 'opposition', good: false },
};

/** The profected Ascendant and Midheaven, each against the radical Ascendant and Midheaven. */
export const angleAspectYears: PeriodRule = (w) => {
  const natalSigns: Array<[string, number]> = [['Ascendant', w.model.ascSign], ['Midheaven', signIndexOf(w.mc)]];
  const out: Firing[] = [];
  for (const y of w.years) {
    for (const [point, base] of natalSigns) {
      const sign = profected(base, y);
      for (const [angle, target] of natalSigns) {
        const a = SIGN_ASPECT[norm12(sign - target)];
        if (a === undefined) continue;
        // Under the convention 'house-table' the tenth house is read as the table says, not as a square to the Ascendant.
        const tenth = angle === 'Ascendant' && houseOfSign(w.model, sign) === 10;
        if (tenth && w.tenthYear === 'house-table') continue;
        out.push({
          ...yearFiring(
            y,
            [fact('point', 'Profected point', point), fact('aspect', 'Aspect', a.name), fact('angle', 'Radical angle', angle), fact('verdict', 'Lilly calls such years', a.good ? 'prosperous' : 'unhappy')],
            [BADGE.wholeSign, 'the clause "especially when those houses were radically well fortified" is not evaluated', ...(tenth ? [BADGES.tenth] : [])],
            `${y.startUtcMs}-${y.endUtcMs}@${point}-${angle}`,
            [...CONVENTIONS, ...(tenth ? ['westernTenthYear'] : [])],
          ),
          direction: a.good ? 'favourable' : 'unfavourable',
        });
      }
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// Valens: the transmission of the year (Anthologies IV.11)
// ---------------------------------------------------------------------------

/** Planets standing in a sign receive; only if it is empty does the sign's domicile lord (Riley p.103). */
export function receivers(m: NatalModel, sign: number): Planet[] {
  const here = PLANETS.filter((p) => m.signOf(p) === sign);
  return here.length > 0 ? [...here] : [houseLord(sign)];
}

const yearNumber = (y: ProfectedYear): number => y.k + 1;

/**
 * Year N counts r = N mod 12 signs inclusively from the Ascendant, the Sun and the Moon; the
 * count ends (r - 1) signs after the start, which is the same sign as the whole-sign profection
 * of age N - 1 (the Valens check: year 35, remainder 11, from Virgo reaches Cancer).
 */
export const transmissionLord: PeriodRule = (w) => {
  const starts: Array<[string, number]> = [['Ascendant', w.model.ascSign], ['Sun', w.model.signOf('Sun')], ['Moon', w.model.signOf('Moon')]];
  const out: Firing[] = [];
  for (const y of w.years) {
    const r = yearNumber(y) % 12 === 0 ? 12 : yearNumber(y) % 12;
    for (const [start, base] of starts) {
      const sign = norm12(base + r - 1);
      out.push(
        yearFiring(
          y,
          [fact('N', 'Year number', yearNumber(y)), fact('start', 'Counted from', start), fact('receiver', 'Receives the year', joinList(receivers(w.model, sign))), fact('receivingSign', 'Receiving sign', signName(sign))],
          [],
          signInstance(y, sign),
          [],
        ),
      );
    }
  }
  return out;
};

/** Valens's starting points by matter (Riley p.104): the matter as the source names it, and the topics the engine files it under. */
const signOfPlanet = (m: NatalModel, p: Planet): number => m.signOf(p);

interface Start {
  start: string;
  matter: string;
  topics: Topic[];
  /** The sign the count starts from. */
  sign: (w: PeriodInput) => number;
}

const START_POINTS: readonly Start[] = [
  { start: 'the Ascendant', matter: 'length of life, body and mind', topics: ['general', 'health'], sign: (w) => w.model.ascSign },
  { start: 'the Sun', matter: 'rank, preeminence, the father, great personages', topics: ['career'], sign: (w) => signOfPlanet(w.model, 'Sun') },
  { start: 'the Moon', matter: 'dangers to health, bleeding, the mother', topics: ['health'], sign: (w) => signOfPlanet(w.model, 'Moon') },
  { start: 'the Midheaven', matter: 'occupation, livelihood, work', topics: ['career', 'wealth'], sign: (w) => signIndexOf(w.mc) },
  { start: 'the Lot of Fortune', matter: 'good fortune and success in life', topics: ['wealth', 'general'], sign: (w) => signIndexOf(w.model.fortune()) },
  { start: 'the Descendant', matter: 'change and trouble', topics: ['general'], sign: (w) => norm12(w.model.ascSign + 6) },
  { start: 'the Imum Coeli', matter: 'estates, possessions, secret matters, legacies', topics: ['wealth'], sign: (w) => norm12(signIndexOf(w.mc) + 6) },
  { start: 'Venus', matter: 'women, love affairs, associations', topics: ['relationships'], sign: (w) => signOfPlanet(w.model, 'Venus') },
  { start: 'Mars', matter: 'military or public matters', topics: ['general'], sign: (w) => signOfPlanet(w.model, 'Mars') },
  { start: 'Saturn', matter: 'bankruptcy, money or property, secret diseases, family inheritance', topics: ['wealth'], sign: (w) => signOfPlanet(w.model, 'Saturn') },
  { start: 'Jupiter', matter: 'rank, friendship, alliances, possessions', topics: ['career'], sign: (w) => signOfPlanet(w.model, 'Jupiter') },
  { start: 'Mercury', matter: 'associations, servile matters, giving and receiving, written matters', topics: ['general'], sign: (w) => signOfPlanet(w.model, 'Mercury') },
];

export const topicStart: PeriodRule = (w) => {
  const out: Firing[] = [];
  for (const y of w.years) {
    const r = yearNumber(y) % 12 === 0 ? 12 : yearNumber(y) % 12;
    for (const s of START_POINTS) {
      const sign = norm12(s.sign(w) + r - 1);
      const topics = topicsFor(s.topics, sign);
      if (topics.length === 0) continue;
      out.push({
        ...yearFiring(y, [fact('topic', 'Matter', s.matter), fact('start', 'Counted from', s.start), fact('N', 'Year number', yearNumber(y)), fact('receivingSign', 'Receiving sign', signName(sign))], [BADGES.topicAssigned], signInstance(y, sign), []),
        topics,
      });
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// Bonatti: what each profection reads (Pars V p.817-818)
// ---------------------------------------------------------------------------

interface Base {
  topic: string;
  base: string;
  topics: Topic[];
  sign: (w: PeriodInput) => number;
}

const houseBase = (topic: string, h: number, topics: Topic[]): Base => ({ topic, base: `the ${ordinal(h)} house`, topics, sign: (w) => norm12(w.model.ascSign + h - 1) });

const BONATTI_BASES: readonly Base[] = [
  { topic: 'honours and annual dignities', base: 'the Sun', topics: ['career'], sign: (w) => w.model.signOf('Sun') },
  { topic: 'body and soul', base: 'the Moon', topics: ['health'], sign: (w) => w.model.signOf('Moon') },
  { topic: 'magistracies and offices', base: 'the Midheaven', topics: ['career'], sign: (w) => signIndexOf(w.mc) },
  { topic: 'gain and prosperity', base: 'the Part of Fortune', topics: ['wealth'], sign: (w) => signIndexOf(w.model.fortune()) },
  houseBase('gain and prosperity', 2, ['wealth']),
  houseBase('brothers', 3, ['general']),
  houseBase('the father', 4, ['general']),
  houseBase('children', 5, ['general']),
  houseBase('servants', 6, ['general']),
  houseBase('wives, partners and enemies', 7, ['relationships']),
  houseBase('the wives\' substance', 8, ['general']),
  houseBase('religious men', 9, ['general']),
  houseBase('kings', 10, ['general']),
  houseBase('friends', 11, ['general']),
  houseBase('hidden enemies', 12, ['general']),
];

export const topicSignificator: PeriodRule = (w) => {
  const out: Firing[] = [];
  for (const y of w.years) {
    for (const b of BONATTI_BASES) {
      const sign = profected(b.sign(w), y);
      const topics = topicsFor(b.topics, sign);
      if (topics.length === 0) continue;
      out.push({
        ...yearFiring(y, [fact('topic', 'Matter', b.topic), fact('base', 'Profected base', b.base), fact('sign', 'Profected sign', signName(sign))], [BADGES.topicAssigned, ...(b.base.endsWith('house') ? [BADGE.wholeSign] : [])], `${y.startUtcMs}-${y.endUtcMs}@${b.base}`, b.base.endsWith('house') ? CONVENTIONS : []),
        topics,
      });
    }
  }
  return out;
};

/**
 * The audit refuses mortality wording in a health sentence, and its list holds the word
 * "cancer", which is also the name of the sign. A health statement that would name that sign
 * is therefore not made under health (it stays under the other topics the matter is filed
 * under), and the report lists this. The fix belongs in the phrasebook's list.
 */
export function topicsFor(topics: Topic[], sign: number): Topic[] {
  return norm12(sign) === 3 ? topics.filter((t) => t !== 'health') : topics;
}

/** The direction a rule gives a house (directionByHouse), read from the firing's own house fact. */
export function withHouseDirection(rules: Readonly<Record<string, Direction>> | undefined, firings: Firing[]): Firing[] {
  if (!rules) return firings;
  return firings.map((f) => {
    const h = f.facts.find((x) => x.key === 'h')?.value;
    const d = h === undefined ? undefined : rules[String(h)];
    return d === undefined ? f : { ...f, direction: d };
  });
}
