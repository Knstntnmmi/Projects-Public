// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The decade grid: for a topic, one row per level (technique) in a fixed order, grouped by
 * tradition, and one column per year of the span. A cell holds the word, the plain counts, the
 * shares of supporting, cautioning and mixed statements for drawing a split cell (drawing only:
 * nothing is decided from them), the ids of the statements behind it, the pointers folded into
 * one group, and a note where the level is silent for a stated reason. Every level that has a
 * bound rule for the topic has a row, also when it never fires in the span: the bindings declare
 * their levels, so the row does not depend on what fired. The year headline is made here, from
 * the same cells, so that the grid and the year view cannot disagree.
 */
import type { ForecastResult } from './evaluate.ts';
import { levelRank, levelTradition } from './levels.ts';
import { LEVEL_LABEL, NOTE, periodReadLine, pointerLabel, TRADITION_NAME, WORD, mixedLevelPhrase, tallyText, yearHeadline } from './phrasebook.ts';
import type { WithheldReason } from './registry.ts';
import { isPointer, statementList, type StatementEntry } from './statements.ts';
import { TRADITIONS, type LevelId, type ReadingWord, type Tally, type Topic, type Tradition } from './types.ts';

/** The pointers of one level in one year, folded into one group. */
export interface PointerGroup {
  count: number;
  /** From the phrasebook: how many, and what a pointer is. */
  label: string;
  signalIds: string[];
  /** The detail of the group: the statements, each with its true dates. */
  entries: StatementEntry[];
}

/** The shares of the deciding statements of a cell, 0 to 1 each, summing to 1 (all 0 for a cell with none). For drawing a split cell only. */
export interface Shares {
  supports: number;
  cautions: number;
  mixed: number;
}

export interface GridCell {
  year: number;
  slice: number;
  word: ReadingWord;
  /** The word as the phrasebook says it ("nothing said"), for any text that shows it. */
  wordText: string;
  /** What qualifies the word: "rules conflict", "topic active". */
  note: string | null;
  /** The reason the level is silent, where it is (a balanced chart, a convention that is needed); null where it speaks or has no stated reason. */
  silentReason: string | null;
  tally: Tally;
  /** The counts in words, without pointers. */
  tallyText: string;
  shares: Shares;
  /** The statements behind the word, as the ids of the entries of the statement list (a joined span is one entry). */
  entryIds: string[];
  /** The ids of every firing behind the word. */
  signalIds: string[];
  pointers: PointerGroup | null;
}

export interface GridRow {
  level: LevelId;
  label: string;
  tradition: Tradition;
  /** What the chart or the run says about the level for every year (a balanced chart; a needed convention), or null. */
  note: string | null;
  cells: GridCell[];
}

export interface GridGroup {
  tradition: Tradition;
  name: string;
  rows: GridRow[];
}

export interface DecadeGrid {
  topic: Topic;
  years: number[];
  /** The rows grouped by tradition, in the fixed order of the traditions. */
  groups: GridGroup[];
  /** The same rows, flat, in the fixed order of the levels. */
  rows: GridRow[];
  /** One headline per year, in the order of `years`. */
  headlines: string[];
  /** One fixed line per tradition that is read by period; its statements are in no cell. */
  periodRead: Array<{ tradition: Tradition; line: string }>;
}

const WITHHELD_TEXT: Readonly<Record<WithheldReason, string>> = {
  'needs-sex-convention': NOTE.needsSexConvention,
  'birth-time-uncertain': NOTE.needsBirthTime,
  'tradition-off': '',
  'not-computable': '',
};

export const sharesOf = (t: Tally): Shares => {
  const n = t.supports + t.cautions + t.mixed;
  return n === 0 ? { supports: 0, cautions: 0, mixed: 0 } : { supports: t.supports / n, cautions: t.cautions / n, mixed: t.mixed / n };
};

/** The headline of one year from its cells, in the fixed form of the phrasebook. */
export function headlineOf(cells: ReadonlyArray<Pick<GridCell, 'word' | 'tally'> & { label: string }>): string {
  const names = (w: ReadingWord): string[] => cells.filter((c) => c.word === w).map((c) => c.label);
  return yearHeadline({
    supports: names('supports'),
    cautions: names('cautions'),
    mixed: cells.filter((c) => c.word === 'mixed').map((c) => mixedLevelPhrase(c.label, c.tally)),
    silent: names('nothing-said'),
  });
}

