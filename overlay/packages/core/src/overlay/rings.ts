// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Rings: every system that divides the year or the sky, expressed in one coordinate,
 * tropical ecliptic longitude. This is the shared axis of the wheel.
 */
import type { Conventions } from '../conventions.ts';
import { norm360 } from '../substrate/sky.ts';
import { SOLAR_TERMS } from '../substrate/terms.ts';
import { BRANCHES } from '../systems/bazi/tables.ts';
import {
  CARDINAL_HEXAGRAMS,
  FUXI_SEQUENCE,
  FUXI_START,
  GATE_SEQUENCE,
  GATE_START,
  GUA_QI_RANK_ENGLISH,
  GUA_QI_RANKS,
  GUA_QI_SEQUENCE,
  GUA_QI_START,
  SOVEREIGN_SEQUENCE,
  SOVEREIGN_START,
  type Hexagram,
} from '../systems/iching/index.ts';
import { lahiriAyanamsa, NAKSHATRA_ARC, NAKSHATRAS } from '../systems/vedic/index.ts';
import { DOMICILE, EGYPTIAN_BOUNDS, faceLord, PLANET_GLYPHS, SIGN_ELEMENT, SIGN_GLYPHS, SIGNS } from '../systems/western/dignities.ts';

/**
 * How firmly a ring is tied to the ecliptic.
 *   exact         defined by solar longitude; the boundaries are astronomical facts
 *   derived       follows by arithmetic from an exact ring
 *   conventional  a stated mapping that a tradition or author chose
 *   approximate   a scheme defined in mean time or another frame, laid on the ecliptic as nearly as it allows
 */
export type Grade = 'exact' | 'derived' | 'conventional' | 'approximate';

export type SystemId = 'western' | 'chinese' | 'iching' | 'vedic' | 'calendar';

export interface RingSegment {
  /** Start and end in degrees of tropical longitude; the segment runs forward from start to end. */
  start: number;
  end: number;
  /** Short text for drawing inside the segment. */
  short: string;
  /** Full description. */
  label: string;
  /** Colour key. */
  tone?: string;
}

export interface Ring {
  id: string;
  title: string;
  system: SystemId;
  grade: Grade;
  note: string;
  segments: RingSegment[];
  /** Whether the wheel shows it unless asked otherwise. */
  defaultVisible: boolean;
}

const ELEMENT_TONE: Record<string, string> = { Wood: 'wood', Fire: 'fire', Earth: 'earth', Metal: 'metal', Water: 'water', Air: 'air' };

/** The traditional name of a line: position (初 二 三 四 五 上) with 九 for yang or 六 for yin. */
export function lineName(bit: number, index: number): string {
  const nine = bit ? '九' : '六';
  if (index === 0) return `初${nine}`;
  if (index === 5) return `上${nine}`;
  return `${nine}${['二', '三', '四', '五'][index - 1]}`;
}

function hexSegments(sequence: readonly Hexagram[], start: number, describe?: (h: Hexagram, k: number) => string): RingSegment[] {
  const arc = 360 / sequence.length;
  return sequence.map((h, k) => ({
    start: norm360(start + k * arc),
    end: norm360(start + (k + 1) * arc),
    short: h.symbol,
    label: describe ? describe(h, k) : `${h.number} ${h.hanzi} ${h.pinyin} (${h.gloss})`,
    tone: `yang${h.lines.reduce((a, b) => a + b, 0)}`,
  }));
}

