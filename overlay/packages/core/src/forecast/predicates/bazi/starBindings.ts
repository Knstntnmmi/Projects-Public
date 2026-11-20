// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Bindings of the table-driven stars: 空亡, 天乙貴人, 驛馬, 咸池, 羊刃 and 祿神. Each star is a
 * branch the tables name for the day master (or for the year or day branch); the rule flags
 * it where it stands in the natal chart, and where an annual pillar or a luck pillar brings
 * it. The star rules are bound whole, so the period binder must not bind them again.
 */
import { BRANCHES } from '../../../systems/bazi/index.ts';
import { clashOf, PILLAR_NAMES, PILLAR_PALACES, type PillarName } from '../../../systems/bazi/relations.ts';
import type { ForecastContext } from '../../context.ts';
import type { ClockId, Firing, RuleBinding, Topic } from '../../types.ts';
import { kinChars, type NatalAssessment } from './assessment.ts';
import { fact, natalFiring, natalOf } from './natal.ts';
import { bladeOf, horseOf, luOf, noblesOf, peachOf } from './stars.ts';

/** A branch an annual pillar or a luck pillar brings, with the window it stands over. */
interface Incoming {
  branch: number;
  clock: ClockId;
  startUtcMs: number;
  endUtcMs: number;
  kind: 'annual pillar' | 'luck pillar';
}

/** Annual pillars over the span; luck pillars too when a sex convention gives their direction. */
function incomingBranches(ctx: ForecastContext): Incoming[] {
  const out: Incoming[] = ctx.annualPillars().map((p) => ({ branch: p.cycle.branch.index, clock: 'solar-longitude', startUtcMs: p.startUtcMs, endUtcMs: p.endUtcMs, kind: 'annual pillar' }));
  const luck = ctx.luck();
  if (luck) for (const p of luck.pillars) out.push({ branch: p.cycle.branch.index, clock: 'luck', startUtcMs: p.startUtcMs, endUtcMs: p.endUtcMs, kind: 'luck pillar' });
  return out;
}

const natalBranchList = (a: NatalAssessment): number[] => PILLAR_NAMES.map((p) => a.pillars[p].branch.index);

const hanzi = (b: number): string => BRANCHES[b]!.hanzi;

/** Where a star branch stands: the natal pillars that hold it, and the incoming pillars that bring it. */
interface Hit {
  where: 'natal' | 'incoming';
  pillar?: PillarName;
  incoming?: Incoming;
}

function hits(ctx: ForecastContext, a: NatalAssessment, target: number): Hit[] {
  const out: Hit[] = [];
  for (const pillar of PILLAR_NAMES) if (a.pillars[pillar].branch.index === target) out.push({ where: 'natal', pillar });
  for (const incoming of incomingBranches(ctx)) if (incoming.branch === target) out.push({ where: 'incoming', incoming });
  return out;
}

function firingAt(hit: Hit, facts: Firing['facts'], tag: string, rest: Partial<Firing> = {}): Firing {
  const badges = [...(rest.badges ?? []), hit.where === 'natal' ? `natal ${hit.pillar} branch` : hit.incoming!.kind];
  if (hit.where === 'natal') return natalFiring(facts, { ...rest, badges, dedupeInstance: `natal-${hit.pillar}${tag}` });
  const i = hit.incoming!;
  return { clock: i.clock, startUtcMs: i.startUtcMs, endUtcMs: i.endUtcMs, facts, ...rest, badges, dedupeInstance: `${i.startUtcMs}-${i.endUtcMs}${tag}` };
}

/**
 * Natal hits that read the same (one star branch standing in two pillars, say) are one fact
 * said once, with the pillars named in a badge; the sentence template has no slot for them.
 */
function mergeNatal(firings: Firing[]): Firing[] {
  const seen = new Map<string, Firing[]>();
  const out: Firing[] = [];
  for (const f of firings) {
    const natal = f.startUtcMs === null && f.badges?.some((b) => b.startsWith('natal ') && b.endsWith(' branch'));
    if (!natal) { out.push(f); continue; }
    const key = JSON.stringify([f.facts, f.topics ?? null, f.direction ?? null]);
    const group = seen.get(key);
    if (group) group.push(f); else { seen.set(key, [f]); out.push(f); }
  }
  return out.map((f) => {
    const group = [...seen.values()].find((g) => g[0] === f);
    if (!group || group.length < 2) return f;
    const pillarBadge = (g: Firing): string => g.badges!.find((b) => b.startsWith('natal ') && b.endsWith(' branch'))!;
    const pillars = group.map((g) => pillarBadge(g).slice('natal '.length, -' branch'.length));
    const badges = f.badges!.map((b) => (b === pillarBadge(f) ? `natal ${pillars.join(' and ')} branches` : b));
    return { ...f, badges, dedupeInstance: group.map((g) => g.dedupeInstance).join('+') };
  });
}

