// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
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

/**
 * The plain counts behind a reading's word, after de-duplication: how many deciding
 * statements support, caution, are stated as mixed by their own rule, or only mark the topic
 * as active. Display only; nothing is decided from it.
 */
export interface Tally {
  supports: number;
  cautions: number;
  mixed: number;
  active: number;
}

export type ClockGroupId = 'birth-arithmetic' | ClockId;

/**
 * The technique a practitioner would name, which is what a reader sees instead of a clock.
 * 'natal' is every undated statement of the chart. The I Ching has one level, read by period.
 */
export const LEVEL_IDS = [
  'natal',
  'bazi-luck',
  'bazi-year',
  'vedic-maha',
  'vedic-antar',
  'saturn-moon',
  'jupiter-moon',
  'western-profection',
  'western-firdaria',
  'western-solar-return',
  'western-transits',
  'iching-period',
] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export interface Fact {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
}

/** One rule, as the JSON files state it. */
export interface BranchReading {
  direction?: Direction;
  /** The printed page of the source. */
  page: string;
  quote: string;
}

export interface Rule {
  id: string;
  tradition: Tradition;
  name: string;
  stage: Stage;
  condition: string;
  inputs: string[];
  /** 'needs-return-chart': verified, but needs the planetary positions at the solar return. */
  computable: 'now' | 'small-addition' | 'needs-return-chart';
  topics: Topic[];
  direction: Direction;
  /** The rule file's rating, 1 to 3. Display only; never combined. */
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
  /**
   * Branch by branch, what the printed page says. A branch with a direction states its verdict in
   * Lilly's own words (the quotation, at most 25 words, on the printed page); a branch without one
   * is shown as a note without a direction, because the page states no verdict for it.
   */
  directionByBranch?: Record<string, BranchReading>;
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
  /** The technique this statement belongs to; derived from tradition and clock, or set by the binding where one clock carries two periods. */
  level: LevelId;
  topic: Topic;
  stage: Stage;
  direction: Direction;
  /** null = natal and undated. Such a signal is context and never enters a slice. */
  startUtcMs: number | null;
  endUtcMs: number | null;
  /** Orders the statements that report one fact, so that the same one is kept whatever the input order (see readings.ts, dedupe). Internal: never shown, never counted, never a reading. */
  orderKey: 1 | 2 | 3;
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
  /**
   * Only where one clock carries two nested periods (the dasha clock carries the mahadasha and
   * the antardasha; the birthday clock carries profection, firdaria and solar return). A binding
   * that knows which period it judged says so; elsewhere the level follows from tradition and clock.
   */
  level?: LevelId;
  startUtcMs: number | null;
  endUtcMs: number | null;
  /** Every value that fired the rule; the sentence is built from these and nothing else. */
  facts: Fact[];
  /** A subset of the rule's topics; default all of them. */
  topics?: Topic[];
  /** For rules whose own text assigns the direction case by case; the binding's test shows the case table. */
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
  /**
   * The levels this rule can speak at, declared here so that the decade grid shows a row for a
   * level the rule never fires at in a span, and shows it silent instead of leaving it out. A rule
   * of undated statements declares 'natal'. A binding that declares none is read from what fired.
   */
  levels?: readonly LevelId[];
  /**
   * The rule is read by period and not by year: its statements never enter a yearly form and a
   * long span does not compute them. The whole tradition may be flagged in its module
   * (PERIOD_READ); this flag is for one rule of a tradition that is otherwise read by year.
   */
  periodRead?: boolean;
  fire(ctx: import('./context.ts').ForecastContext, rule: Rule): Firing[];
}

export interface NotEvaluated {
  ruleId: string;
  reason: string;
}

/**
 * Part of a bound rule that is deliberately not evaluated: the rest of the rule runs, and this
 * branch of its condition says nothing, with the reason. A rule that is not evaluated at all is a NotEvaluated.
 */
export interface NotEvaluatedBranch {
  ruleId: string;
  /** The branch of the condition that is left out, in the condition's own words. */
  branch: string;
  reason: string;
}

/**
 * A note a tradition adds to the readings of some levels because of the chart itself (a
 * balanced BaZi chart names no favourite, so the levels that judge by the favourite are silent).
 */
export interface ChartNote {
  tradition: Tradition;
  levels: LevelId[];
  text: string;
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
