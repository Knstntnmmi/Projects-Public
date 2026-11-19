// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONVENTIONS, forecast } from '@overlay/core';
import { FORECAST_SENTENCE } from '@overlay/render';
import { CliError, parseArgs, readMoment } from '../src/args.ts';
import { runForecast, runForecastTimeline, runWindow } from '../src/forecastCommand.ts';
import { MOMENTS } from '../../../fixtures/moments.ts';

const flagsOf = (...argv: string[]) => parseArgs(['x', ...argv]).flags;
const forecastOf = (...argv: string[]): string => runForecast(flagsOf('--moment', 'j2000', '--from', '2026', '--to', '2035', ...argv), 2031);
const count = (text: string, part: string): number => text.split(part).length - 1;

/** The words the phrasebook forbids, and wording about death or diagnosis; the one known negated sentence is let through as the phrasebook does. */
function assertWording(text: string, where: string): void {
  const lines = text.split('\n');
  for (const line of lines) {
    expect(forecast.bannedIn(line), `${where}: ${line}`).toBeNull();
    // "Cancer" is a sign of the zodiac here, not a diagnosis.
    // One sentence of the rule files is let through, as its own test lets it through: a negation.
    if (!line.includes('not a prediction of death')) expect(forecast.MORTALITY_WORDS.test(line.replace(/\bCancer\b/g, 'the Crab')), `${where}: ${line}`).toBe(false);
  }
}

describe('overlay forecast: the birth time', () => {
  it('says that sensitivity was not checked when no uncertainty is given', () => {
    expect(forecastOf('--topic', 'wealth', '--traditions', 'vedic')).toContain(forecast.SENSITIVITY_NOT_CHECKED);
  });
  it('lists the cells that would change, or says that none would, when an uncertainty is given', () => {
    const t = runForecast(flagsOf('--moment', 'j2000', '--from', '2026', '--to', '2027', '--topic', 'wealth', '--traditions', 'vedic', '--uncertainty', '5'), 2031);
    const section = t.slice(t.indexOf('The birth time'));
    expect(section).toMatch(/would change if the birth time were 5 minutes off|No cell of this grid would change if the birth time were 5 minutes off/);
    // The Vedic rising sign sits 1.6 minutes from a sign boundary for this sample moment, so a Vedic cell turns.
    expect(section).toContain('would change if the birth time were 5 minutes off');
  });
});

