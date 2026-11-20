// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The agreement baseline (specification, section 6.4): how many agreeing slices there
 * would be if the speaking groups were unrelated. Each group's series is shifted round
 * the span by its own random offset, which keeps its run lengths, how often it speaks and
 * its mix of supports and cautions; only the alignment between groups is destroyed.
 */
import { isAgree, verdictOf } from './agreement.ts';
import type { ClockGroupId, ReadingWord } from './types.ts';

/** A small seeded generator (mulberry32). The same seed always gives the same stream. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Baseline {
  /** Slices with an agree verdict in the real series. */
  found: number;
  /** Mean number of agreeing slices over the shifted runs. */
  expected: number;
  /** Share of runs with at least as many agreeing slices as found. */
  shareAtLeast: number;
  runs: number;
  seed: number;
  /** Groups that speak at least once; fewer than two means there is nothing to compare. */
  speakingGroups: number;
  /** Topic-by-view cells looked at on the page; printed beside the result. */
  cellsLooked: number;
}

export function countAgreeing(series: readonly (readonly ReadingWord[])[], length: number): number {
  let n = 0;
  for (let i = 0; i < length; i++) if (isAgree(verdictOf(series.map((s) => s[i]!)))) n++;
  return n;
}

export interface BaselineOptions {
  runs?: number;
  seed?: number;
  cellsLooked: number;
}

export function agreementBaseline(series: ReadonlyMap<ClockGroupId, readonly ReadingWord[]> | Record<string, readonly ReadingWord[]>, options: BaselineOptions): Baseline {
  const runs = options.runs ?? 1000;
  const seed = options.seed ?? 1;
  const all: Array<readonly ReadingWord[]> = series instanceof Map ? [...series.values()] : Object.values(series);
  const speaking = all.filter((s) => s.some((w) => w !== 'nothing-said'));
  const length = speaking[0]?.length ?? 0;
  if (speaking.some((s) => s.length !== length)) throw new RangeError('every series must cover the same slices');
  const found = countAgreeing(speaking, length);
  if (speaking.length < 2 || length === 0) {
    return { found, expected: 0, shareAtLeast: found === 0 ? 1 : 0, runs, seed, speakingGroups: speaking.length, cellsLooked: options.cellsLooked };
  }
  const rand = seededRandom(seed);
  let total = 0;
  let atLeast = 0;
  for (let r = 0; r < runs; r++) {
    const shifted = speaking.map((s) => {
      const k = Math.floor(rand() * length);
      return s.map((_, i) => s[(i + k) % length]!);
    });
    const n = countAgreeing(shifted, length);
    total += n;
    if (n >= found) atLeast++;
  }
  return { found, expected: total / runs, shareAtLeast: atLeast / runs, runs, seed, speakingGroups: speaking.length, cellsLooked: options.cellsLooked };
}
