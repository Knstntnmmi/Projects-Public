// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Invented BaZi charts for the tests: four pillars named by their characters, with no date
 * behind them. They stand for nobody; they exist so that each grade of a rule can be reached
 * on purpose and checked by hand.
 */
import { BRANCHES, sixtyCycle, STEMS, tenGod, type FourPillars, type Pillar } from '../../src/systems/bazi/index.ts';
import type { ForecastContext } from '../../src/forecast/context.ts';
import { DEFAULT_FORECAST_CONVENTIONS, type ForecastConventions } from '../../src/forecast/conventions.ts';
import { assessNatal, type NatalAssessment } from '../../src/forecast/predicates/bazi/assessment.ts';
import { NATAL_BINDINGS } from '../../src/forecast/predicates/bazi/natal.ts';
import { STAR_BINDINGS } from '../../src/forecast/predicates/bazi/starBindings.ts';
import type { Firing, Rule, RuleBinding } from '../../src/forecast/types.ts';
import { DEFAULT_REGISTRY } from '../../src/forecast/registry.ts';
import * as baziModule from '../../src/forecast/predicates/bazi.ts';
import { fixture } from '../../../../fixtures/moments.ts';

export const cycleIndex = (hanzi: string): number => {
  const s = STEMS.findIndex((x) => x.hanzi === hanzi[0]);
  const b = BRANCHES.findIndex((x) => x.hanzi === hanzi[1]);
  for (let i = s; i < 60; i += 10) if (i % 12 === b) return i;
  throw new Error(`${hanzi} is not a sexagenary pillar`);
};

/** Four pillars from four two-character names, year month day hour. */
export function chart(year: string, month: string, day: string, hour: string): FourPillars {
  const dm = cycleIndex(day) % 10;
  const mk = (name: string, isDay: boolean): Pillar => {
    const c = sixtyCycle(cycleIndex(name));
    return { ...c, stemGod: isDay ? null : tenGod(dm, c.stem.index), hidden: c.branch.hidden.map((s) => ({ stem: STEMS[s]!, god: tenGod(dm, s) })) };
  };
  return {
    year: mk(year, false),
    month: mk(month, false),
    day: mk(day, true),
    hour: mk(hour, false),
    // the clock reading is not used by anything the natal rules read; the epoch fixture stands in
    clock: fixture('j2000').civil,
    clockOffsetMinutes: 0,
    cycleYear: 2000,
    sunLongitude: 0,
  };
}

export const assess = (p: FourPillars, fc: Partial<ForecastConventions> = {}): NatalAssessment => assessNatal(p, { ...DEFAULT_FORECAST_CONVENTIONS, ...fc });

/** A context good enough for the natal bindings: they read only the assessment, the sex and (for stars) the annual pillars. */
export function fakeContext(p: FourPillars, sex: 'male' | 'female' | null = null, fc: Partial<ForecastConventions> = {}): ForecastContext {
  const natal = assess(p, fc);
  return {
    sex,
    pillars: () => p,
    annualPillars: () => [],
    luck: () => null,
    extension: () => ({ natal }),
  } as unknown as ForecastContext;
}

const BY_ID = new Map<string, RuleBinding>([...NATAL_BINDINGS, ...STAR_BINDINGS].map((b) => [b.ruleId, b]));
export const ruleOf = (id: string): Rule => DEFAULT_REGISTRY.rules.find((r) => r.id === id)!;

export function fire(id: string, p: FourPillars, sex: 'male' | 'female' | null = null, fc: Partial<ForecastConventions> = {}): Firing[] {
  return BY_ID.get(id)!.fire(fakeContext(p, sex, fc), ruleOf(id));
}

export const factOf = (f: Firing, key: string): string | number | undefined => f.facts.find((x) => x.key === key)?.value;

/** A seeded stream of invented charts, every pillar a real sexagenary pair. */
export function* randomCharts(seed: number, count: number): Generator<FourPillars> {
  let s = seed >>> 0;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
  const name = (): string => sixtyCycle(Math.floor(next() * 60)).hanzi;
  for (let i = 0; i < count; i++) yield chart(name(), name(), name(), name());
}

// ---------------------------------------------------------------------------
// Period contexts: luck pillars and annual pillars built from characters, with windows given as milliseconds
// ---------------------------------------------------------------------------

export const DAY_MS = 86_400_000;
/** A stand-in origin for invented windows; its calendar date is not used by anything. */
export const T0 = 1_900_000_000_000;
/** The calendar year of an invented instant, for the sentences that name a year. */
export const yearOfMs = (ms: number): number => new Date(ms).getUTCFullYear();

export interface PeriodSpec {
  /** The pillar's two characters, for example 庚午. */
  pillar: string;
  startUtcMs: number;
  endUtcMs: number;
}

export interface PeriodContextOptions {
  sex?: 'male' | 'female' | null;
  luck?: PeriodSpec[];
  years?: PeriodSpec[];
  fc?: Partial<ForecastConventions>;
}

/** A context with the natal assessment, the given luck pillars (only if a sex is given) and annual pillars. */
export function periodContext(p: FourPillars, o: PeriodContextOptions = {}): ForecastContext {
  const sex = o.sex ?? null;
  const fc = { ...DEFAULT_FORECAST_CONVENTIONS, ...o.fc };
  const natal = assess(p, fc);
  const cache = new Map<string, unknown>();
  const span = (s: PeriodSpec) => ({ cycle: sixtyCycle(cycleIndex(s.pillar)), startUtcMs: s.startUtcMs, endUtcMs: s.endUtcMs });
  const luck = sex && o.luck ? { forward: true, pillars: o.luck.map((s, i) => ({ ordinal: i + 1, ...span(s) })) } : null;
  return {
    sex,
    input: { forecastConventions: fc },
    pillars: () => p,
    annualPillars: () => (o.years ?? []).map(span),
    luck: () => luck,
    memo: <T>(key: string, compute: () => T): T => {
      if (!cache.has(key)) cache.set(key, compute());
      return cache.get(key) as T;
    },
    extension: () => ({ natal }),
  } as unknown as ForecastContext;
}

const ALL = new Map<string, RuleBinding>(baziModule.BINDINGS.map((b) => [b.ruleId, b]));

/** Fire one bound rule in a period context. */
export const firePeriod = (id: string, ctx: ForecastContext): Firing[] => ALL.get(id)!.fire(ctx, ruleOf(id));

export const bindingOf = (id: string): RuleBinding => ALL.get(id)!;

/** A year pillar window of a given length in days, starting a number of days after T0. */
export const yearAt = (pillar: string, dayOffset = 0, days = 365): PeriodSpec => ({ pillar, startUtcMs: T0 + dayOffset * DAY_MS, endUtcMs: T0 + (dayOffset + days) * DAY_MS });
