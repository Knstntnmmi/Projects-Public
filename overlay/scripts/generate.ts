// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Regenerates the files that are derived from the code: the two reference documents and
 * the published test vectors. Run with `npm run generate`. A test fails if any of them
 * is out of date, so they cannot drift from the engine.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONVENTION_SPECS, DEFAULT_CONVENTIONS, type Conventions } from '../packages/core/src/conventions.ts';
import { DEFAULT_FORECAST_CONVENTIONS, FORECAST_CONVENTION_SPECS } from '../packages/core/src/forecast/conventions.ts';
import { CORRESPONDENCES } from '../packages/core/src/correspondences.ts';
import { facts } from '../packages/core/src/facts.ts';
import { solarTermInstant, SOLAR_TERMS } from '../packages/core/src/substrate/terms.ts';
import { makeMoment } from '../packages/core/src/substrate/time.ts';
import { fourPillars, luck } from '../packages/core/src/systems/bazi/index.ts';
import { evaluate, makeInput, type ForecastResult } from '../packages/core/src/forecast/evaluate.ts';
import { decadeGrid, gridText } from '../packages/core/src/forecast/grid.ts';
import { yearView } from '../packages/core/src/forecast/yearView.ts';
import { statementList } from '../packages/core/src/forecast/statements.ts';
import { glossaryMarkdown } from '../packages/core/src/forecast/glossary.ts';
import { eventDateText, valenceWords } from '../packages/core/src/forecast/scorecardText.ts';
import { TOPIC_LABEL } from '../packages/core/src/forecast/phrasebook.ts';
import {
  FORECAST_SENTENCE,
  GRID_LEGEND,
  conventionPairs,
  headlineLines,
  natalLines,
  notEvaluatedLines,
  renderDecadeGrid,
  ruleCounts,
  timelineFor,
  wheelFor,
  yearStatementLines,
} from '../packages/render/src/index.ts';
import { freezeInSession, newSession } from '../packages/core/src/forecast/sessionEdit.ts';
import { scoreSession } from '../packages/core/src/forecast/scorecard.ts';
import { scorecardLines } from '../packages/core/src/forecast/scorecardText.ts';
import { MOMENTS } from '../fixtures/moments.ts';
import { eventsFrom, nativityOf, SCORECARD_FREEZE_DAYS, SCORECARD_SAMPLE_OFFSETS } from '../fixtures/events.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function conventionsDoc(): string {
  const out: string[] = [
    '# Conventions',
    '',
    'Generated from `packages/core/src/conventions.ts` by `npm run generate`. Do not edit by hand.',
    '',
    'Two calculators can both be right and still print different charts, because each has made choices that it does not announce. This engine makes every such choice a named setting. Each result records the settings that produced it, and the sensitivity report recomputes the result under every alternative.',
    '',
  ];
  for (const spec of CONVENTION_SPECS) {
    out.push(`## ${spec.title}`, '', `Setting \`${spec.key}\`. Affects: ${spec.affects}.`, '', spec.why, '', '| Value | Meaning | Default |', '| --- | --- | --- |');
    for (const o of spec.options) out.push(`| \`${o.value}\` | ${o.label}. ${o.description} | ${o.value === DEFAULT_CONVENTIONS[spec.key] ? 'yes' : ''} |`);
    out.push('');
  }
  out.push(
    '## Choices that are not yet settings',
    '',
    'These are fixed in this version, and are listed so that nobody mistakes them for facts. The year pillar turns at Lichun only; the lunar-new-year and winter-solstice year boundaries are not offered. Solar terms are always the true-Sun terms, although the Chinese calendar used mean-time terms before 1645, so pillars for earlier dates follow the modern rule and not the rule in force at the time. Houses are whole-sign, the lunar node is the mean node, triplicity lords are the Dorothean set and bounds the Egyptian set; the Ptolemaic tables that William Lilly printed are not included yet. Hidden stems follow the common modern table. Vimshottari years are 365.25 days.',
    '',
  );
  out.push(
    '# Forecast conventions',
    '',
    'The forecast layer adds the choices the published rules leave open. They sit beside the settings above and are recorded in every forecast. The sovereign-hexagram boundary and the firdaria node order are the engine settings above and are not repeated.',
    '',
  );
  for (const spec of FORECAST_CONVENTION_SPECS) {
    out.push(`## ${spec.title}`, '', `Setting \`${spec.key}\`. Affects: ${spec.affects}.`, '', spec.why, '', '| Value | Meaning | Default |', '| --- | --- | --- |');
    for (const o of spec.options) out.push(`| \`${o.value}\` | ${o.label}. ${o.description} | ${String(o.value) === String(DEFAULT_FORECAST_CONVENTIONS[spec.key]) ? 'yes' : ''} |`);
    out.push('');
  }
  return out.join('\n');
}

