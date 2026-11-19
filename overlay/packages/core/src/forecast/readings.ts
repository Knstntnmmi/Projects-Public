// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Readings (specification, section 5.1): what one tradition says about one topic in one
 * slice, in words and never in numbers. Signals that report one physical fact are counted
 * once; modifiers are listed but never decide a word.
 */
import { NOTE, supportsFromCautionsFrom } from './phrasebook.ts';
import { overlapFraction, overlaps } from './signals.ts';
import type { ClockGroupId, LevelId, ReadingWord, Signal, Slice, Stage, Tally, Topic, Tradition } from './types.ts';
import { TRADITIONS } from './types.ts';

export interface Reading {
  tradition: Tradition;
  /** The independence group the signals belong to; null for the tradition as a whole. */
  group: ClockGroupId | null;
  topic: Topic;
  slice: number;
  word: ReadingWord;
  /** Words that qualify the reading: "rules conflict", "topic active", "supports from X, cautions from Y". */
  note: string | null;
  /** The plain counts behind the word, after de-duplication. Display only. */
  tally: Tally;
  signalIds: string[];
  /** Modifier signals that overlap the slice; listed, never counted. */
  modifierIds: string[];
  /** For each kept signal, the other rules that reported the same fact. */
  alsoReportedBy: Record<string, string[]>;
  /** How much of the slice each signal covers, 0 to 1. */
  overlaps: Record<string, number>;
  /** Bound rules of this tradition for this topic: the coverage behind the reading. */
  boundRules: number;
  conventionsUsed: string[];
}

export interface Deduped {
  kept: Signal[];
  /** kept signal id -> ids of the signals that reported the same fact. */
  alsoReportedBy: Record<string, string[]>;
}

/**
 * Keeps one signal per (tradition, topic, dedupeKey): the one with the larger rule weight,
 * and on a tie the one whose rule id sorts first, so the choice never depends on input order.
 */
