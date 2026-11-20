// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The character of a short window, for the traditions that are read by period and not by year
 * (the I Ching). It is a calendar reading and does not depend on the nativity. Everything it
 * returns carries the badge "experimental". A window is at most 62 days: the line statements
 * are one a day, and a longer window would only be the wall the yearly forms were built to avoid.
 */
import { MS } from '../substrate/time.ts';
import { gradeStatement, gradeText, formulaDetail, type Grade } from '../systems/iching/grade.ts';
import { GUA_QI_CARDINAL_POSITION, SOVEREIGN_SEQUENCE } from '../systems/iching/wheels.ts';
import { hexagramByName, type Hexagram } from '../systems/iching/hexagrams.ts';
import { statementText } from '../systems/iching/zhouyiText.ts';
import { createContext, type ForecastContext, type ForecastInput } from './context.ts';
import { dedupe } from './readings.ts';
import { DEFAULT_REGISTRY, statusOf, type Registry } from './registry.ts';
import { runConfig } from './evaluate.ts';
import { signalsFromFirings } from './signals.ts';
import { BADGE, directionWord, TOPIC_LABEL, LEVEL_LABEL, TEXT, windowTooLongMessage, type DisplayWord } from './phrasebook.ts';
import { buildContext as buildIchingContext } from './predicates/iching.ts';
import { cuesOfStatement, directionOfGrade, topicsOfStatement, type CueRead } from './predicates/ichingCues.ts';
import type { LevelId, Signal, Span, Topic } from './types.ts';

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
  /** The word the verdict words of the whole statement give: supports, cautions, mixed, or 'no verdict word'. A modern construction on the text. */
  reading: string;
  /** What the cue rules say of this statement, topic by topic, each with the sign of its own clause (a statement can be named for wealth and yet read as a whole in the other direction). */
  cues: CueRead[];
  /** The negated verdict formulas of the statement, each with its gloss and what it says (a note without a direction, or unfavourable, or favourable); null when none. */
  formulas: string | null;
  badges: string[];
  startUtcMs: number;
  endUtcMs: number;
}

/** The I Ching's part of a window: what the calendar says, which does not depend on the nativity. */
export interface IchingPart {
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

/** One day statement of a rule that is read by period, with the rule behind it. */
export interface WindowStatement {
  signalId: string;
  ruleId: string;
  level: LevelId;
  levelLabel: string;
  /** The rule's own direction in a word; the Western day transits are stated as mixed by their rule. */
  word: Exclude<DisplayWord, 'nothing-said'>;
  sentence: string;
  /** The day the statement is about: the day of the closest pass. */
  dayUtcMs: number;
  /** The span of the statement as its rule dates it, not clipped to the window. */
  startUtcMs: number;
  endUtcMs: number;
  badges: string[];
  source: { citation: string; locator: string };
}

/**
 * The Western part of a window: the day statements of the rules of Lilly that are read by
 * period (the passes of the planets over the angles and the radical places). They depend on
 * the nativity and on the birth time, and carry no badge "experimental": they are rules of the
 * tradition as printed, with derived thresholds named in the badges of each statement.
 */
export interface WesternPart {
  statements: WindowStatement[];
  badges: string[];
  note: string;
  /** Why the part is empty although it was asked for (no birth time, or too uncertain), or null. */
  unavailable: string | null;
}

export interface PeriodCharacter {
  window: Span;
  iching: IchingPart;
  western: WesternPart;
}

const FOUR_CARDINAL = ['坎', '震', '離', '兌'].map((n) => hexagramByName(n).number);

/**
 * What to print beside a statement, in plain words and without a number: how its verdict words read
 * as a whole, then each topic the text names it for with the sign of that clause, then any negated verdict formula.
 */
export function ichingNotes(s: IchingStatement): string[] {
  const out = [`as a whole it reads: ${s.reading}`];
  for (const c of s.cues) out.push(`named for ${TOPIC_LABEL[c.topic]} by the words ${c.clause}: ${directionWord(c.direction) === 'active' ? 'no direction given' : directionWord(c.direction)}${c.note ? ` (${c.note})` : ''}`);
  if (s.formulas) out.push(s.formulas);
  return out;
}

function readingOf(g: Grade): string {
  const d = directionOfGrade(g);
  return d === 'activates' ? 'no verdict word' : directionWord(d);
}

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
    reading: readingOf(g),
    cues: cuesOfStatement(`${h.number}.${line}`),
    formulas: formulaDetail(g),
    badges: [BADGE.experimental],
    startUtcMs,
    endUtcMs,
  };
}

