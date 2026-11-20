// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The solar-return rules of rules.western.json (Lilly, Christian Astrology, Book III chapters
 * CLXVIII, CLXXII and CLXXIII): the sign the return Ascendant falls in, the house in which the
 * significators of money stand, a planet that returns to a radical place, and the condition of
 * the lord of the year in the radix and in the return.
 *
 * Every rule here is a pure function of the natal PeriodInput and the return charts of the
 * years, each a NatalModel built from plain longitudes, so a test can build both without a
 * date. A return belongs to the profected year it opens, from one return to the next, and is
 * counted from the birthday. The chart is cast for the birth place and its houses are whole
 * signs counted from the return Ascendant, both labelled in the badges.
 *
 * Where a rule's condition leaves a term open ("impedited", "well affected") the clause is not
 * evaluated, and the firing's badges say which clause the statement rests on.
 */
import { PLANETS, type Planet } from '../../../substrate/sky.ts';
import { houseLord } from '../../../systems/western/lillyDignity.ts';
import { SIGNS } from '../../../systems/western/dignities.ts';
import type { Direction, Fact, Firing, Topic } from '../../types.ts';
import type { PeriodInput, ProfectedYear } from './context.ts';
import { type NatalModel } from './model.ts';
import { BADGE, CONVENTIONS, fact } from './natal.ts';
import { houseOfSign, lordsOfYear, signInstance } from './profection.ts';

/** The solar-return chart of one profected year, as a model of plain longitudes. */
export interface ReturnYear {
  /** Age, the year's number minus one; the return that opens the year. */
  k: number;
  utcMs: number;
  model: NatalModel;
  /** Longitude of the Midheaven at the return. */
  mc: number;
}

/** The rule function of every solar-return rule. */
export type ReturnRule = (w: PeriodInput, returns: readonly ReturnYear[]) => Firing[];

export const RETURN_BADGES = {
  place: 'return chart cast for the birth place (Lilly casts it for the place of residence)',
  samePlace: 'derived threshold: the same place is read as the same degree of the same sign',
  dignified: 'derived threshold: well dignified is read as class strong or an essential score of +1 or more, in the return chart',
  unfortunateHouses: 'not evaluated: the clause "chiefly if those houses were unfortunate in the radix", for which Lilly gives no test',
} as const;

const norm12 = (x: number): number => ((x % 12) + 12) % 12;
const signIndexOf = (lon: number): number => Math.floor((((lon % 360) + 360) % 360) / 30) % 12;
const degreeOf = (lon: number): number => Math.floor((((lon % 360) + 360) % 360) % 30);

/** The years of the input that have a return chart (age 1 and more), each with its chart. */
const withReturns = (w: PeriodInput, returns: readonly ReturnYear[]): { y: ProfectedYear; r: ReturnYear }[] =>
  w.years.flatMap((y) => {
    const r = returns.find((x) => x.k === y.k);
    return r === undefined || y.k < 1 ? [] : [{ y, r }];
  });

/** A firing dated from one return to the next. */
const returnFiring = (y: ProfectedYear, facts: Fact[], badges: string[], instance: string, topics?: Topic[], direction?: Direction): Firing => ({
  clock: 'birthday',
  startUtcMs: y.startUtcMs,
  endUtcMs: y.endUtcMs,
  facts,
  topics,
  direction,
  dedupeInstance: instance,
  conventionsUsed: CONVENTIONS,
  badges,
});

// ---------------------------------------------------------------------------
// The sign of the return Ascendant (p.736-737)
// ---------------------------------------------------------------------------

/** The natal house, counted in signs from the natal Ascendant, that the return Ascendant sign was. */
const natalHouseOfReturnAsc = (w: PeriodInput, r: ReturnYear): number => houseOfSign(w.model, r.model.ascSign);

/** Square or opposite the natal Ascendant sign (the 4th, 7th and 10th by sign) or the natal 6th or 12th sign. */
const HOSTILE_HOUSES: readonly number[] = [4, 6, 7, 10, 12];
/** The houses for which Lilly names sickness and bodily weakness. */
const SICKNESS_HOUSES: readonly number[] = [6, 7, 12];

export const ascHostile: ReturnRule = (w, returns) =>
  withReturns(w, returns).flatMap(({ y, r }) => {
    const h = natalHouseOfReturnAsc(w, r);
    if (!HOSTILE_HOUSES.includes(h)) return [];
    const sick = SICKNESS_HOUSES.includes(h);
    return [
      returnFiring(
        y,
        [fact('h', 'Natal house of the return Ascendant sign', h), fact('sign', 'Return Ascendant sign', SIGNS[r.model.ascSign]!)],
        [BADGE.wholeSign, RETURN_BADGES.place, ...(sick ? [RETURN_BADGES.unfortunateHouses] : [])],
        signInstance(y, r.model.ascSign),
        sick ? ['general', 'health'] : ['general'],
      ),
    ];
  });

