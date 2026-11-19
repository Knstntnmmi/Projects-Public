# The forecast

This page explains how the forecast is made and where it stops. The sample for every figure and document is the constructed moment `j2000` of `fixtures/moments.ts`, topic wealth, years 2026 to 2035. The generated sample is [SAMPLE-FORECAST.md](SAMPLE-FORECAST.md). The terms of art that the forecast prints are defined in [GLOSSARY.md](GLOSSARY.md), and what the published scholarship says on the points it touches is in [SCHOLARSHIP.md](SCHOLARSHIP.md).

Each line is what a named rule of one tradition says about this period, with its source. Nobody has tested these statements against outcomes yet.

## How a statement comes about

A statement is a sentence from a rule, filled with facts from one chart. Five things stand behind it.

1. **The rule file.** Each tradition has a file in `packages/core/src/forecast/data/`. One rule in it has an id, the condition in words, the inputs the condition needs, the topics it speaks to, a direction, a sentence template and a source with a locator (a chapter, a verse or a page). The condition is copied from the source as closely as a rule can be, and where the source gives no number, the file says that a number is a convention of the project.
2. **The condition.** The engine checks the condition against the chart for each moment of the span. A condition may hold once, as for a rule about the chart itself, or for stretches of time, as for a period lord.
3. **The check in code.** A small piece of code decides when the condition holds. It follows the condition as written and chooses nothing the rule does not choose. Where a condition cannot be decided from what the engine computes, the rule is not checked and is listed as not evaluated, with the reason.
4. **The sentence.** The template is filled with the facts that made the condition hold, such as the planet, the house or the pillar, and with nothing else. A slot without a fact is an error, so a sentence cannot say more than the chart gave.
5. **The source.** The statement carries the rule's id, its name and the source with its locator. Where a rule file quotes its source, the quotation is at most 25 words. For the Vedic rules an English translation was read, so no quotation is shown.

The direction of a rule is the rule's own. The code sets a direction only where the rule's text gives it case by case, for example by house, and its test shows each case. Nothing in the code decides that a case looks good or bad.

## The four words

A technique is shown for each year with one of four words.

- **Supports.** The rules of that technique that name a direction for this topic and this year all say favourable.
- **Cautions.** They all say unfavourable.
- **Mixed.** Two things give this word. Some rules support and others caution, which is shown as "rules conflict" when two rules about the same kind of thing point opposite ways, or a rule itself states a mixed result. A rule that itself states a mixed result makes its technique read mixed for that year, even beside a rule that supports, and the tally then says "1 rule supports, 1 is stated as mixed". A cell can therefore read mixed because one rule says so, even where no other rule disagrees. The plain counts are printed beside the word, for example "3 rules support, 1 cautions".
- **Nothing said.** No rule of that technique names a direction for this topic in this year. This is silence, and it is not a good year or a bad one. Where a rule marks the topic as active without a direction, that is shown as a pointer, counted apart, and never changes the word. A technique can also be silent for a stated reason, for example because it needs the sex the chart is read as, or because the first luck pillar has not yet begun.

The words come from the rules and from nothing else. There is no weight in them.

## Tendencies and named uncertainty

The forecast states each result as what a named rule says about a period. It does not state that an event follows. Health statements carry the badge "a tendency only" and say nothing about diagnosis, and each list of statements opens with the words "Not tested yet."

The choice to speak in tendencies is the project's own. It is consistent with how some scholars characterise the arts. Lackner writes, in a report on a conference at the Leopoldina, that predictions indicate tendencies and so give the questioner room to negotiate with the future, and he reports that the closing discussion held that only a communication that addresses the uncertainties of any prediction can start a rational reception of it (the newsletter "fate" no. 15, 06|19, pp. 3-4). Kalinowski writes that for Wang Chong destiny is a general tendency, named by the categories of the auspicious and the inauspicious, whose realisation depends on circumstances and encounters (IKGF Occasional Paper, 2009, pp. 6, 8-9 and 22). These are the scholars' characterisations. The project infers its wording from them, and no tradition's rule asks for it. See [SCHOLARSHIP.md](SCHOLARSHIP.md).