describe('overlay forecast', () => {
  const text = forecastOf();
  const lines = text.split('\n');

  it('prints the sentence once, the natal promise, the grid, a headline for each year and one closing line', () => {
    expect(count(text, FORECAST_SENTENCE)).toBe(1);
    expect(lines[0]).toBe('Forecast for wealth, 2026 to 2035');
    expect(lines[1]).toBe(FORECAST_SENTENCE);
    expect(text).toContain('The natal promise: what the chart itself says, without dates');
    expect(text).toContain('Grid (+ supports, - cautions, ~ mixed, . nothing said)');
    for (let y = 2026; y <= 2035; y++) expect(lines.filter((l) => l.startsWith(`${y}: `))).toHaveLength(1);
    for (const row of ['BaZi luck pillar', 'Vedic mahadasha', 'Western annual profection']) expect(text).toContain(row);
    expect(lines.at(-1)).toMatch(/^\d+ rules were evaluated and \d+ were not .*under --full/);
    expect(text).toContain(forecast.TEXT.ichingByPeriod);
  });

  it('is short: no statement list, no sources and no ids', () => {
    expect(lines.length).toBeLessThan(60);
    expect(text).not.toMatch(/source:|rule [a-z]+\./);
    expect(text).not.toMatch(/\b(supports|cautions|mixed|nothing-said)\b[^:]*@/);
  });

  it('says only what the phrasebook allows, in the default and the full output of every sample moment', () => {
    assertWording(text, 'j2000');
    for (const m of MOMENTS) {
      const t = runForecast(flagsOf('--moment', m.id, '--from', '2026', '--to', '2029'), 2031);
      assertWording(t, m.id);
      expect(count(t, FORECAST_SENTENCE), m.id).toBe(1);
    }
    assertWording(forecastOf('--full'), 'j2000 full');
  });

  it('--full adds the statements with rule and source, the agreement display, the rules not evaluated and the conventions', () => {
    const full = forecastOf('--full');
    expect(full.startsWith(lines.slice(0, 20).join('\n'))).toBe(true);
    expect(count(full, FORECAST_SENTENCE)).toBe(1);
    expect(full).toContain('The statements, year by year');
    expect(full).toMatch(/rule parashari\.[a-z0-9.-]+ \(.+\); source: .+/);
    expect(full).toContain('Agreement between independent groups');
    expect(full).toMatch(/The rules not evaluated \(\d+\)/);
    expect(full).toContain('bazi.topic-spouse-man');
    expect(full).toContain('The conventions used');
    expect(full).toContain('sliceEdgeDays: 15');
    expect(full).toContain(forecast.pointerLabel(6));
    // A statement that runs over years is said in full once, then named.
    expect(full).toMatch(/said in full under 2026/);
    expect(full.split('\n').length).toBeGreaterThan(300);
  });

  it('prints a qualifier under the statement it qualifies', () => {
    const t = runForecast(flagsOf('--moment', 'late-zi', '--from', '2026', '--to', '2035', '--sex', 'male', '--full'), 2031);
    expect(t).toMatch(/\n {8}qualified by \([^)]+, rule [a-z0-9.-]+\): .+/);
  });

  it('prints the closing count as the sum of what the report lists', () => {
    const json = JSON.parse(forecastOf('--json')) as { notEvaluated: unknown[] };
    const m = /(\d+) rules were evaluated and (\d+) were not/.exec(text)!;
    expect(Number(m[2])).toBe(json.notEvaluated.length);
  });

  it('--json is the report of the core, with the sentence, the grid and the headlines', () => {
    const json = JSON.parse(forecastOf('--json')) as Record<string, any>;
    expect(json.schema).toBe('overlay-forecast/1');
    expect(json.about).toBe(FORECAST_SENTENCE);
    expect(json.topic).toBe('wealth');
    expect(json.grid.years).toHaveLength(10);
    expect(json.headlines).toHaveLength(10);
    expect(json.headlines[0].headline).toBe(json.grid.headlines[0]);
    expect(json.conventions.forecast.sliceEdgeDays).toBe(15);
    expect(JSON.stringify(json)).not.toMatch(/"(confidence|probability|score|percent)"/);
  });

  it('--svg is the drawing of the grid, at the width asked for', () => {
    const svg = forecastOf('--svg', '--width', '360');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 360 ');
    expect(svg).toContain('data-caption');
    expect(svg).toContain('data-level="vedic-maha"');
  });

  it('takes the ten years starting with the current year the shell gives, and --to or --from alone', () => {
    const run = (...a: string[]): string => runForecast(flagsOf('--moment', 'j2000', ...a), 2031).split('\n')[0]!;
    expect(run()).toBe('Forecast for wealth, 2031 to 2040');
    expect(run('--to', '2040')).toBe('Forecast for wealth, 2031 to 2040');
    expect(run('--from', '2040')).toBe('Forecast for wealth, 2040 to 2049');
    expect(run('--from', '2030', '--to', '2032')).toBe('Forecast for wealth, 2030 to 2032');
  });

  it('takes another topic, and refuses an unknown one', () => {
    expect(runForecast(flagsOf('--moment', 'j2000', '--from', '2026', '--to', '2028', '--topic', 'career'), 2031).split('\n')[0]).toBe('Forecast for career, 2026 to 2028');
    expect(() => forecastOf('--topic', 'luck')).toThrow(CliError);
  });

  it('--traditions leaves the others out and keeps the I Ching line only where the I Ching is on', () => {
    const only = forecastOf('--traditions', 'bazi');
    expect(only).toContain('BaZi year pillar');
    expect(only).not.toContain('Vedic mahadasha');
    expect(only).not.toContain('Western annual profection');
    expect(only).not.toContain(forecast.TEXT.ichingByPeriod);
    expect(forecastOf('--traditions', 'bazi,iching')).toContain(forecast.TEXT.ichingByPeriod);
    expect(() => forecastOf('--traditions', 'bazi,tarot')).toThrow(/unknown tradition/);
  });

  it('never guesses the sex a BaZi chart is read as: the luck pillars are silent until it is named', () => {
    const flags = (...extra: string[]) => flagsOf('--moment', 'jiazi-1984', '--from', '2026', '--to', '2035', ...extra);
    const without = runForecast(flags(), 2031);
    expect(without).toContain(forecast.NOTE.needsLuckDirection);
    const named = runForecast(flags('--sex', 'male'), 2031);
    expect(named).not.toContain(forecast.NOTE.needsLuckDirection);
    expect(runForecast(flags('--set', 'baziSexConvention=male-chart'), 2031)).toBe(named);
    expect(() => runForecast(flags('--sex', 'male', '--set', 'baziSexConvention=female-chart'), 2031)).toThrow(/different charts/);
    expect(() => runForecast(flags('--sex', 'other'), 2031)).toThrow(CliError);
  });

  it('takes the settings of the forecast layer with --set and refuses a wrong value', () => {
    const json = JSON.parse(forecastOf('--json', '--set', 'sliceEdgeDays=0')) as Record<string, any>;
    expect(json.conventions.forecast.sliceEdgeDays).toBe(0);
    expect(() => forecastOf('--set', 'sliceEdgeDays=7')).toThrow(/not an option/);
    expect(() => forecastOf('--set', 'nothing=1')).toThrow(/unknown convention/);
  });

  it('refuses mistakes in the years and in the output kind', () => {
    expect(() => forecastOf('--json', '--svg')).toThrow(/not both/);
    expect(() => runForecast(flagsOf('--moment', 'j2000', '--from', '2030', '--to', '2020'), 2031)).toThrow(/before/);
    expect(() => runForecast(flagsOf('--moment', 'j2000', '--from', 'soon'), 2031)).toThrow(/whole number/);
    expect(() => runForecast(flagsOf('--moment', 'j2000', '--from', '2000', '--to', '2100'), 2031)).toThrow(/at most/);
    expect(() => runForecast(flagsOf('--from', '2030'), 2031)).toThrow(/give a moment/);
  });

  it('draws the forecast tracks under the timeline with --forecast, and the sentence under them', () => {
    const flags = flagsOf('--moment', 'j2000', '--forecast', 'wealth', '--from', '2026-01-01', '--years', '5');
    const svg = runForecastTimeline(flags, readMoment(flags), DEFAULT_CONVENTIONS, 2031);
    expect(svg).toContain('data-track="fc-wealth-');
    expect(svg).toContain('data-footnote');
    expect(count(svg, 'Each line is what a named rule')).toBe(1);
    expect(() => runForecastTimeline(flagsOf('--moment', 'j2000', '--forecast', 'luck'), readMoment(flags), DEFAULT_CONVENTIONS, 2031)).toThrow(/unknown topic/);
  });
});

