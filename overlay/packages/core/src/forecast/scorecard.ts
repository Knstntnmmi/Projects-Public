// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The scorecard: the events a person recorded afterwards, set against the statements of
 * forecasts that were frozen before them. Plain counts only. There is no rate, no ratio, no
 * ranking and no total verdict, anywhere in this file or in what it returns.
 *
 * The rules, in the order the code applies them:
 *  1. An event can be scored only against a forecast frozen before the event's date (the start of
 *     the day, month or year it covers). A forecast frozen later is listed as frozen too late and
 *     never counted. Where several forecasts qualify, the earliest one that covers the event is used.
 *  2. For each event, every statement of that forecast for the event's topic whose own span of dates
 *     overlaps the event's dates is paired with the event. A statement that supports meets "went
 *     well" as held, and "went badly" as did not hold; a statement that cautions meets them the
 *     other way round. Mixed statements, notes without a direction and natal statements (which
 *     have no dates) are not scored, each with its reason.
 *  3. A technique that has bound rules for the topic but no statement over the event's dates said nothing.
 *  4. The comparison: the same events, each moved by a seeded circular shift of whole days
 *     inside the forecast span (one random fraction per run, applied to each event's own room;
 *     the new dates may precede the freeze date), scored against the same forecast; the held count of each run is
 *     compared with the real one. The shifted runs use the same pairing as the real one.
 */
import type { ForecastEvent, FrozenForecast, Nativity } from './events.ts';
import { eventWindow, freezeForecast, hashNativity } from './events.ts';
import { hashOf } from './hash.ts';
import { evaluate, makeInput, type ForecastResult } from './evaluate.ts';
import { seededRandom } from './baseline.ts';
import { levelOnSharedClock, levelRank, levelTradition } from './levels.ts';
import { RULESET_VERSION } from './rules.ts';
import type { Session } from './session.ts';
import { statementList, type StatementEntry } from './statements.ts';
import { makeMoment } from '../substrate/time.ts';
import { TRADITIONS, type LevelId, type Span, type Topic, type Tradition } from './types.ts';

export const SCORECARD_SCHEMA = 'overlay-scorecard/1';
export const SHUFFLE_RUNS = 1000;
export const SHUFFLE_SEED = 1;
/** Fewer scored statement-event pairs than this, and no comparison with shuffled dates is printed. */
export const MIN_PAIRS_TO_COMPARE = 10;
/** The longest span of years a frozen forecast may have and still be reproduced here. */
export const MAX_FROZEN_YEARS = 40;

const DAY = 86_400_000;

export type Outcome = 'held' | 'did-not-hold' | 'not-scored';
export type NotScoredReason = 'mixed' | 'no-direction' | 'natal';
export type EventStatus = 'scored' | 'frozen-too-late' | 'no-frozen-forecast' | 'outside-span' | 'not-reproducible';

export interface Counts {
  held: number;
  didNotHold: number;
  notScored: number;
  saidNothing: number;
}

export const emptyCounts = (): Counts => ({ held: 0, didNotHold: 0, notScored: 0, saidNothing: 0 });

export interface Pair {
  signalId: string;
  ruleId: string;
  tradition: Tradition;
  level: LevelId;
  outcome: Outcome;
  /** Why a pair is not scored; null for held and did not hold. */
  reason: NotScoredReason | null;
}

export interface SilentTechnique {
  level: LevelId;
  tradition: Tradition;
}

export interface EventResult {
  eventId: string;
  topic: Topic;
  valence: ForecastEvent['valence'];
  precision: ForecastEvent['precision'];
  dates: Span;
  status: EventStatus;
  /** The hash of the forecast the event was scored against; null when it was not scored. */
  forecastHash: string | null;
  pairs: Pair[];
  silent: SilentTechnique[];
}

export interface RuleRow {
  ruleId: string;
  tradition: Tradition;
  level: LevelId;
  counts: Counts;
}

