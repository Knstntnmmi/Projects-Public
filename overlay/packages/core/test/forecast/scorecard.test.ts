// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The scorecard: the no-hindsight rule, each cell of the held table, the reasons a statement is
 * not scored, the shared clock, the comparison with shuffled dates, the threshold, the wording, and one
 * session of five events worked out by hand. The forecast is the invented one of scorecardFixtures.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  addEvent,
  bannedIn,
  comparisonLine,
  eventWindow,
  exportConfirmation,
  exportSession,
  importSession,
  MAX_NOTE_CHARS,
  MIN_PAIRS_TO_COMPARE,
  newSession,
  outcomeOf,
  parseEventDate,
  parseTopic,
  parseWent,
  RULESET_VERSION,
  scoreAgainst,
  SCORECARD_SENTENCE,
  scorecardJson,
  scorecardLines,
  scorecardPhrases,
  SessionError,
  type ForecastEvent,
  type Scorecard,
  type Session,
} from '../../src/forecast/index.ts';
import { MS } from '../../src/substrate/time.ts';
import { nativityOf } from '../../../../fixtures/events.ts';
import { forecastsAt, FROZEN_AT } from './scorecardFixtures.ts';

type Spec = [date: string, topic: string, went: 'well' | 'badly'];

function sessionOf(specs: readonly Spec[]): Session {
  let s: Session = newSession(nativityOf('j2000'));
  for (const [date, topic, went] of specs) s = addEvent(s, { date: parseEventDate(date), topic: parseTopic(topic), valence: parseWent(went) }, 0).session;
  return s;
}

const card = (specs: readonly Spec[], times: readonly number[] = [FROZEN_AT], options = {}): Scorecard => scoreAgainst(sessionOf(specs).events, forecastsAt(...times), RULESET_VERSION, options);

const FIVE: Spec[] = [
  ['2033-06-15', 'wealth', 'well'],
  ['2036-03-01', 'wealth', 'badly'],
  ['2037-09-09', 'wealth', 'well'],
  ['2038-01-10', 'wealth', 'badly'],
  ['2040', 'wealth', 'well'],
];

