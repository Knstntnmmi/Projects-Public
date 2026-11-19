// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The natal-promise rules of rules.western.json (Lilly, Christian Astrology, Book III):
 * wealth, honour, marriage and journeys, read from the strength of the significators on
 * Lilly's own tables. They describe the chart and never a period, so every firing is undated
 * and gives no reading its sign.
 *
 * Each rule is a pure function of a NatalModel (plain longitudes, whole-sign houses) and the
 * sex convention, so a test can build a chart directly. Where a rule's condition leaves a
 * choice open the comment says what was chosen and why; what is not coded is named in the
 * firing's badges so the reader sees which clause the statement rests on. Two rules are not
 * bound at all: see NOT_BOUND.
 */
import { PLANETS, type Planet } from '../../../substrate/sky.ts';
import { houseLord, type StrengthClass } from '../../../systems/western/lillyDignity.ts';
import type { Fact, Firing, NotEvaluated, RuleBinding } from '../../types.ts';
import { ANGULAR, CADENT, joinList, SUCCEDENT, type NatalModel } from './model.ts';

export const BADGE = {
  /** Every statement from a rule that names a house: Lilly's houses are Regiomontanus, the engine's are whole signs. */
  wholeSign: 'labelled variant: whole-sign houses (Lilly used Regiomontanus cusps)',
  derivedClass: 'derived threshold: strength class read from the essential score',
  derivedMajority: 'derived threshold: the greater part is read as more than half',
  derivedDignified: 'derived threshold: dignified read as a positive essential score',
} as const;

export const CONVENTIONS = ['westernHouses', 'westernTerms', 'westernOrbs'];

type SexRead = 'male' | 'female' | null;
type NatalRule = (m: NatalModel, sex: SexRead) => Firing[];

export const fact = (key: string, label: string, value: string | number): Fact => ({ key, label, value });

/** One undated firing on the birth-arithmetic clock; the instance says which fact of the rule it is. */
export const natal = (facts: Fact[], badges: string[], instance = 'natal'): Firing => ({
  clock: 'birthday',
  startUtcMs: null,
  endUtcMs: null,
  facts,
  dedupeInstance: instance,
  conventionsUsed: CONVENTIONS,
  badges,
});

export const ordinal = (h: number): string => `${h}${h === 1 ? 'st' : h === 2 ? 'nd' : h === 3 ? 'rd' : 'th'}`;
const inHouses = (m: NatalModel, p: Planet, houses: readonly number[]): boolean => houses.includes(m.houseOf(p));
const moreThanHalf = (count: number, of: number): boolean => count * 2 > of;
const isInfortune = (p: Planet): boolean => p === 'Saturn' || p === 'Mars';

// ---------------------------------------------------------------------------
// Wealth
// ---------------------------------------------------------------------------

/**
 * S_w of lilly.wealth.promise-strong: the domicile lord of the 2nd, each planet in the 2nd,
 * the domicile lord of the sign holding the Part of Fortune, and Jupiter, without repeats.
 */
export function wealthSignificators(m: NatalModel): Planet[] {
  const out: Planet[] = [];
  const add = (p: Planet): void => void (out.includes(p) || out.push(p));
  add(m.lordOfHouse(2));
  m.planetsIn(2).forEach(add);
  add(houseLord(Math.floor(m.fortune() / 30) % 12));
  add('Jupiter');
  return out;
}

const classCount = (m: NatalModel, ps: readonly Planet[], c: StrengthClass): number => ps.filter((p) => m.cls(p) === c).length;

const wealthPromise = (test: (m: NatalModel, s: Planet[]) => boolean, badges: string[]): NatalRule => (m) => {
  const s = wealthSignificators(m);
  if (!test(m, s)) return [];
  return [
    natal(
      [
        fact('list', 'Significators of wealth', joinList(s)),
        fact('n_angular', 'Significators in angles', s.filter((p) => inHouses(m, p, ANGULAR)).length),
        fact('n_strong', 'Strong significators', classCount(m, s, 'strong')),
        fact('n', 'Significators', s.length),
      ],
      badges,
    ),
  ];
};

