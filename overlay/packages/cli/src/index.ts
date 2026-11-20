// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * overlay: the command line. Reads a moment, writes JSON, SVG or a table to stdout.
 * Nothing is read from or written to the network, and nothing is stored.
 */
import {
  CONVENTION_SPECS,
  CORRESPONDENCES,
  DEFAULT_CONVENTIONS,
  facts,
  findSeams,
  buildTracks,
  sensitivity,
  conventionEffects,
  utcMsFromFields,
  type Moment,
} from '@overlay/core';
import { FORECAST_SENTENCE, timelineFor, wheelFor } from '@overlay/render';
import { MOMENTS } from '../../../fixtures/moments.ts';
import { CliError, fail, parseArgs, readConventions, readMoment, readSex, type Flags } from './args.ts';
import { runForecast, runForecastTimeline, runWindow } from './forecastCommand.ts';

const HELP = `overlay: one moment, every system, one shared axis, and for a span of years what each tradition's published rules say about a topic, with their source

Usage
  overlay <command> [options]

Commands
  forecast         what each tradition's rules say about a topic, year by year, money first (add --full for every statement)
  window           the I Ching's character of a period and Lilly's day statements, for at most 62 days
  facts            everything the engine can say about the moment, as JSON
  wheel            the ring overlay as SVG
  timeline         the track overlay as SVG
  sensitivity      how close the moment is to each boundary, and what each convention would change
  seams            dates on which several tracks change together
  conventions      the choices the engine makes, and their alternatives
  correspondences  the graded registry of links between systems
  moments          the built-in sample moments

The moment
  --moment <id>           a built-in sample moment (see "overlay moments")
  --at "<YYYY-MM-DD HH:MM[:SS]>"   wall-clock time
  --zone <zone>           IANA name, UTC, or a fixed offset such as +08:00   (default UTC)
  --lat <degrees>         north positive                                     (default 0)
  --lon <degrees>         east positive                                      (default 0)

Options
  --sex male|female       needed only for the direction of BaZi luck pillars
  --uncertainty <min>     how uncertain the clock time is, for the sensitivity flags
  --set key=value         override a convention; repeatable (see "overlay conventions")
  --rings a,b,c           wheel: ring ids, outermost first
  --orientation western|chinese   wheel: which way the circle runs
  --from <YYYY-MM-DD>     timeline and seams: start (default: the moment)
  --years <n>             timeline and seams: length in years (default 90)
  --theme light|dark      fix the colours instead of following the viewer
  --legend                wheel: list the rings underneath

Forecast options
  --topic <name>          wealth (the default), career, relationships, health, learning, home-travel, general
  --from <year> --to <year>   the years (default: the ten years starting with the current year)
  --traditions a,b        bazi, vedic, iching, western (default: all four)
  --json                  the JSON report            --svg   the grid as a drawing (--width <px>, 360 to 1200)
  --full                  every statement, the rules not evaluated and the conventions used
  --glossary              after the text, the words used in it, each with its meaning and source
  --sex male|female       the sex the BaZi chart is read as. The luck pillars and some rules need it;
                          it is never guessed, and the rules that need it are listed as not evaluated without it
  --set key=value         also takes the forecast settings, for example sliceEdgeDays=0
  timeline --forecast [topic]   draws the forecast tracks under the engine's own (ten years unless --years is given)
Window options
  --date <YYYY-MM-DD> --days <n>   the first day and the length, at most 62 days
${FORECAST_SENTENCE}

Privacy
  The moment you pass stays in this process. Nothing is sent anywhere or saved.
`;

