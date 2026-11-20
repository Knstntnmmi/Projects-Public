// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The year view: for a topic and each year of the span, what every level says, with the plain
 * counts behind its word, the statements active in the year (by id, into the statement list),
 * the pointers of each level folded into one group, the cross-group agreement cell, and one
 * headline that groups the level labels by word. It is the decade grid read by column, so the
 * two cannot disagree. Period-read traditions appear once, as a fixed line.
 */
import type { AgreementCell } from './agreement.ts';
import type { ForecastResult } from './evaluate.ts';
import { decadeGrid, headlineOf, type GridCell, type PointerGroup } from './grid.ts';
import type { LevelId, Topic, Tradition } from './types.ts';

export interface YearEntryRef {
  signalId: string;
  /** The statement begins in this year. */
  begins: boolean;
}

export interface YearLevelCell extends GridCell {
  level: LevelId;
  label: string;
  /** What the chart itself says about this level (a balanced chart names no favourite), or null. */
  chartNote: string | null;
  /** The deciding statements of the level in the year, not the pointers. */
  entries: YearEntryRef[];
  pointers: PointerGroup | null;
}

export interface YearViewYear {
  year: number;
  slice: number;
  levels: YearLevelCell[];
  /** Levels that said nothing this year (also those that only have pointers), with the stated reason in their cell. */
  silent: LevelId[];
  agreement: AgreementCell | null;
  /** The levels grouped by word: "Supports: A, B. Cautions: C. Mixed: D (3 rules support, 1 cautions). Silent: E." */
  headline: string;
}

export interface YearView {
  topic: Topic;
  years: YearViewYear[];
  /** One fixed line per period-read tradition; their statements are not in any year. */
  periodRead: Array<{ tradition: Tradition; line: string }>;
}

export function yearView(result: ForecastResult, topic: Topic): YearView {
  const grid = decadeGrid(result, topic);
  const startOf = new Map(result.signals.map((s) => [s.id, s.startUtcMs]));
  const years: YearViewYear[] = result.slices.map((slice, i) => {
    const cells: YearLevelCell[] = grid.rows.map((row) => {
      const c = row.cells[i]!;
      return {
        ...c,
        level: row.level,
        label: row.label,
        chartNote: row.note,
        entries: c.signalIds.map((id) => {
          const start = startOf.get(id) ?? null;
          return { signalId: id, begins: start !== null && start >= slice.startUtcMs && start < slice.endUtcMs };
        }),
      };
    });
    return {
      year: slice.year,
      slice: slice.index,
      levels: cells,
      silent: cells.filter((c) => c.word === 'nothing-said').map((c) => c.level),
      agreement: result.agreement.find((c) => c.topic === topic && c.slice === slice.index) ?? null,
      headline: headlineOf(cells),
    };
  });
  return { topic, years, periodRead: grid.periodRead };
}
