// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The invented forecast of the scorecard tests: the synthetic rules of synthetic.ts with the levels they
 * speak at declared, so that a technique that says nothing can be counted. Wealth statements, 2031 to 2040:
 *   BaZi luck pillar        supports 2033, 2034
 *   BaZi year pillar        cautions 2036, 2038
 *   Vedic mahadasha         supports 2036
 *   Jupiter from the Moon   supports 2033, 2037, 2038; a note without a direction in 2040
 *   Western transits        supports 2037, 2038
 *   natal chart             one natal statement that cautions (no dates)
 * Relationships: one mixed statement in 2035 (needs the sex convention, which these tests name).
 */
import { evaluate, freezeForecast, type FrozenForecast, type ForecastResult, type Session } from '../../src/forecast/index.ts';
import { createRegistry } from '../../src/forecast/registry.ts';
import { MS } from '../../src/substrate/time.ts';
import { nativityOf } from '../../../../fixtures/events.ts';
import { binding, FILES, input, modules, moment, R } from './synthetic.ts';

const levelled = [
  binding(R.luck, 'luck', [2033, 2034], { levels: ['bazi-luck'] }),
  binding(R.clash, 'birthday', [2036, 2038], { levels: ['bazi-year'] }),
  { ...binding(R.natal, 'birthday', []), fire: () => [{ clock: 'birthday' as const, startUtcMs: null, endUtcMs: null, facts: [{ key: 'thing', label: 'Thing', value: 'a weak root' }] }], levels: ['natal' as const] },
  binding(R.spouse, 'luck', [2035], { requires: { sex: true }, levels: ['bazi-luck'] }),
  binding(R.modifier, 'luck', [2033], { levels: ['bazi-luck'] }),
  binding(R.jupiter, 'jupiter-sidereal', [2033, 2037, 2038], { levels: ['jupiter-moon'] }),
  binding(R.dasha, 'dasha', [2036], { levels: ['vedic-maha'] }, { level: 'vedic-maha' }),
  binding(R.active, 'jupiter-sidereal', [2040], { levels: ['jupiter-moon'] }),
  binding(R.western, 'jupiter-tropical', [2037, 2038], { levels: ['western-transits'] }),
];

const registry = () =>
  createRegistry(
    FILES,
    modules({
      bazi: { BINDINGS: levelled.filter((b) => b.tradition === 'bazi') },
      vedic: { BINDINGS: levelled.filter((b) => b.tradition === 'vedic') },
      iching: { BINDINGS: [] },
      western: { BINDINGS: levelled.filter((b) => b.tradition === 'western') },
    }),
    [],
  );

export const result: ForecastResult = evaluate(input({ forecastConventions: { baziSexConvention: 'male-chart' } }), { registry: registry(), runs: 1 });

/** Frozen well before the first year of the span. */
export const FROZEN_AT = moment().utcMs + 11_000 * MS.DAY;

export const freeze = (at: number = FROZEN_AT): FrozenForecast => freezeForecast(result, nativityOf('j2000'), at);

export const forecastsAt = (...times: number[]): Array<{ frozen: FrozenForecast; result: ForecastResult }> => times.map((t) => ({ frozen: freeze(t), result }));

export type { Session };