export function dedupe(signals: readonly Signal[]): Deduped {
  const groups = new Map<string, Signal[]>();
  for (const s of signals) {
    const k = `${s.tradition}|${s.topic}|${s.dedupeKey}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const kept: Signal[] = [];
  const alsoReportedBy: Record<string, string[]> = {};
  const index = new Map(signals.map((s, i) => [s.id, i]));
  for (const g of groups.values()) {
    const sorted = [...g].sort((a, b) => b.baseStrength - a.baseStrength || (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0) || index.get(a.id)! - index.get(b.id)!);
    const [first, ...rest] = sorted;
    kept.push(first!);
    if (rest.length) alsoReportedBy[first!.id] = rest.map((s) => s.id);
  }
  kept.sort((a, b) => index.get(a.id)! - index.get(b.id)!);
  return { kept, alsoReportedBy };
}

/** The word and note for a set of signals that all overlap one slice. Pure; no slice needed. */
export function wordFor(signals: readonly Signal[]): { word: ReadingWord; note: string | null } {
  const deciding = signals.filter((s) => s.stage !== 'modifier');
  const fav = deciding.filter((s) => s.direction === 'favourable');
  const unf = deciding.filter((s) => s.direction === 'unfavourable');
  const mixed = deciding.filter((s) => s.direction === 'mixed');
  if (fav.length + unf.length + mixed.length === 0) {
    // Only activating or modifier signals: the topic is touched but no rule gives a sign.
    return signals.length > 0 ? { word: 'nothing-said', note: NOTE.topicActive } : { word: 'nothing-said', note: null };
  }
  if (fav.length > 0 && unf.length > 0) {
    const stagesOf = (xs: Signal[]): Set<Stage> => new Set(xs.map((s) => s.stage));
    const f = stagesOf(fav);
    const u = stagesOf(unf);
    const sameStage = [...f].some((st) => u.has(st));
    return { word: 'mixed', note: sameStage ? NOTE.rulesConflict : supportsFromCautionsFrom([...f], [...u]) };
  }
  if (mixed.length > 0) return { word: 'mixed', note: NOTE.ruleStatesMixed };
  return { word: fav.length > 0 ? 'supports' : 'cautions', note: null };
}

/** The counts behind a word: the deciding statements (modifiers excluded) by what their own rule says. */
export function tallyOf(signals: readonly Signal[]): Tally {
  const t: Tally = { supports: 0, cautions: 0, mixed: 0, active: 0 };
  for (const s of signals) {
    if (s.stage === 'modifier') continue;
    if (s.direction === 'favourable') t.supports++;
    else if (s.direction === 'unfavourable') t.cautions++;
    else if (s.direction === 'mixed') t.mixed++;
    else t.active++;
  }
  return t;
}

export interface ReadingContext {
  /** bound-rule count per tradition and topic */
  coverage: Record<Tradition, Record<Topic, number>>;
  traditions: readonly Tradition[];
  topics: readonly Topic[];
}

const unique = <T>(xs: T[]): T[] => [...new Set(xs)];

/**
 * A reading for every enabled tradition, topic and slice (group null), and one for every
 * independence group that has a signal for that tradition and topic. Natal (undated)
 * signals never enter a slice.
 */
export function buildReadings(signals: readonly Signal[], slices: readonly Slice[], rc: ReadingContext): Reading[] {
  const { kept, alsoReportedBy } = dedupe(signals);
  const out: Reading[] = [];
  for (const tradition of TRADITIONS) {
    if (!rc.traditions.includes(tradition)) continue;
    for (const topic of rc.topics) {
      const mine = kept.filter((s) => s.tradition === tradition && s.topic === topic);
      const groups = unique(mine.filter((s) => s.startUtcMs !== null).map((s) => s.clockGroup));
      const views: Array<ClockGroupId | null> = [null, ...groups];
      for (const group of views) {
        const pool = group === null ? mine : mine.filter((s) => s.clockGroup === group);
        for (const slice of slices) {
          const inSlice = pool.filter((s) => overlaps(s, slice.startUtcMs, slice.endUtcMs));
          const { word, note } = wordFor(inSlice);
          const tally = tallyOf(inSlice);
          const deciding = inSlice.filter((s) => s.stage !== 'modifier');
          const signalIds = deciding.map((s) => s.id);
          const ov: Record<string, number> = {};
          for (const s of inSlice) ov[s.id] = overlapFraction(s, slice.startUtcMs, slice.endUtcMs);
          const also: Record<string, string[]> = {};
          for (const s of inSlice) if (alsoReportedBy[s.id]) also[s.id] = alsoReportedBy[s.id]!;
          out.push({
            tradition,
            group,
            topic,
            slice: slice.index,
            word,
            note,
            tally,
            signalIds,
            modifierIds: inSlice.filter((s) => s.stage === 'modifier').map((s) => s.id),
            alsoReportedBy: also,
            overlaps: ov,
            boundRules: rc.coverage[tradition][topic],
            conventionsUsed: unique(inSlice.flatMap((s) => s.conventionsUsed)),
          });
        }
      }
    }
  }
  return out;
}

/** Attaches to each non-modifier signal the modifier signals of its tradition and topic that overlap it in time. */
export function attachModifiers(signals: Signal[]): void {
  const mods = signals.filter((s) => s.stage === 'modifier' && s.startUtcMs !== null);
  for (const s of signals) {
    if (s.stage === 'modifier' || s.startUtcMs === null) continue;
    s.modifiedBy = mods
      .filter((m) => m.tradition === s.tradition && m.topic === s.topic && overlaps(m, s.startUtcMs!, Math.max(s.endUtcMs!, s.startUtcMs! + 1)))
      .map((m) => m.id);
  }
}

/** What one technique says about one topic in one slice: the same word rule and the same counts as a tradition reading. */
export interface LevelReading {
  level: LevelId;
  topic: Topic;
  slice: number;
  word: ReadingWord;
  note: string | null;
  tally: Tally;
  signalIds: string[];
  modifierIds: string[];
}

/**
 * A reading for every level that has a dated statement for the topic, in every slice. The
 * statements are de-duplicated first, exactly as for the tradition readings, so a fact two
 * rules report counts once.
 */
export function buildLevelReadings(signals: readonly Signal[], slices: readonly Slice[], topics: readonly Topic[]): LevelReading[] {
  const { kept } = dedupe(signals);
  const out: LevelReading[] = [];
  for (const topic of topics) {
    const mine = kept.filter((s) => s.topic === topic && s.startUtcMs !== null);
    const levels = unique(mine.map((s) => s.level));
    for (const level of levels) {
      const pool = mine.filter((s) => s.level === level);
      for (const slice of slices) {
        const inSlice = pool.filter((s) => overlaps(s, slice.startUtcMs, slice.endUtcMs));
        const { word, note } = wordFor(inSlice);
        out.push({
          level,
          topic,
          slice: slice.index,
          word,
          note,
          tally: tallyOf(inSlice),
          signalIds: inSlice.filter((s) => s.stage !== 'modifier').map((s) => s.id),
          modifierIds: inSlice.filter((s) => s.stage === 'modifier').map((s) => s.id),
        });
      }
    }
  }
  return out;
}
