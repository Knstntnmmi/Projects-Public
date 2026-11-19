// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The timeline: every track drawn against one date axis, so that the boundaries of
 * different systems can be compared by eye.
 */
import { CREDIT, type Seam, type Track } from '@overlay/core';
import { creditBlock, esc, n, styleBlock, textWidth, toneAttrs, wrapText } from './svg.ts';

export interface TimelineOptions {
  startUtcMs: number;
  endUtcMs: number;
  /** Vertical marker lines, for example the moment itself or today. */
  marks?: Array<{ utcMs: number; label: string }>;
  seams?: readonly Seam[];
  title?: string;
  width?: number;
  theme?: 'light' | 'dark';
  /** A sentence drawn under the tracks, wrapped to the width of the drawing (the one sentence of a forecast, where forecast tracks are drawn). */
  footnote?: string;
}

const GUTTER = 232;
const ROW = 34;
const DAY = 86_400_000;

const SYSTEM_LABEL: Record<string, string> = {
  chinese: 'Chinese',
  western: 'Western',
  vedic: 'Vedic',
  iching: 'I Ching',
  calendar: 'Calendar',
};

interface Tick {
  utcMs: number;
  label: string;
  major: boolean;
}

function ticks(start: number, end: number): Tick[] {
  const years = (end - start) / (365.2425 * DAY);
  const out: Tick[] = [];
  const y0 = new Date(start).getUTCFullYear();
  const y1 = new Date(end).getUTCFullYear() + 1;
  if (years > 4) {
    const major = years > 60 ? 10 : years > 24 ? 5 : years > 12 ? 2 : 1;
    for (let y = y0; y <= y1; y++) {
      const t = Date.UTC(y, 0, 1);
      if (t < start || t > end) continue;
      out.push({ utcMs: t, label: String(y), major: y % major === 0 });
    }
    return out;
  }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let y = y0; y <= y1; y++) {
    for (let m = 0; m < 12; m++) {
      const t = Date.UTC(y, m, 1);
      if (t < start || t > end) continue;
      const quarterly = years > 1.6;
      out.push({ utcMs: t, label: m === 0 ? String(y) : MONTHS[m]!, major: m === 0 || !quarterly || m % 3 === 0 });
    }
  }
  return out;
}

