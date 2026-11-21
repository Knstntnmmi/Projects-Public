// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The session file (specification, section 10): the one place a nativity and events leave
 * memory, and only when the person exports. Pure functions on text and values; reading and
 * writing the file is the shell's job. Import is strict: every key is checked against a
 * schema, unknown keys and prototype keys are refused, sizes and counts are capped and
 * every number is range-checked. The objects returned are built field by field, so nothing
 * from the file but validated values reaches the caller.
 */
import { CONVENTION_SPECS, type Conventions } from '../conventions.ts';
import { FORECAST_CONVENTION_SPECS, type ForecastConventions } from './conventions.ts';
import type { ForecastEvent, FrozenForecast, Nativity } from './events.ts';
import { TOPICS, type Topic } from './types.ts';
import { RULESET_VERSION } from './rules.ts';

export const SESSION_SCHEMA = 'overlay-session/1';
export const MAX_SESSION_BYTES = 256 * 1024;
export const MAX_EVENTS = 500;
export const MAX_FROZEN = 50;
export const MAX_NOTE_CHARS = 280;

const MIN_MS = -62_135_596_800_000; // year 1
const MAX_MS = 32_503_680_000_000; // year 3000

export interface Session {
  schema: typeof SESSION_SCHEMA;
  rulesetVersion: string;
  conventions: { engine: Conventions; forecast: ForecastConventions };
  nativity: Nativity;
  events: ForecastEvent[];
  frozen: FrozenForecast[];
}