describe('the session of five events, worked out by hand', () => {
  // The statements for wealth are listed in scorecardFixtures.ts. For each event, the ones that span its dates:
  //   e1 went well, 2033-06-15:  luck pillar supports (held), Jupiter from the Moon supports (held).
  //      Silent: year pillar, mahadasha, Western transits (3). Natal: 1 not scored.
  //   e2 went badly, 2036-03-01: year pillar cautions (held), mahadasha supports (did not hold).
  //      Silent: luck pillar, Jupiter, Western transits (3). Natal: 1.
  //   e3 went well, 2037-09-09:  Jupiter supports (held), Western transits supports (held).
  //      Silent: luck pillar, year pillar, mahadasha (3). Natal: 1.
  //   e4 went badly, 2038-01-10: year pillar cautions (held), Jupiter supports (did not hold), Western transits supports (did not hold).
  //      Silent: luck pillar, mahadasha (2). Natal: 1.
  //   e5 went well, the year 2040: Jupiter's note without a direction (not scored). Silent: luck, year, mahadasha, Western (4). Natal: 1.
  const c = card(FIVE);

  it('says how many events and forecasts there are, and that the counts are this reader\'s', () => {
    expect(c.eventCount).toBe(5);
    expect(c.frozenCount).toBe(1);
    expect(scorecardLines(c).slice(0, 2)).toEqual(['5 events recorded. 1 frozen forecast.', SCORECARD_SENTENCE]);
  });

  it('scores every event against the forecast', () => {
    expect(c.events.map((e) => e.status)).toEqual(['scored', 'scored', 'scored', 'scored', 'scored']);
  });

  it('has the totals: held 6, did not hold 3, not scored 6, said nothing 15', () => {
    expect(c.totals).toEqual({ held: 6, didNotHold: 3, notScored: 6, saidNothing: 15 });
    expect(c.notScoredByReason).toEqual({ mixed: 0, 'no-direction': 1, natal: 5 });
  });

  it('has the counts by technique', () => {
    const row = (level: string) => c.byLevel.find((r) => r.level === level)!.counts;
    expect(row('natal')).toEqual({ held: 0, didNotHold: 0, notScored: 5, saidNothing: 0 });
    expect(row('bazi-luck')).toEqual({ held: 1, didNotHold: 0, notScored: 0, saidNothing: 4 });
    expect(row('bazi-year')).toEqual({ held: 2, didNotHold: 0, notScored: 0, saidNothing: 3 });
    expect(row('vedic-maha')).toEqual({ held: 0, didNotHold: 1, notScored: 0, saidNothing: 4 });
    expect(row('jupiter-moon')).toEqual({ held: 2, didNotHold: 1, notScored: 1, saidNothing: 1 });
    expect(row('western-transits')).toEqual({ held: 1, didNotHold: 1, notScored: 0, saidNothing: 3 });
  });

  it('has the counts by tradition', () => {
    const row = (t: string) => c.byTradition.find((r) => r.tradition === t)!.counts;
    expect(row('bazi')).toEqual({ held: 3, didNotHold: 0, notScored: 5, saidNothing: 7 });
    expect(row('vedic')).toEqual({ held: 2, didNotHold: 2, notScored: 1, saidNothing: 5 });
    expect(row('western')).toEqual({ held: 1, didNotHold: 1, notScored: 0, saidNothing: 3 });
  });

  it('has the counts by rule, which never say "said nothing"', () => {
    const row = (id: string) => c.byRule.find((r) => r.ruleId === id)!.counts;
    expect(row('synth.bazi-luck')).toEqual({ held: 1, didNotHold: 0, notScored: 0, saidNothing: 0 });
    expect(row('synth.bazi-clash')).toEqual({ held: 2, didNotHold: 0, notScored: 0, saidNothing: 0 });
    expect(row('synth.vedic-dasha')).toEqual({ held: 0, didNotHold: 1, notScored: 0, saidNothing: 0 });
    expect(row('synth.vedic-jupiter')).toEqual({ held: 2, didNotHold: 1, notScored: 0, saidNothing: 0 });
    expect(row('synth.vedic-active')).toEqual({ held: 0, didNotHold: 0, notScored: 1, saidNothing: 0 });
    expect(row('synth.western-jupiter')).toEqual({ held: 1, didNotHold: 1, notScored: 0, saidNothing: 0 });
    expect(row('synth.bazi-natal')).toEqual({ held: 0, didNotHold: 0, notScored: 5, saidNothing: 0 });
    expect(c.byRule.reduce((n, r) => n + r.counts.held, 0)).toBe(6);
  });

  it('shows the techniques on the birth-arithmetic clock once, as a group', () => {
    // luck pillar, year pillar and mahadasha share it; Jupiter from the Moon and the Western transits do not.
    expect(c.sharedClock.levels).toEqual(['bazi-luck', 'bazi-year', 'vedic-maha']);
    // held: e1 luck, e2 year, e4 year. did not hold: e2 mahadasha. The group said nothing in e3 and e5 only.
    expect(c.sharedClock.counts).toEqual({ held: 3, didNotHold: 1, notScored: 0, saidNothing: 2 });
  });

  it('prints too few scored pairs to compare, because only 9 pairs were scored', () => {
    expect(c.comparison).toMatchObject({ pairs: 9, held: 6, atLeast: null, tooFew: true, runs: 1000 });
    expect(comparisonLine(c.comparison)).toContain('too few scored pairs to compare with shuffled dates');
  });
});

