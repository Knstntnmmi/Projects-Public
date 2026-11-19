// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Jupiter and Saturn counted from the natal Moon (gochara), with the obstruction (vedha)
 * pairs of Phaladeepika Adh.XXVI, as the rule file tabulates them. A transit signal covers
 * the whole stay of the planet in a sidereal sign, from the engine's sign-ingress dates, on
 * the sidereal clock of that planet. Vedha is a modifier: it is its own signal over the
 * moment the obstructing planet stands in the vedha house, and the framework attaches it to
 * the transit signal it overlaps. Every rule here counts from the Moon's sign, so every rule
 * needs the birth time; the transit-sign-portion annotation does not.
 */
import type { ClockId, Firing, RuleBinding, Topic } from '../../types.ts';
import { ingressSpans, type ForecastContext } from '../../context.ts';
import { bisectChange, longitudeOf, norm360, type Planet } from '../../../substrate/sky.ts';
import { siderealLongitude } from '../../../systems/vedic/index.ts';
import { SIGNS, signOf } from '../../../systems/western/index.ts';
import { iso, model } from './common.ts';

type Slow = 'Jupiter' | 'Saturn';
const CLOCK: Readonly<Record<Slow, ClockId>> = { Jupiter: 'jupiter-sidereal', Saturn: 'saturn-sidereal' };
const CONVENTIONS = ['ayanamsa'];

/** On a good-transit signal when the vedha rule finds an obstruction inside its stay. */
export const OBSTRUCTED = 'obstructed in part (vedha)';

/** The stay of a slow planet in one sidereal sign, with its house from the natal Moon. */
interface Stay {
  startUtcMs: number;
  endUtcMs: number;
  h: number;
}

const stays = (ctx: ForecastContext, planet: Slow): Stay[] => {
  const m = model(ctx);
  return ctx.ingresses(planet, 'sidereal').map((s) => ({ startUtcMs: s.startUtcMs, endUtcMs: s.endUtcMs, h: m.signHouseFromMoon(SIGNS.indexOf(s.label as (typeof SIGNS)[number])) }));
};

function transit(ruleId: string, planet: Slow, houses: readonly number[], topicsOf: (h: number) => Topic[]): RuleBinding {
  const vedhaOf = VEDHA[planet];
  return {
    ruleId,
    tradition: 'vedic',
    requires: { birthTime: true },
    fire(ctx) {
      return stays(ctx, planet)
        .filter((s) => houses.includes(s.h))
        .map(
          (s): Firing => ({
            badges: vedhaOf[s.h] !== undefined && obstructions(ctx, planet).some((o) => o.h === s.h && o.startUtcMs < s.endUtcMs && o.endUtcMs > s.startUtcMs) ? [OBSTRUCTED] : [],
            clock: CLOCK[planet],
            startUtcMs: s.startUtcMs,
            endUtcMs: s.endUtcMs,
            facts: [
              { key: 'h', label: 'House from the natal Moon', value: s.h },
              { key: 'start', label: 'Enters the sign', value: iso(s.startUtcMs), unit: 'date' },
              { key: 'end', label: 'Leaves the sign', value: iso(s.endUtcMs), unit: 'date' },
            ],
            topics: topicsOf(s.h),
            conventionsUsed: CONVENTIONS,
          }),
        );
    },
  };
}