export function renderTimeline(tracks: readonly Track[], options: TimelineOptions): string {
  const width = options.width ?? 1280;
  const { startUtcMs: start, endUtcMs: end } = options;
  const plot = width - GUTTER - 24;
  const x = (ms: number): number => GUTTER + ((ms - start) / (end - start)) * plot;
  const TOP = options.title ? 78 : 48;
  const noteLines = options.footnote ? wrapText(options.footnote, width - 48, 11) : [];
  const height = TOP + tracks.length * ROW + 44 + noteLines.length * 15;
  const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" class="ov ov-timeline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(options.title ?? 'Overlay timeline')}"${options.theme ? ` data-theme="${options.theme}"` : ''}>`,
  );
  out.push(styleBlock());
  out.push(`<rect class="bg" width="${width}" height="${height}"/>`);
  out.push(`<defs><clipPath id="ov-plot"><rect x="${GUTTER}" y="0" width="${plot}" height="${height}"/></clipPath></defs>`);
  if (options.title) out.push(`<text x="24" y="30" font-size="19">${esc(options.title)}</text>`);

  // Axis.
  const bottom = TOP + tracks.length * ROW;
  for (const t of ticks(start, end)) {
    const tx = x(t.utcMs);
    out.push(`<line class="rule" x1="${n(tx)}" y1="${TOP - (t.major ? 12 : 5)}" x2="${n(tx)}" y2="${bottom}" stroke-opacity="${t.major ? 0.9 : 0.35}"/>`);
    if (t.major) out.push(`<text class="muted" x="${n(tx + 3)}" y="${TOP - 16}" font-size="12">${esc(t.label)}</text>`);
  }

  // Rows.
  tracks.forEach((track, row) => {
    const y = TOP + row * ROW;
    out.push(`<g data-track="${esc(track.id)}">`);
    out.push(
      `<text x="${GUTTER - 12}" y="${y + ROW / 2 - 5}" font-size="13" text-anchor="end" dominant-baseline="central">${esc(track.title)}<title>${esc(track.boundary)}</title></text>`,
    );
    out.push(
      `<text class="muted" x="${GUTTER - 12}" y="${y + ROW / 2 + 9}" font-size="10" text-anchor="end" dominant-baseline="central">${esc(SYSTEM_LABEL[track.system] ?? track.system)} · ${esc(track.level)}</text>`,
    );
    out.push(`<g clip-path="url(#ov-plot)">`);
    for (const iv of track.intervals) {
      const x0 = Math.max(x(iv.startUtcMs), GUTTER - 2);
      const x1 = Math.min(x(iv.endUtcMs), GUTTER + plot + 2);
      const w = x1 - x0;
      if (w <= 0) continue;
      const tip = `${track.title}: ${iv.label}${iv.detail ? ` (${iv.detail})` : ''}\n${iso(iv.startUtcMs)} to ${iso(iv.endUtcMs)} UTC`;
      out.push(
        `<rect ${toneAttrs(iv.tone)} x="${n(x0)}" y="${y + 4}" width="${n(w)}" height="${ROW - 8}" rx="2" data-label="${esc(iv.label)}" data-detail="${esc(iv.detail ?? '')}" data-start="${iv.startUtcMs}" data-end="${iv.endUtcMs}"><title>${esc(tip)}</title></rect>`,
      );
      const size = 12;
      if (w > textWidth(iv.label, size) + 6) {
        out.push(
          `<text x="${n(x0 + w / 2)}" y="${y + ROW / 2}" font-size="${size}" text-anchor="middle" dominant-baseline="central" pointer-events="none">${esc(iv.label)}</text>`,
        );
      }
    }
    out.push('</g></g>');
  });

  // Seams and marks run across every row.
  for (const s of options.seams ?? []) {
    const sx = x(s.utcMs);
    if (sx < GUTTER || sx > GUTTER + plot) continue;
    const tip = `${s.clocks} independent clocks change within ${Math.max(1, Math.round((s.endUtcMs - s.startUtcMs) / DAY))} days of ${iso(s.utcMs).slice(0, 10)}:\n${s.changes.map((c) => `${c.title}: ${c.from} to ${c.to}`).join('\n')}`;
    out.push(
      `<g data-seam="${s.utcMs}"><line class="accent" x1="${n(sx)}" y1="${TOP - 4}" x2="${n(sx)}" y2="${bottom}" stroke-dasharray="3 4" stroke-opacity=".75"/><path class="accent-text" d="M${n(sx - 6)} ${TOP - 14}h12l-6 10z"><title>${esc(tip)}</title></path></g>`,
    );
  }
  for (const m of options.marks ?? []) {
    const mx = x(m.utcMs);
    if (mx < GUTTER || mx > GUTTER + plot) continue;
    out.push(
      `<line class="mark" x1="${n(mx)}" y1="${TOP - 26}" x2="${n(mx)}" y2="${bottom + 6}" stroke-width="1.4"/><text class="halo" x="${n(mx)}" y="${bottom + 20}" font-size="12" text-anchor="middle">${esc(m.label)}</text>`,
    );
  }

  noteLines.forEach((line, k) => out.push(`<text x="24" y="${n(bottom + 36 + k * 15)}" font-size="11" data-footnote="${k}">${esc(line)}</text>`));
  out.push(`<text class="muted" x="${GUTTER}" y="${height - 8}" font-size="11">Dates are UTC. Triangles mark dates where tracks on two or more independent clocks change together.</text>`);
  out.push(creditBlock(CREDIT, width - 24, height - 8));
  out.push('</svg>');
  return out.join('\n');
}
