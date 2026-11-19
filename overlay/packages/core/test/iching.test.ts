// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import {
  CARDINAL_HEXAGRAMS,
  FUXI_SEQUENCE,
  FUXI_START,
  GATE_SEQUENCE,
  GATE_START,
  GUA_QI_SEQUENCE,
  guaQiSpans,
  HEXAGRAMS,
  hexagramByName,
  SOVEREIGN_SEQUENCE,
  wheelPosition,
} from '../src/systems/iching/index.ts';
import { MS, utcMsFromFields } from '../src/substrate/time.ts';

const numbers = (xs: readonly { number: number }[]): number[] => xs.map((x) => x.number);

describe('hexagram table', () => {
  it('has sixty-four distinct figures', () => {
    expect(new Set(HEXAGRAMS.map((h) => h.value)).size).toBe(64);
    expect(new Set(HEXAGRAMS.map((h) => h.hanzi)).size).toBe(64);
  });

  it('obeys the King Wen pairing: each even hexagram is its predecessor inverted, or complemented where inversion changes nothing', () => {
    for (let n = 1; n <= 63; n += 2) {
      const a = HEXAGRAMS[n - 1]!;
      const b = HEXAGRAMS[n]!;
      const inverted = [...a.lines].reverse().join('');
      const complemented = a.lines.map((x) => 1 - x).join('');
      const expected = inverted === a.lines.join('') ? complemented : inverted;
      expect(b.lines.join(''), `${a.hanzi} and ${b.hanzi}`).toBe(expected);
    }
  });

  it('carries the right Unicode symbol', () => {
    expect(hexagramByName('乾').symbol).toBe('䷀');
    expect(hexagramByName('未濟').symbol).toBe('䷿');
  });
});

describe('year arrangements', () => {
  it('sovereign hexagrams add one yang line a month from Fu, then one yin line a month from Gou', () => {
    const yang = SOVEREIGN_SEQUENCE.map((h) => h.lines.reduce((a, b) => a + b, 0));
    expect(yang).toEqual([1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 0]);
    for (const [i, h] of SOVEREIGN_SEQUENCE.entries()) {
      const expected = i < 6 ? '1'.repeat(i + 1).padEnd(6, '0') : '0'.repeat(i - 5).padEnd(6, '1');
      expect(h.lines.join(''), h.hanzi).toBe(expected);
    }
  });

  it('gua qi uses sixty hexagrams once each and leaves exactly the four cardinal ones', () => {
    expect(new Set(numbers(GUA_QI_SEQUENCE)).size).toBe(60);
    const rest = HEXAGRAMS.filter((h) => !GUA_QI_SEQUENCE.includes(h)).map((h) => h.hanzi);
    expect(rest.sort()).toEqual(CARDINAL_HEXAGRAMS.map((c) => c.hexagram.hanzi).sort());
  });

  it('gua qi puts each sovereign hexagram second in its month, in sovereign order', () => {
    const sovereigns = GUA_QI_SEQUENCE.filter((_, k) => k % 5 === 1);
    expect(numbers(sovereigns)).toEqual(numbers(SOVEREIGN_SEQUENCE));
  });

  it('Fu Xi circle and gate wheel each use all sixty-four once', () => {
    expect(new Set(numbers(FUXI_SEQUENCE)).size).toBe(64);
    expect(new Set(numbers(GATE_SEQUENCE)).size).toBe(64);
  });

  it('the gate wheel is the Fu Xi circle run backwards and turned', () => {
    // Find where the gate wheel's first hexagram sits on the Fu Xi circle, then walk
    // the circle in the opposite direction.
    const at = FUXI_SEQUENCE.indexOf(GATE_SEQUENCE[0]!);
    const walked = GATE_SEQUENCE.map((_, k) => FUXI_SEQUENCE[(((at - k) % 64) + 64) % 64]!);
    expect(numbers(walked)).toEqual(numbers(GATE_SEQUENCE));
    // The seam between Fu and Kun, which Shao Yong sets at the winter solstice (270),
    // falls on the gate wheel at 43 degrees 15 minutes: 13 degrees 15 minutes of Taurus.
    const fu = GATE_SEQUENCE.findIndex((h) => h.hanzi === '復');
    expect(GATE_SEQUENCE[fu + 1]!.hanzi).toBe('坤');
    expect((GATE_START + (fu + 1) * 5.625) % 360).toBeCloseTo(43.25, 9);
    expect(FUXI_SEQUENCE[0]!.hanzi).toBe('復');
    expect(FUXI_START).toBe(270);
  });

  it('gate wheel reproduces published gate positions', () => {
    // Gate 25 begins at 28 degrees 15 minutes of Pisces, gate 1 at 13 degrees 15 minutes of Scorpio.
    expect(wheelPosition(GATE_SEQUENCE, GATE_START, 358.26).hexagram.number).toBe(25);
    expect(wheelPosition(GATE_SEQUENCE, GATE_START, 358.24).hexagram.number).toBe(36);
    expect(wheelPosition(GATE_SEQUENCE, GATE_START, 223.26).hexagram.number).toBe(1);
    const p = wheelPosition(GATE_SEQUENCE, GATE_START, 302 + 5.625 / 6 + 0.001);
    expect([p.hexagram.number, p.line]).toEqual([41, 2]);
  });
});

describe('gua qi periods', () => {
  const start = utcMsFromFields(2024, 1, 1);
  const end = utcMsFromFields(2026, 1, 1);

  it('tile the span without gaps in both modes', () => {
    for (const mode of ['equal-longitude', 'mean-time'] as const) {
      const spans = guaQiSpans(start, end, mode);
      expect(spans[0]!.startUtcMs).toBeLessThanOrEqual(start);
      expect(spans.at(-1)!.endUtcMs).toBeGreaterThanOrEqual(end);
      for (let i = 1; i < spans.length; i++) expect(spans[i]!.startUtcMs).toBe(spans[i - 1]!.endUtcMs);
      expect(spans.length).toBeGreaterThanOrEqual(120);
    }
  });

  it('average six and seven-eightieths days, and the two modes drift by under three days', () => {
    const a = guaQiSpans(start, end, 'equal-longitude');
    const b = guaQiSpans(start, end, 'mean-time');
    const meanDays = b.reduce((s, x) => s + (x.endUtcMs - x.startUtcMs), 0) / b.length / MS.DAY;
    expect(meanDays).toBeCloseTo(6 + 7 / 80, 2);
    let worst = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      expect(a[i]!.hexagram.number).toBe(b[i]!.hexagram.number);
      worst = Math.max(worst, Math.abs(a[i]!.startUtcMs - b[i]!.startUtcMs) / MS.DAY);
    }
    expect(worst).toBeGreaterThan(1);
    expect(worst).toBeLessThan(3);
  });
});
