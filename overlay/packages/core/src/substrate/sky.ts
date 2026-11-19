// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Sky substrate: where things are on the ecliptic, as seen from the centre of the Earth,
 * measured from the true equinox of date (the tropical zodiac's zero point).
 */
import * as Astronomy from 'astronomy-engine';
import { astroTime, julianDate, type Place } from './time.ts';

export const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;
export type Planet = (typeof PLANETS)[number];

const BODY: Record<Planet, Astronomy.Body> = {
  Sun: Astronomy.Body.Sun,
  Moon: Astronomy.Body.Moon,
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
};

export function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/** Signed difference a minus b, folded into the range -180 to 180. */
export function angleDiff(a: number, b: number): number {
  return norm360(a - b + 180) - 180;
}

/** Apparent geocentric ecliptic longitude of date, in degrees. */
export function longitudeOf(planet: Planet, utcMs: number): number {
  const time = astroTime(utcMs);
  if (planet === 'Sun') return Astronomy.SunPosition(time).elon;
  const vec = Astronomy.GeoVector(BODY[planet], time, true);
  return Astronomy.Ecliptic(vec).elon;
}

export function latitudeOf(planet: Planet, utcMs: number): number {
  const time = astroTime(utcMs);
  if (planet === 'Sun') return Astronomy.SunPosition(time).elat;
  return Astronomy.Ecliptic(Astronomy.GeoVector(BODY[planet], time, true)).elat;
}

/** Daily motion in longitude (degrees per day); negative means retrograde. */
export function speedOf(planet: Planet, utcMs: number): number {
  const h = 3_600_000;
  return angleDiff(longitudeOf(planet, utcMs + h), longitudeOf(planet, utcMs - h)) * 12;
}

/** Longitude of the Moon's mean ascending node (Meeus, Astronomical Algorithms, ch. 47). */
export function meanNodeLongitude(utcMs: number): number {
  const T = (astroTime(utcMs).tt) / 36525;
  return norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T * T * T) / 467441 - (T * T * T * T) / 60616000);
}

/** Mean obliquity of the ecliptic in degrees (IAU 2006 polynomial). */
export function meanObliquity(utcMs: number): number {
  const T = astroTime(utcMs).tt / 36525;
  const arcsec =
    84381.406 - 46.836769 * T - 0.0001831 * T * T + 0.0020034 * T * T * T - 5.76e-7 * T ** 4 - 4.34e-8 * T ** 5;
  return arcsec / 3600;
}

/** Local apparent sidereal time in degrees (the right ascension of the meridian). */
export function localSiderealDegrees(utcMs: number, longitude: number): number {
  return norm360(Astronomy.SiderealTime(astroTime(utcMs)) * 15 + longitude);
}

export interface Angles {
  ascendant: number;
  midheaven: number;
  /** Right ascension of the midheaven, degrees. */
  ramc: number;
  obliquity: number;
}

const RAD = Math.PI / 180;

/** Ascendant and Midheaven as tropical ecliptic longitudes. */
export function angles(utcMs: number, place: Place): Angles {
  const ramc = localSiderealDegrees(utcMs, place.longitude);
  const eps = meanObliquity(utcMs);
  const th = ramc * RAD;
  const e = eps * RAD;
  const phi = place.latitude * RAD;
  const midheaven = norm360(Math.atan2(Math.sin(th), Math.cos(th) * Math.cos(e)) / RAD);
  const ascendant = norm360(
    Math.atan2(Math.cos(th), -(Math.sin(th) * Math.cos(e) + Math.tan(phi) * Math.sin(e))) / RAD,
  );
  return { ascendant, midheaven, ramc, obliquity: eps };
}

/** Altitude above the horizon, in degrees, of the ecliptic point at the given longitude. */
export function eclipticPointAltitude(longitude: number, utcMs: number, place: Place): number {
  const e = meanObliquity(utcMs) * RAD;
  const l = longitude * RAD;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l));
  const dec = Math.asin(Math.sin(e) * Math.sin(l));
  const ha = localSiderealDegrees(utcMs, place.longitude) * RAD - ra;
  const phi = place.latitude * RAD;
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha)) / RAD;
}

/** True altitude of the Sun's centre, in degrees, without refraction. */
export function sunAltitude(utcMs: number, place: Place): number {
  const time = astroTime(utcMs);
  const observer = new Astronomy.Observer(place.latitude, place.longitude, 0);
  const eq = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
  return Astronomy.Horizon(time, observer, eq.ra, eq.dec).altitude;
}

/**
 * The next instant after `afterMs` at which the Sun's apparent longitude equals the target.
 *
 * The root finder underneath needs a bracket that holds exactly one crossing, so the
 * crossing is first estimated from the Sun's mean motion (which is never more than two
 * days out over any stretch of the year) and then searched for in a window of a few
 * days around the estimate.
 */
export function nextSunLongitude(target: number, afterMs: number): number {
  const DAY = 86_400_000;
  const wanted = norm360(target);
  const gap = norm360(wanted - Astronomy.SunPosition(astroTime(afterMs + 1)).elon);
  const estimateDays = gap / 0.9856473;
  const fromDays = Math.max(0, estimateDays - 6);
  const start = astroTime(afterMs + 1 + fromDays * DAY);
  const t = Astronomy.SearchSunLongitude(wanted, start, estimateDays - fromDays + 6);
  if (!t) throw new Error(`Sun longitude search failed for ${target} degrees after ${new Date(afterMs).toISOString()}`);
  return t.date.getTime();
}

/** Sunrise or sunset next after the instant; null inside the polar day or night. */
export function nextSunEvent(kind: 'rise' | 'set', afterMs: number, place: Place): number | null {
  const observer = new Astronomy.Observer(place.latitude, place.longitude, 0);
  const t = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, kind === 'rise' ? +1 : -1, astroTime(afterMs), 2);
  return t ? t.date.getTime() : null;
}

/**
 * Finds the instant in (lo, hi] at which a discrete-valued function of time changes,
 * given that f(lo) differs from f(hi). Resolution is one second.
 */
export function bisectChange<T>(f: (ms: number) => T, lo: number, hi: number): number {
  const a = f(lo);
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (f(mid) === a) lo = mid;
    else hi = mid;
  }
  return hi;
}

export { julianDate };
