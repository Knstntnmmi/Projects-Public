// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The new or full Moon that last came before a moment (the prenatal lunation of Valens,
 * Anthologies V.2), found from the engine's own longitudes of the Sun and Moon.
 */
import { longitudeOf } from '../../substrate/sky.ts';
import { MS } from '../../substrate/time.ts';

export interface Syzygy {
  kind: 'new' | 'full';
  utcMs: number;
  /** Sign index (0 to 11) of the Moon at that instant. */
  signIndex: number;
}

const norm360 = (x: number): number => ((x % 360) + 360) % 360;
const signed = (x: number): number => {
  const d = norm360(x);
  return d > 180 ? d - 360 : d;
};
const elongation = (ms: number): number => norm360(longitudeOf('Moon', ms) - longitudeOf('Sun', ms));

/**
 * The elongation of the Moon from the Sun grows by about 12 degrees a day; the last new Moon
 * is when it was 0, the last full Moon when it was 180, whichever is the more recent. The
 * instant is found by Newton steps on the signed distance from the target, which converge in
 * a handful of steps because the elongation is nearly linear over a month.
 */
export function prenatalSyzygy(utcMs: number): Syzygy {
  const e = elongation(utcMs);
  const target = e < 180 ? 0 : 180;
  let t = utcMs - ((e - target) / 12.19) * MS.DAY;
  for (let i = 0; i < 12; i++) {
    const err = signed(elongation(t) - target);
    if (Math.abs(err) < 1e-7) break;
    t -= (err / 12.19) * MS.DAY;
  }
  return { kind: target === 0 ? 'new' : 'full', utcMs: t, signIndex: Math.floor(norm360(longitudeOf('Moon', t)) / 30) % 12 };
}
