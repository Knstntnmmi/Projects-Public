// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The note under the last BaZi entry of the natal list: that births in the same
 * double-hour of the civil clock (the Zi double-hour counts as one), on the same side of the month's turn, have the same four pillars.
 * The note is printed only under the defaults it names, and it is no signal. The property it states
 * is proved on the engine with constructed moments only.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONVENTIONS } from '../../src/conventions.ts';
import { evaluate, makeInput, narrate, statementList, TEXT, tallyOf, type ForecastResult } from '../../src/forecast/index.ts';
import { fourPillars } from '../../src/systems/bazi/index.ts';
import { makeMoment, momentFromUtc, MS, type Moment } from '../../src/substrate/time.ts';
import { fixture } from '../../../../fixtures/moments.ts';

const momentOf = (id: string): Moment => {
  const f = fixture(id);
  return makeMoment(f.civil, f.zone, f.place);
};
const minutesFrom = (m: Moment, minutes: number): Moment => momentFromUtc(m.utcMs + minutes * MS.MIN, m.zone, m.place);
const pillarsOf = (m: Moment): string => {
  const p = fourPillars(m, DEFAULT_CONVENTIONS);
  return [p.year, p.month, p.day, p.hour].map((x) => x.hanzi).join(' ');
};

describe('the engine property behind the note', () => {
  // 'jiazi-1984' is noon in Beijing, inside the Wu double-hour (11:00 to 13:00), weeks from a turn of the month.
  const noon = momentOf('jiazi-1984');

  it('gives the same four pillars to two moments in one double-hour of the civil clock', () => {
    expect(pillarsOf(minutesFrom(noon, -50))).toBe(pillarsOf(noon));
    expect(pillarsOf(minutesFrom(noon, 50))).toBe(pillarsOf(noon));
    expect(pillarsOf(minutesFrom(noon, -50))).toBe(pillarsOf(minutesFrom(noon, 50)));
    // the same holds in the double-hour of the other constructed moment, 16:39 and 16:54, after the turn of the month at about 16:27
    const after = momentOf('lichun-after-2024');
    expect(pillarsOf(minutesFrom(after, 25))).toBe(pillarsOf(minutesFrom(after, 10)));
  });

  it('gives the same four pillars across midnight inside the Zi double-hour, and different ones on one date either side of it', () => {
    // noon plus 11h30 is 23:30; plus 12h30 is 00:30 on the next date; both lie in the Zi double-hour (23:00 to 01:00)
    const lateZi = minutesFrom(noon, 11 * 60 + 30);
    const earlyZi = minutesFrom(noon, 12 * 60 + 30);
    expect(pillarsOf(lateZi)).toBe(pillarsOf(earlyZi));
    // 00:30 and 23:30 on the same date are two parts of the Zi double-hour and have different day pillars
    const sameDateEarly = minutesFrom(noon, -(11 * 60 + 30));
    expect(pillarsOf(sameDateEarly)).not.toBe(pillarsOf(lateZi));
    expect(fourPillars(sameDateEarly, DEFAULT_CONVENTIONS).day).not.toEqual(fourPillars(lateZi, DEFAULT_CONVENTIONS).day);
  });

  it('gives different four pillars to a pair split by a double-hour boundary', () => {
    // 12:50 and 13:10 on the same date, either side of the start of the Wei double-hour
    const a = minutesFrom(noon, 50);
    const b = minutesFrom(noon, 70);
    expect(pillarsOf(a)).not.toBe(pillarsOf(b));
    const pa = fourPillars(a, DEFAULT_CONVENTIONS);
    const pb = fourPillars(b, DEFAULT_CONVENTIONS);
    expect(pa.day).toEqual(pb.day);
    expect(pa.hour).not.toEqual(pb.hour);
  });

  it('gives different four pillars to a pair split by the turn of a month', () => {
    // two minutes before and two minutes after Lichun 2024, on one date and in one double-hour
    const before = momentOf('lichun-eve-2024');
    const after = momentOf('lichun-after-2024');
    expect(fourPillars(before, DEFAULT_CONVENTIONS).hour).toEqual(fourPillars(after, DEFAULT_CONVENTIONS).hour);
    expect(fourPillars(before, DEFAULT_CONVENTIONS).day).toEqual(fourPillars(after, DEFAULT_CONVENTIONS).day);
    expect(pillarsOf(before)).not.toBe(pillarsOf(after));
  });
});

describe('the note in the statement list', () => {
  const run = (conventions: Partial<typeof DEFAULT_CONVENTIONS>): ForecastResult =>
    evaluate(makeInput(momentOf('j2000'), { fromYear: 2031, toYear: 2035, conventions: { ...DEFAULT_CONVENTIONS, ...conventions } }), { topics: ['wealth'], runs: 20, seed: 1 });

  it('appears once, after the last BaZi entry of the natal list, under the defaults', () => {
    const list = statementList(run({}), 'wealth');
    const bazi = list.natal.filter((e) => e.tradition === 'bazi');
    expect(bazi.length).toBeGreaterThan(0);
    expect(list.sharedChartNote).toEqual({ afterSignalId: bazi[bazi.length - 1]!.signalId, text: TEXT.baziSharedChartNote });
  });

  it('is absent with the day turning at midnight', () => {
    expect(statementList(run({ dayBoundary: 'midnight' }), 'wealth').sharedChartNote).toBeNull();
  });

  it('is absent under another time basis', () => {
    for (const timeBasis of ['standard', 'lmt', 'apparent'] as const) expect(statementList(run({ timeBasis }), 'wealth').sharedChartNote, timeBasis).toBeNull();
  });

  it('is no signal and changes no word, tally or sentence of the forecast', () => {
    const r = run({});
    const list = statementList(r, 'wealth');
    expect(r.signals.some((s) => s.sentence.includes(list.sharedChartNote!.text))).toBe(false);
    expect(list.natal.some((e) => e.sentence === list.sharedChartNote!.text)).toBe(false);
    expect(narrate(r, 'wealth').some((s) => s.text.includes(list.sharedChartNote!.text))).toBe(false);
    for (const x of r.readings) expect(tallyOf(x.signalIds.map((id) => r.signals.find((s) => s.id === id)!))).toEqual(x.tally);
  });
});
