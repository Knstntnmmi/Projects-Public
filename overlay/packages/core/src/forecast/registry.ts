// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The registry joins the rule data to the code that evaluates it, and accounts for every
 * rule: bound (it runs), withheld (and why), unbound (no code yet) or held back (the
 * checkers could not confirm it, so it is not in the rule files at all).
 */
import type { ContextBuilder } from './context.ts';
import { RULE_FILES, HELD_BACK } from './rules.ts';
import { TOPICS, TRADITIONS, type HeldBack, type NotEvaluated, type Rule, type RuleBinding, type RuleFile, type Topic, type Tradition } from './types.ts';
import * as bazi from './predicates/bazi.ts';
import * as iching from './predicates/iching.ts';
import * as vedic from './predicates/vedic.ts';
import * as western from './predicates/western.ts';

/** What each file in predicates/ exports. */
export interface TraditionModule {
  BINDINGS: readonly RuleBinding[];
  /** Rules this tradition's author declined to evaluate, with the reason. */
  NOT_EVALUATED: readonly NotEvaluated[];
  buildContext: ContextBuilder;
  /** Set true when every rule of the tradition is bound or declared not evaluated; the registry then enforces it. */
  COMPLETE: boolean;
}

export interface Registry {
  rules: readonly Rule[];
  heldBack: readonly HeldBack[];
  bindings: ReadonlyMap<string, RuleBinding>;
  notEvaluated: ReadonlyMap<string, string>;
  builders: Partial<Record<Tradition, ContextBuilder>>;
  complete: Readonly<Record<Tradition, boolean>>;
}

export class RegistryError extends Error {
  constructor(problems: string[]) {
    super(`registry is inconsistent:\n  ${problems.join('\n  ')}`);
    this.name = 'RegistryError';
  }
}

export function createRegistry(files: readonly RuleFile[], modules: Readonly<Record<Tradition, TraditionModule>>, heldBack: readonly HeldBack[] = []): Registry {
  const problems: string[] = [];
  const rules = files.flatMap((f) => f.rules);
  const byId = new Map(rules.map((r) => [r.id, r]));
  const bindings = new Map<string, RuleBinding>();
  const notEvaluated = new Map<string, string>();
  const builders: Partial<Record<Tradition, ContextBuilder>> = {};
  const complete = {} as Record<Tradition, boolean>;
  for (const t of TRADITIONS) {
    const m = modules[t];
    builders[t] = m.buildContext;
    complete[t] = m.COMPLETE;
    for (const b of m.BINDINGS) {
      const rule = byId.get(b.ruleId);
      if (!rule) problems.push(`binding for ${b.ruleId}: no such rule`);
      else if (rule.tradition !== t || b.tradition !== t) problems.push(`binding for ${b.ruleId}: rule is ${rule.tradition}, binding says ${b.tradition}, file is ${t}`);
      if (bindings.has(b.ruleId)) problems.push(`binding for ${b.ruleId}: bound twice`);
      bindings.set(b.ruleId, b);
    }
    for (const n of m.NOT_EVALUATED) {
      const rule = byId.get(n.ruleId);
      if (!rule || rule.tradition !== t) problems.push(`not-evaluated ${n.ruleId}: no such rule of ${t}`);
      if (notEvaluated.has(n.ruleId)) problems.push(`not-evaluated ${n.ruleId}: declared twice`);
      if (n.reason.trim() === '') problems.push(`not-evaluated ${n.ruleId}: reason is empty`);
      notEvaluated.set(n.ruleId, n.reason);
    }
  }
  for (const id of notEvaluated.keys()) if (bindings.has(id)) problems.push(`${id}: both bound and declared not evaluated`);
  if (problems.length) throw new RegistryError(problems);
  return { rules, heldBack, bindings, notEvaluated, builders, complete };
}

export const DEFAULT_REGISTRY: Registry = createRegistry(RULE_FILES, { bazi, vedic, iching, western }, HELD_BACK);

// ---------------------------------------------------------------------------
// Accounting
// ---------------------------------------------------------------------------

/** What decides, for one run, which rules may run. */
export interface RunConfig {
  traditions: readonly Tradition[];
  sex: 'male' | 'female' | null;
  birthTimeUncertaintyMinutes: number | null;
  birthTimeLimitMinutes: number;
}

export type WithheldReason = 'tradition-off' | 'needs-sex-convention' | 'not-computable' | 'birth-time-uncertain';

export type RuleStatus =
  | { ruleId: string; tradition: Tradition; state: 'bound' }
  | { ruleId: string; tradition: Tradition; state: 'withheld'; reason: WithheldReason; detail: string }
  | { ruleId: string; tradition: Tradition; state: 'unbound'; detail: string }
  | { ruleId: string; tradition: Tradition; state: 'held-back'; detail: string };

