// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Conventions: the choices that make two honest calculators print different charts.
 * Every calculation takes this object, every result records it, and the sensitivity
 * report reruns the calculation under each alternative.
 */
import type { TimeBasis } from './substrate/time.ts';

export interface Conventions {
  /** Which clock the hour and day of the pillars are read from. */
  timeBasis: TimeBasis;
  /** Where the sexagenary day turns over. */
  dayBoundary: 'zi23' | 'midnight';
  /** Where the sexagenary year turns over. */
  yearBoundary: 'lichun';
  /** How the distance to the neighbouring jie becomes the age at which luck pillars begin. */
  luckStart: 'three-days-per-year';
  /** How the sixty hexagrams of the gua qi calendar are laid on the year. */
  guaQi: 'equal-longitude' | 'mean-time' | 'jing-fang';
  /** Where each of the twelve sovereign hexagrams begins. */
  sovereignBoundary: 'jie' | 'zhongqi';
  /** Where the lunar nodes fall in the firdaria sequence of a night chart. */
  firdariaNodes: 'end' | 'after-mars';
  /** Sidereal zero point for the nakshatras and the sidereal zodiac. */
  ayanamsa: 'lahiri';
  /** Julian Day Number of the Maya Long Count zero date. */
  mayaCorrelation: 584283 | 584285 | 584286;
}

export const DEFAULT_CONVENTIONS: Conventions = {
  timeBasis: 'civil',
  dayBoundary: 'zi23',
  yearBoundary: 'lichun',
  luckStart: 'three-days-per-year',
  guaQi: 'equal-longitude',
  sovereignBoundary: 'jie',
  firdariaNodes: 'end',
  ayanamsa: 'lahiri',
  mayaCorrelation: 584283,
};

export interface ConventionOption {
  value: string | number;
  label: string;
  description: string;
}

export interface ConventionSpec {
  key: keyof Conventions;
  title: string;
  affects: string;
  why: string;
  options: ConventionOption[];
}

