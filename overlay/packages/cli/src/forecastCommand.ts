// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The forecast commands: "forecast" (a span of years, one topic) and "window" (at most 62 days).
 * They return the text to print. The clock is not read here: the shell passes the current year in,
 * which is the only place the command line looks at it.
 */
import { forecast, utcMsFromFields, type Moment, type Conventions } from '@overlay/core';
import { FORECAST_SENTENCE, forecastTextLines, renderDecadeGrid, timelineFor, windowTextLines } from '@overlay/render';
import { fail, readMoment, readSettings, readSex, type Flags } from './args.ts';

/** The longest span of years the command takes: the evaluation grows with it. */
export const MAX_YEARS = 40;

const TRADITION_IDS: readonly forecast.Tradition[] = forecast.TRADITIONS;

function whole(flags: Flags, key: string): number | undefined {
  const v = flags.get(key)?.[0];
  if (v === undefined) return undefined;
  if (!/^-?\d+$/.test(v)) fail(`--${key} must be a whole number, got "${v}"`);
  return Number(v);
}

function readTopic(flags: Flags): forecast.Topic {
  const t = flags.get('topic')?.[0] ?? 'wealth';
  if (!(forecast.TOPICS as readonly string[]).includes(t)) fail(`unknown topic "${t}". Topics: ${forecast.TOPICS.join(', ')}`);
  return t as forecast.Topic;
}

function readTraditions(flags: Flags): forecast.Tradition[] | undefined {
  const v = flags.get('traditions')?.[0];
  if (v === undefined) return undefined;
  const list = v.split(',').map((x) => x.trim()).filter((x) => x !== '');
  for (const t of list) if (!(TRADITION_IDS as readonly string[]).includes(t)) fail(`unknown tradition "${t}". Traditions: ${TRADITION_IDS.join(', ')}`);
  if (list.length === 0) fail('--traditions needs at least one tradition');
  return list as forecast.Tradition[];
}

/** The years of a span: --from and --to, or ten years starting with the current year (given by the shell). */
export function readYears(flags: Flags, currentYear: number): { fromYear: number; toYear: number } {
  const from = whole(flags, 'from');
  const to = whole(flags, 'to');
  const fromYear = from ?? (to !== undefined ? to - 9 : currentYear);
  const toYear = to ?? fromYear + 9;
  if (toYear < fromYear) fail('--to must not be before --from');
  if (toYear - fromYear + 1 > MAX_YEARS) fail(`at most ${MAX_YEARS} years at a time`);
  if (fromYear < 1 || toYear > 9999) fail('the years must lie between 1 and 9999');
  return { fromYear, toYear };
}

/**
 * The convention that BaZi luck pillars need is the sex the chart is read as; the core calls it
 * baziSexConvention. It is set by --sex or by --set baziSexConvention=..., and is never guessed:
 * without it the rules that need it are listed as not evaluated.
 */
export function forecastConventionsOf(flags: Flags): Partial<forecast.ForecastConventions> {
  const set = readSettings(flags).forecast;
  const sex = readSex(flags);
  if (sex === undefined) return set;
  const named = sex === 'male' ? 'male-chart' : 'female-chart';
  if (set.baziSexConvention !== undefined && set.baziSexConvention !== named) fail('--sex and --set baziSexConvention=... name different charts');
  return { ...set, baziSexConvention: named };
}

function uncertainty(flags: Flags): number {
  const u = flags.get('uncertainty')?.[0];
  if (u === undefined) return 0;
  const x = Number(u);
  if (!Number.isFinite(x) || x < 0) fail('--uncertainty must be a number of minutes');
  return x;
}

export interface Prepared {
  moment: Moment;
  conventions: Conventions;
  input: forecast.ForecastInput;
}

export function prepare(flags: Flags, years: { fromYear: number; toYear: number }): Prepared {
  const moment = readMoment(flags);
  const conventions = readSettings(flags).engine;
  const input = forecast.makeInput(moment, { ...years, conventions, forecastConventions: forecastConventionsOf(flags), birthTimeUncertaintyMinutes: uncertainty(flags) });
  return { moment, conventions, input };
}