const promiseStrong = wealthPromise(
  (m, s) => moreThanHalf(s.filter((p) => inHouses(m, p, ANGULAR)).length, s.length) && moreThanHalf(classCount(m, s, 'strong'), s.length),
  [BADGE.wholeSign, BADGE.derivedClass, BADGE.derivedMajority],
);
const promiseModerate = wealthPromise((m, s) => classCount(m, s, 'moderate') === s.length, [BADGE.derivedClass]);
const promiseWeakAll = wealthPromise((m, s) => classCount(m, s, 'weak') === s.length, [BADGE.derivedClass]);
/** "As many weak as strong" needs at least one of each: with none of either it would also hold for a chart of moderate planets, which has its own rule. */
const promiseMixed = wealthPromise((m, s) => classCount(m, s, 'strong') > 0 && classCount(m, s, 'strong') === classCount(m, s, 'weak'), [BADGE.derivedClass]);

/** The Infortunes in angles and the Fortunes in succedent houses: all four, as the plural says. */
const promiseWeakMajority: NatalRule = (m) =>
  inHouses(m, 'Saturn', ANGULAR) && inHouses(m, 'Mars', ANGULAR) && inHouses(m, 'Jupiter', SUCCEDENT) && inHouses(m, 'Venus', SUCCEDENT) ? [natal([], [BADGE.wholeSign])] : [];

/**
 * Clause (a) only: the Moon combust and her dispositor Saturn or Mars. Clause (b), the place
 * of the prenatal Sun-Moon conjunction or opposition oppressed by the Infortunes, has no
 * stated test for "oppressed" in a form the file lets us read without a guess, so it is not
 * evaluated and the badge says so.
 */
const promiseWeakMoonCombust: NatalRule = (m) => {
  if (!m.moonCombust()) return [];
  const dispositor = houseLord(m.signOf('Moon'));
  if (!isInfortune(dispositor)) return [];
  return [natal([fact('planet', 'Dispositor of the Moon', dispositor)], ['clause (a) only: the lunation-point clause (b) is not evaluated'])];
};

const aspectsAny = (m: NatalModel, a: Planet, bs: readonly Planet[]): boolean => bs.some((b) => m.aspect(a, b) !== null);

const inheritanceA: NatalRule = (m) => (m.isDay && m.houseOf('Saturn') === 8 && aspectsAny(m, 'Saturn', ['Jupiter', 'Venus']) ? [natal([], [BADGE.wholeSign])] : []);

const inheritanceB: NatalRule = (m) => {
  const lord = m.lordOfHouse(8);
  return m.essential(lord) > 0 && m.houseOf(lord) === 10 ? [natal([], [BADGE.wholeSign, BADGE.derivedDignified])] : [];
};

const inheritanceC: NatalRule = (m) => {
  const lordPof = houseLord(Math.floor(m.fortune() / 30) % 12);
  const lordAsc = m.lordOfHouse(1);
  return m.houseOf(lordPof) === 8 && lordAsc !== lordPof && m.aspect(lordAsc, lordPof) !== null ? [natal([], [BADGE.wholeSign])] : [];
};

/**
 * The four durability rules read the principal significator of substance: the planet in the
 * 2nd. Where one planet stands there it is that planet. Where several do, Lilly takes "the
 * most powerful" without saying how power is counted, and where none does he takes the lord
 * of the 2nd "and" the dispositor of the Part of Fortune, which are two planets: neither case
 * is coded, so these rules fire only for a sole planet in the 2nd.
 */
const SOLE_IN_SECOND = 'sole planet in the 2nd: the cases of several planets or none are not evaluated';

const durable = (kind: 'benefic-strong' | 'weak' | 'infortune-strong' | 'infortune-weak'): NatalRule => (m) => {
  const here = m.planetsIn(2);
  if (here.length !== 1) return [];
  const p = here[0]!;
  const c = m.cls(p);
  const ok =
    kind === 'benefic-strong'
      ? !isInfortune(p) && c === 'strong' && (p === 'Jupiter' || p === 'Venus' || m.inFortuneDignity(p))
      : kind === 'weak'
        ? !isInfortune(p) && c === 'weak'
        : kind === 'infortune-strong'
          ? isInfortune(p) && c === 'strong'
          : isInfortune(p) && c === 'weak';
  if (!ok) return [];
  const durability = {
    'benefic-strong': 'to continue undisturbed all the life',
    weak: 'to continue but with great hazard: much labour to preserve it, good store got and suddenly lost',
    'infortune-strong': 'to continue but with difficulty, the native subject rather to lose than to lay up',
    'infortune-weak': 'not to continue but to be overthrown',
  }[kind];
  return [natal([fact('planet', 'Planet in the 2nd', p), fact('class', 'Strength class', c === 'strong' ? 'strong' : 'weak'), fact('durability', 'Durability', durability)], [BADGE.wholeSign, BADGE.derivedClass, SOLE_IN_SECOND])];
};

