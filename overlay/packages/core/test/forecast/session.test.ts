// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONVENTIONS } from '../../src/conventions.ts';
import { MS } from '../../src/substrate/time.ts';
import {
  amendEvent,
  DEFAULT_FORECAST_CONVENTIONS,
  evaluate,
  eventWindow,
  exportConfirmation,
  exportSession,
  freezeForecast,
  hashNativity,
  importSession,
  MAX_EVENTS,
  MAX_FROZEN,
  MAX_SESSION_BYTES,
  RULESET_VERSION,
  SESSION_SCHEMA,
  sessionRulesetMatches,
  SessionError,
  splitByFreeze,
  validateSession,
  type ForecastEvent,
  type Session,
} from '../../src/forecast/index.ts';
import { eventsFrom, FREEZE_DAYS, nativityOf, SAMPLE_OFFSETS } from '../../../../fixtures/events.ts';
import { input, moment, registry } from './synthetic.ts';

const result = evaluate(input(), { registry: registry(), runs: 20 });

function make(): Session {
  const nativity = nativityOf('j2000');
  return {
    schema: SESSION_SCHEMA,
    rulesetVersion: RULESET_VERSION,
    conventions: { engine: DEFAULT_CONVENTIONS, forecast: DEFAULT_FORECAST_CONVENTIONS },
    nativity,
    events: eventsFrom('j2000', SAMPLE_OFFSETS),
    frozen: [freezeForecast(result, nativity, moment().utcMs + FREEZE_DAYS * MS.DAY)],
  };
}

const text = (s: unknown): string => JSON.stringify(s);
const mutate = (fn: (s: any) => void): string => {
  const s = JSON.parse(text(make()));
  fn(s);
  return text(s);
};
const code = (t: string): string => {
  try {
    importSession(t);
  } catch (e) {
    expect(e).toBeInstanceOf(SessionError);
    return (e as SessionError).code;
  }
  return 'accepted';
};

describe('events', () => {
  it('are built from day offsets of a sample moment and hold no free text', () => {
    const events = eventsFrom('j2000', SAMPLE_OFFSETS);
    expect(events[0]!.utcMs - moment().utcMs).toBe(9100 * MS.DAY);
    for (const e of events) expect(Object.keys(e).sort()).toEqual(['enteredAtUtcMs', 'id', 'precision', 'topic', 'utcMs', 'valence']);
  });

  it('cover the window their precision names, in UTC', () => {
    const e = (precision: ForecastEvent['precision']): ForecastEvent => ({ ...eventsFrom('j2000', [{ ...SAMPLE_OFFSETS[0]!, precision }])[0]! });
    const d = eventWindow(e('day'));
    expect(d.endUtcMs - d.startUtcMs).toBe(MS.DAY);
    const m = eventWindow(e('month'));
    expect(new Date(m.startUtcMs).getUTCDate()).toBe(1);
    expect(m.endUtcMs - m.startUtcMs).toBeGreaterThanOrEqual(28 * MS.DAY);
    expect(m.endUtcMs - m.startUtcMs).toBeLessThanOrEqual(31 * MS.DAY);
    const y = eventWindow(e('year'));
    expect(new Date(y.startUtcMs).getUTCMonth()).toBe(0);
    expect(y.endUtcMs - y.startUtcMs).toBeGreaterThanOrEqual(365 * MS.DAY);
    expect(e('day').utcMs).toBeGreaterThanOrEqual(d.startUtcMs);
    expect(e('day').utcMs).toBeLessThan(d.endUtcMs);
  });

  it('cannot have the precision, date or id edited once saved; topic and valence can change', () => {
    const e = make().events[0]!;
    expect(amendEvent(e, { valence: 'bad' }).valence).toBe('bad');
    expect(amendEvent(e, { topic: 'career' }).topic).toBe('career');
    for (const patch of [{ precision: 'year' }, { utcMs: 1 }, { id: 'zz' }, { enteredAtUtcMs: 1 }]) expect(() => amendEvent(e, patch as never)).toThrow(/cannot be changed/);
    expect(e.valence).toBe('good');
  });
});

