// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Agreement and contradiction (specification, section 6). The unit of independence is the
 * clock group, never the tradition: luck pillars, profections and dashas are one group
 * because they are all arithmetic from one birth moment. Direction only; no composite,
 * no sum over traditions.
 */
import { groupBody } from './clocks.ts';
import { baselineLine, NOTE, TEXT, VERDICT_TEXT } from './phrasebook.ts';
import type { Baseline } from './baseline.ts';
import type { Reading } from './readings.ts';
import type { ClockGroupId, ReadingWord, Slice, Topic, Tradition } from './types.ts';

export type Verdict = 'agree-supports' | 'agree-cautions' | 'contradiction' | 'single' | 'silent' | 'no-agreement';

/**
 * The traditions whose readings count toward agreement. The I Ching is shown as the
 * character of a period and is experimental, so it never counts.
 */
export const AGREEMENT_BEARING: readonly Tradition[] = ['bazi', 'vedic', 'western'];

export interface GroupEntry {
  group: ClockGroupId;
  word: ReadingWord;
  /** Traditions in this group disagree with each other: "one group, two verdicts". */
  twoVerdicts: boolean;
  /** The traditions in this group that said something. */
  traditions: Tradition[];
}

export interface AgreementCell {
  topic: Topic;
  slice: number;
  groups: { supports: number; cautions: number; mixed: number; silent: number };
  entries: GroupEntry[];
  silentTraditions: Tradition[];
  verdict: Verdict;
  notes: string[];
}

/** Merges the words of the traditions inside one group. Disagreement inside a group is one verdict, "mixed", flagged. */
export function mergeWords(words: readonly ReadingWord[]): { word: ReadingWord; twoVerdicts: boolean } {
  const speaking = words.filter((w) => w !== 'nothing-said');
  if (speaking.length === 0) return { word: 'nothing-said', twoVerdicts: false };
  const distinct = new Set(speaking);
  if (distinct.size === 1) return { word: speaking[0]!, twoVerdicts: false };
  return { word: 'mixed', twoVerdicts: true };
}

/** The cross-group verdict for the words of the groups of one cell. */
export function verdictOf(groupWords: readonly ReadingWord[]): Verdict {
  const speaking = groupWords.filter((w) => w !== 'nothing-said');
  if (speaking.length === 0) return 'silent';
  if (speaking.length === 1) return 'single';
  const sup = speaking.includes('supports');
  const cau = speaking.includes('cautions');
  if (sup && cau) return 'contradiction';
  if (speaking.every((w) => w === 'supports')) return 'agree-supports';
  if (speaking.every((w) => w === 'cautions')) return 'agree-cautions';
  return 'no-agreement';
}

export const isAgree = (v: Verdict): boolean => v === 'agree-supports' || v === 'agree-cautions';

/** Every group's series for a topic: one merged word per slice. */
export function groupSeries(readings: readonly Reading[], topic: Topic, sliceCount: number, traditions: readonly Tradition[] = AGREEMENT_BEARING): Map<ClockGroupId, ReadingWord[]> {
  const out = new Map<ClockGroupId, ReadingWord[]>();
  const bearing = readings.filter((r) => r.topic === topic && r.group !== null && traditions.includes(r.tradition));
  const groups = [...new Set(bearing.map((r) => r.group!))];
  for (const g of groups) {
    const series: ReadingWord[] = [];
    for (let i = 0; i < sliceCount; i++) {
      series.push(mergeWords(bearing.filter((r) => r.group === g && r.slice === i).map((r) => r.word)).word);
    }
    out.set(g, series);
  }
  return out;
}

export function agreementCells(readings: readonly Reading[], slices: readonly Slice[], topics: readonly Topic[], traditions: readonly Tradition[] = AGREEMENT_BEARING): AgreementCell[] {
  const cells: AgreementCell[] = [];
  for (const topic of topics) {
    const bearing = readings.filter((r) => r.topic === topic && traditions.includes(r.tradition));
    const groups = [...new Set(bearing.filter((r) => r.group !== null).map((r) => r.group!))];
    const enabled = [...new Set(bearing.map((r) => r.tradition))];
    for (const slice of slices) {
      const entries: GroupEntry[] = groups.map((g) => {
        const mine = bearing.filter((r) => r.group === g && r.slice === slice.index);
        const merged = mergeWords(mine.map((r) => r.word));
        return { group: g, word: merged.word, twoVerdicts: merged.twoVerdicts, traditions: mine.filter((r) => r.word !== 'nothing-said').map((r) => r.tradition) };
      });
      const words = entries.map((e) => e.word);
      const notes: string[] = [];
      for (const e of entries) {
        if (e.twoVerdicts) notes.push(`${NOTE.oneGroupTwoVerdicts} (${e.group})`);
        else if (e.word !== 'nothing-said' && e.traditions.length > 1) notes.push(`${NOTE.twoTraditionsOneGroup} (${e.group})`);
      }
      const bodies = entries.filter((e) => e.word !== 'nothing-said').map((e) => groupBody(e.group)).filter((b): b is string => b !== null);
      if (new Set(bodies).size < bodies.length) notes.push(NOTE.onePlanetsMotion);
      cells.push({
        topic,
        slice: slice.index,
        groups: {
          supports: words.filter((w) => w === 'supports').length,
          cautions: words.filter((w) => w === 'cautions').length,
          mixed: words.filter((w) => w === 'mixed').length,
          silent: words.filter((w) => w === 'nothing-said').length,
        },
        entries,
        silentTraditions: enabled.filter((t) => bearing.filter((r) => r.group === null && r.tradition === t && r.slice === slice.index).every((r) => r.word === 'nothing-said')),
        verdict: verdictOf(words),
        notes,
      });
    }
  }
  return cells;
}

/**
 * The text that goes beside agreement cells. A cell with an agree verdict is never
 * rendered without the baseline line: asking for one without a baseline is an error.
 */
export function renderAgreement(cells: readonly AgreementCell[], baseline: Baseline | null, sliceCount: number): string[] {
  const lines: string[] = [];
  const anyAgree = cells.some((c) => isAgree(c.verdict));
  if (anyAgree && !baseline) throw new Error('an agree verdict cannot be shown without its baseline line');
  for (const c of cells) {
    lines.push(`${c.slice}: ${VERDICT_TEXT[c.verdict]} (supports ${c.groups.supports}, cautions ${c.groups.cautions}, mixed ${c.groups.mixed}, silent ${c.groups.silent})${c.notes.length ? `; ${c.notes.join('; ')}` : ''}`);
  }
  if (baseline) lines.push(baselineLine(baseline.found, baseline.expected, baseline.cellsLooked, sliceCount));
  lines.push(TEXT.agreementA, TEXT.agreementB, TEXT.agreementC);
  return lines;
}
