# Conventions

Generated from `packages/core/src/conventions.ts` by `npm run generate`. Do not edit by hand.

Two calculators can both be right and still print different charts, because each has made choices that it does not announce. This engine makes every such choice a named setting. Each result records the settings that produced it, and the sensitivity report recomputes the result under every alternative.

## Clock the birth hour is read from

Setting `timeBasis`. Affects: BaZi day and hour pillars.

The double-hours were defined by the Sun, but birth certificates record zone time. Calculators differ on whether to correct for longitude, for the equation of time, and for daylight saving, and most do not say which they did.

| Value | Meaning | Default |
| --- | --- | --- |
| `civil` | Civil clock. The wall clock of the time zone, daylight saving included. What most online calculators use. | yes |
| `standard` | Standard time. The wall clock with any daylight-saving hour removed. |  |
| `lmt` | Local mean time. UTC plus four minutes per degree of east longitude. |  |
| `apparent` | True solar time. Local mean time plus the equation of time (up to about sixteen minutes either way). |  |

## Where the day pillar changes

Setting `dayBoundary`. Affects: BaZi day pillar for births between 23:00 and midnight.

The Zi double-hour runs from 23:00 to 01:00. One school changes the day when Zi begins; the other keeps the calendar day until midnight and calls 23:00 to 24:00 the "late Zi hour".

| Value | Meaning | Default |
| --- | --- | --- |
| `zi23` | At 23:00. The day pillar advances when the Zi hour begins. | yes |
| `midnight` | At midnight (late Zi hour). The day pillar advances at 00:00; the hour stem of 23:00 to 24:00 is still taken from the following day. |  |

## Where the year pillar changes

Setting `yearBoundary`. Affects: BaZi year pillar for births in January and early February.

Four Pillars practice turns the year at Lichun (Sun at 315 degrees). Popular zodiac tables turn it at the lunar new year, which this version does not implement.

| Value | Meaning | Default |
| --- | --- | --- |
| `lichun` | Lichun. The instant the Sun reaches 315 degrees of tropical longitude. | yes |

## Age at which luck pillars begin

Setting `luckStart`. Affects: Start dates of every ten-year luck pillar.

The interval from birth to the neighbouring jie is scaled so that three days stand for one year. Schools differ in how finely they count the remainder.

| Value | Meaning | Default |
| --- | --- | --- |
| `three-days-per-year` | Three days per year, to the second. Three days is a year, six hours a month, twelve minutes a day, thirty seconds an hour. | yes |

## How the gua qi hexagrams divide the year

Setting `guaQi`. Affects: Gua qi ring and track, and the gua qi hexagram of a moment.

The scheme implemented is Meng Xi's as Yi Xing adopted it in the Dayan calendar: sixty hexagrams of six and seven-eightieths days each from the winter solstice (Xin Tang shu 27A, Gua yi; table in 28A). Yi Xing also reports a different allotment of Jing Fang's, offered as a third option. Laid on the true Sun instead of a mean year, each of the sixty spans six degrees of longitude, and the two readings differ by up to about two days.

| Value | Meaning | Default |
| --- | --- | --- |
| `equal-longitude` | Six degrees of solar longitude each. Meng Xi's sixty hexagrams, consistent with the modern true-Sun solar terms. | yes |
| `mean-time` | One sixtieth of the solstice-to-solstice year each. Meng Xi's sixty hexagrams, closer to the original mean-time scheme. |  |
| `jing-fang` | Jing Fang's allotment, in mean time. As Yi Xing reports it: Kan, Li, Zhen and Dui take the first 73/80 of a day at the head of each solstice and equinox; Yi, Jin, Jing and Da Xu take 5 days 14 parts; the rest 6 days 7 parts. Scaled to fill the solstice-to-solstice year, so the four cardinal hexagrams appear as short periods of their own. |  |

## Where each sovereign hexagram begins

Setting `sovereignBoundary`. Affects: Sovereign-hexagram ring, track label and fact.

The twelve sovereign hexagrams are set one to a month, but the BaZi month runs from jie to jie while the Dayan table (Xin Tang shu 28A) begins each month's group of five hexagrams at the zhongqi. The two arcs are the same thirty degrees offset by fifteen.

| Value | Meaning | Default |
| --- | --- | --- |
| `jie` | At the jie, with the branch month. Fu from the Sun at 255 degrees (Daxue). The project's default. | yes |
| `zhongqi` | At the zhongqi, as in the Dayan table. Fu from the Sun at 270 degrees (the winter solstice), fifteen degrees later. |  |

