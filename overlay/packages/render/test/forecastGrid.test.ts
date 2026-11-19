// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import { CREDIT, forecast } from '@overlay/core';
import { FORECAST_SENTENCE, PALETTE_DARK, PALETTE_LIGHT, renderDecadeGrid, renderTimeline, textWidth, timelineFor } from '../src/index.ts';
import { makeMoment } from '@overlay/core';
import { fixture } from '../../../fixtures/moments.ts';
import { sampleResult } from './sample.ts';

function balanced(svg: string): boolean {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|[^>"])*?)(\/?)>/g)) {
    const [, close, name, , selfClose] = m;
    if (selfClose) continue;
    if (close) {
      if (stack.pop() !== name) return false;
    } else stack.push(name!);
  }
  return stack.length === 0;
}

const unescape = (s: string): string => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

const result = sampleResult();
const grid = forecast.decadeGrid(result, 'wealth');

describe('the decade grid drawing', () => {
  for (const width of [360, 720, 1200]) {
    const svg = renderDecadeGrid(grid, { width });

    it(`is well formed and complete at ${width} pixels`, () => {
      expect(balanced(svg)).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      expect(svg.match(/<svg/g)).toHaveLength(1);
      expect(svg).toContain(`viewBox="0 0 ${width} `);
      expect(svg).toContain(`<metadata>${CREDIT.replace(/&/g, '&amp;')}</metadata>`);
      // Every level has a row and every year a cell; the word of each cell is the word of the core.
      for (const row of grid.rows) {
        expect(svg).toContain(`data-level="${row.level}"`);
        row.cells.forEach((c, i) => {
          const m = new RegExp(`<g data-year="${c.year}" data-word="([a-z-]+)"><[^>]*>(?:(?!</g>).)*?<title>${c.year}, ${row.label}:`, 's').exec(svg.slice(svg.indexOf(`data-level="${row.level}"`)));
          expect(m?.[1], `${row.label} ${grid.years[i]}`).toBe(c.word);
        });
      }
      expect(svg.match(/data-word="/g)).toHaveLength(grid.rows.length * grid.years.length);
      for (const g of grid.groups) expect(svg).toContain(`data-tradition="${g.tradition}"`);
    });

    it(`says the one sentence verbatim as its caption, once, at ${width} pixels`, () => {
      const lines = [...svg.matchAll(/data-caption="\d+">([^<]*)</g)].map((m) => unescape(m[1]!));
      expect(lines.join(' ')).toBe(FORECAST_SENTENCE);
      expect(svg.split(FORECAST_SENTENCE).length - 1).toBeLessThanOrEqual(1); // once: wrapped over lines or whole, never repeated
    });

    it(`has the four words of the legend and the period-read line at ${width} pixels`, () => {
      for (const w of ['supports', 'cautions', 'mixed', 'nothing-said'] as const) expect(svg).toContain(`data-legend="${w}">${forecast.WORD[w]}<`);
      for (const p of grid.periodRead) expect(svg).toContain(`data-period-read="${p.tradition}"`);
    });

    it(`draws no number inside a cell and keeps every text inside the drawing at ${width} pixels`, () => {
      const cells = [...svg.matchAll(/<g data-year="\d+" data-word="[^"]+">(.*?)<\/g>/gs)];
      expect(cells).toHaveLength(grid.rows.length * grid.years.length);
      for (const c of cells) {
        const shown = [...c[1]!.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((t) => t[1]);
        for (const t of shown) expect(t, 'a cell shows a sign or nothing').toMatch(/^[+~-]?$/);
      }
      for (const m of svg.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)) {
        const attrs = m[1]!;
        if (attrs.includes('transform=')) continue;
        const x = Number(/\bx="([\d.-]+)"/.exec(attrs)?.[1]);
        const size = Number(/font-size="([\d.]+)"/.exec(attrs)?.[1]);
        const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? 'start';
        const w = textWidth(unescape(m[2]!), size);
        const [lo, hi] = anchor === 'middle' ? [x - w / 2, x + w / 2] : anchor === 'end' ? [x - w, x] : [x, x + w];
        expect(lo, m[2]).toBeGreaterThanOrEqual(0);
        expect(hi, m[2]).toBeLessThanOrEqual(width + 0.5);
      }
    });

    it(`sets no type under 11 pixels as seen at 390 pixels wide, at ${width} pixels`, () => {
      // A phone shows the README at about 390 pixels: a drawing of w units is scaled by 390 / w, so the smallest type
      // must be 11 * w / 390 units for w up to 720, and 11 units below 390.
      const least = 11 * Math.max(1, Math.min(width, 720) / 390) - 0.05;
      const sizes = [...svg.matchAll(/font-size="([\d.]+)"/g)].map((m) => Number(m[1]));
      expect(sizes.length).toBeGreaterThan(0);
      for (const s of sizes) expect(s).toBeGreaterThanOrEqual(least);
      if (width <= 720) for (const s of sizes) expect((s * 390) / width).toBeGreaterThanOrEqual(width < 390 ? 11 : 11 - 0.05);
    });

    it(`matches its snapshot at ${width} pixels`, async () => {
      await expect(`${svg}\n`).toMatchFileSnapshot(`./__snapshots__/forecast-grid-j2000-${width}.svg`);
    });
  }

  it('splits a mixed cell by the shares of the core, and fills the others whole', () => {
    const svg = renderDecadeGrid(grid, { width: 720 });
    for (const row of grid.rows) {
      for (const c of row.cells) {
        const body = new RegExp(`<g data-year="${c.year}" data-word="${c.word}">((?:(?!</g>).)*?)</g>`, 's').exec(svg.slice(svg.indexOf(`data-level="${row.level}"`)))![1]!;
        const fills = [...body.matchAll(/<rect class="(t-\w+)" [^>]*width="([\d.]+)"/g)].map((m) => ({ cls: m[1]!, w: Number(m[2]) }));
        if (c.word === 'nothing-said') expect(fills).toEqual([]);
        else if (c.word !== 'mixed') expect(fills.map((f) => f.cls)).toEqual([`t-${c.word}`]);
        else {
          const total = fills.reduce((a, f) => a + f.w, 0);
          const share = (cls: string): number => (fills.find((f) => f.cls === cls)?.w ?? 0) / total;
          expect(share('t-supports')).toBeCloseTo(c.shares.supports, 1);
          expect(share('t-cautions')).toBeCloseTo(c.shares.cautions, 1);
          expect(share('t-mixed')).toBeCloseTo(c.shares.mixed, 1);
        }
      }
    }
    // The sample has all four kinds of cell, so the test above meets each.
    expect(new Set(grid.rows.flatMap((r) => r.cells.map((c) => c.word)))).toEqual(new Set(['supports', 'cautions', 'mixed', 'nothing-said']));
  });

  it('puts the reason a row is silent inside the row', () => {
    const svg = renderDecadeGrid(grid, { width: 720 });
    const luck = grid.rows.find((r) => r.level === 'bazi-luck')!;
    expect(luck.note).toBe(forecast.NOTE.needsLuckDirection);
    // The drawing says it short, and keeps the full words in the row's tooltip; the README caption gives them in full.
    const row = svg.slice(svg.indexOf('data-level="bazi-luck"'));
    expect(row.slice(0, 1500)).toContain('needs the sex');
    expect(svg).toContain('needs the sex the chart is read as');
  });

  it('follows the viewer\'s colour scheme through the existing mechanism, and can be fixed to one', () => {
    const auto = renderDecadeGrid(grid);
    expect(auto).toContain('prefers-color-scheme:dark');
    expect(/<svg[^>]*data-theme=/.test(auto)).toBe(false);
    expect(/<svg[^>]*data-theme="dark"/.test(renderDecadeGrid(grid, { theme: 'dark' }))).toBe(true);
    for (const tone of ['supports', 'cautions', 'mixed']) {
      expect(auto).toContain(`.ov .t-${tone}{`);
      expect(PALETTE_LIGHT[tone]).toBeTruthy();
      expect(PALETTE_DARK[tone]).toBeTruthy();
    }
  });

  it('is the same drawing every time', () => {
    expect(renderDecadeGrid(grid, { width: 540 })).toBe(renderDecadeGrid(grid, { width: 540 }));
  });

  it('draws a chart with no level at all without failing', () => {
    const empty = { ...grid, groups: [], rows: [], headlines: grid.headlines, periodRead: [] };
    const svg = renderDecadeGrid(empty, { width: 360 });
    expect(balanced(svg)).toBe(true);
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe('forecast tracks on the timeline', () => {
  const f = fixture('j2000');
  const moment = makeMoment(f.civil, f.zone, f.place);
  const tracks = forecast.forecastTracks(result, 'wealth');
  const start = result.span.startUtcMs;
  const end = result.span.endUtcMs;

  it('are drawn after the engine\'s own tracks, with the one sentence under them', () => {
    const svg = timelineFor(moment, { ...(result.conventions.engine) }, { startUtcMs: start, endUtcMs: end, extraTracks: tracks, footnote: FORECAST_SENTENCE });
    expect(balanced(svg)).toBe(true);
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    for (const t of tracks) expect(svg).toContain(`data-track="${t.id}"`);
    expect(svg).toContain('data-track="vimshottari"');
    expect([...svg.matchAll(/data-footnote="\d+">([^<]*)</g)].map((m) => unescape(m[1]!)).join(' ')).toBe(FORECAST_SENTENCE);
  });

  it('are not given to the seam finder', () => {
    const plain = timelineFor(moment, result.conventions.engine, { startUtcMs: start, endUtcMs: end });
    const withTracks = timelineFor(moment, result.conventions.engine, { startUtcMs: start, endUtcMs: end, extraTracks: tracks });
    const seams = (svg: string): string[] => [...svg.matchAll(/data-seam="(\d+)"/g)].map((m) => m[1]!);
    expect(seams(withTracks)).toEqual(seams(plain));
  });

  it('leave the timeline unchanged where there are none', () => {
    const a = renderTimeline([], { startUtcMs: start, endUtcMs: end });
    expect(a).not.toContain('data-footnote');
  });
});
