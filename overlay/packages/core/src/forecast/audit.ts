// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The audit the registry test runs on every binding: the checks that do not depend on what
 * a rule says, only on whether the code around it keeps the specification's promises. A
 * tradition's author runs it on their own bindings before anything else (BINDINGS.md).
 * It returns problems as text and throws nothing, so a test can print all of them at once.
 */
import { createContext, type ForecastInput } from './context.ts';
import { runConfig } from './evaluate.ts';
import { bannedIn, KNOWN_TEMPLATE_EXCEPTIONS, MORTALITY_WORDS } from './phrasebook.ts';
import { statusOf, unaccounted, type Registry } from './registry.ts';
import { signalsFromFirings } from './signals.ts';
import { TRADITIONS, type Tradition } from './types.ts';

export interface AuditOptions {
  /** Traditions to audit; default all four, so that a stub or withheld one is checked too. */
  traditions?: readonly Tradition[];
}

export function auditRegistry(registry: Registry, input: ForecastInput, options: AuditOptions = {}): string[] {
  const problems: string[] = [];
  const traditions = options.traditions ?? TRADITIONS;
  for (const t of traditions) {
    if (registry.complete[t]) {
      for (const id of unaccounted(registry, t)) problems.push(`${id}: ${t} says it is complete, but this rule is neither bound nor declared not evaluated`);
    }
  }
  const config = runConfig(input, traditions);
  const ctx = createContext(input, registry.builders);
  const byId = new Map(registry.rules.map((r) => [r.id, r]));
  for (const [id, binding] of registry.bindings) {
    const rule = byId.get(id)!;
    if (!traditions.includes(rule.tradition)) continue;
    const status = statusOf(registry, rule, config);
    if (status.state !== 'bound') continue; // withheld for this input (no sex convention, birth time): correctly not run
    let first;
    let second;
    try {
      first = binding.fire(ctx, rule);
      second = binding.fire(ctx, rule);
    } catch (e) {
      problems.push(`${id}: firing threw ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (JSON.stringify(first) !== JSON.stringify(second)) problems.push(`${id}: two evaluations on the same input gave different firings`);
    let signals;
    try {
      signals = signalsFromFirings(rule, first, { forecastConventions: input.forecastConventions, span: input.span });
    } catch (e) {
      problems.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    for (const s of signals) {
      const banned = bannedIn(s.sentence);
      if (banned) problems.push(`${s.id}: the sentence uses the word "${banned}"`);
      if (s.topic === 'health' && MORTALITY_WORDS.test(s.sentence) && !KNOWN_TEMPLATE_EXCEPTIONS[id]) problems.push(`${s.id}: a health sentence uses mortality or diagnosis wording`);
      if (s.facts.some((f) => typeof f.value === 'number' && !Number.isFinite(f.value))) problems.push(`${s.id}: a fact value is not a finite number`);
    }
  }
  return problems;
}
