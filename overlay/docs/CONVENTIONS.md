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

Setting `guaQi`. Affects: Gua qi ring and track.

The Han scheme gave each of sixty hexagrams six and seven-eightieths days of a mean year counted from the winter solstice. Laid on the true Sun instead, each hexagram spans six degrees of longitude. The two differ by up to about two days.

| Value | Meaning | Default |
| --- | --- | --- |
| `equal-longitude` | Six degrees of solar longitude each. Consistent with the modern true-Sun solar terms. | yes |
| `mean-time` | One sixtieth of the solstice-to-solstice year each. Closer to the original mean-time scheme. |  |

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
| `lahiri` | Lahiri (Chitrapaksha). The Indian national-calendar standard, here from a polynomial accurate to a few arcseconds near the present. | yes |

## Maya calendar correlation

Setting `mayaCorrelation`. Affects: Long Count, Tzolkin, Haab.

The correlation constant ties the Long Count to the Julian day count.

| Value | Meaning | Default |
| --- | --- | --- |
| `584283` | GMT 584283. The Goodman-Martinez-Thompson correlation, matching the living highland day count. | yes |
| `584285` | 584285. The "astronomical" variant two days later. |  |

## Choices that are not yet settings

These are fixed in this version, and are listed so that nobody mistakes them for facts. The year pillar turns at Lichun only; the lunar-new-year and winter-solstice year boundaries are not offered. Solar terms are always the true-Sun terms, although the Chinese calendar used mean-time terms before 1645, so pillars for earlier dates follow the modern rule and not the rule in force at the time. Houses are whole-sign, the lunar node is the mean node, triplicity lords are the Dorothean set and bounds the Egyptian set; the Ptolemaic tables that William Lilly printed are not included yet. Hidden stems follow the common modern table. Vimshottari years are 365.25 days.
