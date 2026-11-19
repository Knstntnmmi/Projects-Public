// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The Western transit and critical-year rules: Valens on Jupiter and on the malefics and
 * benefics in the year sign, his critical years (the prenatal lunation and the nodes), and
 * Lilly's passes of the planets over the angles and radical places by day. Transits run on
 * the tropical sky clocks, the sign stays from the engine's own ingress function, and the
 * year (one profected sign) comes from the birthday, so a firing is dated by the part of the
 * year in which the planet stands where the rule wants it.
 *
 * Each rule is a pure function of a PeriodInput and a SkyAccess, so a test can supply a sky
 * of its own making.
 */
import { bisectChange, type Planet } from '../../../substrate/sky.ts';
import { MS } from '../../../substrate/time.ts';
import { moiety } from '../../../systems/western/aspects.ts';
import { SIGNS } from '../../../systems/western/dignities.ts';
import type { LordSpan } from '../../../systems/western/index.ts';
import type { Syzygy } from '../../../systems/western/syzygy.ts';
import type { ClockId, Fact, Firing } from '../../types.ts';
import type { PeriodInput, ProfectedYear } from './context.ts';
import { isoDate, receivers } from './profection.ts';
import { BADGE, CONVENTIONS, fact } from './natal.ts';
import { joinList } from './model.ts';

export interface SkyAccess {
  /** The span the evaluation covers. */
  span: { startUtcMs: number; endUtcMs: number };
  /** Spans of one sign for a planet in the tropical zodiac, covering the span, in order (the engine's ingress function). */
  spans(p: Planet): readonly LordSpan[];
  /** Tropical longitude of a planet. */
  lon(p: Planet, ms: number): number;
  /** Longitude of the mean ascending node of the date. */
  node(ms: number): number;
  /** The new or full Moon last before the birth. */
  syzygy: Syzygy;
}

export type TransitRule = (w: PeriodInput, sky: SkyAccess) => Firing[];

/** The sky clock of a planet's motion in the tropical signs; the Sun's is the calendar. */
export const SKY_CLOCK: Readonly<Record<Planet, ClockId>> = {
  Sun: 'solar-longitude',
  Moon: 'moon',
  Mercury: 'mercury',
  Venus: 'venus',
  Mars: 'mars',
  Jupiter: 'jupiter-tropical',
  Saturn: 'saturn-tropical',
};

const norm12 = (x: number): number => ((x % 12) + 12) % 12;
const norm360 = (x: number): number => ((x % 360) + 360) % 360;
const circ = (x: number): number => {
  const d = norm360(x);
  return d > 180 ? d - 360 : d;
};
const signIndexOf = (lon: number): number => Math.floor(norm360(lon) / 30) % 12;

interface Piece {
  startUtcMs: number;
  endUtcMs: number;
  sign: number;
}

/** The parts of a window in which a planet stands in one sign, in order. */
function signPieces(sky: SkyAccess, p: Planet, y: { startUtcMs: number; endUtcMs: number }): Piece[] {
  const out: Piece[] = [];
  for (const s of sky.spans(p)) {
    const startUtcMs = Math.max(s.startUtcMs, y.startUtcMs);
    const endUtcMs = Math.min(s.endUtcMs, y.endUtcMs);
    if (endUtcMs > startUtcMs) out.push({ startUtcMs, endUtcMs, sign: SIGNS.indexOf(s.label as (typeof SIGNS)[number]) });
  }
  return out;
}

/** The year sign: the whole-sign profection of the Ascendant sign. */
const yearSign = (w: PeriodInput, y: ProfectedYear): number => norm12(w.model.ascSign + y.k);

/** The planet or planets that receive the year from the Ascendant (Valens IV.11). */
const chronocrators = (w: PeriodInput, y: ProfectedYear): Planet[] => receivers(w.model, yearSign(w, y));

// ---------------------------------------------------------------------------
// Valens: Jupiter and the year sign
// ---------------------------------------------------------------------------

