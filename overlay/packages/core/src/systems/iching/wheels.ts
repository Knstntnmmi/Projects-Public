// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Hexagram arrangements that have been tied to the year, each expressed as a list of
 * hexagrams in order of increasing solar longitude from a stated starting longitude.
 */
import type { Conventions } from '../../conventions.ts';
import { hexagram, hexagramByName, hexagramByValue, type Hexagram } from './hexagrams.ts';

/**
 * The twelve sovereign hexagrams (十二消息卦, also 辟卦), one per month. Yang lines rise
 * from the bottom from Fu (one yang line, the month containing the winter solstice)
 * to Qian, and then yin lines rise from Gou to Kun. Each governs one branch-month,
 * so on the ecliptic each spans thirty degrees. Which thirty is a convention
 * (`sovereignBoundary`): by default the branch month, from a jie, so that Fu begins at
 * 255; but the table of the Dayan calendar (Xin Tang shu 28A) groups each month's five
 * hexagrams from a zhongqi to the next zhongqi, which puts Fu at 270.
 */
export const SOVEREIGN_START = 255;
export const SOVEREIGN_START_ZHONGQI = 270;

/** Longitude at which Fu, the first sovereign hexagram, begins under the chosen boundary. */
export function sovereignStart(boundary: Conventions['sovereignBoundary']): number {
  return boundary === 'zhongqi' ? SOVEREIGN_START_ZHONGQI : SOVEREIGN_START;
}
export const SOVEREIGN_SEQUENCE: readonly Hexagram[] = ['復', '臨', '泰', '大壯', '夬', '乾', '姤', '遯', '否', '觀', '剝', '坤'].map(
  hexagramByName,
);

/**
 * The gua qi (卦氣) scheme of Meng Xi (孟喜) as Yi Xing adopted it in the Dayan calendar:
 * sixty hexagrams, each ruling six and seven-eightieths days ("six days seven parts"),
 * beginning with Zhong Fu at the winter solstice. Yi Xing argues for it in the essay
 * Gua yi (卦議, Xin Tang shu juan 27A): 當據孟氏，自冬至初，中孚用事, "one should follow
 * Meng, with Zhong Fu in office from the start of the winter solstice". The table is in
 * juan 28A. Jing Fang's allotment differs and is the `jing-fang` convention below. The
 * Yi wei Jilantu is cited here only for beginning the count at Zhong Fu (Sun Jiran 2019).
 * Within each month the five hexagrams hold the ranks of duke, sovereign, marquis, great
 * officer and minister. The remaining four hexagrams (Kan, Zhen, Li, Dui) stand at the
 * cardinal points and rule a season each.
 */
export const GUA_QI_START = 270;
export const GUA_QI_SEQUENCE: readonly Hexagram[] = [
  '中孚', '復', '屯', '謙', '睽', '升', '臨', '小過', '蒙', '益',
  '漸', '泰', '需', '隨', '晉', '解', '大壯', '豫', '訟', '蠱',
  '革', '夬', '旅', '師', '比', '小畜', '乾', '大有', '家人', '井',
  '咸', '姤', '鼎', '豐', '渙', '履', '遯', '恆', '節', '同人',
  '損', '否', '巽', '萃', '大畜', '賁', '觀', '歸妹', '無妄', '明夷',
  '困', '剝', '艮', '既濟', '噬嗑', '大過', '坤', '未濟', '蹇', '頤',
].map(hexagramByName);

/** Rank of the hexagram at each position of the gua qi sequence. */
export const GUA_QI_RANKS = ['公', '辟', '侯', '大夫', '卿'] as const;
export const GUA_QI_RANK_ENGLISH = ['Duke', 'Sovereign', 'Marquis', 'Great Officer', 'Minister'] as const;

/** The four cardinal hexagrams (sizheng gua, 四正卦) and the longitude at which each takes over. */
export const CARDINAL_HEXAGRAMS: readonly { hexagram: Hexagram; start: number; season: string }[] = [
  { hexagram: hexagramByName('坎'), start: 270, season: 'winter' },
  { hexagram: hexagramByName('震'), start: 0, season: 'spring' },
  { hexagram: hexagramByName('離'), start: 90, season: 'summer' },
  { hexagram: hexagramByName('兌'), start: 180, season: 'autumn' },
];

/** The gua qi hexagrams occupy positions 0 to 59; a cardinal period is numbered 60 plus its index in CARDINAL_HEXAGRAMS. */
export const GUA_QI_CARDINAL_POSITION = 60;

/** Rank of a gua qi period by its position, in Chinese and English; the cardinal periods are outside the five ranks. */
export function guaQiRank(position: number): { hanzi: string; english: string } {
  return position >= GUA_QI_CARDINAL_POSITION
    ? { hanzi: '四正', english: 'Cardinal' }
    : { hanzi: GUA_QI_RANKS[position % 5]!, english: GUA_QI_RANK_ENGLISH[position % 5]! };
}

