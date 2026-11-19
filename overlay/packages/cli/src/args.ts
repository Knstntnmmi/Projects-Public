// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Reading the command line: flags, the moment, the conventions. Errors are thrown as CliError
 * and turned into a message and an exit code only in the shell, so that every command can be
 * tested without leaving the process.
 */
import { CONVENTION_SPECS, DEFAULT_CONVENTIONS, forecast, makeMoment, type Conventions, type Moment, type Sex } from '@overlay/core';
import { MOMENTS } from '../../../fixtures/moments.ts';

/** A mistake in what the person typed: printed once, with exit code 2. */
export class CliError extends Error {}

export interface Args {
  command: string;
  flags: Map<string, string[]>;
}

export type Flags = Map<string, string[]>;

export function parseArgs(argv: string[]): Args {
  const flags: Flags = new Map();
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

export function fail(message: string): never {
  throw new CliError(message);
}

/** Both families of settings a person may override with --set: the engine's and the forecast layer's. */
export interface Settings {
  engine: Conventions;
  forecast: Partial<forecast.ForecastConventions>;
}

export function readSettings(flags: Flags): Settings {
  const engine: Record<string, unknown> = { ...DEFAULT_CONVENTIONS };
  const own: Record<string, unknown> = {};
  for (const pair of flags.get('set') ?? []) {
    const [key, raw] = pair.split('=');
    const spec = CONVENTION_SPECS.find((s) => s.key === key);
    const fspec = forecast.FORECAST_CONVENTION_SPECS.find((s) => s.key === key);
    const chosen = spec ?? fspec;
    if (!chosen || raw === undefined) fail(`unknown convention "${pair}". Run "overlay conventions" for the list.`);
    const option = chosen.options.find((o) => String(o.value) === raw);
    if (!option) fail(`"${raw}" is not an option for ${key}. Choices: ${chosen.options.map((o) => o.value).join(', ')}`);
    if (spec) engine[key!] = option.value;
    else own[key!] = option.value;
  }
  return { engine: engine as unknown as Conventions, forecast: own as Partial<forecast.ForecastConventions> };
}

export function readConventions(flags: Flags): Conventions {
  return readSettings(flags).engine;
}

export function readMoment(flags: Flags): Moment {
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

export function readSex(flags: Flags): Sex | undefined {
  const s = flags.get('sex')?.[0];
  if (s === undefined) return undefined;
  if (s !== 'male' && s !== 'female') fail('--sex must be male or female');
  return s;
}