const IDENTIFICATION = 'chronocrator: the planet that receives the year from the Ascendant, the implementer\'s identification';

/** Whole-sign operative places of the chronocrator: Ascendant sign, Midheaven sign, 11th and 5th places, sign of the Lot of Fortune. */
export function operativeSigns(w: PeriodInput): number[] {
  return [w.model.ascSign, signIndexOf(w.mc), norm12(w.model.ascSign + 10), norm12(w.model.ascSign + 4), signIndexOf(w.model.fortune())];
}

const RELATION: Readonly<Record<number, string>> = { 0: 'conjunct', 3: 'square', 9: 'square', 6: 'opposite' };

/**
 * Jupiter stands in the year sign or in a sign square or opposite it, and the chronocrator
 * stands in an operative place. Valens's other operative places (the Lots of Daimon, Love and
 * Necessity) need formulas the rule file does not give, and his branches for a well or badly
 * placed chronocrator need a test he does not give; neither is read.
 */
export const jupiterYearSign: TransitRule = (w, sky) => {
  const places = operativeSigns(w);
  const out: Firing[] = [];
  for (const y of w.years) {
    const s = yearSign(w, y);
    const there = chronocrators(w, y).filter((p) => places.includes(w.model.signOf(p)));
    if (there.length === 0) continue;
    for (const piece of signPieces(sky, 'Jupiter', y)) {
      const relation = RELATION[norm12(piece.sign - s)];
      if (relation === undefined) continue;
      out.push({
        clock: SKY_CLOCK.Jupiter,
        startUtcMs: piece.startUtcMs,
        endUtcMs: piece.endUtcMs,
        facts: [fact('sign', 'Jupiter\'s sign', SIGNS[piece.sign]!), fact('relation', 'Relation to the year sign', relation), fact('year_sign', 'Year sign', SIGNS[s]!), fact('chronocrator', 'Time-lord of the year', joinList(there))],
        conventionsUsed: CONVENTIONS,
        badges: [BADGE.wholeSign, IDENTIFICATION, 'the operative places of the Lots of Daimon, Love and Necessity are not evaluated: their formulas are not in the rule file'],
      });
    }
  }
  return out;
};

const MALEFICS: readonly Planet[] = ['Saturn', 'Mars'];
const BENEFICS: readonly Planet[] = ['Jupiter', 'Venus'];

/**
 * A malefic holds the year; another malefic standing in the year sign intensifies the evil,
 * a benefic standing there brings relief and help (Riley p.108). The case of a benefic that
 * holds the year, the retrograde clause and the phase clauses are not read.
 */
