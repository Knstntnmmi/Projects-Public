// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import { forecast } from '@overlay/core';
import { GENERATED, sampleScorecardDoc, sampleSession } from '../../../scripts/generate.ts';

const doc = sampleScorecardDoc();

describe('the generated sample scorecard', () => {
  it('is among the generated files and is labelled as invented in its first line', () => {
    expect(GENERATED.map((g) => g.path)).toContain('docs/SAMPLE-SCORECARD.md');
    expect(doc.split('\n')[0]).toMatch(/invented/);
  });
  it('is made from the constructed moment and fourteen invented events', () => {
    const s = sampleSession();
    expect(s.events).toHaveLength(14);
    expect(s.frozen).toHaveLength(2);
    expect(doc).toContain('`j2000`');
    expect(doc).toContain('14 events recorded. 2 frozen forecasts.');
    expect(doc).toContain(forecast.SCORECARD_SENTENCE);
  });
  it('says nothing banned and gives no percentage', () => {
    for (const line of doc.split('\n')) expect(forecast.bannedIn(line), line).toBeNull();
    expect(doc).not.toMatch(/significan/i);
  });
});