export class SessionError extends Error {
  readonly code: 'too-large' | 'not-json' | 'schema' | 'unknown-key' | 'range' | 'count';
  constructor(code: SessionError['code'], message: string) {
    super(message);
    this.name = 'SessionError';
    this.code = code;
  }
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

type Json = unknown;
const isObject = (x: Json): x is Record<string, Json> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Refuses prototype keys anywhere in the value, to any depth. */
function scanKeys(x: Json, depth = 0): void {
  if (depth > 8) throw new SessionError('schema', 'the file is nested too deeply');
  if (Array.isArray(x)) x.forEach((v) => scanKeys(v, depth + 1));
  else if (isObject(x)) {
    for (const k of Object.keys(x)) {
      if (FORBIDDEN_KEYS.has(k)) throw new SessionError('unknown-key', `the key "${k}" is not allowed`);
      scanKeys(x[k], depth + 1);
    }
  }
}

/** The object, after checking it has exactly the allowed keys, all of the required ones present. */
function keysOf(x: Json, where: string, required: readonly string[], optional: readonly string[] = []): Record<string, Json> {
  if (!isObject(x)) throw new SessionError('schema', `${where} must be an object`);
  for (const k of Object.keys(x)) if (!required.includes(k) && !optional.includes(k)) throw new SessionError('unknown-key', `${where} has an unknown key "${k}"`);
  for (const k of required) if (!Object.prototype.hasOwnProperty.call(x, k)) throw new SessionError('schema', `${where} is missing "${k}"`);
  return x;
}

function num(x: Json, where: string, min: number, max: number, integer = false): number {
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new SessionError('schema', `${where} must be a number`);
  if (x < min || x > max || (integer && !Number.isInteger(x))) throw new SessionError('range', `${where} is outside ${min} to ${max}${integer ? ' (whole numbers)' : ''}`);
  return x;
}

function str(x: Json, where: string, pattern: RegExp): string {
  if (typeof x !== 'string' || !pattern.test(x)) throw new SessionError('schema', `${where} is not in the allowed form`);
  return x;
}

function oneOf<T extends string>(x: Json, where: string, options: readonly T[]): T {
  if (typeof x !== 'string' || !(options as readonly string[]).includes(x)) throw new SessionError('schema', `${where} is not one of ${options.join(', ')}`);
  return x as T;
}

const HEX16 = /^[0-9a-f]{16}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const ZONE = /^[A-Za-z0-9_+\-:/]{1,64}$/;

function conventionsFrom(x: Json): { engine: Conventions; forecast: ForecastConventions } {
  const top = keysOf(x, 'conventions', ['engine', 'forecast']);
  const read = <T extends object>(raw: Json, where: string, specs: ReadonlyArray<{ key: string; options: ReadonlyArray<{ value: string | number }> }>): T => {
    const o = keysOf(raw, where, specs.map((s) => s.key));
    const out: Record<string, string | number | boolean> = {};
    for (const s of specs) {
      const v = o[s.key];
      const ok = (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') && s.options.some((opt) => String(opt.value) === String(v) && typeof opt.value === (typeof v === 'boolean' ? 'string' : typeof v));
      if (!ok) throw new SessionError('schema', `${where}.${s.key} is not one of its allowed values`);
      out[s.key] = v as string | number | boolean;
    }
    return out as T;
  };
  return {
    engine: read<Conventions>(top.engine, 'conventions.engine', CONVENTION_SPECS),
    forecast: read<ForecastConventions>(top.forecast, 'conventions.forecast', FORECAST_CONVENTION_SPECS),
  };
}

function nativityFrom(x: Json): Nativity {
  const o = keysOf(x, 'nativity', ['civil', 'zone', 'place']);
  const c = keysOf(o.civil, 'nativity.civil', ['year', 'month', 'day', 'hour', 'minute', 'second']);
  const p = keysOf(o.place, 'nativity.place', ['latitude', 'longitude']);
  return {
    civil: {
      year: num(c.year, 'nativity.civil.year', 1, 3000, true),
      month: num(c.month, 'nativity.civil.month', 1, 12, true),
      day: num(c.day, 'nativity.civil.day', 1, 31, true),
      hour: num(c.hour, 'nativity.civil.hour', 0, 23, true),
      minute: num(c.minute, 'nativity.civil.minute', 0, 59, true),
      second: num(c.second, 'nativity.civil.second', 0, 59.999),
    },
    zone: str(o.zone, 'nativity.zone', ZONE),
    place: { latitude: num(p.latitude, 'nativity.place.latitude', -90, 90), longitude: num(p.longitude, 'nativity.place.longitude', -180, 180) },
  };
}

/** A private note: text of at most MAX_NOTE_CHARS characters, with no control characters other than a line break. */
function noteFrom(x: Json, where: string): string {
  if (typeof x !== 'string') throw new SessionError('schema', `${where} must be text`);
  if ([...x].length > MAX_NOTE_CHARS) throw new SessionError('range', `${where} is longer than ${MAX_NOTE_CHARS} characters`);
  if (/[\u0000-\u0009\u000b-\u001f\u007f]/.test(x)) throw new SessionError('schema', `${where} holds a control character`);
  return x;
}

function eventFrom(x: Json, i: number): ForecastEvent {
  const o = keysOf(x, `events[${i}]`, ['id', 'utcMs', 'precision', 'topic', 'valence', 'enteredAtUtcMs'], ['note']);
  const note = o.note === undefined ? {} : { note: noteFrom(o.note, `events[${i}].note`) };
  return {
    id: str(o.id, `events[${i}].id`, ID),
    utcMs: num(o.utcMs, `events[${i}].utcMs`, MIN_MS, MAX_MS, true),
    precision: oneOf(o.precision, `events[${i}].precision`, ['day', 'month', 'year'] as const),
    topic: oneOf<Topic>(o.topic, `events[${i}].topic`, TOPICS),
    valence: oneOf(o.valence, `events[${i}].valence`, ['good', 'bad'] as const),
    enteredAtUtcMs: num(o.enteredAtUtcMs, `events[${i}].enteredAtUtcMs`, MIN_MS, MAX_MS, true),
    ...note,
  };
}

function frozenFrom(x: Json, i: number): FrozenForecast {
  const o = keysOf(x, `frozen[${i}]`, ['schema', 'frozenAtUtcMs', 'rulesetVersion', 'conventionsHash', 'nativityHash', 'span', 'hash', 'contentHash']);
  const span = keysOf(o.span, `frozen[${i}].span`, ['startUtcMs', 'endUtcMs']);
  return {
    schema: oneOf(o.schema, `frozen[${i}].schema`, ['overlay-frozen/1'] as const),
    frozenAtUtcMs: num(o.frozenAtUtcMs, `frozen[${i}].frozenAtUtcMs`, MIN_MS, MAX_MS, true),
    rulesetVersion: str(o.rulesetVersion, `frozen[${i}].rulesetVersion`, HEX16),
    conventionsHash: str(o.conventionsHash, `frozen[${i}].conventionsHash`, HEX64),
    nativityHash: str(o.nativityHash, `frozen[${i}].nativityHash`, HEX64),
    span: { startUtcMs: num(span.startUtcMs, `frozen[${i}].span.startUtcMs`, MIN_MS, MAX_MS), endUtcMs: num(span.endUtcMs, `frozen[${i}].span.endUtcMs`, MIN_MS, MAX_MS) },
    hash: str(o.hash, `frozen[${i}].hash`, HEX64),
    contentHash: str(o.contentHash, `frozen[${i}].contentHash`, HEX64),
  };
}

/** Checks a value against the session schema and returns a clean copy; throws SessionError. */
export function validateSession(raw: Json): Session {
  scanKeys(raw);
  const o = keysOf(raw, 'session', ['schema', 'rulesetVersion', 'conventions', 'nativity', 'events'], ['frozen']);
  if (o.schema !== SESSION_SCHEMA) throw new SessionError('schema', `unknown schema ${JSON.stringify(typeof o.schema === 'string' ? o.schema.slice(0, 40) : o.schema)}`);
  if (!Array.isArray(o.events)) throw new SessionError('schema', 'events must be a list');
  if (o.events.length > MAX_EVENTS) throw new SessionError('count', `more than ${MAX_EVENTS} events`);
  const frozenRaw = o.frozen === undefined ? [] : o.frozen;
  if (!Array.isArray(frozenRaw)) throw new SessionError('schema', 'frozen must be a list');
  if (frozenRaw.length > MAX_FROZEN) throw new SessionError('count', `more than ${MAX_FROZEN} frozen forecasts`);
  const events = o.events.map(eventFrom);
  if (new Set(events.map((e) => e.id)).size !== events.length) throw new SessionError('schema', 'event ids are not unique');
  return {
    schema: SESSION_SCHEMA,
    rulesetVersion: str(o.rulesetVersion, 'rulesetVersion', HEX16),
    conventions: conventionsFrom(o.conventions),
    nativity: nativityFrom(o.nativity),
    events,
    frozen: frozenRaw.map(frozenFrom),
  };
}

const byteLength = (s: string): number => new TextEncoder().encode(s).length;

/** The text of a session file. Validates first, so a file this writes is one this reads. */
export function exportSession(session: Session): string {
  const clean = validateSession(JSON.parse(JSON.stringify(session)));
  const text = JSON.stringify(clean, null, 2);
  if (byteLength(text) > MAX_SESSION_BYTES) throw new SessionError('too-large', `the file would be over ${MAX_SESSION_BYTES} bytes`);
  return text;
}

export function importSession(text: string): Session {
  if (typeof text !== 'string' || byteLength(text) > MAX_SESSION_BYTES) throw new SessionError('too-large', `the file is over ${MAX_SESSION_BYTES} bytes`);
  let raw: Json;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SessionError('not-json', 'the file is not JSON');
  }
  return validateSession(raw);
}

/** What the person is asked to confirm before an export. */
export function exportConfirmation(session: Session): string {
  const n = session.events.length;
  const notes = session.events.filter((e) => e.note !== undefined && e.note !== '').length;
  return `This file contains birth data in clear text; ${n} ${n === 1 ? 'event' : 'events'}${notes ? ` (${notes} with a private note)` : ''}${session.frozen.length ? `; ${session.frozen.length} frozen ${session.frozen.length === 1 ? 'forecast' : 'forecasts'}` : ''}.`;
}

/** Whether the file was made under the rules now loaded; a mismatch means its frozen forecasts no longer reproduce. */
export const sessionRulesetMatches = (s: Session): boolean => s.rulesetVersion === RULESET_VERSION;
