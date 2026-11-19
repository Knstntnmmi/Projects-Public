# The forecast

This page explains how the forecast is made and where it stops. The sample for every figure and document is the constructed moment `j2000` of `fixtures/moments.ts`, topic wealth, years 2026 to 2035. The generated sample is [SAMPLE-FORECAST.md](SAMPLE-FORECAST.md).

Each line is what a named rule of one tradition says about this period, with its source. Nobody has tested these statements against outcomes yet.

## How a statement comes about

A statement is a sentence from a rule, filled with facts from one chart. Five things stand behind it.

1. **The rule file.** Each tradition has a file in `packages/core/src/forecast/data/`. One rule in it has an id, the condition in words, the inputs the condition needs, the topics it speaks to, a direction, a sentence template and a source with a locator (a chapter, a verse or a page). The condition is copied from the source as closely as a rule can be, and where the source gives no number, the file says that a number is a convention of the project.
2. **The condition.** The engine checks the condition against the chart for each moment of the span. A condition may hold once, as for a rule about the chart itself, or for stretches of time, as for a period lord.
3. **The binding.** A binding is the code that decides when the condition holds. It follows the condition as written and chooses nothing the rule does not choose. Where a condition cannot be decided from what the engine computes, the rule is left unbound and is listed as not evaluated, with the reason.
4. **The sentence.** The template is filled with the facts that made the condition hold, such as the planet, the house or the pillar, and with nothing else. A slot without a fact is an error, so a sentence cannot say more than the chart gave.
5. **The source.** The statement carries the rule's id, its name and the source with its locator. Where a rule file quotes its source, the quotation is at most 25 words. For the Vedic rules an English translation was read, so no quotation is shown.

The direction of a rule is the rule's own. A binding sets it only where the rule's text gives it case by case, for example by house, and the test of that binding shows each case. Nothing in the code decides that a case looks good or bad.

## The four words

A technique is shown for each year with one of four words.

- **Supports.** The rules of that technique that name a direction for this topic and this year all say favourable.
- **Cautions.** They all say unfavourable.
- **Mixed.** Two things give this word. Some rules support and others caution, which is shown as "rules conflict" when they stand at the same stage, or a rule itself states a mixed result. The plain counts are printed beside the word, for example "3 rules support, 1 cautions".
- **Nothing said.** No rule of that technique names a direction for this topic in this year. This is silence, and it is not a good year or a bad one. Where a rule marks the topic as active without a direction, that is shown as a pointer, counted apart, and never changes the word. A technique can also be silent for a stated reason, for example because it needs the luck-direction convention.

The words come from the rules and from nothing else. There is no weight in them.

## The levels

A reader is shown techniques that a practitioner would name, which the engine calls levels. A row appears in the grid for every level that has a bound rule for the topic, whether or not it speaks in the span.

- **Natal chart.** What the chart says without dates. These statements are listed first and take no part in a year's word.
- **BaZi luck pillar.** The ten-year pillars counted from the birth month. The direction of the count needs the sex convention, so without it the row is silent and says so.
- **BaZi year pillar.** The pair of characters of the year, which turns at Lichun, read against the chart.
- **Vedic mahadasha and antardasha.** The vimshottari major period and its sub-period, each ruled by one planet.
- **Saturn from the Moon and Jupiter from the Moon.** The signs those planets pass through, counted from the sign of the natal Moon, as the Vedic sources do.
- **Western annual profection.** The point of the chart that advances one sign a year from the birth, so that each year has its sign and lord.
- **Western firdaria and solar return.** The planetary periods of the medieval scheme, and the chart cast for the yearly return of the Sun. A row is shown only where a rule for the topic is bound.
- **Western transits.** Planets passing over points of the birth chart. The day-by-day passes are shown through `window`.
- **I Ching, read by period.** The hexagram of the period. It is shown through `window` and is experimental.

## Why a year has no single verdict

