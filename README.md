# overlay

Overlay computes BaZi, the I Ching calendars, Western and Vedic astrology and several day counts for one moment and place, for people who compare these traditions.

![The wheel for the J2000 sample moment: rings on one ecliptic, each dividing the same circle by one rule set, from the zodiac and solar terms to hexagram calendars and nakshatras.](overlay/docs/img/wheel-j2000.svg)

Two calculators can print different charts because each has made choices that it does not announce.

Overlay names every convention on which they differ, such as the clock that is read, and for each result it reports how many minutes the moment lies from the point where the result would change.

As an example, take the afternoon of 4 February 2024 in Beijing, a constructed moment. The Sun reaches 315 degrees of longitude at about 16:27 on the Beijing clock. At 16:25 the year pillar is 癸卯, and at 16:29 it is 甲辰. The tool reports that the year pillar lies 1.8 minutes from the change and declines to decide, because that is inside its own margin of two minutes.

![The timeline for the J2000 sample moment: tracks on one date axis, each showing the periods and yearly cycles of one tradition.](overlay/docs/img/timeline-j2000.svg)

Overlay calculates and draws today. Forecasting by each tradition's own published rules is being built and is not in the repository yet.

## Try it

```
cd overlay
npm ci
npm run dev
node packages/cli/src/index.ts sensitivity --moment lichun-eve-2024 --uncertainty 10
```

The third command serves the web page locally, and the fourth prints the distances to every boundary for the example above.

Nothing leaves your machine. The web page is built to forbid network requests, and the tests check that no source file reaches the network or storage.

| Where | What it holds |
| --- | --- |
| [overlay/README.md](overlay/README.md) | The full technical readme |
| [overlay/docs/SOURCES.md](overlay/docs/SOURCES.md) | The sources and how each was checked |
| [overlay/docs/CONVENTIONS.md](overlay/docs/CONVENTIONS.md) | The conventions on which calculators differ |
| [overlay/docs/CORRESPONDENCES.md](overlay/docs/CORRESPONDENCES.md) | How the systems line up on the ecliptic |

Copyright © 2026 Knstntnmmi. Licensed under the GNU AGPL, version 3 or later; the credit must be kept. See [overlay/NOTICE](overlay/NOTICE).
