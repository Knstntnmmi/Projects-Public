// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The relations BaZi reads between its characters: clashes, combinations, the three
 * harmony groups, the main qi of a branch, the void pair of a ten-day cycle, the twelve
 * stages, the seasonal state of an element and which elements the day master favours.
 *
 * Every table here is also stated in the rule file (data/rules.bazi.json, "tables"); the
 * tests compare the two, so a slip in either shows. Where schools differ the difference is
 * a named parameter and never a hidden default.
 */
import { BRANCHES, STEMS, type Element } from './tables.ts';

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

/** The generating cycle: each element makes the next. */
export const ELEMENT_ORDER: readonly Element[] = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

export const elementIndex = (e: Element): number => ELEMENT_ORDER.indexOf(e);

/** The element a given element makes. */
export const generatedBy = (e: Element): Element => ELEMENT_ORDER[(elementIndex(e) + 1) % 5]!;

/** The element a given element overcomes (wood earth, earth water, water fire, fire metal, metal wood). */
export const overcomeBy = (e: Element): Element => ELEMENT_ORDER[(elementIndex(e) + 2) % 5]!;

/** The five kinds of kin a stem or branch element can be to the day master. */
export type Kin = 'peer' | 'output' | 'wealth' | 'officer' | 'resource';

export const KIN_ORDER: readonly Kin[] = ['peer', 'output', 'wealth', 'officer', 'resource'];

/** The kin names as the sources print them: 比劫, 食傷, 財, 官殺, 印. */
export const KIN_HANZI: Readonly<Record<Kin, string>> = { peer: '比劫', output: '食傷', wealth: '財', officer: '官殺', resource: '印' };

/** What an element is to the day master's element, counted along the generating cycle. */
export function kinOf(dayMaster: Element, other: Element): Kin {
  return KIN_ORDER[(elementIndex(other) - elementIndex(dayMaster) + 5) % 5]!;
}

/** The element a kin of the day master has. */
export function elementOfKin(dayMaster: Element, kin: Kin): Element {
  return ELEMENT_ORDER[(elementIndex(dayMaster) + KIN_ORDER.indexOf(kin)) % 5]!;
}

// ---------------------------------------------------------------------------
// Clashes, combinations, harmony groups
// ---------------------------------------------------------------------------

/** 子午 丑未 寅申 卯酉 辰戌 巳亥: branches six apart. */
export const SIX_CLASHES: readonly (readonly [number, number])[] = [0, 1, 2, 3, 4, 5].map((i) => [i, i + 6] as const);

/** The branch that clashes with a branch. */
export const clashOf = (branch: number): number => (branch + 6) % 12;

/** 子丑 寅亥 卯戌 辰酉 巳申 午未. Pairs only; what a pair turns into is held back in the rule file. */
export const SIX_COMBINATIONS: readonly (readonly [number, number])[] = [
  [0, 1],
  [2, 11],
  [3, 10],
  [4, 9],
  [5, 8],
  [6, 7],
];

/** The branch a branch combines with. */
export function combinationOf(branch: number): number {
  for (const [a, b] of SIX_COMBINATIONS) {
    if (branch === a) return b;
    if (branch === b) return a;
  }
  throw new RangeError(`no such branch: ${branch}`);
}

export interface HarmonyGroup {
  /** Branch indices in the order the source names them. */
  branches: readonly [number, number, number];
  element: Element;
}

/** 申子辰 水, 亥卯未 木, 寅午戌 火, 巳酉丑 金. A group missing one character does not transform. */
export const THREE_HARMONY: readonly HarmonyGroup[] = [
  { branches: [8, 0, 4], element: 'Water' },
  { branches: [11, 3, 7], element: 'Wood' },
  { branches: [2, 6, 10], element: 'Fire' },
  { branches: [5, 9, 1], element: 'Metal' },
];

