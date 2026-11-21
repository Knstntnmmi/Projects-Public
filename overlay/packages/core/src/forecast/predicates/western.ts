// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Bindings for the western rules: the code that decides, for a nativity and a span, when each
 * rule's condition in data/rules.western.json holds. The rules are Lilly's, Valens's and
 * Bonatti's, run on Lilly's own tables (systems/western/lillyDignity.ts, lillyFortitude.ts,
 * aspects.ts) with whole-sign houses as a labelled variant; see BINDINGS.md one folder up
 * for the interface.
 *
 * western/natal.ts holds the natal-promise rules, western/profection.ts the annual profection
 * rules, western/firdaria.ts the firdaria, western/transits.ts the transit and critical-year
 * rules and western/modifiers.ts the two modifier rules. The solar-return rules (the
 * return Ascendant, the houses of the money significators, planets at radical places) live in
 * western/revolution.ts, on the return chart for the birth place.
 */
import type { ForecastContext } from '../context.ts';
import type { Firing, LevelId, NotEvaluated, Rule, RuleBinding } from '../types.ts';
import { declareLevels, levelFits } from '../levels.ts';
import { makeNatalContext, type WesternContext } from './western/context.ts';
import { firdariaLordCondition } from './western/firdaria.ts';
import { aspectList, strengthClasses } from './western/modifiers.ts';
import * as revolution from './western/revolution.ts';
import { NATAL_BINDINGS, NATAL_NOT_BOUND } from './western/natal.ts';
import * as profection from './western/profection.ts';
import { beneficMaleficYearLord, criticalYearNode, criticalYearSyzygy, dailyCusps, jupiterYearSign, type TransitRule } from './western/transits.ts';

const western = (ctx: ForecastContext): WesternContext => ctx.extension<WesternContext>('western')!;

/**
 * Says which technique a dated firing judged. The birthday clock carries the profection, the
 * firdaria and the solar return side by side, so each binding names its own; a firing on a
 * sky clock already has its level from the clock and is left alone.
 */
const at = (level: LevelId, firings: Firing[]): Firing[] =>
  firings.map((f) => (f.startUtcMs !== null && f.level === undefined && levelFits(level, 'western', f.clock) ? { ...f, level } : f));

/** A rule of the profection family: its firings, with the direction the rule gives each house. */
const period = (ruleId: string, run: profection.PeriodRule, requires: RuleBinding['requires'] = { birthTime: true }): RuleBinding => ({
  ruleId,
  tradition: 'western',
  requires,
  fire: (ctx: ForecastContext, rule: Rule) => at('western-profection', profection.withHouseDirection(rule.directionByHouse, run(western(ctx)))),
});

const transit = (ruleId: string, run: TransitRule, requires: RuleBinding['requires'] = { birthTime: true }): RuleBinding => ({
  ruleId,
  tradition: 'western',
  requires,
  fire: (ctx) => {
    const w = western(ctx);
    return at('western-transits', run(w, w.sky()));
  },
});

/** A rule of the solar return: it reads the return charts of the years of the span. */
const returnRule = (ruleId: string, run: revolution.ReturnRule, level: LevelId = 'western-solar-return'): RuleBinding => ({
  ruleId,
  tradition: 'western',
  requires: { birthTime: true },
  fire: (ctx) => {
    const w = western(ctx);
    return at(level, run(w, w.returns()));
  },
});

const REVOLUTION_BINDINGS: readonly RuleBinding[] = [
  returnRule('lilly.revolution.asc-hostile', revolution.ascHostile),
  returnRule('lilly.revolution.asc-same', revolution.ascSame),
  returnRule('lilly.revolution.seventh-asc', revolution.seventhAsc),
  returnRule('lilly.revolution.lord2-fortune-house', revolution.lord2FortuneHouse),
  returnRule('lilly.revolution.returns-wealth', revolution.returnsWealth),
  returnRule('lilly.revolution.returns-affliction', revolution.returnsAffliction),
  returnRule('lilly.revolution.contrary-disposition', revolution.contraryDisposition),
  returnRule('lilly.profection.lord-condition', revolution.lordCondition, 'western-profection'),
];

const PERIOD_BINDINGS: readonly RuleBinding[] = [
  period('lilly.profection.lord-of-year-by-degree', profection.lordOfYearByDegree),
  period('lilly.profection.house-money', profection.houseMoney),
  period('lilly.profection.house-relationships', profection.houseRelationships),
  period('lilly.profection.house-learning', profection.houseLearning),
  period('lilly.profection.house-travel', profection.houseTravel),
  period('lilly.profection.house-loss', profection.houseLoss),
  period('lilly.profection.house-health', profection.houseHealth),
  period('lilly.profection.angle-aspect-years', profection.angleAspectYears),
  period('lilly.profection.mc-career', profection.mcCareer),
  period('lilly.profection.fortune-sign-wealth', profection.fortuneSignWealth),
  period('valens.profection.transmission-lord', profection.transmissionLord),
  period('valens.transmission.topic-start', profection.topicStart),
  period('bonatti.profection.topic-significator', profection.topicSignificator),
  {
    ruleId: 'firdaria.lord-condition',
    tradition: 'western',
    requires: { birthTime: true },
    fire: (ctx) => {
      const w = western(ctx);
      return at('western-firdaria', firdariaLordCondition(w.model, w.majors(), ctx.input.span));
    },
  },
];

