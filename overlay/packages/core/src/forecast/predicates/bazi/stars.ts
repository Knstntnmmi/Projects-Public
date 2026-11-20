// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The table-driven stars: 天乙貴人, 驛馬, 咸池, 羊刃, 祿神 and 空亡. The tables are read from
 * the rule file at load, so the JSON stays the one place they are stated; the tests compare
 * what is read with hand-typed values.
 */
import baziJson from '../../data/rules.bazi.json' with { type: 'json' };
import { BRANCHES, STEMS } from '../../../systems/bazi/index.ts';

const tables = baziJson.tables as unknown as Record<string, any>;

const stemIndex = (c: string): number => {
  const i = STEMS.findIndex((s) => s.hanzi === c);
  if (i < 0) throw new Error(`rule table: ${c} is not a stem`);
  return i;
};
const branchIndex = (c: string): number => {
  const i = BRANCHES.findIndex((b) => b.hanzi === c);
  if (i < 0) throw new Error(`rule table: ${c} is not a branch`);
  return i;
};

/** Day stem to its two noble branches (天乙貴人). */
export const NOBLE: ReadonlyMap<number, readonly number[]> = new Map(
  Object.entries(tables.tianYiGuiRen as Record<string, string>).map(([stem, branches]) => [stemIndex(stem), [...branches].map(branchIndex)]),
);

/** Branch of a three-harmony group to the horse branch (驛馬) of the group. */
const HORSE = groupTable(tables.yiMa as Record<string, string>);
/** Branch of a three-harmony group to the 咸池 branch of the group (the second stage, 沐浴). */
const PEACH = groupTable(tables.xianChiTaoHua as Record<string, string>);

function groupTable(raw: Record<string, string>): ReadonlyMap<number, number> {
  const out = new Map<number, number>();
  for (const [group, target] of Object.entries(raw)) for (const c of group) out.set(branchIndex(c), branchIndex(target));
  return out;
}

/** The post-horse branch of the group a branch belongs to. */
export const horseOf = (branch: number): number => HORSE.get(branch)!;
/** The peach-blossom (咸池) branch of the group a branch belongs to. */
export const peachOf = (branch: number): number => PEACH.get(branch)!;

/** Day stem to its 祿 branch; 戊 and 己 are 寄 in 巳 and 午 as the source says. */
export const LU: ReadonlyMap<number, number> = new Map(Object.entries(tables.luShen as Record<string, string>).map(([s, b]) => [stemIndex(s), branchIndex(b)]));

/** The 羊刃 of the five yang stems (子平 school). The yin stems have none in this school. */
export const BLADE: ReadonlyMap<number, number> = new Map(
  Object.entries(tables.yangRen['yang stems (子平 school)'] as Record<string, string>).map(([s, b]) => [stemIndex(s), branchIndex(b)]),
);

export const noblesOf = (dayStem: number): readonly number[] => NOBLE.get(dayStem)!;
export const luOf = (dayStem: number): number => LU.get(dayStem)!;
export const bladeOf = (dayStem: number): number | null => BLADE.get(dayStem) ?? null;
