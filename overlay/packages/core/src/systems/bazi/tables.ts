// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/** The ten heavenly stems, the twelve earthly branches and the tables hung on them. */

export type Element = 'Wood' | 'Fire' | 'Earth' | 'Metal' | 'Water';
export type Polarity = 'Yang' | 'Yin';

export interface Stem {
  index: number;
  hanzi: string;
  pinyin: string;
  element: Element;
  polarity: Polarity;
}

export interface Branch {
  index: number;
  hanzi: string;
  pinyin: string;
  animal: string;
  element: Element;
  polarity: Polarity;
  /** Hidden stems, principal first, as stem indices. */
  hidden: number[];
}

/**
 * The Five Phases (wuxing). `Element` is only the name of the type; printed text says
 * phase (Ho 2003, p. 14). English usage is not settled (Five Phases, Five
 * Elements and other renderings all occur), so this is a choice of the project's.
 */
const PHASE_NAMES: Record<Element, readonly [string, string]> = {
  Wood: ['木', 'Mu'], Fire: ['火', 'Huo'], Earth: ['土', 'Tu'], Metal: ['金', 'Jin'], Water: ['水', 'Shui'],
};

/** A phase as printed: hanzi and pinyin, then the English. */
export function phaseText(element: Element): string {
  const [hanzi, pinyin] = PHASE_NAMES[element];
  return `${hanzi} ${pinyin} (${element})`;
}

const ELEMENTS: Element[] = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

export const STEMS: readonly Stem[] = (
  [
    ['甲', 'Jia'], ['乙', 'Yi'], ['丙', 'Bing'], ['丁', 'Ding'], ['戊', 'Wu'],
    ['己', 'Ji'], ['庚', 'Geng'], ['辛', 'Xin'], ['壬', 'Ren'], ['癸', 'Gui'],
  ] as const
).map(([hanzi, pinyin], index) => ({
  index,
  hanzi,
  pinyin,
  element: ELEMENTS[Math.floor(index / 2)]!,
  polarity: index % 2 === 0 ? 'Yang' : 'Yin',
}));

// Hidden stems follow the common modern table (principal, middle, residual qi).
export const BRANCHES: readonly Branch[] = (
  [
    ['子', 'Zi', 'Rat', 'Water', [9]],
    ['丑', 'Chou', 'Ox', 'Earth', [5, 9, 7]],
    ['寅', 'Yin', 'Tiger', 'Wood', [0, 2, 4]],
    ['卯', 'Mao', 'Rabbit', 'Wood', [1]],
    ['辰', 'Chen', 'Dragon', 'Earth', [4, 1, 9]],
    ['巳', 'Si', 'Snake', 'Fire', [2, 6, 4]],
    ['午', 'Wu', 'Horse', 'Fire', [3, 5]],
    ['未', 'Wei', 'Goat', 'Earth', [5, 3, 1]],
    ['申', 'Shen', 'Monkey', 'Metal', [6, 8, 4]],
    ['酉', 'You', 'Rooster', 'Metal', [7]],
    ['戌', 'Xu', 'Dog', 'Earth', [4, 7, 3]],
    ['亥', 'Hai', 'Pig', 'Water', [8, 0]],
  ] as const
).map(([hanzi, pinyin, animal, element, hidden], index) => ({
  index,
  hanzi,
  pinyin,
  animal,
  element,
  polarity: index % 2 === 0 ? 'Yang' : 'Yin',
  hidden: [...hidden],
}));

/**
 * The thirty nayin, one per consecutive pair of the sixty-cycle. The English names are
 * this project's own popular glosses, and no scholarly rendering is claimed for them;
 * the earlier gloss "received notes" had no source and is not used.
 */