// Topics follow the effects the rule file names for each house; the comment on each says which word.
export const JUPITER_GOOD: Readonly<Record<number, Topic[]>> = {
  2: ['wealth'], // money
  5: ['general'], // children, friendship, royal favour; learning is not named
  7: ['relationships'], // happiness with wife
  9: ['general', 'wealth'], // all prosperity; wealth per Raman
  11: ['career'], // new position, honour
};
export const JUPITER_OTHER: Readonly<Record<number, Topic[]>> = {
  1: ['wealth', 'general'], // expenditure; leaving one's country
  3: ['career', 'wealth', 'health'], // loss of position, obstacle in business, disease
  4: ['general'], // sorrow through relations
  6: ['health', 'general'], // enemies, disease
  8: ['wealth', 'health'], // loss of money, fatigue
  10: ['wealth', 'career'], // danger to property, position
  12: ['wealth', 'general'], // grief and fear over property
};
export const SATURN_GOOD: Readonly<Record<number, Topic[]>> = {
  3: ['career', 'wealth', 'general'], // position, employment, money
  6: ['general'], // happiness all round
  11: ['wealth', 'career', 'general'], // happiness, wealth, honour
};
export const SATURN_OTHER: Readonly<Record<number, Topic[]>> = {
  4: ['wealth', 'relationships'], // loss of wife, relatives and wealth
  5: ['wealth'], // wealth declines
  7: ['relationships'], // wife suffers
  9: ['wealth'], // loss in finance
  10: ['career', 'health', 'wealth'], // loss of honour, disease; Raman adds loss of wealth
};

const keys = (t: Readonly<Record<number, Topic[]>>): number[] => Object.keys(t).map(Number);

/** The three per-sign Saturn rules cover all topics of the rule in every case. */
const allTopics = (ctx: Topic[]) => (): Topic[] => ctx;

// ------------------------------------------------------------- vedha

/** Good house and its vedha house, counted from the natal Moon: Jupiter (Phaladeepika sl.2-8), Saturn. */
export const VEDHA: Readonly<Record<Slow, Readonly<Record<number, number>>>> = {
  Jupiter: { 2: 12, 11: 8, 9: 10, 5: 4, 7: 3 },
  Saturn: { 3: 12, 6: 9, 11: 5 },
};

/** Planets whose standing in the vedha house obstructs; the nodes are not named, the Sun does not obstruct Saturn. */
export const OBSTRUCTORS: Readonly<Record<Slow, readonly Planet[]>> = {
  Jupiter: ['Sun', 'Moon', 'Mars', 'Mercury', 'Venus', 'Saturn'],
  Saturn: ['Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus'],
};

/** One moment, inside one good stay, at which another planet stands in the vedha house. */
interface Obstruction {
  h: number;
  v: number;
  planet: Planet;
  startUtcMs: number;
  endUtcMs: number;
}

/** Every obstruction of the planet's good stays within the span, computed once. */
function obstructions(ctx: ForecastContext, planet: Slow): Obstruction[] {
  return ctx.memo(`vedic:obstructions:${planet}`, () => {
    const m = model(ctx);
    const { startUtcMs: from, endUtcMs: to } = ctx.input.span;
    const out: Obstruction[] = [];
    for (const s of stays(ctx, planet)) {
      const v = VEDHA[planet][s.h];
      const lo = Math.max(s.startUtcMs, from);
      const hi = Math.min(s.endUtcMs, to);
      if (v === undefined || hi <= lo) continue;
      for (const q of OBSTRUCTORS[planet]) {
        // The Moon changes sign in under three days, so it is walked daily; the others every two.
        for (const sp of ingressSpans(q, 'sidereal', lo, hi, q === 'Moon' ? 1 : 2)) {
          if (m.signHouseFromMoon(SIGNS.indexOf(sp.label as (typeof SIGNS)[number])) !== v) continue;
          const a = Math.max(sp.startUtcMs, lo);
          const b = Math.min(sp.endUtcMs, hi);
          if (b > a) out.push({ h: s.h, v, planet: q, startUtcMs: a, endUtcMs: b });
        }
      }
    }
    return out;
  });
}

/**
 * Vedha, as a modifier of its own. The framework attaches a modifier only to the signals of
 * the same topic, and vedha carries the one topic its rule file names, so the good-transit
 * signals of every topic also carry a badge when an obstruction falls inside their stay.
 */
