// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The character of a short window, for the traditions that are read by period and not by year
 * (the I Ching). It is a calendar reading and does not depend on the nativity. Everything it
 * returns carries the badge "experimental". A window is at most 62 days: the line statements
 * are one a day, and a longer window would only be the wall the yearly forms were built to avoid.
 */
import { MS } from '../substrate/time.ts';
import { gradeStatement, gradeText, negatedDetail, type Grade } from '../systems/iching/grade.ts';
import { GUA_QI_CARDINAL_POSITION, SOVEREIGN_SEQUENCE } from '../systems/iching/wheels.ts';
import { hexagramByName, type Hexagram } from '../systems/iching/hexagrams.ts';
import { statementText } from '../systems/iching/zhouyiText.ts';
import { createContext, type ForecastInput } from './context.ts';
import { BADGE, TEXT, windowTooLongMessage } from './phrasebook.ts';
import { buildContext as buildIchingContext } from './predicates/iching.ts';
import { topicsOfStatement } from './predicates/ichingCues.ts';
import type { Span, Topic } from './types.ts';

export const MAX_WINDOW_DAYS = 62;

export interface IchingStatement {
  /** "number.line", the line 0 being the judgment of the whole hexagram. */
  id: string;
  hexagram: { number: number; hanzi: string; pinyin: string };
  /** 0 for the judgment, 1 to 6 from the bottom. */
  line: number;
  /** The Chinese text of the statement. */
  text: string;
  /** -3 to +3 by the grading of the verdict words; a modern construction on the text. */
  grade: number;
  gradeText: string;
  /** The topics the statement is attached to: 'general' where it has a grade, and the topics a cue rule names it for. Empty for a grade 0 that no cue names. */
  topics: Topic[];
  /** Verdict words a negation stood before and that were not graded, with the detail "negated, not graded"; null when none. */
  negated: string | null;
  badges: string[];
  startUtcMs: number;
  endUtcMs: number;
}

export interface PeriodCharacter {
  window: Span;
  /** The hexagram periods (gua qi) that overlap the window. */
  periods: IchingStatement[];
  /** The sovereign hexagram of each month that overlaps the window, with whether the month is growing or waning. */
  sovereign: Array<IchingStatement & { growing: boolean }>;
  /** The cardinal hexagram periods that overlap the window; empty unless the convention gives the cardinal hexagrams a period of their own. */
  cardinal: IchingStatement[];
  /** The line statement of each day: the line of the period's hexagram that the day falls in. */
  days: IchingStatement[];
  badges: string[];
  note: string;
}

const FOUR_CARDINAL = ['坎', '震', '離', '兌'].map((n) => hexagramByName(n).number);

function statementOf(h: Hexagram, line: number, startUtcMs: number, endUtcMs: number): IchingStatement {
  const text = statementText(h.number, line)!;
  const g: Grade = gradeStatement(text);
  return {
    id: `${h.number}.${line}`,
    hexagram: { number: h.number, hanzi: h.hanzi, pinyin: h.pinyin },
    line,
    text,
    grade: g.grade,
    gradeText: gradeText(g),
    topics: topicsOfStatement(`${h.number}.${line}`, g),
    negated: negatedDetail(g),
    badges: [BADGE.experimental],
    startUtcMs,
    endUtcMs,
  };
}

/**
 * The hexagram period or periods that overlap a window of at most 62 days, the sovereign
 * hexagram, the cardinal markers and the line of each day. A longer window is refused.
 */
export function periodCharacter(input: ForecastInput, range: Span): PeriodCharacter {
  const days = (range.endUtcMs - range.startUtcMs) / MS.DAY;
  if (!Number.isFinite(days) || days <= 0) throw new RangeError('The window must end after it starts.');
  if (days > MAX_WINDOW_DAYS) throw new RangeError(windowTooLongMessage(days, MAX_WINDOW_DAYS));
  const ctx = createContext({ ...input, span: range });
  const ich = buildIchingContext(ctx);
  return {
    window: range,
    periods: ich.periods.map((p) => statementOf(p.hexagram, 0, p.startUtcMs, p.endUtcMs)),
    sovereign: ctx.sovereign().map((s) => ({ ...statementOf(s.hexagram, 0, s.startUtcMs, s.endUtcMs), growing: SOVEREIGN_SEQUENCE.findIndex((h) => h.number === s.hexagram.number) < 6 })),
    cardinal: ich.periods.filter((p) => p.position >= GUA_QI_CARDINAL_POSITION && FOUR_CARDINAL.includes(p.hexagram.number)).map((p) => statementOf(p.hexagram, 0, p.startUtcMs, p.endUtcMs)),
    days: ich.slices.map((s) => statementOf(s.hexagram, s.line, s.startUtcMs, s.endUtcMs)),
    badges: [BADGE.experimental],
    note: TEXT.experimentalWindow,
  };
}
