// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The decade grid as a drawing: a row per level, grouped by tradition, a column per year. A cell
 * is filled for "supports" or "cautions", split by the shares of its rules for "mixed", and empty
 * where nothing is said. No number is drawn in a cell, and nothing here decides anything: the word
 * of every cell was fixed by the grid of the core, and the shares only size the split.
 */
import { CREDIT, forecast } from '@overlay/core';
import { esc, n, styleBlock, textWidth, wrapText } from './svg.ts';

/** The one sentence that stands wherever a forecast is shown. */
export const FORECAST_SENTENCE =
  'Each line is what a named rule of one tradition says about this period, with its source. Nobody has tested these statements against outcomes yet.';

/** What a split cell means, for the legend. */
export const SPLIT_NOTE = 'A mixed cell is split by the share of its rules that support, caution or are stated as mixed.';

export interface DecadeGridOptions {
  /** Drawing width in pixels; 360 gives the compact layout, 1200 a wide one. Default 720. */
  width?: number;
  title?: string;
  /** Replaces the caption; the default is the one sentence. */
  caption?: string;
  theme?: 'light' | 'dark';
}

const GLYPH: Readonly<Record<forecast.ReadingWord, string>> = { supports: '+', cautions: '-', mixed: '~', 'nothing-said': '' };

const FILL_CLASS: Readonly<Record<'supports' | 'cautions' | 'mixed', string>> = { supports: 't-supports', cautions: 't-cautions', mixed: 't-mixed' };

interface Layout {
  width: number;
  margin: number;
  gutter: number;
  cellW: number;
  fontLabel: number;
  fontSmall: number;
  rotateYears: boolean;
}

function layoutFor(width: number, years: number): Layout {
  const compact = width < 520;
  const margin = compact ? 12 : 24;
  const gutter = compact ? 118 : Math.min(230, Math.round(width * 0.27));
  const cellW = (width - margin * 2 - gutter) / Math.max(1, years);
  return { width, margin, gutter, cellW, fontLabel: compact ? 11 : 13, fontSmall: compact ? 10 : 11, rotateYears: cellW < 34 };
}

