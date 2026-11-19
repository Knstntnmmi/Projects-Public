# Overlay

**One moment, every system, one shared axis.**

Overlay takes a single moment (a date, a clock time, a place) and computes BaZi, the I Ching year-calendars, traditional Western astrology, the Vedic lunar mansions and a handful of day-count calendars from one astronomical substrate. Then, instead of printing them in adjacent boxes, it lays them over one another: as concentric rings on a single ecliptic, and as parallel tracks on a single date axis. The point is to be able to see where the systems' boundaries coincide, where they are offset, and where they have nothing to do with one another.

![Wheel](docs/img/wheel-j2000.svg)

![Timeline](docs/img/timeline-j2000.svg)

It is a calculator, a drawing instrument and, for a span of years, a reader of what each tradition's published rules say about a topic. The forecast states those rules and their sources and adds no verdict of its own, and it marks every project-made reading as the project's own (the strength classes of a day master, the I Ching grades, the year edge); it casts nothing. It is described under [The forecast](#the-forecast) below.

Unfamiliar words, such as luck pillar, profection, firdaria, dasha and nakshatra, are explained in [docs/GLOSSARY.md](docs/GLOSSARY.md).

Lackner (2011, p. 4) writes that bazi suanming, the art behind BaZi, is commonly called Chinese astrology but is more accurately called chronomancy, divination from the attributes of time, and this project keeps the name BaZi. What the published scholarship says on this and on related points, and what the project takes from it, is in [docs/SCHOLARSHIP.md](docs/SCHOLARSHIP.md). The terms of art that the forecast prints are defined in [docs/GLOSSARY.md](docs/GLOSSARY.md).

## What is here that was missing

A survey of the open-source and commercial landscape in November 2026 found many good single-system libraries and many applications that list several systems side by side, and found the following either absent or present only in closed products. Each claim is as narrow as the evidence for it.

**A shared axis.** No open tool was found that puts each system's own timing units (luck pillars, annual and monthly pillars, profections, firdaria, dashas, hexagram periods) on one date axis with exact boundaries, or that draws the zodiac, the solar terms, the branch months, the hexagram circles and the nakshatras as rings on one astronomically correct ecliptic. The nearest things are a Python project that scores agreement across traditions as a heatmap, and applications that count how many systems "agree" in a year.

**Conventions that announce themselves.** BaZi calculators disagree because of silent choices: which clock the hour is read from, where the day turns, where the year turns. Here every such choice is a named setting, every result records the settings that produced it, and for any moment the engine reports what each alternative would have changed. One commercial API returns a conventions object; no open engine was found that reports the effect of the alternatives.

**Distance to the boundary.** For each discrete fact (each pillar, the rising sign, the sect, the Moon's sign and nakshatra, the hexagram of the day) Overlay reports the nearest earlier and later clock time at which it would come out differently, and flags those inside the uncertainty you state for the clock time or inside the engine's own two-minute margin. Nothing comparable was found.

**The gua qi calendar.** The Han "six days seven parts" calendar of sixty hexagrams, which no library was found to implement, is implemented here in Meng Xi's scheme as Yi Xing adopted it in the Dayan calendar, in both its mean-time and equal-longitude readings, with Jing Fang's different allotment as a third option; the sequence is checked against the table of the Dayan calendar in the *New Tang History*.

**A graded registry of correspondences.** Each claimed link between systems is marked exact, structural, historical, loose or coincidence, with sources, and the ones that can be computed are computed by the tests. One result of doing so: the sixty-four-gate ecliptic wheel of twentieth-century hexagram astrology is exactly the Fu Xi circle attributed to Shao Yong run backwards and rotated, with the seam that this project puts at the winter solstice falling at 13°15′ of Taurus.

**Seams, compared with dates drawn at random.** The timeline marks dates on which tracks running on two or more independent clocks change together, and says how many such dates would be expected if the boundaries fell at random. Tracks that share a clock are counted once: the firdaria and the profections both turn on the birthday, so their coinciding is arithmetic and not a finding.

**Published test vectors.** `fixtures/golden` holds Four Pillars for a set of boundary cases under every combination of clock basis and day boundary, and solar-term instants to the second, so that another calculator can be checked convention by convention.

**A facts document for language models.** `overlay facts` emits everything as one JSON document in which each section states the conventions and basis it rests on. Language models miscompute pillars and positions when asked to do the arithmetic themselves; this is meant to be handed to them instead.

## The forecast

For a birth moment, a place, a span of years and a topic, the forecast states what the published rules of four traditions say, technique by technique and year by year, and money first. Every statement carries the rule it comes from and the source of that rule. The rules are transcribed from the named works and checked against them. Nobody has tested the statements against outcomes yet, and each place that shows a forecast says so once.

Each line is what a named rule of one tradition says about this period, with its source.

![The decade grid for the constructed sample moment j2000, topic wealth, 2026 to 2035.](docs/img/forecast-grid.svg)

How to read it: each row is one technique, each column one year (the labels are the last two digits, 2026 to 2035), and a cell shows the word the rules of that technique give for that year. A blank cell says nothing. A cell split in colours shows how many of that technique's rules say each thing; mixed also appears where a rule itself states a mixed result. "Sex not given" in the luck pillar row means that row is silent until the sex the chart is read as is given, because the direction of the luck pillars depends on it. A plus, a bar and a wave in a cell stand for supports, cautions and mixed, beside the colour. "Saturn from Moon" and "Jupiter from Moon" count the transit of that planet through the signs from the natal Moon. The I Ching has no cells: it is read by period, not by year, and a window of at most 62 days shows its character, which includes the lines that name goods or an audience with a superior. A full sample is in [docs/SAMPLE-FORECAST.md](docs/SAMPLE-FORECAST.md), and [docs/FORECAST.md](docs/FORECAST.md) explains how a statement comes about and what the limits are.

**The command.**

```
npm run overlay -- forecast --moment j2000 --topic wealth --from 2026 --to 2035
npm run overlay -- forecast --moment j2000 --topic career --full
npm run overlay -- forecast --moment j2000 --json
npm run overlay -- forecast --moment j2000 --svg > forecast-grid.svg
npm run overlay -- window --moment j2000 --date 2031-03-01 --days 45
```

`forecast` prints the natal statements, the decade grid as text, a headline for each year and the agreement display. `--full` adds every statement with its rule and source, and the rules the engine does not evaluate. `--glossary` adds, after the text, the words used in it, each with its meaning and source, as in [the glossary](docs/GLOSSARY.md). `--sex male|female` names the sex convention that the BaZi luck pillars and a few other rules need; it is never guessed, and without it those rules are listed as not evaluated. `window` shows the character of a period of at most 62 days: the I Ching, and Lilly's day statements for the Western part.

**The page.** `npm run dev` serves a Forecast section under the moment form, with the topic, the first year, the number of years and the sex convention as controls. It shows the natal statements, the same grid with a glyph and a text name in every cell, a panel for each year where every statement opens to its rule and source, the agreement display, the character of a period and the rules not evaluated. Everything is computed in the tab; see [PRIVACY.md](PRIVACY.md).

**Topics.** Wealth, career, relationships, health, learning, home and travel, and life in general. Health sentences state tendencies and say nothing about diagnosis.

**The four traditions.** The rule files are in `packages/core/src/forecast/data/`. The number of rules is read from them, and "rules with code" are those for which the engine has code that decides when the rule's condition holds. Some rules need the sex convention, which is why two numbers are given. A further 29 rules, tables and single clauses were held back because the check against the source could not confirm them; they are not evaluated. The works, with how far each was read, are in [docs/SOURCES.md](docs/SOURCES.md).

| Tradition | Rules in the file | Rules with code | With code, sex convention named | Works the rules come from |
| --- | --- | --- | --- | --- |
| BaZi | 39 | 30 | 37 | *Yuanhai ziping* (淵海子平), *Sanming tonghui* (三命通會), *Ditian sui* (滴天髓) in the Chuanwei and Jiyao editions |
| Vedic | 36 | 36 | 36 | *Brihat Parashara Hora Shastra*, *Phaladeepika* and B. V. Raman's *Hindu Predictive Astrology*, all in English translation |
| Western | 56 | 48 | 53 | William Lilly, *Christian Astrology* (1647), with Valens, *Anthologies* (Riley's translation) and Bonatti, *De astronomia* (1550) |
| I Ching | 11 | 10 | 10 | The *Zhouyi* text, the *Xici zhuan*, the *Yi wei Jilan tu* and the *Xin Tang shu*, juan 27A; experimental, read by period only |

The I Ching rules describe the character of a period. They are not part of the yearly grid, the headline or the agreement display, and the whole tradition is marked experimental: the grading of the hexagram texts and the line-by-day reading are modern constructions on the old texts.

**The limits, briefly.** The statements are what the rules say; they are not validated against outcomes. Lilly's house rules run on whole-sign houses. A birth time that is off moves every tradition at once, because all of them read one birth moment. The list of what is not evaluated, and why, is printed by `forecast --full`.

## Systems

| System | What is computed | How it is checked |
| --- | --- | --- |
| Substrate | Instant from a wall clock and zone; civil, standard, local mean and true solar clocks; equation of time; apparent geocentric longitudes; Ascendant and Midheaven; the twenty-four solar terms | Equation of time and positions against published values; solar terms against 寿星天文历 for every term from 1900 to 2100 |
| BaZi | Four pillars, hidden stems, ten gods, nayin, luck pillars with start age, annual, monthly and daily pillars over any span | Eight thousand generated charts and every hour boundary of three hundred days against `tyme4ts`, under both day-boundary conventions |
| I Ching | The sixty-four hexagrams; twelve sovereign hexagrams; gua qi; the four cardinal hexagrams line by line; the Fu Xi circle attributed to Shao Yong; the sixty-four-gate wheel | King Wen pairing rule; the Dayan calendar table; published gate positions |
| Western | Seven planets and mean node in signs and whole-sign houses, sect, Lot of Fortune, domicile, exaltation, Dorothean triplicity, Egyptian bounds, Chaldean faces, annual profections, firdaria, planetary day and hour, Jupiter and Saturn by sign | Ephemeris positions at J2000; the bounds sum to the planets' greater years; a dated Jupiter ingress |
| Vedic | Lahiri ayanamsa, sidereal signs, nakshatra and pada, vimshottari mahadasha and antardasha | Ayanamsa values printed in the Indian Astronomical Ephemeris, as quoted in the Swiss Ephemeris documentation (the Ephemeris itself not seen); the periods total 120 years |
| Calendars | Julian day, weekday, Maya Long Count with Tzolkin and Haab, twelve day officers, twenty-eight lodge days, nine-star year | 13.0.0.0.0 on 21 December 2012; four hundred days against `tyme4ts` |

## Use

Node 22.18 or later.

```
cd overlay
npm ci
npm run check        # typecheck, tests, build
npm run dev          # the web page, served locally
```

The command line reads a moment and writes JSON, SVG or a table (the forecast commands are described under [The forecast](#the-forecast)):

```
npm run overlay -- moments
npm run overlay -- forecast --moment j2000 --topic wealth --from 2026 --to 2035
npm run overlay -- facts --moment j2000
npm run overlay -- sensitivity --moment lichun-eve-2024 --uncertainty 5
npm run overlay -- wheel --moment j2000 --orientation chinese --legend > wheel.svg
npm run overlay -- timeline --moment j2000 --sex female --years 90 > timeline.svg
npm run overlay -- seams --moment j2000 --years 80
npm run overlay -- facts --at "2024-02-04 16:25" --zone +08:00 --lat 39.9 --lon 116.4 --set timeBasis=apparent
```

`--moment` names one of the built-in sample moments, all of which are synthetic. `--at` takes any moment of your own, which stays in the process that reads it.

## Layout

| Path | Contents |
| --- | --- |
| `packages/core` | The engine. `substrate` (time and sky), `systems` (one folder per tradition), `overlay` (rings, tracks, seams, sensitivity), `conventions.ts`, `correspondences.ts`, `facts.ts`. No DOM, no input or output. |
| `packages/core/src/forecast` | The forecast layer: the rule files in `data/`, the bindings in `predicates/`, evaluation, the decade grid, the year view, agreement and the phrasebook of every word the shells print. [BINDINGS.md](packages/core/src/forecast/BINDINGS.md) is the guide for writing a binding. |
| `packages/render` | Pure functions from rings and tracks to SVG strings, including the forecast grid. |
| `packages/cli` | The command line. |
| `packages/web` | The web page: a thin shell that keeps state in memory and calls the two packages above. |
| `fixtures/moments.ts` | The only place a full moment may be written down. |
| `fixtures/golden` | Published test vectors, regenerated by `npm run generate`. |
| `docs` | [Conventions](docs/CONVENTIONS.md), [correspondences](docs/CORRESPONDENCES.md), [sources and accuracy](docs/SOURCES.md), [what the scholarship says](docs/SCHOLARSHIP.md), [the glossary](docs/GLOSSARY.md), [the forecast](docs/FORECAST.md). |

A system joins the overlay by expressing itself in two shapes: arcs of ecliptic longitude (a ring) and dated intervals (a track). Nothing else in the views needs to change.

## Accuracy and its limits

Positions come from `astronomy-engine`, which documents itself as good to about one arcminute; for the Sun it does much better than that. Solar-term instants from this engine differ from 寿星天文历 by thirteen seconds on average and about a minute at worst over 1600 to 2100; that compares two models with each other, and only one instant (Lichun 2024, three seconds off the time reported that day) has been checked against a published figure. A boundary closer than two minutes is therefore reported as undecided rather than decided.

Zone offsets and daylight-saving history come from the tz database built into the runtime, which is known to be weak before 1970 and for regions whose zones were later merged (China before 1949 among them). Solar terms are always the true-Sun terms, although the Chinese calendar used mean-time terms before 1645. The Lahiri ayanamsa is the true one, with nutation, anchored on its 1956 definition; whether the defining value is a true or a mean one is not settled by the sources read, and a mean reading would shift every sidereal longitude by about sixteen arcseconds. All of this is set out in [docs/SOURCES.md](docs/SOURCES.md).

## What it does not do

It adds no verdict of its own: the forecast states what a named rule of a tradition says, and marks each reading made by the project as the project's own (strength classes, I Ching grades, the year edge). It gives no score, no composite and no verdict for a year. It does not rank a day as lucky, or say that a seam means anything. It does not cast hexagrams, which is done by drawing lots and not by calculation. It does not yet include the Chinese lunisolar calendar (and so not Plum Blossom numerology or Zi Wei Dou Shu), Qi Men Dun Jia, Da Liu Ren, the true unequal twenty-eight mansions on the sky, Ptolemy's own bounds (the forecast rules use the table Lilly printed), zodiacal releasing or primary directions.

## Next

The lunisolar calendar and the systems that depend on it; a Zi Wei adapter; the true mansions; an MCP server over the facts document; a back-testing harness that takes dated events and scores every track against shuffled dates; a historical mode with mean-time solar terms before 1645.

## Privacy

Everything is computed on your own machine. The web page makes no network request after it loads (its content security policy forbids them), sets no cookie, stores nothing and puts nothing in the address bar. The repository contains no personal data and no real person's birth data; every example is a synthetic moment. See [PRIVACY.md](PRIVACY.md).

## Licence and credit

Copyright © 2026 **Knstntnmmi** ([github.com/Knstntnmmi](https://github.com/Knstntnmmi)).

Overlay is free software under the [GNU Affero General Public License, version 3 or later](LICENSE). You may use, study, change and share it. If you share it, build on it, or run it as a service that others use over a network, you must keep the credit above wherever it appears, publish the complete source of your version, and license it under the same terms. You may not take it closed. The credit lines in the source headers, in the page footer and in the generated drawings and documents are author attributions that the licence requires you to preserve; the details are in [NOTICE](NOTICE).

It stands on `astronomy-engine` by Don Cross and is tested against `tyme4ts` by 6tail, both MIT licensed.
