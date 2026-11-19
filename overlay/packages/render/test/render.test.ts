// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import { buildRings, CREDIT, DEFAULT_CONVENTIONS, makeMoment } from '@overlay/core';
import { timelineFor, wheelFor } from '../src/index.ts';
import { fixture, MOMENTS } from '../../../fixtures/moments.ts';

const YEAR = 365.2425 * 86_400_000;

/** A crude well-formedness check: every opened element is closed, in order. */
function balanced(svg: string): boolean {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|[^>"])*?)(\/?)>/g)) {
    const [, close, name, , selfClose] = m;
    if (selfClose) continue;
    if (close) {
      if (stack.pop() !== name) return false;
    } else stack.push(name!);
  }
  return stack.length === 0;
}

describe('wheel', () => {
  it('draws every default ring, the seven planets and both angles, for every sample moment', () => {
    for (const f of MOMENTS) {
      const m = makeMoment(f.civil, f.zone, f.place);
      const svg = wheelFor(m, DEFAULT_CONVENTIONS, { legend: true });
      expect(balanced(svg), f.id).toBe(true);
      expect(svg, f.id).not.toMatch(/NaN|undefined|Infinity/);
      for (const r of buildRings(m.utcMs, DEFAULT_CONVENTIONS).filter((x) => x.defaultVisible)) expect(svg).toContain(`data-ring="${r.id}"`);
      for (const id of ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'node', 'asc', 'mc']) expect(svg).toContain(`data-marker="${id}"`);
    }
  });

  it('draws only the rings asked for, in either orientation', () => {
    const f = fixture('j2000');
    const m = makeMoment(f.civil, f.zone, f.place);
    for (const orientation of ['western', 'chinese'] as const) {
      const svg = wheelFor(m, DEFAULT_CONVENTIONS, { visible: ['terms', 'fuxi', 'bounds'], orientation });
      expect([...svg.matchAll(/data-ring="([^"]+)"/g)].map((x) => x[1])).toEqual(['terms', 'fuxi', 'bounds']);
      expect(balanced(svg)).toBe(true);
    }
    expect(wheelFor(m, DEFAULT_CONVENTIONS, { orientation: 'western' })).not.toBe(wheelFor(m, DEFAULT_CONVENTIONS, { orientation: 'chinese' }));
  });
});

describe('timeline', () => {
  it('draws every track at every zoom, well formed', () => {
    const f = fixture('jiazi-1984');
    const m = makeMoment(f.civil, f.zone, f.place);
    for (const years of [90, 30, 10, 3, 1]) {
      const svg = timelineFor(m, DEFAULT_CONVENTIONS, { startUtcMs: m.utcMs + 20 * YEAR, endUtcMs: m.utcMs + (20 + years) * YEAR, sex: 'male', title: `${years} years` });
      expect(balanced(svg), String(years)).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      expect(svg).toContain('data-track="bazi-luck"');
      expect(svg.includes('data-track="gua-qi"')).toBe(years <= 3);
    }
  });
});

describe('attribution', () => {
  it('is carried by every drawing, visibly and as metadata', () => {
    const f = fixture('j2000');
    const m = makeMoment(f.civil, f.zone, f.place);
    for (const svg of [wheelFor(m), timelineFor(m, DEFAULT_CONVENTIONS, { startUtcMs: m.utcMs, endUtcMs: m.utcMs + 10 * YEAR })]) {
      expect(svg).toContain(`<metadata>${CREDIT}</metadata>`);
      expect(svg.split(CREDIT).length).toBe(3);
    }
  });
});