/** The three-harmony group a branch belongs to; every branch belongs to exactly one. */
export function harmonyGroupOf(branch: number): HarmonyGroup {
  return THREE_HARMONY.find((g) => g.branches.includes(branch))!;
}

/** The stem and branch pairs that combine in the stems: 甲己 乙庚 丙辛 丁壬 戊癸. */
export const STEM_COMBINATIONS: readonly (readonly [number, number])[] = [0, 1, 2, 3, 4].map((i) => [i, i + 5] as const);

export const stemsCombine = (a: number, b: number): boolean => STEM_COMBINATIONS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));

// ---------------------------------------------------------------------------
// Hidden stems and void branches
// ---------------------------------------------------------------------------

/**
 * The main qi of a branch, as a stem index: the first of the engine's hidden stems. The
 * verse order of the source is not main-qi order, so nothing here reads the verse.
 */
export const mainQi = (branch: number): number => BRANCHES[branch]!.hidden[0]!;

/**
 * The two branches that stand empty (空亡) in the ten-day cycle (旬) a sexagenary index
 * belongs to: 甲子旬 戌亥, 甲戌旬 申酉, 甲申旬 午未, 甲午旬 辰巳, 甲辰旬 寅卯, 甲寅旬 子丑.
 */
export function voidBranches(sixtyIndex: number): readonly [number, number] {
  const xun = Math.floor((((sixtyIndex % 60) + 60) % 60) / 10);
  const first = (((10 - 2 * xun) % 12) + 12) % 12;
  return [first, (first + 1) % 12];
}

// ---------------------------------------------------------------------------
// The twelve stages
// ---------------------------------------------------------------------------

/** 長生, 沐浴, 冠帶, 臨官, 帝旺, 衰, 病, 死, 墓, 絕, 胎, 養. */
export const TWELVE_STAGES = ['長生', '沐浴', '冠帶', '臨官', '帝旺', '衰', '病', '死', '墓', '絕', '胎', '養'] as const;
export type StageName = (typeof TWELVE_STAGES)[number];

/** The source's own classes: 四貴 (胎 生 旺 庫), 四忌 (死 絕 病 敗), the rest 四平. */
export type StageClass = '四貴' | '四忌' | '四平';

const STAGE_CLASS: Readonly<Record<StageName, StageClass>> = {
  長生: '四貴',
  沐浴: '四忌',
  冠帶: '四平',
  臨官: '四平',
  帝旺: '四貴',
  衰: '四平',
  病: '四忌',
  死: '四忌',
  墓: '四貴',
  絕: '四忌',
  胎: '四貴',
  養: '四平',
};

/**
 * Which element 戊 and 己 follow. The schools differ and the source gives both: earth follows
 * fire (戊 寅, 己 酉) or earth follows water (戊 申, 己 卯). A named convention.
 */
export type EarthStageSchool = 'fire-earth' | 'water-earth';

/** The branch of 長生 for each stem, 甲 to 癸; the two earth stems follow the school. */
export function changSheng(stem: number, school: EarthStageSchool): number {
  const table: readonly number[] = [
    11, // 甲 亥
    6, // 乙 午
    2, // 丙 寅
    9, // 丁 酉
    school === 'fire-earth' ? 2 : 8, // 戊 寅 or 申
    school === 'fire-earth' ? 9 : 3, // 己 酉 or 卯
    5, // 庚 巳
    0, // 辛 子
    8, // 壬 申
    3, // 癸 卯
  ];
  return table[stem]!;
}

export interface TwelveStageOptions {
  school: EarthStageSchool;
  /** Whether the five yin stems run the stages backward. A convention; it is not seen in the text. */
  yinReverse: boolean;
}

export interface StageOfStem {
  /** 0 (長生) to 11 (養). */
  index: number;
  name: StageName;
  class: StageClass;
}

