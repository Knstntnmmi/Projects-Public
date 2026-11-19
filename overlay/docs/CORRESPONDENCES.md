# Correspondences between systems

Generated from `packages/core/src/correspondences.ts` by `npm run generate`. Do not edit by hand.

Links between systems are asserted everywhere and graded almost nowhere. Each one here carries a grade. *Exact* means the two things have the same boundaries by definition or arithmetic. *Structural* means one arrangement is a stated transformation of the other. *Historical* means the link was once an observation and has since been frozen into a count that no longer follows the sky. *Loose* means a resemblance of number or theme whose boundaries do not coincide. *Coincidence* means a numerical near-match with no shown common origin.

## Twenty-four solar terms and Tropical zodiac

Grade: **exact** (checked by the test suite).

The twelve zhongqi are the twelve tropical sign ingresses. Since the Shixian calendar of 1645 each solar term has been defined by the Sun reaching a multiple of fifteen degrees of ecliptic longitude, which is how the tropical signs are defined too. Chunfen is 0 Aries, Guyu is 0 Taurus, and so on. Before 1645 the terms were equal divisions of the year in time (pingqi), so for older dates the match is only approximate, by up to about two days.

Sources: Aslaksen, "The Mathematics of the Chinese Calendar" (2010); Y. T. Liu, "Calendar Rules: 24 Solar Terms", ytliu0.github.io/ChineseCalendar.

## BaZi branch months and Tropical zodiac

Grade: **exact** (checked by the test suite).

Each BaZi month is the Sun's passage from fifteen degrees of one sign to fifteen degrees of the next. The months open at the twelve jie, which sit halfway between the zhongqi. The Yin month runs from 15 Aquarius to 15 Pisces, the Mao month from 15 Pisces to 15 Aries. A month branch therefore never coincides with a sign; it always straddles two.

Sources: Follows from the definition of the solar terms.

## Twelve sovereign hexagrams and BaZi branch months

Grade: **exact** (checked by the test suite).

One sovereign hexagram belongs to each branch month. Fu to the Zi month (containing the winter solstice), Lin to Chou, Tai to Yin, and round to Kun in Hai. The assignment is to the month, so the hexagrams inherit the months' boundaries.

Sources: Yi wei Jilantu; Nielsen, "A Companion to Yi jing Numerology and Cosmology" (2003), s.v. xiao xi gua.

## Gua qi (six days seven parts) and Solar longitude

Grade: **loose** (checked by the test suite).

Sixty hexagrams divide the year from the winter solstice. The Han scheme gives each hexagram 6 7/80 days of a 365 1/4-day year, in mean time. Laid on the true Sun as arcs of six degrees it shifts by up to about two days through the year, because the Sun does not move evenly. Both readings are offered as a convention; neither is "the" boundary.

Sources: Xin Tang shu, Li zhi (the Dayan calendar's Gua yi); Nielsen (2003), s.v. gua qi.

## Sixty-four-gate ecliptic wheel and Fu Xi circle of Shao Yong

Grade: **structural** (checked by the test suite).

The modern gate wheel is the Fu Xi circular arrangement, reversed in direction and rotated. Walking the gate wheel forward through the zodiac is walking Shao Yong's circle backward. The seam between Fu and Kun, which Shao Yong places at the winter solstice, falls on the gate wheel at 13 degrees 15 minutes of Taurus. The two hexagram calendars in circulation therefore disagree about every date.

Sources: Computed in packages/core/test/iching.test.ts.

## Sixty-four-gate ecliptic wheel and Gua qi

Grade: **loose** (checked by the test suite).

Both assign a hexagram to the Sun's position. They share nothing but the idea. The sequences differ (sixty hexagrams against sixty-four), the arcs differ (six degrees against five and five-eighths) and the starting points differ (270 against 302 degrees).

Sources: Comparison of the two sequences in this repository.

## Year branch (Tai Sui) and Jupiter

Grade: **historical** (stated from the literature, not checked here).

The twelve-year branch cycle descends from Jupiter's circuit of the sky. Jupiter takes 11.86 years, not 12, so it gains a sign on the count about every 85 years. The count was detached from the planet in the Han. Jupiter's actual sign and the year branch are both drawn on the timeline so the drift can be seen.

Sources: Needham, "Science and Civilisation in China", vol. 3, pp. 402-404.

## Sixty-year cycle and Jupiter-Saturn conjunctions

Grade: **coincidence** (stated from the literature, not checked here).

Three Jupiter-Saturn conjunctions take about sixty years. Three synodic periods come to 59.6 years. The sexagenary cycle was counting days on Shang oracle bones a millennium before it was applied to years, so the conjunction cycle cannot be its origin.

Sources: Smith, "The Chinese Sexagenary Cycle and the Ritual Origins of the Calendar" (2011).

## Twenty-eight xiu and Twenty-seven nakshatras

Grade: **loose** (stated from the literature, not checked here).

Both are lunar mansion systems, and several of their marker stars are shared. The xiu are unequal and were measured along the equator from determinative stars; the nakshatras became equal arcs of the sidereal ecliptic. Their boundaries do not line up. The almanac's twenty-eight-day "mansion of the day" is a further step removed: a count locked to the week that ignores the Moon.

Sources: Needham, vol. 3, pp. 242-259; Pingree, "Jyotihsastra" (1981).

## Tropical zodiac and Sidereal zodiac

Grade: **structural** (checked by the test suite).

The same twelve arcs, offset by the ayanamsa. The offset is about 24 degrees today under the Lahiri definition and grows by a degree every seventy-two years. The two coincided in the third century.

Sources: Indian Astronomical Ephemeris (Lahiri ayanamsa).

## Annual profection and BaZi annual pillar

Grade: **loose** (checked by the test suite).

Both name a ruler for each year of life. The profected year turns at the solar return (the birthday, to within a day). The annual pillar turns at Lichun for everyone. For most people the two years overlap for only part of their length.

Sources: Vettius Valens, Anthology IV; Standard Four Pillars practice.

## Planetary days and Twenty-eight mansion days

Grade: **exact** (checked by the test suite).

The almanac's mansion-of-the-day cycle is the seven-day planetary week counted four times. Each mansion is tied to one of the seven luminaries, and twenty-eight is four weeks, so the mansion of the day fixes the weekday: Jiao always falls on a Thursday, Fang on a Sunday.

Sources: Computed in packages/core/test/overlay.test.ts.