## The techniques, one row each

The grid shows techniques that a practitioner would name. A row appears for every technique that has a rule available for the topic, whether or not it speaks in the span, so a chart may show fewer rows than this list.

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

The sources do not say how to add one tradition's reading to another's, or one technique's to another's. They give rules, each for its own period. Any total would need weights, and the weights in the rule files are the project's own reading of emphasis, not the sources'. So the forecast gives no score, no total and no figure for a year. It gives the words by technique and a headline that lists the techniques by word, such as "Supports: Vedic antardasha. Cautions: Saturn from the Moon. Mixed: BaZi year pillar (3 rules support, 1 cautions). Silent: Western solar return." If two techniques disagree, the page shows both.

A statement that extends beyond a year counts for that year only if it overlaps it by enough days; see the conventions below. The statement list always shows the true dates. The BaZi year pillar changes at Lichun, 3 to 5 February, so about a month of each calendar year still belongs to the previous pillar. That month passes the 15-day edge and counts like the rest, so a year's word can rest on the previous year's pillar alone.

## Testing the statements, and whose test it would be

Nobody has tested the statements against outcomes yet. The project keeps the data model of a scorecard, in which a person records events and forecasts are frozen before the events are entered, but nothing yet compares an event with a reading. The scorecard is an addition made by this project. It is not taken from any of the four traditions.

The scholarship read for the project describes how forecasts were, and were not, checked. These are the scholars' descriptions and are not rules of this project. Lackner writes in an editorial that a forecaster whose forecast fails usually faces no consequence, and that forecasters may admit formal errors but rarely question the core of their statement (the newsletter "fate" no. 18, 07|21, p. 3); he writes about forecasting in general and does not say that any tradition lacked a way of checking. Esposito describes a divinatory logic in which a failed oracle is blamed on the interpretation and not on the omen (IKGF Occasional Paper, 2011, p. 5). Burton-Rose describes mid- and late-Qing morality books that offered anecdotes as proof that an advocated practice had worked, 195 anecdotes in an 1880 edition and 163 in an 1899 edition; the compiler of the first called them cases of proof, and Burton-Rose says they served an evidential function; the text does not say whether stories of failure appear (MPIWG Preprint 496, 2019, p. 50). None of this is a test of the kind a scorecard makes. See [SCHOLARSHIP.md](SCHOLARSHIP.md).

## What agreement means here, and why it is rare

Agreement is shown only for techniques that count time in independent ways. Most techniques are counted from the birth moment: the luck pillars, the dashas, the profections and the year pillar are all arithmetic from one instant, so they count as one group. They cannot disagree about anything except how that arithmetic is cut, so when they say the same thing it is not a second witness. A planet whose real motion is read, such as Saturn or Jupiter, is a group of its own.

The display therefore says which independent groups exist for this chart, and it speaks only when at least three of them have something to say in the span. Where they do, it says for each year whether the groups agree on supports, agree on cautions, or whether one group supports and another cautions, and it prints how many agreeing years were found beside how many a random arrangement of the same groups would give. With ten years this shows nothing by itself, and it says so. The I Ching is read by period and takes no part.

Agreement says that techniques counted on different time scales gave the same sign for the same period. It does not say that the outcome follows. All four traditions read one birth moment, so a wrong birth time moves them together.

## Setting the traditions side by side