/** The stage a stem is in, in a branch. Yang stems run forward from 長生; yin stems backward if the convention says. */
export function twelveStage(stem: number, branch: number, options: TwelveStageOptions): StageOfStem {
  const start = changSheng(stem, options.school);
  const reverse = STEMS[stem]!.polarity === 'Yin' && options.yinReverse;
  const index = reverse ? (((start - branch) % 12) + 12) % 12 : (((branch - start) % 12) + 12) % 12;
  const name = TWELVE_STAGES[index]!;
  return { index, name, class: STAGE_CLASS[name] };
}

/** The branch in which a stem stands at a given stage; the inverse of twelveStage. */
export function branchAtStage(stem: number, stage: StageName, options: TwelveStageOptions): number {
  for (const b of BRANCHES) if (twelveStage(stem, b.index, options).name === stage) return b.index;
  throw new RangeError(`no branch for stage ${stage}`);
}

// ---------------------------------------------------------------------------
// Seasonal state
// ---------------------------------------------------------------------------

/** 旺 相 休 囚 死 (三命通會 卷二). */
export type SeasonalState = '旺' | '相' | '休' | '囚' | '死';

/**
 * The state of an element in a month, from the element of the month branch. The same
 * element is 旺; if the month element makes it, 相; if it makes the month element, 休; if it
 * overcomes the month element, 囚; if the month element overcomes it, 死. Earth is 旺 in all
 * four 季月 (辰戌丑未), which follows from those branches being earth; the source itself
 * states only the sixth month.
 */
export function seasonalState(element: Element, monthBranch: number): SeasonalState {
  const m = BRANCHES[monthBranch]!.element;
  const step = (elementIndex(m) - elementIndex(element) + 5) % 5;
  return (['旺', '休', '囚', '死', '相'] as const)[step]!;
}

/** The first two states are 得令 (in season); the other three 失令. */
export const inSeason = (state: SeasonalState): boolean => state === '旺' || state === '相';

// ---------------------------------------------------------------------------
// Strength class and the favourable elements
// ---------------------------------------------------------------------------

export type StrengthClass = 'strong' | 'weak' | 'balanced';

export interface Favourites {
  strengthClass: StrengthClass;
  favourable: readonly Element[];
  unfavourable: readonly Element[];
}

/**
 * Favourable and unfavourable elements by balance (扶抑). A strong day master favours what
 * drains it (食傷, 財, 官殺) and dislikes 印 and 比劫; a weak one the reverse. A balanced chart
 * has no favourite and no dislike: both sets are empty and fav() is 0 for every element.
 */
export function favourites(dayMaster: Element, strengthClass: StrengthClass): Favourites {
  const of = (kins: readonly Kin[]): Element[] => kins.map((k) => elementOfKin(dayMaster, k));
  if (strengthClass === 'strong') return { strengthClass, favourable: of(['output', 'wealth', 'officer']), unfavourable: of(['peer', 'resource']) };
  if (strengthClass === 'weak') return { strengthClass, favourable: of(['peer', 'resource']), unfavourable: of(['output', 'wealth', 'officer']) };
  return { strengthClass, favourable: [], unfavourable: [] };
}

/** +1 if the element is favourable, -1 if unfavourable, 0 otherwise (always 0 for a balanced chart). */
export function fav(f: Favourites, element: Element): -1 | 0 | 1 {
  if (f.favourable.includes(element)) return 1;
  if (f.unfavourable.includes(element)) return -1;
  return 0;
}

// ---------------------------------------------------------------------------
// Palaces
// ---------------------------------------------------------------------------

export type PillarName = 'year' | 'month' | 'day' | 'hour';
export const PILLAR_NAMES: readonly PillarName[] = ['year', 'month', 'day', 'hour'];

/**
 * What each pillar stands for. Only year = ancestors, month = parents, day branch = spouse
 * and hour = children are attested in the sources; the topic routing in the rule file's
 * pillar-palaces table is a later convention and is kept out of this table.
 */
export const PILLAR_PALACES: Readonly<Record<PillarName, string>> = {
  year: 'ancestors',
  month: 'parents',
  day: 'spouse',
  hour: 'children',
};
