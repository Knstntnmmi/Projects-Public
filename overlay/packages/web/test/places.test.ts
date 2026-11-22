// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The place search: matching, what choosing a city does to the form, the offset on a date, and
 * the sanity of the shipped list. The list is read from the file the page ships with; there is no network.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createPlaceForm } from '../src/placeForm.ts';
import { fold } from '../src/places/fold.ts';
import { buildPlaces, describePlace, formatCoordinates, loadPlaces, offsetOnDate, searchPlaces, type Civil, type CityData, type Place } from '../src/places/search.ts';

const civil = (y: number, mo: number, d: number, h = 12): Civil => ({ year: y, month: mo, day: d, hour: h, minute: 0, second: 0 });
const labels = (places: Place[]): string[] => places.map((p) => p.label);

let places: Place[] = [];
let raw: CityData;
beforeAll(async () => {
  places = await loadPlaces();
  raw = (await import('../src/places/cities.json')).default as unknown as CityData;
});

describe('folding', () => {
  it('ignores case and accents and maps letters that do not decompose', () => {
    expect(fold('MÜNCHEN')).toBe('munchen');
    expect(fold('São Paulo')).toBe('sao paulo');
    expect(fold('Łódź')).toBe('lodz');
    expect(fold('Straße')).toBe('strasse');
    expect(fold('Reykjavík')).toBe('reykjavik');
  });
});

describe('searching', () => {
  it('lists Munich, Germany first for "mun", whatever the case', () => {
    expect(labels(searchPlaces(places, 'mun'))[0]).toBe('Munich, Germany');
    expect(labels(searchPlaces(places, 'MUN'))[0]).toBe('Munich, Germany');
    expect(searchPlaces(places, 'mun').length).toBeGreaterThan(3);
  });

  it('ignores accents in the query and in the names', () => {
    expect(labels(searchPlaces(places, 'münchen'))).toContain('Munich, Germany');
    expect(labels(searchPlaces(places, 'munchen'))).toContain('Munich, Germany');
    expect(labels(searchPlaces(places, 'sao paulo'))[0]).toMatch(/^São Paulo, /);
    expect(labels(searchPlaces(places, 'koln'))[0]).toMatch(/^Köln, /);
  });

  it('matches common alternate names', () => {
    expect(labels(searchPlaces(places, 'moscou'))).toContain('Moscow, Russia');
    expect(labels(searchPlaces(places, 'praga'))).toContain('Prague, Czechia');
    expect(labels(searchPlaces(places, 'napoles'))).toContain('Naples, Italy');
  });

  it('shows the country, and the region where namesakes share a country', () => {
    const springfields = labels(searchPlaces(places, 'springfield'));
    expect(springfields.length).toBeGreaterThan(3);
    expect(new Set(springfields).size).toBe(springfields.length);
    for (const l of springfields) expect(l).toMatch(/^Springfield, [^,]+, United States$/);
    const paris = labels(searchPlaces(places, 'paris'));
    expect(paris).toContain('Paris, France');
    expect(paris).toContain('Paris, United States');
    expect(labels(searchPlaces(places, 'san jose'))).toContain('San Jose, United States');
  });

  it('narrows by country or region after a comma', () => {
    expect(labels(searchPlaces(places, 'springfield, ill'))).toEqual(['Springfield, Illinois, United States']);
    expect(labels(searchPlaces(places, 'paris, fr'))[0]).toBe('Paris, France');
    expect(searchPlaces(places, 'munich, japan')).toEqual([]);
  });

  it('returns nothing for an empty or unmatched query, and at most the limit', () => {
    expect(searchPlaces(places, '')).toEqual([]);
    expect(searchPlaces(places, '   ')).toEqual([]);
    expect(searchPlaces(places, 'qqqqxz')).toEqual([]);
    expect(searchPlaces(places, 'a', 5)).toHaveLength(5);
  });

  it('puts a whole-name match before longer names that begin with it', () => {
    expect(labels(searchPlaces(places, 'tokyo'))[0]).toBe('Tokyo, Japan');
  });
});

describe('the offset on a date', () => {
  it('follows daylight saving in a zone that has it', () => {
    expect(offsetOnDate('Europe/Berlin', civil(2001, 7, 1))).toBe(120);
    expect(offsetOnDate('Europe/Berlin', civil(2001, 1, 15))).toBe(60);
    expect(offsetOnDate('America/New_York', civil(2001, 7, 1))).toBe(-240);
    expect(offsetOnDate('America/New_York', civil(2001, 1, 15))).toBe(-300);
    expect(offsetOnDate('Australia/Sydney', civil(2001, 1, 15))).toBe(660);
    expect(offsetOnDate('Australia/Sydney', civil(2001, 7, 1))).toBe(600);
  });

  it('is constant in a zone without daylight saving', () => {
    expect(offsetOnDate('Asia/Tokyo', civil(2001, 7, 1))).toBe(540);
    expect(offsetOnDate('Asia/Tokyo', civil(2001, 1, 15))).toBe(540);
    expect(offsetOnDate('Asia/Kolkata', civil(2001, 7, 1))).toBe(330);
  });

  it('is in the line shown for the chosen city, for the date entered', () => {
    const munich = searchPlaces(places, 'munich')[0]!;
    expect(describePlace(munich, civil(2001, 7, 1))).toBe('Munich, Germany · 48.14° N, 11.58° E · Europe/Berlin (UTC+02:00 on that date)');
    expect(describePlace(munich, civil(2001, 1, 15))).toContain('UTC+01:00 on that date');
    expect(describePlace(munich, null)).toBe('Munich, Germany · 48.14° N, 11.58° E · Europe/Berlin');
  });

  it('writes south and west as such', () => {
    expect(formatCoordinates(-33.87, -70.65)).toBe('33.87° S, 70.65° W');
  });
});

