// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
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
  JING_FANG_ALLOTMENTS,
  PARTS_PER_DAY,
  SOVEREIGN_SEQUENCE,
  wheelPosition,
  YEAR_PARTS,
} from '../src/systems/iching/index.ts';
import { DEFAULT_CONVENTIONS } from '../src/conventions.ts';
import { nextSunLongitude } from '../src/substrate/sky.ts';
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
    // The seam between Fu and Kun, which the project places at the winter solstice (270),
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

describe('Jing Fang allotment of the gua qi (Xin Tang shu 27A)', () => {
  const start = utcMsFromFields(2024, 1, 1);
  const end = utcMsFromFields(2026, 1, 1);

  it('keeps the default convention unchanged', () => {
    expect(DEFAULT_CONVENTIONS.guaQi).toBe('equal-longitude');
    expect(guaQiSpans(start, end, 'equal-longitude').every((s) => s.position < 60)).toBe(true);
  });

  it('allots 365 1/4 days in parts of 80: four cardinal slivers, four short and fifty-six full periods', () => {
    const parts = JING_FANG_ALLOTMENTS.map((a) => a.parts);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(365.25 * PARTS_PER_DAY);
    expect(YEAR_PARTS).toBe(29220);
    expect(parts.filter((p) => p === 73)).toHaveLength(4);
    expect(parts.filter((p) => p === 5 * 80 + 14)).toHaveLength(4);
    expect(parts.filter((p) => p === 6 * 80 + 7)).toHaveLength(56);
    expect(new Set(numbers(JING_FANG_ALLOTMENTS.map((a) => a.hexagram))).size).toBe(64);
  });

  it('gives the short allotment to Yi, Jin, Jing and Da Xu, each just before a cardinal hexagram', () => {
    const short = JING_FANG_ALLOTMENTS.filter((a) => a.parts === 414).map((a) => a.hexagram.hanzi);
    expect(short).toEqual(['晉', '井', '大畜', '頤']);
    JING_FANG_ALLOTMENTS.forEach((a, i) => {
      if (a.parts === 414) {
        const next = JING_FANG_ALLOTMENTS[(i + 1) % 64]!;
        expect(next.parts).toBe(73);
        expect(CARDINAL_HEXAGRAMS.map((c) => c.hexagram.hanzi)).toContain(next.hexagram.hanzi);
      }
    });
  });

  it('tiles two years without gaps and includes the cardinal slivers as periods of their own', () => {
    const spans = guaQiSpans(start, end, 'jing-fang');
    expect(spans[0]!.startUtcMs).toBeLessThanOrEqual(start);
    expect(spans.at(-1)!.endUtcMs).toBeGreaterThanOrEqual(end);
    for (let i = 1; i < spans.length; i++) expect(spans[i]!.startUtcMs).toBe(spans[i - 1]!.endUtcMs);
    const slivers = spans.filter((s) => s.position >= 60);
    expect(slivers.length).toBeGreaterThanOrEqual(8);
    for (const s of slivers) expect((s.endUtcMs - s.startUtcMs) / MS.DAY).toBeCloseTo((73 / 80) * (365.2422 / 365.25), 1);
  });

  it('starts each cardinal sliver within minutes of its scaled solstice or equinox position', () => {
    const spans = guaQiSpans(start, end, 'jing-fang');
    const kan = spans.filter((s) => s.position === 60);
    for (const [i, s] of kan.entries()) {
      // The winter solstice itself, from the Sun's longitude.
      const solstice = nextSunLongitude(270, s.startUtcMs - 2 * MS.DAY);
      expect(Math.abs(s.startUtcMs - solstice) / MS.MIN).toBeLessThan(1);
      const next = kan[i + 1];
      if (!next) continue;
      for (let q = 1; q < 4; q++) {
        const sliver = spans.find((x) => x.position === 60 + q && x.startUtcMs > s.startUtcMs)!;
        const scaled = s.startUtcMs + ((next.startUtcMs - s.startUtcMs) * q) / 4;
        expect(Math.abs(sliver.startUtcMs - scaled) / MS.MIN, `cardinal ${q}`).toBeLessThan(5);
      }
    }
  });
});
