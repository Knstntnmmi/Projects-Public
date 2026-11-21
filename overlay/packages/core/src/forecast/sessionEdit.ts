// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Changing a session in memory: starting one, adding or removing an event, freezing a forecast.
 * Pure functions that return a new session; reading and writing the file, and reading the clock,
 * are the shell's job. The clock is an argument everywhere.
 */
import { DEFAULT_CONVENTIONS } from '../conventions.ts';
import { DEFAULT_FORECAST_CONVENTIONS } from './conventions.ts';
import { freezeForecast, hashNativity, type ForecastEvent, type Nativity } from './events.ts';
import { evaluateFrozen, MAX_FROZEN_YEARS } from './scorecard.ts';
import { hashOf } from './hash.ts';
import { RULESET_VERSION } from './rules.ts';
import { MAX_EVENTS, MAX_FROZEN, MAX_NOTE_CHARS, SESSION_SCHEMA, type Session } from './session.ts';
import { TOPICS, type Topic } from './types.ts';

export class SessionEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionEditError';
  }
}

export function newSession(nativity: Nativity, conventions: Session['conventions'] = { engine: DEFAULT_CONVENTIONS, forecast: DEFAULT_FORECAST_CONVENTIONS }): Session {
  return { schema: SESSION_SCHEMA, rulesetVersion: RULESET_VERSION, conventions, nativity, events: [], frozen: [] };
}

/** The date of an event as the person types it: a year, a year and month, or a whole day. */
export type EventDate = { year: number; month?: number; day?: number };

/** "2031-03-01", "2031-03" or "2031". */
export function parseEventDate(text: string): EventDate {
  const m = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(text.trim());
  if (!m) throw new SessionEditError(`cannot read "${text}" as a date: write YYYY-MM-DD, YYYY-MM or YYYY`);
  const out: EventDate = { year: Number(m[1]) };
  if (m[2] !== undefined) out.month = Number(m[2]);
  if (m[3] !== undefined) out.day = Number(m[3]);
  return out;
}

const WORD_TO_VALENCE: Record<string, ForecastEvent['valence']> = { 'went well': 'good', 'went badly': 'bad', well: 'good', badly: 'bad' };

/** "went well" or "went badly" (or "well" and "badly") as the stored value. */
export function parseWent(text: string): ForecastEvent['valence'] {
  const v = WORD_TO_VALENCE[text.trim().toLowerCase()];
  if (!v) throw new SessionEditError('say how it went: "went well" or "went badly"');
  return v;
}

export function parseTopic(text: string): Topic {
  if (!(TOPICS as readonly string[]).includes(text)) throw new SessionEditError(`unknown topic "${text}". Topics: ${TOPICS.join(', ')}`);
  return text as Topic;
}

const noonOf = (year: number, month: number, day: number): number => {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(12, 0, 0, 0);
  return d.getTime();
};

export interface NewEvent {
  date: EventDate;
  topic: Topic;
  valence: ForecastEvent['valence'];
  note?: string;
}

/** The next free id of the form e1, e2, ... */
export function nextEventId(events: readonly ForecastEvent[]): string {
  const taken = new Set(events.map((e) => e.id));
  for (let i = events.length + 1; ; i++) if (!taken.has(`e${i}`)) return `e${i}`;
}

/** Adds an event. Only the session's events are read, so a caller that holds no moment yet may pass just those. */
export function addEvent<S extends Pick<Session, 'events'>>(session: S, e: NewEvent, enteredAtUtcMs: number): { session: S; event: ForecastEvent } {
  if (session.events.length >= MAX_EVENTS) throw new SessionEditError(`a session holds at most ${MAX_EVENTS} events`);
  const { year, month, day } = e.date;
  if (!Number.isInteger(year) || year < 1 || year > 3000) throw new SessionEditError('the year must lie between 1 and 3000');
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) throw new SessionEditError('the month must lie between 1 and 12');
  if (day !== undefined && (month === undefined || !Number.isInteger(day) || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate())) throw new SessionEditError('that day does not exist in that month');
  const note = e.note?.trim();
  if (note !== undefined && [...note].length > MAX_NOTE_CHARS) throw new SessionEditError(`a note is at most ${MAX_NOTE_CHARS} characters`);
  if (note !== undefined && /[\u0000-\u0009\u000b-\u001f\u007f]/.test(note)) throw new SessionEditError('a note holds no control characters');
  const precision = day !== undefined ? 'day' : month !== undefined ? 'month' : 'year';
  const event: ForecastEvent = {
    id: nextEventId(session.events),
    utcMs: noonOf(year, month ?? 1, day ?? 1),
    precision,
    topic: e.topic,
    valence: e.valence,
    enteredAtUtcMs,
    ...(note ? { note } : {}),
  };
  return { session: { ...session, events: [...session.events, event] }, event };
}

export function removeEvent(session: Session, id: string): Session {
  if (!session.events.some((x) => x.id === id)) throw new SessionEditError(`no event "${id}"`);
  return { ...session, events: session.events.filter((x) => x.id !== id) };
}

/** True when a session already holds frozen forecasts, so its nativity and conventions can no longer change. */
export const isPinned = (s: Session): boolean => s.frozen.length > 0;

export const PINNED_MESSAGE = 'The forecasts already frozen in this session were made for another moment or under other settings. A session file holds one moment and one set of settings: start a new session to freeze this one.';

/**
 * Freezes the forecast of the session's nativity and conventions over the years given, at the
 * time given. A session that holds no frozen forecast yet takes the nativity and conventions passed
 * in; after that they are fixed, and a freeze for anything else is refused.
 */
export function freezeInSession(session: Session, from: { nativity: Nativity; conventions: Session['conventions'] }, years: { fromYear: number; toYear: number }, frozenAtUtcMs: number): Session {
  if (!Number.isInteger(years.fromYear) || !Number.isInteger(years.toYear) || years.toYear < years.fromYear) throw new SessionEditError('the last year must not be before the first');
  if (years.toYear - years.fromYear + 1 > MAX_FROZEN_YEARS) throw new SessionEditError(`a forecast is frozen for at most ${MAX_FROZEN_YEARS} years`);
  if (session.frozen.length >= MAX_FROZEN) throw new SessionEditError(`a session holds at most ${MAX_FROZEN} frozen forecasts`);
  const base: Session = isPinned(session) ? session : { ...session, nativity: from.nativity, conventions: from.conventions };
  if (isPinned(session) && (hashNativity(from.nativity) !== hashNativity(session.nativity) || hashOf(from.conventions) !== hashOf(session.conventions))) throw new SessionEditError(PINNED_MESSAGE);
  const result = evaluateFrozen(base.nativity, base.conventions, years);
  const frozen = freezeForecast(result, base.nativity, frozenAtUtcMs);
  if (base.frozen.some((f) => f.hash === frozen.hash && f.contentHash === frozen.contentHash)) throw new SessionEditError('this forecast is already frozen in this session; the earlier freeze stands');
  return { ...base, frozen: [...base.frozen, frozen] };
}
