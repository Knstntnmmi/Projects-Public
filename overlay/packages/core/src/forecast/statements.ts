// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The statement list: one entry per statement, never one per year. The undated statements of
 * the chart come first, under the heading the phrasebook gives; then every dated statement
 * once, with its own date span clipped to the requested span (the true dates are kept beside
 * it). A modifier is never an entry of its own: it appears as a qualifier of the statement it
 * attaches to, and modifiers that attach to nothing are folded into one count per tradition.
 * A pointer (a statement that only marks the topic or names the sign a count reaches, without
 * a direction) is no entry of the list either: the pointers are kept apart, each listed once,
 * and the year view folds them into one group per level and year. When one rule says the same
 * sentence for periods that touch, the list shows one entry with the joined span and keeps the
 * ids of all the firings. Statements of period-read rules and traditions are not part of it.
 */
import { BADGE, directionWord, foldedModifiersLine, LEVEL_LABEL, sentenceOf, TEXT, type DisplayWord } from './phrasebook.ts';
import { DEFAULT_CONVENTIONS } from '../conventions.ts';
import { levelRank } from './levels.ts';
import { dedupe } from './readings.ts';
import type { ForecastResult } from './evaluate.ts';
import { TRADITIONS, type LevelId, type Signal, type Topic, type Tradition } from './types.ts';

/**
 * A modifier statement attached to an entry, with its own span. A modifier that lasts over many
 * statements (a star a luck pillar brings, over ten year pillars) is shown once, on the first
 * statement it qualifies, and says how many further statements it qualifies.
 */
export interface Qualifier {
  signalId: string;
  ruleId: string;
  sentence: string;
  level: LevelId;
  levelLabel: string;
  /** Clipped to the requested span. */
  startUtcMs: number;
  endUtcMs: number;
  beganBefore: boolean;
  endsAfter: boolean;
  /** How many further statements of the list it qualifies, which do not repeat it. */
  alsoQualifies: number;
}

export interface StatementEntry {
  /** The id of the first firing; the ids of every firing the entry stands for are in `signalIds`. */
  signalId: string;
  /** One id for a statement, several for a joined span of periods that touch and say the same. */
  signalIds: string[];
  ruleId: string;
  tradition: Tradition;
  level: LevelId;
  levelLabel: string;
  word: Exclude<DisplayWord, 'nothing-said'>;
  sentence: string;
  badges: string[];
  /** Null on both for an undated statement of the chart. Otherwise clipped to the requested span. */
  startUtcMs: number | null;
  endUtcMs: number | null;
  /** The true dates of the statement, not clipped; null for an undated statement. */
  fullStartUtcMs: number | null;
  fullEndUtcMs: number | null;
  /** The statement began before the requested span, or ends after it. */
  beganBefore: boolean;
  endsAfter: boolean;
  /** How many other rules reported the same fact. */
  alsoReportedBy: number;
  qualifiers: Qualifier[];
}

export interface FoldedModifiers {
  tradition: Tradition;
  count: number;
  line: string;
  signalIds: string[];
}

