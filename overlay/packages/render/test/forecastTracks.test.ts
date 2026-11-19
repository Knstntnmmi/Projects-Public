// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import { forecast } from '@overlay/core';
import { renderTimeline, PALETTE_DARK, PALETTE_LIGHT } from '../src/index.ts';
import { input, registry } from '../../core/test/forecast/synthetic.ts';

describe('forecast tracks on the existing timeline renderer', () => {
  const result = forecast.evaluate(input(), { registry: registry(), runs: 20 });
  const tracks = forecast.forecastTracks(result, 'wealth');

  it('draw as ordinary tracks, with a colour for every tone', () => {
    const svg = renderTimeline(tracks, { startUtcMs: result.span.startUtcMs, endUtcMs: result.span.endUtcMs, title: 'A synthetic forecast' });
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    for (const tone of ['supports', 'cautions', 'mixed']) {
      expect(svg).toContain(`t-${tone}`);
      expect(PALETTE_LIGHT[tone]).toBeTruthy();
      expect(PALETTE_DARK[tone]).toBeTruthy();
    }
    expect(svg).toContain('Agreement between independent clocks');
    expect(svg.match(/<svg/g)).toHaveLength(1);
  });

  it('are not fed to the seam finder: seams stay descriptions of calendar arithmetic', () => {
    expect(tracks.every((t) => t.id.startsWith('fc-'))).toBe(true);
  });
});
