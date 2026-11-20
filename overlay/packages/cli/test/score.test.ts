// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { forecast, makeMoment, MS } from '@overlay/core';
import { CliError, parseArgs } from '../src/args.ts';
import { runEvent, runFreeze, runScore, type SessionIo } from '../src/scoreCommand.ts';
import { MOMENTS } from '../../../fixtures/moments.ts';

const flagsOf = (...argv: string[]) => parseArgs(['x', ...argv]).flags;
const j2000 = MOMENTS.find((m) => m.id === 'j2000')!;
const base = makeMoment(j2000.civil, j2000.zone, j2000.place).utcMs;
const day = (n: number): number => base + n * MS.DAY;
const FILE = ['--session', 'work.session.json'];

/** One file in memory: each command reads the text the one before wrote. */
function bench() {
  let text: string | null = null;
  const io = (): SessionIo => ({ text });
  return {
    io,
    event: (nowMs: number, ...argv: string[]): string => {
      const r = runEvent(flagsOf(...FILE, ...argv), io(), nowMs);
      text = r.write ?? text;
      return r.output;
    },
    freeze: (nowMs: number, ...argv: string[]): string => {
      const r = runFreeze(flagsOf(...FILE, ...argv), io(), nowMs, 2031);
      text = r.write ?? text;
      return r.output;
    },
    score: (...argv: string[]): string => runScore(flagsOf(...FILE, ...argv), io()),
    get text() {
      return text;
    },
  };
}

const fails = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(CliError);
    return (e as Error).message;
  }
  return 'did not fail';
};

