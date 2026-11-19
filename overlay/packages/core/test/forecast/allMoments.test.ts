// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Every bound tradition on every sample moment over 2031 to 2060, all topics: no slot left
 * unfilled, no banned word, no statement twice in a statement list, every year of every year
 * view either speaking or explicitly silent, and thirty years without a runaway. The
 * calculation of one moment is shared by the checks that read it.
 */
import { describe, expect, it } from 'vitest';
import {
  agreementDisplay,
  bannedIn,
  evaluate,
  makeInput,
  narrate,
  statementList,
  TEXT,
  TOPICS,
  yearView,
  MORTALITY_WORDS,
  type ForecastResult,
} from '../../src/forecast/index.ts';
import { makeMoment } from '../../src/substrate/time.ts';
import { MOMENTS } from '../../../../fixtures/moments.ts';

// A guard against a runaway (a loop that no longer ends, a calculation made per day that was made per year), not a
// speed target. A wall-clock limit is a property of the machine it is measured on: on the shared runner of the
// continuous-integration service one moment took 5.0 seconds where the others took about 3, so the first limit of five
// seconds failed without any change in the engine. Thirty seconds is about ten times the usual time, which a slow shared
// machine does not reach, while a real regression of that size still fails.
const SECONDS_LIMIT = 30;
const cache = new Map<string, { result: ForecastResult; seconds: number }>();

function run(id: string): { result: ForecastResult; seconds: number } {
  let c = cache.get(id);
  if (!c) {
    const f = MOMENTS.find((m) => m.id === id)!;
    const input = makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2031, toYear: 2060 });
    const t = performance.now();
    const result = evaluate(input, { runs: 20, seed: 1 });
    c = { result, seconds: (performance.now() - t) / 1000 };
    cache.set(id, c);
  }
  return c;
}

/** Every string a reader meets for a topic. */
function readerStrings(result: ForecastResult, topic: (typeof TOPICS)[number]): string[] {
  const list = statementList(result, topic);
  const view = yearView(result, topic);
  const display = agreementDisplay(result, topic);
  const out: string[] = [list.natalHeading, ...list.chartNotes, ...list.unattached.map((u) => u.line)];
  for (const e of [...list.natal, ...list.dated]) out.push(e.sentence, e.levelLabel, ...e.badges, ...e.qualifiers.map((q) => q.sentence));
  for (const y of view.years) out.push(y.summary, ...y.levels.flatMap((l) => [l.label, l.tallyText, l.note ?? '', l.chartNote ?? '']));
  out.push(...view.periodRead.map((p) => p.line));
  if (!display.shown) out.push(display.line);
  if (display.shown) out.push(display.baselineLine, ...display.sentences, ...display.years.map((y) => y.text), ...display.years.flatMap((y) => y.notes));
  out.push(...narrate(result, topic).map((s) => s.text));
  return out.filter((x) => x !== '');
}

describe.each(MOMENTS.map((m) => m.id))('every bound tradition, 2031 to 2060, on the sample moment %s', (id) => {
  it('evaluates thirty years without a runaway, in under thirty seconds', () => {
    expect(run(id).seconds).toBeLessThan(SECONDS_LIMIT);
  }, 120_000);

  it('leaves no slot unfilled and no banned word in a sentence or a note', () => {
    const { result } = run(id);
    expect(result.signals.length).toBeGreaterThan(100);
    for (const s of result.signals) {
      expect(s.sentence, s.id).not.toMatch(/[{}]/);
      expect(s.sentence.trim().length, s.id).toBeGreaterThan(10);
      expect(bannedIn(s.sentence), s.id).toBeNull();
      // health sentences carry no mortality wording, but for the one negated phrase the phrasebook names
      if (s.topic === 'health' && s.ruleId !== 'parashari.dasha-lord-2nd-7th-maraka') expect(MORTALITY_WORDS.test(s.sentence), s.id).toBe(false);
    }
    for (const topic of TOPICS) {
      for (const text of readerStrings(result, topic)) {
        expect(text, topic).not.toMatch(/[{}]/);
        expect(bannedIn(text), `${topic}: ${text}`).toBeNull();
      }
    }
    for (const n of result.chartNotes) expect(bannedIn(n.text)).toBeNull();
  }, 120_000);

  it('lists no statement twice', () => {
    const { result } = run(id);
    expect(new Set(result.signals.map((s) => s.id)).size).toBe(result.signals.length);
    for (const topic of TOPICS) {
      const list = statementList(result, topic);
      const dated = list.dated.map((e) => e.signalId);
      expect(new Set(dated).size, topic).toBe(dated.length);
      // the same rule, level, span and sentence is the same statement. (A mahadasha and its first antardasha of the same lord say
      // the same sentence from the same day on two levels; they are two statements of two levels, and the span end of a
      // statement clipped by the end of the request can make them look alike, which the level tells apart.)
      const key = (e: (typeof list.dated)[number]) => `${e.ruleId}|${e.level}|${e.startUtcMs}|${e.endUtcMs}|${e.sentence}`;
      expect(new Set(list.dated.map(key)).size, `${topic} by rule, level, span and sentence`).toBe(list.dated.length);
      const natal = list.natal.map((e) => `${e.ruleId}|${e.sentence}`);
      expect(new Set(natal).size, `${topic} natal`).toBe(natal.length);
      const qualifiers = [...list.natal, ...list.dated].flatMap((e) => e.qualifiers.map((q) => q.signalId));
      expect(new Set(qualifiers).size, `${topic} qualifiers`).toBe(qualifiers.length);
      // a qualifier is never also an entry
      for (const q of qualifiers) expect(dated.includes(q), q).toBe(false);
    }
  }, 120_000);

  it('gives every year of every year view either level words or an explicit silence', () => {
    const { result } = run(id);
    for (const topic of TOPICS) {
      const view = yearView(result, topic);
      expect(view.years).toHaveLength(30);
      const list = statementList(result, topic);
      const known = new Set(list.dated.map((e) => e.signalId));
      for (const y of view.years) {
        expect(y.summary.length, `${topic} ${y.year}`).toBeGreaterThan(0);
        const speaking = y.levels.filter((l) => !y.silent.includes(l.level));
        if (speaking.length === 0) {
          // explicit silence: the sentence says so, and every level it names is listed as silent
          expect(y.summary.startsWith(TEXT.nothingAtAnyLevel), `${topic} ${y.year}`).toBe(true);
          expect(y.levels.every((l) => y.silent.includes(l.level)), `${topic} ${y.year}`).toBe(true);
        } else {
          for (const l of speaking) {
            expect(y.summary, `${topic} ${y.year} ${l.label}`).toContain(l.label);
            expect(l.entries.length, `${topic} ${y.year} ${l.label}`).toBeGreaterThan(0);
            for (const e of l.entries) expect(known.has(e.signalId), e.signalId).toBe(true);
          }
        }
        for (const lv of y.silent) expect(y.summary, `${topic} ${y.year}`).toContain(`${TEXT.silentHeading}:`);
        // a level is silent exactly when it has no deciding statement and no active one
        for (const l of y.levels) expect(y.silent.includes(l.level), `${topic} ${y.year} ${l.label}`).toBe(l.word === 'nothing-said' && l.tally.active === 0);
      }
    }
  }, 120_000);
});
