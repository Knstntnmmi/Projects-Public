// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The mahadasha and antardasha rules of rules.vedic.json. Each rule reads the natal chart
 * (and, for one rule, the sky at the instant a dasha begins) and speaks over the dasha span
 * it is about, on the dasha clock. Where the rule file states a rule for the mahadasha only,
 * the antardasha version is the extractor's extension and carries that badge. Every rule
 * needs the birth time: the Lagna and the Moon's nakshatra both depend on it.
 */
import type { ForecastContext } from '../../context.ts';
import { longitudeOf, meanNodeLongitude, norm360, speedOf, type Planet } from '../../../substrate/sky.ts';
import { signOf as signOfLongitude } from '../../../systems/western/index.ts';
import { siderealLongitude, type DashaSpan } from '../../../systems/vedic/index.ts';
import {
  DUSTHANA,
  GRAHAS,
  KENDRA,
  TRIKONA,
  aspectsSeventh,
  compoundRelationship,
  dignityOf,
  houseFrom,
  isGraha,
  naturalRelationship,
  temporaryFriend,
  type Graha,
  type Placement,
  type VedicChartModel,
} from '../../../systems/vedic/houses.ts';
import type { Fact, Firing, RuleBinding, Topic } from '../../types.ts';
import { BADGES, DIGNITY_BAD, DIGNITY_GOOD, companions, dignityIn, dignityIs, evilSideHolds, goodSideHolds, join, model, signOf } from './common.ts';

const CONVENTIONS = ['ayanamsa', 'vedicDashaYearDays'];

interface Item {
  facts: Fact[];
  topics?: Topic[];
  badges?: string[];
}

const fact = (key: string, label: string, value: string | number): Fact => ({ key, label, value });

const overlapping = (ctx: ForecastContext, spans: readonly DashaSpan[]): DashaSpan[] => spans.filter((s) => s.endUtcMs > ctx.input.span.startUtcMs && s.startUtcMs < ctx.input.span.endUtcMs);

const antarLordOf = (s: DashaSpan): { maha: string; antar: string } => ({ maha: s.label.split(' / ')[0]!, antar: s.lord });

const dated = (s: DashaSpan, it: Item, extra: string[] = []): Firing => {
  const f: Firing = { clock: 'dasha', startUtcMs: s.startUtcMs, endUtcMs: s.endUtcMs, facts: it.facts, conventionsUsed: CONVENTIONS };
  if (it.topics) f.topics = it.topics;
  const badges = [...(it.badges ?? []), ...extra];
  if (badges.length > 0) f.badges = badges;
  return f;
};

/** A binding for a rule judged on the mahadasha lord, and, where `extend` is set, on the antardasha lord with the extension badge. */
function lordRule(ruleId: string, judge: (m: VedicChartModel, planet: string, s: DashaSpan) => Item[], extend = false): RuleBinding {
  return {
    ruleId,
    tradition: 'vedic',
    requires: { birthTime: true },
    fire(ctx) {
      const m = model(ctx);
      const { maha, antar } = ctx.dashas();
      const out: Firing[] = [];
      for (const s of overlapping(ctx, maha)) for (const it of judge(m, s.lord, s)) out.push(dated(s, it));
      if (extend) for (const s of overlapping(ctx, antar)) for (const it of judge(m, s.lord, s)) out.push(dated(s, it, [BADGES.extension]));
      return out;
    },
  };
}

const weakPlace = (m: VedicChartModel, p: string): boolean => DUSTHANA.includes(m.houseOf(p));
const debilitated = (m: VedicChartModel, p: Graha): boolean => m.dignity(p).kind === 'debilitated';

// ------------------------------------------------------------- house-lord rules

/** 5th and 9th lords, and planets joined to them; not debilitated, not in 6, 8, 12. The nodes cannot be tested for debilitation: the sources differ on their signs. */
const wealth59 = lordRule(
  'parashari.wealth-5-9-lord-dasha',
  (m, p) => {
    if (!isGraha(p) || debilitated(m, p) || weakPlace(m, p)) return [];
    const out: Item[] = [];
    for (const h of [5, 9]) {
      const lord = m.lordOf(h);
      if (!goodSideHolds(m, lord)) continue;
      if (lord === p) out.push({ facts: [fact('planet', 'Planet', p), fact('relation', 'Relation to the house lord', 'being'), fact('h', 'House', h)] });
      else if (signOf(m, lord) === signOf(m, p)) out.push({ facts: [fact('planet', 'Planet', p), fact('relation', 'Relation to the house lord', 'joined with'), fact('h', 'House', h)] });
    }
    return out;
  },
  true,
);

