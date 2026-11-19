// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Bindings for the vedic rules: the code that decides, for a nativity and a span, when each
 * rule's condition in data/rules.vedic.json holds. This file is yours alone; see BINDINGS.md
 * one folder up for the interface, a worked example and the tests the registry runs.
 *
 * The natal-promise rules are in vedic/natal.ts, the dasha and antardasha rules in
 * vedic/dasha.ts, the Jupiter and Saturn transits from the Moon in vedic/transit.ts.
 */
import type { ForecastContext } from '../context.ts';
import { declareLevels } from '../levels.ts';
import type { LevelId, NotEvaluated, NotEvaluatedBranch, RuleBinding } from '../types.ts';
import { DASHA_BINDINGS } from './vedic/dasha.ts';
import { buildVedicContext, NATAL_BINDINGS } from './vedic/natal.ts';
import { TRANSIT_BINDINGS } from './vedic/transit.ts';

/** One binding per rule the engine can evaluate. */
/** The levels each rule speaks at, so that the decade grid shows a row for a level that never fires in a span. */
const LEVELS: Readonly<Record<string, readonly LevelId[]>> = {
  'parashari.house-topic-map': ['natal'],
  'parashari.lagna-functional-nature': ['natal'],
  'parashari.yogakaraka-kendra-trikona': ['natal'],
  'parashari.planet-dignity': ['natal'],
  'parashari.wealth-5-9-lord-dasha': ['vedic-maha', 'vedic-antar'],
  'parashari.dasha-lord-in-wealth-houses': ['vedic-maha'],
  'parashari.dasha-lord-career-10': ['vedic-maha', 'vedic-antar'],
  'parashari.dasha-lord-education-5-9': ['vedic-maha', 'vedic-antar'],
  'parashari.dasha-lord-4th-home': ['vedic-maha'],
  'parashari.dasha-lord-travel': ['vedic-maha', 'vedic-antar'],
  'parashari.dasha-lord-7th-partnership': ['vedic-maha'],
  'parashari.dasha-lord-2nd-7th-maraka': ['vedic-maha'],
  'parashari.dasha-lord-6-8-12-lord': ['vedic-maha'],
  'parashari.dasha-lord-6-8-12-redeemed': ['vedic-maha'],
  'parashari.dasha-lord-3-11-lord': ['vedic-maha'],
  'parashari.dasha-lord-placement-natal': ['vedic-maha'],
  'parashari.dasha-lord-placement-at-start': ['vedic-maha'],
  'parashari.dasha-lord-association': ['vedic-maha'],
  'parashari.lagna-karma-lord-exchange': ['natal'],
  'parashari.node-dasha': ['vedic-maha'],
  'parashari.dasha-timing-within-period': ['vedic-maha'],
  'parashari.antardasha-from-dasha-lord-dusthana': ['vedic-antar'],
  'parashari.antardasha-from-dasha-lord-kendra': ['vedic-antar'],
  'parashari.antardasha-lord-strength': ['vedic-antar'],
  'parashari.antardasha-maraka': ['vedic-antar'],
  'parashari.jupiter-transit-good': ['jupiter-moon'],
  'parashari.jupiter-transit-other': ['jupiter-moon'],
  'parashari.jupiter-vedha': ['jupiter-moon'],
  'parashari.saturn-transit-good': ['saturn-moon'],
  'parashari.saturn-12th-from-moon': ['saturn-moon'],
  'parashari.saturn-1st-from-moon': ['saturn-moon'],
  'parashari.saturn-2nd-from-moon': ['saturn-moon'],
  'parashari.saturn-8th-from-moon': ['saturn-moon'],
  'parashari.saturn-transit-other': ['saturn-moon'],
  'parashari.saturn-vedha': ['saturn-moon'],
  'parashari.transit-sign-portion': ['saturn-moon', 'jupiter-moon'],
};

export const BINDINGS: readonly RuleBinding[] = declareLevels([...NATAL_BINDINGS, ...DASHA_BINDINGS, ...TRANSIT_BINDINGS], LEVELS);

/** Rules deliberately not evaluated, each with the reason; the registry lists them. */
export const NOT_EVALUATED: readonly NotEvaluated[] = [];

