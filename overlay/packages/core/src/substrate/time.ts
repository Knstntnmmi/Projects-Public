// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Time substrate: the single place where a civil clock reading becomes an instant,
 * and where an instant becomes each of the clocks that the systems read.
 *
 * Four clocks are distinguished because calculators silently disagree about which
 * one the hour of birth is read from:
 *   civil     the wall clock of the zone, including any daylight-saving shift
 *   standard  the wall clock with the daylight-saving shift removed
 *   lmt       local mean time: UTC plus four minutes per degree of east longitude
 *   apparent  true (apparent) solar time: local mean time plus the equation of time
 */
import * as Astronomy from 'astronomy-engine';

export interface Place {
  /** Degrees, north positive. */
  latitude: number;
  /** Degrees, east positive. */
  longitude: number;
}

export interface CivilTime {
  year: number;
  /** 1 to 12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface Moment {
  /** The instant, in milliseconds since the Unix epoch (UTC). */
  utcMs: number;
  /** IANA zone name ("Asia/Shanghai"), "UTC", or a fixed offset ("+08:00"). */
  zone: string;
  place: Place;
  /** Notes produced while resolving the civil time (skipped or repeated hours). */
  notes: string[];
}

export type TimeBasis = 'civil' | 'standard' | 'lmt' | 'apparent';

const MS_PER_MIN = 60_000;
const MS_PER_DAY = 86_400_000;

/** Milliseconds for proleptic-Gregorian UTC fields, safe for years below 100. */
export function utcMsFromFields(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(hour, minute, 0, 0);
  return d.getTime() + second * 1000;
}

export function fieldsFromUtcMs(ms: number): CivilTime {
  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds() + d.getUTCMilliseconds() / 1000,
  };
}

/** Parses "+08:00", "-0330", "UTC+8", "Z" and "UTC" into minutes east of Greenwich. */
export function parseFixedOffset(zone: string): number | null {
  const z = zone.trim();
  if (z === 'UTC' || z === 'Z' || z === 'GMT') return 0;
  const m = /^(?:UTC|GMT)?([+-])(\d{1,2})(?::?(\d{2}))?(?::?(\d{2}))?$/.exec(z);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const h = Number(m[2]);
  const mi = Number(m[3] ?? 0);
  const s = Number(m[4] ?? 0);
  return sign * (h * 60 + mi + s / 60);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      calendar: 'gregory',
      hourCycle: 'h23',
      era: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(zone, f);
  }
  return f;
}

/**
 * Offset of the zone's wall clock from UTC at the given instant, in minutes east.
 * The value comes from the tz database shipped with the JavaScript runtime, so the
 * historical record (for example China's daylight saving of 1986 to 1991) is only as
 * good as that database.
 */
export function zoneOffsetMinutes(utcMs: number, zone: string): number {
  const fixed = parseFixedOffset(zone);
  if (fixed !== null) return fixed;
  // Whole seconds only: the formatter cannot express milliseconds.
  const whole = Math.floor(utcMs / 1000) * 1000;
  const parts = formatterFor(zone).formatToParts(new Date(whole));
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? NaN);
  let year = get('year');
  const era = parts.find((p) => p.type === 'era')?.value ?? 'AD';
  if (era.startsWith('B')) year = 1 - year;
  const asUtc = utcMsFromFields(year, get('month'), get('day'), get('hour'), get('minute'), get('second'));
  return (asUtc - whole) / MS_PER_MIN;
}

/**
 * The zone's standard (non daylight-saving) offset in the calendar year of the instant.
 * Daylight saving always moves the clock forward, so the smaller of the January and
 * July offsets is taken as standard time. A zone that changed its standard offset in
 * the middle of that year is beyond this heuristic, and the result should then be
 * checked by hand.
 */
export function standardOffsetMinutes(utcMs: number, zone: string): number {
  const fixed = parseFixedOffset(zone);
  if (fixed !== null) return fixed;
  const year = new Date(utcMs).getUTCFullYear();
  const jan = zoneOffsetMinutes(utcMsFromFields(year, 1, 1, 12), zone);
  const jul = zoneOffsetMinutes(utcMsFromFields(year, 7, 1, 12), zone);
  const now = zoneOffsetMinutes(utcMs, zone);
  return Math.min(jan, jul, now);
}

/** Resolves a wall-clock reading in a zone to an instant. */
export function civilToUtcMs(civil: CivilTime, zone: string): { utcMs: number; notes: string[] } {
  const naive = utcMsFromFields(civil.year, civil.month, civil.day, civil.hour, civil.minute, civil.second);
  const fixed = parseFixedOffset(zone);
  if (fixed !== null) return { utcMs: naive - fixed * MS_PER_MIN, notes: [] };

  const before = zoneOffsetMinutes(naive - MS_PER_DAY, zone);
  const after = zoneOffsetMinutes(naive + MS_PER_DAY, zone);
  const candidates = [...new Set([before, after])].map((o) => naive - o * MS_PER_MIN);
  const valid = candidates.filter((c) => {
    const o = zoneOffsetMinutes(c, zone);
    return Math.abs(c + o * MS_PER_MIN - naive) < 1000;
  });
  if (valid.length === 1) return { utcMs: valid[0]!, notes: [] };
  if (valid.length > 1) {
    return {
      utcMs: Math.min(...valid),
      notes: [
        'This wall-clock time occurred twice (clocks were set back). The earlier occurrence was used.',
      ],
    };
  }
  return {
    utcMs: naive - before * MS_PER_MIN,
    notes: [
      'This wall-clock time did not exist (clocks were set forward across it). The offset in force before the change was used.',
    ],
  };
}