export function buildRings(utcMs: number, _conventions: Conventions): Ring[] {
  const ayanamsa = lahiriAyanamsa(utcMs);
  const rings: Ring[] = [];

  rings.push({
    id: 'zodiac',
    title: 'Tropical zodiac',
    system: 'western',
    grade: 'exact',
    note: 'Twelve signs of thirty degrees from the March equinox.',
    defaultVisible: true,
    segments: SIGNS.map((sign, i) => ({
      start: i * 30,
      end: ((i + 1) * 30) % 360,
      short: SIGN_GLYPHS[i]!,
      label: `${sign}, domicile of ${DOMICILE[i]}`,
      tone: ELEMENT_TONE[SIGN_ELEMENT[i % 4]!],
    })),
  });

  rings.push({
    id: 'bounds',
    title: 'Egyptian bounds',
    system: 'western',
    grade: 'conventional',
    note: 'Five unequal bounds in each sign, each ruled by one of the five planets.',
    defaultVisible: false,
    segments: EGYPTIAN_BOUNDS.flatMap((sign, i) => {
      let from = 0;
      return sign.map(([planet, end]) => {
        const seg: RingSegment = {
          start: i * 30 + from,
          end: (i * 30 + end) % 360,
          short: PLANET_GLYPHS[planet],
          label: `Bound of ${planet}, ${from} to ${end} degrees of ${SIGNS[i]}`,
          tone: planet.toLowerCase(),
        };
        from = end;
        return seg;
      });
    }),
  });

  rings.push({
    id: 'faces',
    title: 'Faces (decans)',
    system: 'western',
    grade: 'conventional',
    note: 'Thirty-six faces of ten degrees in descending Chaldean order from Mars.',
    defaultVisible: false,
    segments: Array.from({ length: 36 }, (_, k) => {
      const planet = faceLord(k * 10);
      return {
        start: k * 10,
        end: ((k + 1) * 10) % 360,
        short: PLANET_GLYPHS[planet],
        label: `Face of ${planet}, ${(k % 3) * 10} to ${(k % 3) * 10 + 10} degrees of ${SIGNS[Math.floor(k / 3)]}`,
        tone: planet.toLowerCase(),
      };
    }),
  });

  rings.push({
    id: 'terms',
    title: 'Twenty-four solar terms',
    system: 'chinese',
    grade: 'exact',
    note: 'Each term opens when the Sun reaches a multiple of fifteen degrees. Exact by definition since the calendar reform of 1645; before that the terms were mean-time divisions.',
    defaultVisible: true,
    segments: SOLAR_TERMS.map((t) => ({
      start: t.longitude,
      end: norm360(t.longitude + 15),
      short: t.hanzi,
      label: `${t.hanzi} ${t.pinyin} (${t.english}), from ${t.longitude} degrees${t.isJie ? '; opens a BaZi month' : '; a sign ingress'}`,
      tone: t.isJie ? 'jie' : 'qi',
    })),
  });

  rings.push({
    id: 'branch-months',
    title: 'Branch months',
    system: 'chinese',
    grade: 'derived',
    note: 'The twelve BaZi months, each opening at a jie. They are thirty-degree arcs like the signs, offset from them by exactly fifteen degrees.',
    defaultVisible: true,
    segments: Array.from({ length: 12 }, (_, m) => {
      const b = BRANCHES[(m + 2) % 12]!;
      return {
        start: norm360(315 + 30 * m),
        end: norm360(345 + 30 * m),
        short: b.hanzi,
        label: `${b.hanzi} ${b.pinyin} month (${b.animal}), ${b.element}`,
        tone: ELEMENT_TONE[b.element],
      };
    }),
  });

  rings.push({
    id: 'sovereign',
    title: 'Twelve sovereign hexagrams',
    system: 'iching',
    grade: 'derived',
    note: 'One hexagram per branch month, the yang lines waxing from the solstice month and waning from the opposite one.',
    defaultVisible: true,
    segments: hexSegments(SOVEREIGN_SEQUENCE, SOVEREIGN_START, (h, k) => `${h.hanzi} ${h.pinyin} (${h.gloss}), sovereign of the ${BRANCHES[k % 12]!.hanzi} month`),
  });

  rings.push({
    id: 'gua-qi',
    title: 'Gua qi: sixty hexagrams',
    system: 'iching',
    grade: 'approximate',
    note: 'The Han "six days seven parts" calendar from Zhong Fu at the winter solstice. Originally a mean-time scheme; drawn here as sixty arcs of six degrees.',
    defaultVisible: true,
    segments: hexSegments(GUA_QI_SEQUENCE, GUA_QI_START, (h, k) => `${h.hanzi} ${h.pinyin} (${h.gloss}), ${GUA_QI_RANKS[k % 5]} ${GUA_QI_RANK_ENGLISH[k % 5]}`),
  });

  rings.push({
    id: 'cardinal',
    title: 'Four cardinal hexagrams, line by line',
    system: 'iching',
    grade: 'derived',
    note: 'Kan, Zhen, Li and Dui each rule a season from a solstice or equinox, and each of their twenty-four lines rules one solar term, as tabulated in the Dayan calendar.',
    defaultVisible: false,
    segments: CARDINAL_HEXAGRAMS.flatMap((c) =>
      c.hexagram.lines.map((bit, i) => {
        const name = lineName(bit, i);
        const term = SOLAR_TERMS[(((c.start + 15 * i - 315) / 15) % 24 + 24) % 24]!;
        return {
          start: norm360(c.start + 15 * i),
          end: norm360(c.start + 15 * (i + 1)),
          short: i === 0 ? c.hexagram.symbol : name[name.length - 1] === '六' || name[0] === '六' || name === '上六' || name === '初六' ? '⚋' : '⚊',
          label: `${c.hexagram.hanzi}${name}: ${c.hexagram.pinyin} line ${i + 1}, ruling ${term.hanzi} ${term.pinyin}`,
          tone: bit ? 'yang6' : 'yang0',
        };
      }),
    ),
  });

  rings.push({
    id: 'fuxi',
    title: 'Fu Xi circle (Shao Yong)',
    system: 'iching',
    grade: 'conventional',
    note: 'The Earlier Heaven circular arrangement read as a year, Fu following the winter solstice.',
    defaultVisible: false,
    segments: hexSegments(FUXI_SEQUENCE, FUXI_START),
  });

  rings.push({
    id: 'gates',
    title: 'Sixty-four-gate wheel',
    system: 'iching',
    grade: 'conventional',
    note: 'The modern ecliptic wheel, hexagram 41 from two degrees of Aquarius. It is the Fu Xi circle reversed and turned, with its seam at 13 degrees 15 minutes of Taurus.',
    defaultVisible: true,
    segments: hexSegments(GATE_SEQUENCE, GATE_START),
  });

  rings.push({
    id: 'sidereal',
    title: 'Sidereal zodiac (Lahiri)',
    system: 'vedic',
    grade: 'conventional',
    note: `The same twelve signs measured from a star-fixed point; today it trails the tropical zodiac by ${ayanamsa.toFixed(2)} degrees, and the gap grows a degree every seventy-two years.`,
    defaultVisible: false,
    segments: SIGNS.map((sign, i) => ({
      start: norm360(i * 30 + ayanamsa),
      end: norm360((i + 1) * 30 + ayanamsa),
      short: SIGN_GLYPHS[i]!,
      label: `Sidereal ${sign}`,
      tone: ELEMENT_TONE[SIGN_ELEMENT[i % 4]!],
    })),
  });

  rings.push({
    id: 'nakshatras',
    title: 'Twenty-seven nakshatras',
    system: 'vedic',
    grade: 'conventional',
    note: 'Lunar mansions of thirteen degrees twenty minutes on the sidereal ecliptic.',
    defaultVisible: true,
    segments: NAKSHATRAS.map((n, i) => ({
      start: norm360(i * NAKSHATRA_ARC + ayanamsa),
      end: norm360((i + 1) * NAKSHATRA_ARC + ayanamsa),
      short: String(i + 1),
      label: `${i + 1} ${n.name}, lord ${n.lord}`,
      tone: n.lord.toLowerCase(),
    })),
  });

  return rings;
}

/** The segment of a ring that contains a longitude. */
export function segmentAt(ring: Ring, longitude: number): RingSegment {
  const l = norm360(longitude);
  for (const s of ring.segments) {
    const width = norm360(s.end - s.start) || 360;
    if (norm360(l - s.start) < width) return s;
  }
  return ring.segments[ring.segments.length - 1]!;
}

/** What every ring says about one longitude: the overlay read along a single radius. */
export function readAcross(rings: readonly Ring[], longitude: number): Array<{ ring: string; title: string; grade: Grade; label: string }> {
  return rings.map((r) => ({ ring: r.id, title: r.title, grade: r.grade, label: segmentAt(r, longitude).label }));
}
