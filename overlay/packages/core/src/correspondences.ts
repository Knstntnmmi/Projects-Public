// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The correspondence registry: each claimed link between two systems, graded by what
 * kind of link it is. Several of the claims are checked by the test suite, and those
 * say so.
 */

/**
 *   exact       true by definition or by arithmetic; the two things have the same boundaries
 *   structural  one arrangement is a stated transformation of the other
 *   historical  once an observation, since frozen into a count that no longer tracks the sky
 *   loose       a resemblance of number or theme; boundaries do not coincide
 *   coincidence a numerical near-match with no shown common origin
 */
export type CorrespondenceGrade = 'exact' | 'structural' | 'historical' | 'loose' | 'coincidence';

export interface Correspondence {
  id: string;
  between: [string, string];
  grade: CorrespondenceGrade;
  claim: string;
  detail: string;
  /** Whether a test in this repository checks the claim. */
  verifiedHere: boolean;
  sources: string[];
}

export const CORRESPONDENCES: readonly Correspondence[] = [
  {
    id: 'terms-signs',
    between: ['Twenty-four solar terms', 'Tropical zodiac'],
    grade: 'exact',
    claim: 'The twelve zhongqi are the twelve tropical sign ingresses.',
    detail:
      'Since the Shixian calendar of 1645 each solar term has been defined by the Sun reaching a multiple of fifteen degrees of ecliptic longitude, which is how the tropical signs are defined too. Chunfen is 0 Aries, Guyu is 0 Taurus, and so on. Before 1645 the terms were equal divisions of the year in time (pingqi), so for older dates the match is only approximate, by up to about two days.',
    verifiedHere: true,
    sources: ['Aslaksen, "The Mathematics of the Chinese Calendar" (2010)', 'Y. T. Liu, "Calendar Rules: 24 Solar Terms", ytliu0.github.io/ChineseCalendar'],
  },
  {
    id: 'branch-months-signs',
    between: ['BaZi branch months', 'Tropical zodiac'],
    grade: 'exact',
    claim: 'Each BaZi month is the Sun\'s passage from fifteen degrees of one sign to fifteen degrees of the next.',
    detail:
      'The months open at the twelve jie, which sit halfway between the zhongqi. The Yin month runs from 15 Aquarius to 15 Pisces, the Mao month from 15 Pisces to 15 Aries. A month branch therefore never coincides with a sign; it always straddles two.',
    verifiedHere: true,
    sources: ['Follows from the definition of the solar terms'],
  },
  {
    id: 'sovereign-months',
    between: ['Twelve sovereign hexagrams', 'BaZi branch months'],
    grade: 'exact',
    claim: 'One sovereign hexagram belongs to each branch month.',
    detail: 'Fu to the Zi month (containing the winter solstice), Lin to Chou, Tai to Yin, and round to Kun in Hai. The assignment is to the month, so the hexagrams inherit the months\' boundaries.',
    verifiedHere: true,
    sources: ['Yi wei Jilantu', 'Nielsen, "A Companion to Yi jing Numerology and Cosmology" (2003), s.v. xiao xi gua'],
  },
  {
    id: 'gua-qi-ecliptic',
    between: ['Gua qi (six days seven parts)', 'Solar longitude'],
    grade: 'loose',
    claim: 'Sixty hexagrams divide the year from the winter solstice.',
    detail:
      'The Han scheme gives each hexagram 6 7/80 days of a 365 1/4-day year, in mean time. Laid on the true Sun as arcs of six degrees it shifts by up to about two days through the year, because the Sun does not move evenly. Both readings are offered as a convention; neither is "the" boundary.',
    verifiedHere: true,
    sources: ['Xin Tang shu, Li zhi (the Dayan calendar\'s Gua yi)', 'Nielsen (2003), s.v. gua qi'],
  },
  {
    id: 'gate-wheel-fuxi',
    between: ['Sixty-four-gate ecliptic wheel', 'Fu Xi circle of Shao Yong'],
    grade: 'structural',
    claim: 'The modern gate wheel is the Fu Xi circular arrangement, reversed in direction and rotated.',
    detail:
      'Walking the gate wheel forward through the zodiac is walking Shao Yong\'s circle backward. The seam between Fu and Kun, which Shao Yong places at the winter solstice, falls on the gate wheel at 13 degrees 15 minutes of Taurus. The two hexagram calendars in circulation therefore disagree about every date.',
    verifiedHere: true,
    sources: ['Computed in packages/core/test/iching.test.ts'],
  },
  {
    id: 'gate-wheel-gua-qi',
    between: ['Sixty-four-gate ecliptic wheel', 'Gua qi'],
    grade: 'loose',
    claim: 'Both assign a hexagram to the Sun\'s position.',
    detail: 'They share nothing but the idea. The sequences differ (sixty hexagrams against sixty-four), the arcs differ (six degrees against five and five-eighths) and the starting points differ (270 against 302 degrees).',
    verifiedHere: true,
    sources: ['Comparison of the two sequences in this repository'],
  },
  {
    id: 'jupiter-year-branch',
    between: ['Year branch (Tai Sui)', 'Jupiter'],
    grade: 'historical',
    claim: 'The twelve-year branch cycle descends from Jupiter\'s circuit of the sky.',
    detail:
      'Jupiter takes 11.86 years, not 12, so it gains a sign on the count about every 85 years. The count was detached from the planet in the Han. Jupiter\'s actual sign and the year branch are both drawn on the timeline so the drift can be seen.',
    verifiedHere: false,
    sources: ['Needham, "Science and Civilisation in China", vol. 3, pp. 402-404'],
  },
  {
    id: 'sixty-years-conjunctions',
    between: ['Sixty-year cycle', 'Jupiter-Saturn conjunctions'],
    grade: 'coincidence',
    claim: 'Three Jupiter-Saturn conjunctions take about sixty years.',
    detail:
      'Three synodic periods come to 59.6 years. The sexagenary cycle was counting days on Shang oracle bones a millennium before it was applied to years, so the conjunction cycle cannot be its origin.',
    verifiedHere: false,
    sources: ['Smith, "The Chinese Sexagenary Cycle and the Ritual Origins of the Calendar" (2011)'],
  },
  {
    id: 'mansions-nakshatras',
    between: ['Twenty-eight xiu', 'Twenty-seven nakshatras'],
    grade: 'loose',
    claim: 'Both are lunar mansion systems, and several of their marker stars are shared.',
    detail:
      'The xiu are unequal and were measured along the equator from determinative stars; the nakshatras became equal arcs of the sidereal ecliptic. Their boundaries do not line up. The almanac\'s twenty-eight-day "mansion of the day" is a further step removed: a count locked to the week that ignores the Moon.',
    verifiedHere: false,
    sources: ['Needham, vol. 3, pp. 242-259', 'Pingree, "Jyotihsastra" (1981)'],
  },
  {
    id: 'tropical-sidereal',
    between: ['Tropical zodiac', 'Sidereal zodiac'],
    grade: 'structural',
    claim: 'The same twelve arcs, offset by the ayanamsa.',
    detail: 'The offset is about 24 degrees today under the Lahiri definition and grows by a degree every seventy-two years. The two coincided in the third century.',
    verifiedHere: true,
    sources: ['Indian Astronomical Ephemeris (Lahiri ayanamsa)'],
  },
  {
    id: 'profection-annual-pillar',
    between: ['Annual profection', 'BaZi annual pillar'],
    grade: 'loose',
    claim: 'Both name a ruler for each year of life.',
    detail: 'The profected year turns at the solar return (the birthday, to within a day). The annual pillar turns at Lichun for everyone. For most people the two years overlap for only part of their length.',
    verifiedHere: true,
    sources: ['Vettius Valens, Anthology IV', 'Standard Four Pillars practice'],
  },
  {
    id: 'planetary-week',
    between: ['Planetary days', 'Twenty-eight mansion days'],
    grade: 'exact',
    claim: 'The almanac\'s mansion-of-the-day cycle is the seven-day planetary week counted four times.',
    detail: 'Each mansion is tied to one of the seven luminaries, and twenty-eight is four weeks, so the mansion of the day fixes the weekday: Jiao always falls on a Thursday, Fang on a Sunday.',
    verifiedHere: true,
    sources: ['Computed in packages/core/test/overlay.test.ts'],
  },
];