## Place of the lunar nodes in a night-chart firdaria

Setting `firdariaNodes`. Affects: Firdaria periods of nocturnal charts.

The medieval sources disagree on whether the nodes close the sequence or follow Mars.

| Value | Meaning | Default |
| --- | --- | --- |
| `end` | Nodes at the end. Moon, Saturn, Jupiter, Mars, Sun, Venus, Mercury, North Node, South Node. | yes |
| `after-mars` | Nodes after Mars. Moon, Saturn, Jupiter, Mars, North Node, South Node, Sun, Venus, Mercury. |  |

## Sidereal zero point

Setting `ayanamsa`. Affects: Nakshatras, sidereal signs, vimshottari dasha.

Sidereal systems measure from a star-fixed point; which point is a matter of school.

| Value | Meaning | Default |
| --- | --- | --- |
| `lahiri` | Lahiri (Chitrapaksha). The Indian national-calendar standard. The true ayanamsa (nutation included), fixed at 23 degrees 15 minutes 00.658 seconds on 21 March 1956 and carried by the IAU precession; within about 0.3 arcsecond of the Indian Astronomical Ephemeris values it was compared with, if the value at that epoch is indeed a true one. | yes |

## Maya calendar correlation

Setting `mayaCorrelation`. Affects: Long Count, Tzolkin, Haab.

The correlation constant ties the Long Count to the Julian day count. It is chosen by argument, not measured, and the literature does not settle on one value: Martin and Skidmore (2012) call 584283 and 584285 the two most widely accepted and argue for 584286 from Venus records.

