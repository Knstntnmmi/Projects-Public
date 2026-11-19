// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { forecast } from '@overlay/core';
import { FORECAST_SENTENCE } from '../src/index.ts';
import { GENERATED, SAMPLE_FORECAST, sampleForecastDoc } from '../../../scripts/generate.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const doc = sampleForecastDoc();

describe('the generated sample forecast', () => {
  it('is among the generated files, so that the freshness test covers it', () => {
    const paths = GENERATED.map((g) => g.path);
    expect(paths).toContain('docs/SAMPLE-FORECAST.md');
    expect(paths).toContain('docs/img/forecast-grid.svg');
    expect(readFileSync(join(root, 'docs/SAMPLE-FORECAST.md'), 'utf8')).toBe(doc);
  });

  it('is the same text every time and reads no clock', () => {
    expect(sampleForecastDoc()).toBe(doc);
    const source = readFileSync(join(root, 'scripts/generate.ts'), 'utf8');
    expect(source).not.toMatch(/Date\.now|new Date\(\)|performance\.now/);
  });

  it('has the required parts, in order', () => {
    const heads = doc.split('\n').filter((l) => l.startsWith('#'));
    expect(heads[0]).toBe('# A sample forecast: wealth, 2026 to 2035');
    const order = ['The natal promise', 'The grid', 'The year headlines', 'The statements of 2026, 2027, 2028', 'The rules not evaluated', 'The conventions used', 'How to reproduce it'];
    let at = -1;
    for (const h of order) {
      const i = heads.findIndex((x) => x.startsWith(`## ${h}`));
      expect(i, h).toBeGreaterThan(at);
      at = i;
    }
    expect(doc.split(FORECAST_SENTENCE).length - 1).toBe(1);
    expect(doc).toContain('![');
    expect(doc).toContain('img/forecast-grid.svg');
    expect(doc).toContain(SAMPLE_FORECAST.command);
  });

  it('has a headline for each of the ten years and statements for the first three only', () => {
    for (let y = 2026; y <= 2035; y++) expect(doc).toMatch(new RegExp(`^- ${y}: `, 'm'));
    expect(doc).toMatch(/^2026$/m);
    expect(doc).toMatch(/^2028$/m);
    expect(doc).not.toMatch(/^2029$/m);
    expect(doc).toContain('source: ');
  });

  it('lists the rules not evaluated with their reasons, and the conventions used', () => {
    expect(doc).toMatch(/- bazi\.topic-spouse-man .*needs the sex the chart is read as/);
    expect(doc).toContain('- `sliceEdgeDays`: 15');
    expect(doc).toContain('- `baziSexConvention`: none');
  });

  it('uses only the constructed sample moment and the words the phrasebook allows', () => {
    expect(doc).toContain('`j2000`');
    for (const line of doc.split('\n')) {
      expect(forecast.bannedIn(line), line).toBeNull();
      if (!line.includes('not a prediction of death') && !line.includes('secret diseases')) expect(forecast.MORTALITY_WORDS.test(line.replace(/\bCancer\b/g, 'the Crab')), line).toBe(false);
    }
  });
});