export function correspondencesDoc(): string {
  const out: string[] = [
    '# Correspondences between systems',
    '',
    'Generated from `packages/core/src/correspondences.ts` by `npm run generate`. Do not edit by hand.',
    '',
    'Links between systems are asserted everywhere and graded almost nowhere. Each one here carries a grade. *Exact* means the two things have the same boundaries by definition or arithmetic. *Structural* means one arrangement is a stated transformation of the other. *Historical* means the link was once an observation and has since been frozen into a count that no longer follows the sky. *Loose* means a resemblance of number or theme whose boundaries do not coincide. *Coincidence* means a numerical near-match with no shown common origin.',
    '',
  ];
  for (const c of CORRESPONDENCES) {
    out.push(
      `## ${c.between[0]} and ${c.between[1]}`,
      '',
      `Grade: **${c.grade}**${c.verifiedHere ? ' (checked by the test suite)' : ' (stated from the literature, not checked here)'}.`,
      '',
      `${c.claim} ${c.detail}`,
      '',
      `Sources: ${c.sources.join('; ')}.`,
      '',
    );
  }
  return out.join('\n');
}

/** Four pillars of every sample moment under every combination of the two conventions that bear on them. */
export function pillarVectors(): unknown {
  const bases = ['civil', 'standard', 'lmt', 'apparent'] as const;
  const boundaries = ['zi23', 'midnight'] as const;
  return {
    about:
      'Four Pillars of synthetic moments under each combination of clock basis and day boundary. Year and month pillars turn at the true-Sun Lichun and jie. Use these to check another calculator, convention by convention. None of these moments is anyone\'s birth data.',
    vectors: MOMENTS.map((f) => {
      const moment = makeMoment(f.civil, f.zone, f.place);
      const results: Record<string, string> = {};
      for (const timeBasis of bases) {
        for (const dayBoundary of boundaries) {
          const conventions: Conventions = { ...DEFAULT_CONVENTIONS, timeBasis, dayBoundary };
          const p = fourPillars(moment, conventions);
          results[`${timeBasis}/${dayBoundary}`] = `${p.year.hanzi} ${p.month.hanzi} ${p.day.hanzi} ${p.hour.hanzi}`;
        }
      }
      const l = (sex: 'male' | 'female') => {
        const x = luck(moment, DEFAULT_CONVENTIONS, sex);
        return { direction: x.forward ? 'forward' : 'backward', startAge: x.startAge, first: x.pillars[0]!.cycle.hanzi };
      };
      return {
        id: f.id,
        why: f.why,
        civil: f.civil,
        zone: f.zone,
        latitude: f.place.latitude,
        longitude: f.place.longitude,
        utc: new Date(moment.utcMs).toISOString(),
        pillars: results,
        luckUnderDefaults: { male: l('male'), female: l('female') },
      };
    }),
  };
}

/** Solar-term instants to the second, 2020 to 2030. */
export function termVectors(): unknown {
  const years: Record<string, Record<string, string>> = {};
  for (let y = 2020; y <= 2030; y++) {
    years[y] = Object.fromEntries(SOLAR_TERMS.map((t) => [t.pinyin, new Date(Math.round(solarTermInstant(y, t.index) / 1000) * 1000).toISOString().replace('.000Z', 'Z')]));
  }
  return {
    about:
      'Instants (UTC, to the second) at which the Sun\'s apparent geocentric longitude reaches 315 + 15k degrees, grouped by the Lichun-to-Lichun year they belong to, so Xiaohan and Dahan fall in the following January.',
    years,
  };
}

/** Rounds every number so that the stored document does not depend on the last bits of a floating-point library. */
export function stable(value: unknown): unknown {
  if (typeof value === 'number') return Number.isInteger(value) ? value : Math.round(value * 100) / 100;
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stable(v)]));
  return value;
}

export function exampleFacts(): unknown {
  const f = MOMENTS.find((m) => m.id === 'j2000')!;
  return stable(facts(makeMoment(f.civil, f.zone, f.place), { sex: 'female', uncertaintyMinutes: 10 }));
}

