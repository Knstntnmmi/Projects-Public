// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Forecast conventions: the choices the rule files leave open, as named settings. They sit
 * beside the engine's Conventions and are recorded in every output. The engine's own
 * sovereignBoundary and firdariaNodes are not repeated here; the output records the engine
 * values, so there is one place to set each.
 */
import type { ConventionSpec } from '../conventions.ts';
import type { SexConvention } from './types.ts';

export interface ForecastConventions {
  /** Calendar years in this phase. */
  sliceLength: 'year';
  /**
   * A statement that extends beyond a year and overlaps that year by fewer than this many days does
   * not count toward the year's word, tally or headline; the statement list still shows its true
   * dates. A statement that lies wholly inside the year counts however short it is.
   */
  sliceEdgeDays: 0 | 15 | 30;
  baziStrengthThresholds: '45/55';
  baziLuckWeights: '0.6/0.4';
  baziYinStageReverse: boolean;
  baziEarthSeasons: 'four-jiyue';
  /** Which element the earth stems 戊 and 己 follow in the twelve stages. */
  baziEarthStages: 'fire-earth' | 'water-earth';
  /** Whose sign a year that clashes with the luck pillar takes: the source's ten-god sign or the favourable element's. */
  suiYunSign: 'source-tengod' | 'favourable-element';
  /** The sex a BaZi chart is read as; needed by the luck direction and by spouse and children rules. */
  baziSexConvention: SexConvention;
  westernHouses: 'whole-sign';
  westernTerms: 'lilly-ptolemy';
  /** Which column of Lilly's orbs (Christian Astrology p.107) the aspects use. */
  westernOrbs: 'first-column';
  /**
   * Lilly contradicts himself on a year in which the profected point stands in the radical tenth
   * house: his house table calls it very successful (p.730), his remark on aspects to the
   * Horoscope and Midheaven calls a year in square to them unhappy (p.720). One reading is
   * shown, never both averaged.
   */
  westernTenthYear: 'house-table' | 'angle-aspect';
  vedicDashaYearDays: 365.25;
  vedicNode: 'mean';
  /** Minutes of birth-time uncertainty beyond which birth-time-dependent rules are not evaluated. */
  birthTimeLimitMinutes: 60;
  /** Whether rules whose source was not opened are shown. */
  showUnopened: boolean;
}

export const DEFAULT_FORECAST_CONVENTIONS: ForecastConventions = {
  sliceLength: 'year',
  sliceEdgeDays: 15,
  baziStrengthThresholds: '45/55',
  baziLuckWeights: '0.6/0.4',
  baziYinStageReverse: true,
  baziEarthSeasons: 'four-jiyue',
  baziEarthStages: 'fire-earth',
  suiYunSign: 'source-tengod',
  baziSexConvention: 'none',
  westernHouses: 'whole-sign',
  westernTerms: 'lilly-ptolemy',
  westernOrbs: 'first-column',
  westernTenthYear: 'house-table',
  vedicDashaYearDays: 365.25,
  vedicNode: 'mean',
  birthTimeLimitMinutes: 60,
  showUnopened: false,
};

export interface ForecastConventionSpec extends Omit<ConventionSpec, 'key'> {
  key: keyof ForecastConventions;
}