export const CONVENTION_SPECS: readonly ConventionSpec[] = [
  {
    key: 'timeBasis',
    title: 'Clock the birth hour is read from',
    affects: 'BaZi day and hour pillars',
    why: 'The double-hours were defined by the Sun, but birth certificates record zone time. Calculators differ on whether to correct for longitude, for the equation of time, and for daylight saving, and most do not say which they did.',
    options: [
      { value: 'civil', label: 'Civil clock', description: 'The wall clock of the time zone, daylight saving included. What most online calculators use.' },
      { value: 'standard', label: 'Standard time', description: 'The wall clock with any daylight-saving hour removed.' },
      { value: 'lmt', label: 'Local mean time', description: 'UTC plus four minutes per degree of east longitude.' },
      { value: 'apparent', label: 'True solar time', description: 'Local mean time plus the equation of time (up to about sixteen minutes either way).' },
    ],
  },
  {
    key: 'dayBoundary',
    title: 'Where the day pillar changes',
    affects: 'BaZi day pillar for births between 23:00 and midnight',
    why: 'The Zi double-hour runs from 23:00 to 01:00. One school changes the day when Zi begins; the other keeps the calendar day until midnight and calls 23:00 to 24:00 the "late Zi hour".',
    options: [
      { value: 'zi23', label: 'At 23:00', description: 'The day pillar advances when the Zi hour begins.' },
      { value: 'midnight', label: 'At midnight (late Zi hour)', description: 'The day pillar advances at 00:00; the hour stem of 23:00 to 24:00 is still taken from the following day.' },
    ],
  },
  {
    key: 'yearBoundary',
    title: 'Where the year pillar changes',
    affects: 'BaZi year pillar for births in January and early February',
    why: 'Four Pillars practice turns the year at Lichun (Sun at 315 degrees). Popular zodiac tables turn it at the lunar new year, which this version does not implement.',
    options: [{ value: 'lichun', label: 'Lichun', description: 'The instant the Sun reaches 315 degrees of tropical longitude.' }],
  },
  {
    key: 'luckStart',
    title: 'Age at which luck pillars begin',
    affects: 'Start dates of every ten-year luck pillar',
    why: 'The interval from birth to the neighbouring jie is scaled so that three days stand for one year. Schools differ in how finely they count the remainder.',
    options: [
      { value: 'three-days-per-year', label: 'Three days per year, to the second', description: 'Three days is a year, six hours a month, twelve minutes a day, thirty seconds an hour.' },
    ],
  },
  {
    key: 'guaQi',
    title: 'How the gua qi hexagrams divide the year',
    affects: 'Gua qi ring and track, and the gua qi hexagram of a moment',
    why: 'The scheme implemented is Meng Xi\'s as Yi Xing adopted it in the Dayan calendar: sixty hexagrams of six and seven-eightieths days each from the winter solstice (Xin Tang shu 27A, Gua yi; table in 28A). Yi Xing also reports a different allotment of Jing Fang\'s, offered as a third option. Laid on the true Sun instead of a mean year, each of the sixty spans six degrees of longitude, and the two readings differ by up to about two days.',
    options: [
      { value: 'equal-longitude', label: 'Six degrees of solar longitude each', description: 'Meng Xi\'s sixty hexagrams, consistent with the modern true-Sun solar terms.' },
      { value: 'mean-time', label: 'One sixtieth of the solstice-to-solstice year each', description: 'Meng Xi\'s sixty hexagrams, closer to the original mean-time scheme.' },
      {
        value: 'jing-fang',
        label: 'Jing Fang\'s allotment, in mean time',
        description:
          'As Yi Xing reports it: Kan, Li, Zhen and Dui take the first 73/80 of a day at the head of each solstice and equinox; Yi, Jin, Jing and Da Xu take 5 days 14 parts; the rest 6 days 7 parts. Scaled to fill the solstice-to-solstice year, so the four cardinal hexagrams appear as short periods of their own.',
      },
    ],
  },
  {
    key: 'sovereignBoundary',
    title: 'Where each sovereign hexagram begins',
    affects: 'Sovereign-hexagram ring, track label and fact',
    why: 'The twelve sovereign hexagrams are set one to a month, but the BaZi month runs from jie to jie while the Dayan table (Xin Tang shu 28A) begins each month\'s group of five hexagrams at the zhongqi. The two arcs are the same thirty degrees offset by fifteen.',
    options: [
      { value: 'jie', label: 'At the jie, with the branch month', description: 'Fu from the Sun at 255 degrees (Daxue). The project\'s default.' },
      { value: 'zhongqi', label: 'At the zhongqi, as in the Dayan table', description: 'Fu from the Sun at 270 degrees (the winter solstice), fifteen degrees later.' },
    ],
  },
  {
    key: 'firdariaNodes',
    title: 'Place of the lunar nodes in a night-chart firdaria',
    affects: 'Firdaria periods of nocturnal charts',
    why: 'The medieval sources disagree on whether the nodes close the sequence or follow Mars.',
    options: [
      { value: 'end', label: 'Nodes at the end', description: 'Moon, Saturn, Jupiter, Mars, Sun, Venus, Mercury, North Node, South Node.' },
      { value: 'after-mars', label: 'Nodes after Mars', description: 'Moon, Saturn, Jupiter, Mars, North Node, South Node, Sun, Venus, Mercury.' },
    ],
  },
  {
    key: 'ayanamsa',
    title: 'Sidereal zero point',
    affects: 'Nakshatras, sidereal signs, vimshottari dasha',
    why: 'Sidereal systems measure from a star-fixed point; which point is a matter of school.',
    options: [{ value: 'lahiri', label: 'Lahiri (Chitrapaksha)', description: 'The Indian national-calendar standard. The true ayanamsa (nutation included), fixed at 23 degrees 15 minutes 00.658 seconds on 21 March 1956 and carried by the IAU precession; within about 0.3 arcsecond of the Indian Astronomical Ephemeris values it was compared with, if the value at that epoch is indeed a true one.' }],
  },
  {
    key: 'mayaCorrelation',
    title: 'Maya calendar correlation',
    affects: 'Long Count, Tzolkin, Haab',
    why: 'The correlation constant ties the Long Count to the Julian day count. It is chosen by argument, not measured, and the literature does not settle on one value: Martin and Skidmore (2012) call 584283 and 584285 the two most widely accepted and argue for 584286 from Venus records.',
    options: [
      { value: 584283, label: '584283 (Goodman-Martinez-Thompson)', description: 'The common default, and not a settled value. Favoured by those who hold that the highland day count has continued unbroken (Martin and Skidmore 2012).' },
      { value: 584285, label: '584285 (Thompson\'s own value)', description: 'Thompson\'s value from 1927 onwards, two days later than 584283 (Martin and Skidmore 2012).' },
      { value: 584286, label: '584286 (Martin and Skidmore)', description: 'Proposed by Martin and Skidmore (2012) from Maya records of the movements of Venus; one day later than 584285.' },
    ],
  },
];

/** Every single-key variation of the given conventions. */
export function alternatives(base: Conventions): Array<{ key: keyof Conventions; value: string | number; conventions: Conventions }> {
  const out: Array<{ key: keyof Conventions; value: string | number; conventions: Conventions }> = [];
  for (const spec of CONVENTION_SPECS) {
    for (const option of spec.options) {
      if (option.value === base[spec.key]) continue;
      out.push({ key: spec.key, value: option.value, conventions: { ...base, [spec.key]: option.value } as Conventions });
    }
  }
  return out;
}
