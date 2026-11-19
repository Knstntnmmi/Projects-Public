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
  makeMoment,
  sensitivity,
  conventionEffects,
  utcMsFromFields,
  type Conventions,
  type Moment,
  type Sex,
} from '@overlay/core';
import { timelineFor, wheelFor } from '@overlay/render';
import { MOMENTS } from '../../../fixtures/moments.ts';

const HELP = `overlay: one moment, every system, one shared axis

Usage
  overlay <command> [options]

Commands
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

Privacy
  The moment you pass stays in this process. Nothing is sent anywhere or saved.
`;

interface Args {
  command: string;
  flags: Map<string, string[]>;
}

function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string[]>();
  let command = '';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      const value = next !== undefined && !/^--[a-z]/.test(next) ? (i++, next) : 'true';
      flags.set(key, [...(flags.get(key) ?? []), value]);
    } else if (!command) command = a;
  }
  return { command, flags };
}

function fail(message: string): never {
  process.stderr.write(`overlay: ${message}\n`);
  process.exit(2);
}

function readConventions(flags: Map<string, string[]>): Conventions {
  const c: Record<string, unknown> = { ...DEFAULT_CONVENTIONS };
  for (const pair of flags.get('set') ?? []) {
    const [key, raw] = pair.split('=');
    const spec = CONVENTION_SPECS.find((s) => s.key === key);
    if (!spec || raw === undefined) fail(`unknown convention "${pair}". Run "overlay conventions" for the list.`);
    const option = spec.options.find((o) => String(o.value) === raw);
    if (!option) fail(`"${raw}" is not an option for ${key}. Choices: ${spec.options.map((o) => o.value).join(', ')}`);
    c[key!] = option.value;
  }
  return c as unknown as Conventions;
}

function readMoment(flags: Map<string, string[]>): Moment {
  const id = flags.get('moment')?.[0];
  if (id) {
    const f = MOMENTS.find((m) => m.id === id);
    if (!f) fail(`no sample moment "${id}". Run "overlay moments" for the list.`);
    return makeMoment(f.civil, f.zone, f.place);
  }
  const at = flags.get('at')?.[0];
  if (!at) fail('give a moment with --moment <id> or --at "YYYY-MM-DD HH:MM". Run "overlay --help".');
  const m = /^(-?\d{1,4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(at.trim());
  if (!m) fail(`cannot read "${at}" as YYYY-MM-DD HH:MM[:SS]`);
  const num = (key: string, fallback: number): number => {
    const v = flags.get(key)?.[0];
    if (v === undefined) return fallback;
    const x = Number(v);
    if (!Number.isFinite(x)) fail(`--${key} must be a number`);
    return x;
  };
  const zone = flags.get('zone')?.[0] ?? 'UTC';
  try {
    return makeMoment(
      { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]), hour: Number(m[4]), minute: Number(m[5]), second: Number(m[6] ?? 0) },
      zone,
      { latitude: num('lat', 0), longitude: num('lon', 0) },
    );
  } catch {
    fail(`unknown time zone "${zone}"`);
  }
}

function readSex(flags: Map<string, string[]>): Sex | undefined {
  const s = flags.get('sex')?.[0];
  if (s === undefined) return undefined;
  if (s !== 'male' && s !== 'female') fail('--sex must be male or female');
  return s;
}

function span(flags: Map<string, string[]>, moment: Moment): { startUtcMs: number; endUtcMs: number } {
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

function main(): void {
  const { command, flags } = parseArgs(process.argv.slice(2));
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
      return out(timelineFor(moment, conventions, { ...span(flags, moment), sex, theme }));
    case 'seams': {
      const s = span(flags, moment);
      const tracks = buildTracks(moment, conventions, { ...s, sex });
      const report = findSeams(tracks, s.startUtcMs, s.endUtcMs, { limit: 20 });
      out(`Windows of ${report.windowDays} days in which tracks on two or more independent clocks change: ${report.found} found, about ${report.expectedByChance.toFixed(1)} expected if boundaries fell at random.`);
      out('Tracks that share a clock (the firdaria and the profections both turn on the birthday) are counted once.');
      out('A seam is a description of the calendar arithmetic, not a forecast.\n');
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

main();