describe('the no-hindsight rule', () => {
  it('never scores an event against a forecast frozen after it', () => {
    const e = sessionOf([FIVE[0]!]).events[0]!;
    const w = eventWindow(e);
    const late = scoreAgainst([e], forecastsAt(w.startUtcMs + 1), RULESET_VERSION);
    expect(late.events[0]!.status).toBe('frozen-too-late');
    expect(late.events[0]!.pairs).toEqual([]);
    expect(late.totals).toEqual({ held: 0, didNotHold: 0, notScored: 0, saidNothing: 0 });
    expect(late.byRule).toEqual([]);
    expect(scorecardLines(late).join('\n')).toContain('frozen too late');
  });

  it('counts a forecast frozen at the very start of the event\'s day as too late, and one frozen a moment earlier as in time', () => {
    const e = sessionOf([FIVE[0]!]).events[0]!;
    const start = eventWindow(e).startUtcMs;
    expect(scoreAgainst([e], forecastsAt(start), RULESET_VERSION).events[0]!.status).toBe('frozen-too-late');
    expect(scoreAgainst([e], forecastsAt(start - 1), RULESET_VERSION).events[0]!.status).toBe('scored');
  });

  it('uses the start of the month or year an event covers, not the day it was typed as', () => {
    const [m, y] = sessionOf([['2033-06', 'wealth', 'well'], ['2033', 'wealth', 'well']]).events as [ForecastEvent, ForecastEvent];
    const mStart = eventWindow(m).startUtcMs;
    const yStart = eventWindow(y).startUtcMs;
    expect(scoreAgainst([m], forecastsAt(mStart + MS.DAY), RULESET_VERSION).events[0]!.status).toBe('frozen-too-late');
    expect(scoreAgainst([y], forecastsAt(yStart + MS.DAY), RULESET_VERSION).events[0]!.status).toBe('frozen-too-late');
    expect(scoreAgainst([y], forecastsAt(yStart - MS.DAY), RULESET_VERSION).events[0]!.status).toBe('scored');
  });

  it('scores against the earliest forecast frozen in time, and ignores one frozen later, and says so in the counts of forecasts', () => {
    const s = sessionOf(FIVE);
    const both = scoreAgainst(s.events, forecastsAt(FROZEN_AT, FROZEN_AT + 100 * MS.DAY), RULESET_VERSION);
    expect(both.frozenCount).toBe(2);
    expect(both.totals).toEqual(card(FIVE).totals);
    const first = both.events[0]!.forecastHash;
    expect(first).toBe(forecastsAt(FROZEN_AT)[0]!.frozen.hash);
  });

  it('lists an event as having no forecast when none is frozen, and counts nothing', () => {
    const c = scoreAgainst(sessionOf(FIVE).events, [], RULESET_VERSION);
    expect(c.events.every((e) => e.status === 'no-frozen-forecast')).toBe(true);
    expect(c.totals).toEqual({ held: 0, didNotHold: 0, notScored: 0, saidNothing: 0 });
    expect(c.comparison.tooFew).toBe(true);
    expect(scorecardLines(c).slice(0, 2)).toEqual(['5 events recorded. 0 frozen forecasts.', SCORECARD_SENTENCE]);
  });

  it('lists an event outside the span of the forecast and does not count it', () => {
    const c = card([['2029-05-05', 'wealth', 'well'], ['2041-01-01', 'wealth', 'well']], [FROZEN_AT - 2000 * MS.DAY]);
    expect(c.events.map((e) => e.status)).toEqual(['outside-span', 'outside-span']);
    expect(c.totals.held + c.totals.didNotHold + c.totals.notScored + c.totals.saidNothing).toBe(0);
  });

  it('does not score against a forecast that could not be reproduced', () => {
    const forecasts = forecastsAt(FROZEN_AT).map((f) => ({ ...f, result: null }));
    const c = scoreAgainst(sessionOf(FIVE).events, forecasts, RULESET_VERSION);
    expect(c.events.every((e) => e.status === 'not-reproducible')).toBe(true);
    expect(c.totals.held).toBe(0);
  });
});

describe('the held table', () => {
  it('has four cells: supports with went well and cautions with went badly hold; the other two do not', () => {
    expect(outcomeOf('supports', 'good')).toBe('held');
    expect(outcomeOf('supports', 'bad')).toBe('did-not-hold');
    expect(outcomeOf('cautions', 'bad')).toBe('held');
    expect(outcomeOf('cautions', 'good')).toBe('did-not-hold');
  });

  it('reaches the pairs: the luck pillar supports in 2034 and the year pillar cautions in 2036', () => {
    const outcomes = (date: string, went: 'well' | 'badly'): string[] => card([[date, 'wealth', went]]).events[0]!.pairs.filter((p) => p.outcome !== 'not-scored').map((p) => `${p.ruleId}:${p.outcome}`);
    expect(outcomes('2034-04-04', 'well')).toEqual(['synth.bazi-luck:held']);
    expect(outcomes('2034-04-04', 'badly')).toEqual(['synth.bazi-luck:did-not-hold']);
    // 2036 holds the year pillar's caution and the mahadasha's support
    expect(outcomes('2036-04-04', 'badly')).toEqual(['synth.bazi-clash:held', 'synth.vedic-dasha:did-not-hold']);
    expect(outcomes('2036-04-04', 'well')).toEqual(['synth.bazi-clash:did-not-hold', 'synth.vedic-dasha:held']);
  });

  it('pairs an event only with statements for its own topic', () => {
    const c = card([['2034-04-04', 'career', 'well']]);
    expect(c.events[0]!.pairs.filter((p) => p.outcome !== 'not-scored')).toEqual([]);
  });
});

