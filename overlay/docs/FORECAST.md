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

- **Supports.** At least one rule of that technique names this topic favourably in this year, and none names it unfavourably or as mixed.
- **Cautions.** At least one rule names it unfavourably, and none names it favourably or as mixed.
- **Mixed, when rules conflict.** Some rules support and others caution. This is shown as "rules conflict" when two rules about the same kind of thing point opposite ways. The plain counts are printed beside the word, for example "3 rules support, 1 cautions".
- **Mixed, when a rule says so.** A rule itself states a mixed result. That makes its technique read mixed for the year, even beside a rule that supports, and the tally then says "1 rule supports, 1 is stated as mixed". A cell can therefore read mixed with no other rule disagreeing.
- **Nothing said.** No rule of that technique names a direction for this topic in this year. This is silence, and it is not a good year or a bad one. Where a rule marks the topic as active without a direction, that is shown as a pointer, counted apart, and never changes the word. A technique can also be silent for a stated reason, for example because it needs the sex the chart is read as, or because the first luck pillar has not yet begun.

The words come from the rules and from nothing else. There is no weight in them. The conventions listed under "The conventions used" include two settings of the calculation, the strength bands and the luck-pillar split, which are the project's own arithmetic that no source gives. They never appear in a statement; a statement names only the class, such as strong or weak.

## Tendencies and named uncertainty

The forecast states each result as what a named rule says about a period. It does not state that an event follows. Health statements carry the badge "a tendency only" and say nothing about diagnosis, and each list of statements opens with the words "Not tested yet."

The choice to speak in tendencies is the project's own. It is consistent with how some scholars characterise the arts. In his report on a conference at the Leopoldina, Lackner sets down that predictions indicate tendencies and give the questioner room to negotiate with the future. The text does not say whose view that is, because it follows his summary of other contributors. He also reports that the closing discussion held that only a communication that addresses the uncertainties of any prediction can start a rational reception of it (the newsletter "fate" no. 15, 06|19, pp. 3-4). Kalinowski writes that for Wang Chong destiny is a general tendency, named by the categories of the auspicious and the inauspicious, whose realisation depends on circumstances and encounters (IKGF Occasional Paper, 2009, pp. 6, 8-9 and 22). These are the scholars' characterisations. The project infers its wording from them, and no tradition's rule asks for it. Lackner says in a lecture that divination is, as a rule, a tool for decision and not a knowledge of the future for its own sake (13 June 2017, at 0:49), and, in the discussion after another, agreeing with a questioner, that the result of an oracle depends on how the question is put and on the moment at which it is asked (13 June 2017, at 1:04). The forecast is made for one chart, one topic and one span, and each statement is what a named rule says there, to be weighed and not taken as an account of what must happen. This reading is the project's own. See [SCHOLARSHIP.md](SCHOLARSHIP.md).

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

The sources do not say how to add one tradition's reading to another's, or one technique's to another's. They give rules, each for its own period. Any total would need weights, and no source gives them. So the forecast gives no score, no total and no figure for a year. It gives the words by technique and a headline that lists the techniques by word, such as "Supports: Vedic antardasha. Cautions: Saturn from the Moon. Mixed: BaZi year pillar (3 rules support, 1 cautions). Silent: Western solar return." If two techniques disagree, the page shows both.

A statement that extends beyond a year counts for that year only if it overlaps it by enough days; see the conventions below. The statement list always shows the true dates. The BaZi year pillar changes at Lichun, 3 to 5 February, so about a month of each calendar year still belongs to the previous pillar. That month passes the 15-day edge and counts like the rest, so a year's word can rest on the previous year's pillar alone.

## Testing the statements, and whose test it would be

The project has not tested the statements against outcomes. It has built a scorecard, with which a reader can count them against the events the reader records. The scorecard is the project's own design. Lackner describes a diary in which a space was left to check an oracle later (see below). What the scorecard counts is set out here.

**An event.** What the reader records afterwards: a day, a month or a year, a topic, and one of two words, "went well" or "went badly". An optional private note is kept in the session file and is never read by the engine.

**A frozen forecast.** The forecast of one moment, one set of settings and a span of years, fixed with a hash at a stated time. The session file keeps the hashes, not the statements; scoring evaluates the forecast again and counts it only if both hashes match.

**No hindsight.** An event is counted only against a forecast frozen before the day, month or year it covers. A forecast frozen later is listed as "frozen too late" and never counted. When several forecasts qualify, the earliest one that covers the event is used.

