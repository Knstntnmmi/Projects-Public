# overlay

Overlay computes BaZi (the Chinese Four Pillars), I Ching year-calendars, Western and Vedic astrology and calendar day counts for one moment and place. For a span of years it also states what four traditions' own published rules say about a topic, with the rule and the source behind each statement.

You give it a birth moment and place, a span of years and a topic, money first. It gives back, technique by technique and year by year, what the rules of BaZi, Vedic astrology (nakshatras and dashas), Western astrology after William Lilly (1647) and the I Ching, read by period, say about that topic. Each statement names its rule and its source.

![The decade grid for the constructed sample moment j2000, topic wealth, 2026 to 2035: one row per technique, one column per year, each cell marked supports, cautions, mixed or nothing said.](overlay/docs/img/forecast-grid.svg)

Each row is one technique and each column one year. A cell shows the word that technique's rules give for that year: supports, cautions, mixed or nothing said. The full sample is in [overlay/docs/SAMPLE-FORECAST.md](overlay/docs/SAMPLE-FORECAST.md).

Other calculators rarely say where a statement comes from. Here every statement names its rule and its source, and the conventions that change an answer, such as which clock is read, are shown with what each would change. All the systems read one astronomical base, so their boundaries can be compared, and nothing you type leaves the browser.

Each line is what a named rule of one tradition says about this period, with its source. Nobody has tested these statements against outcomes yet.

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
| [overlay/docs/CONVENTIONS.md](overlay/docs/CONVENTIONS.md) | The conventions on which calculators differ |
| [overlay/PRIVACY.md](overlay/PRIVACY.md) | What happens to what you type |

Copyright © 2026 Knstntnmmi. Licensed under the GNU AGPL, version 3 or later; the credit must be kept. See [overlay/NOTICE](overlay/NOTICE).
