// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Synthetic events for tests and examples. Every event is a number of days from a sample
 * moment, never a written-out date, so no event here can be somebody's real one. This is
 * the only file in which an event's time may be built; a guard test checks that.
 */
import type { ForecastEvent, Nativity } from '../packages/core/src/forecast/events.ts';
import type { Topic } from '../packages/core/src/forecast/types.ts';
import { makeMoment, MS } from '../packages/core/src/substrate/time.ts';
import { fixture } from './moments.ts';

export interface OffsetEvent {
  id: string;
  /** Days after the sample moment at which the event happened. */
  days: number;
  precision: ForecastEvent['precision'];
  topic: Topic;
  valence: ForecastEvent['valence'];
  /** Days after the sample moment at which it was entered; later than the freeze to count. */
  enteredDays: number;
}

export function nativityOf(momentId: string): Nativity {
  const f = fixture(momentId);
  return { civil: { ...f.civil }, zone: f.zone, place: { ...f.place } };
}

export function eventsFrom(momentId: string, offsets: readonly OffsetEvent[]): ForecastEvent[] {
  const f = fixture(momentId);
  const base = makeMoment(f.civil, f.zone, f.place).utcMs;
  return offsets.map((o) => ({
    id: o.id,
    utcMs: base + Math.round(o.days * MS.DAY),
    precision: o.precision,
    topic: o.topic,
    valence: o.valence,
    enteredAtUtcMs: base + Math.round(o.enteredDays * MS.DAY),
  }));
}

/** Days after the sample moment at which a test freezes its forecast. */
export const FREEZE_DAYS = 9000;

export const SAMPLE_OFFSETS: readonly OffsetEvent[] = [
  { id: 'e1', days: 9100, precision: 'day', topic: 'wealth', valence: 'good', enteredDays: 9200 },
  { id: 'e2', days: 9400, precision: 'month', topic: 'wealth', valence: 'bad', enteredDays: 9500 },
  { id: 'e3', days: 9700, precision: 'year', topic: 'career', valence: 'good', enteredDays: 9800 },
  { id: 'e4', days: 8000, precision: 'day', topic: 'health', valence: 'bad', enteredDays: 8100 },
];
