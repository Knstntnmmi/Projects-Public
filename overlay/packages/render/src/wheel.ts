// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The wheel: every ring drawn on one ecliptic, with the planets and angles of a moment
 * laid across all of them as radial lines.
 */
import { CREDIT, type Ring } from '@overlay/core';
import { creditBlock, esc, n, styleBlock, toneAttrs } from './svg.ts';

export interface WheelMarker {
  id: string;
  /** Glyph or short text drawn at the rim. */
  glyph: string;
  label: string;
  longitude: number;
  kind: 'planet' | 'angle' | 'point';
}

export interface WheelOptions {
  /** Ring ids to draw, outermost first. Defaults to each ring's own default. */
  visible?: string[];
  /**
   * 'western': 0 Aries at the left, longitude increasing anticlockwise, as in a chart.
   * 'chinese': the spring equinox at the left (east), the winter solstice at the bottom
   * (north), longitude increasing clockwise, as on a luopan.
   */
  orientation?: 'western' | 'chinese';
  /** Longitude placed at the left-hand point. Defaults to 0. */
  leftLongitude?: number;
  markers?: WheelMarker[];
  /** Lines of text for the centre. */
  centre?: string[];
  title?: string;
  /** Adds the list of rings underneath. */
  legend?: boolean;
  theme?: 'light' | 'dark';
}

const SIZE = 1000;
const C = SIZE / 2;
const R_OUT = 418;
const R_CORE = 118;