The sources do not say how to add one tradition's reading to another's, or one technique's to another's. They give rules, each for its own period. Any total would need weights, and the weights in the rule files are the first reading's reading of emphasis, not the sources'. So the forecast gives no score, no total and no figure for a year. It gives the words by technique and a headline that lists the techniques by word, such as "Supports: Vedic antardasha. Cautions: Saturn from the Moon. Mixed: BaZi year pillar (3 rules support, 1 cautions). Silent: Western solar return." If two techniques disagree, the page shows both.

A statement that extends beyond a year counts for that year only if it overlaps it by enough days; see the conventions below. The statement list always shows the true dates.

## What agreement means here, and why it is rare

Agreement is shown only for the techniques that run on different clocks. Most techniques are counted from the birth moment: the luck pillars, the dashas, the profections and the year pillar are all arithmetic from one instant, so they are one clock and one group. They cannot disagree about anything except how that arithmetic is cut, so when they say the same thing it is not a second witness. A planet whose real motion is read, such as Saturn or Jupiter, is a group of its own.

The display therefore says which independent groups exist for this chart, and it speaks only when at least three of them have something to say in the span. Where they do, it says for each year whether the groups agree on supports, agree on cautions, or whether one group supports and another cautions, and it prints how many agreeing years were found beside how many a random arrangement of the same groups would give. With ten years this shows nothing by itself, and it says so. The I Ching is read by period and takes no part.

Agreement says that rule sets keyed to different clocks gave the same sign for the same period. It does not say that the outcome follows. All four traditions read one birth moment, so a wrong birth time moves them together.

## The conventions that change a forecast

Traditions differ on some points, and the rules leave some open. Each such choice is a named setting, and the forecast records the settings it ran with. The ones that matter most are the sex convention for the BaZi chart, which decides the direction of the luck pillars and which rules apply; the edge of a year (`sliceEdgeDays`, 0, 15 or 30 days, default 15), which decides how much a statement must overlap a year to count for it; the sign of a year that clashes with the luck pillar; and the engine settings for the clock the birth hour is read from, the day boundary, the year boundary and the sidereal zero point. The full list, with every value and what it changes, is in the generated [CONVENTIONS.md](CONVENTIONS.md). Change a setting with `--set key=value`, or on the page, and the grid changes with it.

## What is not evaluated, and why

A rule is not evaluated when saying more than the source says would be needed to decide it. In general terms:

- the source does not say how a word is measured, such as "aided" or "more fortified";
- the rule needs a convention nobody has named, such as the sex of the BaZi chart or a birth time known well enough;
- the rule says one thing and the code could decide only a part of it, so only that part is evaluated and the rest is listed as a branch left out;
- the rule is a table or a method used by other rules, and has no statement of its own;
- the check against the source could not confirm the rule, so it is held back.

`overlay forecast --full` prints the list of the rules and branches not evaluated, each with its reason. The sample document carries the same list.

## The limits

- The rules are transcribed from the named sources and checked against them. They are not validated against outcomes. A statement says what a rule says, and says nothing about whether it holds.
- The I Ching part is experimental. The calendar parts come from attested sources, but the grading of the texts and the line for each day are modern constructions, and the part is shown only by period.
- Lilly's house rules were written for Regiomontanus houses. The engine does not compute them, so the rules that name a house run on whole-sign houses and say so on every statement.
- A birth time that is off moves everything at once. Every technique reads the same moment. The engine takes the birth time as exact unless you state an uncertainty with `--uncertainty`. It withholds the rules that need the birth time when that uncertainty is more than the limit (60 minutes by default), and `sensitivity` shows how close each fact is to changing.
- A year is a calendar year in UTC. Techniques counted from the birthday or from a dasha turn on other dates, so many statements straddle a year boundary and are cut as described above.
- Health statements are tendencies, and the forecast says nothing about diagnosis.

## How to reproduce the sample

```
cd overlay
npm run overlay -- forecast --moment j2000 --topic wealth --from 2026 --to 2035
```

`npm run generate` rebuilds the sample document and the figure from the code.
