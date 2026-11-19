// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/** What the Western bindings share: the natal model of the context's chart. */
import type { ForecastContext } from '../../context.ts';
import { natalFromChart, type NatalModel } from './model.ts';

export interface WesternContext {
  model: NatalModel;
}

export function makeNatalContext(base: ForecastContext): WesternContext {
  return { model: natalFromChart(base.chart()) };
}
