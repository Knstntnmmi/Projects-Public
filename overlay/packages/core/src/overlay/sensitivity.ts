// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Sensitivity: how far the moment is, in minutes of clock time, from the nearest point
 * at which each discrete fact would come out differently; and which facts change under
 * each alternative convention.
 */
import { alternatives, CONVENTION_SPECS, type Conventions } from '../conventions.ts';
import { angles, bisectChange, longitudeOf, norm360 } from '../substrate/sky.ts';
import { julianDayNumber, MS, zoneOffsetMinutes, fieldsFromUtcMs, type Moment } from '../substrate/time.ts';
import { fourPillars, luck, type Sex } from '../systems/bazi/index.ts';
import { mayaDate, weekday } from '../systems/calendars/index.ts';
import { GATE_SEQUENCE, GATE_START, GUA_QI_SEQUENCE, GUA_QI_START, guaQiSpans, SOVEREIGN_SEQUENCE, sovereignStart, wheelPosition } from '../systems/iching/index.ts';
import { nakshatraOf } from '../systems/vedic/index.ts';
import { chart, firdariaOrder, planetaryHour, signOf } from '../systems/western/index.ts';
import type { SystemId } from './rings.ts';

export interface Neighbour {
  /** Minutes from the moment to the change (always positive). */
  minutes: number;
  /** The value on the far side of the change. */
  value: string;
}

export interface SensitivityRow {
  id: string;
  system: SystemId;
  fact: string;
  value: string;
  /** Nearest change looking earlier, or null if none within the search horizon. */
  earlier: Neighbour | null;
  /** Nearest change looking later. */
  later: Neighbour | null;
  /** The smaller of the two distances, in minutes. */
  nearestMinutes: number | null;
  /** True when the nearest change lies inside the stated uncertainty of the time. */
  withinUncertainty: boolean;
  /**
   * True when the nearest change lies inside the engine's own margin of error, so that
   * the value cannot be trusted whatever the quality of the clock time.
   */
  withinEngineMargin: boolean;
}

/**
 * The engine's own margin, in minutes, for facts that depend on where a body is. Solar
 * terms from this engine agree with the Shouxing ephemeris to thirteen seconds on
 * average and about a minute at worst between 1600 and 2100; two minutes is taken as
 * the distance inside which a boundary should be treated as undecided.
 */
export const ENGINE_MARGIN_MINUTES = 2;

interface FactDef {
  id: string;
  system: SystemId;
  fact: string;
  /** 'sky' facts depend on a computed position; 'clock' facts are exact arithmetic on a clock reading. */
  kind: 'sky' | 'clock';
  at: (utcMs: number) => string;
}

const HORIZON_DAYS = 40;

/** Offsets, in minutes, at which the scan samples: fine near the moment, coarser further out. */
function scanOffsets(): number[] {
  const out: number[] = [];
  for (let m = 1; m <= 90; m++) out.push(m);
  for (let m = 100; m <= 24 * 60; m += 10) out.push(m);
  for (let m = 24 * 60 + 360; m <= HORIZON_DAYS * 24 * 60; m += 360) out.push(m);
  return out;
}
const OFFSETS = scanOffsets();

function neighbour(def: FactDef, utcMs: number, direction: 1 | -1, here: string): Neighbour | null {
  let prev = 0;
  for (const m of OFFSETS) {
    const t = utcMs + direction * m * MS.MIN;
    if (def.at(t) !== here) {
      const inner = utcMs + direction * prev * MS.MIN;
      const [lo, hi] = direction === 1 ? [inner, t] : [t, inner];
      const change = bisectChange(def.at, lo, hi);
      // Looking later, the value past the change is at `change`; looking earlier, it is just before it.
      const value = def.at(direction === 1 ? change : change - 1000);
      return { minutes: Math.abs(change - utcMs) / MS.MIN, value };
    }
    prev = m;
  }
  return null;
}