const PHASES: ReadonlyArray<{ houses: readonly number[]; phase: string }> = [
  { houses: [10, 11, 12], phase: 'youth' },
  { houses: [9, 8, 7], phase: 'manhood, from 25 to 35 or 40' },
  { houses: [6, 5, 4], phase: 'the years nearer old age, after 40 and before 55' },
  { houses: [3, 2, 1], phase: 'the time towards the latter end' },
];

/** Only the houses are read; the clauses on orientality and motion (sooner, later, hasten, retard) are not coded. */
const lifePhase: NatalRule = (m) => {
  const s = wealthSignificators(m);
  const group = PHASES.find((g) => moreThanHalf(s.filter((p) => g.houses.includes(m.houseOf(p))).length, s.length));
  if (!group) return [];
  const houses = [...new Set(s.map((p) => m.houseOf(p)))].sort((a, b) => a - b);
  return [natal([fact('houses', 'Houses of the significators', joinList(houses)), fact('phase', 'Phase of life', group.phase)], [BADGE.wholeSign, BADGE.derivedMajority, 'orientality and motion clauses are not applied'])];
};

// ---------------------------------------------------------------------------
// Career: honour
// ---------------------------------------------------------------------------

/**
 * The significators of honour (p.615): the Sun, the Moon, every planet that beholds either
 * Light within the moiety of its orb (Table C, platick), the lord of the Midheaven sign and
 * the planets in the 10th, without repeats.
 */
export function honourSignificators(m: NatalModel): Planet[] {
  const out: Planet[] = [];
  const add = (p: Planet): void => void (out.includes(p) || out.push(p));
  add('Sun');
  add('Moon');
  for (const p of PLANETS) if (p !== 'Sun' && p !== 'Moon' && (m.aspect(p, 'Sun') || m.aspect(p, 'Moon'))) add(p);
  add(m.lordOfHouse(10));
  m.planetsIn(10).forEach(add);
  return out;
}

type Dignity3 = 'home' | 'minor' | 'poor' | 'unclassed';

/**
 * The three groups of the passage. Home: in its house or exaltation or in mutual reception by
 * house or exaltation. Poor: peregrine, or in detriment or fall (reception, checked first,
 * redeems). Minor: only triplicity, term or face. A planet in detriment or fall that also
 * holds a minor dignity belongs to two groups in the text, so it is left out of the count.
 */
export function dignityGroup(m: NatalModel, p: Planet): Dignity3 {
  const kinds = m.essentialItems(p).map((i) => i.kind);
  const received = PLANETS.some((q) => q !== p && m.receptionBetween(p, q) !== null);
  if (kinds.includes('house') || kinds.includes('exaltation') || received) return 'home';
  const minor = kinds.some((k) => k === 'triplicity' || k === 'term' || k === 'face');
  const weak = kinds.includes('detriment') || kinds.includes('fall');
  if (weak && minor) return 'unclassed';
  if (weak || kinds.includes('peregrine')) return 'poor';
  return 'minor';
}

