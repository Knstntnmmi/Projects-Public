# Overlay

**One moment, every system, one shared axis.**

Overlay takes a single moment (a date, a clock time, a place) and computes BaZi, the I Ching year-calendars, traditional Western astrology, the Vedic lunar mansions and a handful of day-count calendars from one astronomical substrate. Then, instead of printing them in adjacent boxes, it lays them over one another: as concentric rings on a single ecliptic, and as parallel tracks on a single date axis. The point is to be able to see where the systems' boundaries coincide, where they are offset, and where they have nothing to do with one another.

![Wheel](docs/img/wheel-j2000.svg)

![Timeline](docs/img/timeline-j2000.svg)

It is a calculator and a drawing instrument. It interprets nothing, forecasts nothing and casts nothing.

## What is here that was missing

A survey of the open-source and commercial landscape in November 2026 found many good single-system libraries and many applications that list several systems side by side, and found the following either absent or present only in closed products. Each claim is as narrow as the evidence for it.

**A shared axis.** No open tool was found that puts each system's own timing units (luck pillars, annual and monthly pillars, profections, firdaria, dashas, hexagram periods) on one date axis with exact boundaries, or that draws the zodiac, the solar terms, the branch months, the hexagram circles and the nakshatras as rings on one astronomically correct ecliptic. The nearest things are a Python project that scores agreement across traditions as a heatmap, and applications that count how many systems "agree" in a year.

**Conventions that announce themselves.** BaZi calculators disagree because of silent choices: which clock the hour is read from, where the day turns, where the year turns. Here every such choice is a named setting, every result records the settings that produced it, and for any moment the engine reports what each alternative would have changed. One commercial API returns a conventions object; no open engine was found that reports the effect of the alternatives.

**Distance to the boundary.** For each discrete fact (each pillar, the rising sign, the sect, the Moon's sign and nakshatra, the hexagram of the day) Overlay reports the nearest earlier and later clock time at which it would come out differently, and flags those inside the uncertainty you state for the clock time or inside the engine's own two-minute margin. Nothing comparable was found.

**The gua qi calendar.** The Han "six days seven parts" calendar of sixty hexagrams, which no library was found to implement, is implemented here in Meng Xi's scheme as Yi Xing adopted it in the Dayan calendar, in both its mean-time and equal-longitude readings, with Jing Fang's different allotment as a third option; the sequence is checked against the table of the Dayan calendar in the *New Tang History*.

**A graded registry of correspondences.** Each claimed link between systems is marked exact, structural, historical, loose or coincidence, with sources, and the ones that can be computed are computed by the tests. One result of doing so: the sixty-four-gate ecliptic wheel of twentieth-century hexagram astrology is exactly the Fu Xi circle attributed to Shao Yong run backwards and rotated, with the seam that this project puts at the winter solstice falling at 13°15′ of Taurus.

**Seams with a chance baseline.** The timeline marks dates on which tracks running on two or more independent clocks change together, and says how many such dates would be expected if the boundaries fell at random. Tracks that share a clock are counted once: the firdaria and the profections both turn on the birthday, so their coinciding is arithmetic and not a finding.

**Published test vectors.** `fixtures/golden` holds Four Pillars for a set of boundary cases under every combination of clock basis and day boundary, and solar-term instants to the second, so that another calculator can be checked convention by convention.

**A facts document for language models.** `overlay facts` emits everything as one JSON document in which each section states the conventions and basis it rests on. Language models miscompute pillars and positions when asked to do the arithmetic themselves; this is meant to be handed to them instead.

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

The command line reads a moment and writes JSON, SVG or a table:

```
npm run overlay -- moments
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
| `packages/render` | Pure functions from rings and tracks to SVG strings. |
| `packages/cli` | The command line. |
| `packages/web` | The web page: a thin shell that keeps state in memory and calls the two packages above. |
| `fixtures/moments.ts` | The only place a full moment may be written down. |
| `fixtures/golden` | Published test vectors, regenerated by `npm run generate`. |
| `docs` | [Conventions](docs/CONVENTIONS.md), [correspondences](docs/CORRESPONDENCES.md), [sources and accuracy](docs/SOURCES.md). |

A system joins the overlay by expressing itself in two shapes: arcs of ecliptic longitude (a ring) and dated intervals (a track). Nothing else in the views needs to change.

## Accuracy and its limits

Positions come from `astronomy-engine`, which documents itself as good to about one arcminute; for the Sun it does much better than that. Solar-term instants from this engine differ from 寿星天文历 by thirteen seconds on average and about a minute at worst over 1600 to 2100; that compares two models with each other, and only one instant (Lichun 2024, three seconds off the time reported that day) has been checked against a published figure. A boundary closer than two minutes is therefore reported as undecided rather than decided.

Zone offsets and daylight-saving history come from the tz database built into the runtime, which is known to be weak before 1970 and for regions whose zones were later merged (China before 1949 among them). Solar terms are always the true-Sun terms, although the Chinese calendar used mean-time terms before 1645. The Lahiri ayanamsa is the true one, with nutation, anchored on its 1956 definition; whether the defining value is a true or a mean one is not settled by the sources read, and a mean reading would shift every sidereal longitude by about sixteen arcseconds. All of this is set out in [docs/SOURCES.md](docs/SOURCES.md).

## What it does not do

It does not interpret a chart, rank a day as lucky, or say that a seam means anything. It does not cast hexagrams, which is a chance procedure and not a calculation. It does not yet include the Chinese lunisolar calendar (and so not Plum Blossom numerology or Zi Wei Dou Shu), Qi Men Dun Jia, Da Liu Ren, the true unequal twenty-eight mansions on the sky, Ptolemaic bounds, zodiacal releasing or primary directions.

## Next

The lunisolar calendar and the systems that depend on it; a Zi Wei adapter; the true mansions; an MCP server over the facts document; a back-testing harness that takes dated events and scores every track against shuffled dates; a historical mode with mean-time solar terms before 1645.

## Privacy

Everything is computed on your own machine. The web page makes no network request after it loads (its content security policy forbids them), sets no cookie, stores nothing and puts nothing in the address bar. The repository contains no personal data and no real person's birth data; every example is a synthetic moment. See [PRIVACY.md](PRIVACY.md).

## Licence and credit

Copyright © 2026 **Knstntnmmi** ([github.com/Knstntnmmi](https://github.com/Knstntnmmi)).

Overlay is free software under the [GNU Affero General Public License, version 3 or later](LICENSE). You may use, study, change and share it. If you share it, build on it, or run it as a service that others use over a network, you must keep the credit above wherever it appears, publish the complete source of your version, and license it under the same terms. You may not take it closed. The credit lines in the source headers, in the page footer and in the generated drawings and documents are author attributions that the licence requires you to preserve; the details are in [NOTICE](NOTICE).

It stands on `astronomy-engine` by Don Cross and is tested against `tyme4ts` by 6tail, both MIT licensed.