describe('frozen forecasts', () => {
  const n = nativityOf('j2000');
  it('are hashed from ruleset version, conventions, nativity hash and span, reproducibly', () => {
    const a = freezeForecast(result, n, 5);
    const b = freezeForecast(evaluate(input(), { registry: registry(), runs: 20 }), n, 99);
    expect(a.hash).toBe(b.hash);
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.nativityHash).toBe(hashNativity(n));
    expect(a.rulesetVersion).toBe(result.rulesetVersion);
    expect(JSON.stringify(a)).not.toMatch(/civil|latitude|zone/);
  });
  it('change when a convention, the span, the rules or the nativity change', () => {
    const base = freezeForecast(result, n, 5).hash;
    const conv = evaluate(input({ forecastConventions: { suiYunSign: 'favourable-element' } }), { registry: registry(), runs: 20 });
    expect(freezeForecast(conv, n, 5).hash).not.toBe(base);
    expect(freezeForecast(evaluate(input({ toYear: 2039 }), { registry: registry(), runs: 20 }), n, 5).hash).not.toBe(base);
    expect(freezeForecast({ ...result, rulesetVersion: '0123456789abcdef' }, n, 5).hash).not.toBe(base);
    expect(freezeForecast(result, nativityOf('southern'), 5).hash).not.toBe(base);
  });
  it('count only events entered after the freeze', () => {
    const s = make();
    const frozen = s.frozen[0]!;
    const { counted, enteredBefore } = splitByFreeze(s.events, frozen);
    expect(counted.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect(enteredBefore.map((e) => e.id)).toEqual(['e4']);
    expect(splitByFreeze(s.events, { ...frozen, frozenAtUtcMs: frozen.frozenAtUtcMs + 1e12 }).counted).toEqual([]);
  });
});

