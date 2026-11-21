// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/** Small helpers shared by the renderers. Everything returns strings; nothing touches a DOM. */

export function esc(s: string | number): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const n = (x: number): string => (Math.round(x * 100) / 100).toString();

/**
 * Colour is carried by CSS custom properties so that a host page can theme the drawing,
 * and a standalone SVG file still follows the viewer's light or dark preference.
 */
export const PALETTE_LIGHT: Record<string, string> = {
  bg: '#fbfaf6',
  panel: '#f1efe8',
  ink: '#22201b',
  muted: '#6f6a5f',
  line: '#cfcabb',
  accent: '#a23b2a',
  fire: '#e8a08a',
  earth: '#d9c48f',
  air: '#bcd3e6',
  water: '#8fb4d9',
  wood: '#a9cf9c',
  metal: '#d5d7dc',
  sun: '#f0c35a',
  moon: '#cfd6e4',
  mercury: '#b8dcc8',
  venus: '#e9b9cf',
  mars: '#e58f7c',
  jupiter: '#b9b3e6',
  saturn: '#a9a79d',
  node: '#c9c2b0',
  rahu: '#8f9bb3',
  ketu: '#c7a98f',
  jie: '#e7d9b8',
  qi: '#f4eedd',
  // The three words use the colours of the page's grid, so that a reader who learns the figure reads the page.
  supports: '#2f74b5',
  cautions: '#c4551d',
  mixed: '#8c80b4',
  quiet: '#ece8dc',
};

export const PALETTE_DARK: Record<string, string> = {
  bg: '#16161a',
  panel: '#1f2026',
  ink: '#ece8dd',
  muted: '#9a968a',
  line: '#3a3b44',
  accent: '#f08a6c',
  fire: '#8a3f31',
  earth: '#6f5f2c',
  air: '#33506b',
  water: '#234a75',
  wood: '#2f5f39',
  metal: '#4a4d57',
  sun: '#8a6a17',
  moon: '#4a5266',
  mercury: '#2f5f4b',
  venus: '#7a3f5c',
  mars: '#8c3a2b',
  jupiter: '#4a4390',
  saturn: '#55534b',
  node: '#514c40',
  rahu: '#3d4963',
  ketu: '#6a4f38',
  jie: '#4d4530',
  qi: '#2c2a22',
  supports: '#4f98d8',
  cautions: '#e0834f',
  mixed: '#9a90c4',
  quiet: '#34322a',
};

const vars = (p: Record<string, string>): string =>
  Object.entries(p)
    .map(([k, v]) => `--ov-${k}:${v}`)
    .join(';');

/** The style block embedded in every drawing. */
export function styleBlock(): string {
  return `<style>
.ov{${vars(PALETTE_LIGHT)};font-family:"Iowan Old Style","Palatino Linotype",Palatino,"Noto Serif","Songti SC","Noto Serif CJK SC",serif;color:var(--ov-ink)}
@media (prefers-color-scheme:dark){.ov:not([data-theme="light"]){${vars(PALETTE_DARK)}}}
.ov[data-theme="dark"]{${vars(PALETTE_DARK)}}
.ov .bg{fill:var(--ov-bg)}
.ov text{fill:var(--ov-ink)}
.ov .muted{fill:var(--ov-muted)}
.ov .seg{stroke:var(--ov-line);stroke-width:.6}
.ov .seg:hover{stroke:var(--ov-ink);stroke-width:1.4}
.ov .rule{stroke:var(--ov-line);fill:none}
.ov .mark{stroke:var(--ov-ink);fill:none}
.ov .accent{stroke:var(--ov-accent);fill:none}
.ov .accent-text{fill:var(--ov-accent)}
.ov .halo{paint-order:stroke;stroke:var(--ov-bg);stroke-width:3px;stroke-linejoin:round}
${Object.keys(PALETTE_LIGHT)
  .filter((k) => !['bg', 'panel', 'ink', 'muted', 'line', 'accent'].includes(k))
  .map((k) => `.ov .t-${k}{fill:var(--ov-${k})}`)
  .join('\n')}
.ov .t-yang{fill:var(--ov-ink)}
.ov .t-none{fill:var(--ov-panel)}
</style>`;
}

/** Class and extra attributes for a tone key. */
export function toneAttrs(tone: string | undefined): string {
  if (!tone) return 'class="seg t-none"';
  const yang = /^yang(\d)$/.exec(tone);
  if (yang) return `class="seg t-yang" fill-opacity="${n(0.04 + (6 - Number(yang[1])) * 0.085)}"`;
  return `class="seg t-${esc(tone)}"`;
}

/** Rough width of a label in pixels: full-width characters count one em, the rest about half. */
export function textWidth(s: string, fontSize: number): number {
  let w = 0;
  for (const ch of s) w += ch.codePointAt(0)! > 0x2e7f ? 1 : 0.56;
  return w * fontSize;
}

/** Machine-readable and visible credit for a drawing; the licence notice asks for it to be kept. */
export function creditBlock(credit: string, x: number, y: number, anchor: 'start' | 'end' = 'end'): string {
  return `<metadata>${esc(credit)}</metadata><text class="muted" x="${n(x)}" y="${n(y)}" font-size="10.5" text-anchor="${anchor}">${esc(credit)}</text>`;
}

/** Breaks a text into lines no wider than a given width, at spaces; a single word wider than the width keeps its own line. */
export function wrapText(s: string, maxWidth: number, fontSize: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of s.split(/\s+/).filter((w) => w !== '')) {
    const next = line === '' ? word : `${line} ${word}`;
    if (line !== '' && textWidth(next, fontSize) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line !== '') lines.push(line);
  return lines;
}