export function decadeGrid(result: ForecastResult, topic: Topic): DecadeGrid {
  const list = statementList(result, topic);
  const bySignal = new Map(result.signals.map((s) => [s.id, s]));
  const pointerById = new Map(list.pointers.flatMap((e) => e.signalIds.map((id) => [id, e] as const)));
  const levels = [...new Set(result.levelReadings.filter((r) => r.topic === topic).map((r) => r.level))].sort((a, b) => levelRank(a) - levelRank(b));
  const years = result.slices.map((s) => s.year);

  const rows: GridRow[] = levels.map((level) => {
    const cover = result.levelCoverage.find((c) => c.level === level && c.topic === topic);
    const noted = result.levelReadings.find((r) => r.topic === topic && r.level === level)!.chartNote;
    const withheld = cover && cover.bound === 0 ? [...new Set(cover.withheld.map((w) => WITHHELD_TEXT[w]).filter((t) => t !== ''))].join('; ') : '';
    const rowNote = noted ?? (withheld === '' ? null : withheld);
    const cells: GridCell[] = result.slices.map((slice) => {
      const r = result.levelReadings.find((x) => x.topic === topic && x.level === level && x.slice === slice.index)!;
      const pointerIds = r.signalIds.filter((id) => {
        const s = bySignal.get(id);
        return s !== undefined && isPointer(s);
      });
      const decidingIds = r.signalIds.filter((id) => !pointerIds.includes(id));
      const pointerEntries = [...new Map(pointerIds.map((id) => [pointerById.get(id)?.signalId ?? id, pointerById.get(id)] as const)).values()].filter((e): e is StatementEntry => e !== undefined);
      return {
        year: slice.year,
        slice: slice.index,
        word: r.word,
        wordText: WORD[r.word],
        note: r.note,
        silentReason: r.word === 'nothing-said' ? rowNote : null,
        tally: r.tally,
        tallyText: tallyText(r.tally),
        shares: sharesOf(r.tally),
        entryIds: [...new Set(decidingIds.map((id) => list.entryOf[id] ?? id))],
        signalIds: decidingIds,
        pointers: pointerIds.length === 0 ? null : { count: pointerIds.length, label: pointerLabel(pointerIds.length), signalIds: pointerIds, entries: pointerEntries },
      };
    });
    return { level, label: LEVEL_LABEL[level], tradition: levelTradition(level)!, note: rowNote, cells };
  });

  const groups: GridGroup[] = TRADITIONS.filter((t) => rows.some((r) => r.tradition === t)).map((tradition) => ({ tradition, name: TRADITION_NAME[tradition], rows: rows.filter((r) => r.tradition === tradition) }));
  const headlines = years.map((_y, i) => headlineOf(rows.map((r) => ({ label: r.label, word: r.cells[i]!.word, tally: r.cells[i]!.tally }))));
  return { topic, years, groups, rows, headlines, periodRead: result.periodRead.map((tradition) => ({ tradition, line: periodReadLine(tradition) })) };
}

/** The glyph of a word in a text table: + supports, - cautions, ~ mixed, . nothing said. */
export const GRID_GLYPH: Readonly<Record<ReadingWord, string>> = { supports: '+', cautions: '-', mixed: '~', 'nothing-said': '.' };

/** The grid as a text table: a row per level, a column per year, the glyph of the word in each cell, and the fixed period-read lines under it. */
export function gridText(grid: DecadeGrid): string[] {
  const width = Math.max(...grid.rows.map((r) => r.label.length), 0);
  const out = [`${''.padEnd(width)}  ${grid.years.join(' ')}`];
  for (const g of grid.groups) {
    out.push(g.name);
    for (const r of g.rows) out.push(`${r.label.padEnd(width)}  ${r.cells.map((c) => GRID_GLYPH[c.word].padStart(4)).join(' ')}${r.note ? `  (${r.note})` : ''}`);
  }
  for (const p of grid.periodRead) out.push(p.line);
  return out;
}