/** The return Ascendant in the sign of the natal Ascendant. */
export const ascSame: ReturnRule = (w, returns) =>
  withReturns(w, returns).flatMap(({ y, r }) => {
    if (r.model.ascSign !== w.model.ascSign) return [];
    const lord = r.model.lordOfHouse(1);
    // A combust lord turns Lilly's verdict to mischief, a reading that depends on the nature of the lord of the year and is not evaluated; the good verdict is then not said.
    if (r.model.accidentalItems(lord).some((i) => i.label === 'combust')) return [];
    const dignified = r.model.cls(lord) === 'strong' || r.model.essential(lord) >= 1;
    return [
      returnFiring(
        y,
        [
          fact('lordClause', 'Reading', dignified ? ', with good health and actions succeeding, and increase of substance as the lord of the Ascendant is well dignified' : ', with good health and actions succeeding'),
          fact('lord', 'Lord of the Ascendant', lord),
        ],
        [
          BADGE.wholeSign,
          RETURN_BADGES.place,
          ...(dignified ? [RETURN_BADGES.dignified] : []),
          'the verdict on a combust lord of the Ascendant is not evaluated: the good verdict is not said when that lord is combust in the return',
        ],
        signInstance(y, r.model.ascSign),
        dignified ? ['general', 'health', 'wealth'] : ['general', 'health'],
      ),
    ];
  });

/** The return Ascendant in the natal 7th sign. */
export const seventhAsc: ReturnRule = (w, returns) =>
  withReturns(w, returns).flatMap(({ y, r }) =>
    natalHouseOfReturnAsc(w, r) === 7 ? [returnFiring(y, [fact('sign', 'Return Ascendant sign', SIGNS[r.model.ascSign]!)], [BADGE.wholeSign, RETURN_BADGES.place], signInstance(y, r.model.ascSign))] : [],
  );

// ---------------------------------------------------------------------------
// The houses of the significators of money (p.737)
// ---------------------------------------------------------------------------

/**
 * The significators of money in the houses of the return. Lilly's subject is the significators
 * of the radix: the lord of the 2nd, the Part of Fortune and Jupiter of the birth chart, each
 * placed by its own longitude among the houses of the return (whole signs counted from the
 * return Ascendant). Reading the return chart's own lord of the 2nd, as an earlier version did,
 * names a different planet. One statement for each significator; where the lord of the 2nd is
 * Jupiter the two are one fact and are said once. The passage names where a gain comes from
 * and not whether the year is good, so the rule is a pointer.
 */
export const lord2FortuneHouse: ReturnRule = (w, returns) =>
  withReturns(w, returns).flatMap(({ y, r }) => {
    const radical: { label: string; lon: number }[] = [];
    for (const s of [
      { label: String(w.model.lordOfHouse(2)), lon: w.model.lon(w.model.lordOfHouse(2)) },
      { label: 'the Part of Fortune', lon: w.model.fortune() },
      { label: 'Jupiter', lon: w.model.lon('Jupiter') },
    ]) {
      if (!radical.some((x) => x.label === s.label)) radical.push(s);
    }
    return radical.map((s) => {
      const h = norm12(signIndexOf(s.lon) - r.model.ascSign) + 1;
      return returnFiring(
        y,
        [fact('significator', 'Significator of the birth chart', s.label), fact('h', 'House of the return', h)],
        [BADGE.wholeSign, RETURN_BADGES.place, 'the significator is the one of the birth chart, placed by its longitude in the houses of the return'],
        `${y.startUtcMs}-${y.endUtcMs}@${s.label}`,
      );
    });
  });

// ---------------------------------------------------------------------------
// A planet at a radical place (p.738-741)
// ---------------------------------------------------------------------------

interface PlaceReading {
  planet: Planet;
  /** The radical planet whose place it is. */
  at: Planet;
  reading: string;
  topics: Topic[];
  /** A further condition on the radical chart. */
  when?: (m: NatalModel) => boolean;
  badges?: string[];
}

const atPlace = (entries: readonly PlaceReading[]): ReturnRule => (w, returns) =>
  withReturns(w, returns).flatMap(({ y, r }) =>
    entries.flatMap((e) => {
      if (e.when !== undefined && !e.when(w.model)) return [];
      if (signIndexOf(r.model.lon(e.planet)) !== signIndexOf(w.model.lon(e.at)) || degreeOf(r.model.lon(e.planet)) !== degreeOf(w.model.lon(e.at))) return [];
      const own = e.planet === e.at;
      return [
        returnFiring(
          y,
          [fact('planet', 'Planet', e.planet), fact('place', 'Radical place', own ? 'its own radical place' : `the radical place of ${e.at}`), fact('reading', 'Reading', e.reading)],
          [RETURN_BADGES.place, RETURN_BADGES.samePlace, ...(e.badges ?? [])],
          `${y.startUtcMs}-${y.endUtcMs}@${e.planet}>${e.at}`,
          e.topics,
        ),
      ];
    }),
  );

