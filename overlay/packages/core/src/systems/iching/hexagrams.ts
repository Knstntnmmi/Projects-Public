// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The sixty-four hexagrams as structure only: King Wen number, name and the six lines.
 * Lines are held bottom to top, 1 for a solid (yang) line and 0 for a broken (yin) one.
 * The English glosses are this project's own short literal renderings, not quotations
 * from any translation.
 */

export interface Trigram {
  hanzi: string;
  pinyin: string;
  image: string;
  /** Bottom to top. */
  lines: readonly [number, number, number];
}

export const TRIGRAMS = {
  乾: { hanzi: '乾', pinyin: 'Qian', image: 'Heaven', lines: [1, 1, 1] },
  兌: { hanzi: '兌', pinyin: 'Dui', image: 'Lake', lines: [1, 1, 0] },
  離: { hanzi: '離', pinyin: 'Li', image: 'Fire', lines: [1, 0, 1] },
  震: { hanzi: '震', pinyin: 'Zhen', image: 'Thunder', lines: [1, 0, 0] },
  巽: { hanzi: '巽', pinyin: 'Xun', image: 'Wind', lines: [0, 1, 1] },
  坎: { hanzi: '坎', pinyin: 'Kan', image: 'Water', lines: [0, 1, 0] },
  艮: { hanzi: '艮', pinyin: 'Gen', image: 'Mountain', lines: [0, 0, 1] },
  坤: { hanzi: '坤', pinyin: 'Kun', image: 'Earth', lines: [0, 0, 0] },
} as const satisfies Record<string, Trigram>;

export type TrigramName = keyof typeof TRIGRAMS;

export interface Hexagram {
  /** King Wen number, 1 to 64. */
  number: number;
  hanzi: string;
  pinyin: string;
  gloss: string;
  upper: TrigramName;
  lower: TrigramName;
  /** Six lines, bottom to top. */
  lines: readonly number[];
  /** The lines read as a binary number with the bottom line most significant (0 to 63). */
  value: number;
  /** The Unicode hexagram symbol. */
  symbol: string;
}

