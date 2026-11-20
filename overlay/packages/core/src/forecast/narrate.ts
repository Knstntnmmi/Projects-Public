// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The written forecast (specification, section 7), by calendar year. Every statement is said
 * once, in the year it begins; the year headline groups the level labels by word. Only three kinds of
 * sentence exist, all built from fixed templates: a signal's own sentence with its word,
 * a summary of how the speaking groups stand, and a statement that a tradition said
 * nothing. Every sentence that says something carries the ids of the signals behind it.
 */
import type { ForecastResult } from './evaluate.ts';
import { groupLabel } from './clocks.ts';
import { BADGE, signalLine, silenceSentence, summarySentence, TRADITION_NAME } from './phrasebook.ts';
import { statementList, type StatementEntry } from './statements.ts';
import type { ClockGroupId, Topic, Tradition } from './types.ts';
import { yearView } from './yearView.ts';

export type SentenceKind = 'signal' | 'summary' | 'silence';

export interface Sentence {
  kind: SentenceKind;
  text: string;
  /** The signals this sentence rests on. A silence sentence has none, because none fired. */
  signalIds: string[];
  /**
   * For silence only: names the reading (tradition, topic, year) that came up empty, so the
   * sentence is still traceable to something. A silence has no signal to cite.
   */
  readingKey?: string;
  /** For silence: how many bound rules were looked at, so the silence is not mistaken for no rules. */
  boundRules?: number;
  /** null = natal context, undated. */
  slice: number | null;
  tradition?: Tradition;
  children?: Sentence[];
}

/**
 * True when the sentence, or every child it is made of, rests on at least one signal; a
 * silence sentence has no signal to cite and is traceable through its readingKey instead.
 */
export function restsOnSignals(s: Sentence): boolean {
  if (s.kind === 'silence') return s.readingKey !== undefined;
  return s.signalIds.length > 0 || (s.children?.length ? s.children.every(restsOnSignals) : false);
}

function signalSentence(e: StatementEntry, topic: Topic, slice: number | null): Sentence {
  const line = signalLine(e.sentence, e.word, topic);
  const text = e.badges.includes(BADGE.experimental) ? `${line} [${BADGE.experimental}]` : line;
  return { kind: 'signal', text, signalIds: [e.signalId], slice, tradition: e.tradition };
}

export function narrate(result: ForecastResult, topic: Topic): Sentence[] {
  const out: Sentence[] = [];
  const list = statementList(result, topic);
  const view = yearView(result, topic);
  for (const e of list.natal) out.push(signalSentence(e, topic, null));
  for (const slice of result.slices) {
    // A statement is said once, in the year it begins (the first year, if it began before the span).
    const children = list.dated.filter((e) => e.startUtcMs! >= slice.startUtcMs && e.startUtcMs! < slice.endUtcMs).map((e) => signalSentence(e, topic, slice.index));
    out.push(...children);

    const cell = result.agreement.find((c) => c.topic === topic && c.slice === slice.index);
    const speaking = cell?.entries.filter((e) => e.word === 'supports' || e.word === 'cautions' || e.word === 'mixed') ?? [];
    if (cell && speaking.length > 0) {
      const words = new Set(speaking.map((e) => e.word));
      if (words.size === 1 && !words.has('mixed')) {
        const ids = result.readings
          .filter((r) => r.topic === topic && r.slice === slice.index && r.group !== null && speaking.some((e) => e.group === r.group && e.traditions.includes(r.tradition)))
          .flatMap((r) => r.signalIds);
        const names = (g: ClockGroupId): string => groupLabel(g);
        const silent = cell.silentTraditions.map((t) => TRADITION_NAME[t]);
        const text = summarySentence(slice.year, topic, [...words][0] as 'supports' | 'cautions', speaking.length, speaking.length, speaking.map((e) => names(e.group)), silent);
        out.push({ kind: 'summary', text, signalIds: [...new Set(ids)], slice: slice.index, children: children.filter((c) => ids.includes(c.signalIds[0]!)) });
      } else {
        // The groups do not stand together: say what each technique says instead.
        const year = view.years[slice.index]!;
        const ids = [...new Set(year.levels.flatMap((l) => l.entries.map((x) => x.signalId)))];
        out.push({ kind: 'summary', text: year.headline, signalIds: ids, slice: slice.index, children: children.filter((c) => ids.includes(c.signalIds[0]!)) });
      }
    }

    for (const tradition of result.traditions) {
      if (result.periodRead.includes(tradition)) continue;
      const reading = result.readings.find((r) => r.group === null && r.tradition === tradition && r.topic === topic && r.slice === slice.index);
      if (reading && reading.signalIds.length === 0 && reading.modifierIds.length === 0) {
        out.push({ kind: 'silence', text: silenceSentence(tradition, topic, slice.year), signalIds: [], readingKey: `reading:${tradition}:${topic}:${slice.year}`, boundRules: reading.boundRules, slice: slice.index, tradition });
      }
    }
  }
  return out;
}