describe('overlay freeze, event and score', () => {
  it('freezes a forecast, records two events and scores them, with the header first', () => {
    const b = bench();
    expect(b.freeze(day(9500), '--moment', 'j2000', '--from', '2026', '--to', '2030')).toMatch(/^Frozen: 2026 to 2030, at 2026-/);
    expect(b.event(day(10000), '--date', '2028-03-01', '--topic', 'wealth', '--went', 'well')).toMatch(/^Recorded e1: 2028-03-01, wealth, went well\. The session holds 1 event and 1 frozen forecast\./);
    expect(b.event(day(10010), '--date', '2029-06', '--topic', 'career', '--went', 'badly')).toMatch(/^Recorded e2: 2029-06, career, went badly\./);
    const text = b.score();
    const lines = text.split('\n');
    expect(lines[0]).toBe('2 events recorded. 1 frozen forecast.');
    expect(lines[1]).toBe(forecast.SCORECARD_SENTENCE);
    expect(text).toContain('Compared with shuffled dates');
    expect(text).toContain('too few scored pairs to compare with shuffled dates');
    for (const line of lines) expect(forecast.bannedIn(line), line).toBeNull();
  });

  it('prints the same counts as JSON, beginning with the sentence', () => {
    const b = bench();
    b.freeze(day(9500), '--moment', 'j2000', '--from', '2026', '--to', '2030');
    b.event(day(10000), '--date', '2028-03-01', '--topic', 'wealth', '--went', 'well');
    const json = JSON.parse(b.score('--json'));
    expect(Object.keys(json)[0]).toBe('about');
    expect(json.about).toBe(forecast.SCORECARD_SENTENCE);
    expect(json.eventCount).toBe(1);
    expect(json.frozenCount).toBe(1);
    expect(json.events[0].status).toBe('scored');
    expect(json.comparison.tooFew).toBe(true);
    expect(JSON.stringify(json)).not.toMatch(/"(confidence|probability|score|percent|rate|ratio)"/);
  });

  it('lists an event dated before the freeze as frozen too late', () => {
    const b = bench();
    b.freeze(day(9500), '--moment', 'j2000', '--from', '2026', '--to', '2030');
    b.event(day(10000), '--date', '2020-03-01', '--topic', 'wealth', '--went', 'well');
    const text = b.score();
    expect(text).toContain('frozen too late');
    expect(text).toContain('held 0, did not hold 0, not scored 0, said nothing 0');
  });

  it('keeps a private note in the file and never prints it', () => {
    const b = bench();
    b.freeze(day(9500), '--moment', 'j2000', '--from', '2026', '--to', '2030');
    b.event(day(10000), '--date', '2028-03-01', '--topic', 'wealth', '--went', 'well', '--note', 'mine alone');
    expect(b.text).toContain('mine alone');
    expect(b.score()).not.toContain('mine alone');
    expect(b.score('--json')).not.toContain('mine alone');
  });

  it('starts a session from an event when the moment is named, and needs the moment only then', () => {
    const b = bench();
    expect(fails(() => b.event(day(10000), '--date', '2028-03-01', '--topic', 'wealth', '--went', 'well'))).toMatch(/does not exist yet/);
    b.event(day(10000), '--moment', 'j2000', '--date', '2028-03-01', '--topic', 'wealth', '--went', 'well');
    expect(JSON.parse(b.text!).events).toHaveLength(1);
    expect(b.score()).toContain('1 event recorded. 0 frozen forecasts.');
    expect(b.score()).toContain('No forecast is frozen');
  });

  it('refuses a second moment or other settings once a forecast is frozen', () => {
    const b = bench();
    b.freeze(day(9500), '--moment', 'j2000', '--from', '2026', '--to', '2030');
    expect(fails(() => b.freeze(day(9600), '--moment', 'southern', '--from', '2026', '--to', '2030'))).toBe(forecast.PINNED_MESSAGE);
    expect(fails(() => b.freeze(day(9600), '--moment', 'j2000', '--sex', 'male', '--from', '2026', '--to', '2030'))).toBe(forecast.PINNED_MESSAGE);
    expect(fails(() => b.freeze(day(9600), '--from', '2026', '--to', '2030'))).toMatch(/already frozen/);
    expect(JSON.parse(b.text!).frozen).toHaveLength(1);
  });

  it('says what is wrong when an argument is missing or cannot be read', () => {
    const b = bench();
    b.freeze(day(9500), '--moment', 'j2000', '--from', '2026', '--to', '2030');
    expect(fails(() => runScore(flagsOf(), { text: null }))).toMatch(/--session/);
    expect(fails(() => runScore(flagsOf(...FILE), { text: null }))).toMatch(/no session file/);
    expect(fails(() => runScore(flagsOf(...FILE), { text: 'not json' }))).toMatch(/not a session file/);
    expect(fails(() => b.event(day(10000), '--topic', 'wealth', '--went', 'well'))).toMatch(/--date/);
    expect(fails(() => b.event(day(10000), '--date', '2028-03-01', '--went', 'well'))).toMatch(/--topic/);
    expect(fails(() => b.event(day(10000), '--date', '2028-03-01', '--topic', 'wealth'))).toMatch(/went well/);
    expect(fails(() => b.event(day(10000), '--date', 'March 2028', '--topic', 'wealth', '--went', 'well'))).toMatch(/cannot read/);
    expect(fails(() => b.event(day(10000), '--date', '2028-03-01', '--topic', 'luck', '--went', 'well'))).toMatch(/unknown topic/);
    expect(fails(() => b.event(day(10000), '--date', '2028-03-01', '--topic', 'wealth', '--went', 'fine'))).toMatch(/went well/);
  });

  it('scores a file written by one run in another, the way the shell does', () => {
    const dir = mkdtempSync(join(tmpdir(), 'overlay-score-'));
    try {
      const file = join(dir, 'work.session.json');
      const cli = join(dirname(fileURLToPath(import.meta.url)), '../src/index.ts');
      const run = (...argv: string[]) => spawnSync(process.execPath, [cli, ...argv, '--session', file], { encoding: 'utf8' });
      const a = run('freeze', '--moment', 'j2000', '--from', '2026', '--to', '2027');
      expect(a.status, a.stderr).toBe(0);
      const b = run('event', '--date', '2026-12-31', '--topic', 'wealth', '--went', 'well');
      expect(b.status, b.stderr).toBe(0);
      const c = run('score');
      expect(c.status, c.stderr).toBe(0);
      expect(c.stdout.split('\n')[0]).toBe('1 event recorded. 1 frozen forecast.');
      expect(readFileSync(file, 'utf8')).toContain('"overlay-session/1"');
      writeFileSync(file, '{}');
      expect(run('score').status).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