function sample(): ReturnType<typeof makeMoment> {
  const f = MOMENTS.find((m) => m.id === 'j2000')!;
  return makeMoment(f.civil, f.zone, f.place);
}

/** The fixed sample of the forecast figure and document: the constructed moment j2000, wealth, 2026 to 2035. */
export const SAMPLE_FORECAST = { moment: 'j2000', topic: 'wealth', fromYear: 2026, toYear: 2035, command: 'npm run overlay -- forecast --moment j2000 --topic wealth --from 2026 --to 2035' } as const;

let sampleResult: ForecastResult | undefined;
/** One evaluation serves both generated files; no clock is read, and the baseline's seed is the default one. */
function sampleForecast(): ForecastResult {
  if (!sampleResult) {
    const f = MOMENTS.find((m) => m.id === SAMPLE_FORECAST.moment)!;
    const input = makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: SAMPLE_FORECAST.fromYear, toYear: SAMPLE_FORECAST.toYear });
    sampleResult = evaluate(input, { topics: [SAMPLE_FORECAST.topic] });
  }
  return sampleResult;
}

const md = (s: string): string => s.replace(/([\\`*_<>\[\]])/g, '\\$1');

export function sampleForecastDoc(): string {
  const result = sampleForecast();
  const topic = SAMPLE_FORECAST.topic;
  const list = statementList(result, topic);
  const grid = decadeGrid(result, topic);
  const counts = ruleCounts(result);
  const label = TOPIC_LABEL[topic];
  const years = grid.years;
  const out: string[] = [
    `# A sample forecast: ${label}, ${years[0]} to ${years[years.length - 1]}`,
    '',
    'Generated from the code by `npm run generate`. Do not edit by hand.',
    '',
    FORECAST_SENTENCE,
    '',
    `The chart is the constructed moment \`${SAMPLE_FORECAST.moment}\` of \`fixtures/moments.ts\` (the J2000.0 epoch at Greenwich), which is no person's birth. No sex convention is named, so the rules that need one are listed below as not evaluated, and the BaZi luck pillars are silent.`,
    '',
    `## ${list.natalHeading}`,
    '',
    ...natalLines(list).slice(1).map((l) => `- ${md(l.trim())}`),
    '',
    '## The grid',
    '',
    `![The decade grid for ${label}, ${years[0]} to ${years[years.length - 1]}](img/forecast-grid.svg)`,
    '',
    `The same grid as text (${GRID_LEGEND}):`,
    '',
    '```text',
    ...gridText(grid),
    '```',
    '',
    '## The year headlines',
    '',
    ...headlineLines(yearView(result, topic)).map((l) => `- ${md(l)}`),
    '',
    `## The statements of ${years.slice(0, 3).join(', ')}`,
    '',
    'Each statement is said in full the first time it appears and named after that. Pointers, which mark the topic without a direction, are folded into one group per level and year.',
    '',
    '```text',
    ...yearStatementLines(result, topic, years.slice(0, 3)).slice(1),
    '```',
    '',
    `## The rules not evaluated (${counts.notEvaluated.length})`,
    '',
    'Each is listed with the reason, for every topic: a rule that needs a convention that was not named, a rule whose source leaves a point open, and the branches of a rule that are left out.',
    '',
    ...notEvaluatedLines(counts).map((l) => `- ${md(l)}`),
    '',
    '## The conventions used',
    '',
    'Settings are described in [CONVENTIONS.md](CONVENTIONS.md).',
    '',
    ...conventionPairs(result).map(([k, v]) => `- \`${k}\`: ${md(v)}`),
    '',
    '## How to reproduce it',
    '',
    'From the `overlay` folder, after `npm ci`:',
    '',
    '```sh',
    SAMPLE_FORECAST.command,
    `${SAMPLE_FORECAST.command} --full`,
    `${SAMPLE_FORECAST.command} --svg > forecast-grid.svg`,
    '```',
    '',
  ];
  return out.join('\n');
}

/** The sample session of the scorecard: the constructed moment j2000, two forecasts frozen at fixed times, fourteen invented events. */
export function sampleSession() {
  const base = makeMoment(MOMENTS.find((m) => m.id === 'j2000')!.civil, 'UTC', MOMENTS.find((m) => m.id === 'j2000')!.place).utcMs;
  const n = nativityOf('j2000');
  const empty = newSession(n);
  const first = freezeInSession(empty, { nativity: n, conventions: empty.conventions }, { fromYear: 2026, toYear: 2035 }, base + SCORECARD_FREEZE_DAYS.first * 86_400_000);
  const second = freezeInSession(first, { nativity: n, conventions: empty.conventions }, { fromYear: 2026, toYear: 2030 }, base + SCORECARD_FREEZE_DAYS.second * 86_400_000);
  return { ...second, events: eventsFrom('j2000', SCORECARD_SAMPLE_OFFSETS) };
}

export function sampleScorecardDoc(): string {
  const session = sampleSession();
  const card = scoreSession(session);
  const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
  return [
    '# A sample scorecard from invented events',
    '',
    'Generated from the code by `npm run generate`. Do not edit by hand.',
    '',
    'Every event below is invented for this example, and none is anyone\'s life. The chart is the constructed moment `j2000` of `fixtures/moments.ts` (the J2000.0 epoch at Greenwich), which is no person\'s birth. The events are fixed numbers of days from that moment, and two of them fall before the first freeze, so they are listed as frozen too late.',
    '',
    '## How it was made',
    '',
    `Two forecasts were frozen for the constructed moment, with the default settings and no sex convention: the years 2026 to 2035 at ${iso(session.frozen[0]!.frozenAtUtcMs)}, and the years 2026 to 2030 at ${iso(session.frozen[1]!.frozenAtUtcMs)}. The fourteen invented events were then counted against them. An event is counted against the earliest forecast that was frozen before it and covers its dates, so the second forecast is listed but no event needed it. The command line freezes at the time you run it, so a session of your own cannot be frozen in the past; here the freeze times are set in the generator.`,
    '',
    'The invented events:',
    '',
    '| Event | Dates it covers | Topic | How it went |',
    '| --- | --- | --- | --- |',
    ...card.events.map((e) => `| ${e.eventId} | ${eventDateText(e)} | ${TOPIC_LABEL[e.topic]} | ${valenceWords(e.valence)} |`),
    '',
    '## The scorecard',
    '',
    'This is what `overlay score --session <file>` prints for that session.',
    '',
    '```text',
    ...scorecardLines(card),
    '```',
    '',
    '## How to read it',
    '',
    'A statement is held when it points the way the event went (supports with "went well", cautions with "went badly") and did not hold when it points the other way. Mixed statements, notes without a direction and natal statements are not scored. A technique with rules for the topic and no statement over the event\'s dates said nothing. The counts describe these invented events and nothing else.',
    '',
  ].join('\n');
}

export const GENERATED: Array<{ path: string; content: () => string }> = [
  { path: 'docs/img/wheel-j2000.svg', content: () => `${wheelFor(sample(), DEFAULT_CONVENTIONS, { legend: true, title: 'The J2000 epoch read across seven rings' })}\n` },
  {
    path: 'docs/img/timeline-j2000.svg',
    content: () => {
      const m = sample();
      return `${timelineFor(m, DEFAULT_CONVENTIONS, { startUtcMs: m.utcMs, endUtcMs: m.utcMs + 90 * 365.2425 * 86_400_000, sex: 'female', title: 'Ninety years from the J2000 epoch, every track on one axis' })}\n`;
    },
  },
  {
    path: 'docs/img/forecast-grid.svg',
    content: () => `${renderDecadeGrid(decadeGrid(sampleForecast(), SAMPLE_FORECAST.topic))}\n`,
  },
  { path: 'docs/SAMPLE-FORECAST.md', content: sampleForecastDoc },
  { path: 'docs/SAMPLE-SCORECARD.md', content: sampleScorecardDoc },
  { path: 'docs/GLOSSARY.md', content: glossaryMarkdown },
  { path: 'docs/CONVENTIONS.md', content: conventionsDoc },
  { path: 'docs/CORRESPONDENCES.md', content: correspondencesDoc },
  { path: 'fixtures/golden/pillars.json', content: () => `${JSON.stringify(pillarVectors(), null, 2)}\n` },
  { path: 'fixtures/golden/solar-terms.json', content: () => `${JSON.stringify(termVectors(), null, 2)}\n` },
  { path: 'fixtures/golden/facts-j2000.json', content: () => `${JSON.stringify(exampleFacts(), null, 2)}\n` },
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const g of GENERATED) {
    const target = join(root, g.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, g.content());
    process.stdout.write(`wrote ${g.path}\n`);
  }
}