function span(flags: Flags, moment: Moment): { startUtcMs: number; endUtcMs: number } {
  const from = flags.get('from')?.[0];
  let start = moment.utcMs;
  if (from) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(from);
    if (!m) fail('--from must be YYYY-MM-DD');
    start = utcMsFromFields(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  const years = Number(flags.get('years')?.[0] ?? 90);
  if (!(years > 0)) fail('--years must be a positive number');
  return { startUtcMs: start, endUtcMs: start + years * 365.2425 * 86_400_000 };
}

const pad = (s: string, w: number): string => s + ' '.repeat(Math.max(0, w - [...s].reduce((a, ch) => a + (ch.codePointAt(0)! > 0x2e7f ? 2 : 1), 0)));
const minutes = (m: number | undefined): string => {
  if (m === undefined) return 'beyond 40 days';
  if (m < 90) return `${m.toFixed(1)} min`;
  if (m < 48 * 60) return `${(m / 60).toFixed(1)} h`;
  return `${(m / 1440).toFixed(1)} d`;
};

process.stdout.on('error', (e: NodeJS.ErrnoException) => {
  // A closed pipe (for example `overlay ... | head`) is not an error worth reporting.
  if (e.code === 'EPIPE') process.exit(0);
  throw e;
});

function main(argv: string[], currentYear: number): void {
  const { command, flags } = parseArgs(argv);
  const out = (s: string): void => void process.stdout.write(s.endsWith('\n') ? s : `${s}\n`);
  if (!command || flags.has('help') || command === 'help') return out(HELP);
  const theme = flags.get('theme')?.[0] as 'light' | 'dark' | undefined;

  switch (command) {
    case 'moments':
      for (const m of MOMENTS) out(`${pad(m.id, 20)} ${m.why}`);
      return;
    case 'conventions':
      for (const spec of CONVENTION_SPECS) {
        out(`${spec.key}: ${spec.title}\n  affects: ${spec.affects}\n  why: ${spec.why}`);
        for (const o of spec.options) out(`  ${o.value === DEFAULT_CONVENTIONS[spec.key] ? '*' : ' '} ${pad(String(o.value), 22)} ${o.label}. ${o.description}`);
        out('');
      }
      return;
    case 'correspondences':
      for (const c of CORRESPONDENCES) {
        out(`[${c.grade}] ${c.between[0]}  <->  ${c.between[1]}${c.verifiedHere ? '  (checked by the test suite)' : ''}\n  ${c.claim}\n  ${c.detail}\n  Sources: ${c.sources.join('; ')}\n`);
      }
      return;
  }

  switch (command) {
    case 'forecast':
      return out(runForecast(flags, currentYear));
    case 'window':
      return out(runWindow(flags));
  }

  const moment = readMoment(flags);
  const conventions = readConventions(flags);
  const sex = readSex(flags);

  switch (command) {
    case 'facts':
      return out(JSON.stringify(facts(moment, { conventions, sex, uncertaintyMinutes: Number(flags.get('uncertainty')?.[0] ?? 0) }), null, 2));
    case 'wheel':
      return out(
        wheelFor(moment, conventions, {
          visible: flags.get('rings')?.[0]?.split(','),
          orientation: flags.get('orientation')?.[0] === 'chinese' ? 'chinese' : 'western',
          legend: flags.has('legend'),
          theme,
        }),
      );
    case 'timeline':
      if (flags.has('forecast')) return out(runForecastTimeline(flags, moment, conventions, currentYear));
      return out(timelineFor(moment, conventions, { ...span(flags, moment), sex, theme }));
    case 'seams': {
      const s = span(flags, moment);
      const tracks = buildTracks(moment, conventions, { ...s, sex });
      const report = findSeams(tracks, s.startUtcMs, s.endUtcMs, { limit: 20 });
      out(`Windows of ${report.windowDays} days in which tracks on two or more independent clocks change: ${report.found} found, about ${report.expectedByChance.toFixed(1)} expected if boundaries fell at random.`);
      out('Tracks that share a clock (the firdaria and the profections both turn on the birthday) are counted once.');
      out('A seam is a description of the calendar arithmetic and says nothing about what happens.\n');
      for (const seam of report.seams) {
        out(`${new Date(seam.utcMs).toISOString().slice(0, 10)}  ${seam.clocks} clocks`);
        for (const c of seam.changes) out(`    ${pad(c.title, 26)} ${c.from} -> ${c.to}   (${new Date(c.utcMs).toISOString().slice(0, 10)})`);
      }
      return;
    }
    case 'sensitivity': {
      const u = Number(flags.get('uncertainty')?.[0] ?? 0);
      out(`${pad('Fact', 36)} ${pad('Value', 30)} ${pad('Earlier change', 34)} Later change`);
      for (const r of sensitivity(moment, conventions, u)) {
        const side = (x: { minutes: number; value: string } | null): string => (x ? `${minutes(x.minutes)} -> ${x.value}` : minutes(undefined));
        out(`${pad(r.fact, 36)} ${pad(r.value, 30)} ${pad(side(r.earlier), 34)} ${side(r.later)}${r.withinEngineMargin ? '   << inside the engine margin: undecided' : r.withinUncertainty ? '   << within the stated uncertainty' : ''}`);
      }
      out('\nUnder other conventions:');
      for (const e of conventionEffects(moment, conventions, sex)) {
        out(`  ${e.key}=${e.value} (${e.label}): ${e.changes.length ? e.changes.map((c) => `${c.output} ${c.from} -> ${c.to}`).join('; ') : 'no change'}`);
      }
      return;
    }
    default:
      fail(`unknown command "${command}". Run "overlay --help".`);
  }
}

try {
  // The clock is read here and nowhere else: the shell tells the commands which year it is.
  main(process.argv.slice(2), new Date().getUTCFullYear());
} catch (e) {
  if (!(e instanceof CliError)) throw e;
  process.stderr.write(`overlay: ${e.message}\n`);
  process.exit(2);
}
