// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The only moments that tests, examples and documentation may use.
 *
 * Every entry is synthetic: an astronomical or computing epoch, or an instant built to
 * sit on a boundary. None is anyone's birth data, and none may ever be added that is.
 */
import type { CivilTime, Place } from '../packages/core/src/substrate/time.ts';

export interface FixtureMoment {
  id: string;
  why: string;
  civil: CivilTime;
  zone: string;
  place: Place;
}

const GREENWICH: Place = { latitude: 51.4779, longitude: 0 };
const BEIJING: Place = { latitude: 39.9042, longitude: 116.4074 };
const QUITO: Place = { latitude: -0.1807, longitude: -78.4678 };
const SYDNEY: Place = { latitude: -33.8688, longitude: 151.2093 };
const URUMQI: Place = { latitude: 43.8256, longitude: 87.6168 };
const NEW_YORK: Place = { latitude: 40.7128, longitude: -74.006 };

const at = (year: number, month: number, day: number, hour: number, minute = 0, second = 0): CivilTime => ({
  year,
  month,
  day,
  hour,
  minute,
  second,
});

export const MOMENTS: readonly FixtureMoment[] = [
  { id: 'j2000', why: 'The J2000.0 astronomical epoch.', civil: at(2000, 1, 1, 12), zone: 'UTC', place: GREENWICH },
  { id: 'unix-epoch', why: 'The Unix epoch.', civil: at(1970, 1, 1, 0), zone: 'UTC', place: GREENWICH },
  { id: 'jiazi-1984', why: 'Noon on the day after Lichun 1984, inside the first year of the current sixty-year cycle.', civil: at(1984, 2, 5, 12), zone: '+08:00', place: BEIJING },
  { id: 'late-zi', why: 'A reading at 23:30, where the two day-boundary conventions give different day pillars.', civil: at(2001, 9, 9, 23, 30), zone: '+08:00', place: BEIJING },
  { id: 'lichun-eve-2024', why: 'Two minutes before Lichun 2024, where the year and month pillars are about to change.', civil: at(2024, 2, 4, 16, 25), zone: '+08:00', place: BEIJING },
  { id: 'lichun-after-2024', why: 'Two minutes after Lichun 2024.', civil: at(2024, 2, 4, 16, 29), zone: '+08:00', place: BEIJING },
  { id: 'china-dst-1988', why: 'A summer afternoon during China\'s 1986 to 1991 daylight saving, where civil and standard time differ by an hour.', civil: at(1988, 7, 1, 13, 30), zone: 'Asia/Shanghai', place: BEIJING },
  { id: 'far-west-zone', why: 'Urumqi on Beijing time: the civil clock runs about two hours ahead of the Sun.', civil: at(2010, 3, 3, 10, 30), zone: '+08:00', place: URUMQI },
  { id: 'equator', why: 'An equatorial place, for the ascendant and house arithmetic.', civil: at(2012, 12, 21, 6, 0), zone: '-05:00', place: QUITO },
  { id: 'southern', why: 'A southern-hemisphere place in local summer.', civil: at(2020, 1, 15, 18, 45), zone: 'Australia/Sydney', place: SYDNEY },
  { id: 'skipped-hour', why: 'A wall-clock time that never existed: clocks in New York jumped from 02:00 to 03:00.', civil: at(2021, 3, 14, 2, 30), zone: 'America/New_York', place: NEW_YORK },
  { id: 'repeated-hour', why: 'A wall-clock time that occurred twice: clocks in New York fell back from 02:00 to 01:00.', civil: at(2021, 11, 7, 1, 30), zone: 'America/New_York', place: NEW_YORK },
  { id: 'eot-extreme', why: 'Early November, when the equation of time is near its maximum of about sixteen minutes.', civil: at(2015, 11, 3, 12, 53), zone: 'UTC', place: GREENWICH },
];

export function fixture(id: string): FixtureMoment {
  const m = MOMENTS.find((x) => x.id === id);
  if (!m) throw new Error(`unknown fixture moment: ${id}`);
  return m;
}