function guaQiHanzi(ms: number, conventions: Conventions): string {
  return conventions.guaQi === 'equal-longitude'
    ? wheelPosition(GUA_QI_SEQUENCE, GUA_QI_START, longitudeOf('Sun', ms)).hexagram.hanzi
    : guaQiSpans(ms, ms + 1, conventions.guaQi)[0]!.hexagram.hanzi;
}

function sovereignHanzi(ms: number, conventions: Conventions): string {
  return wheelPosition(SOVEREIGN_SEQUENCE, sovereignStart(conventions.sovereignBoundary), longitudeOf('Sun', ms)).hexagram.hanzi;
}

function factDefs(moment: Moment, conventions: Conventions): FactDef[] {
  const at = (utcMs: number): Moment => ({ ...moment, utcMs });
  const pillar = (which: 'year' | 'month' | 'day' | 'hour') => (ms: number): string => fourPillars(at(ms), conventions)[which].hanzi;
  const sign = (l: number): string => signOf(l).sign;
  return [
    { id: 'bazi.hour', kind: 'clock', system: 'chinese', fact: 'Hour pillar', at: pillar('hour') },
    { id: 'bazi.day', kind: 'clock', system: 'chinese', fact: 'Day pillar', at: pillar('day') },
    { id: 'bazi.month', kind: 'sky', system: 'chinese', fact: 'Month pillar', at: pillar('month') },
    { id: 'bazi.year', kind: 'sky', system: 'chinese', fact: 'Year pillar', at: pillar('year') },
    { id: 'western.ascendant', kind: 'sky', system: 'western', fact: 'Rising sign', at: (ms) => sign(angles(ms, moment.place).ascendant) },
    { id: 'western.midheaven', kind: 'sky', system: 'western', fact: 'Midheaven sign', at: (ms) => sign(angles(ms, moment.place).midheaven) },
    {
      id: 'western.sect',
      kind: 'sky',
      system: 'western',
      fact: 'Sect',
      at: (ms) => (norm360(longitudeOf('Sun', ms) - angles(ms, moment.place).ascendant) > 180 ? 'day chart' : 'night chart'),
    },
    { id: 'western.moon', kind: 'sky', system: 'western', fact: 'Moon sign', at: (ms) => sign(longitudeOf('Moon', ms)) },
    { id: 'western.sun', kind: 'sky', system: 'western', fact: 'Sun sign', at: (ms) => sign(longitudeOf('Sun', ms)) },
    {
      id: 'western.planetary-hour',
      kind: 'sky',
      system: 'western',
      fact: 'Planetary hour',
      at: (ms) => {
        const h = planetaryHour(at(ms));
        return h ? `${h.hourRuler} (day of ${h.dayRuler})` : 'undefined here';
      },
    },
    {
      id: 'vedic.nakshatra',
      kind: 'sky',
      system: 'vedic',
      fact: 'Moon nakshatra and first dasha lord',
      at: (ms) => {
        const n = nakshatraOf(longitudeOf('Moon', ms), ms);
        return `${n.name} (${n.lord})`;
      },
    },
    {
      id: 'vedic.pada',
      kind: 'sky',
      system: 'vedic',
      fact: 'Moon nakshatra quarter',
      at: (ms) => {
        const n = nakshatraOf(longitudeOf('Moon', ms), ms);
        return `${n.name} pada ${n.pada}`;
      },
    },
    {
      id: 'iching.gate',
      kind: 'sky',
      system: 'iching',
      fact: 'Sun on the gate wheel',
      at: (ms) => {
        const p = wheelPosition(GATE_SEQUENCE, GATE_START, longitudeOf('Sun', ms));
        return `${p.hexagram.number}.${p.line} ${p.hexagram.hanzi}`;
      },
    },
    {
      id: 'iching.gua-qi',
      kind: 'sky',
      system: 'iching',
      fact: 'Gua qi hexagram',
      at: (ms) => guaQiHanzi(ms, conventions),
    },
    {
      id: 'iching.sovereign',
      kind: 'sky',
      system: 'iching',
      fact: 'Sovereign hexagram',
      at: (ms) => sovereignHanzi(ms, conventions),
    },
    {
      id: 'calendar.weekday',
      kind: 'clock',
      system: 'calendar',
      fact: 'Weekday and Maya day (civil date)',
      at: (ms) => {
        const c = fieldsFromUtcMs(ms + zoneOffsetMinutes(ms, moment.zone) * MS.MIN);
        const jdn = julianDayNumber(c.year, c.month, c.day);
        const maya = mayaDate(jdn, conventions.mayaCorrelation);
        return `${weekday(jdn)}, ${maya.tzolkin.number} ${maya.tzolkin.name}`;
      },
    },
  ];
}

