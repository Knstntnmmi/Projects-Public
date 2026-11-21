// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The scorecard commands: "score" (print the counts of a session file), "event" (record an event) and
 * "freeze" (freeze a forecast). They take the text of the session file as an argument and return the text
 * to print and, where the file changes, the new text of the file. Reading and writing the file and
 * reading the clock are the shell's job, so every command can be tested without leaving the process.
 */
import { forecast, DEFAULT_CONVENTIONS } from '@overlay/core';
import { fail, readNativity, readSettings, type Flags } from './args.ts';
import { forecastConventionsOf, readYears } from './forecastCommand.ts';

export interface SessionIo {
  /** The text of the session file, or null when there is no such file yet. */
  text: string | null;
}

export interface CommandResult {
  output: string;
  /** The new text of the session file, when the command changed it. */
  write?: string;
}

export function sessionPath(flags: Flags): string {
  const p = flags.get('session')?.[0];
  if (!p || p === 'true') fail('give the session file with --session <file>. A name ending in .session.json is ignored by git.');
  return p;
}

function load(io: SessionIo, path: string): forecast.Session | null {
  if (io.text === null) return null;
  try {
    return forecast.importSession(io.text);
  } catch (e) {
    if (e instanceof forecast.SessionError) fail(`${path} is not a session file this version can read: ${e.message}`);
    throw e;
  }
}

const asFail = <T>(fn: () => T): T => {
  try {
    return fn();
  } catch (e) {
    if (e instanceof forecast.SessionEditError) fail(e.message);
    if (e instanceof forecast.SessionError) fail(e.message);
    throw e;
  }
}

/** The moment and settings named on the command line, if any: given with --moment or --at. */
function named(flags: Flags): { nativity: forecast.Nativity; conventions: forecast.Session['conventions'] } | null {
  if (!flags.has('moment') && !flags.has('at')) return null;
  return {
    nativity: readNativity(flags),
    conventions: { engine: readSettings(flags).engine ?? DEFAULT_CONVENTIONS, forecast: { ...forecast.DEFAULT_FORECAST_CONVENTIONS, ...forecastConventionsOf(flags) } },
  };
}

/** The session to work on: the file's, or a new one from the moment named. A pinned session is never changed by the flags. */
function sessionFor(flags: Flags, existing: forecast.Session | null): { session: forecast.Session; fresh: boolean } {
  const given = named(flags);
  if (existing && forecast.isPinned(existing)) return { session: existing, fresh: false };
  if (existing && !given) return { session: existing, fresh: false };
  if (!given) fail('the session file does not exist yet: name the moment with --moment <id> or --at "YYYY-MM-DD HH:MM" to start one');
  return { session: existing ? { ...existing, nativity: given.nativity, conventions: given.conventions } : forecast.newSession(given.nativity, given.conventions), fresh: existing === null };
}

const tip = (path: string, fresh: boolean): string => (fresh && !path.endsWith('.session.json') ? `\nTip: a file name ending in .session.json is ignored by git, and this file holds a birth moment in clear text.` : '');

/** "overlay score": the counts, as text or as JSON (--json). */
export function runScore(flags: Flags, io: SessionIo): string {
  const path = sessionPath(flags);
  const session = load(io, path);
  if (!session) fail(`no session file at ${path}`);
  const card = asFail(() => forecast.scoreSession(session));
  if (flags.has('json')) return JSON.stringify(forecast.scorecardJson(card), null, 2);
  const lines = forecast.scorecardLines(card);
  if (!forecast.sessionRulesetMatches(session)) lines.push('', 'This file was made under other rules than the ones loaded now, so its frozen forecasts cannot be reproduced and are not counted.');
  return lines.join('\n');
}

/** "overlay event": records an event (a day, a month or a year, a topic, and how it went). */
export function runEvent(flags: Flags, io: SessionIo, nowMs: number): CommandResult {
  const path = sessionPath(flags);
  const date = flags.get('date')?.[0];
  if (!date) fail('give the date with --date YYYY-MM-DD, YYYY-MM or YYYY');
  const topic = flags.get('topic')?.[0];
  if (!topic) fail(`give the topic with --topic. Topics: ${forecast.TOPICS.join(', ')}`);
  const went = flags.get('went')?.[0];
  if (!went) fail('say how it went with --went well or --went badly');
  const note = flags.get('note')?.[0];
  const { session, fresh } = sessionFor(flags, load(io, path));
  const { session: next, event } = asFail(() =>
    forecast.addEvent(session, { date: forecast.parseEventDate(date), topic: forecast.parseTopic(topic), valence: forecast.parseWent(went), ...(note && note !== 'true' ? { note } : {}) }, nowMs),
  );
  const text = forecast.exportSession(next);
  const when = event.precision === 'day' ? date : event.precision === 'month' ? date.slice(0, 7) : date.slice(0, 4);
  return {
    output: `Recorded ${event.id}: ${when}, ${forecast.TOPIC_LABEL[event.topic]}, ${event.valence === 'good' ? 'went well' : 'went badly'}. The session holds ${next.events.length} ${next.events.length === 1 ? 'event' : 'events'} and ${next.frozen.length} frozen ${next.frozen.length === 1 ? 'forecast' : 'forecasts'}.${tip(path, fresh)}`,
    write: `${text}\n`,
  };
}

/** "overlay freeze": freezes the forecast of the session's moment and settings for a span of years, at the time now. */
export function runFreeze(flags: Flags, io: SessionIo, nowMs: number, currentYear: number): CommandResult {
  const path = sessionPath(flags);
  const existing = load(io, path);
  const { session, fresh } = sessionFor(flags, existing);
  const years = readYears(flags, currentYear);
  const given = named(flags);
  const from = existing && forecast.isPinned(existing) ? (given ?? { nativity: session.nativity, conventions: session.conventions }) : { nativity: session.nativity, conventions: session.conventions };
  const next = asFail(() => forecast.freezeInSession(session, from, years, nowMs));
  const text = forecast.exportSession(next);
  const f = next.frozen.at(-1)!;
  return {
    output: `Frozen: ${years.fromYear} to ${years.toYear}, at ${new Date(nowMs).toISOString().slice(0, 16).replace('T', ' ')} UTC. Fingerprint ${f.hash.slice(0, 12)}. An event can be scored against it only if its date is later. The session holds ${next.frozen.length} frozen ${next.frozen.length === 1 ? 'forecast' : 'forecasts'}.${tip(path, fresh)}`,
    write: `${text}\n`,
  };
}
