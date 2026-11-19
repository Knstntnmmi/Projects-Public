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
      'Since the Shixian calendar of 1645 each solar term has been defined by the Sun reaching a multiple of fifteen degrees of ecliptic longitude, which is how the tropical signs are defined too. Chunfen is 0 Aries, Guyu is 0 Taurus, and so on. Before 1645 the terms were equal divisions of the year in time (pingqi), so for older dates the match is only approximate. Liu gives the intervals between major terms as 29.44 to 31.44 days under the true-Sun rule against a constant 30.44 under pingqi; the project\'s own estimate is that a term can differ by a day or two. The tests check the identity of terms and sign ingresses for the present rule, not the history.',
    verifiedHere: true,
    sources: [
      'Helmer Aslaksen, "The Mathematics of the Chinese Calendar", unpublished paper, National University of Singapore; the copy read is dated 13 May 2004',
      'Y. T. Liu, "24 Solar Terms (二十四節氣)", ytliu0.github.io/ChineseCalendar/solarTerms.html (last major update February 2019)',
    ],
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
    grade: 'structural',
    claim: 'One sovereign hexagram belongs to each month, Fu to the Zi month and round to Kun in Hai; the arcs are the branch months offset by fifteen degrees.',
    detail:
      'The assignment by name (Fu with Zi, Lin with Chou, Tai with Yin, and so on) matches the Dayan table (Xin Tang shu 28A), and Yi Xing says the twelve month hexagrams come from Meng Xi\'s Zhangju (27A, Gua yi). The boundaries do not coincide. The BaZi month runs from jie to jie, but the Dayan table begins each month\'s group of hexagrams, with the duke and then the sovereign, at the zhongqi, so the sovereign\'s month runs from zhongqi to zhongqi, fifteen degrees after the branch month. An earlier version of this registry graded the link exact and the ring drew the sovereigns from the jie. The ring and the track still do by default, and the sovereignBoundary convention moves them to the zhongqi; the test suite checks that the two readings differ by exactly fifteen degrees.',
    verifiedHere: true,
    sources: [
      'Xin Tang shu 27A (Gua yi): the twelve month hexagrams from Meng Xi\'s Zhangju, as reported by Yi Xing',
      'Xin Tang shu 28A: the Dayan table, which places the duke and sovereign hexagrams at the zhongqi',
      'Bent Nielsen, A Companion to Yi jing Numerology and Cosmology (2003), s.v. xiao xi gua (not yet checked against the book)',
    ],
  },
  {
    id: 'gua-qi-ecliptic',
    between: ['Gua qi (six days seven parts)', 'Solar longitude'],
    grade: 'loose',
    claim: 'Sixty hexagrams divide the year from the winter solstice.',
    detail:
      'The scheme implemented is Meng Xi\'s, as Yi Xing adopted it in the Dayan calendar: 60 hexagrams of 6 7/80 days each, 365 1/4 days in all, beginning with Zhong Fu at the winter solstice. Jing Fang\'s allotment, as Yi Xing reports it, differs: Kan, Li, Zhen and Dui take 73/80 of a day at the head of each solstice and equinox, Yi, Jin, Jing and Da Xu take 5 days 14 parts, and the rest 6 days 7 parts; it is offered as the jing-fang convention. Laid on the true Sun as arcs of six degrees, the Meng Xi scheme shifts by up to about two days through the year, because the Sun does not move evenly. All the readings are offered as a convention; none is "the" boundary. The Yi wei Jilantu is cited only for beginning the count at Zhong Fu.',
    verifiedHere: true,
    sources: [
      'Xin Tang shu 27A (Guahou yi, Gua yi) for the argument; 28A for the table',
      'Sun Jiran, 早期卦氣思想溯源, 中國文化研究所學報 69 (2019), p. 1, for the Yi wei Jilantu beginning at Zhong Fu',
      'Bent Nielsen, A Companion to Yi jing Numerology and Cosmology (2003), s.v. gua qi (not yet checked against the book)',
    ],
  },
  {
    id: 'gate-wheel-fuxi',
    between: ['Sixty-four-gate ecliptic wheel', 'Fu Xi circle (xiantian), attributed to Shao Yong'],
    grade: 'structural',
    claim: 'The modern gate wheel is the Fu Xi circular arrangement, reversed in direction and rotated.',
    detail:
      'Walking the gate wheel forward through the zodiac is walking the circle attributed to Shao Yong backward. The seam between Fu and Kun, which this project places at the winter solstice with Fu following it, falls on the gate wheel at 13 degrees 15 minutes of Taurus. The two hexagram calendars in circulation therefore disagree about every date. The attribution of the circle to Shao Yong is the conventional one; no source read for this project supports or refutes it.',
    verifiedHere: true,
    sources: ['Computed in packages/core/test/iching.test.ts', 'The attribution to Shao Yong is conventional and was not checked in any source read for this project'],
  },
  {
    id: 'gate-wheel-gua-qi',
    between: ['Sixty-four-gate ecliptic wheel', 'Gua qi'],
    grade: 'loose',
    claim: 'Both assign a hexagram to the Sun\'s position.',
    detail:
      'They share nothing but the idea. The sequences differ (sixty hexagrams in the Meng Xi scheme, or sixty-four periods in Jing Fang\'s, four of them under a degree wide, against sixty-four gates in another order), the arcs differ (six degrees against five and five-eighths) and the starting points differ (270 against 302 degrees).',
    verifiedHere: true,
    sources: ['Comparison of the two sequences in this repository'],
  },
  {
    id: 'jupiter-year-branch',
    between: ['Year branch (Tai Sui)', 'Jupiter'],
    grade: 'historical',
    claim: 'The twelve-year branch cycle is likely to descend from Jupiter\'s circuit of the sky.',
    detail:
      'Jupiter takes 11.86 years, not 12, so it gains a sign on the count about every 85 years (Smith gives 84.7). Smith says the discrepancy may already have been noticed by the third or second century BC and prompted the count to be decoupled from the planet, and that Jupiter is likely to have motivated the twelve-year count in the first place. Jupiter\'s actual sign and the year branch are both drawn on the timeline so the drift can be seen.',
    verifiedHere: false,
    sources: [
      'Adam Smith, "The Chinese Sexagenary Cycle and the Ritual Foundations of the Calendar", in J. M. Steele (ed.), Calendars and Years II (Oxford: Oxbow Books, 2011), ch. 6; read in the author\'s proof, p. 28, printed page not found',
      'Joseph Needham with Wang Ling, Science and Civilisation in China, vol. 3 (1959), about pp. 402-404 (not yet checked against the book)',
    ],
  },
  {
    id: 'sixty-years-conjunctions',
    between: ['Sixty-year cycle', 'Jupiter-Saturn conjunctions'],
    grade: 'coincidence',
    claim: 'Three Jupiter-Saturn conjunctions take about sixty years.',
    detail:
      'Three synodic periods come to 59.6 years. Smith finds the sexagenary cycle counting named days from about 1250 BC and applied to years only from about the third century BC, some thousand years later, and says the sixty-year count is divorced from the orbit of Jupiter. He does not discuss Jupiter-Saturn conjunctions. That a conjunction cycle therefore cannot be the origin of the sixty-year count is this project\'s own inference, not Smith\'s conclusion.',
    verifiedHere: false,
    sources: [
      'Adam Smith, "The Chinese Sexagenary Cycle and the Ritual Foundations of the Calendar", in J. M. Steele (ed.), Calendars and Years II (Oxford: Oxbow Books, 2011), ch. 6; supports only the order of days before years; read in the author\'s proof, pp. 1 and 28, printed pages not found',
    ],
  },
  {
    id: 'mansions-nakshatras',
    between: ['Twenty-eight xiu', 'Twenty-seven nakshatras'],
    grade: 'loose',
    claim: 'Both divide the sky into about twenty-eight or twenty-seven parts along the Moon\'s path, and several of their marker stars are shared.',
    detail:
      'The Chinese xiu (lodges) are unequal and were measured along the equator from determinative stars; the nakshatras (lunar mansions) became equal arcs of the sidereal ecliptic. Their boundaries do not line up. The almanac\'s twenty-eight-day "lodge of the day" is a further step removed: a count locked to the week that ignores the Moon. The statements about the xiu, the nakshatras and the shared stars come from general knowledge and the two works cited, neither of which was opened for this project. English usage for xiu is split between lodges and lunar mansions.',
    verifiedHere: false,
    sources: [
      'Joseph Needham with Wang Ling, Science and Civilisation in China, vol. 3 (1959), pp. 242-259 (not yet checked against the book)',
      'David Pingree, Jyotiḥśāstra: Astral and Mathematical Literature, A History of Indian Literature vol. 6 fasc. 4 (Wiesbaden: Harrassowitz, 1981) (not yet checked against the book)',
    ],
  },
  {
    id: 'tropical-sidereal',
    between: ['Tropical zodiac', 'Sidereal zodiac'],
    grade: 'structural',
    claim: 'The same twelve arcs, offset by the ayanamsa.',
    detail:
      'The offset is about 24 degrees today under the Lahiri definition and grows by a degree every seventy-two years. Run backward, the implementation gives zero in about 285 CE, which agrees with the zero point of 285 CE that Lahiri is quoted as giving; the two coincided in the third century.',
    verifiedHere: true,
    sources: [
      'Koch and Treindl, Swiss Ephemeris documentation (Astrodienst), section 2.8.5 and appendix E: the Committee\'s definition, the Indian Astronomical Ephemeris values quoted there, and Lahiri\'s 285 CE zero point; read',
      'Report of the Calendar Reform Committee (New Delhi: CSIR, 1955), the defining document; known here only through that account (not yet checked against the report)',
      'Indian Astronomical Ephemeris (Government of India), the published values; known here only as quoted in the Swiss Ephemeris documentation (not yet checked against the volumes)',
    ],
  },
  {
    id: 'profection-annual-pillar',
    between: ['Annual profection', 'BaZi annual pillar'],
    grade: 'loose',
    claim: 'Both name a ruler for each year of life.',
    detail:
      'The profected year turns at the solar return (the birthday, to within a day). The annual pillar turns at Lichun for everyone. For most people the two years overlap for only part of their length. That a profection turns at a tropical solar return is a modern convention; whether Valens defines it so, or counts from the birthday in days, was not established.',
    verifiedHere: true,
    sources: [
      'Vettius Valens, Anthology, book IV (edition and chapter to be supplied; not yet checked against the book)',
      'Standard Four Pillars practice, for the annual pillar turning at Lichun',
    ],
  },
  {
    id: 'planetary-week',
    between: ['Planetary days', 'Twenty-eight lodge days'],
    grade: 'exact',
    claim: 'The almanac\'s lodge-of-the-day cycle is the seven-day planetary week counted four times.',
    detail:
      'Each lodge is tied to one of the seven luminaries, and twenty-eight is four weeks, so the lodge of the day fixes the weekday: Jiao always falls on a Thursday, Fang on a Sunday. The test checks the arithmetic of the project\'s own day count. The pairing of lodges with weekdays follows the Chinese almanac convention; its historical source has not been checked. The Xiuyao jing (Taisho 1299) is the usual candidate, but it counts twenty-seven lodges, so it is not cited here for the twenty-eight-day count until it has been read.',
    verifiedHere: true,
    sources: [
      'Computed in packages/core/test/overlay.test.ts',
      'Consistent with a table of the seven-luminary groups at 6tail.cn, read in the source audit; historical source not yet checked',
    ],
  },
];
