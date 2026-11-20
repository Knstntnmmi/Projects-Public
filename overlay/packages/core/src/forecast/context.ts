// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The context a binding reads: everything the engine already computes for a nativity and
 * a span, each piece computed once on first use. A tradition extends it with its own
 * context builder (predicates/<tradition>.ts), which also runs once and may read the base.
 */
import type { Conventions } from '../conventions.ts';
import { annualPillars, fourPillars, luck, monthlyPillars, type FourPillars, type Luck, type PillarSpan, type Sex } from '../systems/bazi/index.ts';
import { guaQiSpans, SOVEREIGN_SEQUENCE, type Hexagram, type HexagramSpan } from '../systems/iching/index.ts';
import { bisectChange, longitudeOf, meanNodeLongitude, nextSunLongitude, norm360, type Planet } from '../substrate/sky.ts';
import { MS, type Moment } from '../substrate/time.ts';
import { siderealLongitude, vimshottari, type DashaSpan } from '../systems/vedic/index.ts';
import { chart, SIGNS, signOf, type Chart, type LordSpan } from '../systems/western/index.ts';
import { sexOf, type ForecastConventions } from './conventions.ts';
import type { Slice, Span, Tradition } from './types.ts';

export interface ForecastInput {
  moment: Moment;
  conventions: Conventions;
  forecastConventions: ForecastConventions;
  /** Aligned to whole calendar years: see sliceSpan. */
  span: Span;
  /** Minutes the stated birth time could be off by; null when no birth time was given. */
  birthTimeUncertaintyMinutes: number | null;
}

/** A point on the sidereal zodiac, with the whole-sign house it falls in from the sidereal Lagna. */
export interface SiderealPoint {
  name: string;
  longitude: number;
  signIndex: number;
  sign: string;
  degree: number;
  house: number;
}

export interface SiderealChart {
  lagna: SiderealPoint;
  /** Sun to Saturn, Rahu and Ketu (the mean node). */
  points: SiderealPoint[];
}

export interface SovereignSpan {
  hexagram: Hexagram;
  startUtcMs: number;
  endUtcMs: number;
}

export interface ForecastContext {
  readonly input: ForecastInput;
  readonly slices: readonly Slice[];
  /** The sex the BaZi chart is read as, or null when no convention was named. */
  readonly sex: Sex | null;
  /** Computes a value once per context and key. The key must say everything the value depends on. */
  memo<T>(key: string, compute: () => T): T;
  pillars(): FourPillars;
  /** Luck pillars covering the span; null without a sex convention, because their direction needs it. */
  luck(): Luck | null;
  annualPillars(): PillarSpan[];
  chart(): Chart;
  siderealChart(): SiderealChart;
  dashas(): { maha: DashaSpan[]; antar: DashaSpan[] };
  /** Sign ingresses of a planet over the span, in the tropical or sidereal zodiac. */
  ingresses(planet: Planet, frame: 'tropical' | 'sidereal'): LordSpan[];
  /** Gua qi hexagram periods under the engine's guaQi convention. */
  guaQi(): HexagramSpan[];
  /** Sovereign hexagram periods under the engine's sovereignBoundary convention. */
  sovereign(): SovereignSpan[];
  /** What the tradition's own context builder returned (undefined for a stub). */
  extension<T>(tradition: Tradition): T | undefined;
}

export type ContextBuilder = (base: ForecastContext) => unknown;

const YEAR_MS = 365.25 * MS.DAY;

/** The calendar-year slices overlapping a span. */
export function slicesOf(span: Span): Slice[] {
  const first = new Date(span.startUtcMs).getUTCFullYear();
  const last = new Date(span.endUtcMs - 1).getUTCFullYear();
  const out: Slice[] = [];
  for (let y = first; y <= last; y++) out.push(yearSlice(y, y - first));
  return out;
}

function yearSlice(year: number, index: number): Slice {
  const start = new Date(0);
  start.setUTCFullYear(year, 0, 1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(0);
  end.setUTCFullYear(year + 1, 0, 1);
  end.setUTCHours(0, 0, 0, 0);
  return { index, year, label: String(year), startUtcMs: start.getTime(), endUtcMs: end.getTime() };
}

/** The span from the first of January of one year to the first of January after another. */
export function sliceSpan(fromYear: number, toYear: number): Span {
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || toYear < fromYear) throw new RangeError('toYear must not be before fromYear');
  return { startUtcMs: yearSlice(fromYear, 0).startUtcMs, endUtcMs: yearSlice(toYear, 0).endUtcMs };
}

function siderealPoint(name: string, tropical: number, utcMs: number, lagnaSign: number | null): SiderealPoint {
  const longitude = norm360(siderealLongitude(tropical, utcMs));
  const s = signOf(longitude);
  return { name, longitude, signIndex: s.index, sign: s.sign, degree: s.degree, house: lagnaSign === null ? 1 : ((s.index - lagnaSign + 12) % 12) + 1 };
}

