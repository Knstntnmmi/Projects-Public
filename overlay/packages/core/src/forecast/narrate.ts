// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The written forecast (specification, section 7), by calendar year. Only three kinds of
 * sentence exist, all built from fixed templates: a signal's own sentence with its word,
 * a summary of how the speaking groups stand, and a statement that a tradition said
 * nothing. Every sentence that says something carries the ids of the signals behind it.
 */
import type { ForecastResult } from './evaluate.ts';
import { groupLabel } from './clocks.ts';
import { BADGE, directionWord, groupSplitSentence, signalLine, silenceSentence, summarySentence, TRADITION_NAME } from './phrasebook.ts';
import { dedupe } from './readings.ts';
import { overlaps } from './signals.ts';
import type { ClockGroupId, Signal, Topic, Tradition } from './types.ts';

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

function signalSentence(s: Signal, slice: number | null): Sentence {
  const word = directionWord(s.direction);
  const text = s.badges.includes(BADGE.experimental) ? `${signalLine(s.sentence, word, s.topic)} [${BADGE.experimental}]` : signalLine(s.sentence, word, s.topic);
  return { kind: 'signal', text, signalIds: [s.id], slice, tradition: s.tradition };
}

export function narrate(result: ForecastResult, topic: Topic): Sentence[] {
  const out: Sentence[] = [];
  const { kept } = dedupe(result.signals.filter((s) => s.topic === topic));
  for (const s of kept.filter((x) => x.startUtcMs === null)) out.push(signalSentence(s, null));
  for (const slice of result.slices) {
    const inSlice = kept.filter((s) => overlaps(s, slice.startUtcMs, slice.endUtcMs));
    const children = inSlice.map((s) => signalSentence(s, slice.index));
    out.push(...children);

    const cell = result.agreement.find((c) => c.topic === topic && c.slice === slice.index);
    const speaking = cell?.entries.filter((e) => e.word === 'supports' || e.word === 'cautions' || e.word === 'mixed') ?? [];
    if (cell && speaking.length > 0) {
      const ids = result.readings
        .filter((r) => r.topic === topic && r.slice === slice.index && r.group !== null && speaking.some((e) => e.group === r.group && e.traditions.includes(r.tradition)))
        .flatMap((r) => r.signalIds);
      const names = (g: ClockGroupId): string => groupLabel(g);
      const words = new Set(speaking.map((e) => e.word));
      const silent = cell.silentTraditions.map((t) => TRADITION_NAME[t]);
      const text =
        words.size === 1 && !words.has('mixed')
          ? summarySentence(slice.year, topic, [...words][0] as 'supports' | 'cautions', speaking.length, speaking.length, speaking.map((e) => names(e.group)), silent)
          : groupSplitSentence(slice.year, topic, speaking.map((e) => ({ name: names(e.group), word: e.word })));
      out.push({ kind: 'summary', text, signalIds: [...new Set(ids)], slice: slice.index, children: children.filter((c) => ids.includes(c.signalIds[0]!)) });
    }

    for (const tradition of result.traditions) {
      const reading = result.readings.find((r) => r.group === null && r.tradition === tradition && r.topic === topic && r.slice === slice.index);
      if (reading && reading.signalIds.length === 0 && reading.modifierIds.length === 0) {
        out.push({ kind: 'silence', text: silenceSentence(tradition, topic, slice.year), signalIds: [], readingKey: `reading:${tradition}:${topic}:${slice.year}`, boundRules: reading.boundRules, slice: slice.index, tradition });
      }
    }
  }
  return out;
}
