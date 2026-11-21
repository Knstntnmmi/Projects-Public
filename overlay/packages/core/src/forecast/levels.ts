// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Levels: the technique a practitioner would name (the luck pillar, the mahadasha, Saturn
 * counted from the Moon), which is what a reader is shown instead of a clock. A level
 * follows from the tradition and the clock a firing runs on; where one clock carries two
 * nested periods the binding that knows which one it judged sets `Firing.level`.
 */
import { CLOCKS } from './clocks.ts';
import type { ClockId, Firing, LevelId, RuleBinding, Tradition } from './types.ts';
import { LEVEL_IDS } from './types.ts';

interface LevelSpec {
  tradition: Tradition;
  clocks: readonly ClockId[];
}

/** Every level except 'natal', with the clocks it runs on. Order is the order a reader meets them in. */
const SPECS: Readonly<Record<Exclude<LevelId, 'natal'>, LevelSpec>> = {
  'bazi-luck': { tradition: 'bazi', clocks: ['luck'] },
  'bazi-year': { tradition: 'bazi', clocks: ['solar-longitude', 'calendar-year'] },
  'vedic-maha': { tradition: 'vedic', clocks: ['dasha'] },
  'vedic-antar': { tradition: 'vedic', clocks: ['dasha'] },
  'saturn-moon': { tradition: 'vedic', clocks: ['saturn-sidereal'] },
  'jupiter-moon': { tradition: 'vedic', clocks: ['jupiter-sidereal'] },
  'western-profection': { tradition: 'western', clocks: ['birthday'] },
  'western-firdaria': { tradition: 'western', clocks: ['birthday'] },
  'western-solar-return': { tradition: 'western', clocks: ['birthday'] },
  'western-transits': { tradition: 'western', clocks: ['birthday', 'jupiter-tropical', 'saturn-tropical', 'moon', 'mars', 'venus', 'mercury', 'node'] },
  'iching-period': { tradition: 'iching', clocks: ['solar-longitude', 'calendar-year'] },
};

/**
 * The level for a clock a tradition has no named technique on. Only invented rules ever
 * land here; it is the tradition's outermost level, so that nothing is left without one.
 */
const FALLBACK: Readonly<Record<Tradition, Exclude<LevelId, 'natal'>>> = {
  bazi: 'bazi-year',
  vedic: 'vedic-maha',
  western: 'western-transits',
  iching: 'iching-period',
};

/** Levels in the order the year summary names them: the dated levels of every tradition, then nothing else. */
export const DATED_LEVELS: readonly LevelId[] = LEVEL_IDS.filter((l) => l !== 'natal');

export const levelTradition = (level: LevelId): Tradition | null => (level === 'natal' ? null : SPECS[level].tradition);

/** True for a technique that runs only on clocks of fixed arithmetic from the birth moment (the luck pillar, the dashas, the profections, the firdaria): they share one clock. */
export const levelOnSharedClock = (level: LevelId): boolean => level !== 'natal' && SPECS[level].clocks.every((c) => CLOCKS[c].kind === 'birth-arithmetic');

export const levelRank = (level: LevelId): number => LEVEL_IDS.indexOf(level);

/** The levels that run on one clock in one tradition, outermost first. */
function candidates(tradition: Tradition, clock: ClockId): LevelId[] {
  return DATED_LEVELS.filter((l) => levelTradition(l) === tradition && SPECS[l as Exclude<LevelId, 'natal'>].clocks.includes(clock));
}

/** True when the binding must say which period it judged, because the clock carries more than one. */
export function levelNeedsField(tradition: Tradition, clock: ClockId): boolean {
  return candidates(tradition, clock).length > 1;
}

/** True when `level` may be set on a firing of this tradition on this clock. */
export function levelFits(level: LevelId, tradition: Tradition, clock: ClockId): boolean {
  return level !== 'natal' && candidates(tradition, clock).includes(level);
}

/**
 * The level of one firing. An undated firing is the chart itself and is 'natal'. A dated one
 * takes the level its binding set; without one, the outermost level of its tradition and clock.
 */
export function levelOfFiring(tradition: Tradition, f: Pick<Firing, 'clock' | 'level' | 'startUtcMs'>): LevelId {
  if (f.startUtcMs === null) return 'natal';
  if (f.level !== undefined) return f.level;
  return candidates(tradition, f.clock)[0] ?? FALLBACK[tradition];
}

/**
 * Attaches to each binding the levels its rule can speak at, from a table of the tradition's
 * module. A binding without a row, or a row without a binding, is an error, so that a new rule
 * cannot be added without saying where it is read.
 */
export function declareLevels(bindings: readonly RuleBinding[], table: Readonly<Record<string, readonly LevelId[]>>): RuleBinding[] {
  const ids = new Set(bindings.map((b) => b.ruleId));
  const stale = Object.keys(table).filter((id) => !ids.has(id));
  if (stale.length) throw new Error(`levels declared for rules that are not bound: ${stale.join(', ')}`);
  return bindings.map((b) => {
    const levels = table[b.ruleId];
    if (levels === undefined) throw new Error(`${b.ruleId}: the binding declares no levels (add it to the table of its module)`);
    return { ...b, levels };
  });
}
