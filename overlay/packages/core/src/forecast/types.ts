// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The vocabulary of the forecast layer. A rule is data (one sourced statement with its
 * condition); a binding is code that decides, for one nativity and span, when the
 * condition holds; a signal is what the two produce together.
 */
import type { ClockId } from '../overlay/tracks.ts';

export type { ClockId };

export const TRADITIONS = ['bazi', 'vedic', 'iching', 'western'] as const;
export type Tradition = (typeof TRADITIONS)[number];

export const TOPICS = ['wealth', 'career', 'relationships', 'health', 'learning', 'home-travel', 'general'] as const;
export type Topic = (typeof TOPICS)[number];

export const STAGES = ['natal-promise', 'period-lord', 'activation', 'modifier'] as const;
export type Stage = (typeof STAGES)[number];

/** The rule's own field. */
export const DIRECTIONS = ['favourable', 'unfavourable', 'mixed', 'activates'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** What a reading says. Words only; no number is ever attached. */
export type ReadingWord = 'supports' | 'cautions' | 'mixed' | 'nothing-said';

export type ClockGroupId = 'birth-arithmetic' | ClockId;

export interface Fact {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
}

/** One rule, as the JSON files state it. */
export interface Rule {
  id: string;
  tradition: Tradition;
  name: string;
  stage: Stage;
  condition: string;
  inputs: string[];
  computable: 'now' | 'small-addition';
  topics: Topic[];
  direction: Direction;
  /** The extractor's rating, 1 to 3. Display only; never combined. */
  strength: 1 | 2 | 3;
  template: string;
  sourceCitation: string;
  sourceOpened: boolean;
  sourceLocator: string;
  sourceQuote: string;
  variants: string;
  verification: 'confirmed' | 'corrected';
  verificationNote?: string;
  /** Rules that report one physical fact share a key; see the specification, section 5.3. */
  dedupeKey?: string;
  directionByHouse?: Record<string, Direction>;
  /** Rules that must have fired before this one counts. No accepted rule carries one yet. */
  gatedBy?: string[];
}

export interface RuleFile {
  tradition: Tradition;
  method: string;
  topicDefinitions: unknown[];
  tables: Record<string, unknown>;
  rules: Rule[];
}

export interface HeldBack {
  tradition: string;
  id: string;
  kind: string;
  verdict: 'unverifiable' | 'refuted';
  reason: string;
}

export interface Gate {
  state: 'ungated' | 'open' | 'closed';
  by: string[];
  sourceOfGate?: string;
}

export interface Signal {
  /** ruleId@startMs@topic; a numeric suffix is added if one rule fires twice at one instant. */
  id: string;
  ruleId: string;
  ruleName: string;
  tradition: Tradition;
  clock: ClockId;
  clockGroup: ClockGroupId;
  topic: Topic;
  stage: Stage;
  direction: Direction;
  /** null = natal and undated. Such a signal is context and never enters a slice. */
  startUtcMs: number | null;
  endUtcMs: number | null;
  baseStrength: 1 | 2 | 3;
  gate: Gate;
  facts: Fact[];
  /** Physical fact key plus the instance it was read at; equal keys are one fact. */
  dedupeKey: string;
  conventionsUsed: string[];
  sentence: string;
  source: { citation: string; locator: string; quote: string; opened: boolean };
  variants: string;
  verification: 'confirmed' | 'corrected';
  badges: string[];
  /** For a non-modifier signal: modifier signals of the same tradition and topic that overlap it. */
  modifiedBy: string[];
}

/** What a binding returns: one moment in which a rule's condition held. */
export interface Firing {
  clock: ClockId;
  startUtcMs: number | null;
  endUtcMs: number | null;
  /** Every value that fired the rule; the sentence is built from these and nothing else. */
  facts: Fact[];
  /** A subset of the rule's topics; default all of them. */
  topics?: Topic[];
  /** For rules whose direction depends on the case (directionByHouse). */
  direction?: Direction;
  /** Replaces the start-end instance in the dedupe key, for facts that are not tied to a window. */
  dedupeInstance?: string;
  conventionsUsed?: string[];
  badges?: string[];
}

export interface RuleBinding {
  ruleId: string;
  tradition: Tradition;
  /** What the binding cannot run without. Declared here so the registry can say why it did not run. */
  requires?: { sex?: boolean; birthTime?: boolean };
  fire(ctx: import('./context.ts').ForecastContext, rule: Rule): Firing[];
}

export interface NotEvaluated {
  ruleId: string;
  reason: string;
}

export interface Span {
  startUtcMs: number;
  endUtcMs: number;
}

export interface Slice extends Span {
  index: number;
  year: number;
  label: string;
}

export type SexConvention = 'none' | 'male-chart' | 'female-chart';
