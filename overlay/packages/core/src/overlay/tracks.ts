// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Tracks: every system that divides a life or a year into periods, expressed as dated
 * intervals on one time axis. This is the shared axis of the timeline.
 */
import type { Conventions } from '../conventions.ts';
import { nextSunLongitude, norm360 } from '../substrate/sky.ts';
import { lichunYear, termsBetween } from '../substrate/terms.ts';
import { MS, type Moment } from '../substrate/time.ts';
import { annualPillars, luck, monthlyPillars, yearIndex, type Sex } from '../systems/bazi/index.ts';
import { nineStarOfYear } from '../systems/calendars/index.ts';
import { guaQiRank, guaQiSpans, SOVEREIGN_SEQUENCE } from '../systems/iching/index.ts';
import { vimshottari } from '../systems/vedic/index.ts';
import { firdaria, profections, signIngresses, SIGN_ELEMENT, SIGNS } from '../systems/western/index.ts';
import type { SystemId } from './rings.ts';

export type TrackLevel = 'life' | 'year' | 'month' | 'week';

export interface Interval {
  startUtcMs: number;
  endUtcMs: number;
  label: string;
  detail?: string;
  tone?: string;
}

/**
 * The clocks tracks can run on. A clock is the set of instants that set its boundaries,
 * and two tracks share one only when those instants are equal as dates. Jupiter and Saturn
 * are split by zodiac because the tropical and sidereal ingresses fall on different dates.
 * `calendar-year` is the slice clock of the forecast layer.
 */
export type ClockId =
  | 'luck'
  | 'birthday'
  | 'dasha'
  | 'solar-longitude'
  | 'jupiter-tropical'
  | 'jupiter-sidereal'
  | 'saturn-tropical'
  | 'saturn-sidereal'
  | 'moon'
  | 'mars'
  | 'venus'
  | 'mercury'
  | 'node'
  | 'calendar-year';

export interface Track {
  id: string;
  title: string;
  system: SystemId;
  level: TrackLevel;
  /** What sets the boundaries of this track. */
  boundary: string;
  /**
   * The clock the track runs on. Tracks on the same clock change together by
   * construction (the firdaria and the profections both turn on the birthday; the
   * annual pillar turns on one of the monthly pillar's boundaries), so a coincidence
   * between them is not a coincidence, and the seam finder counts each clock once.
   */
  clock: ClockId;
  intervals: Interval[];
}

export interface TrackOptions {
  startUtcMs: number;
  endUtcMs: number;
  /** Needed for the direction of the BaZi luck pillars; omit to leave that track out. */
  sex?: Sex;
}

const YEAR = 365.2425 * MS.DAY;
const tone = (s: string): string => s.toLowerCase().replace(/^(north|south) node$/, 'node');
const signTone = (label: string): string => SIGN_ELEMENT[SIGNS.indexOf(label as (typeof SIGNS)[number]) % 4]!.toLowerCase();

function clip<T extends { startUtcMs: number; endUtcMs: number }>(xs: T[], start: number, end: number): T[] {
  return xs.filter((x) => x.endUtcMs > start && x.startUtcMs < end);
}

