// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
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

/**
 * The twelve day officers of the jianchu cycle (建除十二神); scholars call them day labels.
 * "Level" and "Shut" are the renderings on which Harkness (2019, table 1) and Ho (2003,
 * p. 30) agree; the other ten are kept as they were.
 */
export const DAY_OFFICERS = [
  ['建', 'Jian', 'Establish'], ['除', 'Chu', 'Remove'], ['滿', 'Man', 'Full'], ['平', 'Ping', 'Level'], ['定', 'Ding', 'Settle'], ['執', 'Zhi', 'Hold'],
  ['破', 'Po', 'Break'], ['危', 'Wei', 'Danger'], ['成', 'Cheng', 'Complete'], ['收', 'Shou', 'Receive'], ['開', 'Kai', 'Open'], ['閉', 'Bi', 'Shut'],
] as const;

/** The officer of a day: "Establish" falls where the day's branch equals the month's. */
export function dayOfficer(dayBranch: number, monthBranch: number): { hanzi: string; pinyin: string; english: string } {
  const [hanzi, pinyin, english] = DAY_OFFICERS[(((dayBranch - monthBranch) % 12) + 12) % 12]!;
  return { hanzi, pinyin, english };
}

/** The twenty-eight lodges (xiu) in their day-cycle order, beginning with Jiao. */
export const MANSIONS = [
  '角', '亢', '氐', '房', '心', '尾', '箕', '斗', '牛', '女', '虛', '危', '室', '壁',
  '奎', '婁', '胃', '昴', '畢', '觜', '參', '井', '鬼', '柳', '星', '張', '翼', '軫',
] as const;

const LODGE_PINYIN = [
  'Jiao', 'Kang', 'Di', 'Fang', 'Xin', 'Wei', 'Ji', 'Dou', 'Niu', 'Nu', 'Xu', 'Wei', 'Shi', 'Bi',
  'Kui', 'Lou', 'Wei', 'Mao', 'Bi', 'Zui', 'Shen', 'Jing', 'Gui', 'Liu', 'Xing', 'Zhang', 'Yi', 'Zhen',
] as const;

/**
 * The lodge (xiu) that labels a day in the almanac's continuous twenty-eight-day cycle.
 * This is a day count locked to the week (Jiao always falls on a Thursday); it says
 * nothing about where the Moon actually is.
 */
export function mansionOfDay(jdn: number): { index: number; hanzi: string; pinyin: string } {
  const index = (((jdn + 11) % 28) + 28) % 28;
  return { index, hanzi: MANSIONS[index]!, pinyin: LODGE_PINYIN[index]! };
}

/**
 * The nine stars (zibai) of the flying-star and Nine Star Ki year count, which run through
 * the nine palaces (jiugong). Ho (2003) prints the third as "3 blue-green".
 */
export const NINE_STARS = [
  ['一白', 'Yi Bai', 'One White', 'Water'], ['二黑', 'Er Hei', 'Two Black', 'Earth'], ['三碧', 'San Bi', 'Three Blue-Green', 'Wood'],
  ['四綠', 'Si Lu', 'Four Green', 'Wood'], ['五黃', 'Wu Huang', 'Five Yellow', 'Earth'], ['六白', 'Liu Bai', 'Six White', 'Metal'],
  ['七赤', 'Qi Chi', 'Seven Red', 'Metal'], ['八白', 'Ba Bai', 'Eight White', 'Earth'], ['九紫', 'Jiu Zi', 'Nine Purple', 'Fire'],
] as const;

/** The star ruling a Lichun-to-Lichun year; the stars run backwards through the years. */
export function nineStarOfYear(cycleYear: number): { number: number; hanzi: string; pinyin: string; english: string; element: string } {
  const number = ((((11 - cycleYear) % 9) + 9 - 1) % 9) + 1;
  const [hanzi, pinyin, english, element] = NINE_STARS[number - 1]!;
  return { number, hanzi, pinyin, english, element };
}