**Held and did not hold.** For each event, every statement of that forecast for the event's topic whose own dates overlap the event's dates is paired with it. A statement that supports meets "went well" as held and "went badly" as did not hold. A statement that cautions meets them the other way round. Mixed statements, notes without a direction and natal statements, which have no dates, are listed as not scored, with the reason. A technique that has rules for the topic but no statement over the event's dates is counted under "said nothing".

**Plain counts.** The scorecard prints held, did not hold, not scored and said nothing, and breaks them down by rule, by technique and by tradition. The techniques that count from the birth moment (luck pillars, year pillars, dashas, profections, firdaria, solar returns) share one clock, so they are also shown once as a group. There is no percentage, no ratio, no ranking and no total verdict. Every output begins with the number of events, the number of frozen forecasts and the sentence "These counts describe this reader's recorded events only."

**Shuffled dates.** Each event is moved by a whole number of days, round the span of its forecast, and counted again against the same forecast, 1000 times. In each run the shift is the same fraction of the room an event has inside its span, so events of different length move by different numbers of days and the spacing between them is not kept. The new dates may fall before the day the forecast was frozen. The scorecard prints "with the dates shuffled, the held count was at least as high in N of 1000 runs". With fewer than 10 scored statement-event pairs it prints "too few scored pairs to compare with shuffled dates" instead.

**What it cannot say.** Events a person records are not a random sample, and a person may choose what to record after seeing a forecast. A count of held statements describes the events in the file and does not say anything about a later period. The commands are `freeze`, `event` and `score`; the page has a Scorecard section under the forecast. A sample made from invented events is in [SAMPLE-SCORECARD.md](SAMPLE-SCORECARD.md).

The scholarship read for the project describes how forecasts were, and were not, checked. These are the scholars' descriptions and are not rules of this project. Lackner writes in an editorial that a forecaster whose forecast fails usually faces no consequence, and that forecasters may admit formal errors but rarely question the core of their statement (the newsletter "fate" no. 18, 07|21, p. 3); he writes about forecasting in general and does not say that any tradition lacked a way of checking. Esposito describes a divinatory logic in which a failed oracle is blamed on the interpretation and not on the omen (IKGF Occasional Paper, 2011, p. 5). Burton-Rose describes mid- and late-Qing morality books that offered anecdotes as proof that an advocated practice had worked, 195 anecdotes in an 1880 edition and 163 in an 1899 edition; the compiler of the first called them cases of proof, and Burton-Rose says they served an evidential function; the text does not say whether stories of failure appear (MPIWG Preprint 496, 2019, p. 50). Lackner says in a lecture that Yan Fu often left a blank space in his diary for the later check of an oracle (6 June 2017, at 1:01), and he names verification or falsification among the criteria of a scientific character (6 June 2017, at 0:39). He also says that the claim to truth is tied to the reading of oracle verdicts such as those of the Yijing, whose content, in the passage he gives, is always true and open to being misunderstood; the recording does not make clear whether this is his own view or that of the philosopher he goes on to discuss (13 June 2017, at 0:27). The scorecard counts the statements against the reader's events whatever explanation is offered for a failure. None of this is a test of the kind a scorecard makes. See [SCHOLARSHIP.md](SCHOLARSHIP.md).

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
- A natal BaZi statement is shared. Under the default settings, two births have the same four pillars when they fall in the same double-hour of the civil clock (the Zi double-hour, 23:00 to 01:00, counts as one, so 23:30 and 00:30 on the next date share it, while 00:30 and 23:30 on the same date do not) and on the same side of the turn of the month and of the year. With other clock settings, or with the day turning at midnight, this can fail. There are 518 400 possible sets of four pillars under the default (60 year pillars times 12 months times 60 days times 12 double-hours); the count is the project's own arithmetic. Lackner reports that an official of the Song counted about 518 000 possible combinations against a population of the nine provinces that he put at 14 to 18 million, and noted that very many people should share a chart while their fates differ (13 June 2017, at 0:04; 6 June 2017, at 0:41). A natal statement therefore says what a rule says about every set of four pillars, and nothing that sets one person apart from others who share them.
- The engine stops at naming what a rule says. Lackner says that the hexagram texts of the Yijing, a typology of situations, need an interpretation tied to a concrete question (16 June 2017, at 0:36). The forecast does not take that step: it does not turn a statement into advice for a question of yours.
- A year is a calendar year in UTC. Techniques counted from the birthday or from a dasha turn on other dates, so many statements straddle a year boundary and are cut as described above.
- Health statements are tendencies, and the forecast says nothing about diagnosis.

## How to reproduce the sample

```
cd overlay
npm run overlay -- forecast --moment j2000 --topic wealth --from 2026 --to 2035
```

`npm run generate` rebuilds the sample document and the figure from the code.