export interface StatementList {
  topic: Topic;
  natalHeading: string;
  natal: StatementEntry[];
  dated: StatementEntry[];
  /** The natal statements that are pointers, kept out of `natal`. */
  natalPointers: StatementEntry[];
  /** The dated statements that are pointers, kept out of `dated`, each listed once with its true dates. */
  pointers: StatementEntry[];
  /** Every firing id the list holds (also the ids joined into one entry) mapped to the `signalId` of the entry that stands for it. */
  entryOf: Record<string, string>;
  /** Modifiers that attach to no statement shown, one group per tradition. */
  unattached: FoldedModifiers[];
  /** What the chart itself says about its levels (for example that a balanced chart names no favourite), each text once, as the reader meets it. */
  chartNotes: string[];
  /**
   * A note without a direction, printed once under the last BaZi entry of `natal`, and only under the default
   * clock and day boundary that its text names. It is no signal and takes no part in any word, tally or cell.
   */
  sharedChartNote: { afterSignalId: string; text: string } | null;
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A pointer: a deciding statement whose rule gives no direction (it marks the topic or names where a count reaches). */
export const isPointer = (s: Pick<Signal, 'direction' | 'stage'>): boolean => s.stage !== 'modifier' && directionWord(s.direction) === 'active';

/** What the readable forms are made of: the de-duplicated statements of a topic, without period-read traditions. */
export function shownSignals(result: ForecastResult, topic: Topic): { kept: Signal[]; alsoReportedBy: Record<string, string[]>; keptOf: Map<string, string> } {
  const pool = result.signals.filter((s) => s.topic === topic && !result.periodRead.includes(s.tradition) && !result.periodReadRules.includes(s.ruleId));
  const { kept, alsoReportedBy } = dedupe(pool);
  const keptOf = new Map<string, string>();
  for (const [id, others] of Object.entries(alsoReportedBy)) for (const o of others) keptOf.set(o, id);
  return { kept, alsoReportedBy, keptOf };
}

/**
 * One entry for periods of one rule that touch and give the identical sentence at the same level
 * with the same word: the span is the joined span, and the entry keeps the ids of every firing.
 * Readings and tallies are made from the firings, not from the entries, and are not changed.
 */
export function joinSpans(sorted: readonly StatementEntry[]): StatementEntry[] {
  const TOUCH_MS = 1000;
  const groups = new Map<string, Array<{ e: StatementEntry; at: number }>>();
  sorted.forEach((e, at) => {
    const key = `${e.ruleId}|${e.level}|${e.word}|${e.sentence}`;
    groups.set(key, [...(groups.get(key) ?? []), { e, at }]);
  });
  const joined: Array<{ e: StatementEntry; at: number }> = [];
  for (const g of groups.values()) {
    // by true start, so that a span clipped to the request cannot reorder the firings
    g.sort((x, y) => (x.e.fullStartUtcMs ?? 0) - (y.e.fullStartUtcMs ?? 0) || x.at - y.at);
    let cur: { e: StatementEntry; at: number } | null = null;
    for (const item of g) {
      const e = item.e;
      if (cur && cur.e.fullEndUtcMs !== null && e.fullStartUtcMs !== null && e.fullStartUtcMs <= cur.e.fullEndUtcMs + TOUCH_MS) {
        cur.e.signalIds.push(...e.signalIds);
        cur.e.fullEndUtcMs = Math.max(cur.e.fullEndUtcMs, e.fullEndUtcMs!);
        cur.e.endUtcMs = Math.max(cur.e.endUtcMs!, e.endUtcMs!);
        cur.e.endsAfter = cur.e.endsAfter || e.endsAfter;
        cur.e.alsoReportedBy += e.alsoReportedBy;
        continue;
      }
      cur = { e: { ...e, signalIds: [...e.signalIds] }, at: item.at };
      joined.push(cur);
    }
  }
  return joined.sort((x, y) => x.at - y.at).map((x) => x.e);
}

export function statementList(result: ForecastResult, topic: Topic): StatementList {
  const { kept, alsoReportedBy, keptOf } = shownSignals(result, topic);
  const byId = new Map(kept.map((s) => [s.id, s]));
  const { startUtcMs: spanStart, endUtcMs: spanEnd } = result.span;

  const clip = (s: Signal): Pick<StatementEntry, 'startUtcMs' | 'endUtcMs' | 'beganBefore' | 'endsAfter'> => {
    const dated = s.startUtcMs !== null && s.endUtcMs !== null;
    return {
      startUtcMs: dated ? Math.max(s.startUtcMs!, spanStart) : null,
      endUtcMs: dated ? Math.min(s.endUtcMs!, spanEnd) : null,
      beganBefore: dated && s.startUtcMs! < spanStart,
      endsAfter: dated && s.endUtcMs! > spanEnd,
    };
  };

  const entryOf = (s: Signal): StatementEntry => ({
    signalId: s.id,
    signalIds: [s.id],
    ruleId: s.ruleId,
    tradition: s.tradition,
    level: s.level,
    levelLabel: LEVEL_LABEL[s.level],
    word: directionWord(s.direction),
    sentence: s.sentence,
    // "no promise rule applied" says nothing about a natal statement, which is itself the promise.
    badges: s.startUtcMs === null ? s.badges.filter((b) => b !== BADGE.ungated) : [...s.badges],
    ...clip(s),
    fullStartUtcMs: s.startUtcMs,
    fullEndUtcMs: s.endUtcMs,
    alsoReportedBy: alsoReportedBy[s.id]?.length ?? 0,
    qualifiers: [],
  });

  const tradIndex = (t: Tradition): number => TRADITIONS.indexOf(t);
  const entriesOf = (pick: (s: Signal) => boolean): StatementEntry[] => kept.filter((s) => s.stage !== 'modifier' && pick(s)).map(entryOf);
  const order = (a: StatementEntry, b: StatementEntry): number =>
    (a.startUtcMs ?? -Infinity) - (b.startUtcMs ?? -Infinity) || tradIndex(a.tradition) - tradIndex(b.tradition) || levelRank(a.level) - levelRank(b.level) || byText(a.ruleId, b.ruleId) || byText(a.signalId, b.signalId);
  const natalOrder = (a: StatementEntry, b: StatementEntry): number => tradIndex(a.tradition) - tradIndex(b.tradition) || byText(a.ruleId, b.ruleId) || byText(a.signalId, b.signalId);
  const natal = entriesOf((s) => s.startUtcMs === null && !isPointer(s)).sort(natalOrder);
  const natalPointers = entriesOf((s) => s.startUtcMs === null && isPointer(s)).sort(natalOrder);
  const dated = joinSpans(entriesOf((s) => s.startUtcMs !== null && !isPointer(s)).sort(order));
  const pointers = entriesOf((s) => s.startUtcMs !== null && isPointer(s)).sort(order);

  // A modifier is shown once, on the first statement of the list it qualifies, however many it overlaps.
  const placed = new Map<string, Qualifier>();
  for (const e of [...natal, ...dated]) {
    for (const id of e.signalIds.flatMap((sid) => kept.find((x) => x.id === sid)!.modifiedBy)) {
      const rep = byId.get(keptOf.get(id) ?? id);
      if (!rep || rep.stage !== 'modifier') continue;
      const first = placed.get(rep.id);
      if (first) {
        first.alsoQualifies++;
        continue;
      }
      const q: Qualifier = { signalId: rep.id, ruleId: rep.ruleId, sentence: rep.sentence, level: rep.level, levelLabel: LEVEL_LABEL[rep.level], ...(clip(rep) as Pick<Qualifier, 'startUtcMs' | 'endUtcMs' | 'beganBefore' | 'endsAfter'>), alsoQualifies: 0 };
      placed.set(rep.id, q);
      e.qualifiers.push(q);
    }
  }
  const attached = new Set(placed.keys());
  const unattached: FoldedModifiers[] = [];
  for (const tradition of TRADITIONS) {
    const orphans = kept.filter((s) => s.stage === 'modifier' && s.tradition === tradition && !attached.has(s.id));
    if (orphans.length > 0) unattached.push({ tradition, count: orphans.length, line: foldedModifiersLine(tradition, orphans.length), signalIds: orphans.map((s) => s.id) });
  }
  const entryOfSignal: Record<string, string> = {};
  for (const e of [...natal, ...natalPointers, ...dated, ...pointers]) for (const id of e.signalIds) entryOfSignal[id] = e.signalId;
  const { timeBasis, dayBoundary } = result.conventions.engine;
  const lastBazi = [...natal].reverse().find((e) => e.tradition === 'bazi');
  const sharedChartNote = lastBazi && timeBasis === DEFAULT_CONVENTIONS.timeBasis && dayBoundary === DEFAULT_CONVENTIONS.dayBoundary ? { afterSignalId: lastBazi.signalId, text: TEXT.baziSharedChartNote } : null;
  return { topic, natalHeading: TEXT.natalPromiseHeading, natal, dated, natalPointers, pointers, entryOf: entryOfSignal, unattached, chartNotes: [...new Set(result.chartNotes.map((n) => sentenceOf(n.text)))], sharedChartNote };
}