describe('overlay window', () => {
  const run = (...argv: string[]): string => runWindow(flagsOf('--moment', 'j2000', ...argv));

  it('prints the I Ching and the Western day statements, each in its own part, with the sentence once', () => {
    const t = run('--date', '2031-03-01', '--days', '45');
    expect(count(t, FORECAST_SENTENCE)).toBe(1);
    expect(t).toContain('The character of the window 2031-03-01 to 2031-04-14 (45 days)');
    expect(t).toContain('The I Ching, read by period [experimental]');
    expect(t).toContain('Western astrology, the days a planet passes a point of the birth chart');
    expect(t).toContain(forecast.TEXT.westernWindow);
    expect(t.split('\n').filter((l) => /^ {4}2031-\d\d-\d\d {2}\d+ /.test(l)).length).toBeGreaterThanOrEqual(45);
    expect(t).toMatch(/rule lilly\.transit\.daily-cusps; source: William Lilly/);
    assertWording(t, 'window');
  });

  it('takes a window of exactly 62 days and refuses 63 with the message of the phrasebook', () => {
    expect(run('--date', '2031-03-01', '--days', '62')).toContain('(62 days)');
    expect(() => run('--date', '2031-03-01', '--days', '63')).toThrow(CliError);
    expect(() => run('--date', '2031-03-01', '--days', '63')).toThrow(forecast.windowTooLongMessage(63, 62));
    expect(() => run('--date', '2031-03-01', '--days', '400')).toThrow(/at most 62 days/);
  });

  it('refuses a missing or wrong date and a wrong length', () => {
    expect(() => run('--days', '10')).toThrow(/--date/);
    expect(() => run('--date', '1 March', '--days', '10')).toThrow(/YYYY-MM-DD/);
    expect(() => run('--date', '2031-03-01', '--days', '0')).toThrow(/at least 1/);
    expect(() => run('--date', '2031-03-01', '--days', '2.5')).toThrow(/whole number/);
  });

  it('says why the Western part is empty where the birth time is too uncertain', () => {
    const t = run('--date', '2031-03-01', '--days', '10', '--uncertainty', '300');
    expect(t).toMatch(/not available: /);
  });

  it('defaults to thirty days', () => {
    expect(run('--date', '2031-03-01')).toContain('(30 days)');
  });
});

describe('the shell', () => {
  const cli = join(dirname(fileURLToPath(import.meta.url)), '../src/index.ts');
  const shell = (...argv: string[]) => spawnSync(process.execPath, [cli, ...argv], { encoding: 'utf8' });

  it('answers a window over 62 days with the message on stderr, nothing on stdout and exit code 2', () => {
    const r = shell('window', '--moment', 'j2000', '--date', '2031-03-01', '--days', '63');
    expect(r.status).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr).toBe(`overlay: ${forecast.windowTooLongMessage(63, 62)}\n`);
  });

  it('prints the forecast of the sample moment and takes the year of its own clock only here', () => {
    const r = shell('forecast', '--moment', 'j2000');
    expect(r.status).toBe(0);
    const year = new Date().getUTCFullYear();
    expect(r.stdout.split('\n')[0]).toBe(`Forecast for wealth, ${year} to ${year + 9}`);
  });

  it('describes in its help what the tool does, and no longer says that it forecasts nothing', () => {
    const r = shell('--help');
    expect(r.stdout).toContain('forecast         what each tradition');
    expect(r.stdout).toMatch(/what each tradition's published rules say about a topic, with their source/);
    expect(r.stdout).toContain(FORECAST_SENTENCE);
    expect(r.stdout).not.toMatch(/forecasts? nothing|no forecast|not a forecast/i);
    assertWording(r.stdout, 'help');
  });
});