/** "overlay forecast": the text, the JSON report (--json) or the grid drawing (--svg). */
export function runForecast(flags: Flags, currentYear: number): string {
  if (flags.has('json') && flags.has('svg')) fail('give --json or --svg, not both');
  if (flags.has('glossary') && (flags.has('json') || flags.has('svg'))) fail('--glossary goes with the text output; leave out --json and --svg');
  const topic = readTopic(flags);
  const traditions = readTraditions(flags);
  const { input } = prepare(flags, readYears(flags, currentYear));
  const result = forecast.evaluate(input, { topics: [topic], ...(traditions ? { traditions } : {}) });
  if (flags.has('json')) return JSON.stringify({ about: FORECAST_SENTENCE, ...forecast.reportJson(result, topic) }, null, 2);
  if (flags.has('svg')) {
    const width = whole(flags, 'width');
    const theme = flags.get('theme')?.[0] as 'light' | 'dark' | undefined;
    return renderDecadeGrid(forecast.decadeGrid(result, topic), { ...(width === undefined ? {} : { width }), theme });
  }
  const opts = { topics: [topic], ...(traditions ? { traditions } : {}), runs: 20 };
  const sensitivity = forecast.sensitivityLines(input, result, forecast.birthTimeSensitivity(input, result, opts), topic);
  const text = forecastTextLines(result, topic, { full: flags.has('full'), sensitivity }).join('\n');
  if (!flags.has('glossary')) return text;
  // The words used: the glossary terms that occur in the text above, with their meaning and source.
  const words = forecast.glossaryLines(forecast.glossaryTermsIn(text));
  return words.length === 0 ? text : `${text}\n\n${words.join('\n')}`;
}

/** "overlay window": the character of at most 62 days, the I Ching and Lilly's day statements, each in its own part. */
export function runWindow(flags: Flags): string {
  const date = flags.get('date')?.[0];
  if (!date) fail('give the first day of the window with --date YYYY-MM-DD');
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date);
  if (!m) fail(`cannot read "${date}" as YYYY-MM-DD`);
  const days = whole(flags, 'days') ?? 30;
  if (days < 1) fail('--days must be at least 1');
  if (days > forecast.MAX_WINDOW_DAYS) fail(forecast.windowTooLongMessage(days, forecast.MAX_WINDOW_DAYS));
  const start = utcMsFromFields(Number(m[1]), Number(m[2]), Number(m[3]));
  const year = Number(m[1]);
  const { input } = prepare(flags, { fromYear: year, toYear: year });
  try {
    return windowTextLines(forecast.periodCharacter(input, { startUtcMs: start, endUtcMs: start + days * 86_400_000 })).join('\n');
  } catch (e) {
    if (e instanceof RangeError) fail(e.message);
    throw e;
  }
}

/** The timeline with the forecast tracks of one topic drawn under the engine's own. */
export function runForecastTimeline(flags: Flags, moment: Moment, conventions: Conventions, currentYear: number): string {
  const raw = flags.get('forecast')?.[0];
  const topic = raw === undefined || raw === 'true' ? 'wealth' : raw;
  if (!(forecast.TOPICS as readonly string[]).includes(topic)) fail(`unknown topic "${topic}". Topics: ${forecast.TOPICS.join(', ')}`);
  const from = flags.get('from')?.[0];
  let startUtcMs: number;
  if (from) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(from);
    if (!m) fail('--from must be YYYY-MM-DD');
    startUtcMs = utcMsFromFields(Number(m[1]), Number(m[2]), Number(m[3]));
  } else startUtcMs = utcMsFromFields(currentYear, 1, 1);
  const years = Number(flags.get('years')?.[0] ?? 10);
  if (!(years > 0) || years > MAX_YEARS) fail(`--years must be between 0 and ${MAX_YEARS} when forecast tracks are drawn`);
  const endUtcMs = startUtcMs + years * 365.2425 * 86_400_000;
  const fromYear = new Date(startUtcMs).getUTCFullYear();
  const toYear = new Date(endUtcMs - 1).getUTCFullYear();
  const fc = forecastConventionsOf(flags);
  const input = forecast.makeInput(moment, { fromYear, toYear, conventions, forecastConventions: fc, birthTimeUncertaintyMinutes: uncertainty(flags) });
  const result = forecast.evaluate(input, { topics: [topic as forecast.Topic], runs: 20 });
  return timelineFor(moment, conventions, {
    startUtcMs,
    endUtcMs,
    sex: readSex(flags),
    theme: flags.get('theme')?.[0] as 'light' | 'dark' | undefined,
    extraTracks: forecast.forecastTracks(result, topic as forecast.Topic),
    footnote: FORECAST_SENTENCE,
  });
}