/**
 * The character of a window of at most 62 days, each tradition in its own part: the I Ching's
 * hexagram periods, sovereign hexagram, cardinal markers and line of each day, and the Western
 * day statements of the rules that are read by period (the passes over the angles and radical
 * places, from the nativity). A longer window is refused. A rule of the Western part is run
 * only here and never when a long span is evaluated.
 */
export function periodCharacter(input: ForecastInput, range: Span, options: { registry?: Registry } = {}): PeriodCharacter {
  const days = (range.endUtcMs - range.startUtcMs) / MS.DAY;
  if (!Number.isFinite(days) || days <= 0) throw new RangeError('The window must end after it starts.');
  if (days > MAX_WINDOW_DAYS) throw new RangeError(windowTooLongMessage(days, MAX_WINDOW_DAYS));
  const registry = options.registry ?? DEFAULT_REGISTRY;
  const ctx = createContext({ ...input, span: range }, registry.builders);
  const ich = buildIchingContext(ctx);
  return {
    window: range,
    iching: {
      periods: ich.periods.map((p) => statementOf(p.hexagram, 0, p.startUtcMs, p.endUtcMs)),
      sovereign: ctx.sovereign().map((s) => ({ ...statementOf(s.hexagram, 0, s.startUtcMs, s.endUtcMs), growing: SOVEREIGN_SEQUENCE.findIndex((h) => h.number === s.hexagram.number) < 6 })),
      cardinal: ich.periods.filter((p) => p.position >= GUA_QI_CARDINAL_POSITION && FOUR_CARDINAL.includes(p.hexagram.number)).map((p) => statementOf(p.hexagram, 0, p.startUtcMs, p.endUtcMs)),
      days: ich.slices.map((s) => statementOf(s.hexagram, s.line, s.startUtcMs, s.endUtcMs)),
      badges: [BADGE.experimental],
      note: TEXT.experimentalWindow,
    },
    western: westernPart(input, range, ctx, registry),
  };
}

const dayOf = (s: Signal): number => {
  const d = s.facts.find((f) => f.key === 'date');
  const t = d === undefined ? Number.NaN : Date.parse(String(d.value));
  return Number.isFinite(t) ? t : s.startUtcMs!;
};

/** The day statements of every rule of a tradition read by year that is flagged as read by period, for the days of the window. */
function westernPart(input: ForecastInput, range: Span, ctx: ForecastContext, registry: Registry): WesternPart {
  const base = { badges: [] as string[], note: TEXT.westernWindow };
  const config = runConfig(input, ['western']);
  const rules = registry.rules.filter((r) => r.tradition === 'western' && registry.periodReadRules.has(r.id) && (r.sourceOpened || input.forecastConventions.showUnopened));
  const statuses = rules.map((r) => statusOf(registry, r, config));
  const blocked = statuses.find((s) => s.state === 'withheld');
  const signals: Signal[] = [];
  for (const rule of rules.filter((r, i) => statuses[i]!.state === 'bound')) {
    const firings = registry.bindings.get(rule.id)!.fire(ctx, rule);
    signals.push(...signalsFromFirings(rule, firings, { forecastConventions: input.forecastConventions, span: range }));
  }
  const { kept } = dedupe(signals);
  const statements: WindowStatement[] = kept
    .filter((s) => s.startUtcMs !== null)
    // The sentence is about a day, the day of the closest pass; the span of the rule is the orb the pass lasts, which can begin before the window.
    .filter((s) => dayOf(s) + MS.DAY > range.startUtcMs && dayOf(s) < range.endUtcMs)
    .map((s) => ({
      signalId: s.id,
      ruleId: s.ruleId,
      level: s.level,
      levelLabel: LEVEL_LABEL[s.level],
      word: directionWord(s.direction),
      sentence: s.sentence,
      dayUtcMs: dayOf(s),
      startUtcMs: s.startUtcMs!,
      endUtcMs: s.endUtcMs!,
      badges: [...s.badges],
      source: { citation: s.source.citation, locator: s.source.locator },
    }))
    .sort((a, b) => a.dayUtcMs - b.dayUtcMs || (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0) || (a.signalId < b.signalId ? -1 : 1));
  const unavailable = blocked && blocked.state === 'withheld' && statements.length === 0 ? blocked.detail : null;
  return { ...base, statements, unavailable };
}