export const beneficMaleficYearLord: TransitRule = (w, sky) => {
  const out: Firing[] = [];
  for (const y of w.years) {
    const s = yearSign(w, y);
    for (const lord of chronocrators(w, y).filter((p) => MALEFICS.includes(p))) {
      for (const planet of [...MALEFICS.filter((p) => p !== lord), ...BENEFICS]) {
        for (const piece of signPieces(sky, planet, y)) {
          if (piece.sign !== s) continue;
          out.push({
            clock: SKY_CLOCK[planet],
            startUtcMs: piece.startUtcMs,
            endUtcMs: piece.endUtcMs,
            facts: [fact('planet', 'Transiting planet', planet), fact('sign', 'Year sign', SIGNS[s]!), fact('lord', 'Malefic that holds the year', lord), fact('effect', 'Valens reads', MALEFICS.includes(planet) ? 'it intensifies the evil' : 'it brings relief and help')],
            conventionsUsed: CONVENTIONS,
            badges: [IDENTIFICATION, 'only a malefic that holds the year is read; the benefic year-lord is ambiguous in the source and is not read'],
          });
        }
      }
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// Valens: the critical year
// ---------------------------------------------------------------------------

/** Signs 0, 3, 6 and 9 from the prenatal lunation: its own sign, the squares and the opposition. */
const LUNATION_OFFSETS = [0, 3, 6, 9];

/**
 * The profected year sign (counted from the Ascendant) is the sign of the prenatal new or full
 * Moon or the sign square or opposite it. Saturn standing in one of the four signs that just
 * precede the angles (the whole-sign 12th, 3rd, 6th and 9th) intensifies it ("especially if"),
 * so the year is cut where Saturn changes sign and each part says whether it stands there.
 */
export const criticalYearSyzygy: TransitRule = (w, sky) => {
  const out: Firing[] = [];
  const before = [11, 2, 5, 8].map((h) => norm12(w.model.ascSign + h));
  for (const y of w.years) {
    if (!LUNATION_OFFSETS.includes(norm12(yearSign(w, y) - sky.syzygy.signIndex))) continue;
    for (const piece of signPieces(sky, 'Saturn', y)) {
      const intensified = before.includes(piece.sign);
      out.push({
        clock: intensified ? SKY_CLOCK.Saturn : 'birthday',
        startUtcMs: piece.startUtcMs,
        endUtcMs: piece.endUtcMs,
        facts: [
          fact('N', 'Year number', y.k + 1),
          fact('new or full', 'Prenatal lunation', sky.syzygy.kind),
          // The sign is a fact but is not in the sentence: the audit's health list would refuse the sign Cancer.
          fact('saturnClause', 'Saturn', intensified ? ', with Saturn passing one of the four signs before the angles' : ''),
          fact('saturnSign', 'Sign of Saturn', SIGNS[piece.sign]!),
        ],
        conventionsUsed: CONVENTIONS,
        badges: [BADGE.wholeSign, 'the prenatal lunation is the last new or full Moon before the birth (the reading the context supports)', 'the clause on Saturn\'s distance from the ruler of the lunation is not evaluated'],
      });
    }
  }
  return out;
};

/** Offsets from the ascending node of the points Saturn is read at: the node, its square on either side and the descending node. */
const NODE_POINTS: ReadonlyArray<{ offset: number; node: string }> = [
  { offset: 0, node: 'ascending node' },
  { offset: 90, node: 'ascending node' },
  { offset: 270, node: 'ascending node' },
  { offset: 180, node: 'descending node' },
];

const DAY_STEP = MS.DAY;

/**
 * How far either side of the span a scan looks, so that a pass or a stay that begins before
 * the span is dated from its true beginning: Saturn's slowest orb takes about a year to cross.
 */
const PAD = 550 * MS.DAY;

/** Which point and how closely Saturn holds the node or its square at an instant, or null. Derived: the sign is the weak form, one degree the strong. */
function nodeClass(sky: SkyAccess, ms: number): string | null {
  const sat = sky.lon('Saturn', ms);
  const node = sky.node(ms);
  for (const [i, p] of NODE_POINTS.entries()) {
    const at = node + p.offset;
    if (Math.abs(circ(sat - at)) <= 1) return `${i}:within 1 degree`;
  }
  for (const [i, p] of NODE_POINTS.entries()) if (signIndexOf(sat) === signIndexOf(node + p.offset)) return `${i}:in the same sign`;
  return null;
}

/** The stretches of a span in which a classifying function is not null and constant, found at a step and refined to the second. */
export function classWindows(span: { startUtcMs: number; endUtcMs: number }, step: number, classify: (ms: number) => string | null): Array<{ startUtcMs: number; endUtcMs: number; cls: string }> {
  const out: Array<{ startUtcMs: number; endUtcMs: number; cls: string }> = [];
  let t = span.startUtcMs;
  let cur = classify(t);
  let open = cur === null ? 0 : t;
  while (t < span.endUtcMs) {
    const next = Math.min(t + step, span.endUtcMs);
    const c = classify(next);
    if (c !== cur) {
      const change = bisectChange((ms) => classify(ms) ?? '', t, next);
      if (cur !== null) out.push({ startUtcMs: open, endUtcMs: change, cls: cur });
      open = change;
      cur = c;
    }
    t = next;
  }
  if (cur !== null) out.push({ startUtcMs: open, endUtcMs: span.endUtcMs, cls: cur });
  return out;
}

/**
 * Saturn at the ascending or descending node of the date, or at their squares: in the same
 * sign (the weak form) or within one degree (the strong form), both derived as the rule says.
 * It reads no point of the nativity, so it does not need the birth time.
 */
export const criticalYearNode: TransitRule = (_w, sky) =>
  classWindows({ startUtcMs: sky.span.startUtcMs - PAD, endUtcMs: sky.span.endUtcMs + PAD }, DAY_STEP, (ms) => nodeClass(sky, ms))
    .filter((win) => win.endUtcMs > sky.span.startUtcMs && win.startUtcMs < sky.span.endUtcMs)
    .map((win) => {
    const [i, how] = win.cls.split(':') as [string, string];
    return {
      clock: SKY_CLOCK.Saturn,
      startUtcMs: win.startUtcMs,
      endUtcMs: win.endUtcMs,
      facts: [fact('node', 'Node', NODE_POINTS[Number(i)]!.node), fact('degreeMatch', 'Closeness', how)],
      conventionsUsed: [],
      badges: ['derived threshold: the mean node of the date; the same sign is the weak form, within 1 degree the strong form', 'the source does not say whether the natal node or the node of the date is meant'],
    };
  });

// ---------------------------------------------------------------------------
// Lilly: the day transits over the angles and radical places (p.741)
// ---------------------------------------------------------------------------

const ASPECT_VERB: Readonly<Record<number, string>> = { 0: 'conjoins', 60: 'sextiles', 90: 'squares', 120: 'trines', 180: 'opposes' };

interface Pass {
  planets: readonly Planet[];
  /** The aspect angles, 0 to 180. */
  angles: readonly number[];
  /** The points read: the angles and the radical places of the planets named. */
  points: (self: Planet) => ReadonlyArray<{ name: string; lon: (w: PeriodInput) => number }>;
  meaning: string;
}

const ASC = { name: 'Ascendant', lon: (w: PeriodInput) => w.model.ascendant };
const MC = { name: 'Midheaven', lon: (w: PeriodInput) => w.mc };
const place = (p: Planet) => ({ name: p, lon: (w: PeriodInput) => w.model.lon(p) });
const LIGHTS_AND_FORTUNES: readonly Planet[] = ['Jupiter', 'Venus', 'Sun', 'Moon'];

const PASSES: readonly Pass[] = [
  { planets: ['Jupiter', 'Venus'], angles: [0], points: () => [ASC], meaning: 'a healthful, cheerful, successful day' },
  { planets: ['Mars'], angles: [0], points: () => [ASC], meaning: 'choler or passion for two or three days' },
  { planets: ['Saturn'], angles: [0], points: () => [ASC], meaning: 'gravity, sobriety, melancholy' },
  { planets: LIGHTS_AND_FORTUNES, angles: [60, 120], points: (self) => [ASC, MC, place(self)], meaning: 'a fortunate day' },
  { planets: ['Saturn', 'Mars'], angles: [0, 60, 90, 120, 180], points: () => [ASC, MC, ...LIGHTS_AND_FORTUNES.map(place)], meaning: 'an unsuccessful day' },
];

/** The longitudes at which a planet makes an aspect to a point: the point itself, or either side of it. */
const aspectPoints = (target: number, angle: number): number[] => (angle === 0 || angle === 180 ? [norm360(target + angle)] : [norm360(target + angle), norm360(target - angle)]);

/**
 * The step of the scan: half a day for the Moon, whose pass through an orb lasts at least
 * 19 hours (an orb of 12.5 degrees at its greatest speed of 15.4 degrees a day), a day for
 * the others, whose passes last several days.
 */
const stepOf = (p: Planet): number => (p === 'Moon' ? MS.DAY / 2 : DAY_STEP);

interface Pass1 {
  startUtcMs: number;
  endUtcMs: number;
  /** The sample closest to the exact aspect. */
  closestUtcMs: number;
}

/**
 * The stretches of a regular grid of longitudes in which a planet is within an orb of a
 * longitude. A boundary is placed by linear interpolation between the two samples either
 * side of it, which is within minutes of the true instant for a planet that moves nearly
 * evenly over half a day.
 */
export function gridPasses(lons: Float64Array, t0: number, step: number, x: number, orb: number): Pass1[] {
  const out: Pass1[] = [];
  const f = (i: number): number => circ(lons[i]! - x);
  let open: number | null = null;
  let best = 0;
  let bestGap = Infinity;
  const cross = (i: number): number => {
    // The boundary between samples i - 1 and i: where the signed distance reaches the orb on the side it came from.
    const a = f(i - 1);
    const b = f(i);
    const target = (Math.abs(a) > orb ? a : b) > 0 ? orb : -orb;
    return t0 + (i - 1) * step + (step * (a - target)) / (a - b);
  };
  for (let i = 0; i < lons.length; i++) {
    const inside = Math.abs(f(i)) <= orb;
    if (inside) {
      if (open === null) {
        open = i === 0 ? t0 : cross(i);
        best = t0 + i * step;
        bestGap = Infinity;
      }
      const gap = Math.abs(f(i));
      if (gap < bestGap) {
        bestGap = gap;
        best = t0 + i * step;
      }
    } else if (open !== null) {
      out.push({ startUtcMs: open, endUtcMs: cross(i), closestUtcMs: best });
      open = null;
    }
  }
  if (open !== null) out.push({ startUtcMs: open, endUtcMs: t0 + (lons.length - 1) * step, closestUtcMs: best });
  return out;
}

/**
 * The days a planet passes over a point or beholds it by the five aspects (Lilly: "found out
 * by an Ephemeris"). Each pass is a window while the planet is within its moiety of the exact
 * aspect (Table C, the first column: a derived choice, Lilly gives none), dated by the day
 * of the closest sample. Lilly's passes over the cusps of the 2nd and 3rd houses need
 * Regiomontanus cusps and are not read.
 */
export const dailyCusps: TransitRule = (w, sky) => {
  const out: Firing[] = [];
  const from = sky.span.startUtcMs - PAD;
  const to = sky.span.endUtcMs + PAD;
  const grids = new Map<Planet, Float64Array>();
  const grid = (p: Planet): Float64Array => {
    let g = grids.get(p);
    if (g === undefined) {
      const step = stepOf(p);
      g = Float64Array.from({ length: Math.floor((to - from) / step) + 1 }, (_v, i) => sky.lon(p, from + i * step));
      grids.set(p, g);
    }
    return g;
  };
  for (const pass of PASSES) {
    for (const planet of pass.planets) {
      const orb = moiety(planet);
      for (const point of pass.points(planet)) {
        for (const angle of pass.angles) {
          for (const x of aspectPoints(point.lon(w), angle)) {
            for (const win of gridPasses(grid(planet), from, stepOf(planet), x, orb)) {
              if (win.endUtcMs <= sky.span.startUtcMs || win.startUtcMs >= sky.span.endUtcMs) continue;
              const facts: Fact[] = [fact('date', 'Day of the closest pass', isoDate(win.closestUtcMs)), fact('planet', 'Transiting planet', planet), fact('aspect', 'Aspect', ASPECT_VERB[angle]!), fact('point', 'Natal point', point.name), fact('meaning', 'Lilly reads', pass.meaning)];
              out.push({
                clock: SKY_CLOCK[planet],
                startUtcMs: win.startUtcMs,
                endUtcMs: win.endUtcMs,
                facts,
                dedupeInstance: `${planet}|${point.name}|${angle}|${Math.round(x)}|${pass.meaning}|${Math.round(win.startUtcMs)}`,
                conventionsUsed: ['westernOrbs'],
                badges: ['derived threshold: the point orb is the moiety of the transiting planet (Table C, first column)', 'the cusps of the 2nd and 3rd houses are not read: they need Regiomontanus cusps', 'the edges of the pass are interpolated between samples of half a day for the Moon and a day for the others'],
              });
            }
          }
        }
      }
    }
  }
  return out;
};
