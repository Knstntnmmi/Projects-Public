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
import type { NotEvaluated, RuleBinding } from '../types.ts';
import { DASHA_BINDINGS } from './vedic/dasha.ts';
import { buildVedicContext, NATAL_BINDINGS } from './vedic/natal.ts';
import { TRANSIT_BINDINGS } from './vedic/transit.ts';

/** One binding per rule the engine can evaluate. */
export const BINDINGS: readonly RuleBinding[] = [...NATAL_BINDINGS, ...DASHA_BINDINGS, ...TRANSIT_BINDINGS];

/** Rules deliberately not evaluated, each with the reason; the registry lists them. */
export const NOT_EVALUATED: readonly NotEvaluated[] = [];

/**
 * Extends the base context with what this tradition's rules share (tables, derived chart
 * facts). Runs once per evaluation, on first use. Here: the sidereal house model.
 */
export function buildContext(base: ForecastContext): unknown {
  return buildVedicContext(base);
}

/** Set to true when every rule of this tradition is bound or listed above; the registry test then enforces it. */
export const COMPLETE = true;