const TRANSIT_BINDINGS: readonly RuleBinding[] = [
  transit('valens.transit.jupiter-year-sign', jupiterYearSign),
  transit('valens.transit.benefic-malefic-year-lord', beneficMaleficYearLord),
  transit('valens.critical-year-syzygy', criticalYearSyzygy),
  transit('valens.critical-year-node', criticalYearNode, {}),
  // Lilly's day statements are read by period: a long span does not compute them (periodCharacter does).
  { ...transit('lilly.transit.daily-cusps', dailyCusps), periodRead: true },
];

const MODIFIER_BINDINGS: readonly RuleBinding[] = [
  { ruleId: 'lilly.score.strength-classes', tradition: 'western', requires: { birthTime: true }, fire: (ctx) => strengthClasses(western(ctx).model) },
  { ruleId: 'lilly.aspects.orbs-table', tradition: 'western', requires: {}, fire: (ctx) => aspectList(western(ctx).model) },
];

/** One binding per rule the engine can evaluate. */
/** The levels each rule speaks at, so that the decade grid shows a row for a level that never fires in a span. */
const LEVELS: Readonly<Record<string, readonly LevelId[]>> = {
  'lilly.score.strength-classes': ['natal'],
  'lilly.wealth.promise-strong': ['natal'],
  'lilly.wealth.promise-moderate': ['natal'],
  'lilly.wealth.promise-weak.all': ['natal'],
  'lilly.wealth.promise-weak.majority': ['natal'],
  'lilly.wealth.promise-weak.moon-combust': ['natal'],
  'lilly.profection.lord-of-year-by-degree': ['western-profection'],
  'lilly.profection.house-money': ['western-profection'],
  'lilly.profection.house-relationships': ['western-profection'],
  'lilly.profection.house-learning': ['western-profection'],
  'lilly.profection.house-travel': ['western-profection'],
  'valens.profection.transmission-lord': ['western-profection'],
  'firdaria.lord-condition': ['western-firdaria'],
  'lilly.revolution.asc-hostile': ['western-solar-return'],
  'lilly.transit.daily-cusps': ['western-transits'],
  'valens.transit.jupiter-year-sign': ['western-transits'],
  'valens.critical-year-syzygy': ['western-transits'],
  'valens.critical-year-node': ['western-transits'],
  'lilly.aspects.orbs-table': ['natal'],
  'lilly.wealth.promise-mixed': ['natal'],
  'lilly.wealth.inheritance-8th.a': ['natal'],
  'lilly.wealth.inheritance-8th.b': ['natal'],
  'lilly.wealth.inheritance-8th.c': ['natal'],
  'lilly.wealth.durability.benefic-strong': ['natal'],
  'lilly.wealth.durability.weak': ['natal'],
  'lilly.wealth.durability.infortune-strong': ['natal'],
  'lilly.wealth.durability.infortune-weak': ['natal'],
  'lilly.wealth.life-phase': ['natal'],
  'lilly.career.honour-essential': ['natal'],
  'lilly.career.honour-angularity': ['natal'],
  'lilly.career.lord1-lord10': ['natal'],
  'lilly.career.luminary-angularity.cadent': ['natal'],
  'lilly.relationships.single-life.barren': ['natal'],
  'lilly.relationships.single-life.moon-saturn': ['natal'],
  'lilly.relationships.marriage-promised': ['natal'],
  'lilly.relationships.ease': ['natal'],
  'lilly.relationships.age': ['natal'],
  'lilly.travel.promised': ['natal'],
  'lilly.profection.lord-condition': ['western-profection'],
  'lilly.profection.house-loss': ['western-profection'],
  'lilly.profection.house-health': ['western-profection'],
  'lilly.profection.angle-aspect-years': ['western-profection'],
  'lilly.profection.mc-career': ['western-profection'],
  'lilly.profection.fortune-sign-wealth': ['western-profection'],
  'bonatti.profection.topic-significator': ['western-profection'],
  'lilly.revolution.asc-same': ['western-solar-return'],
  'lilly.revolution.lord2-fortune-house': ['western-solar-return'],
  'lilly.revolution.seventh-asc': ['western-solar-return'],
  'lilly.revolution.contrary-disposition': ['western-solar-return'],
  'lilly.revolution.returns-wealth': ['western-solar-return'],
  'lilly.revolution.returns-affliction': ['western-solar-return'],
  'valens.transmission.topic-start': ['western-profection'],
  'valens.transit.benefic-malefic-year-lord': ['western-transits'],
};

export const BINDINGS: readonly RuleBinding[] = declareLevels([...NATAL_BINDINGS, ...MODIFIER_BINDINGS, ...PERIOD_BINDINGS, ...REVOLUTION_BINDINGS, ...TRANSIT_BINDINGS], LEVELS);

/** Rules deliberately not evaluated, each with the reason; the registry lists them. */
export const NOT_EVALUATED: readonly NotEvaluated[] = [
  ...NATAL_NOT_BOUND,
  {
    ruleId: 'bonatti.profection.revolution-agreement',
    reason:
      'Bonatti reads the profection and the revolution together, but he does not say how a profection comes to signify good or evil, and the framework has no verdict of a profection to give it. The rule stays unevaluated until another rule supplies that verdict.',
  },
];

/** The natal model, the profected years and the sky every rule of the tradition reads, built once per evaluation. */
export function buildContext(base: ForecastContext): WesternContext {
  return makeNatalContext(base);
}

/** Set to true when every rule of this tradition is bound or listed above; the registry test then enforces it. */
export const COMPLETE = true;
