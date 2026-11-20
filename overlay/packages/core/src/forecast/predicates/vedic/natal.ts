// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The natal-promise rules of rules.vedic.json: the house map, functional nature by rising
 * sign, the kendra-trikona link and dignity. They are undated: they describe the chart,
 * never a period, so they carry no slice and give no reading its sign. All four need the
 * rising sign, so all four need the birth time.
 */
import type { ForecastContext } from '../../context.ts';
import { GRAHAS, NODES, SIGN_NAMES, isGraha, printableHouseTopics, vedicChartModel, type Placement, type VedicChartModel } from '../../../systems/vedic/houses.ts';
import type { Firing, RuleBinding } from '../../types.ts';

export interface VedicContext {
  model: VedicChartModel;
}

/** The sidereal chart of the context as the plain placements the house model reads. */
export function buildVedicContext(base: ForecastContext): VedicContext {
  const sc = base.siderealChart();
  const placements: Placement[] = sc.points.map((p) => ({ planet: p.name, signIndex: p.signIndex, degree: p.degree }));
  return { model: vedicChartModel(sc.lagna.signIndex, placements) };
}

const model = (ctx: ForecastContext): VedicChartModel => ctx.extension<VedicContext>('vedic')!.model;

/** All natal firings share one clock and no dates; the dedupe instance says which fact each one is. */
const natal = (facts: Firing['facts'], instance: string, conventionsUsed: string[] = ['ayanamsa']): Firing => ({
  clock: 'dasha',
  startUtcMs: null,
  endUtcMs: null,
  facts,
  dedupeInstance: instance,
  conventionsUsed,
});

const join = (xs: readonly (string | number)[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

const relation = (m: VedicChartModel, planet: string, h: number): string =>
  [isGraha(planet) && m.housesOwnedBy(planet).includes(h) ? 'owns' : null, m.houseOf(planet) === h ? 'occupies' : null].filter(Boolean).join(' and ');

const houseTopicMap: RuleBinding = {
  ruleId: 'parashari.house-topic-map',
  tradition: 'vedic',
  requires: { birthTime: true },
  fire(ctx) {
    const m = model(ctx);
    const out: Firing[] = [];
    for (const planet of [...GRAHAS, ...NODES]) {
      const houses = new Set<number>([m.houseOf(planet)]);
      if (isGraha(planet)) for (const h of m.housesOwnedBy(planet)) houses.add(h);
      for (const h of [...houses].sort((a, b) => a - b)) {
        out.push(
          natal(
            [
              { key: 'planet', label: 'Planet', value: planet },
              { key: 'h', label: 'House from the Lagna', value: h },
              { key: 'topics', label: 'House concerns', value: printableHouseTopics(h).join(', ') },
              { key: 'relation', label: 'Owns or occupies', value: relation(m, planet, h) },
            ],
            `${planet}-${h}`,
            ['ayanamsa', 'vedicNode'],
          ),
        );
      }
    }
    return out;
  },
};

const functionalNature: RuleBinding = {
  ruleId: 'parashari.lagna-functional-nature',
  tradition: 'vedic',
  requires: { birthTime: true },
  fire(ctx) {
    const m = model(ctx);
    const yk = new Set(m.yogakarakas());
    const out: Firing[] = [];
    for (const planet of GRAHAS) {
      const nature = m.functionalNature(planet);
      if (nature === 'unstated') continue; // the per-Lagna list is silent: unstated, not neutral
      out.push(
        natal(
          [
            { key: 'lagna', label: 'Rising sign', value: SIGN_NAMES[m.lagnaSign]! },
            { key: 'planet', label: 'Planet', value: planet },
            { key: 'nature', label: 'Functional nature', value: nature },
            { key: 'houses', label: 'Houses owned', value: join(m.housesOwnedBy(planet)) },
            { key: 'yogakaraka', label: 'Owns a kendra and a trikona', value: yk.has(planet) ? 'yes' : 'no' },
          ],
          planet,
        ),
      );
    }
    return out;
  },
};

const yogaLink: RuleBinding = {
  ruleId: 'parashari.yogakaraka-kendra-trikona',
  tradition: 'vedic',
  requires: { birthTime: true },
  fire(ctx) {
    const m = model(ctx);
    const yk = m.yogakarakas();
    return m
      .yogaLinks()
      .filter((l) => !l.cancelled)
      .map((l) =>
        natal(
          [
            { key: 'p1', label: 'Kendra lord', value: l.kendraLord },
            { key: 'p2', label: 'Trikona lord', value: l.trikonaLord },
            { key: 'h1', label: 'Kendra house', value: l.kendraHouse },
            { key: 'h2', label: 'Trikona house', value: l.trikonaHouse },
            { key: 'planet', label: 'Yogakaraka of the chart', value: yk.length > 0 ? join(yk) : 'no single planet' },
            { key: 'via', label: 'Link by', value: l.via.join('; ') },
          ],
          `${l.kendraLord}-${l.kendraHouse}-${l.trikonaLord}-${l.trikonaHouse}`,
        ),
      );
  },
};

const dignity: RuleBinding = {
  ruleId: 'parashari.planet-dignity',
  tradition: 'vedic',
  requires: { birthTime: true },
  fire(ctx) {
    const m = model(ctx);
    return GRAHAS.map((planet) => {
      const d = m.dignity(planet);
      const word =
        d.kind === 'exalted' || d.kind === 'debilitated' ? d.kind : d.kind === 'moolatrikona' ? 'in its moolatrikona' : d.kind === 'own sign' ? 'in its own sign' : d.kind === 'neutral' ? 'in a neutral sign' : `in the sign of ${d.kind === 'enemy' ? 'an' : 'a'} ${d.kind}`;
      const facts: Firing['facts'] = [
        { key: 'planet', label: 'Planet', value: planet },
        { key: 'dignity', label: 'Dignity', value: word },
        { key: 'deg', label: 'Degree in the sign', value: Math.round(d.degree * 100) / 100, unit: 'degrees' },
        { key: 'sign', label: 'Sidereal sign', value: SIGN_NAMES[d.signIndex]! },
      ];
      if (d.fromDeepPoint !== null) facts.push({ key: 'fromDeepPoint', label: 'Distance from the deep point', value: d.fromDeepPoint, unit: 'degrees' });
      return natal(facts, planet);
    });
  },
};

export const NATAL_BINDINGS: readonly RuleBinding[] = [houseTopicMap, functionalNature, yogaLink, dignity];
