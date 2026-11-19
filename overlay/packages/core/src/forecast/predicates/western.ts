// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Bindings for the western rules: the code that decides, for a nativity and a span, when each
 * rule's condition in data/rules.western.json holds. The rules are Lilly's, run on Lilly's own
 * tables (systems/western/lillyDignity.ts, lillyFortitude.ts, aspects.ts) with whole-sign
 * houses as a labelled variant; see BINDINGS.md one folder up for the interface.
 *
 * The natal-promise rules are in western/natal.ts. The period, activation and modifier rules
 * are not bound yet.
 */
import type { ForecastContext } from '../context.ts';
import type { NotEvaluated, RuleBinding } from '../types.ts';
import { makeNatalContext, type WesternContext } from './western/context.ts';
import { NATAL_BINDINGS, NATAL_NOT_BOUND } from './western/natal.ts';

/** One binding per rule the engine can evaluate. */
export const BINDINGS: readonly RuleBinding[] = [...NATAL_BINDINGS];

/** Rules deliberately not evaluated, each with the reason; the registry lists them. */
export const NOT_EVALUATED: readonly NotEvaluated[] = [...NATAL_NOT_BOUND];

/** The natal model every rule of the tradition reads, built once per evaluation. */
export function buildContext(base: ForecastContext): WesternContext {
  return makeNatalContext(base);
}

/** Set to true when every rule of this tradition is bound or listed above; the registry test then enforces it. */
export const COMPLETE = false;
