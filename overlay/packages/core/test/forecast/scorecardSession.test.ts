// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Scoring a whole session with the real rules: a frozen forecast is re-evaluated from the nativity and
 * conventions in the file and must match its hashes, or it is not counted. Freezing in a session.
 */
import { describe, expect, it } from 'vitest';
import {
  addEvent,
  DEFAULT_FORECAST_CONVENTIONS,
  freezeInSession,
  importSession,
  exportSession,
  newSession,
  PINNED_MESSAGE,
  parseEventDate,
  reproduceFrozen,
  scoreSession,
  SessionEditError,
  type Session,
} from '../../src/forecast/index.ts';
import { DEFAULT_CONVENTIONS } from '../../src/conventions.ts';
import { MS } from '../../src/substrate/time.ts';
import { eventsFrom, nativityOf, SCORECARD_FREEZE_DAYS, SCORECARD_SAMPLE_OFFSETS } from '../../../../fixtures/events.ts';
import { moment } from './synthetic.ts';

const base = moment().utcMs;
const n = nativityOf('j2000');
const conventions = { engine: DEFAULT_CONVENTIONS, forecast: DEFAULT_FORECAST_CONVENTIONS };
const at = (days: number): number => base + days * MS.DAY;

const frozenOnce = (): Session => freezeInSession(newSession(n), { nativity: n, conventions }, { fromYear: 2026, toYear: 2030 }, at(SCORECARD_FREEZE_DAYS.first));

describe('freezing in a session', () => {
  it('takes the nativity and settings of the first freeze and keeps them', () => {
    const s = frozenOnce();
    expect(s.frozen).toHaveLength(1);
    expect(reproduceFrozen(s, s.frozen[0]!)).not.toBeNull();
    const other = { nativity: nativityOf('southern'), conventions };
    expect(() => freezeInSession(s, other, { fromYear: 2026, toYear: 2030 }, at(9600))).toThrow(PINNED_MESSAGE);
    const changed = { nativity: n, conventions: { ...conventions, forecast: { ...conventions.forecast, baziSexConvention: 'male-chart' as const } } };
    expect(() => freezeInSession(s, changed, { fromYear: 2026, toYear: 2030 }, at(9600))).toThrow(SessionEditError);
  });

  it('refuses the same forecast twice, an inverted span and a span that is too long', () => {
    const s = frozenOnce();
    expect(() => freezeInSession(s, { nativity: n, conventions }, { fromYear: 2026, toYear: 2030 }, at(9700))).toThrow(/already frozen/);
    expect(() => freezeInSession(newSession(n), { nativity: n, conventions }, { fromYear: 2030, toYear: 2026 }, at(9700))).toThrow(/not be before/);
    expect(() => freezeInSession(newSession(n), { nativity: n, conventions }, { fromYear: 2000, toYear: 2100 }, at(9700))).toThrow(/at most/);
  });

  it('writes a file that reads back and scores the same', () => {
    const s = frozenOnce();
    const withEvents = { ...s, events: eventsFrom('j2000', SCORECARD_SAMPLE_OFFSETS) };
    const back = importSession(exportSession(withEvents));
    expect(scoreSession(back)).toEqual(scoreSession(withEvents));
  });
});

describe('scoring a session with the real rules', () => {
  const s: Session = { ...frozenOnce(), events: eventsFrom('j2000', SCORECARD_SAMPLE_OFFSETS) };
  const c = scoreSession(s);

  it('lists the two events before the freeze as frozen too late and scores those inside the span', () => {
    expect(c.events.filter((e) => e.status === 'frozen-too-late').map((e) => e.eventId)).toEqual(['e1', 'e2']);
    expect(c.events.filter((e) => e.status === 'scored').map((e) => e.eventId)).toEqual(['e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9']);
    expect(c.events.filter((e) => e.status === 'outside-span').map((e) => e.eventId)).toEqual(['e10', 'e11', 'e12', 'e13', 'e14']);
  });

  it('does not count a forecast that does not match its hash', () => {
    const tampered: Session = { ...s, frozen: [{ ...s.frozen[0]!, contentHash: 'f'.repeat(64) }] };
    expect(reproduceFrozen(tampered, tampered.frozen[0]!)).toBeNull();
    const t = scoreSession(tampered);
    expect(t.events.filter((e) => e.status === 'not-reproducible')).toHaveLength(7);
    expect(t.totals).toEqual({ held: 0, didNotHold: 0, notScored: 0, saidNothing: 0 });
  });

  it('does not count a forecast made under other rules or for another moment', () => {
    expect(reproduceFrozen(s, { ...s.frozen[0]!, rulesetVersion: '0123456789abcdef' })).toBeNull();
    expect(reproduceFrozen({ ...s, nativity: nativityOf('southern') }, s.frozen[0]!)).toBeNull();
    expect(reproduceFrozen(s, { ...s.frozen[0]!, span: { startUtcMs: 0, endUtcMs: 4e12 } })).toBeNull();
  });

  it('uses a cache kept by the caller and gives the same counts', () => {
    const cache = new Map();
    expect(scoreSession(s, { cache })).toEqual(c);
    expect(cache.size).toBe(1);
    expect(scoreSession(s, { cache })).toEqual(c);
    expect(cache.size).toBe(1);
  });

  it('adds an event as the next one and scores it in the same call', () => {
    const { session } = addEvent(s, { date: parseEventDate('2029-05-05'), topic: 'wealth', valence: 'good' }, at(13000));
    const more = scoreSession(session);
    expect(more.eventCount).toBe(15);
    expect(more.events.at(-1)!.status).toBe('scored');
  });
});