export function sensitivity(moment: Moment, conventions: Conventions, uncertaintyMinutes = 0): SensitivityRow[] {
  return factDefs(moment, conventions).map((def) => {
    const value = def.at(moment.utcMs);
    const earlier = neighbour(def, moment.utcMs, -1, value);
    const later = neighbour(def, moment.utcMs, 1, value);
    const distances = [earlier?.minutes, later?.minutes].filter((x): x is number => x !== undefined);
    const nearestMinutes = distances.length ? Math.min(...distances) : null;
    return {
      id: def.id,
      system: def.system,
      fact: def.fact,
      value,
      earlier,
      later,
      nearestMinutes,
      withinUncertainty: nearestMinutes !== null && nearestMinutes <= uncertaintyMinutes,
      withinEngineMargin: def.kind === 'sky' && nearestMinutes !== null && nearestMinutes <= ENGINE_MARGIN_MINUTES,
    };
  });
}

// ---------------------------------------------------------------------------
// Convention effects
// ---------------------------------------------------------------------------

/** The outputs that conventions can change, flattened to strings for comparison. */
export function digest(moment: Moment, conventions: Conventions, sex?: Sex): Record<string, string> {
  const p = fourPillars(moment, conventions);
  const c = fieldsFromUtcMs(moment.utcMs + zoneOffsetMinutes(moment.utcMs, moment.zone) * MS.MIN);
  const out: Record<string, string> = {
    'Year pillar': p.year.hanzi,
    'Month pillar': p.month.hanzi,
    'Day pillar': p.day.hanzi,
    'Hour pillar': p.hour.hanzi,
    'Gua qi hexagram': guaQiHanzi(moment.utcMs, conventions),
    'Sovereign hexagram': sovereignHanzi(moment.utcMs, conventions),
    'Firdaria order': firdariaOrder(chart(moment).isDayChart, conventions.firdariaNodes).join(', '),
    'Maya date': mayaDate(julianDayNumber(c.year, c.month, c.day), conventions.mayaCorrelation).text,
  };
  if (sex) {
    const l = luck(moment, conventions, sex);
    out['First luck pillar'] = l.pillars[0]!.cycle.hanzi;
    out['Luck pillars begin'] = new Date(l.startUtcMs).toISOString().slice(0, 10);
  }
  return out;
}

export interface ConventionEffect {
  key: keyof Conventions;
  title: string;
  value: string | number;
  label: string;
  /** Outputs that differ from the result under the conventions in use. */
  changes: Array<{ output: string; from: string; to: string }>;
}

/** What each alternative convention would change, one convention at a time. */
export function conventionEffects(moment: Moment, conventions: Conventions, sex?: Sex): ConventionEffect[] {
  const base = digest(moment, conventions, sex);
  return alternatives(conventions).map((alt) => {
    const other = digest(moment, alt.conventions, sex);
    const spec = CONVENTION_SPECS.find((s) => s.key === alt.key)!;
    return {
      key: alt.key,
      title: spec.title,
      value: alt.value,
      label: spec.options.find((o) => o.value === alt.value)!.label,
      changes: Object.keys(base)
        .filter((k) => base[k] !== other[k])
        .map((k) => ({ output: k, from: base[k]!, to: other[k]! })),
    };
  });
}