describe('the session file', () => {
  it('round-trips: what is exported is what is imported, and exporting again is identical', () => {
    const s = make();
    const t = exportSession(s);
    const back = importSession(t);
    expect(back).toEqual(s);
    expect(exportSession(back)).toBe(t);
    expect(sessionRulesetMatches(back)).toBe(true);
    expect(sessionRulesetMatches({ ...back, rulesetVersion: '0000000000000000' })).toBe(false);
  });

  it('has no frozen list when none was given, and accepts that', () => {
    const t = mutate((s) => delete s.frozen);
    expect(importSession(t).frozen).toEqual([]);
  });

  it('says what it contains before export', () => {
    expect(exportConfirmation(make())).toBe('This file contains birth data in clear text; 4 events; 1 frozen forecast.');
    expect(exportConfirmation({ ...make(), events: [make().events[0]!], frozen: [] })).toBe('This file contains birth data in clear text; 1 event.');
  });

  it('rejects text that is not JSON, a wrong schema, and a file that is too large', () => {
    expect(code('not json')).toBe('not-json');
    expect(code('[]')).toBe('schema');
    expect(code(mutate((s) => (s.schema = 'overlay-session/2')))).toBe('schema');
    expect(code(mutate((s) => (s.schema = 'x'.repeat(100))))).toBe('schema');
    expect(code(' '.repeat(MAX_SESSION_BYTES + 1))).toBe('too-large');
    expect(() => importSession(42 as never)).toThrow(SessionError);
  });

  it('rejects unknown keys at every level', () => {
    expect(code(mutate((s) => (s.note = 'hello')))).toBe('unknown-key');
    expect(code(mutate((s) => (s.events[0].note = 'hello')))).toBe('unknown-key');
    expect(code(mutate((s) => (s.nativity.name = 'someone')))).toBe('unknown-key');
    expect(code(mutate((s) => (s.nativity.place.altitude = 1)))).toBe('unknown-key');
    expect(code(mutate((s) => (s.conventions.forecast.extra = true)))).toBe('unknown-key');
    expect(code(mutate((s) => (s.frozen[0].comment = 'x')))).toBe('unknown-key');
    expect(code(mutate((s) => (s.frozen[0].span.x = 1)))).toBe('unknown-key');
  });

  it('rejects prototype keys anywhere, and leaves the prototype of every object alone', () => {
    const proto = (path: string): string => text(make()).replace(path, `"__proto__":{"polluted":true},${path}`);
    expect(code(proto('"schema"'))).toBe('unknown-key');
    expect(code(proto('"id":"e1"'))).toBe('unknown-key');
    expect(code(text(make()).replace('"schema"', '"constructor":{"prototype":{}},"schema"'))).toBe('unknown-key');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const back = importSession(exportSession(make()));
    expect(Object.getPrototypeOf(back.events[0])).toBe(Object.prototype);
  });

  it('rejects missing fields, wrong types and numbers out of range', () => {
    expect(code(mutate((s) => delete s.events[0].topic))).toBe('schema');
    expect(code(mutate((s) => delete s.nativity))).toBe('schema');
    expect(code(mutate((s) => (s.events = {})))).toBe('schema');
    expect(code(mutate((s) => (s.events[0].utcMs = '5')))).toBe('schema');
    expect(code(mutate((s) => (s.events[0].utcMs = 1e20)))).toBe('range');
    expect(code(mutate((s) => (s.events[0].utcMs = 1.5)))).toBe('range');
    expect(code(mutate((s) => (s.events[0].precision = 'hour')))).toBe('schema');
    expect(code(mutate((s) => (s.events[0].topic = 'luck')))).toBe('schema');
    expect(code(mutate((s) => (s.events[0].id = 'a b')))).toBe('schema');
    expect(code(mutate((s) => (s.nativity.place.latitude = 91)))).toBe('range');
    expect(code(mutate((s) => (s.nativity.civil.month = 13)))).toBe('range');
    expect(code(mutate((s) => (s.nativity.zone = 'x'.repeat(65))))).toBe('schema');
    expect(code(mutate((s) => (s.rulesetVersion = 'xyz')))).toBe('schema');
    expect(code(mutate((s) => (s.frozen[0].hash = 'abc')))).toBe('schema');
    expect(code(mutate((s) => (s.conventions.engine.timeBasis = 'sundial')))).toBe('schema');
    expect(code(mutate((s) => (s.conventions.forecast.cap_ungated = 'maybe')))).toBe('schema');
    expect(code(mutate((s) => (s.conventions.forecast.birthTimeLimitMinutes = 61)))).toBe('schema');
    expect(code(mutate((s) => (s.events[1].id = s.events[0].id)))).toBe('schema');
  });

  it('rejects more events and more frozen forecasts than the caps allow, but accepts the cap itself', () => {
    const many = (n: number): string => mutate((s) => (s.events = Array.from({ length: n }, (_, i) => ({ ...s.events[0], id: `ev${i}` }))));
    expect(code(many(MAX_EVENTS + 1))).toBe('count');
    expect(importSession(many(MAX_EVENTS)).events).toHaveLength(MAX_EVENTS);
    expect(code(mutate((s) => (s.frozen = Array.from({ length: MAX_FROZEN + 1 }, () => s.frozen[0]))))).toBe('count');
  });

  it('refuses to export what it would refuse to import', () => {
    expect(() => exportSession({ ...make(), schema: 'nope' as never })).toThrow(SessionError);
    expect(() => validateSession({ ...make(), events: [{ ...make().events[0]!, topic: 'x' as never }] })).toThrow(SessionError);
    const big = { ...make(), events: Array.from({ length: MAX_EVENTS }, (_, i) => ({ ...make().events[0]!, id: `ev${i}` })) };
    expect(exportSession(big).length).toBeLessThan(MAX_SESSION_BYTES);
  });

  it('keeps no field that could hold a note about a person', () => {
    const t = exportSession(make());
    expect(t).not.toMatch(/"(note|notes|label|name|comment|description|text)"/);
  });
});
