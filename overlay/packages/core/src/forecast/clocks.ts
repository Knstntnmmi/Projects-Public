// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Clocks and independence groups (specification, section 5.2). A clock is the set of
 * instants that set its boundaries. All clocks that run by fixed arithmetic from the
 * birth moment form one group, because they cannot disagree about anything but how that
 * arithmetic is cut; each sky clock is a group of its own.
 */
import type { ClockGroupId, ClockId } from './types.ts';

export interface ClockInfo {
  id: ClockId;
  label: string;
  /** 'birth-arithmetic' clocks are one independence group; 'sky' clocks are one each. */
  kind: 'birth-arithmetic' | 'sky';
  /** The body whose motion sets a sky clock; two clocks with one body are different clocks that read one planet. */
  body?: string;
}

// The annual pillar turns on a fixed arithmetic of the Sun's longitude and is the same
// calendar for every birth. It is grouped with the birth clocks on purpose: that merges
// more and so counts less agreement, which is the cautious side, and it is how the
// specification's worked example groups the BaZi year with the luck pillars.
export const CLOCKS: Readonly<Record<ClockId, ClockInfo>> = {
  luck: { id: 'luck', label: 'BaZi luck pillar', kind: 'birth-arithmetic' },
  birthday: { id: 'birthday', label: 'Counted from the birthday', kind: 'birth-arithmetic' },
  dasha: { id: 'dasha', label: 'Dasha', kind: 'birth-arithmetic' },
  'solar-longitude': { id: 'solar-longitude', label: 'Sun\'s longitude (calendar)', kind: 'birth-arithmetic' },
  'calendar-year': { id: 'calendar-year', label: 'Calendar year', kind: 'birth-arithmetic' },
  'jupiter-tropical': { id: 'jupiter-tropical', label: 'Jupiter (tropical signs)', kind: 'sky', body: 'Jupiter' },
  'jupiter-sidereal': { id: 'jupiter-sidereal', label: 'Jupiter (sidereal signs)', kind: 'sky', body: 'Jupiter' },
  'saturn-tropical': { id: 'saturn-tropical', label: 'Saturn (tropical signs)', kind: 'sky', body: 'Saturn' },
  'saturn-sidereal': { id: 'saturn-sidereal', label: 'Saturn (sidereal signs)', kind: 'sky', body: 'Saturn' },
  moon: { id: 'moon', label: 'Moon', kind: 'sky', body: 'Moon' },
  mars: { id: 'mars', label: 'Mars', kind: 'sky', body: 'Mars' },
  venus: { id: 'venus', label: 'Venus', kind: 'sky', body: 'Venus' },
  mercury: { id: 'mercury', label: 'Mercury', kind: 'sky', body: 'Mercury' },
  node: { id: 'node', label: 'Lunar node', kind: 'sky', body: 'Node' },
};

export function isClockId(x: string): x is ClockId {
  return Object.prototype.hasOwnProperty.call(CLOCKS, x);
}

export function clockGroupOf(clock: ClockId): ClockGroupId {
  return CLOCKS[clock].kind === 'birth-arithmetic' ? 'birth-arithmetic' : clock;
}

export function groupLabel(group: ClockGroupId): string {
  return group === 'birth-arithmetic' ? 'clocks counted from the birth moment' : CLOCKS[group].label;
}

/** The body behind a group, if it is a sky clock. */
export function groupBody(group: ClockGroupId): string | null {
  return group === 'birth-arithmetic' ? null : (CLOCKS[group].body ?? null);
}

/** True when two clocks have the same boundary instants as dates. Only a clock equals itself. */
export function sameClock(a: ClockId, b: ClockId): boolean {
  return a === b;
}