Lackner proposes that comparison should begin with practices and only then turn to the worldviews behind them, since the study of practices is to shed more light on those worldviews and not the reverse (the editorial of the newsletter issue 05|14, p. 2). The project's use of this for grading correspondences between systems is its own inference and is not Lackner's. In the note on a planned exhibition (fate no. 17, 08|20, p. 4) he calls the parallels between Chinese and European prognostication overwhelming in systematic elaboration and interpretation, and writes that not all the methods can be matched: feng shui is unknown in Europe, and there are few traces of Ptolemaic astrology in China. The forecast sets the traditions side by side by the time scale each counts on and does not claim that they are one system. See [SCHOLARSHIP.md](SCHOLARSHIP.md).

## The conventions that change a forecast

Traditions differ on some points, and the rules leave some open. Each such choice is a named setting, and the forecast records the settings it ran with. The ones that matter most are the sex convention for the BaZi chart, which decides the direction of the luck pillars and which rules apply; the edge of a year, which decides how many days a statement must overlap a year to count for it (0, 15 or 30; the default is 15; the setting is called `sliceEdgeDays`); the sign of a year that clashes with the luck pillar; and the engine settings for which time scale (civil or solar) the birth hour is read from, the day boundary, the year boundary and the sidereal zero point. The full list, with every value and what it changes, is in the generated [CONVENTIONS.md](CONVENTIONS.md). Change a setting with `--set key=value`, or on the page, and the grid changes with it.

## What is not evaluated, and why

A rule is not evaluated when saying more than the source says would be needed to decide it. In general terms:

- the source does not say how a word is measured, such as "aided" or "more fortified";
- the rule needs a convention nobody has named, such as the sex of the BaZi chart or a birth time known well enough;
- the rule says one thing and the code could decide only a part of it, so only that part is evaluated and the rest is listed as a branch left out;
- the rule is a table or a method used by other rules, and has no statement of its own;
- the check against the source could not confirm the rule, so it is held back.

`overlay forecast --full` prints the list of the rules and branches not evaluated, each with its reason. The sample document carries the same list.

`overlay forecast --glossary` prints, after the forecast, the terms of art that occur in it with their meaning and source. The page does the same in a closed part called "Words used" under the forecast, for the forecast it shows at that moment. Both read the one list in [GLOSSARY.md](GLOSSARY.md).

## The limits

- The rules are transcribed from the named sources and checked against them. They are not validated against outcomes. A statement says what a rule says, and says nothing about whether it holds.
- The I Ching part is experimental. The calendar parts come from attested sources, but the grading of the texts and the line for each day are modern constructions, and the part is shown only by period.
- The I Ching grader reads a negator (无 匪 不 弗 勿 未) before a verdict word as a whole formula, by a table that is the project's own reading of the grammar of the text. The table is labelled derived and follows no commentary. A negated word of misfortune (无咎, 无悔, 悔亡 and the like) says that something bad is absent: it carries no direction, and it is shown as a note with the formula in characters and a literal gloss, for example 无咎 (no blame). A negated word of advantage (不利 with what follows, 无攸利) reads as unfavourable for the thing named, and 无不利 reads as favourable. Every other negator before a verdict word carries no direction and is shown as a note. No statement is dropped for holding such a formula.
- Lilly's house rules were written for Regiomontanus houses. The engine does not compute them, so the rules that name a house run on whole-sign houses and say so on every statement.
- A birth time that is off moves everything at once. Every technique reads the same moment. The engine takes the birth time as exact unless you state an uncertainty with `--uncertainty`. It withholds the rules that need the birth time when that uncertainty is more than the limit (60 minutes by default). With `--uncertainty` the forecast also moves the birth moment earlier and later by that many minutes and lists the cells of the grid that would change; without it, it says that this was not checked. `sensitivity` shows how close each fact is to changing.
- A year is a calendar year in UTC. Techniques counted from the birthday or from a dasha turn on other dates, so many statements straddle a year boundary and are cut as described above.
- Health statements are tendencies, and the forecast says nothing about diagnosis.

## How to reproduce the sample

```
cd overlay
npm run overlay -- forecast --moment j2000 --topic wealth --from 2026 --to 2035
```

`npm run generate` rebuilds the sample document and the figure from the code.