export const NAYIN: readonly { hanzi: string; english: string; element: Element }[] = [
  { hanzi: '海中金', english: 'Gold in the Sea', element: 'Metal' },
  { hanzi: '爐中火', english: 'Fire in the Furnace', element: 'Fire' },
  { hanzi: '大林木', english: 'Wood of the Great Forest', element: 'Wood' },
  { hanzi: '路旁土', english: 'Earth by the Roadside', element: 'Earth' },
  { hanzi: '劍鋒金', english: 'Metal of the Sword Edge', element: 'Metal' },
  { hanzi: '山頭火', english: 'Fire on the Mountain Top', element: 'Fire' },
  { hanzi: '澗下水', english: 'Water of the Ravine', element: 'Water' },
  { hanzi: '城頭土', english: 'Earth of the City Wall', element: 'Earth' },
  { hanzi: '白蠟金', english: 'White Wax Metal', element: 'Metal' },
  { hanzi: '楊柳木', english: 'Willow Wood', element: 'Wood' },
  { hanzi: '泉中水', english: 'Water of the Spring', element: 'Water' },
  { hanzi: '屋上土', english: 'Earth on the Roof', element: 'Earth' },
  { hanzi: '霹靂火', english: 'Thunderbolt Fire', element: 'Fire' },
  { hanzi: '松柏木', english: 'Pine and Cypress Wood', element: 'Wood' },
  { hanzi: '長流水', english: 'Long Flowing Water', element: 'Water' },
  { hanzi: '沙中金', english: 'Gold in the Sand', element: 'Metal' },
  { hanzi: '山下火', english: 'Fire at the Foot of the Mountain', element: 'Fire' },
  { hanzi: '平地木', english: 'Wood of the Plain', element: 'Wood' },
  { hanzi: '壁上土', english: 'Earth on the Wall', element: 'Earth' },
  { hanzi: '金箔金', english: 'Gold Leaf Metal', element: 'Metal' },
  { hanzi: '覆燈火', english: 'Lamp Fire', element: 'Fire' },
  { hanzi: '天河水', english: 'Water of the Heavenly River', element: 'Water' },
  { hanzi: '大驛土', english: 'Earth of the Great Post Road', element: 'Earth' },
  { hanzi: '釵釧金', english: 'Hairpin Metal', element: 'Metal' },
  { hanzi: '桑柘木', english: 'Mulberry Wood', element: 'Wood' },
  { hanzi: '大溪水', english: 'Water of the Great Stream', element: 'Water' },
  { hanzi: '沙中土', english: 'Earth in the Sand', element: 'Earth' },
  { hanzi: '天上火', english: 'Fire in the Sky', element: 'Fire' },
  { hanzi: '石榴木', english: 'Pomegranate Wood', element: 'Wood' },
  { hanzi: '大海水', english: 'Water of the Great Sea', element: 'Water' },
];

export interface TenGod {
  hanzi: string;
  pinyin: string;
  english: string;
}

// The English names are trade usage. "Ten Gods" is the trade label for the shishen; Ho (2003,
// pp. 156-159) renders shen as "spirit", a state of qi, 食神 as "gourmet spirit" and 傷官
// as "official jinx". "Eating God" and "Hurting Officer" are kept as the trade names, set
// beside Ho's renderings; the other eight names are trade usage or this project's own, and
// no scholarly rendering is claimed for them. Ho's page numbers are folios from a scan.
// Indexed by [relation][samePolarity ? 0 : 1], relation counted along the generating
// cycle from the day master's element: 0 same, 1 generated by me, 2 controlled by me,
// 3 controlling me, 4 generating me.
const TEN_GODS: readonly [TenGod, TenGod][] = [
  [
    { hanzi: '比肩', pinyin: 'Bi Jian', english: 'Friend' },
    { hanzi: '劫財', pinyin: 'Jie Cai', english: 'Rob Wealth' },
  ],
  [
    { hanzi: '食神', pinyin: 'Shi Shen', english: 'Eating God' },
    { hanzi: '傷官', pinyin: 'Shang Guan', english: 'Hurting Officer' },
  ],
  [
    { hanzi: '偏財', pinyin: 'Pian Cai', english: 'Indirect Wealth' },
    { hanzi: '正財', pinyin: 'Zheng Cai', english: 'Direct Wealth' },
  ],
  [
    { hanzi: '七殺', pinyin: 'Qi Sha', english: 'Seven Killings' },
    { hanzi: '正官', pinyin: 'Zheng Guan', english: 'Direct Officer' },
  ],
  [
    { hanzi: '偏印', pinyin: 'Pian Yin', english: 'Indirect Resource' },
    { hanzi: '正印', pinyin: 'Zheng Yin', english: 'Direct Resource' },
  ],
];

/** The ten god that `other` is to the day master. */
export function tenGod(dayMaster: number, other: number): TenGod {
  const me = Math.floor(dayMaster / 2);
  const it = Math.floor(other / 2);
  // Generating cycle order: Wood, Fire, Earth, Metal, Water. Controlling skips one.
  const step = (it - me + 5) % 5;
  const relation = [0, 1, 2, 3, 4][step]!;
  const same = dayMaster % 2 === other % 2;
  return TEN_GODS[relation]![same ? 0 : 1];
}

export interface SixtyCycle {
  /** 0 (Jia Zi) to 59 (Gui Hai). */
  index: number;
  stem: Stem;
  branch: Branch;
  hanzi: string;
  pinyin: string;
  nayin: { hanzi: string; english: string; element: Element };
}

export function sixtyCycle(index: number): SixtyCycle {
  const i = ((index % 60) + 60) % 60;
  const stem = STEMS[i % 10]!;
  const branch = BRANCHES[i % 12]!;
  return {
    index: i,
    stem,
    branch,
    hanzi: stem.hanzi + branch.hanzi,
    pinyin: `${stem.pinyin} ${branch.pinyin}`,
    nayin: NAYIN[Math.floor(i / 2)]!,
  };
}

/** The sixty-cycle index that has the given stem and branch (they must share parity). */
export function sixtyIndex(stem: number, branch: number): number {
  for (let i = stem; i < 60; i += 10) if (i % 12 === branch) return i;
  throw new Error(`stem ${stem} and branch ${branch} never meet`);
}
