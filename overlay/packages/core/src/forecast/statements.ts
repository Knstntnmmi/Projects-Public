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
import { directionWord, foldedModifiersLine, LEVEL_LABEL, sentenceOf, TEXT, type DisplayWord } from './phrasebook.ts';
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
  /** What the chart itself says about its levels (for example that a balanced chart names no favourite), each text once, as the reader meets it. */
  chartNotes: string[];
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
    ruleId: s.ruleId,
    tradition: s.tradition,
    level: s.level,
    levelLabel: LEVEL_LABEL[s.level],
    word: directionWord(s.direction),
    sentence: s.sentence,
    badges: [...s.badges],
    ...clip(s),
    alsoReportedBy: alsoReportedBy[s.id]?.length ?? 0,
    qualifiers: [],
  });

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

  // A modifier is shown once, on the first statement of the list it qualifies, however many it overlaps.
  const placed = new Map<string, Qualifier>();
  for (const e of [...natal, ...dated]) {
    for (const id of kept.find((x) => x.id === e.signalId)!.modifiedBy) {
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
  return { topic, natalHeading: TEXT.natalPromiseHeading, natal, dated, unattached, chartNotes: [...new Set(result.chartNotes.map((n) => sentenceOf(n.text)))] };
}