export function makeMoment(civil: CivilTime, zone: string, place: Place): Moment {
  const { utcMs, notes } = civilToUtcMs(civil, zone);
  return { utcMs, zone, place, notes };
}

export function momentFromUtc(utcMs: number, zone: string, place: Place): Moment {
  return { utcMs, zone, place, notes: [] };
}

/** Julian Date (UT) of an instant. */
export function julianDate(utcMs: number): number {
  return utcMs / MS_PER_DAY + 2440587.5;
}

/** Julian Day Number of a calendar date (the integer that labels the day at its noon). */
export function julianDayNumber(year: number, month: number, day: number): number {
  return Math.round(utcMsFromFields(year, month, day, 12) / MS_PER_DAY + 2440587.5);
}

export function astroTime(utcMs: number): Astronomy.AstroTime {
  return Astronomy.MakeTime(new Date(utcMs));
}

/** Delta T (TT minus UT) in seconds, as modelled by the astronomy engine. */
export function deltaTSeconds(utcMs: number): number {
  const t = astroTime(utcMs);
  return (t.tt - t.ut) * 86400;
}

/**
 * Equation of time in minutes: apparent solar time minus mean solar time.
 * Computed from first principles as the Greenwich hour angle of the true Sun
 * (apparent sidereal time minus the Sun's apparent right ascension of date).
 */
export function equationOfTimeMinutes(utcMs: number): number {
  const time = astroTime(utcMs);
  const gastHours = Astronomy.SiderealTime(time);
  const eqj = Astronomy.GeoVector(Astronomy.Body.Sun, time, true);
  const eqd = Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(time), eqj);
  const raHours = Astronomy.EquatorFromVector(eqd).ra;
  const utHours = (((utcMs % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY) / 3_600_000;
  let diff = gastHours - raHours + 12 - utHours;
  diff = ((((diff + 12) % 24) + 24) % 24) - 12;
  return diff * 60;
}

/** Offset from UTC, in minutes, of the clock named by the basis. */
export function basisOffsetMinutes(moment: Moment, basis: TimeBasis): number {
  switch (basis) {
    case 'civil':
      return zoneOffsetMinutes(moment.utcMs, moment.zone);
    case 'standard':
      return standardOffsetMinutes(moment.utcMs, moment.zone);
    case 'lmt':
      return moment.place.longitude * 4;
    case 'apparent':
      return moment.place.longitude * 4 + equationOfTimeMinutes(moment.utcMs);
  }
}

/** The reading of the named clock at the moment, as calendar fields. */
export function clockReading(moment: Moment, basis: TimeBasis): CivilTime {
  return fieldsFromUtcMs(moment.utcMs + basisOffsetMinutes(moment, basis) * MS_PER_MIN);
}

/** Adds calendar years, months and days (then hours and minutes) to wall-clock fields. */
export function addCalendar(
  civil: CivilTime,
  add: { years?: number; months?: number; days?: number; hours?: number; minutes?: number },
): CivilTime {
  const monthsTotal = civil.year * 12 + (civil.month - 1) + (add.years ?? 0) * 12 + (add.months ?? 0);
  const year = Math.floor(monthsTotal / 12);
  const month = (monthsTotal % 12) + 1;
  const ms =
    utcMsFromFields(year, month, 1, civil.hour, civil.minute, civil.second) +
    (civil.day - 1 + (add.days ?? 0)) * MS_PER_DAY +
    (add.hours ?? 0) * 3_600_000 +
    (add.minutes ?? 0) * MS_PER_MIN;
  return fieldsFromUtcMs(ms);
}

export function formatCivil(c: CivilTime): string {
  const p = (n: number, w = 2): string => String(Math.floor(n)).padStart(w, '0');
  return `${p(c.year, 4)}-${p(c.month)}-${p(c.day)} ${p(c.hour)}:${p(c.minute)}:${p(c.second)}`;
}

export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = Math.floor(abs - h * 60);
  const s = Math.round((abs - h * 60 - m) * 60);
  const p = (n: number): string => String(n).padStart(2, '0');
  return s ? `${sign}${p(h)}:${p(m)}:${p(s)}` : `${sign}${p(h)}:${p(m)}`;
}

export const MS = { MIN: MS_PER_MIN, HOUR: 3_600_000, DAY: MS_PER_DAY } as const;