/** The mahadasha lord owns the 10th, is not debilitated and not in 6, 8, 12. */
const career10 = lordRule(
  'parashari.dasha-lord-career-10',
  (m, p) => (isGraha(p) && m.housesOwnedBy(p).includes(10) && !debilitated(m, p) && !weakPlace(m, p) && goodSideHolds(m, p) ? [{ facts: [fact('planet', 'Planet', p)] }] : []),
  true,
);

const education59 = lordRule(
  'parashari.dasha-lord-education-5-9',
  (m, p) => (isGraha(p) && goodSideHolds(m, p) ? m.housesOwnedBy(p).filter((h) => h === 5 || h === 9).map((h) => ({ facts: [fact('planet', 'Planet', p), fact('h', 'House', h)] })) : []),
  true,
);

/** The 4th lord, when it is not weak and not in 6, 8, 12 (Ch.48 sl.1); weak is read as debilitated, the one weakness the rule file names for dasha lords. */
const fourthHome = lordRule('parashari.dasha-lord-4th-home', (m, p) =>
  isGraha(p) && m.housesOwnedBy(p).includes(4) && !debilitated(m, p) && !weakPlace(m, p) && goodSideHolds(m, p) ? [{ facts: [fact('planet', 'Planet', p)] }] : [],
);

/** Owns or occupies 3, 7, 9 or 10; one firing per house. Stated for the mahadasha and the antardasha both, so no extension badge. */
const travel: RuleBinding = {
  ruleId: 'parashari.dasha-lord-travel',
  tradition: 'vedic',
  requires: { birthTime: true },
  fire(ctx) {
    const m = model(ctx);
    const { maha, antar } = ctx.dashas();
    const items = (p: string): Item[] =>
      [3, 7, 9, 10]
        .filter((h) => m.houseOf(p) === h || (isGraha(p) && m.housesOwnedBy(p).includes(h)))
        .map((h) => ({ facts: [fact('planet', 'Planet', p), fact('h', 'House', h)] }));
    return [...overlapping(ctx, maha), ...overlapping(ctx, antar)].flatMap((s) => items(s.lord).map((it) => dated(s, it)));
  },
};

/**
 * The 7th lord. The sentence says whether the lord is strong or weak; the rule's own direction
 * is mixed. Strong: exalted, or in a kendra or trikona with a benefic. Weak: debilitated, in 6,
 * 8, 12, or joined to a malefic. 'Benefic' and 'malefic' are the natural natures of Ch.34 sl.8-10.
 */
const partnership7 = lordRule('parashari.dasha-lord-7th-partnership', (m, p) => {
  if (!isGraha(p) || !m.housesOwnedBy(p).includes(7)) return [];
  const withNature = (n: 'benefic' | 'malefic'): boolean => companions(m, p).some((c) => m.naturalNature(c) === n);
  const strong = m.dignity(p).kind === 'exalted' || ([...KENDRA, ...TRIKONA].includes(m.houseOf(p)) && withNature('benefic'));
  const weak = m.dignity(p).kind === 'debilitated' || weakPlace(m, p) || withNature('malefic');
  const word = strong && weak ? 'of mixed strength' : strong ? 'strong' : weak ? 'weak' : 'neither strong nor weak';
  return [{ facts: [fact('planet', 'Planet', p), fact('strong_or_weak', 'Strength of the lord', word)] }];
});

/** Lord of the 2nd or 7th. The branch "joined to the 2nd or 7th lord" is not bound: the sentence says the planet is the lord. */
const maraka = lordRule('parashari.dasha-lord-2nd-7th-maraka', (m, p) =>
  isGraha(p) ? m.housesOwnedBy(p).filter((h) => h === 2 || h === 7).map((h) => ({ facts: [fact('planet', 'Planet', p), fact('h', 'House', h)] })) : [],
);

export const EFFECT: Readonly<Record<number, string>> = {
  6: 'danger from enemies and ill health',
  8: 'a risk of financial loss',
  12: 'distress and danger from illness',
};