export function renderWheel(rings: readonly Ring[], options: WheelOptions = {}): string {
  const orientation = options.orientation ?? 'western';
  const dir = orientation === 'western' ? 1 : -1;
  const left = options.leftLongitude ?? 0;
  const shown = options.visible
    ? options.visible.map((id) => rings.find((r) => r.id === id)).filter((r): r is Ring => !!r)
    : rings.filter((r) => r.defaultVisible);
  const band = (R_OUT - R_CORE) / Math.max(1, shown.length);

  // A title takes a strip at the top, and the whole wheel moves down to clear it.
  const dy = options.title ? 46 : 0;
  const CY = C + dy;
  const theta = (lon: number): number => ((180 + dir * (lon - left)) * Math.PI) / 180;
  const pt = (lon: number, r: number): [number, number] => [C + r * Math.cos(theta(lon)), CY - r * Math.sin(theta(lon))];

  const sector = (start: number, end: number, r0: number, r1: number): string => {
    const width = (((end - start) % 360) + 360) % 360 || 360;
    const large = width > 180 ? 1 : 0;
    // SVG's y axis points down, so an anticlockwise sweep on screen is sweep-flag 0.
    const sweepOut = dir === 1 ? 0 : 1;
    const [x0, y0] = pt(start, r1);
    const [x1, y1] = pt(start + width, r1);
    const [x2, y2] = pt(start + width, r0);
    const [x3, y3] = pt(start, r0);
    return `M${n(x0)} ${n(y0)}A${n(r1)} ${n(r1)} 0 ${large} ${sweepOut} ${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}A${n(r0)} ${n(r0)} 0 ${large} ${1 - sweepOut} ${n(x3)} ${n(y3)}Z`;
  };

  const out: string[] = [];
  const legendHeight = options.legend ? 46 + shown.length * 26 : 0;
  const height = SIZE + dy + legendHeight;
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" class="ov ov-wheel" viewBox="0 0 ${SIZE} ${height}" role="img" aria-label="${esc(options.title ?? 'Overlay wheel')}"${options.theme ? ` data-theme="${options.theme}"` : ''}>`,
  );
  out.push(styleBlock());
  out.push(`<rect class="bg" width="${SIZE}" height="${height}"/>`);
  if (options.title) out.push(`<text x="${C}" y="32" text-anchor="middle" font-size="20">${esc(options.title)}</text>`);

  shown.forEach((ring, i) => {
    const r1 = R_OUT - i * band;
    const r0 = r1 - band;
    const mid = (r0 + r1) / 2;
    out.push(`<g data-ring="${esc(ring.id)}">`);
    for (const s of ring.segments) {
      const width = (((s.end - s.start) % 360) + 360) % 360 || 360;
      out.push(
        `<path ${toneAttrs(s.tone)} d="${sector(s.start, s.end, r0, r1)}" data-label="${esc(s.label)}" data-ring-title="${esc(ring.title)}"><title>${esc(ring.title)}: ${esc(s.label)}</title></path>`,
      );
      const arc = (width * Math.PI * mid) / 180;
      const chars = [...s.short.replace(/\uFE0E/g, '')].length;
      const size = Math.max(7, Math.min(band * 0.52, (arc / Math.max(1, chars)) * 0.86, 21));
      if (arc >= 9) {
        const [x, y] = pt(s.start + width / 2, mid);
        out.push(
          `<text x="${n(x)}" y="${n(y)}" font-size="${n(size)}" text-anchor="middle" dominant-baseline="central" pointer-events="none">${esc(s.short)}</text>`,
        );
      }
    }
    out.push('</g>');
  });

  // Cardinal axes: the equinoxes and solstices, which every ring is hung on.
  for (const lon of [0, 90, 180, 270]) {
    const [x0, y0] = pt(lon, R_CORE);
    const [x1, y1] = pt(lon, R_OUT + 6);
    out.push(`<line class="rule" x1="${n(x0)}" y1="${n(y0)}" x2="${n(x1)}" y2="${n(y1)}" stroke-dasharray="2 5"/>`);
  }
  out.push(`<circle class="rule" cx="${C}" cy="${CY}" r="${R_CORE}"/>`);

  // Markers: sort round the circle and stagger the labels of those that crowd together.
  const markers = [...(options.markers ?? [])].sort((a, b) => a.longitude - b.longitude);
  let lastLon = -999;
  let tier = 0;
  for (const m of markers) {
    tier = Math.abs(m.longitude - lastLon) < 9 ? (tier + 1) % 3 : 0;
    lastLon = m.longitude;
    const rLabel = R_OUT + 20 + tier * 25;
    const [x0, y0] = pt(m.longitude, m.kind === 'angle' ? 0 : R_CORE);
    const [x1, y1] = pt(m.longitude, rLabel - 11);
    const [xl, yl] = pt(m.longitude, rLabel);
    const cls = m.kind === 'angle' ? 'accent' : 'mark';
    out.push(
      `<g data-marker="${esc(m.id)}"><line class="${cls}" x1="${n(x0)}" y1="${n(y0)}" x2="${n(x1)}" y2="${n(y1)}" stroke-width="${m.kind === 'angle' ? 1.6 : 1}" stroke-opacity="${m.kind === 'angle' ? 0.9 : 0.6}"${m.kind === 'point' ? ' stroke-dasharray="4 3"' : ''}><title>${esc(m.label)}</title></line>` +
        `<text class="halo${m.kind === 'angle' ? ' accent-text' : ''}" x="${n(xl)}" y="${n(yl)}" font-size="${m.kind === 'angle' ? 13 : 19}" text-anchor="middle" dominant-baseline="central"><title>${esc(m.label)}</title>${esc(m.glyph)}</text></g>`,
    );
  }

  // Centre text.
  const centre = options.centre ?? [];
  centre.forEach((line, i) => {
    const y = CY + (i - (centre.length - 1) / 2) * 26;
    out.push(
      `<text class="halo${i === 0 ? '' : ' muted'}" x="${C}" y="${n(y)}" font-size="${i === 0 ? 25 : 13}" text-anchor="middle" dominant-baseline="central">${esc(line)}</text>`,
    );
  });

  if (options.legend) {
    out.push(`<text class="muted" x="40" y="${SIZE + dy + 6}" font-size="13">Rings, from the outside in</text>`);
    shown.forEach((ring, i) => {
      const y = SIZE + dy + 34 + i * 26;
      out.push(
        `<text x="40" y="${y}" font-size="15">${i + 1}. ${esc(ring.title)}</text><text class="muted" x="330" y="${y}" font-size="13">${esc(ring.grade)}</text><text class="muted" x="440" y="${y}" font-size="12">${esc(ring.note.length > 92 ? `${ring.note.slice(0, 90)}…` : ring.note)}</text>`,
      );
    });
  }

  out.push(creditBlock(CREDIT, SIZE - 14, height - 10));
  out.push('</svg>');
  return out.join('\n');
}