/** Spans in which a planet stays in one sign, in either zodiac; the same walk as western.signIngresses. */
export function ingressSpans(planet: Planet, frame: 'tropical' | 'sidereal', startMs: number, endMs: number, stepDays: number): LordSpan[] {
  const signAt = (ms: number): number => {
    const lon = longitudeOf(planet, ms);
    return signOf(frame === 'sidereal' ? norm360(siderealLongitude(lon, ms)) : lon).index;
  };
  const step = stepDays * MS.DAY;
  let t = startMs;
  let cur = signAt(t);
  let spanStart = startMs;
  for (let back = t - step, n = 0; n < 5000; back -= step, n++) {
    if (signAt(back) !== cur) {
      spanStart = bisectChange(signAt, back, back + step);
      break;
    }
  }
  const out: LordSpan[] = [];
  while (t < endMs) {
    const next = t + step;
    const s = signAt(next);
    if (s !== cur) {
      const change = bisectChange(signAt, t, next);
      out.push({ label: SIGNS[cur]!, lord: planet, startUtcMs: spanStart, endUtcMs: change });
      spanStart = change;
      cur = s;
    }
    t = next;
  }
  let closing = t;
  for (let n = 0; n < 5000 && signAt(closing) === cur; n++) closing += step;
  out.push({ label: SIGNS[cur]!, lord: planet, startUtcMs: spanStart, endUtcMs: bisectChange(signAt, closing - step, closing) });
  return out;
}

/** Sovereign hexagram periods; the same arithmetic as the monthly track of buildTracks. */
export function sovereignSpans(startMs: number, endMs: number, boundary: Conventions['sovereignBoundary']): SovereignSpan[] {
  const out: SovereignSpan[] = [];
  for (const p of monthlyPillars(startMs, endMs)) {
    const b = p.cycle.branch.index;
    if (boundary === 'jie') {
      out.push({ hexagram: SOVEREIGN_SEQUENCE[b]!, startUtcMs: p.startUtcMs, endUtcMs: p.endUtcMs });
      continue;
    }
    // Under zhongqi the previous month's hexagram runs on until the Sun is fifteen degrees past the jie.
    const jie = norm360(315 + 30 * ((b + 10) % 12));
    const mid = nextSunLongitude(norm360(jie + 15), p.startUtcMs);
    out.push({ hexagram: SOVEREIGN_SEQUENCE[(b + 11) % 12]!, startUtcMs: p.startUtcMs, endUtcMs: mid });
    out.push({ hexagram: SOVEREIGN_SEQUENCE[b]!, startUtcMs: mid, endUtcMs: p.endUtcMs });
  }
  return out;
}

export function createContext(input: ForecastInput, builders: Partial<Record<Tradition, ContextBuilder>> = {}): ForecastContext {
  const cache = new Map<string, unknown>();
  const memo = <T>(key: string, compute: () => T): T => {
    if (cache.has(key)) return cache.get(key) as T;
    const v = compute();
    cache.set(key, v);
    return v;
  };
  const { moment, conventions, span } = input;
  const sex = sexOf(input.forecastConventions);
  const slices = slicesOf(span);
  const ageAtEnd = Math.max(1, Math.ceil((span.endUtcMs - moment.utcMs) / YEAR_MS) + 1);

  const ctx: ForecastContext = {
    input,
    slices,
    sex,
    memo,
    pillars: () => memo('pillars', () => fourPillars(moment, conventions)),
    luck: () => (sex ? memo('luck', () => luck(moment, conventions, sex, Math.max(10, Math.ceil(ageAtEnd / 10) + 1))) : null),
    annualPillars: () => memo('annualPillars', () => annualPillars(span.startUtcMs, span.endUtcMs)),
    chart: () => memo('chart', () => chart(moment)),
    siderealChart: () =>
      memo('siderealChart', () => {
        const c = ctx.chart();
        const lagna = siderealPoint('Lagna', c.ascendant, moment.utcMs, null);
        const lagnaSign = lagna.signIndex;
        const points = c.positions.map((p) => siderealPoint(p.planet, p.longitude, moment.utcMs, lagnaSign));
        const rahu = siderealPoint('Rahu', meanNodeLongitude(moment.utcMs), moment.utcMs, lagnaSign);
        const ketu = siderealPoint('Ketu', norm360(meanNodeLongitude(moment.utcMs) + 180), moment.utcMs, lagnaSign);
        return { lagna: { ...lagna, house: 1 }, points: [...points, rahu, ketu] };
      }),
    dashas: () => memo('dashas', () => vimshottari(moment, ageAtEnd + 1)),
    ingresses: (planet, frame) =>
      memo(`ingresses:${planet}:${frame}`, () => ingressSpans(planet, frame, span.startUtcMs, span.endUtcMs, planet === 'Saturn' ? 6 : planet === 'Jupiter' ? 4 : 2)),
    guaQi: () => memo('guaQi', () => guaQiSpans(span.startUtcMs, span.endUtcMs, conventions.guaQi)),
    sovereign: () => memo('sovereign', () => sovereignSpans(span.startUtcMs, span.endUtcMs, conventions.sovereignBoundary).filter((s) => s.endUtcMs > span.startUtcMs && s.startUtcMs < span.endUtcMs)),
    extension: <T>(tradition: Tradition): T | undefined => {
      const build = builders[tradition];
      return build ? memo<T | undefined>(`extension:${tradition}`, () => build(ctx) as T | undefined) : undefined;
    },
  };
  return ctx;
}