describe('the statements that are not scored', () => {
  it('lists a mixed statement, a note without a direction and a natal statement, each with its reason', () => {
    const c = card([['2035-05-05', 'relationships', 'well'], ['2040-05-05', 'wealth', 'badly'], ['2033-05-05', 'wealth', 'badly']]);
    const reasons = (i: number): Array<string | null> => c.events[i]!.pairs.filter((p) => p.outcome === 'not-scored').map((p) => p.reason);
    expect(reasons(0)).toContain('mixed');
    expect(reasons(1)).toContain('no-direction');
    expect(reasons(1)).toContain('natal');
    expect(c.notScoredByReason.mixed).toBe(1);
    expect(c.notScoredByReason['no-direction']).toBe(1);
    expect(c.totals.notScored).toBe(Object.values(c.notScoredByReason).reduce((a, b) => a + b, 0));
    // a mixed or pointer statement is never held and never did not hold
    expect(c.events[0]!.pairs.some((p) => p.reason === 'mixed' && p.outcome !== 'not-scored')).toBe(false);
    const text = scorecardLines(c).join('\n');
    expect(text).toContain('mixed statement');
    expect(text).toContain('note without a direction');
    expect(text).toContain('natal statement without dates');
  });

  it('does not count a technique that has a statement without a direction as having said nothing', () => {
    const c = card([['2040-05-05', 'wealth', 'badly']]);
    expect(c.events[0]!.silent.map((s) => s.level)).not.toContain('jupiter-moon');
  });
});

describe('the comparison with shuffled dates', () => {
  const ten: Spec[] = Array.from({ length: 5 }, (_, i) => [`2033-0${i + 1}-10`, 'wealth', 'well'] as Spec);

  it('prints counts, not a verdict, once there are 10 scored pairs', () => {
    expect(MIN_PAIRS_TO_COMPARE).toBe(10);
    const c = card(ten);
    expect(c.comparison.pairs).toBe(10);
    expect(c.comparison.held).toBe(10);
    expect(c.comparison.tooFew).toBe(false);
    expect(c.comparison.atLeast).not.toBeNull();
    expect(c.comparison.atLeast!).toBeGreaterThanOrEqual(1);
    expect(c.comparison.atLeast!).toBeLessThanOrEqual(1000);
    expect(comparisonLine(c.comparison)).toMatch(/^With the dates shuffled, the held count was at least as high in \d+ of 1000 runs\./);
  });

  it('prints too few for 9 pairs and a number for 10', () => {
    const nine: Spec[] = [...ten.slice(0, 4), ['2034-05-10', 'wealth', 'well']];
    expect(card(nine).comparison).toMatchObject({ pairs: 9, tooFew: true, atLeast: null });
    expect(card(nine).comparison.runs).toBe(1000);
    expect(scorecardLines(card(nine)).join('\n')).toContain('too few scored pairs to compare with shuffled dates');
    expect(scorecardLines(card(ten)).join('\n')).not.toContain('too few scored pairs');
  });

  it('is seeded and reproducible: the same seed gives the same count, always', () => {
    const a = card(ten).comparison;
    const b = card(ten).comparison;
    expect(b).toEqual(a);
    expect(card(ten, [FROZEN_AT], { seed: 1 }).comparison).toEqual(a);
    expect(a.seed).toBe(1);
    const other = card(ten, [FROZEN_AT], { seed: 2 }).comparison;
    expect(other.seed).toBe(2);
    expect(card(ten, [FROZEN_AT], { seed: 2 }).comparison).toEqual(other);
  });

  it('counts every run when nothing held, because no shifted run can hold less than none', () => {
    // supports with went badly never holds, wherever the date is moved to
    const bad: Spec[] = Array.from({ length: 5 }, (_, i) => [`2033-0${i + 1}-10`, 'wealth', 'badly'] as Spec);
    const c = card(bad);
    expect(c.comparison.held).toBe(0);
    expect(c.comparison.pairs).toBe(10);
    expect(c.comparison.atLeast).toBe(1000);
  });

  it('moves every date by the same circular shift, which keeps the shifted dates inside the span', () => {
    const c = card(ten, [FROZEN_AT], { runs: 200 });
    expect(c.comparison.runs).toBe(200);
    expect(c.comparison.atLeast!).toBeLessThanOrEqual(200);
  });

  it('says nothing like significant, and prints no rate or percent', () => {
    const text = scorecardLines(card(ten)).join('\n');
    expect(text).not.toMatch(/significan|percent|%|ratio|rate of|score of|best|worst|accurate/i);
  });
});

