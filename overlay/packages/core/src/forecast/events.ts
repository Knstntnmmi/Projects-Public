// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The data model of the scorecard (specification, section 8): events a person records, and
 * forecasts frozen and hashed before the events are entered. Nothing here compares an event
 * with a statement; scorecard.ts does that.
 *
 * An event has one free-text field, a private note. It is kept in the session file only if the
 * person writes one, it is capped in length, and nothing in the engine ever reads it.
 */
import type { Conventions } from '../conventions.ts';
import type { CivilTime, Place } from '../substrate/time.ts';
import type { ForecastConventions } from './conventions.ts';
import type { ForecastResult } from './evaluate.ts';
import { hashOf } from './hash.ts';
import type { Span, Topic } from './types.ts';

export type EventPrecision = 'day' | 'month' | 'year';

/** Named ForecastEvent because the browser has a global Event. */
export interface ForecastEvent {
  id: string;
  utcMs: number;
  precision: EventPrecision;
  topic: Topic;
  valence: 'good' | 'bad';
  /** When the person entered it. Only events entered after a freeze can be scored against it. */
  enteredAtUtcMs: number;
  /** A private note, never interpreted and never printed by the scorecard. Absent unless the person wrote one. */
  note?: string;
}

export interface Nativity {
  civil: CivilTime;
  zone: string;
  place: Place;
}

export interface FrozenForecast {
  schema: 'overlay-frozen/1';
  frozenAtUtcMs: number;
  rulesetVersion: string;
  /** Hash of the engine and forecast conventions. */
  conventionsHash: string;
  nativityHash: string;
  span: Span;
  /** Hash of rulesetVersion, conventions, nativity hash and span, as the specification defines it. */
  hash: string;
  /** Hash of the readings and signal ids too, so a changed output under the same inputs is noticed. */
  contentHash: string;
}

/** The window an event covers, by its precision, in UTC. */
export function eventWindow(e: ForecastEvent): Span {
  const d = new Date(e.utcMs);
  const start = new Date(0);
  if (e.precision === 'day') start.setUTCFullYear(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  else if (e.precision === 'month') start.setUTCFullYear(d.getUTCFullYear(), d.getUTCMonth(), 1);
  else start.setUTCFullYear(d.getUTCFullYear(), 0, 1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime());
  if (e.precision === 'day') end.setUTCDate(end.getUTCDate() + 1);
  else if (e.precision === 'month') end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCFullYear(end.getUTCFullYear() + 1);
  return { startUtcMs: start.getTime(), endUtcMs: end.getTime() };
}

/**
 * A copy of an event with its topic or valence changed. The precision (and the date) cannot
 * be changed: the person deletes the event and enters a new one, which gets a new entry time.
 */
export function amendEvent(e: ForecastEvent, patch: { topic?: Topic; valence?: 'good' | 'bad' }): ForecastEvent {
  for (const k of Object.keys(patch)) {
    if (k !== 'topic' && k !== 'valence') throw new Error(`an event's ${k} cannot be changed once saved; delete it and enter a new one`);
  }
  return { ...e, ...patch };
}

export const hashNativity = (n: Nativity): string => hashOf({ civil: n.civil, zone: n.zone, place: n.place });

export function freezeForecast(result: ForecastResult, nativity: Nativity, frozenAtUtcMs: number): FrozenForecast {
  const conventions: { engine: Conventions; forecast: ForecastConventions } = result.conventions;
  const nativityHash = hashNativity(nativity);
  return {
    schema: 'overlay-frozen/1',
    frozenAtUtcMs,
    rulesetVersion: result.rulesetVersion,
    conventionsHash: hashOf(conventions),
    nativityHash,
    span: result.span,
    hash: hashOf({ rulesetVersion: result.rulesetVersion, conventions, nativityHash, span: result.span }),
    contentHash: hashOf({ signals: result.signals.map((s) => s.id), readings: result.readings.map((r) => [r.tradition, r.group, r.topic, r.slice, r.word]) }),
  };
}

/** The record of when an event was entered against a freeze. Scoring itself goes by the event's date (see scorecard.ts). */
export function splitByFreeze(events: readonly ForecastEvent[], frozen: FrozenForecast): { counted: ForecastEvent[]; enteredBefore: ForecastEvent[] } {
  return {
    counted: events.filter((e) => e.enteredAtUtcMs > frozen.frozenAtUtcMs),
    enteredBefore: events.filter((e) => e.enteredAtUtcMs <= frozen.frozenAtUtcMs),
  };
}