export interface LevelRow {
  level: LevelId;
  tradition: Tradition | null;
  counts: Counts;
}

export interface TraditionRow {
  tradition: Tradition;
  counts: Counts;
}

export interface Comparison {
  runs: number;
  seed: number;
  /** Scored statement-event pairs: held plus did not hold. */
  pairs: number;
  held: number;
  /** In how many of the shifted runs the held count was at least the real one; null when there are too few pairs. */
  atLeast: number | null;
  tooFew: boolean;
}

export interface Scorecard {
  schema: typeof SCORECARD_SCHEMA;
  rulesetVersion: string;
  eventCount: number;
  frozenCount: number;
  events: EventResult[];
  /** held, did not hold, not scored and said nothing over every scored event. */
  totals: Counts;
  notScoredByReason: Record<NotScoredReason, number>;
  byRule: RuleRow[];
  byLevel: LevelRow[];
  byTradition: TraditionRow[];
  /** The techniques that run only on clocks of fixed arithmetic from the birth moment, counted once. */
  sharedClock: { levels: LevelId[]; counts: Counts };
  comparison: Comparison;
}

export interface ScoreOptions {
  runs?: number;
  seed?: number;
  /** Results of forecasts already re-evaluated, kept by the caller between calls so that a page does not evaluate again after every change. */
  cache?: Map<string, ForecastResult | null>;
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The outcome of a statement that points one way, against how the event went. */
export function outcomeOf(word: 'supports' | 'cautions', valence: ForecastEvent['valence']): 'held' | 'did-not-hold' {
  return (word === 'supports') === (valence === 'good') ? 'held' : 'did-not-hold';
}

const overlaps = (a: Span, startUtcMs: number, endUtcMs: number): boolean => startUtcMs < a.endUtcMs && a.startUtcMs < endUtcMs;

interface Pool {
  dated: StatementEntry[];
  pointers: StatementEntry[];
  natal: StatementEntry[];
  /** The techniques with at least one bound rule for the topic that are read by year, without the natal chart. */
  covered: Array<{ level: LevelId; tradition: Tradition }>;
}

function poolFor(result: ForecastResult, topic: Topic): Pool {
  const list = statementList(result, topic);
  const covered = result.levelCoverage
    .filter((c) => c.topic === topic && c.bound > 0 && c.level !== 'natal')
    .map((c) => ({ level: c.level, tradition: levelTradition(c.level)! }))
    .filter((c) => !result.periodRead.includes(c.tradition))
    .sort((a, b) => levelRank(a.level) - levelRank(b.level));
  return { dated: list.dated, pointers: list.pointers, natal: [...list.natal, ...list.natalPointers], covered };
}

function pairsFor(pool: Pool, dates: Span, valence: ForecastEvent['valence']): { pairs: Pair[]; silent: SilentTechnique[] } {
  const pairs: Pair[] = [];
  const spoke = new Set<LevelId>();
  const make = (e: StatementEntry, outcome: Outcome, reason: NotScoredReason | null): Pair => ({ signalId: e.signalId, ruleId: e.ruleId, tradition: e.tradition, level: e.level, outcome, reason });
  for (const e of pool.dated) {
    if (e.fullStartUtcMs === null || e.fullEndUtcMs === null || !overlaps(dates, e.fullStartUtcMs, e.fullEndUtcMs)) continue;
    spoke.add(e.level);
    if (e.word === 'supports' || e.word === 'cautions') pairs.push(make(e, outcomeOf(e.word, valence), null));
    else pairs.push(make(e, 'not-scored', 'mixed'));
  }
  for (const e of pool.pointers) {
    if (e.fullStartUtcMs === null || e.fullEndUtcMs === null || !overlaps(dates, e.fullStartUtcMs, e.fullEndUtcMs)) continue;
    spoke.add(e.level);
    pairs.push(make(e, 'not-scored', 'no-direction'));
  }
  for (const e of pool.natal) pairs.push(make(e, 'not-scored', 'natal'));
  pairs.sort((a, b) => TRADITIONS.indexOf(a.tradition) - TRADITIONS.indexOf(b.tradition) || levelRank(a.level) - levelRank(b.level) || byText(a.ruleId, b.ruleId) || byText(a.signalId, b.signalId));
  return { pairs, silent: pool.covered.filter((c) => !spoke.has(c.level)) };
}

/** What a frozen forecast must have, to be read here at all: a span of whole years of a size the engine will run. */
export function yearsOfSpan(span: Span): { fromYear: number; toYear: number } | null {
  const fromYear = new Date(span.startUtcMs).getUTCFullYear();
  const toYear = new Date(span.endUtcMs - 1).getUTCFullYear();
  if (!(toYear >= fromYear) || toYear - fromYear + 1 > MAX_FROZEN_YEARS) return null;
  return { fromYear, toYear };
}

/** The forecast of a nativity and conventions over a span of years, evaluated the way a freeze does it. */
export function evaluateFrozen(nativity: Nativity, conventions: Session['conventions'], years: { fromYear: number; toYear: number }): ForecastResult {
  const moment = makeMoment(nativity.civil, nativity.zone, nativity.place);
  return evaluate(makeInput(moment, { ...years, conventions: conventions.engine, forecastConventions: conventions.forecast }), { runs: 1 });
}

/**
 * Re-evaluates a frozen forecast and checks it against its two hashes. Returns null when the span cannot
 * be read, when the rules loaded are not the ones it was made under, or when anything differs: such a
 * forecast cannot be shown to be the one that was frozen, so it is never counted.
 */
export function reproduceFrozen(session: Session, frozen: FrozenForecast): ForecastResult | null {
  if (frozen.rulesetVersion !== RULESET_VERSION) return null;
  const years = yearsOfSpan(frozen.span);
  if (!years) return null;
  let result: ForecastResult;
  try {
    result = evaluateFrozen(session.nativity, session.conventions, years);
  } catch {
    return null;
  }
  const again = freezeForecast(result, session.nativity, frozen.frozenAtUtcMs);
  return again.hash === frozen.hash && again.contentHash === frozen.contentHash && again.conventionsHash === frozen.conventionsHash && again.nativityHash === frozen.nativityHash ? result : null;
}

/** Scores a session: every frozen forecast is reproduced from the nativity and conventions in the file, and any that does not match its hashes is left out. */
export function scoreSession(session: Session, options: ScoreOptions = {}): Scorecard {
  const cache = options.cache ?? new Map<string, ForecastResult | null>();
  const forecasts = session.frozen.map((frozen) => {
    // The key holds everything a reproduction depends on, so a cache kept across sessions cannot serve a result made for another one.
    const key = `${hashNativity(session.nativity)}|${hashOf(session.conventions)}|${frozen.hash}|${frozen.contentHash}|${frozen.frozenAtUtcMs}`;
    if (!cache.has(key)) cache.set(key, reproduceFrozen(session, frozen));
    return { frozen, result: cache.get(key) ?? null };
  });
  return scoreAgainst(session.events, forecasts, session.rulesetVersion, options);
}

/**
 * The scorecard for events and forecasts whose results are in hand. `forecasts` may hold entries whose
 * result is null: they could not be reproduced and are listed, not counted.
 */
export function scoreAgainst(events: readonly ForecastEvent[], forecasts: ReadonlyArray<{ frozen: FrozenForecast; result: ForecastResult | null }>, rulesetVersion: string, options: ScoreOptions = {}): Scorecard {
  const runs = options.runs ?? SHUFFLE_RUNS;
  const seed = options.seed ?? SHUFFLE_SEED;
  const ordered = [...forecasts].sort((a, b) => a.frozen.frozenAtUtcMs - b.frozen.frozenAtUtcMs || byText(a.frozen.hash, b.frozen.hash));
  const pools = new Map<string, Pool>();
  const poolOf = (f: { frozen: FrozenForecast; result: ForecastResult }, topic: Topic): Pool => {
    const key = `${f.frozen.hash}|${f.frozen.frozenAtUtcMs}|${topic}`;
    if (!pools.has(key)) pools.set(key, poolFor(f.result, topic));
    return pools.get(key)!;
  };

  const results: EventResult[] = [];
  const used: Array<{ event: EventResult; forecast: { frozen: FrozenForecast; result: ForecastResult } }> = [];
  for (const e of events) {
    const dates = eventWindow(e);
    const base = { eventId: e.id, topic: e.topic, valence: e.valence, precision: e.precision, dates, forecastHash: null, pairs: [], silent: [] };
    const early = ordered.filter((f) => f.frozen.frozenAtUtcMs < dates.startUtcMs);
    if (ordered.length === 0) {
      results.push({ ...base, status: 'no-frozen-forecast' });
      continue;
    }
    if (early.length === 0) {
      results.push({ ...base, status: 'frozen-too-late' });
      continue;
    }
    const covering = early.filter((f) => f.frozen.span.startUtcMs <= dates.startUtcMs && dates.endUtcMs <= f.frozen.span.endUtcMs);
    if (covering.length === 0) {
      results.push({ ...base, status: 'outside-span' });
      continue;
    }
    const usable = covering.find((f): f is { frozen: FrozenForecast; result: ForecastResult } => f.result !== null);
    if (!usable) {
      results.push({ ...base, status: 'not-reproducible' });
      continue;
    }
    const { pairs, silent } = pairsFor(poolOf(usable, e.topic), dates, e.valence);
    const r: EventResult = { ...base, status: 'scored', forecastHash: usable.frozen.hash, pairs, silent };
    results.push(r);
    used.push({ event: r, forecast: usable });
  }

  const scored = results.filter((r) => r.status === 'scored');
  const totals = emptyCounts();
  const reasons: Record<NotScoredReason, number> = { mixed: 0, 'no-direction': 0, natal: 0 };
  const rules = new Map<string, RuleRow>();
  const levels = new Map<LevelId, LevelRow>();
  const traditions = new Map<Tradition, TraditionRow>();
  const shared = emptyCounts();
  const sharedLevels = new Set<LevelId>();
  const bump = (c: Counts, o: Outcome): void => {
    if (o === 'held') c.held++;
    else if (o === 'did-not-hold') c.didNotHold++;
    else c.notScored++;
  };
  const levelRow = (level: LevelId): LevelRow => {
    if (!levels.has(level)) levels.set(level, { level, tradition: levelTradition(level), counts: emptyCounts() });
    return levels.get(level)!;
  };
  const traditionRow = (tradition: Tradition): TraditionRow => {
    if (!traditions.has(tradition)) traditions.set(tradition, { tradition, counts: emptyCounts() });
    return traditions.get(tradition)!;
  };
  for (const r of scored) {
    for (const p of r.pairs) {
      bump(totals, p.outcome);
      if (p.reason) reasons[p.reason]++;
      if (!rules.has(p.ruleId)) rules.set(p.ruleId, { ruleId: p.ruleId, tradition: p.tradition, level: p.level, counts: emptyCounts() });
      bump(rules.get(p.ruleId)!.counts, p.outcome);
      bump(levelRow(p.level).counts, p.outcome);
      bump(traditionRow(p.tradition).counts, p.outcome);
      if (levelOnSharedClock(p.level)) {
        bump(shared, p.outcome);
        sharedLevels.add(p.level);
      }
    }
    for (const s of r.silent) {
      totals.saidNothing++;
      levelRow(s.level).counts.saidNothing++;
      traditionRow(s.tradition).counts.saidNothing++;
    }
    // The shared clock is counted once per event: it said nothing when every technique on it was silent.
    const forecast = used.find((u) => u.event === r)!.forecast;
    const sharedCovered = coveredShared(poolOf(forecast, r.topic));
    if (sharedCovered.length > 0) {
      for (const l of sharedCovered) sharedLevels.add(l);
      if (sharedCovered.every((l) => r.silent.some((s) => s.level === l))) shared.saidNothing++;
    }
  }

  const comparison = compare(used, totals.held, totals.held + totals.didNotHold, runs, seed);
  return {
    schema: SCORECARD_SCHEMA,
    rulesetVersion,
    eventCount: events.length,
    frozenCount: forecasts.length,
    events: results,
    totals,
    notScoredByReason: reasons,
    byRule: [...rules.values()].sort((a, b) => TRADITIONS.indexOf(a.tradition) - TRADITIONS.indexOf(b.tradition) || levelRank(a.level) - levelRank(b.level) || byText(a.ruleId, b.ruleId)),
    byLevel: [...levels.values()].sort((a, b) => levelRank(a.level) - levelRank(b.level)),
    byTradition: [...traditions.values()].sort((a, b) => TRADITIONS.indexOf(a.tradition) - TRADITIONS.indexOf(b.tradition)),
    sharedClock: { levels: [...sharedLevels].sort((a, b) => levelRank(a) - levelRank(b)), counts: shared },
    comparison,
  };
}

function coveredShared(pool: Pool): LevelId[] {
  return pool.covered.filter((c) => levelOnSharedClock(c.level)).map((c) => c.level);
}

interface Scorable {
  start: number;
  end: number;
  supports: boolean;
}

/**
 * The comparison with shuffled dates. Each run moves every event by the same fraction of its own room, in whole days, round the span of
 * its forecast, and counts the held pairs again with the same pairing as the real run.
 */
function compare(used: ReadonlyArray<{ event: EventResult; forecast: { frozen: FrozenForecast; result: ForecastResult } }>, held: number, pairs: number, runs: number, seed: number): Comparison {
  if (pairs < MIN_PAIRS_TO_COMPARE) return { runs, seed, pairs, held, atLeast: null, tooFew: true };
  const cache = new Map<string, Scorable[]>();
  const scorable = (u: (typeof used)[number]): Scorable[] => {
    const key = `${u.forecast.frozen.hash}|${u.event.topic}`;
    if (!cache.has(key)) {
      const list = statementList(u.forecast.result, u.event.topic);
      cache.set(
        key,
        list.dated.filter((e) => (e.word === 'supports' || e.word === 'cautions') && e.fullStartUtcMs !== null && e.fullEndUtcMs !== null).map((e) => ({ start: e.fullStartUtcMs!, end: e.fullEndUtcMs!, supports: e.word === 'supports' })),
      );
    }
    return cache.get(key)!;
  };
  const rows = used.map((u) => ({ pool: scorable(u), len: u.event.dates.endUtcMs - u.event.dates.startUtcMs, offset: u.event.dates.startUtcMs - u.forecast.frozen.span.startUtcMs, room: u.forecast.frozen.span.endUtcMs - u.forecast.frozen.span.startUtcMs - (u.event.dates.endUtcMs - u.event.dates.startUtcMs), spanStart: u.forecast.frozen.span.startUtcMs, good: u.event.valence === 'good' }));
  const rand = seededRandom(seed);
  let atLeast = 0;
  for (let run = 0; run < runs; run++) {
    const u = rand();
    let n = 0;
    for (const r of rows) {
      const days = Math.floor(r.room / DAY);
      const shift = days > 0 ? Math.floor(u * (days + 1)) * DAY : 0;
      const start = r.spanStart + (r.room > 0 ? (r.offset + shift) % (r.room + 1) : 0);
      const end = start + r.len;
      for (const s of r.pool) if (s.start < end && start < s.end && s.supports === r.good) n++;
    }
    if (n >= held) atLeast++;
  }
  return { runs, seed, pairs, held, atLeast, tooFew: false };
}
