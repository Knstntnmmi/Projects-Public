// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/** What the Western bindings share: the natal model of the context's chart and the profected years of the span. */
import type { ForecastContext } from '../../context.ts';
import { longitudeOf, meanNodeLongitude } from '../../../substrate/sky.ts';
import { chartAt } from '../../../systems/western/solarReturn.ts';
import { firdaria, solarReturns, type LordSpan } from '../../../systems/western/index.ts';
import { prenatalSyzygy } from '../../../systems/western/syzygy.ts';
import { MS } from '../../../substrate/time.ts';
import { natalFromChart, type NatalModel } from './model.ts';
import type { ReturnYear } from './revolution.ts';
import type { SkyAccess } from './transits.ts';

/** One year from solar return to solar return, counted from the birthday: age k, year number k + 1. */
export interface ProfectedYear {
  k: number;
  startUtcMs: number;
  endUtcMs: number;
}

/** Everything the period rules read, as plain values so a test can build it without a date. */
export interface PeriodInput {
  model: NatalModel;
  /** Longitude of the Midheaven. */
  mc: number;
  years: readonly ProfectedYear[];
  tenthYear: 'house-table' | 'angle-aspect';
}

export interface WesternContext extends PeriodInput {
  /** The sky the transit rules read, built on first use. */
  sky(): SkyAccess;
  /** The firdaria major periods under the engine's firdariaNodes convention, built on first use. */
  majors(): LordSpan[];
  /** The solar-return chart of each year of the span from the first birthday on, built on first use. */
  returns(): ReturnYear[];
}

/** The years of the nativity that overlap the span, each from one solar return to the next. */
export function profectedYears(birthUtcMs: number, returns: readonly number[], span: { startUtcMs: number; endUtcMs: number }): ProfectedYear[] {
  const out: ProfectedYear[] = [];
  for (let k = 0; k + 1 < returns.length; k++) {
    const startUtcMs = k === 0 ? birthUtcMs : returns[k]!;
    const endUtcMs = returns[k + 1]!;
    if (endUtcMs > span.startUtcMs && startUtcMs < span.endUtcMs) out.push({ k, startUtcMs, endUtcMs });
  }
  return out;
}

export function makeNatalContext(base: ForecastContext): WesternContext {
  const { moment, span } = base.input;
  const count = Math.ceil((span.endUtcMs - moment.utcMs) / (365 * MS.DAY)) + 1;
  const returns = base.memo('western:returns', () => solarReturns(moment, count));
  const chart = base.chart();
  return {
    model: natalFromChart(chart),
    mc: chart.midheaven,
    years: profectedYears(moment.utcMs, returns, span),
    tenthYear: base.input.forecastConventions.westernTenthYear,
    sky: () =>
      base.memo('western:sky', (): SkyAccess => ({
        span,
        spans: (p) => base.ingresses(p, 'tropical'),
        lon: longitudeOf,
        node: meanNodeLongitude,
        syzygy: prenatalSyzygy(moment.utcMs),
      })),
    returns: () =>
      base.memo('western:return-charts', (): ReturnYear[] =>
        returns.flatMap((utcMs, k) => {
          if (k < 1 || utcMs >= span.endUtcMs || (returns[k + 1] ?? Infinity) <= span.startUtcMs) return [];
          const c = chartAt(moment, utcMs);
          return [{ k, utcMs, model: natalFromChart(c), mc: c.midheaven }];
        }),
      ),
    majors: () => base.memo('western:majors', () => firdaria(moment, base.input.conventions, Math.ceil((span.endUtcMs - moment.utcMs) / (365.25 * MS.DAY)) + 1).major),
  };
}
