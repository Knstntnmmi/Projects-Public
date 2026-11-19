// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * From one rule and the firings its binding returned to signals. The sentence of a signal
 * is the rule's own template with the slots filled from the firing's facts and from
 * nothing else: a slot with no fact is an error, never a guess.
 */
import { BADGE, GATE_UNGATED } from './phrasebook.ts';
import { clockGroupOf, isClockId } from './clocks.ts';
import { levelFits, levelOfFiring } from './levels.ts';
import type { ForecastConventions } from './conventions.ts';
import type { Fact, Firing, Rule, Signal, Span } from './types.ts';

export class UnboundSlotError extends Error {
  readonly ruleId: string;
  readonly slot: string;
  constructor(ruleId: string, slot: string) {
    super(`${ruleId}: the template needs {${slot}} but no fact of that key was given`);
    this.name = 'UnboundSlotError';
    this.ruleId = ruleId;
    this.slot = slot;
  }
}

export class BadFiringError extends Error {
  constructor(ruleId: string, what: string) {
    super(`${ruleId}: ${what}`);
    this.name = 'BadFiringError';
  }
}

const SLOT = /\{([^{}]+)\}/g;

/** The slot names a template uses, in order of first use. */
export function slotsOf(template: string): string[] {
  return [...new Set([...template.matchAll(SLOT)].map((m) => m[1]!))];
}

export function fillTemplate(ruleId: string, template: string, facts: readonly Fact[]): string {
  const byKey = new Map(facts.map((f) => [f.key, f.value]));
  const filled = template.replace(SLOT, (_m, slot: string) => {
    if (!byKey.has(slot)) throw new UnboundSlotError(ruleId, slot);
    return String(byKey.get(slot));
  });
  return singularHouse(ordinals(filled));
}

/** A template that says "houses {houses}" for a list reads "house 7" when the list holds one house. */
export function singularHouse(text: string): string {
  return text.replace(/\bhouses (\d+)(?!\d|, | and )/g, 'house $1');
}

/** Several templates write a house number as "{h}th"; a number takes its own English ending. */
export function ordinals(text: string): string {
  return text.replace(/\b(\d+)th\b/g, (_m, n: string) => {
    const k = Number(n);
    const tail = k % 100;
    const end = tail >= 11 && tail <= 13 ? 'th' : k % 10 === 1 ? 'st' : k % 10 === 2 ? 'nd' : k % 10 === 3 ? 'rd' : 'th';
    return `${n}${end}`;
  });
}

function checkFiring(rule: Rule, f: Firing): void {
  if (!isClockId(f.clock)) throw new BadFiringError(rule.id, `unknown clock ${String(f.clock)}`);
  const dated = f.startUtcMs !== null && f.endUtcMs !== null;
  if (!dated && (f.startUtcMs !== null || f.endUtcMs !== null)) throw new BadFiringError(rule.id, 'start and end must both be given or both be null');
  if (dated && (!Number.isFinite(f.startUtcMs!) || !Number.isFinite(f.endUtcMs!) || f.endUtcMs! < f.startUtcMs!)) throw new BadFiringError(rule.id, 'end is before start');
  if (f.level !== undefined && dated && !levelFits(f.level, rule.tradition, f.clock)) throw new BadFiringError(rule.id, `level ${f.level} does not run on clock ${f.clock} in ${rule.tradition}`);
  const keys = f.facts.map((x) => x.key);
  if (new Set(keys).size !== keys.length) throw new BadFiringError(rule.id, 'a fact key is repeated');
  if (f.topics) {
    if (f.topics.length === 0) throw new BadFiringError(rule.id, 'topics is empty');
    for (const t of f.topics) if (!rule.topics.includes(t)) throw new BadFiringError(rule.id, `topic ${t} is not one of the rule's topics`);
  }
}

export interface SignalOptions {
  forecastConventions: ForecastConventions;
  /** Signals that do not overlap this are left out; natal signals are always kept. */
  span: Span;
}

