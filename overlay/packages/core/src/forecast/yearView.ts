// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The year view: for a topic and each year of the span, what every level says, with the plain
 * counts behind its word, the statements active in the year (by id, into the statement list),
 * the cross-group agreement cell, and one summary sentence built from the level words in a
 * fixed order. Period-read traditions appear once, as a fixed line.
 */
import type { AgreementCell } from './agreement.ts';
import type { ForecastResult } from './evaluate.ts';
import { levelRank } from './levels.ts';
import { LEVEL_LABEL, levelPhrase, periodReadLine, tallyText, yearSummaryLine } from './phrasebook.ts';
import { shownSignals } from './statements.ts';
import type { LevelId, ReadingWord, Tally, Topic, Tradition } from './types.ts';

export interface YearEntryRef {
  signalId: string;
  /** The statement begins in this year. */
  begins: boolean;
}

export interface YearLevelCell {
  level: LevelId;
  label: string;
  word: ReadingWord;
  note: string | null;
  tally: Tally;
  tallyText: string;
  entries: YearEntryRef[];
}

export interface YearViewYear {
  year: number;
  slice: number;
  levels: YearLevelCell[];
  /** Levels that have statements for the topic in the span but said nothing this year. */
  silent: LevelId[];
  agreement: AgreementCell | null;
  summary: string;
}

export interface YearView {
  topic: Topic;
  years: YearViewYear[];
  /** One fixed line per period-read tradition; their statements are not in any year. */
  periodRead: Array<{ tradition: Tradition; line: string }>;
}

const isSilent = (c: YearLevelCell): boolean => c.word === 'nothing-said' && c.tally.active === 0;

export function yearView(result: ForecastResult, topic: Topic): YearView {
  const { kept } = shownSignals(result, topic);
  const startOf = new Map(kept.map((s) => [s.id, s.startUtcMs]));
  const levels = [...new Set(result.levelReadings.filter((r) => r.topic === topic).map((r) => r.level))].sort((a, b) => levelRank(a) - levelRank(b));
  const years: YearViewYear[] = result.slices.map((slice) => {
    const cells: YearLevelCell[] = levels.map((level) => {
      const r = result.levelReadings.find((x) => x.topic === topic && x.level === level && x.slice === slice.index)!;
      return {
        level,
        label: LEVEL_LABEL[level],
        word: r.word,
        note: r.note,
        tally: r.tally,
        tallyText: tallyText(r.tally),
        entries: r.signalIds.map((id) => {
          const start = startOf.get(id) ?? null;
          return { signalId: id, begins: start !== null && start >= slice.startUtcMs && start < slice.endUtcMs };
        }),
      };
    });
    const speaking = cells.filter((c) => !isSilent(c));
    const silent = cells.filter(isSilent).map((c) => c.level);
    return {
      year: slice.year,
      slice: slice.index,
      levels: cells,
      silent,
      agreement: result.agreement.find((c) => c.topic === topic && c.slice === slice.index) ?? null,
      summary: yearSummaryLine(
        speaking.map((c) => levelPhrase(c.label, c.word, c.tally)),
        silent.map((l) => LEVEL_LABEL[l]),
      ),
    };
  });
  return { topic, years, periodRead: result.periodRead.map((tradition) => ({ tradition, line: periodReadLine(tradition) })) };
}