export function buildTracks(moment: Moment, conventions: Conventions, options: TrackOptions): Track[] {
  const { startUtcMs: start, endUtcMs: end } = options;
  const spanYears = (end - start) / YEAR;
  const ageAtEnd = Math.max(1, Math.ceil((end - moment.utcMs) / YEAR) + 1);
  const tracks: Track[] = [];

  // --- life level ----------------------------------------------------------
  if (options.sex) {
    const l = luck(moment, conventions, options.sex, Math.max(10, Math.ceil(ageAtEnd / 10) + 1));
    tracks.push({
      id: 'bazi-luck',
      title: 'BaZi luck pillars',
      system: 'chinese',
      level: 'life',
      clock: 'luck',
      boundary: `Ten calendar years each, from an age set by the distance to the ${l.forward ? 'next' : 'previous'} jie (three days to the year)`,
      intervals: clip(
        l.pillars.map((p) => ({
          startUtcMs: p.startUtcMs,
          endUtcMs: p.endUtcMs,
          label: p.cycle.hanzi,
          detail: `${p.cycle.pinyin}, luck pillar ${p.ordinal}`,
          tone: p.cycle.stem.element.toLowerCase(),
        })),
        start,
        end,
      ),
    });
  }

  const fird = firdaria(moment, conventions, ageAtEnd + 1);
  tracks.push({
    id: 'firdaria',
    title: 'Firdaria',
    system: 'western',
    level: 'life',
    clock: 'birthday',
      boundary: 'Fixed spans of tropical years counted from birth',
    intervals: clip(fird.major.map((s) => ({ startUtcMs: s.startUtcMs, endUtcMs: s.endUtcMs, label: s.label, tone: tone(s.lord) })), start, end),
  });

  const dasha = vimshottari(moment, ageAtEnd + 1);
  tracks.push({
    id: 'vimshottari',
    title: 'Vimshottari mahadasha',
    system: 'vedic',
    level: 'life',
    clock: 'dasha',
      boundary: 'Fixed spans of 365.25-day years, phased by the Moon\'s place in its nakshatra at birth',
    intervals: clip(dasha.maha.map((s) => ({ startUtcMs: s.startUtcMs, endUtcMs: s.endUtcMs, label: s.label, tone: tone(s.lord) })), start, end),
  });

  tracks.push({
    id: 'saturn-sign',
    title: 'Saturn by sign',
    system: 'western',
    level: 'life',
    clock: 'saturn-tropical',
      boundary: 'Saturn\'s geocentric sign changes, retrograde re-entries included',
    intervals: clip(signIngresses('Saturn', start, end, 6).map((s) => ({ startUtcMs: s.startUtcMs, endUtcMs: s.endUtcMs, label: s.label, tone: signTone(s.label) })), start, end),
  });

  // --- year level ----------------------------------------------------------
  tracks.push({
    id: 'bazi-year',
    title: 'Annual pillar',
    system: 'chinese',
    level: 'year',
    clock: 'solar-longitude',
      boundary: 'Lichun: the Sun at 315 degrees',
    intervals: clip(
      annualPillars(start, end).map((p) => {
        const star = nineStarOfYear(lichunYear(p.startUtcMs + MS.DAY));
        return {
          startUtcMs: p.startUtcMs,
          endUtcMs: p.endUtcMs,
          label: p.cycle.hanzi,
          detail: `${p.cycle.pinyin} (${p.cycle.branch.animal}); 太歲 Taisui (Great Year) ${p.cycle.branch.hanzi} ${p.cycle.branch.pinyin}; nine-star year (zibai) ${star.hanzi} ${star.pinyin} (${star.english})`,
          tone: p.cycle.stem.element.toLowerCase(),
        };
      }),
      start,
      end,
    ),
  });

  tracks.push({
    id: 'profection',
    title: 'Annual profection',
    system: 'western',
    level: 'year',
    clock: 'birthday',
      boundary: 'Solar return: the Sun back at its natal longitude',
    intervals: clip(
      profections(moment, ageAtEnd + 1).map((s) => ({
        startUtcMs: s.startUtcMs,
        endUtcMs: s.endUtcMs,
        label: s.label,
        detail: `lord of the year ${s.lord}; ${s.detail}`,
        tone: tone(s.lord),
      })),
      start,
      end,
    ),
  });

  tracks.push({
    id: 'jupiter-sign',
    title: 'Jupiter by sign',
    system: 'western',
    level: 'year',
    clock: 'jupiter-tropical',
      boundary: 'Jupiter\'s geocentric sign changes',
    intervals: clip(signIngresses('Jupiter', start, end, 4).map((s) => ({ startUtcMs: s.startUtcMs, endUtcMs: s.endUtcMs, label: s.label, tone: signTone(s.label) })), start, end),
  });

  if (spanYears <= 40) {
    tracks.push({
      id: 'firdaria-sub',
      title: 'Firdaria sub-periods',
      system: 'western',
      level: 'year',
      clock: 'birthday',
      boundary: 'Sevenths of each firdaria',
      intervals: clip(fird.minor.map((s) => ({ startUtcMs: s.startUtcMs, endUtcMs: s.endUtcMs, label: s.lord, detail: s.label, tone: tone(s.lord) })), start, end),
    });
    tracks.push({
      id: 'antardasha',
      title: 'Vimshottari antardasha',
      system: 'vedic',
      level: 'year',
      clock: 'dasha',
      boundary: 'Each mahadasha divided in proportion to the nine lords\' years',
      intervals: clip(dasha.antar.map((s) => ({ startUtcMs: s.startUtcMs, endUtcMs: s.endUtcMs, label: s.lord, detail: s.label, tone: tone(s.lord) })), start, end),
    });
  }

  // --- month level -----------------------------------------------------------
  if (spanYears <= 12) {
    // Under `zhongqi` the hexagram turns half-way through each branch month, so a month is
    // drawn as two intervals: the previous month's hexagram until the zhongqi, then its own.
    const zhongqi = conventions.sovereignBoundary === 'zhongqi';
    tracks.push({
      id: 'bazi-month',
      title: 'Monthly pillar and sovereign hexagram',
      system: 'chinese',
      level: 'month',
      clock: 'solar-longitude',
      boundary: zhongqi
        ? 'Month pillar at the twelve jie (the Sun at 315, 345, 15 ... degrees); sovereign hexagram at the twelve zhongqi (the Sun at 270, 300, 330 ... degrees)'
        : 'The twelve jie: the Sun at 315, 345, 15 ... degrees',
      intervals: clip(
        monthlyPillars(start, end).flatMap((p) => {
          const b = p.cycle.branch.index;
          const tone = p.cycle.branch.element.toLowerCase();
          const interval = (from: number, to: number, h: (typeof SOVEREIGN_SEQUENCE)[number]) => ({
            startUtcMs: from,
            endUtcMs: to,
            label: `${p.cycle.hanzi} ${h.symbol}`,
            detail: `${p.cycle.pinyin} month; sovereign hexagram ${h.hanzi} ${h.pinyin}`,
            tone,
          });
          if (!zhongqi) return [interval(p.startUtcMs, p.endUtcMs, SOVEREIGN_SEQUENCE[b]!)];
          // The month's own jie sits at 315 + 30m degrees for m counted from the Yin month, and its zhongqi fifteen degrees on.
          const jie = norm360(315 + 30 * ((b + 10) % 12));
          const mid = nextSunLongitude(norm360(jie + 15), p.startUtcMs);
          return [interval(p.startUtcMs, mid, SOVEREIGN_SEQUENCE[(b + 11) % 12]!), interval(mid, p.endUtcMs, SOVEREIGN_SEQUENCE[b]!)];
        }),
        start,
        end,
      ),
    });
    tracks.push({
      id: 'sun-sign',
      title: 'Sun by sign',
      system: 'western',
      level: 'month',
      clock: 'solar-longitude',
      boundary: 'The twelve zhongqi: the Sun at 0, 30, 60 ... degrees',
      intervals: clip(signIngresses('Sun', start, end, 3).map((s) => ({ startUtcMs: s.startUtcMs, endUtcMs: s.endUtcMs, label: s.label, tone: signTone(s.label) })), start, end),
    });
  }

  // --- week level ------------------------------------------------------------
  if (spanYears <= 3) {
    const terms = termsBetween(start - 20 * MS.DAY, end + 20 * MS.DAY);
    tracks.push({
      id: 'solar-terms',
      title: 'Solar terms (jieqi)',
      system: 'chinese',
      level: 'week',
      clock: 'solar-longitude',
      boundary: 'The Sun at each multiple of fifteen degrees',
      intervals: clip(
        terms.slice(0, -1).map((t, i) => ({
          startUtcMs: t.utcMs,
          endUtcMs: terms[i + 1]!.utcMs,
          label: t.term.hanzi,
          detail: `${t.term.pinyin} (${t.term.english})`,
          tone: t.term.isJie ? 'jie' : 'qi',
        })),
        start,
        end,
      ),
    });
    tracks.push({
      id: 'gua-qi',
      title: 'Gua qi hexagram',
      system: 'iching',
      level: 'week',
      clock: 'solar-longitude',
      boundary:
        conventions.guaQi === 'mean-time'
          ? 'Sixtieths of the solstice-to-solstice year'
          : conventions.guaQi === 'jing-fang'
            ? 'Jing Fang\'s allotments in parts of eighty to the day, filling the solstice-to-solstice year; the four cardinal hexagrams open each solstice and equinox'
            : 'The Sun at each multiple of six degrees from 270',
      intervals: clip(
        guaQiSpans(start, end, conventions.guaQi).map((s) => ({
          startUtcMs: s.startUtcMs,
          endUtcMs: s.endUtcMs,
          label: `${s.hexagram.symbol} ${s.hexagram.hanzi}`,
          detail: `${s.hexagram.pinyin} (${s.hexagram.gloss}), ${guaQiRank(s.position).english}`,
          tone: `yang${s.hexagram.lines.reduce((a, b) => a + b, 0)}`,
        })),
        start,
        end,
      ),
    });
  }

  return tracks;
}

export { yearIndex };