/** The 6th, 8th or 12th houses an unredeemed or redeemed dasha lord owns, after the Sun and Moon exemption for the 8th and the sl.2-7 precedence. */
function evilHousesOf(m: VedicChartModel, p: string): number[] {
  if (!isGraha(p)) return [];
  const owned = m.housesOwnedBy(p).filter((h) => h === 6 || h === 8 || h === 12);
  if (owned.length === 0 || !evilSideHolds(m, p)) return [];
  return owned.filter((h) => !(h === 8 && (p === 'Sun' || p === 'Moon')));
}

/** Redeemed (Ch.48, as the rule file words it): joined to a trikona lord, or joined to or aspected (full seventh) by either planet of a kendra-trikona pair standing in each other's kind of house. */
function redeemers(m: VedicChartModel, p: string): string[] {
  const found = new Set<string>();
  const trikonaLords = [5, 9].map((h) => m.lordOf(h));
  for (const t of trikonaLords) if (t !== p && signOf(m, t) === signOf(m, p)) found.add(t);
  for (const k of [4, 7, 10].map((h) => m.lordOf(h))) {
    for (const t of trikonaLords) {
      if (k === t) continue;
      const linked = TRIKONA.includes(m.houseOf(k)) || KENDRA.includes(m.houseOf(t));
      if (!linked) continue;
      for (const x of [k, t]) if (x !== p && (signOf(m, x) === signOf(m, p) || aspectsSeventh(signOf(m, x), signOf(m, p)))) found.add(x);
    }
  }
  return [...found];
}

const evil6812 = lordRule('parashari.dasha-lord-6-8-12-lord', (m, p) => {
  if (redeemers(m, p).length > 0) return [];
  return evilHousesOf(m, p).map((h) => ({
    facts: [fact('planet', 'Planet', p), fact('h', 'House', h), fact('effect', 'Effect named', EFFECT[h]!)],
    // Ch.48 gives the 8th lord's dasha wealth loss and no health clause that can be printed; the 6th and 12th give health, not wealth.
    topics: (h === 8 ? ['wealth', 'general'] : ['health', 'general']) as Topic[],
  }));
});

const redeemed = lordRule('parashari.dasha-lord-6-8-12-redeemed', (m, p) => {
  const by = redeemers(m, p);
  return by.length === 0 ? [] : evilHousesOf(m, p).map((h) => ({ facts: [fact('planet', 'Planet', p), fact('h', 'House', h), fact('lord2', 'Redeemed by', join(by))] }));
});

/** Owns 3, 6 or 11. The branches "sits in" and "joined to such planets" are not bound: the sentence says the planet owns the house. Wealth is left out for the 11th (the rule file reads it as mixed for wealth, and the direction cannot be changed). */
const evil311 = lordRule('parashari.dasha-lord-3-11-lord', (m, p) => {
  if (!isGraha(p) || !evilSideHolds(m, p)) return [];
  return m
    .housesOwnedBy(p)
    .filter((h) => h === 3 || h === 6 || h === 11)
    .map((h) => ({ facts: [fact('planet', 'Planet', p), fact('h', 'House', h)], topics: (h === 11 ? ['general'] : ['general', 'wealth']) as Topic[] }));
});

// ------------------------------------------------------------- placement rules

type Verdict = 'favourable' | 'unfavourable' | 'mixed' | null;

const combine = (fav: boolean, unfav: boolean): Verdict => (fav && unfav ? 'mixed' : fav ? 'favourable' : unfav ? 'unfavourable' : null);

/** Natal placement: houses 1, 4, 5, 7, 9, 10 (and 2, 11 for gain) good; 6, 8, 12 bad; dignity good or bad as tabulated. */
export function placementVerdict(m: VedicChartModel, p: Graha, gain: boolean): Verdict {
  const h = m.houseOf(p);
  const kind = m.dignity(p).kind;
  const good = [1, 4, 5, 7, 9, 10, ...(gain ? [2, 11] : [])];
  return combine(good.includes(h) || DIGNITY_GOOD.includes(kind), DUSTHANA.includes(h) || DIGNITY_BAD.includes(kind));
}

const placementNatal = lordRule('parashari.dasha-lord-placement-natal', (m, p) => {
  if (!isGraha(p)) return [];
  const base = placementVerdict(m, p, false);
  const gain = placementVerdict(m, p, true);
  const facts = (v: Verdict): Fact[] => [
    fact('planet', 'Planet', p),
    fact('dignity', 'Dignity', dignityIs(m.dignity(p).kind)),
    fact('h', 'House from the Lagna', m.houseOf(p)),
    fact('direction', 'Reading of the period', v!),
  ];
  if (base === gain) return base === null ? [] : [{ facts: facts(base) }];
  return [
    ...(base === null ? [] : [{ facts: facts(base), topics: ['general', 'career'] as Topic[] }]),
    ...(gain === null ? [] : [{ facts: facts(gain), topics: ['wealth'] as Topic[] }]),
  ];
});