/** The key with the largest count, if one is strictly larger than every other (plurality of testimonies); else null. */
function plurality<K extends string>(counts: Partial<Record<K, number>>): K | null {
  const entries = (Object.entries(counts) as [K, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  if (entries.length > 1 && entries[0]![1] === entries[1]![1]) return null;
  return entries[0]![0];
}

const honourEssential: NatalRule = (m) => {
  const s = honourSignificators(m);
  const counts: Partial<Record<Dignity3, number>> = {};
  for (const p of s) {
    const g = dignityGroup(m, p);
    if (g !== 'unclassed') counts[g] = (counts[g] ?? 0) + 1;
  }
  const g = plurality(counts);
  if (!g) return [];
  const texts: Record<Exclude<Dignity3, 'unclassed'>, readonly [string, string]> = {
    home: ['house, exaltation or mutual reception', 'honours, offices of public trust, great commands and favour among great persons, for a native born capable of it'],
    minor: ['triplicity, terms or face', 'mediocrity'],
    poor: ['peregrine, detriment or fall', 'very small or no dignities'],
  };
  const text = texts[g as Exclude<Dignity3, 'unclassed'>];
  return [natal([fact('list', 'Significators of honour', joinList(s)), fact('dignityGroup', 'Dignity group', text[0]), fact('verdict', 'Verdict', text[1])], ['derived reading: the group of most significators decides, a tie says nothing', 'a planet in detriment or fall with a minor dignity is not counted'], 'natal')];
};

/** House groups of the passage on angularity: angles; succedent houses; the 8th and the cadent houses. */
const honourAngularity: NatalRule = (m) => {
  const s = honourSignificators(m);
  const group = (p: Planet): 'angular' | 'succedent' | 'cadent' => {
    const h = m.houseOf(p);
    return (ANGULAR as readonly number[]).includes(h) ? 'angular' : h === 8 || (CADENT as readonly number[]).includes(h) ? 'cadent' : 'succedent';
  };
  const counts: Partial<Record<'angular' | 'succedent' | 'cadent', number>> = {};
  for (const p of s) counts[group(p)] = (counts[group(p)] ?? 0) + 1;
  const g = plurality(counts);
  if (!g) return [];
  const texts: Record<'angular' | 'succedent' | 'cadent', readonly [string, string]> = {
    angular: ['angular', 'ample preferment'],
    succedent: ['succedent', 'moderate esteem or little honour'],
    cadent: ['8th or cadent', 'very little honour or reputation, a mean and obscure condition'],
  };
  const text = texts[g];
  return [natal([fact('list', 'Significators of honour', joinList(s)), fact('houseGroup', 'House group', text[0]), fact('verdict', 'Verdict', text[1])], [BADGE.wholeSign, 'derived reading: the group of most significators decides, a tie says nothing', 'the clauses on planets in the 10th are not coded'])];
};

const lord1Lord10: NatalRule = (m) => {
  const out: Firing[] = [];
  const pair = (from: number, to: number, instance: string): void => {
    if (m.houseOf(m.lordOfHouse(from)) === to) out.push(natal([fact('first', 'House whose lord is meant', ordinal(from)), fact('tenth', 'House he stands in', ordinal(to))], [BADGE.wholeSign], instance));
  };
  pair(1, 10, 'lord1-in-10');
  pair(10, 1, 'lord10-in-1');
  return out;
};

/** "And the Planets also" is read as all five planets other than the Lights. */
const luminaryCadent: NatalRule = (m) => (PLANETS.every((p) => inHouses(m, p, CADENT)) ? [natal([], [BADGE.wholeSign, 'derived reading: "the planets also" is all five others'])] : []);

// ---------------------------------------------------------------------------
// Relationships: a man's nativity (Venus and the Moon)
// ---------------------------------------------------------------------------

const BARREN = [2, 4, 5]; // Gemini, Leo, Virgo
const MAN = 'read as a man\'s chart (convention-dependent)';

const singleBarren: NatalRule = (m, sex) => {
  if (sex !== 'male') return [];
  const ok = (p: Planet): boolean => BARREN.includes(m.signOf(p)) && inHouses(m, p, [6, 9, 12, 8]);
  return ok('Venus') && ok('Moon') ? [natal([], [BADGE.wholeSign, MAN])] : [];
};

/**
 * The precondition is the file's operationalisation: the lord of the 7th stands in a barren
 * sign or a cadent house, or is weak. Then (a) the Moon in Scorpio in square to Saturn with
 * Saturn in Leo or Taurus, or (b) the Moon combust and in square or opposition to Saturn in
 * Capricorn, Aquarius or Libra. As written, Saturn in Taurus can never be in square to a
 * Moon in Scorpio (Taurus is opposite), so that branch of (a) cannot fire.
 */
const singleMoonSaturn: NatalRule = (m, sex) => {
  if (sex !== 'male') return [];
  const l7 = m.lordOfHouse(7);
  const pre = BARREN.includes(m.signOf(l7)) || inHouses(m, l7, CADENT) || m.cls(l7) === 'weak';
  if (!pre) return [];
  const asp = m.aspect('Moon', 'Saturn');
  const a = m.signOf('Moon') === 7 && asp?.aspect === 'square' && (m.signOf('Saturn') === 4 || m.signOf('Saturn') === 1);
  const b = m.moonCombust() && (asp?.aspect === 'square' || asp?.aspect === 'opposition') && [9, 10, 6].includes(m.signOf('Moon'));
  return a || b ? [natal([], [BADGE.wholeSign, BADGE.derivedClass, 'derived reading: the other significators are the lord of the 7th', MAN])] : [];
};

/**
 * The lord of the Ascendant applies to the lord of the 7th: they aspect within the sum of
 * their moieties, the aspect is applying, and the lord of the Ascendant is the swifter of
 * the two, the one that does the applying; and they stand in mutual reception by house or by
 * exaltation ("equal reception", p.589).
 */
const marriagePromised: NatalRule = (m, sex) => {
  if (sex !== 'male') return [];
  const l1 = m.lordOfHouse(1);
  const l7 = m.lordOfHouse(7);
  if (m.aspect(l1, l7) === null || !m.applying(l1, l7) || Math.abs(m.speed(l1)) <= Math.abs(m.speed(l7))) return [];
  return m.receptionBetween(l1, l7) !== null ? [natal([], [BADGE.wholeSign, 'derived reading: applying means the swifter lord closing on the aspect', MAN])] : [];
};

/** Venus, the Moon, the lord of the 7th and the planets in the 7th, without repeats. */
export function marriageSignificators(m: NatalModel): Planet[] {
  const out: Planet[] = [];
  const add = (p: Planet): void => void (out.includes(p) || out.push(p));
  add('Venus');
  add('Moon');
  add(m.lordOfHouse(7));
  m.planetsIn(7).forEach(add);
  return out;
}

/** Only the first sentence: the greater part well fortified (strong). The branches for weak significators say "signified by the Infortunes" and "ill affected", which the file does not define, so they are not evaluated. */
const marriageEase: NatalRule = (m, sex) => {
  if (sex !== 'male') return [];
  const s = marriageSignificators(m);
  if (!moreThanHalf(classCount(m, s, 'strong'), s.length)) return [];
  return [natal([fact('class', 'Strength class', 'strong'), fact('ease', 'Ease', 'easily'), fact('list', 'Significators of marriage', joinList(s))], [BADGE.derivedClass, BADGE.derivedMajority, 'only the branch for well-fortified significators is evaluated', MAN])];
};

const ORIENTAL_QUARTERS = [10, 11, 12, 4, 5, 6];
const OCCIDENTAL_QUARTERS = [9, 8, 7, 1, 2, 3];

/** The motion clauses (direct, swift, retrograde, slow) and the rule for differing testimonies are not coded: the statement is made only when the greater part agree and the Moon is among them. */
const marriageAge: NatalRule = (m, sex) => {
  if (sex !== 'male') return [];
  const s = marriageSignificators(m);
  const east = (p: Planet): boolean => m.oriental(p) === true && ORIENTAL_QUARTERS.includes(m.houseOf(p));
  const west = (p: Planet): boolean => m.oriental(p) === false && OCCIDENTAL_QUARTERS.includes(m.houseOf(p));
  const badges = [BADGE.wholeSign, BADGE.derivedMajority, 'motion clauses are not coded', MAN];
  if (moreThanHalf(s.filter(east).length, s.length) && east('Moon')) {
    return [natal([fact('oriental or occidental', 'Orientality', 'oriental of the Sun'), fact('early or late', 'Marriage', 'in youth, or to a young woman'), fact('list', 'Significators of marriage', joinList(s))], badges)];
  }
  if (moreThanHalf(s.filter(west).length, s.length) && west('Moon')) {
    return [natal([fact('oriental or occidental', 'Orientality', 'occidental of the Sun'), fact('early or late', 'Marriage', 'very late, or in youth to a widow or a very aged woman'), fact('list', 'Significators of marriage', joinList(s))], badges)];
  }
  return [];
};

// ---------------------------------------------------------------------------
// Journeys
// ---------------------------------------------------------------------------

/**
 * Only the sentence "lord of the 9th in the 1st, or lord of the 1st in the 9th, or in
 * conjunction": travel is promised. The first sentence of the passage joins its alternatives
 * about the Moon and Mercury with "or" in a way that does not say whether both or either must
 * stand so, and is not evaluated.
 */
const travelPromised: NatalRule = (m) => {
  const l1 = m.lordOfHouse(1);
  const l9 = m.lordOfHouse(9);
  const how: string[] = [];
  if (m.houseOf(l9) === 1) how.push('the lord of the 9th in the 1st');
  if (m.houseOf(l1) === 9) how.push('the lord of the 1st in the 9th');
  if (l1 !== l9 && m.aspect(l1, l9)?.aspect === 'conjunction') how.push('the lords of the 1st and 9th in conjunction');
  if (how.length === 0) return [];
  return [natal([fact('list', 'Significators of journeys', joinList(how))], [BADGE.wholeSign, 'only the clause on the lords of the 1st and 9th is evaluated'])];
};

/** Rule id to function. Every id here is bound in BINDINGS. */
export const NATAL_RULES: Readonly<Record<string, NatalRule>> = {
  'lilly.wealth.promise-strong': promiseStrong,
  'lilly.wealth.promise-moderate': promiseModerate,
  'lilly.wealth.promise-weak.all': promiseWeakAll,
  'lilly.wealth.promise-weak.majority': promiseWeakMajority,
  'lilly.wealth.promise-weak.moon-combust': promiseWeakMoonCombust,
  'lilly.wealth.promise-mixed': promiseMixed,
  'lilly.wealth.inheritance-8th.a': inheritanceA,
  'lilly.wealth.inheritance-8th.b': inheritanceB,
  'lilly.wealth.inheritance-8th.c': inheritanceC,
  'lilly.wealth.durability.benefic-strong': durable('benefic-strong'),
  'lilly.wealth.durability.weak': durable('weak'),
  'lilly.wealth.durability.infortune-strong': durable('infortune-strong'),
  'lilly.wealth.durability.infortune-weak': durable('infortune-weak'),
  'lilly.wealth.life-phase': lifePhase,
  'lilly.career.honour-essential': honourEssential,
  'lilly.career.honour-angularity': honourAngularity,
  'lilly.career.lord1-lord10': lord1Lord10,
  'lilly.career.luminary-angularity.cadent': luminaryCadent,
  'lilly.relationships.single-life.barren': singleBarren,
  'lilly.relationships.single-life.moon-saturn': singleMoonSaturn,
  'lilly.relationships.marriage-promised': marriagePromised,
  'lilly.relationships.ease': marriageEase,
  'lilly.relationships.age': marriageAge,
  'lilly.travel.promised': travelPromised,
};

/** Rules that need the sex convention: the passage on marriage is written for a man's nativity. */
const NEEDS_SEX = new Set(Object.keys(NATAL_RULES).filter((id) => id.startsWith('lilly.relationships.')));

export const NATAL_BINDINGS: readonly RuleBinding[] = Object.entries(NATAL_RULES).map(([ruleId, run]) => ({
  ruleId,
  tradition: 'western',
  requires: { birthTime: true, sex: NEEDS_SEX.has(ruleId) },
  fire: (ctx) => run(ctx.extension<{ model: NatalModel }>('western')!.model, ctx.sex),
}));

/** The two natal-promise rules that are not bound, each with the reason a reader is shown. */
export const NATAL_NOT_BOUND: readonly NotEvaluated[] = [
  {
    ruleId: 'lilly.relationships.single-life.saturn',
    reason: 'Lilly does not say how "aided" or "more fortified" is counted (whether any aspect from any planet aids, and by what measure Venus and the Moon are more fortified than Saturn), and "nearer the Midheaven" is only a derived reading.',
  },
  {
    ruleId: 'lilly.health.constitution',
    reason: 'The significators include houses as points, which have no strength class; "hostile aspects of the Infortunes" and the way accidental debility enters a class are not defined in the rule file.',
  },
];
