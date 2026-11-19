// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Evaluation: runs every bound rule of every switched-on tradition for one nativity and
 * span, and assembles signals, readings, agreement and the baseline. Pure; the nativity
 * is an argument and is not kept anywhere.
 */
import { DEFAULT_CONVENTIONS, type Conventions } from '../conventions.ts';
import type { Moment } from '../substrate/time.ts';
import { agreementBaseline, type Baseline } from './baseline.ts';
import { agreementCells, groupSeries, type AgreementCell } from './agreement.ts';
import { createContext, sliceSpan, type ForecastInput } from './context.ts';
import { DEFAULT_FORECAST_CONVENTIONS, sexOf, type ForecastConventions } from './conventions.ts';
import { sensitivityText } from './phrasebook.ts';
import { attachModifiers, buildReadings, type Reading } from './readings.ts';
import { DEFAULT_REGISTRY, report, type Registry, type RegistryReport, type RunConfig } from './registry.ts';
import { RULESET_VERSION, rulesetVersion } from './rules.ts';
import { signalsFromFirings } from './signals.ts';
import { STAGES, TOPICS, TRADITIONS, type ReadingWord, type Signal, type Slice, type Span, type Topic, type Tradition } from './types.ts';

/** Traditions switched on in this phase. Western is carried but withheld pending verification. */
export const DEFAULT_TRADITIONS: readonly Tradition[] = ['bazi', 'vedic', 'iching'];

export interface ForecastOptions {
  registry?: Registry;
  traditions?: readonly Tradition[];
  topics?: readonly Topic[];
  /** Seed and number of shifted runs of the agreement baseline. */
  seed?: number;
  runs?: number;
}

export interface MakeInput {
  fromYear: number;
  toYear: number;
  conventions?: Conventions;
  forecastConventions?: Partial<ForecastConventions>;
  birthTimeUncertaintyMinutes?: number | null;
}

export function makeInput(moment: Moment, o: MakeInput): ForecastInput {
  return {
    moment,
    conventions: o.conventions ?? DEFAULT_CONVENTIONS,
    forecastConventions: { ...DEFAULT_FORECAST_CONVENTIONS, ...o.forecastConventions },
    span: sliceSpan(o.fromYear, o.toYear),
    birthTimeUncertaintyMinutes: o.birthTimeUncertaintyMinutes === undefined ? 0 : o.birthTimeUncertaintyMinutes,
  };
}

export interface ForecastResult {
  schema: 'overlay-forecast/1';
  rulesetVersion: string;
  conventions: { engine: Conventions; forecast: ForecastConventions };
  traditions: Tradition[];
  topics: Topic[];
  span: Span;
  slices: Slice[];
  registry: RegistryReport;
  /** Rules available (bound) and withheld, for the line printed under the signal list. */
  availableCount: number;
  withheldCount: number;
  signals: Signal[];
  readings: Reading[];
  agreement: AgreementCell[];
  baselines: Record<string, Baseline>;
}

