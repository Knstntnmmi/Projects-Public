// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Bindings for the bazi rules: the code that decides, for a nativity and a span, when each
 * rule's condition in data/rules.bazi.json holds. This file is yours alone; see BINDINGS.md
 * one folder up for the interface, a worked example and the tests the registry runs.
 *
 * Part one (the natal side): month state, strength, favourable elements, the natal promise
 * of each topic and the table-driven stars. Part two (the periods): the luck pillar and year
 * judgements, the topic arrival rules, and the activation rules that test an incoming branch
 * against the natal chart. The files sit under bazi/.
 */
import type { ForecastContext } from '../context.ts';
import { NOTE } from '../phrasebook.ts';
import type { ChartNote, NotEvaluated, NotEvaluatedBranch, RuleBinding } from '../types.ts';
import { buildNatalContext, natalOf, NATAL_BINDINGS, NATAL_NOT_EVALUATED } from './bazi/natal.ts';
import { ARRIVAL_BINDINGS } from './bazi/arrivalBindings.ts';
import { PERIOD_BINDINGS } from './bazi/periodBindings.ts';
import { RELATION_BINDINGS } from './bazi/relationBindings.ts';
import { STAR_BINDINGS } from './bazi/starBindings.ts';

/** One binding per rule the engine can evaluate. */
export const BINDINGS: readonly RuleBinding[] = [...NATAL_BINDINGS, ...STAR_BINDINGS, ...PERIOD_BINDINGS, ...ARRIVAL_BINDINGS, ...RELATION_BINDINGS];

/** Rules deliberately not evaluated, each with the reason; the registry lists them. */
export const NOT_EVALUATED: readonly NotEvaluated[] = [
  ...NATAL_NOT_EVALUATED,
  {
    ruleId: 'bazi.pillar-palaces',
    reason:
      'this rule is a lookup table and not a statement: it only says which topic a clash or a combination with each natal pillar belongs to (the year pillar to the ancestors, the month pillar to the parents, the day branch to the spouse, the hour pillar to the children); that routing is already applied inside the clash and combination rules, whose sentences name the pillar struck, so the table has no sentence of its own',
  },
];

/** Parts of bound rules that are deliberately left out, each with the reason; the registry lists them beside the rules not evaluated. */
export const NOT_EVALUATED_BRANCHES: readonly NotEvaluatedBranch[] = [
  {
    ruleId: 'bazi.year-vs-day-clash',
    branch: 'the year stem overcomes the day stem (歲君犯日)',
    reason:
      'the rule file gives one sentence, which says the day stem overcomes the year stem (日犯歲君), and has no wording for the reverse case; a sentence may not say more than the rule, so only the first case is evaluated',
  },
];

/**
 * A balanced chart has no favourite element: the favourable-element method names none, so the
 * levels that judge a luck pillar or a year by the favourite say nothing for it. The note is
 * put on those levels so that the silence is seen with its reason. The luck pillar level is
 * named only where luck pillars are computed at all (a sex convention is given).
 */
export function chartNotes(ctx: ForecastContext): ChartNote[] {
  // The rules that need the birth time are withheld when it is unknown or too uncertain; a note on their silence would be about a chart no rule read.
  const u = ctx.input.birthTimeUncertaintyMinutes;
  if (u === null || u > ctx.input.forecastConventions.birthTimeLimitMinutes) return [];
  if (natalOf(ctx).strengthClass !== 'balanced') return [];
  return [{ tradition: 'bazi', levels: ctx.luck() === null ? ['bazi-year'] : ['bazi-luck', 'bazi-year'], text: NOTE.balancedChart }];
}

/**
 * Extends the base context with what this tradition's rules share: the natal assessment
 * (see bazi/assessment.ts). The period binder adds its own fields beside `natal`.
 */
export function buildContext(base: ForecastContext): unknown {
  return buildNatalContext(base);
}

/** Set to true when every rule of this tradition is bound or listed above; the registry test then enforces it. */
export const COMPLETE = true;
