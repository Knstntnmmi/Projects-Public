// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import type { Conventions } from '../../conventions.ts';
import { nextSunLongitude, norm360 } from '../../substrate/sky.ts';
import { MS } from '../../substrate/time.ts';
import type { Hexagram } from './hexagrams.ts';
import { GUA_QI_SEQUENCE, GUA_QI_START, JING_FANG_ALLOTMENTS, YEAR_PARTS } from './wheels.ts';

export * from './hexagrams.ts';
export * from './wheels.ts';

export interface HexagramSpan {
  hexagram: Hexagram;
  /** Position in the gua qi sequence from 0; 60 and above are the cardinal periods of Jing Fang's scheme. */
  position: number;
  startUtcMs: number;
  endUtcMs: number;
}

/** The winter solstice at or before the instant. */
function solsticeBefore(utcMs: number): number {
  // Step back a little over a year and take the last solstice that is not in the future.
  let t = nextSunLongitude(270, utcMs - 367 * MS.DAY);
  for (;;) {
    const n = nextSunLongitude(270, t + MS.DAY);
    if (n > utcMs) return t;
    t = n;
  }
}

/**
 * Gua qi periods overlapping [startMs, endMs). Under `equal-longitude` hexagram k opens
 * when the Sun reaches 270 + 6k degrees; under `mean-time` it opens k sixtieths of the
 * way from one winter solstice to the next. Under `jing-fang` the sixty-four allotments
 * of Jing Fang's scheme are laid on the same mean-time year in proportion to their parts,
 * which makes the four cardinal hexagrams short periods of their own (position 60 to 63).
 */
export function guaQiSpans(startMs: number, endMs: number, mode: Conventions['guaQi']): HexagramSpan[] {
  const out: HexagramSpan[] = [];
  let solstice = solsticeBefore(startMs);
  while (solstice < endMs) {
    const nextSolstice = nextSunLongitude(270, solstice + 300 * MS.DAY);
    const length = nextSolstice - solstice;
    const periods: Array<{ hexagram: Hexagram; position: number }> = [];
    const edges: number[] = [solstice];
    if (mode === 'jing-fang') {
      for (const a of JING_FANG_ALLOTMENTS) {
        periods.push(a);
        edges.push(a.startParts + a.parts === YEAR_PARTS ? nextSolstice : solstice + (length * (a.startParts + a.parts)) / YEAR_PARTS);
      }
    } else {
      for (let k = 0; k < 60; k++) {
        periods.push({ hexagram: GUA_QI_SEQUENCE[k]!, position: k });
        edges.push(
          k === 59
            ? nextSolstice
            : mode === 'mean-time'
              ? solstice + (length * (k + 1)) / 60
              : nextSunLongitude(norm360(GUA_QI_START + 6 * (k + 1)), edges[k]! + MS.DAY),
        );
      }
    }
    for (const [k, period] of periods.entries()) {
      if (edges[k + 1]! > startMs && edges[k]! < endMs) {
        out.push({ hexagram: period.hexagram, position: period.position, startUtcMs: edges[k]!, endUtcMs: edges[k + 1]! });
      }
    }
    solstice = nextSolstice;
  }
  return out;
}