export function runConfig(input: ForecastInput, traditions: readonly Tradition[]): RunConfig {
  return {
    traditions,
    sex: sexOf(input.forecastConventions),
    birthTimeUncertaintyMinutes: input.birthTimeUncertaintyMinutes,
    birthTimeLimitMinutes: input.forecastConventions.birthTimeLimitMinutes,
  };
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function evaluate(input: ForecastInput, options: ForecastOptions = {}): ForecastResult {
  const registry = options.registry ?? DEFAULT_REGISTRY;
  const traditions = [...(options.traditions ?? DEFAULT_TRADITIONS)];
  const topics = [...(options.topics ?? TOPICS)];
  const config = runConfig(input, traditions);
  const accounting = report(registry, config);
  const ctx = createContext(input, registry.builders);

  const order = (r: { tradition: Tradition; stage: (typeof STAGES)[number]; id: string }): [number, number, string] => [TRADITIONS.indexOf(r.tradition), STAGES.indexOf(r.stage), r.id];
  const bound = new Set(accounting.statuses.filter((s) => s.state === 'bound').map((s) => s.ruleId));
  const rules = registry.rules
    .filter((r) => bound.has(r.id) && (r.sourceOpened || input.forecastConventions.showUnopened))
    .sort((a, b) => {
      const x = order(a);
      const y = order(b);
      return x[0] - y[0] || x[1] - y[1] || byText(x[2], y[2]);
    });

  let signals: Signal[] = [];
  for (const rule of rules) {
    const binding = registry.bindings.get(rule.id)!;
    const firings = binding.fire(ctx, rule);
    signals.push(...signalsFromFirings(rule, firings, { forecastConventions: input.forecastConventions, span: input.span }));
  }
  signals = signals.filter((s) => topics.includes(s.topic));
  signals.sort((a, b) => (a.startUtcMs ?? -Infinity) - (b.startUtcMs ?? -Infinity) || TRADITIONS.indexOf(a.tradition) - TRADITIONS.indexOf(b.tradition) || STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || byText(a.ruleId, b.ruleId) || byText(a.id, b.id));
  attachModifiers(signals);

  const slices = [...ctx.slices];
  const readings = buildReadings(signals, slices, { coverage: accounting.coverage, traditions, topics });
  const agreement = agreementCells(readings, slices, topics);
  const baselines: Record<string, Baseline> = {};
  for (const topic of topics) {
    baselines[topic] = agreementBaseline(groupSeries(readings, topic, slices.length), { runs: options.runs, seed: options.seed, cellsLooked: topics.length });
  }

  const heldBack = Object.values(accounting.counts).reduce((n, c) => n + c.heldBack, 0);
  return {
    schema: 'overlay-forecast/1',
    rulesetVersion: registry === DEFAULT_REGISTRY ? RULESET_VERSION : rulesetVersion(registry.rules),
    conventions: { engine: input.conventions, forecast: input.forecastConventions },
    traditions,
    topics,
    span: input.span,
    slices,
    registry: accounting,
    availableCount: Object.values(accounting.counts).reduce((n, c) => n + c.bound, 0),
    withheldCount: accounting.switchedOff.reduce((n, s) => n + s.count, 0) + heldBack,
    signals,
    readings,
    agreement,
    baselines,
  };
}

/** The JSON output of the specification (section 7) for one topic. No natal data beyond the conventions and the span. */
export function reportJson(result: ForecastResult, topic: Topic): Record<string, unknown> {
  const coverage: Record<string, number> = {};
  for (const t of TRADITIONS) coverage[t] = result.registry.coverage[t][topic];
  const baseline = result.baselines[topic];
  return {
    schema: result.schema,
    rulesetVersion: result.rulesetVersion,
    conventions: result.conventions,
    topic,
    span: result.span,
    coverage,
    notEvaluated: result.registry.statuses
      .filter((s) => s.state === 'withheld' || s.state === 'unbound')
      .filter((s) => !(s.state === 'withheld' && s.reason === 'tradition-off'))
      .map((s) => ({ ruleId: s.ruleId, reason: s.state === 'withheld' ? `${s.reason}: ${s.detail}` : s.detail })),
    withheldCount: result.withheldCount,
    signals: result.signals.filter((s) => s.topic === topic),
    readings: result.readings.filter((r) => r.topic === topic).map((r) => ({ tradition: r.tradition, group: r.group, slice: r.slice, word: r.word, signalIds: r.signalIds })),
    agreement: result.agreement.filter((c) => c.topic === topic).map((c) => ({ slice: c.slice, groups: c.groups, verdict: c.verdict })),
    baseline: baseline && { found: baseline.found, expected: baseline.expected, runs: baseline.runs, seed: baseline.seed, cellsLooked: baseline.cellsLooked },
  };
}

export interface SensitivityNote {
  tradition: Tradition;
  topic: Topic;
  slice: number;
  from: ReadingWord;
  to: ReadingWord;
  minutes: number;
  text: string;
}

/**
 * Re-runs the evaluation with the birth moment moved by the stated uncertainty, earlier
 * and later, and lists the tradition readings that change ("would change if the birth
 * time were X minutes off"). Nothing is listed when no birth time was given or the
 * uncertainty is zero.
 */
export function birthTimeSensitivity(input: ForecastInput, base: ForecastResult, options: ForecastOptions = {}): SensitivityNote[] {
  const u = input.birthTimeUncertaintyMinutes;
  if (u === null || u <= 0) return [];
  const notes: SensitivityNote[] = [];
  const seen = new Set<string>();
  for (const sign of [-1, 1]) {
    const shifted: ForecastInput = { ...input, moment: { ...input.moment, utcMs: input.moment.utcMs + sign * u * 60_000 } };
    const alt = evaluate(shifted, { ...options, topics: base.topics, traditions: base.traditions });
    for (const r of base.readings) {
      if (r.group !== null) continue;
      const other = alt.readings.find((x) => x.group === null && x.tradition === r.tradition && x.topic === r.topic && x.slice === r.slice);
      const key = `${r.tradition}|${r.topic}|${r.slice}`;
      if (other && other.word !== r.word && !seen.has(key)) {
        seen.add(key);
        notes.push({ tradition: r.tradition, topic: r.topic, slice: r.slice, from: r.word, to: other.word, minutes: u, text: sensitivityText(u) });
      }
    }
  }
  return notes;
}
