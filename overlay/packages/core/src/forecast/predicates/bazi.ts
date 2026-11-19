// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Bindings for the bazi rules: the code that decides, for a nativity and a span, when each
 * rule's condition in data/rules.bazi.json holds. This file is yours alone; see BINDINGS.md
 * one folder up for the interface, a worked example and the tests the registry runs.
 *
 * Part one (the natal side) is bound: month state, strength, favourable elements, the
 * natal promise of each topic and the table-driven stars. The period rules (luck pillar,
 * year, relations of the incoming pillar) are the next part and are not bound here.
 */
import type { ForecastContext } from '../context.ts';
import type { NotEvaluated, RuleBinding } from '../types.ts';
import { buildNatalContext, NATAL_BINDINGS, NATAL_NOT_EVALUATED } from './bazi/natal.ts';
import { STAR_BINDINGS } from './bazi/starBindings.ts';

/** One binding per rule the engine can evaluate. */
export const BINDINGS: readonly RuleBinding[] = [...NATAL_BINDINGS, ...STAR_BINDINGS];

/** Rules deliberately not evaluated, each with the reason; the registry lists them. */
export const NOT_EVALUATED: readonly NotEvaluated[] = [...NATAL_NOT_EVALUATED];

/**
 * Extends the base context with what this tradition's rules share: the natal assessment
 * (see bazi/assessment.ts). The period binder adds its own fields beside `natal`.
 */
export function buildContext(base: ForecastContext): unknown {
  return buildNatalContext(base);
}

/** Set to true when every rule of this tradition is bound or listed above; the registry test then enforces it. */
export const COMPLETE = false;
