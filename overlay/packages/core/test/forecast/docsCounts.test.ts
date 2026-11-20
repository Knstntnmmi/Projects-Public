// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_REGISTRY, report } from '../../src/forecast/index.ts';

// The readme states how many rules each tradition has; the registry is the source of those numbers.
const readme = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../../README.md'), 'utf8');
const T = ['bazi', 'vedic', 'western', 'iching'] as const;
const run = (sex: 'male' | null) => report(DEFAULT_REGISTRY, { traditions: T, sex, birthTimeUncertaintyMinutes: 0, birthTimeLimitMinutes: 60 });

describe('rule counts stated in the readme', () => {
  const rows: Record<string, string> = { bazi: '| BaZi |', vedic: '| Vedic |', western: '| Western |', iching: '| I Ching |' };
  for (const t of T) {
    it(`${t}: total, bound, bound with a sex convention`, () => {
      const line = readme.split('\n').find((l) => l.startsWith(rows[t]!))!;
      const cells = line.split('|').map((c) => c.trim());
      const [total, bound, withSex] = [cells[2], cells[3], cells[4]].map(Number);
      expect(total).toBe(run(null).counts[t].total);
      expect(bound).toBe(run(null).counts[t].bound);
      expect(withSex).toBe(run('male').counts[t].bound);
    });
  }
  it('held back entries', () => {
    const n = T.reduce((s, t) => s + run(null).counts[t].heldBack, 0);
    expect(readme).toContain(`A further ${n} rules, tables and single clauses were held back`);
  });
});