/** The sidereal placements of the seven planets at one instant, as the dignity function reads them. */
function skyAt(utcMs: number): Placement[] {
  return GRAHAS.map((p) => {
    const s = signOfLongitude(norm360(siderealLongitude(longitudeOf(p as Planet, utcMs), utcMs)));
    return { planet: p, signIndex: s.index, degree: s.degree };
  });
}

/** The mahadasha lord's sign at the instant the dasha begins, counted from the natal Lagna. */
const placementAtStart: RuleBinding = {
  ruleId: 'parashari.dasha-lord-placement-at-start',
  tradition: 'vedic',
  requires: { birthTime: true },
  fire(ctx) {
    const m = model(ctx);
    const out: Firing[] = [];
    for (const s of overlapping(ctx, ctx.dashas().maha)) {
      if (!isGraha(s.lord)) continue; // no dignity is assessed for the nodes
      const sky = skyAt(s.startUtcMs);
      const at = sky.find((x) => x.planet === s.lord)!;
      const h = houseFrom(at.signIndex, m.lagnaSign);
      const d = dignityOf(s.lord, at.signIndex, at.degree, sky);
      const own = d.kind === 'own sign' || d.kind === 'moolatrikona';
      const fav = [1, 5, 9].includes(h) || d.kind === 'exalted' || own || d.kind === 'friend' || d.kind === 'great friend';
      const unfav = DUSTHANA.includes(h) || d.kind === 'debilitated' || d.kind === 'enemy' || d.kind === 'great enemy';
      if (!fav && !unfav) continue;
      out.push(dated(s, { facts: [fact('planet', 'Planet', s.lord), fact('h', 'House from the Lagna', h), fact('dignity', 'Dignity', dignityIn(d.kind))] }));
    }
    return out;
  },
};

/** Strong enough for the wealth-house placement rule: not debilitated and not joined to, or fully aspected by, a natural malefic. */
function unafflicted(m: VedicChartModel, p: Graha): boolean {
  if (debilitated(m, p)) return false;
  return !m.placements.some((x) => x.planet !== p && m.naturalNature(x.planet) === 'malefic' && (x.signIndex === signOf(m, p) || aspectsSeventh(x.signIndex, signOf(m, p))));
}

/** Sun, Moon, Mars, Rahu and Ketu are the planets the rule file records; the others emit nothing. */
const wealthHouses = lordRule('parashari.dasha-lord-in-wealth-houses', (m, p) => {
  const h = m.houseOf(p);
  const item = (conflict: boolean): Item[] => [{ facts: [fact('planet', 'Planet', p), fact('h', 'House', h)], badges: conflict ? [BADGES.schoolConflict] : [] }];
  // Ch.48 sl.18-20 calls planets in the 11th unfavourable, except the nodes: the two statements are both shown.
  if (p === 'Rahu' || p === 'Ketu') return h === 11 ? item(false) : [];
  if (!isGraha(p)) return [];
  if (p === 'Sun') {
    const secondLord = m.lordOf(2);
    const ok = h === 11 || (h === 2 && secondLord !== p && signOf(m, secondLord) === signOf(m, p));
    return ok && unafflicted(m, p) ? item(h === 11) : [];
  }
  if (p === 'Moon') {
    const aspected = m.placements.some((x) => x.planet !== p && m.naturalNature(x.planet) === 'benefic' && aspectsSeventh(x.signIndex, signOf(m, p)));
    return (h === 2 || h === 11) && unafflicted(m, p) && aspected ? item(h === 11) : [];
  }
  if (p === 'Mars') {
    const k = m.dignity(p).kind;
    const ok = h === 2 || h === 11 || KENDRA.includes(h) || k === 'exalted' || k === 'own sign' || k === 'moolatrikona';
    return ok && unafflicted(m, p) ? item(h === 11) : [];
  }
  return [];
});

// ------------------------------------------------------------- association, exchange, nodes, timing

