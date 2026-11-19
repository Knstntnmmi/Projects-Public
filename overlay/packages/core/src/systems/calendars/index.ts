// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Small day-count systems: everything here is arithmetic on the Julian Day Number, or
 * on a pillar that has already been computed.
 */
import type { Conventions } from '../../conventions.ts';

// --- Maya -----------------------------------------------------------------

export const TZOLKIN_NAMES = [
  'Imix', 'Ik', 'Akbal', 'Kan', 'Chicchan', 'Cimi', 'Manik', 'Lamat', 'Muluc', 'Oc',
  'Chuen', 'Eb', 'Ben', 'Ix', 'Men', 'Cib', 'Caban', 'Etznab', 'Cauac', 'Ahau',
] as const;

export const HAAB_MONTHS = [
  'Pop', 'Wo', 'Sip', 'Sotz', 'Sek', 'Xul', 'Yaxkin', 'Mol', 'Chen', 'Yax',
  'Sak', 'Keh', 'Mak', 'Kankin', 'Muwan', 'Pax', 'Kayab', 'Kumku', 'Wayeb',
] as const;

export interface MayaDate {
  longCount: [number, number, number, number, number];
  longCountText: string;
  tzolkin: { number: number; name: string };
  haab: { day: number; month: string };
  text: string;
}

export function mayaDate(jdn: number, correlation: Conventions['mayaCorrelation']): MayaDate {
  const d = jdn - correlation;
  const mod = (a: number, n: number): number => ((a % n) + n) % n;
  const baktun = Math.floor(d / 144000);
  const katun = Math.floor(mod(d, 144000) / 7200);
  const tun = Math.floor(mod(d, 7200) / 360);
  const uinal = Math.floor(mod(d, 360) / 20);
  const kin = mod(d, 20);
  const tzNumber = mod(d + 3, 13) + 1;
  const tzName = TZOLKIN_NAMES[mod(d + 19, 20)]!;
  const haabDay = mod(d + 348, 365);
  const haab = { day: haabDay % 20, month: HAAB_MONTHS[Math.floor(haabDay / 20)]! };
  const longCount: MayaDate['longCount'] = [baktun, katun, tun, uinal, kin];
  return {
    longCount,
    longCountText: longCount.join('.'),
    tzolkin: { number: tzNumber, name: tzName },
    haab,
    text: `${longCount.join('.')}  ${tzNumber} ${tzName}  ${haab.day} ${haab.month}`,
  };
}

// --- Week -------------------------------------------------------------------

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export function weekday(jdn: number): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[((jdn % 7) + 7) % 7]!;
}

// --- Chinese almanac day cycles ----------------------------------------------

/** The twelve day officers (建除十二神). */
export const DAY_OFFICERS = [
  ['建', 'Establish'], ['除', 'Remove'], ['滿', 'Full'], ['平', 'Balance'], ['定', 'Settle'], ['執', 'Hold'],
  ['破', 'Break'], ['危', 'Danger'], ['成', 'Complete'], ['收', 'Receive'], ['開', 'Open'], ['閉', 'Close'],
] as const;

/** The officer of a day: "Establish" falls where the day's branch equals the month's. */
export function dayOfficer(dayBranch: number, monthBranch: number): { hanzi: string; english: string } {
  const [hanzi, english] = DAY_OFFICERS[(((dayBranch - monthBranch) % 12) + 12) % 12]!;
  return { hanzi, english };
}

/** The twenty-eight lunar mansions in their day-cycle order, beginning with Jiao. */
export const MANSIONS = [
  '角', '亢', '氐', '房', '心', '尾', '箕', '斗', '牛', '女', '虛', '危', '室', '壁',
  '奎', '婁', '胃', '昴', '畢', '觜', '參', '井', '鬼', '柳', '星', '張', '翼', '軫',
] as const;

/**
 * The mansion that labels a day in the almanac's continuous twenty-eight-day cycle.
 * This is a day count locked to the week (Jiao always falls on a Thursday); it says
 * nothing about where the Moon actually is.
 */
export function mansionOfDay(jdn: number): { index: number; hanzi: string } {
  const index = (((jdn + 11) % 28) + 28) % 28;
  return { index, hanzi: MANSIONS[index]! };
}

/** The nine stars of the flying-star and Nine Star Ki year count. */
export const NINE_STARS = [
  ['一白', 'One White', 'Water'], ['二黑', 'Two Black', 'Earth'], ['三碧', 'Three Jade', 'Wood'],
  ['四綠', 'Four Green', 'Wood'], ['五黃', 'Five Yellow', 'Earth'], ['六白', 'Six White', 'Metal'],
  ['七赤', 'Seven Red', 'Metal'], ['八白', 'Eight White', 'Earth'], ['九紫', 'Nine Purple', 'Fire'],
] as const;

/** The star ruling a Lichun-to-Lichun year; the stars run backwards through the years. */
export function nineStarOfYear(cycleYear: number): { number: number; hanzi: string; english: string; element: string } {
  const number = ((((11 - cycleYear) % 9) + 9 - 1) % 9) + 1;
  const [hanzi, english, element] = NINE_STARS[number - 1]!;
  return { number, hanzi, english, element };
}
