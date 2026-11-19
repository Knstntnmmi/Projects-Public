// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Bindings for the western rules: the code that decides, for a nativity and a span, when each
 * rule's condition in data/rules.western.json holds. This file is yours alone; see BINDINGS.md
 * one folder up for the interface, a worked example and the tests the registry runs.
 *
 * Nothing is bound yet.
 */
import type { ForecastContext } from '../context.ts';
import type { NotEvaluated, RuleBinding } from '../types.ts';

/** One binding per rule the engine can evaluate. */
export const BINDINGS: readonly RuleBinding[] = [];

/** Rules deliberately not evaluated, each with the reason; the registry lists them. */
export const NOT_EVALUATED: readonly NotEvaluated[] = [];

/**
 * Extends the base context with what this tradition's rules share (tables, derived chart
 * facts). Runs once per evaluation, on first use. Nothing yet.
 */
export function buildContext(_base: ForecastContext): unknown {
  return undefined;
}

/** Set to true when every rule of this tradition is bound or listed above; the registry test then enforces it. */
export const COMPLETE = false;