/**
 * Branches of bound rules that are left out, each with the reason; the registry lists them beside
 * the rules not evaluated, and a test checks that none of them fires. Each says why in plain words.
 */
export const NOT_EVALUATED_BRANCHES: readonly NotEvaluatedBranch[] = [
  {
    ruleId: 'parashari.dasha-lord-3-11-lord',
    branch: 'the mahadasha lord sits in, or is joined to, a planet that owns the 3rd, 6th or 11th house',
    reason: 'the sentence of the rule says that the planet owns the house, which would be false for a planet that only sits in or is joined to one; only the owner is evaluated',
  },
  {
    ruleId: 'parashari.dasha-lord-2nd-7th-maraka',
    branch: 'the mahadasha lord is joined to the 2nd or 7th lord while that lord sits in the 2nd or 7th',
    reason: 'the sentence of the rule says that the planet is the lord of the 2nd or 7th, which would be false for a planet only joined to one; only the lord itself is evaluated',
  },
  {
    ruleId: 'parashari.dasha-lord-association',
    branch: 'the mahadasha lord is aspected by a malefic or a benefic',
    reason: 'the rule file limits aspect to the full seventh until a later chapter is read, and the sentence of the rule says "joined by", so only a planet in the same sign is evaluated',
  },
  {
    ruleId: 'parashari.dasha-lord-association',
    branch: 'the mahadasha lord is joined to Rahu or Ketu',
    reason: 'the nodes own no house and the source gives them no natural nature, so neither a raising nor a lowering can be stated for them',
  },
  {
    ruleId: 'parashari.dasha-lord-association',
    branch: 'the joined planet owns both a raising and a lowering house and the Lagna table names no functional nature for it',
    reason: 'the rule gives opposite statements for such a planet; the functional nature of the planet for this Lagna (the table of Chapter 34) settles it, and where that table is silent nothing is said',
  },
  {
    ruleId: 'parashari.node-dasha',
    branch: 'the mahadasha lord is Ketu',
    reason: 'the rule file says the Ketu verses were not read and that treating Ketu like Rahu is an assumption, so no statement is made for a Ketu period',
  },
  {
    ruleId: 'parashari.node-dasha',
    branch: 'Rahu in exaltation or in debility',
    reason: 'the rule names Taurus as the exaltation of Rahu and gives no sign for its debility, and the sources differ on the signs of the nodes, so the dignity of Rahu is not assessed',
  },
  {
    ruleId: 'parashari.node-dasha',
    branch: 'the timing of an afflicted Rahu: loss at the start, relief in the middle, distress at the end',
    reason: 'the statement of the rule covers the whole period; the timing within a period is carried by parashari.dasha-timing-within-period for every mahadasha lord, and is not repeated here',
  },
  {
    ruleId: 'parashari.wealth-5-9-lord-dasha',
    branch: 'a node as mahadasha or antardasha lord, joined to the lord of the 5th or 9th',
    reason: 'the rule needs the lord not to be debilitated, and the debility of a node cannot be tested because the sources differ on its sign',
  },
  {
    ruleId: 'parashari.dasha-lord-placement-natal',
    branch: 'the mahadasha lord is Rahu or Ketu',
    reason: 'the rule combines the house with the dignity of the planet, and the dignity of a node is not assessed',
  },
  {
    ruleId: 'parashari.dasha-lord-placement-at-start',
    branch: 'the mahadasha lord is Rahu or Ketu',
    reason: 'the rule combines the house with the dignity of the planet, and the dignity of a node is not assessed',
  },
  {
    ruleId: 'parashari.antardasha-lord-strength',
    branch: 'the antardasha lord is Rahu or Ketu',
    reason: 'the rule asks for the dignity of the planet, and the dignity of a node is not assessed',
  },
];

/**
 * Extends the base context with what this tradition's rules share (tables, derived chart
 * facts). Runs once per evaluation, on first use. Here: the sidereal house model.
 */
export function buildContext(base: ForecastContext): unknown {
  return buildVedicContext(base);
}

/** Set to true when every rule of this tradition is bound or listed above; the registry test then enforces it. */
export const COMPLETE = true;
