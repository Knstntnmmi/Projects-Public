// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * A tiny invented rule set with invented bindings, so the framework can be proved without
 * any real tradition. The rules say nothing about anything; they exist to fire in known
 * years. The nativity is the J2000 sample moment.
 */
import { makeInput, sliceSpan } from '../../src/forecast/index.ts';
import { createRegistry, type Registry, type TraditionModule } from '../../src/forecast/registry.ts';
import type { Fact, Firing, NotEvaluated, Rule, RuleBinding, RuleFile, Tradition } from '../../src/forecast/types.ts';
import { makeMoment } from '../../src/substrate/time.ts';
import { fixture } from '../../../../fixtures/moments.ts';

export const moment = (): ReturnType<typeof makeMoment> => {
  const f = fixture('j2000');
  return makeMoment(f.civil, f.zone, f.place);
};

export const FROM = 2031;
export const TO = 2040;
export const input = (extra: Partial<Parameters<typeof makeInput>[1]> = {}) => makeInput(moment(), { fromYear: FROM, toYear: TO, ...extra });

export function rule(o: Partial<Rule> & Pick<Rule, 'id' | 'tradition'>): Rule {
  return {
    name: o.id,
    stage: 'period-lord',
    condition: 'synthetic: fires in the years its binding lists',
    inputs: [],
    computable: 'now',
    topics: ['wealth'],
    direction: 'favourable',
    strength: 2,
    template: 'The {planet} period brings {thing} in {year}.',
    sourceCitation: 'synthetic',
    sourceOpened: true,
    sourceLocator: 'synthetic',
    sourceQuote: '',
    variants: 'none',
    verification: 'confirmed',
    ...o,
  };
}

const yearStart = (y: number): number => Date.UTC(y, 0, 1);

/** One firing for each listed year, covering the whole calendar year. */
export function yearFiring(year: number, clock: Firing['clock'], thing = 'a gain', extra: Partial<Firing> = {}): Firing {
  const facts: Fact[] = [
    { key: 'planet', label: 'Planet', value: 'Jupiter' },
    { key: 'thing', label: 'Thing', value: thing },
    { key: 'year', label: 'Year', value: year },
  ];
  return { clock, startUtcMs: yearStart(year), endUtcMs: yearStart(year + 1), facts, ...extra };
}

export function binding(r: Rule, clock: Firing['clock'], years: readonly number[], extra: Partial<RuleBinding> = {}, firing: Partial<Firing> = {}): RuleBinding {
  return {
    ruleId: r.id,
    tradition: r.tradition,
    fire: () => years.map((y) => yearFiring(y, clock, 'a gain', firing)),
    ...extra,
  };
}

export const R = {
  luck: rule({ id: 'synth.bazi-luck', tradition: 'bazi', strength: 3, dedupeKey: 'period-fav:luck' }),
  luckAgain: rule({ id: 'synth.bazi-luck-again', tradition: 'bazi', strength: 1, dedupeKey: 'period-fav:luck' }),
  clash: rule({ id: 'synth.bazi-clash', tradition: 'bazi', stage: 'activation', direction: 'unfavourable' }),
  natal: rule({ id: 'synth.bazi-natal', tradition: 'bazi', stage: 'natal-promise', direction: 'unfavourable', template: 'The natal chart carries {thing}.' }),
  spouse: rule({ id: 'synth.bazi-spouse', tradition: 'bazi', topics: ['relationships'], direction: 'mixed', inputs: ['sex'] }),
  modifier: rule({ id: 'synth.bazi-mod', tradition: 'bazi', stage: 'modifier', direction: 'activates' }),
  health: rule({ id: 'synth.bazi-health', tradition: 'bazi', topics: ['health'], direction: 'unfavourable', template: 'A strain on the body is shown in {year}, as a tendency.' }),
  jupiter: rule({ id: 'synth.vedic-jupiter', tradition: 'vedic' }),
  dasha: rule({ id: 'synth.vedic-dasha', tradition: 'vedic' }),
  active: rule({ id: 'synth.vedic-active', tradition: 'vedic', stage: 'activation', direction: 'activates' }),
  night: rule({ id: 'synth.vedic-lagna', tradition: 'vedic', stage: 'natal-promise', inputs: ['lagna'] }),
  iching: rule({ id: 'synth.iching', tradition: 'iching' }),
  western: rule({ id: 'synth.western-jupiter', tradition: 'western' }),
  westernUnbound: rule({ id: 'synth.western-unbound', tradition: 'western' }),
  vedicUnbound: rule({ id: 'synth.vedic-unbound', tradition: 'vedic' }),
} as const;

export const BINDINGS: Record<Tradition, RuleBinding[]> = {
  bazi: [
    binding(R.luck, 'luck', [2033, 2034]),
    binding(R.luckAgain, 'luck', [2033]),
    binding(R.clash, 'birthday', [2036, 2038]),
    {
      ruleId: R.natal.id,
      tradition: 'bazi',
      fire: () => [{ clock: 'birthday', startUtcMs: null, endUtcMs: null, facts: [{ key: 'thing', label: 'Thing', value: 'a weak root' }] }],
    },
    binding(R.spouse, 'luck', [2035], { requires: { sex: true } }),
    binding(R.modifier, 'luck', [2033]),
    binding(R.health, 'luck', [2036]),
  ],
  vedic: [binding(R.jupiter, 'jupiter-sidereal', [2033, 2037, 2038]), binding(R.dasha, 'dasha', [2036], {}, { level: 'vedic-maha' }), binding(R.active, 'jupiter-sidereal', [2040]), { ...binding(R.night, 'dasha', []), requires: { birthTime: true } }],
  iching: [binding(R.iching, 'calendar-year', [2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040])],
  western: [binding(R.western, 'jupiter-tropical', [2037, 2038])],
};

export const NOT_EVALUATED: Record<Tradition, NotEvaluated[]> = {
  bazi: [],
  vedic: [],
  iching: [],
  western: [{ ruleId: R.westernUnbound.id, reason: 'needs a house system the engine does not compute' }],
};

const rulesOf = (t: Tradition): Rule[] => Object.values(R).filter((r) => r.tradition === t);

export const FILES: RuleFile[] = (['bazi', 'vedic', 'iching', 'western'] as const).map((t) => ({ tradition: t, method: 'synthetic', topicDefinitions: [], tables: {}, rules: rulesOf(t) }));

export function modules(overrides: Partial<Record<Tradition, Partial<TraditionModule>>> = {}): Record<Tradition, TraditionModule> {
  const mod = (t: Tradition): TraditionModule => ({
    BINDINGS: BINDINGS[t],
    NOT_EVALUATED: NOT_EVALUATED[t],
    buildContext: () => undefined,
    COMPLETE: false,
    ...overrides[t],
  });
  return { bazi: mod('bazi'), vedic: mod('vedic'), iching: mod('iching'), western: mod('western') };
}

export function registry(overrides: Partial<Record<Tradition, Partial<TraditionModule>>> = {}): Registry {
  return createRegistry(FILES, modules(overrides), []);
}

export { sliceSpan };