export const FORECAST_CONVENTION_SPECS: readonly ForecastConventionSpec[] = [
  {
    key: 'sliceLength',
    title: 'Length of a slice',
    affects: 'Every reading, agreement cell and track of the forecast',
    why: 'Readings and agreement are stated per slice of time. This phase uses calendar years, cut at the first of January in UTC.',
    options: [{ value: 'year', label: 'Calendar year', description: 'January to December, UTC.' }],
  },
  {
    key: 'sliceEdgeDays',
    title: 'Edge of a year',
    affects: 'The word, the counts and the headline of a level in a year, and the agreement cells that rest on them',
    why: 'A statement that begins a few hours before the end of a year, or ends a few hours after its start, touches that year without filling it: the birthday clock is the usual case, because a profection or a return runs from one birthday to the next. A statement that extends beyond a year and overlaps it by fewer days than this does not count toward the word, the counts or the headline of that year. The statement list always shows the true dates, and a statement that lies wholly inside a year counts however short it is.',
    options: [
      { value: 0, label: 'No edge', description: 'Any overlap counts, however brief.' },
      { value: 15, label: '15 days', description: 'A statement that overlaps a year by fewer than 15 days, and extends beyond it, does not count for that year. The default.' },
      { value: 30, label: '30 days', description: 'The same with a month.' },
    ],
  },
  {
    key: 'baziStrengthThresholds',
    title: 'BaZi day-master strength bands',
    affects: 'bazi.strength-score and everything that reads the favourable elements',
    why: 'The bands are the project\'s own arithmetic and no source gives them. They are a setting of the calculation: no number appears in any statement, only the class (strong, weak or balanced). A score of exactly 45 or 55 is balanced.',
    options: [{ value: '45/55', label: 'Weak below 45, strong above 55', description: 'Balanced from 45 to 55 inclusive.' }],
  },
  {
    key: 'baziLuckWeights',
    title: 'Weights of luck pillar and year pillar',
    affects: 'Period rules that combine the luck pillar with the annual pillar',
    why: 'The sources do not give the relative weight of a ten-year luck pillar and a single year; 0.6 and 0.4 are the project\'s own arithmetic. They are a setting of the calculation and appear in no statement.',
    options: [{ value: '0.6/0.4', label: 'Luck 0.6, year 0.4', description: 'As the rule file states.' }],
  },
  {
    key: 'baziYinStageReverse',
    title: 'Direction of the twelve stages for yin stems',
    affects: 'bazi.twelve-stages',
    why: 'Schools differ on whether the twelve stages run backward for yin stems; the rule file lists the backward run as a convention not seen in the text.',
    options: [
      { value: 'true', label: 'Yin stems run backward', description: 'The common practice.' },
      { value: 'false', label: 'All stems run forward', description: 'The alternative school.' },
    ],
  },
  {
    key: 'baziEarthSeasons',
    title: 'Seasons of earth',
    affects: 'bazi.month-state and the strength score',
    why: 'The source makes earth strong in the sixth month only; common practice makes it strong in all four season-end months (the 季月).',
    options: [{ value: 'four-jiyue', label: 'All four 季月', description: 'The month branches 辰 戌 丑 未.' }],
  },
  {
    key: 'baziEarthStages',
    title: 'Twelve stages of the earth stems',
    affects: 'bazi.twelve-stages and the academy flag of bazi.topic-learning',
    why: 'The source gives two schools: earth follows fire (戊 長生 in 寅, 己 in 酉) or earth follows water (戊 in 申, 己 in 卯). The rule file does not choose between them.',
    options: [
      { value: 'fire-earth', label: 'Earth follows fire', description: '戊 寅, 己 酉. The default.' },
      { value: 'water-earth', label: 'Earth follows water', description: '戊 申, 己 卯.' },
    ],
  },
  {
    key: 'suiYunSign',
    title: 'Sign of a year that clashes with the luck pillar',
    affects: 'bazi.sui-yun-bing-lin',
    why: 'The source judges the clash by the ten god of the incoming year; later practice judges it by whether the element is favourable.',
    options: [
      { value: 'source-tengod', label: 'Ten-god sign', description: 'As the source gives it. The default.' },
      { value: 'favourable-element', label: 'Favourable element', description: 'The named alternative.' },
    ],
  },
  {
    key: 'baziSexConvention',
    title: 'Sex the BaZi chart is read as',
    affects: 'Direction of the luck pillars, and the spouse and children rules',
    why: 'Luck direction and the spouse and children rules differ by sex in the sources. Without a named convention those rules are skipped and listed as not evaluated.',
    options: [
      { value: 'none', label: 'None given', description: 'Rules that need it are not evaluated.' },
      { value: 'male-chart', label: 'Read as a male chart', description: 'The man\'s rules and the forward or backward luck count for a male chart.' },
      { value: 'female-chart', label: 'Read as a female chart', description: 'The woman\'s rules and the luck count for a female chart.' },
    ],
  },
  {
    key: 'westernHouses',
    title: 'Western house system',
    affects: 'Every Western rule that names a house, angle or the 2nd, 7th or 10th place',
    why: 'Lilly worked with Regiomontanus cusps, which the engine does not compute. Rules that cite a house run on whole-sign houses, and every statement from such a rule carries the badge "labelled variant: whole-sign houses". Regiomontanus is not offered yet.',
    options: [{ value: 'whole-sign', label: 'Whole sign', description: 'Houses are the signs counted from the ascendant sign. The only value today.' }],
  },
  {
    key: 'westernTerms',
    title: 'Western term (bound) table',
    affects: 'Western dignity scores of the Lilly rules (essential strength classes)',
    why: 'Lilly printed the Ptolemaic terms and his own triplicities and faces (Christian Astrology, Book I p.104). The Lilly rules run on that table and not on the Egyptian bounds, Dorothean triplicities and Chaldean faces of the engine\'s other Western code, so the difference is named.',
    options: [{ value: 'lilly-ptolemy', label: 'Lilly\'s table', description: 'Terms, triplicities and faces as printed in Christian Astrology. The only value today.' }],
  },
  {
    key: 'westernOrbs',
    title: 'Western orbs of aspect',
    affects: 'Whether two planets aspect, in every Western rule that reads an aspect',
    why: 'Lilly prints two columns of orbs and says he uses now the one and now the other (p.107). Two planets aspect when they lie within the sum of their moieties, half the orb of each, of the exact aspect.',
    options: [{ value: 'first-column', label: 'First column', description: 'Saturn 10, Jupiter 12, Mars 7 30\', Sun 17, Venus 8, Mercury 7, Moon 12 30\'. The only value today; the second column is in the module for a later choice.' }],
  },
  {
    key: 'westernTenthYear',
    title: 'Western year with the profected point in the tenth house',
    affects: 'lilly.profection.house-money, house-travel and mc-career for the 10th house, and lilly.profection.angle-aspect-years for a square to the Ascendant',
    why: 'Lilly\'s house table calls the year in which the profected Ascendant, Midheaven or Sun reaches the tenth house very successful (Christian Astrology, p.730 and p.731), while his remark on p.720 calls the years in square or opposition to the Horoscope or Midheaven unhappy. The tenth house is in square to the Ascendant, so the two cannot both be read. The rule file lists the house table first, which is the default.',
    options: [
      { value: 'house-table', label: 'House table', description: 'The tenth house is read as the house table says; the square to the Ascendant is not read as unhappy for it. The default.' },
      { value: 'angle-aspect', label: 'Aspect to the angles', description: 'The tenth house is read as a square to the Ascendant, unhappy; the house table is not read for it.' },
    ],
  },
  {
    key: 'vedicDashaYearDays',
    title: 'Length of a dasha year',
    affects: 'Vimshottari period boundaries',
    why: 'The engine\'s value, recorded so the output says which one it used.',
    options: [{ value: 365.25, label: '365.25 days', description: 'The engine\'s value.' }],
  },
  {
    key: 'vedicNode',
    title: 'Lunar node',
    affects: 'Rahu and Ketu in the Vedic rules',
    why: 'The engine computes the mean node.',
    options: [{ value: 'mean', label: 'Mean node', description: 'The engine\'s node.' }],
  },
  {
    key: 'birthTimeLimitMinutes',
    title: 'Birth-time uncertainty limit',
    affects: 'Rules that depend on the ascendant, houses, hour pillar or firdaria sect',
    why: 'Beyond this many minutes of uncertainty the rules that need the birth time are not evaluated and are listed with that reason.',
    options: [{ value: 60, label: '60 minutes', description: 'The default limit.' }],
  },
  {
    key: 'showUnopened',
    title: 'Show rules whose source was not opened',
    affects: 'The signal list',
    why: 'Every rule in this release has an opened source; the switch exists so a later rule that has none is hidden unless asked for.',
    options: [
      { value: 'false', label: 'Hide', description: 'The default.' },
      { value: 'true', label: 'Show', description: 'With the badge "source not opened".' },
    ],
  },
];

/** The sex a convention stands for, or null if none was named. */
export function sexOf(c: ForecastConventions): 'male' | 'female' | null {
  return c.baziSexConvention === 'male-chart' ? 'male' : c.baziSexConvention === 'female-chart' ? 'female' : null;
}
