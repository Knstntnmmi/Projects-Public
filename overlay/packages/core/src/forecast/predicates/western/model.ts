// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The nativity as the Western rules read it: seven planets, the Ascendant, the sect and the
 * Dragon's Head, with whole-sign houses (a labelled variant: Lilly used Regiomontanus cusps,
 * which the engine does not compute) and Lilly's own tables for strength. It is built from
 * plain longitudes, so a test can construct a chart without going through a date.
 */
import { PLANETS, type Planet } from '../../../substrate/sky.ts';
import { aspectBetween, isApplying, type Aspect } from '../../../systems/western/aspects.ts';
import type { Chart } from '../../../systems/western/index.ts';
import {
  essentialItems,
  essentialScore,
  holdsDignity,
  houseLord,
  mutualReception,
  strengthClass,
  type EssentialItem,
  type StrengthClass,
} from '../../../systems/western/lillyDignity.ts';
import { accidentalItems, accidentalScore, isOriental, type AccidentalItem, type BodyState } from '../../../systems/western/lillyFortitude.ts';

export interface NatalSpec {
  /** Ascendant longitude, degrees. */
  ascendant: number;
  /** Longitude of each of the seven planets. */
  longitudes: Record<Planet, number>;
  /** Default false. */
  retrograde?: Partial<Record<Planet, boolean>>;
  /** Daily motion in degrees; a planet not given moves at its mean forward rate, or backward at a tenth of a degree if retrograde. */
  speeds?: Partial<Record<Planet, number>>;
  /** Day chart if the Sun is above the horizon; derived from the Sun and the Ascendant if not given. */
  isDay?: boolean;
  /** Dragon's Head; default 0 (the first of Aries), which a test may leave alone. */
  head?: number;
}

const MEAN_RATE: Record<Planet, number> = { Sun: 0.9856, Moon: 13.18, Mercury: 1.2, Venus: 1.2, Mars: 0.52, Jupiter: 0.08, Saturn: 0.03 };

const norm = (x: number): number => ((x % 360) + 360) % 360;
const signOfLon = (l: number): number => Math.floor(norm(l) / 30) % 12;

export const ANGULAR = [1, 4, 7, 10] as const;
export const SUCCEDENT = [2, 5, 8, 11] as const;
export const CADENT = [3, 6, 9, 12] as const;

export interface NatalModel {
  readonly ascendant: number;
  readonly ascSign: number;
  readonly isDay: boolean;
  readonly head: number;
  lon(p: Planet): number;
  speed(p: Planet): number;
  retrograde(p: Planet): boolean;
  signOf(p: Planet): number;
  /** Whole-sign house of a planet, 1 to 12. */
  houseOf(p: Planet): number;
  /** Planets in a whole-sign house, in the order Sun to Saturn. */
  planetsIn(house: number): Planet[];
  /** Index (0 to 11) of the sign that makes a house. */
  signOfHouse(house: number): number;
  /** Domicile lord (Lilly's table) of the sign of a house. */
  lordOfHouse(house: number): Planet;
  /** Part of Fortune: Asc + Moon - Sun by day, Asc + Sun - Moon by night. */
  fortune(): number;
  essential(p: Planet): number;
  essentialItems(p: Planet): EssentialItem[];
  accidental(p: Planet): number;
  accidentalItems(p: Planet): AccidentalItem[];
  cls(p: Planet): StrengthClass;
  /** Oriental of the Sun (rising before it); null for the Sun. */
  oriental(p: Planet): boolean | null;
  aspect(a: Planet, b: Planet): Aspect | null;
  applying(a: Planet, b: Planet): boolean;
  /** A planet stands in a dignity (any of the five) of Jupiter or Venus. */
  inFortuneDignity(p: Planet): boolean;
  receptionBetween(a: Planet, b: Planet): 'house' | 'exaltation' | null;
  /** The Moon is combust: in the Sun's sign within 8 deg 30', and not cazimi. */
  moonCombust(): boolean;
}