/**
 * Four of the five entries of the money readings. "Saturn at its own place and well affected"
 * is left out: "well affected" has no test in the file.
 */
export const returnsWealth: ReturnRule = atPlace([
  { planet: 'Saturn', at: 'Jupiter', reading: 'fortunate in body and goods', topics: ['wealth'] },
  { planet: 'Jupiter', at: 'Jupiter', reading: 'a child and much wealth, health and esteem', topics: ['wealth'] },
  { planet: 'Mercury', at: 'Saturn', reading: 'profit by husbandry and wealth from old men', topics: ['wealth'] },
  { planet: 'Mercury', at: 'Jupiter', reading: 'acquires an office, gains by trade', topics: ['wealth'] },
]);

/** The Moon at the Sun's radical place, and at her own only if she was weak at birth. */
export const returnsAffliction: ReturnRule = atPlace([
  { planet: 'Moon', at: 'Sun', reading: 'many hazards and dangers, sore eyes', topics: ['general', 'health'] },
  { planet: 'Moon', at: 'Moon', reading: 'much ill according to her signification at that time', topics: ['general', 'health'], when: (m) => m.cls('Moon') === 'weak', badges: [BADGE.derivedClass] },
]);

// ---------------------------------------------------------------------------
// The planets disposed contrary to the radix (p.737)
// ---------------------------------------------------------------------------

const BELOW_EARTH = [1, 2, 3, 4, 5, 6];
const ABOVE_EARTH = [7, 8, 9, 10, 11, 12];
const CADENT_HOUSES = [3, 6, 9, 12];

/** The two extremes Lilly gives: all below the earth in the radix and all above it in the return, or all cadent in the radix and all in their own houses in the return. */
export const contraryDisposition: ReturnRule = (w, returns) =>
  withReturns(w, returns).flatMap(({ y, r }) => {
    const subterranean = PLANETS.every((p) => BELOW_EARTH.includes(w.model.houseOf(p)) && ABOVE_EARTH.includes(r.model.houseOf(p)));
    const cadent = PLANETS.every((p) => CADENT_HOUSES.includes(w.model.houseOf(p)) && houseLord(r.model.signOf(p)) === p);
    if (!subterranean && !cadent) return [];
    return [
      returnFiring(y, [], [BADGE.wholeSign, RETURN_BADGES.place, ...(cadent && !subterranean ? ['"their own houses" is read as each planet standing in a sign it rules'] : [])], `${y.startUtcMs}-${y.endUtcMs}`),
    ];
  });

// ---------------------------------------------------------------------------
// The lord of the year in the radix and in the return (p.727-728)
// ---------------------------------------------------------------------------

const LORD_BADGES = [
  BADGE.derivedClass,
  RETURN_BADGES.place,
  'two of the seven verdicts are evaluated: strong in the radix and weak in the return, and weak in the radix and strong in the return; the other five need the profection figure or terms the file does not define (impedited, powerful, in aspect to the benevolent)',
  'topics narrowed by the implementer: the two verdicts speak of endeavours and goodness, not of the body',
];

/**
 * The lord of the year is the lord of the profected Ascendant sign until the Ascendant has
 * crossed it, then the lord of the next sign (lilly.profection.lord-of-year-by-degree); each
 * is judged over its own stretch of the year, and once for the whole year when both are one
 * planet. The class is the one of the strength-classes rule, in the radix and in the return.
 */
export const lordCondition: ReturnRule = (w, returns) =>
  withReturns(w, returns).flatMap(({ y, r }) => {
    const { sign, lord, changeMs, lord2, wholeSign } = lordsOfYear(w.model, y);
    const stretches: { lord: Planet; from: number; to: number; sign: number }[] =
      wholeSign || lord === lord2
        ? [{ lord, from: y.startUtcMs, to: y.endUtcMs, sign }]
        : [
            { lord, from: y.startUtcMs, to: changeMs, sign },
            { lord: lord2, from: changeMs, to: y.endUtcMs, sign: sign + 1 },
          ];
    return stretches.flatMap((s) => {
      const radix = w.model.cls(s.lord);
      const back = r.model.cls(s.lord);
      const verdict = radix === 'strong' && back === 'weak' ? { text: 'endeavours weak', direction: 'unfavourable' as const } : radix === 'weak' && back === 'strong' ? { text: 'moderate goodness', direction: 'favourable' as const } : null;
      if (verdict === null) return [];
      const f = returnFiring(
        { ...y, startUtcMs: s.from, endUtcMs: s.to },
        [fact('lord', 'Lord of the year', s.lord), fact('radixClass', 'Class in the radix', radix), fact('returnClass', 'Class in the return', back), fact('verdict', 'Verdict', verdict.text)],
        LORD_BADGES,
        signInstance(y, s.sign),
        ['general', 'wealth'],
        verdict.direction,
      );
      return [f];
    });
  });