/** A stand-in for the three fields, the date and the two lines of the form. */
function fakeForm(when: Civil | null = civil(2001, 7, 1)) {
  const f = { lat: '51.4779', lon: '0', zone: 'UTC', line: '', query: '', changes: 0 };
  const form = createPlaceForm({
    setPlace(latitude, longitude, zone) {
      f.lat = String(latitude);
      f.lon = String(longitude);
      f.zone = zone;
      f.changes++;
    },
    civil: () => when,
    coordinates: () => (f.lat === '' || f.lon === '' ? null : { latitude: Number(f.lat), longitude: Number(f.lon) }),
    showLine: (t) => void (f.line = t),
    showQuery: (t) => void (f.query = t),
  });
  return { f, form };
}

describe('choosing a city', () => {
  it('fills latitude, longitude and zone, and says what was set', () => {
    const { f, form } = fakeForm();
    form.reset();
    expect(f.line).toBe('Coordinates in use: 51.48° N, 0.00° E (a sample moment, or entered by hand).');
    form.choose(searchPlaces(places, 'tokyo')[0]!);
    expect([f.lat, f.lon, f.zone]).toEqual(['35.69', '139.69', 'Asia/Tokyo']);
    expect(f.query).toBe('Tokyo, Japan');
    expect(f.line).toBe('Tokyo, Japan · 35.69° N, 139.69° E · Asia/Tokyo (UTC+09:00 on that date)');
    expect(f.changes).toBe(1);
    expect(form.chosen()?.name).toBe('Tokyo');
  });

  it('shows the offset of the date entered after the date changes', () => {
    let when = civil(2001, 7, 1);
    const f = { line: '' };
    const form = createPlaceForm({ setPlace() {}, civil: () => when, coordinates: () => null, showLine: (t) => void (f.line = t), showQuery() {} });
    form.choose(searchPlaces(places, 'munich')[0]!);
    expect(f.line).toContain('UTC+02:00');
    when = civil(2001, 1, 15);
    form.refresh();
    expect(f.line).toContain('UTC+01:00');
  });

  it('forgets the city when the coordinates or the zone are edited by hand', () => {
    const { f, form } = fakeForm();
    form.choose(searchPlaces(places, 'munich')[0]!);
    f.lat = '10';
    form.editedByHand();
    expect(form.chosen()).toBeNull();
    expect(f.query).toBe('');
    expect(f.line).toBe('Coordinates in use: 10.00° N, 11.58° E (a sample moment, or entered by hand).');
  });

  it('forgets the city when another moment is loaded', () => {
    const { f, form } = fakeForm();
    form.choose(searchPlaces(places, 'munich')[0]!);
    form.reset();
    expect(form.chosen()).toBeNull();
    expect(f.query).toBe('');
  });

  it('says nothing about coordinates that are not numbers', () => {
    const { f, form } = fakeForm();
    f.lat = '';
    form.reset();
    expect(f.line).toBe('');
  });
});

describe('the shipped list', () => {
  it('is large and well formed', () => {
    expect(places.length).toBeGreaterThan(20000);
    expect(raw.source).toContain('CC BY 4.0');
    for (const col of [raw.country, raw.zone, raw.lat, raw.lon]) expect(col).toHaveLength(raw.names.length);
  });

  it('has coordinates within range and a zone and country for every city', () => {
    for (const p of places) {
      expect(Math.abs(p.latitude), p.label).toBeLessThanOrEqual(90);
      expect(Math.abs(p.longitude), p.label).toBeLessThanOrEqual(180);
      expect(p.country, p.label).not.toBe('');
      expect(p.name, p.label).not.toBe('');
    }
  });

  it('names only time zones that this runtime accepts, and reads each at a summer and a winter date', () => {
    const zones = [...new Set(places.map((p) => p.zone))];
    expect(zones.length).toBeGreaterThan(300);
    for (const zone of zones) {
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: zone }), zone).not.toThrow();
      for (const month of [1, 7]) expect(Number.isFinite(offsetOnDate(zone, civil(2001, month, 15))), zone).toBe(true);
    }
  });

  it('puts known cities where they are', () => {
    const near = (q: string, lat: number, lon: number, zone: string): void => {
      const p = searchPlaces(places, q)[0]!;
      expect(Math.abs(p.latitude - lat), q).toBeLessThan(0.3);
      expect(Math.abs(p.longitude - lon), q).toBeLessThan(0.3);
      expect(p.zone, q).toBe(zone);
    };
    near('munich', 48.14, 11.58, 'Europe/Berlin');
    near('tokyo', 35.69, 139.69, 'Asia/Tokyo');
    near('sydney', -33.87, 151.21, 'Australia/Sydney');
    near('quito', -0.23, -78.52, 'America/Guayaquil');
  });

  it('builds from the columns', () => {
    const tiny: CityData = { source: 'x', countries: ['Aland'], zones: ['UTC'], names: ['Ab'], country: [0], zone: [0], lat: [150], lon: [-250], regions: {}, alternates: { '0': 'Cd|Ef' } };
    expect(buildPlaces(tiny)[0]).toMatchObject({ label: 'Ab, Aland', latitude: 1.5, longitude: -2.5, keys: ['ab', 'cd', 'ef'] });
  });
});