// [hanzi, pinyin, gloss, upper trigram, lower trigram], in King Wen order.
const RAW: ReadonlyArray<readonly [string, string, string, TrigramName, TrigramName]> = [
  ['乾', 'Qian', 'Heaven', '乾', '乾'],
  ['坤', 'Kun', 'Earth', '坤', '坤'],
  ['屯', 'Zhun', 'Sprouting', '坎', '震'],
  ['蒙', 'Meng', 'Unformed', '艮', '坎'],
  ['需', 'Xu', 'Waiting', '坎', '乾'],
  ['訟', 'Song', 'Dispute', '乾', '坎'],
  ['師', 'Shi', 'The Host', '坤', '坎'],
  ['比', 'Bi', 'Alliance', '坎', '坤'],
  ['小畜', 'Xiao Xu', 'Small Gathering', '巽', '乾'],
  ['履', 'Lu', 'Treading', '乾', '兌'],
  ['泰', 'Tai', 'Flowing', '坤', '乾'],
  ['否', 'Pi', 'Blocked', '乾', '坤'],
  ['同人', 'Tong Ren', 'Fellowship', '乾', '離'],
  ['大有', 'Da You', 'Great Holding', '離', '乾'],
  ['謙', 'Qian', 'Modesty', '坤', '艮'],
  ['豫', 'Yu', 'Readiness', '震', '坤'],
  ['隨', 'Sui', 'Following', '兌', '震'],
  ['蠱', 'Gu', 'Decay', '艮', '巽'],
  ['臨', 'Lin', 'Approach', '坤', '兌'],
  ['觀', 'Guan', 'Viewing', '巽', '坤'],
  ['噬嗑', 'Shi He', 'Biting Through', '離', '震'],
  ['賁', 'Bi', 'Adornment', '艮', '離'],
  ['剝', 'Bo', 'Stripping', '艮', '坤'],
  ['復', 'Fu', 'Return', '坤', '震'],
  ['無妄', 'Wu Wang', 'Without Error', '乾', '震'],
  ['大畜', 'Da Xu', 'Great Gathering', '艮', '乾'],
  ['頤', 'Yi', 'Nourishment', '艮', '震'],
  ['大過', 'Da Guo', 'Great Excess', '兌', '巽'],
  ['坎', 'Kan', 'The Pit', '坎', '坎'],
  ['離', 'Li', 'Clinging Fire', '離', '離'],
  ['咸', 'Xian', 'Mutual Feeling', '兌', '艮'],
  ['恆', 'Heng', 'Constancy', '震', '巽'],
  ['遯', 'Dun', 'Withdrawal', '乾', '艮'],
  ['大壯', 'Da Zhuang', 'Great Strength', '震', '乾'],
  ['晉', 'Jin', 'Advance', '離', '坤'],
  ['明夷', 'Ming Yi', 'Light Wounded', '坤', '離'],
  ['家人', 'Jia Ren', 'Household', '巽', '離'],
  ['睽', 'Kui', 'Divergence', '離', '兌'],
  ['蹇', 'Jian', 'Hardship', '坎', '艮'],
  ['解', 'Xie', 'Release', '震', '坎'],
  ['損', 'Sun', 'Decrease', '艮', '兌'],
  ['益', 'Yi', 'Increase', '巽', '震'],
  ['夬', 'Guai', 'Resolution', '兌', '乾'],
  ['姤', 'Gou', 'Encounter', '乾', '巽'],
  ['萃', 'Cui', 'Assembly', '兌', '坤'],
  ['升', 'Sheng', 'Ascent', '坤', '巽'],
  ['困', 'Kun', 'Confinement', '兌', '坎'],
  ['井', 'Jing', 'The Well', '坎', '巽'],
  ['革', 'Ge', 'Change', '兌', '離'],
  ['鼎', 'Ding', 'The Cauldron', '離', '巽'],
  ['震', 'Zhen', 'Thunder', '震', '震'],
  ['艮', 'Gen', 'Stillness', '艮', '艮'],
  ['漸', 'Jian', 'Gradual Progress', '巽', '艮'],
  ['歸妹', 'Gui Mei', 'Marrying Maiden', '震', '兌'],
  ['豐', 'Feng', 'Abundance', '震', '離'],
  ['旅', 'Lu', 'The Traveller', '離', '艮'],
  ['巽', 'Xun', 'Wind', '巽', '巽'],
  ['兌', 'Dui', 'Lake', '兌', '兌'],
  ['渙', 'Huan', 'Dispersal', '巽', '坎'],
  ['節', 'Jie', 'Limits', '坎', '兌'],
  ['中孚', 'Zhong Fu', 'Inner Truth', '巽', '兌'],
  ['小過', 'Xiao Guo', 'Small Excess', '震', '艮'],
  ['既濟', 'Ji Ji', 'Already Across', '坎', '離'],
  ['未濟', 'Wei Ji', 'Not Yet Across', '離', '坎'],
];

export const HEXAGRAMS: readonly Hexagram[] = RAW.map(([hanzi, pinyin, gloss, upper, lower], i) => {
  const lines: number[] = [...TRIGRAMS[lower].lines, ...TRIGRAMS[upper].lines];
  const value = lines.reduce((acc, bit) => acc * 2 + bit, 0);
  return {
    number: i + 1,
    hanzi,
    pinyin,
    gloss,
    upper,
    lower,
    lines,
    value,
    symbol: String.fromCodePoint(0x4dc0 + i),
  };
});

const BY_VALUE = new Map(HEXAGRAMS.map((h) => [h.value, h]));
const BY_HANZI = new Map(HEXAGRAMS.map((h) => [h.hanzi, h]));

export function hexagram(number: number): Hexagram {
  const h = HEXAGRAMS[number - 1];
  if (!h) throw new Error(`no hexagram numbered ${number}`);
  return h;
}

export function hexagramByValue(value: number): Hexagram {
  const h = BY_VALUE.get(value);
  if (!h) throw new Error(`no hexagram with value ${value}`);
  return h;
}

export function hexagramByName(hanzi: string): Hexagram {
  const h = BY_HANZI.get(hanzi);
  if (!h) throw new Error(`no hexagram named ${hanzi}`);
  return h;
}