/** Whether a rule needs the BaZi sex convention: the binding says, else the rule's own inputs do. */
export function needsSex(rule: Rule, binding: RuleBinding | undefined): boolean {
  return binding?.requires?.sex ?? rule.inputs.some((i) => /^sex\b/.test(i));
}

export function statusOf(registry: Registry, rule: Rule, config: RunConfig): RuleStatus {
  const base = { ruleId: rule.id, tradition: rule.tradition };
  const binding = registry.bindings.get(rule.id);
  if (!config.traditions.includes(rule.tradition)) {
    return { ...base, state: 'withheld', reason: 'tradition-off', detail: `${rule.tradition} is not switched on` };
  }
  const declared = registry.notEvaluated.get(rule.id);
  if (declared !== undefined) return { ...base, state: 'withheld', reason: 'not-computable', detail: declared };
  if (needsSex(rule, binding) && config.sex === null) {
    return { ...base, state: 'withheld', reason: 'needs-sex-convention', detail: 'needs a named sex convention (baziSexConvention)' };
  }
  if (binding?.requires?.birthTime) {
    const u = config.birthTimeUncertaintyMinutes;
    if (u === null) return { ...base, state: 'withheld', reason: 'birth-time-uncertain', detail: 'no birth time was given' };
    if (u > config.birthTimeLimitMinutes) {
      return { ...base, state: 'withheld', reason: 'birth-time-uncertain', detail: `birth time uncertain by ${u} minutes, limit ${config.birthTimeLimitMinutes}` };
    }
  }
  if (!binding) return { ...base, state: 'unbound', detail: 'no binding has been written yet' };
  return { ...base, state: 'bound' };
}

export interface RegistryReport {
  statuses: RuleStatus[];
  /** Per tradition: how many rules in each state. */
  counts: Record<Tradition, { total: number; bound: number; withheld: number; unbound: number; heldBack: number }>;
  /** Bound rules per tradition and topic: the coverage printed with every output. */
  coverage: Record<Tradition, Record<Topic, number>>;
  /** Rules the data declares per tradition and topic, for comparison with coverage. */
  declared: Record<Tradition, Record<Topic, number>>;
  /** Traditions switched off, with how many rules wait. */
  switchedOff: Array<{ tradition: Tradition; count: number; reason: string }>;
}

const zeroTopics = (): Record<Topic, number> => Object.fromEntries(TOPICS.map((t) => [t, 0])) as Record<Topic, number>;

export function report(registry: Registry, config: RunConfig): RegistryReport {
  const statuses: RuleStatus[] = registry.rules.map((r) => statusOf(registry, r, config));
  for (const h of registry.heldBack) {
    if ((TRADITIONS as readonly string[]).includes(h.tradition)) statuses.push({ ruleId: h.id, tradition: h.tradition as Tradition, state: 'held-back', detail: `${h.verdict}: ${h.reason}` });
  }
  const counts = {} as RegistryReport['counts'];
  const coverage = {} as RegistryReport['coverage'];
  const declared = {} as RegistryReport['declared'];
  for (const t of TRADITIONS) {
    counts[t] = { total: 0, bound: 0, withheld: 0, unbound: 0, heldBack: 0 };
    coverage[t] = zeroTopics();
    declared[t] = zeroTopics();
  }
  const byId = new Map(registry.rules.map((r) => [r.id, r]));
  for (const s of statuses) {
    const c = counts[s.tradition];
    if (s.state === 'held-back') {
      c.heldBack++;
      continue;
    }
    c.total++;
    const rule = byId.get(s.ruleId)!;
    for (const topic of rule.topics) declared[s.tradition][topic]++;
    if (s.state === 'bound') {
      c.bound++;
      for (const topic of rule.topics) coverage[s.tradition][topic]++;
    } else if (s.state === 'withheld') c.withheld++;
    else c.unbound++;
  }
  const switchedOff = TRADITIONS.filter((t) => !config.traditions.includes(t))
    .map((t) => ({ tradition: t, count: counts[t].total, reason: 'withheld pending verification' }))
    .filter((x) => x.count > 0);
  return { statuses, counts, coverage, declared, switchedOff };
}

/** Rules of a tradition that are neither bound nor declared not evaluated. */
export function unaccounted(registry: Registry, tradition: Tradition): string[] {
  return registry.rules.filter((r) => r.tradition === tradition && !registry.bindings.has(r.id) && !registry.notEvaluated.has(r.id)).map((r) => r.id);
}