| Value | Meaning | Default |
| --- | --- | --- |
| `584283` | 584283 (Goodman-Martinez-Thompson). The common default, and not a settled value. Favoured by those who hold that the highland day count has continued unbroken (Martin and Skidmore 2012). | yes |
| `584285` | 584285 (Thompson's own value). Thompson's value from 1927 onwards, two days later than 584283 (Martin and Skidmore 2012). |  |
| `584286` | 584286 (Martin and Skidmore). Proposed by Martin and Skidmore (2012) from Maya records of the movements of Venus; one day later than 584285. |  |

## Choices that are not yet settings

These are fixed in this version, and are listed so that nobody mistakes them for facts. The year pillar turns at Lichun only; the lunar-new-year and winter-solstice year boundaries are not offered. Solar terms are always the true-Sun terms, although the Chinese calendar used mean-time terms before 1645, so pillars for earlier dates follow the modern rule and not the rule in force at the time. Houses are whole-sign, the lunar node is the mean node, triplicity lords are the Dorothean set and bounds the Egyptian set; the Ptolemaic tables that William Lilly printed are not included yet. Hidden stems follow the common modern table. Vimshottari years are 365.25 days.

# Forecast conventions

The forecast layer adds the choices the published rules leave open. They sit beside the settings above and are recorded in every forecast. The sovereign-hexagram boundary and the firdaria node order are the engine settings above and are not repeated.

## Length of a slice

Setting `sliceLength`. Affects: Every reading, agreement cell and track of the forecast.

Readings and agreement are stated per slice of time. This phase uses calendar years, cut at the first of January in UTC.

| Value | Meaning | Default |
| --- | --- | --- |
| `year` | Calendar year. January to December, UTC. | yes |

## Cap on signals no promise rule gated

Setting `cap_ungated`. Affects: The rule weight shown beside a signal.

No accepted rule carries a sourced gate, so every signal is ungated. The cap is a display choice, off by default, and never changes a direction.

| Value | Meaning | Default |
| --- | --- | --- |
| `false` | Off. Each signal shows the rule weight the extractor rated. | yes |
| `true` | On. Ungated signals show rule weight 1. |  |

## BaZi day-master strength bands

Setting `baziStrengthThresholds`. Affects: bazi.strength-score and everything that reads the favourable elements.

The score bands are the extractor's operationalisation of the source; a score of exactly 45 or 55 is balanced.

| Value | Meaning | Default |
| --- | --- | --- |
| `45/55` | Weak below 45, strong above 55. Balanced from 45 to 55 inclusive. | yes |

## Weights of luck pillar and year pillar

Setting `baziLuckWeights`. Affects: Period rules that combine the luck pillar with the annual pillar.

The sources do not give the relative weight of a ten-year luck pillar and a single year; the rule file states 0.6 and 0.4.

| Value | Meaning | Default |
| --- | --- | --- |
| `0.6/0.4` | Luck 0.6, year 0.4. As the rule file states. | yes |

## Direction of the twelve stages for yin stems

Setting `baziYinStageReverse`. Affects: bazi.twelve-stages.

Schools differ on whether the twelve stages run backward for yin stems; the rule file lists the backward run as a convention not seen in the text.

| Value | Meaning | Default |
| --- | --- | --- |
| `true` | Yin stems run backward. The common practice. | yes |
| `false` | All stems run forward. The alternative school. |  |

## Seasons of earth

Setting `baziEarthSeasons`. Affects: bazi.month-state and the strength score.

The source makes earth strong in the sixth month only; common practice makes it strong in all four season-end months (the 季月).

| Value | Meaning | Default |
| --- | --- | --- |
| `four-jiyue` | All four 季月. The month branches 辰 戌 丑 未. | yes |

## Twelve stages of the earth stems

Setting `baziEarthStages`. Affects: bazi.twelve-stages and the academy flag of bazi.topic-learning.

The source gives two schools: earth follows fire (戊 長生 in 寅, 己 in 酉) or earth follows water (戊 in 申, 己 in 卯). The rule file does not choose between them.

| Value | Meaning | Default |
| --- | --- | --- |
| `fire-earth` | Earth follows fire. 戊 寅, 己 酉. The default. | yes |
| `water-earth` | Earth follows water. 戊 申, 己 卯. |  |

## Sign of a year that clashes with the luck pillar

Setting `suiYunSign`. Affects: bazi.sui-yun-bing-lin.

The source judges the clash by the ten god of the incoming year; later practice judges it by whether the element is favourable.

| Value | Meaning | Default |
| --- | --- | --- |
| `source-tengod` | Ten-god sign. As the source gives it. The default. | yes |
| `favourable-element` | Favourable element. The named alternative. |  |

## Sex the BaZi chart is read as

Setting `baziSexConvention`. Affects: Direction of the luck pillars, and the spouse and children rules.

Luck direction and the spouse and children rules differ by sex in the sources. Without a named convention those rules are skipped and listed as not evaluated.

| Value | Meaning | Default |
| --- | --- | --- |
| `none` | None given. Rules that need it are not evaluated. | yes |
| `male-chart` | Read as a male chart. The man's rules and the forward or backward luck count for a male chart. |  |
| `female-chart` | Read as a female chart. The woman's rules and the luck count for a female chart. |  |

## Western house system

Setting `westernHouses`. Affects: Western rules that name a house (withheld in this phase).

Whole-sign houses are what the engine computes; rules that cite cusps run whole-sign as a labelled variant.

| Value | Meaning | Default |
| --- | --- | --- |
| `whole-sign` | Whole sign. Houses are the signs counted from the ascendant sign. | yes |

## Western term (bound) table

Setting `westernTerms`. Affects: Western dignity scores (withheld in this phase).

Lilly printed the Ptolemaic terms; the engine computes the Egyptian set, so the difference is named.

| Value | Meaning | Default |
| --- | --- | --- |
| `lilly-ptolemy` | Lilly's terms. As printed in Christian Astrology. | yes |

## Length of a dasha year

Setting `vedicDashaYearDays`. Affects: Vimshottari period boundaries.

The engine's value, recorded so the output says which one it used.

| Value | Meaning | Default |
| --- | --- | --- |
| `365.25` | 365.25 days. The engine's value. | yes |

## Lunar node

Setting `vedicNode`. Affects: Rahu and Ketu in the Vedic rules.

The engine computes the mean node.

| Value | Meaning | Default |
| --- | --- | --- |
| `mean` | Mean node. The engine's node. | yes |

## Birth-time uncertainty limit

Setting `birthTimeLimitMinutes`. Affects: Rules that depend on the ascendant, houses, hour pillar or firdaria sect.

Beyond this many minutes of uncertainty the rules that need the birth time are not evaluated and are listed with that reason.

| Value | Meaning | Default |
| --- | --- | --- |
| `60` | 60 minutes. The default limit. | yes |

## Show rules whose source was not opened

Setting `showUnopened`. Affects: The signal list.

Every rule in this release has an opened source; the switch exists so a later rule that has none is hidden unless asked for.

| Value | Meaning | Default |
| --- | --- | --- |
| `false` | Hide. The default. | yes |
| `true` | Show. With the badge "source not opened". |  |