describe('the words', () => {
  const cards = [card(FIVE), card([]), card([['2033-06-15', 'wealth', 'well']], []), card(FIVE, [FROZEN_AT + 9999 * MS.DAY])];
  it('use no banned word and no percent sign in any scorecard string', () => {
    for (const c of cards) for (const p of scorecardPhrases(c)) expect(bannedIn(p), p).toBeNull();
  });
  it('begin every output with the numbers and the sentence, in text and in JSON', () => {
    for (const c of cards) {
      const lines = scorecardLines(c);
      expect(lines[0]).toMatch(/^\d+ events? recorded\. \d+ frozen forecasts?\.$/);
      expect(lines[1]).toBe(SCORECARD_SENTENCE);
      expect(Object.keys(scorecardJson(c))[0]).toBe('about');
      expect(scorecardJson(c).about).toBe(SCORECARD_SENTENCE);
    }
  });
  it('print the held count of the sample as plain numbers', () => {
    expect(scorecardLines(cards[0]!).join('\n')).toContain('held 6, did not hold 3, not scored 6, said nothing 15');
    expect(JSON.stringify(scorecardJson(cards[0]!))).not.toMatch(/"(confidence|probability|score|percent|rate|ratio)"/);
  });
  it('say what is true about scoring in the six notes: it is built, and the design is the project\'s own', () => {
    const text = scorecardLines(cards[0]!).join('\n');
    expect(text).not.toMatch(/nothing is scored yet/);
    expect(text).toContain("The scorecard is the project's own design.");
    expect(text).toContain('a diary in which a space was left to check an oracle later');
  });
});

describe('the session and its private note', () => {
  it('keeps an optional note that nothing prints, and takes it back out of the file', () => {
    const s0 = sessionOf([FIVE[0]!]);
    const { session } = addEvent(s0, { date: parseEventDate('2034-02-02'), topic: 'career', valence: 'good', note: '  my private words  ' }, 0);
    expect(session.events[1]!.note).toBe('my private words');
    const text = exportSession(session);
    expect(importSession(text).events[1]!.note).toBe('my private words');
    expect(importSession(text).events[0]).not.toHaveProperty('note');
    expect(exportConfirmation(session)).toBe('This file contains birth data in clear text; 2 events (1 with a private note).');
    const c = scoreAgainst(session.events, forecastsAt(FROZEN_AT), RULESET_VERSION);
    expect(JSON.stringify(scorecardJson(c))).not.toContain('private words');
    expect(scorecardLines(c).join('\n')).not.toContain('private words');
  });

  it('refuses a note that is too long, not text, or holds a control character', () => {
    const base = JSON.parse(exportSession(sessionOf([FIVE[0]!])));
    const code = (note: unknown): string => {
      const raw = JSON.parse(JSON.stringify(base));
      raw.events[0].note = note;
      try {
        importSession(JSON.stringify(raw));
      } catch (e) {
        return (e as SessionError).code;
      }
      return 'accepted';
    };
    expect(code('x'.repeat(MAX_NOTE_CHARS))).toBe('accepted');
    expect(code('x'.repeat(MAX_NOTE_CHARS + 1))).toBe('range');
    expect(code(5)).toBe('schema');
    expect(code('a\u0001b')).toBe('schema');
    expect(code('two\nlines')).toBe('accepted');
  });

  it('reads dates, words and topics as typed, and refuses what it cannot read', () => {
    expect(Object.entries(parseEventDate('2033-06-15'))).toEqual([['year', 2033], ['month', 6], ['day', 15]]);
    expect(Object.entries(parseEventDate('2033-06'))).toEqual([['year', 2033], ['month', 6]]);
    expect(Object.entries(parseEventDate('2033'))).toEqual([['year', 2033]]);
    expect(() => parseEventDate('June 2033')).toThrow(/cannot read/);
    expect(() => addEvent(sessionOf([]), { date: parseEventDate('2033-02-30'), topic: 'wealth', valence: 'good' }, 0)).toThrow(/does not exist/);
    expect(parseWent('went well')).toBe('good');
    expect(parseWent('went badly')).toBe('bad');
    expect(() => parseWent('fine')).toThrow(/went well/);
    expect(() => parseTopic('luck')).toThrow(/unknown topic/);
  });

  it('gives each event the next free id and the precision its date has', () => {
    const s = sessionOf([['2033-06-15', 'wealth', 'well'], ['2033-07', 'wealth', 'well'], ['2034', 'wealth', 'badly']]);
    expect(s.events.map((e) => [e.id, e.precision])).toEqual([['e1', 'day'], ['e2', 'month'], ['e3', 'year']]);
  });
});
