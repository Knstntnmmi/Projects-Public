// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Converts the GeoNames city dump into the compact list the place search ships with.
 *
 *   node scripts/buildPlaces.ts <dir>
 *
 * <dir> holds cities15000.txt (from cities15000.zip), countryInfo.txt and
 * admin1CodesASCII.txt, all from https://download.geonames.org/export/dump/ . GeoNames
 * data is licensed CC BY 4.0 (https://www.geonames.org/); see NOTICE. The output is
 * packages/web/src/places/cities.json: parallel columns, one entry per city, largest first,
 * coordinates in hundredths of a degree. Run this by hand when the list should be
 * refreshed; the build and the tests only read the output.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fold } from '../packages/web/src/places/fold.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/buildPlaces.ts <directory with the GeoNames files>');

/** The cities of a million or more carry more alternates (English forms such as Cologne, Moscow, Munich), the others fewer. */
const MAX_ALTERNATES = (pop: number): number => (pop >= 1_000_000 ? 10 : 3);
/** Alternate names are carried only for cities at least this large; the others match on their own name. */
const ALTERNATES_FROM_POPULATION = 300_000;
const read = (name: string): string[] => readFileSync(join(dir, name), 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));

const countryName = new Map<string, string>();
for (const l of read('countryInfo.txt')) {
  const f = l.split('\t');
  countryName.set(f[0]!, f[4]!);
}
const regionName = new Map<string, string>();
for (const l of read('admin1CodesASCII.txt')) {
  const f = l.split('\t');
  regionName.set(f[0]!, f[1]!);
}

interface Raw { name: string; ascii: string; alts: string[]; lat: number; lon: number; cc: string; region: string; pop: number; tz: string }
const raw: Raw[] = read('cities15000.txt').map((l) => {
  const f = l.split('\t');
  return {
    name: f[1]!,
    ascii: f[2]!,
    alts: (f[3] ?? '').split(',').filter(Boolean),
    lat: Number(f[4]),
    lon: Number(f[5]),
    cc: f[8]!,
    region: regionName.get(`${f[8]}.${f[10]}`) ?? '',
    pop: Number(f[14]),
    tz: f[17]!,
  };
});

// A region is written only where it tells two cities of one name and country apart.
const seen = new Map<string, number>();
for (const r of raw) seen.set(`${fold(r.name)}|${r.cc}`, (seen.get(`${fold(r.name)}|${r.cc}`) ?? 0) + 1);

/** How alike two folded names are, 0 to 1 (Dice coefficient on letter pairs); it picks the alternates that spell the name differently over translations that share nothing with it. */
function alike(a: string, b: string): number {
  const pairs = (x: string): string[] => Array.from({ length: Math.max(0, x.length - 1) }, (_, i) => x.slice(i, i + 2));
  const pa = pairs(a);
  const pb = pairs(b);
  if (!pa.length || !pb.length) return 0;
  let hit = 0;
  const rest = [...pb];
  for (const p of pa) {
    const at = rest.indexOf(p);
    if (at >= 0) {
      hit++;
      rest.splice(at, 1);
    }
  }
  return (2 * hit) / (pa.length + pb.length);
}

const countries: string[] = [];
const zones: string[] = [];
const idx = (list: string[], v: string): number => {
  const i = list.indexOf(v);
  if (i >= 0) return i;
  list.push(v);
  return list.length - 1;
};
/** Hundredths of a degree, about one kilometre. */
const hundredths = (x: number): number => Math.round(x * 100);

raw.sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name));
const names: string[] = [];
const country: number[] = [];
const zone: number[] = [];
const lat: number[] = [];
const lon: number[] = [];
const regions: Record<number, string> = {};
const alternates: Record<number, string> = {};
raw.forEach((r, i) => {
  const own = new Set([fold(r.name), fold(r.ascii)]);
  let alts: string[] = [];
  if (r.pop >= ALTERNATES_FROM_POPULATION) {
    for (const a of r.alts) {
      const k = fold(a);
      if (!/^[a-z0-9][a-z0-9 '.-]*$/.test(k) || own.has(k) || k.length > 30 || (k.includes(' ') && !fold(r.name).includes(' ')) || /^[A-Z]{2,4}$/.test(a)) continue;
      own.add(k);
      alts.push(a);
    }
    const base = fold(r.name);
    alts = alts.sort((x, y) => alike(fold(y), base) - alike(fold(x), base)).slice(0, MAX_ALTERNATES(r.pop));
  }
  names.push(r.name);
  country.push(idx(countries, countryName.get(r.cc) ?? r.cc));
  zone.push(idx(zones, r.tz));
  lat.push(hundredths(r.lat));
  lon.push(hundredths(r.lon));
  if ((seen.get(`${fold(r.name)}|${r.cc}`) ?? 0) > 1 && r.region) regions[i] = r.region;
  if (alts.length) alternates[i] = alts.join('|');
});

const out = join(root, 'packages/web/src/places/cities.json');
writeFileSync(out, JSON.stringify({ source: 'GeoNames cities15000, CC BY 4.0, https://www.geonames.org/', countries, zones, names, country, zone, lat, lon, regions, alternates }) + '\n');
console.log(`${names.length} cities, ${countries.length} countries, ${zones.length} zones -> ${out}`);