function vedha(ruleId: string, planet: Slow): RuleBinding {
  return {
    ruleId,
    tradition: 'vedic',
    requires: { birthTime: true },
    fire: (ctx) =>
      obstructions(ctx, planet).map(
        (o): Firing => ({
          clock: CLOCK[planet],
          startUtcMs: o.startUtcMs,
          endUtcMs: o.endUtcMs,
          facts: [
            { key: 'h', label: 'Good house of the transit', value: o.h },
            { key: 'planet', label: 'Obstructing planet', value: o.planet },
            { key: 'v', label: 'Vedha house', value: o.v },
          ],
          conventionsUsed: CONVENTIONS,
        }),
      ),
  };
}

// ------------------------------------------------------------- the part of the sign

/** The portion of its sign in which a planet's transit effect is held to be strongest (Phaladeepika sl.25): the degree it starts at, ten degrees wide. */
const PORTION: Readonly<Record<Slow, { part: string; from: number }>> = {
  Jupiter: { part: 'middle', from: 10 }, // 10 to 20 degrees
  Saturn: { part: 'last', from: 20 }, // 20 to 30 degrees
};

/**
 * Sub-windows of the sign stays in which the slow planet is in its portion of the sign. It is
 * an annotation on the whole-sign signals and never replaces their span. Jupiter and Saturn
 * turn retrograde, so a portion may be entered more than once in one stay.
 */
function portion(ruleId: string): RuleBinding {
  return {
    ruleId,
    tradition: 'vedic',
    fire(ctx) {
      const { startUtcMs: from, endUtcMs: to } = ctx.input.span;
      const out: Firing[] = [];
      for (const planet of ['Jupiter', 'Saturn'] as const) {
        const { part, from: lo } = PORTION[planet];
        const band = (t: number): number => {
          const s = signOf(norm360(siderealLongitude(longitudeOf(planet, t), t)));
          return s.index * 3 + Math.min(2, Math.floor(s.degree / 10));
        };
        const wanted = lo / 10; // 0, 1 or 2
        const step = (planet === 'Jupiter' ? 4 : 6) * 86_400_000;
        let t = from;
        let cur = band(t);
        let runStart = t;
        const close = (end: number): void => {
          if (cur % 3 !== wanted || end <= runStart) return;
          out.push({
            clock: CLOCK[planet],
            startUtcMs: runStart,
            endUtcMs: end,
            facts: [
              { key: 'planet', label: 'Planet', value: planet },
              { key: 'part', label: 'Part of the sign', value: part },
            ],
            conventionsUsed: CONVENTIONS,
          });
        };
        while (t < to) {
          const next = Math.min(t + step, to);
          const b = band(next);
          if (b !== cur) {
            const change = bisectChange(band, t, next);
            close(change);
            cur = b;
            runStart = change;
          }
          t = next;
        }
        close(to);
      }
      return out;
    },
  };
}

export const TRANSIT_BINDINGS: readonly RuleBinding[] = [
  transit('parashari.jupiter-transit-good', 'Jupiter', keys(JUPITER_GOOD), (h) => JUPITER_GOOD[h]!),
  transit('parashari.jupiter-transit-other', 'Jupiter', keys(JUPITER_OTHER), (h) => JUPITER_OTHER[h]!),
  vedha('parashari.jupiter-vedha', 'Jupiter'),
  transit('parashari.saturn-transit-good', 'Saturn', keys(SATURN_GOOD), (h) => SATURN_GOOD[h]!),
  // Sade sati is three separate per-sign rules: the 12th, the 1st and the 2nd from the Moon, each with its own signals.
  transit('parashari.saturn-12th-from-moon', 'Saturn', [12], allTopics(['wealth', 'health', 'general'])),
  transit('parashari.saturn-1st-from-moon', 'Saturn', [1], allTopics(['health', 'wealth', 'general'])),
  transit('parashari.saturn-2nd-from-moon', 'Saturn', [2], allTopics(['wealth', 'general'])),
  transit('parashari.saturn-8th-from-moon', 'Saturn', [8], allTopics(['wealth', 'health', 'relationships'])),
  transit('parashari.saturn-transit-other', 'Saturn', keys(SATURN_OTHER), (h) => SATURN_OTHER[h]!),
  vedha('parashari.saturn-vedha', 'Saturn'),
  portion('parashari.transit-sign-portion'),
];
