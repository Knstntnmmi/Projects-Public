// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Seams: dates on which several tracks change period at once.
 *
 * A seam is a description, not a prediction. With a dozen tracks changing every one to
 * twenty years, some coincidences are certain; the count expected by chance is reported
 * next to the count found so that the two can be compared.
 */
import { MS } from '../substrate/time.ts';
import type { Track, TrackLevel } from './tracks.ts';

export interface SeamChange {
  track: string;
  clock: string;
  title: string;
  utcMs: number;
  from: string;
  to: string;
}

export interface Seam {
  /** Midpoint of the cluster. */
  utcMs: number;
  startUtcMs: number;
  endUtcMs: number;
  changes: SeamChange[];
  /** Number of independent clocks that change inside the window (tracks sharing a clock count once). */
  clocks: number;
}

export interface SeamReport {
  windowDays: number;
  seams: Seam[];
  /** How many windows with two or more independent clocks changing would be expected if boundaries fell at random. */
  expectedByChance: number;
  /** How many were found. */
  found: number;
}

const WEIGHT: Record<TrackLevel, number> = { life: 0, year: 1, month: 2, week: 3 };

export function findSeams(
  tracks: readonly Track[],
  startUtcMs: number,
  endUtcMs: number,
  options: { windowDays?: number; levels?: TrackLevel[]; limit?: number } = {},
): SeamReport {
  const windowDays = options.windowDays ?? 30;
  const levels = options.levels ?? ['life', 'year'];
  const window = windowDays * MS.DAY;
  const chosen = tracks.filter((t) => levels.includes(t.level));

  const changes: SeamChange[] = [];
  for (const t of chosen) {
    for (let i = 1; i < t.intervals.length; i++) {
      const at = t.intervals[i]!.startUtcMs;
      if (at <= startUtcMs || at >= endUtcMs) continue;
      changes.push({ track: t.id, clock: t.clock, title: t.title, utcMs: at, from: t.intervals[i - 1]!.label, to: t.intervals[i]!.label });
    }
  }
  changes.sort((a, b) => a.utcMs - b.utcMs);

  const seams: Seam[] = [];
  let i = 0;
  while (i < changes.length) {
    let j = i;
    while (j + 1 < changes.length && changes[j + 1]!.utcMs - changes[i]!.utcMs <= window) j++;
    const group = changes.slice(i, j + 1);
    const distinct = new Set(group.map((c) => c.clock)).size;
    if (distinct >= 2) {
      const a = group[0]!.utcMs;
      const b = group[group.length - 1]!.utcMs;
      seams.push({ utcMs: (a + b) / 2, startUtcMs: a, endUtcMs: b, changes: group, clocks: distinct });
      i = j + 1;
    } else {
      i++;
    }
  }

  // Chance baseline: treat each clock as a Poisson process with its observed rate (its
  // tracks' changes merged, those within a day of each other counted once). The
  // probability that a change on one clock has a change on some other clock within the
  // window after it is 1 - exp(-window * sum of the other rates).
  const span = endUtcMs - startUtcMs;
  const byClock = new Map<string, number[]>();
  for (const c of changes) byClock.set(c.clock, [...(byClock.get(c.clock) ?? []), c.utcMs]);
  const rates = [...byClock.values()].map((times) => times.filter((t, k) => k === 0 || t - times[k - 1]! > MS.DAY).length / span);
  const total = rates.reduce((a, b) => a + b, 0);
  let expected = 0;
  for (const r of rates) expected += r * span * (1 - Math.exp(-window * (total - r)));
  // Each pair is counted from both sides.
  expected /= 2;

  const levelOf = new Map(chosen.map((t) => [t.id, WEIGHT[t.level]]));
  const rank = (s: Seam): number => s.clocks * 10 - Math.min(...s.changes.map((c) => levelOf.get(c.track) ?? 3));
  const ranked = [...seams].sort((a, b) => rank(b) - rank(a) || a.utcMs - b.utcMs).slice(0, options.limit ?? 12);
  ranked.sort((a, b) => a.utcMs - b.utcMs);
  return { windowDays, seams: ranked, expectedByChance: expected, found: seams.length };
}