/**
 * Jing Fang's allotment, as Yi Xing reports it in Gua yi (Xin Tang shu 27A):
 * 京氏又以卦爻配期之日，坎、離、震、兌，其用事自分、至之首，皆得八十分日之七十三。
 * 頤、晉、井、大畜，皆五日十四分，餘皆六日七分. "Master Jing also matched the hexagrams and
 * lines to the days of the period: Kan, Li, Zhen and Dui take office at the head of the
 * equinoxes and solstices, each getting 73 eightieths of a day; Yi, Jin, Jing and Da Xu
 * each get five days fourteen parts, and all the rest six days seven parts." Yi Xing
 * rejects the 73-part allotment (其說不經) and the project does not endorse it; it is here
 * so that the two schemes can be set side by side. A day is eighty parts.
 *
 * Yi, Jin, Jing and Da Xu are the last hexagrams of each quarter of the Meng Xi sequence,
 * so each cardinal hexagram opens the quarter after them. The 64 periods then total
 * 4 x 73 + 4 x 414 + 56 x 487 = 29220 parts, which is 365 1/4 days exactly.
 */
export const PARTS_PER_DAY = 80;
export const YEAR_PARTS = 365 * PARTS_PER_DAY + 20;
export const CARDINAL_PARTS = 73;
export const SHORT_HEXAGRAM_PARTS = 5 * PARTS_PER_DAY + 14;
export const HEXAGRAM_PARTS = 6 * PARTS_PER_DAY + 7;

export interface GuaQiAllotment {
  hexagram: Hexagram;
  /** Gua qi position, as numbered above. */
  position: number;
  /** Parts from the winter solstice at which the period opens, and its length. */
  startParts: number;
  parts: number;
}

export const JING_FANG_ALLOTMENTS: readonly GuaQiAllotment[] = (() => {
  const out: GuaQiAllotment[] = [];
  let at = 0;
  const push = (h: Hexagram, position: number, parts: number): void => {
    out.push({ hexagram: h, position, startParts: at, parts });
    at += parts;
  };
  for (let q = 0; q < 4; q++) {
    push(CARDINAL_HEXAGRAMS[q]!.hexagram, GUA_QI_CARDINAL_POSITION + q, CARDINAL_PARTS);
    for (let k = 15 * q; k < 15 * q + 15; k++) push(GUA_QI_SEQUENCE[k]!, k, k % 15 === 14 ? SHORT_HEXAGRAM_PARTS : HEXAGRAM_PARTS);
  }
  return out;
})();

/**
 * The circular Fu Xi arrangement, xiantian (Former Heaven, 先天), attributed to Shao Yong
 * and read here as a year:
 * Fu follows the winter solstice, yang grows up the left side to Qian at the summer
 * solstice, and yin grows down the right side from Gou to Kun. In binary terms (bottom
 * line most significant) the first half counts 32 to 63 and the second 31 down to 0.
 */
export const FUXI_START = 270;
export const FUXI_SEQUENCE: readonly Hexagram[] = Array.from({ length: 64 }, (_, k) =>
  hexagramByValue(k < 32 ? 32 + k : 63 - k),
);

/**
 * The sixty-four-gate ecliptic wheel used by twentieth-century systems that lay the
 * hexagrams on the tropical zodiac. Each gate spans 5 degrees 37 minutes 30 seconds,
 * and each of its six lines 56 minutes 15 seconds; hexagram 41 begins at 2 degrees of
 * Aquarius (longitude 302).
 */
export const GATE_START = 302;
export const GATE_SEQUENCE: readonly Hexagram[] = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
  28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60,
].map(hexagram);

export interface WheelPosition {
  hexagram: Hexagram;
  /** Position in the sequence, from 0. */
  position: number;
  /** Line 1 to 6, counted in the direction of increasing longitude. */
  line: number;
  /** Fraction of the way through the hexagram's arc, 0 to 1. */
  fraction: number;
  /** Longitude at which the hexagram's arc begins and ends. */
  start: number;
  end: number;
}

/** Looks up a longitude on an equal-arc wheel. */
export function wheelPosition(sequence: readonly Hexagram[], startLongitude: number, longitude: number): WheelPosition {
  const arc = 360 / sequence.length;
  const offset = (((longitude - startLongitude) % 360) + 360) % 360;
  const position = Math.min(sequence.length - 1, Math.floor(offset / arc));
  const fraction = offset / arc - position;
  return {
    hexagram: sequence[position]!,
    position,
    line: Math.min(6, Math.floor(fraction * 6) + 1),
    fraction,
    start: (startLongitude + position * arc) % 360,
    end: (startLongitude + (position + 1) * arc) % 360,
  };
}