/** Joined (same sign) to a lord of 2, 4, 5, 9, 10 raises; to a lord of 6, 8, 12 or a malefic lowers. Aspect is not bound: the sentence says "joined by". Where both lists name a companion, its functional nature decides; where that is silent nothing is said. */
const association = lordRule('parashari.dasha-lord-association', (m, p) => {
  const out: Item[] = [];
  for (const c of companions(m, p)) {
    if (!isGraha(c)) continue; // the nodes own no house and have no natural nature in the source
    const owned = m.housesOwnedBy(c);
    const up = owned.some((h) => [2, 4, 5, 9, 10].includes(h));
    const down = owned.some((h) => DUSTHANA.includes(h)) || m.naturalNature(c) === 'malefic';
    let verb: string | null = up && !down ? 'raises' : down && !up ? 'lowers' : null;
    if (up && down) verb = m.functionalNature(c) === 'benefic' ? 'raises' : m.functionalNature(c) === 'malefic' ? 'lowers' : null;
    if (verb) out.push({ facts: [fact('planet', 'Planet', p), fact('companion', 'Joined by', c), fact('raises_or_lowers', 'Effect on the period', verb)] });
  }
  return out;
});

/** The 9th lord in the Lagna with the Lagna lord in the 9th, or the same with the 10th; the dashas of both planets. */
const exchange: RuleBinding = {
  ruleId: 'parashari.lagna-karma-lord-exchange',
  tradition: 'vedic',
  requires: { birthTime: true },
  fire(ctx) {
    const m = model(ctx);
    const l1 = m.lordOf(1);
    const out: Firing[] = [];
    for (const h of [9, 10]) {
      const lh = m.lordOf(h);
      if (lh === l1 || m.houseOf(lh) !== 1 || m.houseOf(l1) !== h) continue;
      for (const s of overlapping(ctx, ctx.dashas().maha)) {
        if (s.lord !== l1 && s.lord !== lh) continue;
        out.push(dated(s, { facts: [fact('planet', 'Planet', s.lord), fact('h', 'House', h)], topics: (h === 9 ? ['general'] : ['career', 'general']) as Topic[] }));
      }
    }
    return out;
  },
};

/** Rahu, by house and company (Ch.47 sl.34-43, Ch.48 sl.20). Ketu is not bound: the rule file says its verses were not read, and a signal for it would carry the rule's mixed direction. */
const nodeDasha = lordRule('parashari.node-dasha', (m, p) => {
  if (p !== 'Rahu') return [];
  const h = m.houseOf('Rahu');
  const mates = companions(m, 'Rahu').filter(isGraha);
  const judge = (c: Graha | null): Item[] => {
    const nature = c ? m.naturalNature(c) : 'unstated';
    const maraka = c ? m.housesOwnedBy(c).some((x) => x === 2 || x === 7) : false;
    const fav = [3, 6, 11].includes(h) || ([1, 4, 7, 10].includes(h) && nature === 'benefic');
    const unfav = h === 8 || h === 12 || nature === 'malefic' || maraka;
    const v = combine(fav, unfav);
    return v === null ? [] : [{ facts: [fact('node', 'Node', 'Rahu'), fact('h', 'House from the Lagna', h), fact('planet', 'Joined by', c ?? 'no planet'), fact('direction', 'Reading of the period', v)] }];
  };
  return mates.length === 0 ? judge(null) : mates.flatMap((c) => judge(c));
});

const planetRetrograde = (p: string, utcMs: number): boolean => p === 'Rahu' || p === 'Ketu' || (p !== 'Sun' && p !== 'Moon' && speedOf(p as Planet, utcMs) < 0);

/** The third of its own period in which the lord's effects fall, from its natal degree in its sign; reversed when retrograde at birth and always for the nodes. */
const timing: RuleBinding = {
  ruleId: 'parashari.dasha-timing-within-period',
  tradition: 'vedic',
  requires: { birthTime: true },
  fire(ctx) {
    const m = model(ctx);
    const out: Firing[] = [];
    for (const s of overlapping(ctx, ctx.dashas().maha)) {
      const at = m.placements.find((x) => x.planet === s.lord)!;
      let third = Math.min(2, Math.floor(at.degree / 10));
      if (planetRetrograde(s.lord, ctx.input.moment.utcMs)) third = 2 - third;
      const len = (s.endUtcMs - s.startUtcMs) / 3;
      out.push({
        clock: 'dasha',
        startUtcMs: s.startUtcMs + third * len,
        endUtcMs: s.startUtcMs + (third + 1) * len,
        facts: [fact('planet', 'Planet', s.lord), fact('third', 'Part of the period', ['first third', 'middle third', 'last third'][third]! + ' of the period')],
        conventionsUsed: CONVENTIONS,
      });
    }
    return out;
  },
};

