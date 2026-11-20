# overlay

Run the command under Try it below. It reads the constructed moment j2000, the topic wealth and the years 2026 to 2035, and it prints a grid with one row for each technique and one column for each year. This is one row:

```
Jupiter from the Moon         ~    -    -    -    ~    ~    -    .    .    .
```

The first cell is 2026. The key above the grid reads "~ mixed". Add `--full` and look under 2026 (the lines below are shortened):

```
Jupiter from the Moon: mixed (rules conflict); 1 rule supports, 1 cautions
  supports: Jupiter transits the 9th sign from your natal Moon from 2025-12-05 to 2026-06-01; the 9th is a favourable house.
  cautions: Jupiter transits the 10th sign from your natal Moon from 2026-06-01 to 2026-10-31; the 10th is an unfavourable house.
```

These are two rules of one Vedic technique, and the output names both under their lines. The first is parashari.jupiter-transit-good. It cites the Phaladeepika, chapter 26, verses 2, 7 and 18 to 20, and B. V. Raman, Hindu Predictive Astrology, pages 419 to 420. The second is parashari.jupiter-transit-other. It cites the Phaladeepika, chapter 26, verses 18 to 20. They disagree because Jupiter passes from the 9th sign to the 10th, counted from the natal Moon, on 1 June 2026.

The block above is shortened: the real output also prints the rule and the source under each of these two lines, and more techniques and years follow it. It gives no total for 2026 and picks neither rule. Each line is what a named rule of one tradition says about this period, with its source. Nobody has tested these statements against outcomes yet.

Calculators usually print the charts of several traditions side by side, and a reading arrives without the rule behind it. Here each line carries its rule and its source, so two lines that disagree can be read against their books.

![The decade grid for the constructed sample moment j2000, topic wealth, 2026 to 2035: one row per technique, one column per year, each cell marked supports, cautions, mixed or nothing said.](overlay/docs/img/forecast-grid.svg)

Each row is one technique and each column one year. A cell shows the word that technique's rules give for that year: supports, cautions, mixed or nothing said. A cell split in colours (blue, purple, orange) means the rules of that technique disagree that year: how much of each colour shows how many of its rules support, caution or state a mixed result. A cell can also read mixed because a single rule itself states a mixed result. The full sample is in [overlay/docs/SAMPLE-FORECAST.md](overlay/docs/SAMPLE-FORECAST.md).

Every statement names its rule and its source, and the settings that change an answer, such as which time scale (civil or solar) is used for the birth hour, are shown with what each would change. All the systems read one astronomical base, so their boundaries can be compared, and nothing you type leaves the browser.

A reader can count the statements against the reader's own events: freeze a forecast, record events afterwards, and read plain counts (held, did not hold, not scored, said nothing) with a comparison against shuffled dates. A forecast frozen after an event is never counted against it. See `overlay score` in [overlay/README.md](overlay/README.md) and the [sample scorecard](overlay/docs/SAMPLE-SCORECARD.md), made from invented events.

## Try it

```
cd overlay
npm ci
node packages/cli/src/index.ts forecast --moment j2000 --topic wealth --from 2026 --to 2035
```

This needs Node 22.18 or later. The page is started with `npm run dev`. For the drawings, the facts document and the other commands see [overlay/README.md](overlay/README.md).

| Where | What it holds |
| --- | --- |
| [overlay/README.md](overlay/README.md) | The full technical readme |
| [overlay/docs/FORECAST.md](overlay/docs/FORECAST.md) | How a statement comes about, and the limits |
| [overlay/docs/SOURCES.md](overlay/docs/SOURCES.md) | The sources and how each was checked |
| [overlay/docs/SCHOLARSHIP.md](overlay/docs/SCHOLARSHIP.md) | What the published scholarship says, and what the project takes from it |
| [overlay/docs/GLOSSARY.md](overlay/docs/GLOSSARY.md) | The terms of art that the forecast prints |
| [overlay/docs/CONVENTIONS.md](overlay/docs/CONVENTIONS.md) | The conventions on which calculators differ |
| [overlay/PRIVACY.md](overlay/PRIVACY.md) | What happens to what you type |

Copyright © 2026 Knstntnmmi. Licensed under the GNU AGPL, version 3 or later; the credit must be kept. See [overlay/NOTICE](overlay/NOTICE).