const star = (ruleId: string, fire: RuleBinding['fire']): RuleBinding => ({ ruleId, tradition: 'bazi', requires: { birthTime: true }, fire: (ctx, rule) => mergeNatal(fire(ctx, rule)) });

const kongwang = star('bazi.kongwang', (ctx) => {
  const a = natalOf(ctx);
  const day = a.pillars.day.hanzi;
  const out: Firing[] = [];
  const topicsOf = (pillar: PillarName): Topic[] => (pillar === 'hour' || pillar === 'day' ? ['general', 'relationships'] : ['general']);
  for (const void_ of a.voidPair) {
    for (const h of hits(ctx, a, void_)) {
      const palace = h.where === 'natal' ? `${PILLAR_PALACES[h.pillar!]} (${h.pillar})` : `incoming ${h.incoming!.kind}`;
      out.push(firingAt(h, [fact('branch', 'Branch', hanzi(void_)), fact('dayPillar', 'Day pillar', day), fact('palace', 'Palace', palace)], '', { topics: h.where === 'natal' ? topicsOf(h.pillar!) : ['general'] }));
    }
  }
  return out;
});

const clashedByNatal = (a: NatalAssessment, branch: number): boolean => natalBranchList(a).includes(clashOf(branch));

const tianyi = star('bazi.tianyi-guiren', (ctx) => {
  const a = natalOf(ctx);
  const out: Firing[] = [];
  for (const noble of noblesOf(a.dayStem)) {
    for (const h of hits(ctx, a, noble)) {
      const badges: string[] = [];
      if (a.voidPair.includes(noble)) badges.push('strength reduced: the branch is void (空亡)');
      if (clashedByNatal(a, noble)) badges.push('strength reduced: the branch is clashed');
      out.push(firingAt(h, [fact('branch', 'Branch', hanzi(noble)), fact('dayStem', 'Day master', a.pillars.day.stem.hanzi)], '', { badges }));
    }
  }
  return out;
});

/** Yima and taohua read one table keyed by the three-harmony group of the year branch and, as a second school, the day branch. */
function byBase(ruleId: string, target: (base: number) => number, label: string): RuleBinding {
  return star(ruleId, (ctx) => {
    const a = natalOf(ctx);
    const out: Firing[] = [];
    for (const [name, base] of [['year', a.pillars.year.branch.index], ['day', a.pillars.day.branch.index]] as const) {
      const t = target(base);
      const badges = clashedByNatal(a, t) ? [`${label} is clashed by a natal branch`] : [];
      for (const h of hits(ctx, a, t)) out.push(firingAt(h, [fact('incoming', 'Branch', hanzi(t)), fact('baseBranch', 'Base branch', `${hanzi(base)} (${name} branch)`)], `:${name}`, { badges }));
    }
    return out;
  });
}

const yima = byBase('bazi.yima', horseOf, 'the horse (破馬)');
const taohua = byBase('bazi.taohua', peachOf, 'the peach-blossom branch');

const yangren = star('bazi.yangren', (ctx) => {
  const a = natalOf(ctx);
  const blade = bladeOf(a.dayStem);
  if (blade === null) return []; // the yin stems have no blade in the 子平 school
  // The source does not say when a 官殺 star holds the blade, so the rule gives no direction. The sentence says
  // which branch is the blade and whether a 官殺 star stands revealed in a stem or is only hidden in a branch.
  const stars = kinChars(a, 'officer');
  const starNote = stars.some((c) => c.place === 'stem') ? 'a 官殺 star stands revealed in a stem of the chart' : stars.length > 0 ? 'a 官殺 star is in the chart but only hidden in a branch' : 'no 官殺 star is in the chart';
  return hits(ctx, a, blade).map((h) => firingAt(h, [fact('branch', 'Branch', hanzi(blade)), fact('dayStem', 'Day master', a.pillars.day.stem.hanzi), fact('starNote', '官殺 star', starNote)], '', { badges: ['the source does not say when a 官殺 star holds the blade: no direction given'] }));
});

const lushen = star('bazi.lushen', (ctx) => {
  const a = natalOf(ctx);
  const lu = luOf(a.dayStem);
  return hits(ctx, a, lu).map((h) => firingAt(h, [fact('branch', 'Branch', hanzi(lu)), fact('dayStem', 'Day master', a.pillars.day.stem.hanzi)], ''));
});

export const STAR_BINDINGS: readonly RuleBinding[] = [kongwang, tianyi, yima, taohua, yangren, lushen];
