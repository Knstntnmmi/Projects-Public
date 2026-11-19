# Sources and accuracy

## Astronomy

Positions of the Sun, Moon and planets, sidereal time and rise and set times come from [astronomy-engine](https://github.com/cosinekitty/astronomy) 2.1.19 by Don Cross (MIT), which is built on truncated VSOP87 series and the NOVAS reductions and documents itself as accurate to about one arcminute. Longitudes are apparent, geocentric and referred to the true equinox of date. The obliquity is the IAU 2006 mean obliquity; the lunar node is the mean node from Meeus, *Astronomical Algorithms*, chapter 47.

Swiss Ephemeris is deliberately not used, although it is more accurate, so that the project depends only on permissively licensed code.

### Measured agreement

| Quantity | Compared with | Result |
| --- | --- | --- |
| Solar-term instants, every term 1900 to 2100 | 寿星天文历 as implemented in `tyme4ts` | mean difference 13 s, worst 62 s |
| The same, 1600 to 1899 | the same | mean 13 s, worst 56 s |
| The same, 2101 to 2400 | the same | mean 22 s, worst 91 s |
| Lichun 2024 | 16:26:53 Beijing time as reported in the press that day; the National Astronomical Observatory of Japan's almanac gives 17:27 Japan time, to the minute | 3 s early |
| Four pillars, eight thousand generated moments 1900 to 2100 | `tyme4ts`, both day-boundary conventions | identical outside 90 s of a solar term |
| Equation of time at its four yearly extremes | published values | within a tenth of a minute |
| Planet positions at J2000 | standard ephemeris | same degree for all seven |

The first three rows compare two models with each other, so they bound the disagreement and not the error of either, and the fourth is a single spot check, not a validation. On that evidence the engine treats any solar-longitude boundary nearer than two minutes as undecided, and says so in the sensitivity report.

### Known limits

Delta T (the difference between uniform time and the Earth's rotation) is modelled and grows uncertain away from the present: tens of seconds a few centuries back, minutes to hours in antiquity. Nothing here should be trusted to the minute before about 1600.

Zone offsets and daylight saving come from the IANA tz database as shipped in the JavaScript runtime. Its pre-1970 data is acknowledged by its maintainers to be unreliable in places, and in 2014 it merged China's five historical zones into two, so a pre-1949 birth in western China is given Shanghai's history unless you supply a fixed offset. The hour at which China's 1986 to 1991 daylight saving switched is itself disputed. When in doubt, give a fixed offset such as `+08:00` and choose the clock basis explicitly.

The "standard time" clock removes daylight saving by taking the smallest of the zone's offsets in January, in July and at the instant. A zone that changed its standard offset in the middle of that year defeats this.

The Lahiri ayanamsa is 23°51′11″ at J2000 carried by the IAU general precession, without nutation, which keeps it within about twenty arcseconds of the published true value.

## Chinese calendar and BaZi

The sexagenary day count, the Lichun year and the jie months are computed here from the Julian day number and the Sun's longitude and cross-checked against [tyme4ts](https://github.com/6tail/tyme4ts) by 6tail (MIT), which is a development dependency only. The luck-pillar start age uses the rule of three days to the year carried to the second, the default of that library. Hidden stems, ten gods and nayin follow the common modern tables; the nayin are checked against the same library.

The twelve day officers, the twenty-eight mansion days and the nine-star year are checked against the same library over four hundred days.

Historical note: the solar terms have been defined by the true Sun since the Shixian calendar of 1645. Before that they were equal divisions of the year in time. This version always uses the true-Sun rule. See Helmer Aslaksen, "The Mathematics of the Chinese Calendar" (2010), and Y. T. Liu's notes on the solar terms at ytliu0.github.io/ChineseCalendar.

## I Ching

The hexagram table is structure only: King Wen number, Chinese name, pinyin and the six lines. The English glosses are this project's own short literal renderings. No translation of the text is included; James Legge's is in the public domain, Wilhelm and Baynes's is not.

The gua qi sequence and the assignment of the four cardinal hexagrams' lines to the solar terms were verified against the table of the Dayan calendar in *Xin Tang shu* (New Tang History), juan 28A, in the transcription at zh.wikisource.org (新唐書/卷028上). The two agree at all sixty positions but one, where the transcription has 史 for 夬; 夬 is the sovereign hexagram of the third month and nothing else can stand there. The same table shows that each month's duke hexagram begins at the zhongqi and that the marquis hexagram straddles the following jie, which is the arrangement implemented.

The Fu Xi circular arrangement is Shao Yong's, generated here from its binary rule. The sixty-four-gate wheel is the arrangement used by twentieth-century systems that set the hexagrams on the tropical zodiac; its order and starting point are facts about those systems, reproduced without their interpretive material. For background on all of these see Bent Nielsen, *A Companion to Yi jing Numerology and Cosmology* (2003).

## Western

Domiciles, exaltations and Chaldean faces are the standard tables. Triplicity lords are those of Dorotheus of Sidon. Bounds are the Egyptian bounds as given by Ptolemy (*Tetrabiblos* I.20) and used by Dorotheus and Vettius Valens; the test suite checks that they sum to the planets' greater years (Saturn 57, Jupiter 79, Mars 66, Venus 82, Mercury 76). Annual profections follow Valens, *Anthology* IV, turning at the solar return. Firdaria follow the medieval scheme of nine periods totalling seventy-five years with sub-periods in Chaldean order; the two orderings of the nodes for night charts are both offered. The Ptolemaic bounds and triplicities that William Lilly printed in *Christian Astrology* (1647) are not yet included.

## Vedic

Nakshatra lords and vimshottari period lengths are the standard ones (Parashara). Years are taken as 365.25 days.

## Maya

The Long Count, Tzolkin and Haab are computed from the Julian day number with the Goodman-Martinez-Thompson correlation constant 584283 by default; 584285 is offered. See Reingold and Dershowitz, *Calendrical Calculations*.

## Prior art

Projects and products that informed this one, or that come nearest to parts of it: `tyme4ts` and `lunar` (6tail); `sxtwl` (寿星天文历 in C++); `stem-branch` (a well-validated sexagenary engine); `iztro` (Zi Wei Dou Shu); the `kin*` packages of kentang2017 (Qi Men, Liu Ren, Tai Yi, the Huangji jingshi); `bazaar-of-fates` (thirteen traditions scored into a heatmap); `astronomy-engine` and Skyfield (permissively licensed ephemerides); and RoxyAPI, a commercial service whose responses carry a conventions object.