// ------------------------------------------------------------- antardasha rules

/** The places from the mahadasha lord the text names as unfavourable, planet by planet. A planet whose verses are not recorded has no entry and says nothing. */
export const ANTAR_DUSTHANA: Readonly<Record<string, readonly number[]>> = { Moon: [6, 8, 12], Mars: [8, 12], Rahu: [8, 12], Jupiter: [6, 8] };

/** Kendra, trikona and the 11th from the mahadasha lord. */
export const ANTAR_GOOD_PLACES: readonly number[] = [1, 4, 5, 7, 9, 10, 11];

function antarRule(ruleId: string, judge: (m: VedicChartModel, maha: string, antar: string) => Item[]): RuleBinding {
  return {
    ruleId,
    tradition: 'vedic',
    requires: { birthTime: true },
    fire(ctx) {
      const m = model(ctx);
      return overlapping(ctx, ctx.dashas().antar).flatMap((s) => {
        const { maha, antar } = antarLordOf(s);
        return judge(m, maha, antar).map((it) => dated(s, it));
      });
    },
  };
}

const placeFrom = (m: VedicChartModel, maha: string, antar: string): number => houseFrom(signOf(m, antar), signOf(m, maha));
const placeFacts = (maha: string, antar: string, n: number): Fact[] => [fact('antar', 'Antardasha lord', antar), fact('n', 'Place from the dasha lord', n), fact('maha', 'Mahadasha lord', maha)];

const antarDusthana = antarRule('parashari.antardasha-from-dasha-lord-dusthana', (m, maha, antar) => {
  const n = placeFrom(m, maha, antar);
  return maha !== antar && (ANTAR_DUSTHANA[antar] ?? []).includes(n) ? [{ facts: placeFacts(maha, antar, n) }] : [];
});

const antarKendra = antarRule('parashari.antardasha-from-dasha-lord-kendra', (m, maha, antar) => {
  const n = placeFrom(m, maha, antar);
  return maha !== antar && ANTAR_GOOD_PLACES.includes(n) ? [{ facts: placeFacts(maha, antar, n) }] : [];
});

/** The antardasha lord's own condition, counted from the Lagna. The same-planet case is stated only for the Sun in the Sun's dasha. Nodes are not assessed. */
const antarStrength = antarRule('parashari.antardasha-lord-strength', (m, maha, antar) => {
  if (!isGraha(antar) || (maha === antar && antar !== 'Sun')) return [];
  const d = m.dignity(antar);
  const h = m.houseOf(antar);
  const mates = companions(m, antar).filter(isGraha);
  const friendly = mates.some((c) => {
    const r = compoundRelationship(naturalRelationship(antar, c), temporaryFriend(signOf(m, antar), signOf(m, c)));
    return r === 'friend' || r === 'great friend';
  });
  const fav = DIGNITY_GOOD.includes(d.kind) || ANTAR_GOOD_PLACES.includes(h) || friendly;
  const unfav = d.kind === 'debilitated' || DUSTHANA.includes(h) || mates.some((c) => m.naturalNature(c) === 'malefic');
  const v = combine(fav, unfav);
  return v === null ? [] : [{ facts: [fact('antar', 'Antardasha lord', antar), fact('dignity', 'Dignity', dignityIs(d.kind)), fact('h', 'House from the Lagna', h), fact('direction', 'Reading of the sub-period', v === 'unfavourable' ? 'difficult' : v)] }];
});

/** The text states Surya, Candra and Mangala; the other planets are unread and say nothing. */
const antarMaraka = antarRule('parashari.antardasha-maraka', (m, _maha, antar) =>
  ['Sun', 'Moon', 'Mars'].includes(antar) && m.housesOwnedBy(antar as Graha).some((h) => h === 2 || h === 7) ? [{ facts: [fact('antar', 'Antardasha lord', antar), fact('planet', 'Planet', antar)] }] : [],
);

export const DASHA_BINDINGS: readonly RuleBinding[] = [
  wealth59,
  wealthHouses,
  career10,
  education59,
  fourthHome,
  travel,
  partnership7,
  maraka,
  evil6812,
  redeemed,
  evil311,
  placementNatal,
  placementAtStart,
  association,
  exchange,
  nodeDasha,
  timing,
  antarDusthana,
  antarKendra,
  antarStrength,
  antarMaraka,
];