export function renderDecadeGrid(grid: forecast.DecadeGrid, options: DecadeGridOptions = {}): string {
  const width = Math.max(320, Math.round(options.width ?? 720));
  const L = layoutFor(width, grid.years.length);
  const x0 = L.margin + L.gutter;
  const plotW = L.cellW * grid.years.length;
  const title = options.title ?? `${forecast.TOPIC_LABEL[grid.topic].replace(/^./, (c) => c.toUpperCase())}, ${grid.years[0]} to ${grid.years[grid.years.length - 1]}: what each rule set says, year by year`;
  const caption = options.caption ?? FORECAST_SENTENCE;
  const body: string[] = [];
  let y = 14;

  // Title.
  const titleSize = width < 520 ? 14 : 18;
  for (const line of wrapText(title, width - L.margin * 2, titleSize)) {
    y += titleSize + 3;
    body.push(`<text x="${L.margin}" y="${n(y)}" font-size="${titleSize}">${esc(line)}</text>`);
  }
  y += 12;

  // Year header.
  const headH = L.rotateYears ? 34 : 20;
  grid.years.forEach((yr, i) => {
    const cx = x0 + (i + 0.5) * L.cellW;
    body.push(
      L.rotateYears
        ? `<text class="muted" transform="translate(${n(cx + 3)} ${n(y + headH - 4)}) rotate(-90)" font-size="${L.fontSmall}">${yr}</text>`
        : `<text class="muted" x="${n(cx)}" y="${n(y + headH - 6)}" font-size="${L.fontSmall + 1}" text-anchor="middle">${yr}</text>`,
    );
  });
  y += headH;
  body.push(`<line class="rule" x1="${L.margin}" y1="${n(y)}" x2="${n(x0 + plotW)}" y2="${n(y)}"/>`);

  // Rows, grouped by tradition.
  const LINE = L.fontLabel + 2;
  for (const g of grid.groups) {
    y += 8 + L.fontLabel;
    body.push(`<text x="${L.margin}" y="${n(y)}" font-size="${L.fontLabel}" font-weight="bold" data-tradition="${esc(g.tradition)}">${esc(g.name)}</text>`);
    y += 4;
    for (const row of g.rows) {
      const silentAll = row.cells.every((c) => c.word === 'nothing-said');
      const labelLines = wrapText(row.label, L.gutter - 14, L.fontLabel);
      // A note about the whole row goes inside it where every cell is silent, and under the label where some cell speaks.
      const noteInside = silentAll && row.note ? wrapText(row.note, plotW - 12, L.fontSmall) : [];
      const noteUnder = !silentAll && row.note ? wrapText(row.note, L.gutter - 14, L.fontSmall) : [];
      const labelH = labelLines.length * LINE + noteUnder.length * (L.fontSmall + 2);
      const rowH = Math.max(26, labelH + 8, noteInside.length * (L.fontSmall + 3) + 8);
      const top = y;
      body.push(`<g data-level="${esc(row.level)}">`);
      let ty = top + (rowH - labelH) / 2 + L.fontLabel - 1;
      for (const line of labelLines) {
        body.push(`<text x="${L.margin + 10}" y="${n(ty)}" font-size="${L.fontLabel}">${esc(line)}</text>`);
        ty += LINE;
      }
      ty -= LINE - (L.fontSmall + 2);
      for (const line of noteUnder) {
        body.push(`<text class="muted" x="${L.margin + 10}" y="${n(ty)}" font-size="${L.fontSmall}">${esc(line)}</text>`);
        ty += L.fontSmall + 2;
      }
      row.cells.forEach((cell, i) => {
        const cx = x0 + i * L.cellW;
        const rx = cx + 1;
        const ry = top + 2;
        const rw = L.cellW - 2;
        const rh = rowH - 4;
        const tip = `${cell.year}, ${row.label}: ${cell.wordText}${cell.note ? ` (${cell.note})` : ''}`;
        const attrs = `data-year="${cell.year}" data-word="${cell.word}"`;
        if (cell.word === 'nothing-said') {
          body.push(`<g ${attrs}><rect class="rule" x="${n(rx)}" y="${n(ry)}" width="${n(rw)}" height="${n(rh)}" stroke-opacity=".6"/><title>${esc(tip)}</title></g>`);
          return;
        }
        const parts: string[] = [];
        if (cell.word === 'mixed') {
          const s = cell.shares;
          const segs = [
            { w: s.supports, c: FILL_CLASS.supports },
            { w: s.mixed, c: FILL_CLASS.mixed },
            { w: s.cautions, c: FILL_CLASS.cautions },
          ].filter((p) => p.w > 0);
          if (segs.length === 0) segs.push({ w: 1, c: FILL_CLASS.mixed });
          let sx = rx;
          for (const seg of segs) {
            parts.push(`<rect class="${seg.c}" x="${n(sx)}" y="${n(ry)}" width="${n(rw * seg.w)}" height="${n(rh)}"/>`);
            sx += rw * seg.w;
          }
        } else parts.push(`<rect class="${FILL_CLASS[cell.word]}" x="${n(rx)}" y="${n(ry)}" width="${n(rw)}" height="${n(rh)}"/>`);
        parts.push(`<rect class="rule" x="${n(rx)}" y="${n(ry)}" width="${n(rw)}" height="${n(rh)}"/>`);
        // A sign beside the colour, so that the word does not rest on colour alone.
        if (rw >= 16) parts.push(`<text x="${n(rx + rw / 2)}" y="${n(ry + rh / 2)}" font-size="${L.fontSmall + 2}" text-anchor="middle" dominant-baseline="central" pointer-events="none">${GLYPH[cell.word]}</text>`);
        body.push(`<g ${attrs}>${parts.join('')}<title>${esc(tip)}</title></g>`);
      });
      if (noteInside.length > 0) {
        const block = noteInside.length * (L.fontSmall + 3);
        noteInside.forEach((line, k) => {
          body.push(`<text class="muted halo" x="${n(x0 + plotW / 2)}" y="${n(top + (rowH - block) / 2 + (k + 1) * (L.fontSmall + 3) - 3)}" font-size="${L.fontSmall}" text-anchor="middle" font-style="italic">${esc(line)}</text>`);
        });
      }
      body.push('</g>');
      y += rowH;
    }
  }
  y += 6;
  body.push(`<line class="rule" x1="${L.margin}" y1="${n(y)}" x2="${n(x0 + plotW)}" y2="${n(y)}"/>`);

  // Traditions that are read by period have no cell: one fixed line each.
  y += 6;
  for (const p of grid.periodRead) {
    for (const line of wrapText(p.line, width - L.margin * 2, L.fontSmall + 1)) {
      y += L.fontSmall + 4;
      body.push(`<text class="muted" x="${L.margin}" y="${n(y)}" font-size="${L.fontSmall + 1}" data-period-read="${esc(p.tradition)}">${esc(line)}</text>`);
    }
  }

  // Legend: the four words, in flow.
  y += 14;
  const items: Array<{ word: forecast.ReadingWord; text: string }> = (['supports', 'cautions', 'mixed', 'nothing-said'] as const).map((w) => ({ word: w, text: forecast.WORD[w] }));
  let lx = L.margin;
  let rowTop = y;
  const SW = 14;
  for (const it of items) {
    const w = SW + 6 + textWidth(it.text, L.fontSmall + 1) + 16;
    if (lx + w > width - L.margin && lx > L.margin) {
      lx = L.margin;
      rowTop += SW + 8;
    }
    if (it.word === 'nothing-said') body.push(`<rect class="rule" x="${n(lx)}" y="${n(rowTop)}" width="${SW}" height="${SW}"/>`);
    else if (it.word === 'mixed') {
      const third = SW / 3;
      body.push(`<rect class="t-supports" x="${n(lx)}" y="${n(rowTop)}" width="${n(third)}" height="${SW}"/><rect class="t-mixed" x="${n(lx + third)}" y="${n(rowTop)}" width="${n(third)}" height="${SW}"/><rect class="t-cautions" x="${n(lx + 2 * third)}" y="${n(rowTop)}" width="${n(third)}" height="${SW}"/><rect class="rule" x="${n(lx)}" y="${n(rowTop)}" width="${SW}" height="${SW}"/>`);
    } else body.push(`<rect class="${FILL_CLASS[it.word]}" x="${n(lx)}" y="${n(rowTop)}" width="${SW}" height="${SW}"/><rect class="rule" x="${n(lx)}" y="${n(rowTop)}" width="${SW}" height="${SW}"/>`);
    body.push(`<text x="${n(lx + SW + 6)}" y="${n(rowTop + SW - 3)}" font-size="${L.fontSmall + 1}" data-legend="${it.word}">${esc(it.text)}</text>`);
    lx += w;
  }
  y = rowTop + SW + 6;
  for (const line of wrapText(SPLIT_NOTE, width - L.margin * 2, L.fontSmall)) {
    y += L.fontSmall + 3;
    body.push(`<text class="muted" x="${L.margin}" y="${n(y)}" font-size="${L.fontSmall}">${esc(line)}</text>`);
  }

  // Caption: the one sentence, verbatim.
  y += 10;
  const captionLines = wrapText(caption, width - L.margin * 2, L.fontSmall + 2);
  captionLines.forEach((line, k) => {
    y += L.fontSmall + 5;
    body.push(`<text x="${L.margin}" y="${n(y)}" font-size="${L.fontSmall + 2}" data-caption="${k}">${esc(line)}</text>`);
  });

  // Credit: the same line the other drawings carry, wrapped at its separators where the drawing is narrow.
  y += 8;
  body.push(`<metadata>${esc(CREDIT)}</metadata>`);
  const creditLines: string[] = [];
  let cur = '';
  for (const piece of CREDIT.split(' · ')) {
    const next = cur === '' ? piece : `${cur} · ${piece}`;
    if (cur !== '' && textWidth(next, 10.5) > width - L.margin * 2) {
      creditLines.push(cur);
      cur = piece;
    } else cur = next;
  }
  creditLines.push(cur);
  for (const line of creditLines) {
    y += 14;
    body.push(`<text class="muted" x="${L.margin}" y="${n(y)}" font-size="10.5">${esc(line)}</text>`);
  }
  const height = Math.ceil(y + 10);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" class="ov ov-forecast-grid" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(title)}"${options.theme ? ` data-theme="${options.theme}"` : ''}>`,
    styleBlock(),
    `<rect class="bg" width="${width}" height="${height}"/>`,
    ...body,
    '</svg>',
  ].join('\n');
}
