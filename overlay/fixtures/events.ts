// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
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

/** Days after the sample moment at which the sample scorecard freezes its first and second forecast. */
export const SCORECARD_FREEZE_DAYS = { first: 9500, second: 11000 } as const;

/**
 * The invented events of the sample scorecard (docs/SAMPLE-SCORECARD.md): fourteen of them, every
 * one a number of days from the constructed moment. Two fall before the first freeze, so they are
 * listed as frozen too late. None is anyone's life.
 */
export const SCORECARD_SAMPLE_OFFSETS: readonly OffsetEvent[] = [
  { id: 'e1', days: 9300, precision: 'day', topic: 'wealth', valence: 'good', enteredDays: 9310 },
  { id: 'e2', days: 9420, precision: 'month', topic: 'career', valence: 'bad', enteredDays: 9430 },
  { id: 'e3', days: 9650, precision: 'day', topic: 'wealth', valence: 'good', enteredDays: 9660 },
  { id: 'e4', days: 9900, precision: 'day', topic: 'wealth', valence: 'bad', enteredDays: 9910 },
  { id: 'e5', days: 10150, precision: 'month', topic: 'career', valence: 'good', enteredDays: 10200 },
  { id: 'e6', days: 10400, precision: 'day', topic: 'wealth', valence: 'good', enteredDays: 10410 },
  { id: 'e7', days: 10650, precision: 'day', topic: 'health', valence: 'bad', enteredDays: 10660 },
  { id: 'e8', days: 10900, precision: 'year', topic: 'wealth', valence: 'bad', enteredDays: 10950 },
  { id: 'e9', days: 11150, precision: 'day', topic: 'career', valence: 'good', enteredDays: 11160 },
  { id: 'e10', days: 11400, precision: 'day', topic: 'wealth', valence: 'good', enteredDays: 11410 },
  { id: 'e11', days: 11650, precision: 'month', topic: 'relationships', valence: 'bad', enteredDays: 11700 },
  { id: 'e12', days: 11900, precision: 'day', topic: 'wealth', valence: 'bad', enteredDays: 11910 },
  { id: 'e13', days: 12200, precision: 'day', topic: 'career', valence: 'bad', enteredDays: 12210 },
  { id: 'e14', days: 12500, precision: 'day', topic: 'wealth', valence: 'good', enteredDays: 12510 },
];