/** The signals one rule yields from its firings: one per firing and topic, in firing order. */
export function signalsFromFirings(rule: Rule, firings: readonly Firing[], options: SignalOptions): Signal[] {
  if (rule.gatedBy && rule.gatedBy.length > 0) {
    // No gate semantics exist yet: the specification keeps the field but accepts no rule that uses it.
    throw new Error(`${rule.id}: gatedBy is set, but no sourced gate semantics are defined in this release`);
  }
  const out: Signal[] = [];
  const seenIds = new Map<string, number>();
  for (const f of firings) {
    checkFiring(rule, f);
    const dated = f.startUtcMs !== null && f.endUtcMs !== null;
    if (dated && !overlaps(f, options.span.startUtcMs, options.span.endUtcMs)) continue;
    const sentence = fillTemplate(rule.id, rule.template, f.facts);
    const keyBase = rule.dedupeKey ? fillTemplate(rule.id, rule.dedupeKey, f.facts) : `rule:${rule.id}`;
    const instance = f.dedupeInstance ?? (dated ? `${f.startUtcMs}-${f.endUtcMs}` : 'natal');
    for (const topic of f.topics ?? rule.topics) {
      const base = `${rule.id}@${dated ? f.startUtcMs : 'natal'}@${topic}`;
      const n = (seenIds.get(base) ?? 0) + 1;
      seenIds.set(base, n);
      const badges: string[] = [BADGE.ungated];
      if (rule.tradition === 'iching') badges.push(BADGE.experimental);
      if (topic === 'relationships') badges.push(BADGE.conventionDependent);
      if (!rule.sourceOpened) badges.push(BADGE.unopened);
      let baseStrength = rule.strength;
      if (options.forecastConventions.cap_ungated && baseStrength > 1) {
        baseStrength = 1;
        badges.push(BADGE.capped);
      }
      for (const b of f.badges ?? []) if (!badges.includes(b)) badges.push(b);
      out.push({
        id: n === 1 ? base : `${base}#${n}`,
        ruleId: rule.id,
        ruleName: rule.name,
        tradition: rule.tradition,
        clock: f.clock,
        clockGroup: clockGroupOf(f.clock),
        level: levelOfFiring(rule.tradition, f),
        topic,
        stage: rule.stage,
        direction: f.direction ?? rule.direction,
        startUtcMs: dated ? f.startUtcMs : null,
        endUtcMs: dated ? f.endUtcMs : null,
        baseStrength,
        gate: { state: 'ungated', by: [] },
        facts: f.facts.map((x) => ({ ...x })),
        dedupeKey: `${keyBase}#${instance}`,
        conventionsUsed: [...(f.conventionsUsed ?? [])],
        sentence,
        source: { citation: rule.sourceCitation, locator: rule.sourceLocator, quote: rule.sourceQuote, opened: rule.sourceOpened },
        variants: rule.variants,
        verification: rule.verification,
        badges,
        modifiedBy: [],
      });
    }
  }
  return out;
}

/** Gate text for the detail view. */
export const gateText = (s: Signal): string => (s.gate.state === 'ungated' ? GATE_UNGATED : `${s.gate.state}: by ${s.gate.by.join(', ')}`);

/** True when a dated signal overlaps [start, end). A point in time counts if it lies inside. */
export function overlaps(s: { startUtcMs: number | null; endUtcMs: number | null }, start: number, end: number): boolean {
  if (s.startUtcMs === null || s.endUtcMs === null) return false;
  if (s.endUtcMs === s.startUtcMs) return s.startUtcMs >= start && s.startUtcMs < end;
  return s.startUtcMs < end && s.endUtcMs > start;
}

/** The share of [start, end) a dated signal covers, 0 to 1; a point in time counts as a sliver of one day at least. */
export function overlapFraction(s: { startUtcMs: number | null; endUtcMs: number | null }, start: number, end: number): number {
  if (!overlaps(s, start, end)) return 0;
  const lo = Math.max(s.startUtcMs!, start);
  const hi = Math.min(s.endUtcMs!, end);
  return Math.min(1, Math.max(hi - lo, 86_400_000) / (end - start));
}