export function makeNatal(spec: NatalSpec): NatalModel {
  const { longitudes } = spec;
  const ascSign = signOfLon(spec.ascendant);
  const isDay = spec.isDay ?? norm(longitudes.Sun - spec.ascendant) > 180;
  const head = spec.head ?? 0;
  const retro = (p: Planet): boolean => spec.retrograde?.[p] ?? false;
  const speed = (p: Planet): number => spec.speeds?.[p] ?? (retro(p) ? -0.1 : MEAN_RATE[p]);
  const houseOf = (p: Planet): number => ((signOfLon(longitudes[p]) - ascSign + 12) % 12) + 1;
  const bodies: BodyState[] = PLANETS.map((planet) => ({ planet, longitude: longitudes[planet], retrograde: retro(planet), house: houseOf(planet) }));
  const fortuneChart = { isDay, bodies, head };
  const memo = new Map<string, unknown>();
  const once = <T>(key: string, f: () => T): T => {
    if (!memo.has(key)) memo.set(key, f());
    return memo.get(key) as T;
  };
  const m: NatalModel = {
    ascendant: spec.ascendant,
    ascSign,
    isDay,
    head,
    lon: (p) => longitudes[p],
    speed,
    retrograde: retro,
    signOf: (p) => signOfLon(longitudes[p]),
    houseOf,
    planetsIn: (house) => PLANETS.filter((p) => houseOf(p) === house),
    signOfHouse: (house) => (ascSign + house - 1) % 12,
    lordOfHouse: (house) => houseLord((ascSign + house - 1) % 12),
    fortune: () => norm(isDay ? spec.ascendant + longitudes.Moon - longitudes.Sun : spec.ascendant + longitudes.Sun - longitudes.Moon),
    essential: (p) => once(`E${p}`, () => essentialScore(p, longitudes[p], isDay)),
    essentialItems: (p) => essentialItems(p, longitudes[p], isDay),
    accidental: (p) => once(`A${p}`, () => accidentalScore(p, fortuneChart)),
    accidentalItems: (p) => accidentalItems(p, fortuneChart),
    cls: (p) => strengthClass(m.essential(p)),
    oriental: (p) => isOriental(p, longitudes[p], longitudes.Sun),
    aspect: (a, b) => (a === b ? null : aspectBetween(a, longitudes[a], b, longitudes[b])),
    applying: (a, b) => {
      const asp = m.aspect(a, b);
      return asp !== null && isApplying(longitudes[a], speed(a), longitudes[b], speed(b), asp.angle);
    },
    inFortuneDignity: (p) => holdsDignity('Jupiter', longitudes[p], isDay) || holdsDignity('Venus', longitudes[p], isDay),
    receptionBetween: (a, b) => mutualReception(a, longitudes[a], b, longitudes[b]),
    moonCombust: () => {
      const sep = Math.abs(((longitudes.Moon - longitudes.Sun + 540) % 360) - 180);
      return signOfLon(longitudes.Moon) === signOfLon(longitudes.Sun) && sep <= 8.5 && sep > 17 / 60;
    },
  };
  return m;
}

/** The model of an engine chart. */
export function natalFromChart(chart: Chart): NatalModel {
  const longitudes = {} as Record<Planet, number>;
  const retrograde: Partial<Record<Planet, boolean>> = {};
  const speeds: Partial<Record<Planet, number>> = {};
  for (const p of chart.positions) {
    longitudes[p.planet] = p.longitude;
    retrograde[p.planet] = p.retrograde;
    speeds[p.planet] = p.speed;
  }
  return makeNatal({ ascendant: chart.ascendant, longitudes, retrograde, speeds, isDay: chart.isDayChart, head: chart.northNode });
}

/** "A", "A and B", "A, B and C". */
export const joinList = (xs: readonly (string | number)[]): string => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
