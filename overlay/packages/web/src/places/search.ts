// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The place search: a list of cities shipped with the page (cities.json, from GeoNames, CC BY 4.0),
 * matched by prefix, ignoring case and accents, with no network request. The list is loaded
 * lazily, from a local chunk, the first time the reader uses the field.
 */
import { formatOffset, makeMoment, zoneOffsetMinutes } from '@overlay/core';
import { fold } from './fold.ts';

/** The shape of cities.json: parallel columns, one entry per city, largest first; coordinates in hundredths of a degree. */
export interface CityData {
  source: string;
  countries: string[];
  zones: string[];
  names: string[];
  country: number[];
  zone: number[];
  lat: number[];
  lon: number[];
  /** City index to region name, written only where it tells two cities of one name and country apart. */
  regions: Record<string, string>;
  /** City index to alternate names, separated by "|". */
  alternates: Record<string, string>;
}

export interface Place {
  name: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
  /** IANA time zone name. */
  zone: string;
  /** "Munich, Germany", or "Springfield, Illinois, United States" where the region is needed. */
  label: string;
  /** Folded name followed by folded alternate names. */
  keys: string[];
  /** Folded country and region, for queries such as "paris, tex". */
  tail: string[];
}

export function buildPlaces(data: CityData): Place[] {
  return data.names.map((name, i) => {
    const country = data.countries[data.country[i]!]!;
    const region = data.regions[i] ?? '';
    const alternates = data.alternates[i] ? data.alternates[i]!.split('|') : [];
    return {
      name,
      country,
      region,
      latitude: data.lat[i]! / 100,
      longitude: data.lon[i]! / 100,
      zone: data.zones[data.zone[i]!]!,
      label: region ? `${name}, ${region}, ${country}` : `${name}, ${country}`,
      keys: [fold(name), ...alternates.map(fold)],
      tail: [fold(country), ...(region ? [fold(region)] : [])],
    };
  });
}

let loading: Promise<Place[]> | null = null;

/** Loads the bundled list once. The import is of a local chunk of the page, not a request to another host. */
export function loadPlaces(): Promise<Place[]> {
  loading ??= import('./cities.json').then((m) => buildPlaces((m as unknown as { default: CityData }).default));
  return loading;
}

const startsWord = (key: string, q: string): boolean => key.startsWith(q) || key.includes(` ${q}`) || key.includes(`-${q}`);

/** Lower is better: 0 whole name, 1 start of the name, 2 start of another name, 3 later word, 4 inside the name. */
function rank(place: Place, q: string): number {
  let best = 99;
  place.keys.forEach((key, i) => {
    const r = key === q ? (i === 0 ? 0 : 2) : key.startsWith(q) ? (i === 0 ? 1 : 2) : startsWord(key, q) ? (i === 0 ? 3 : 4) : i === 0 && q.length >= 3 && key.includes(q) ? 5 : 99;
    if (r < best) best = r;
  });
  return best;
}

/** Up to `limit` places for what the reader has typed. Ties keep the list's order, which is the larger city first. */
export function searchPlaces(places: readonly Place[], query: string, limit = 8): Place[] {
  const [head = '', ...rest] = fold(query).split(',');
  const q = head.trim();
  const tail = rest.join(',').trim();
  if (!q) return [];
  const hits: Array<{ place: Place; r: number; i: number }> = [];
  places.forEach((place, i) => {
    if (tail && !place.tail.some((t) => startsWord(t, tail))) return;
    const r = rank(place, q);
    if (r < 99) hits.push({ place, r, i });
  });
  return hits.sort((a, b) => a.r - b.r || a.i - b.i).slice(0, limit).map((h) => h.place);
}

export interface Civil {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The zone's offset from UTC, in minutes east, on that civil date and time, with daylight saving as the runtime's time zone data has it. */
export function offsetOnDate(zone: string, civil: Civil): number {
  const utcMs = makeMoment(civil, zone, { latitude: 0, longitude: 0 }).utcMs;
  return zoneOffsetMinutes(utcMs, zone);
}

export function formatCoordinates(latitude: number, longitude: number): string {
  return `${Math.abs(latitude).toFixed(2)}° ${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(longitude).toFixed(2)}° ${longitude >= 0 ? 'E' : 'W'}`;
}

/** The one line shown under the field: "Munich, Germany · 48.14° N, 11.58° E · Europe/Berlin (UTC+02:00 on that date)". */
export function describePlace(place: Place, civil: Civil | null): string {
  const zone = civil ? `${place.zone} (UTC${formatOffset(offsetOnDate(place.zone, civil))} on that date)` : place.zone;
  return `${place.label} · ${formatCoordinates(place.latitude, place.longitude)} · ${zone}`;
}
