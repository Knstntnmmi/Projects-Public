// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The statement list: one entry per statement, never one per year. The undated statements of
 * the chart come first, under the heading the phrasebook gives; then every dated statement
 * once, with its own date span clipped to the requested span. A modifier is never an entry of
 * its own: it appears as a qualifier of the statement it attaches to, and modifiers that
 * attach to nothing are folded into one count per tradition. Statements of period-read
 * traditions are not part of it.
 */
import { directionWord, foldedModifiersLine, LEVEL_LABEL, TEXT, type DisplayWord } from './phrasebook.ts';
import { levelRank } from './levels.ts';
import { dedupe } from './readings.ts';
import type { ForecastResult } from './evaluate.ts';
import { TRADITIONS, type LevelId, type Signal, type Topic, type Tradition } from './types.ts';

/** A modifier statement attached to an entry, with its own sentence. */
export interface Qualifier {
  signalId: string;
  ruleId: string;
  sentence: string;
}

export interface StatementEntry {
  signalId: string;
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
  /** Modifiers that attach to no statement shown, one group per tradition. */
  unattached: FoldedModifiers[];
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** What the readable forms are made of: the de-duplicated statements of a topic, without period-read traditions. */
export function shownSignals(result: ForecastResult, topic: Topic): { kept: Signal[]; alsoReportedBy: Record<string, string[]>; keptOf: Map<string, string> } {
  const pool = result.signals.filter((s) => s.topic === topic && !result.periodRead.includes(s.tradition));
  const { kept, alsoReportedBy } = dedupe(pool);
  const keptOf = new Map<string, string>();
  for (const [id, others] of Object.entries(alsoReportedBy)) for (const o of others) keptOf.set(o, id);
  return { kept, alsoReportedBy, keptOf };
}

export function statementList(result: ForecastResult, topic: Topic): StatementList {
  const { kept, alsoReportedBy, keptOf } = shownSignals(result, topic);
  const byId = new Map(kept.map((s) => [s.id, s]));
  const { startUtcMs: spanStart, endUtcMs: spanEnd } = result.span;
  const used = new Set<string>();

  const entryOf = (s: Signal): StatementEntry => {
    const qualifiers: Qualifier[] = [];
    for (const id of s.modifiedBy) {
      const rep = byId.get(keptOf.get(id) ?? id);
      if (!rep || rep.stage !== 'modifier' || used.has(`${s.id}|${rep.id}`)) continue;
      used.add(`${s.id}|${rep.id}`);
      qualifiers.push({ signalId: rep.id, ruleId: rep.ruleId, sentence: rep.sentence });
    }
    const dated = s.startUtcMs !== null && s.endUtcMs !== null;
    return {
      signalId: s.id,
      ruleId: s.ruleId,
      tradition: s.tradition,
      level: s.level,
      levelLabel: LEVEL_LABEL[s.level],
      word: directionWord(s.direction),
      sentence: s.sentence,
      badges: [...s.badges],
      startUtcMs: dated ? Math.max(s.startUtcMs!, spanStart) : null,
      endUtcMs: dated ? Math.min(s.endUtcMs!, spanEnd) : null,
      beganBefore: dated && s.startUtcMs! < spanStart,
      endsAfter: dated && s.endUtcMs! > spanEnd,
      alsoReportedBy: alsoReportedBy[s.id]?.length ?? 0,
      qualifiers,
    };
  };

  const tradIndex = (t: Tradition): number => TRADITIONS.indexOf(t);
  const natal = kept
    .filter((s) => s.startUtcMs === null && s.stage !== 'modifier')
    .map(entryOf)
    .sort((a, b) => tradIndex(a.tradition) - tradIndex(b.tradition) || byText(a.ruleId, b.ruleId) || byText(a.signalId, b.signalId));
  const dated = kept
    .filter((s) => s.startUtcMs !== null && s.stage !== 'modifier')
    .map(entryOf)
    .sort(
      (a, b) =>
        a.startUtcMs! - b.startUtcMs! || tradIndex(a.tradition) - tradIndex(b.tradition) || levelRank(a.level) - levelRank(b.level) || byText(a.ruleId, b.ruleId) || byText(a.signalId, b.signalId),
    );

  const attached = new Set([...natal, ...dated].flatMap((e) => e.qualifiers.map((q) => q.signalId)));
  const unattached: FoldedModifiers[] = [];
  for (const tradition of TRADITIONS) {
    const orphans = kept.filter((s) => s.stage === 'modifier' && s.tradition === tradition && !attached.has(s.id));
    if (orphans.length > 0) unattached.push({ tradition, count: orphans.length, line: foldedModifiersLine(tradition, orphans.length), signalIds: orphans.map((s) => s.id) });
  }
  return { topic, natalHeading: TEXT.natalPromiseHeading, natal, dated, unattached };
}
