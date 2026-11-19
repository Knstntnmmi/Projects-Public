// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Regenerates the files that are derived from the code: the two reference documents and
 * the published test vectors. Run with `npm run generate`. A test fails if any of them
 * is out of date, so they cannot drift from the engine.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONVENTION_SPECS, DEFAULT_CONVENTIONS, type Conventions } from '../packages/core/src/conventions.ts';
import { CORRESPONDENCES } from '../packages/core/src/correspondences.ts';
import { facts } from '../packages/core/src/facts.ts';
import { solarTermInstant, SOLAR_TERMS } from '../packages/core/src/substrate/terms.ts';
import { makeMoment } from '../packages/core/src/substrate/time.ts';
import { fourPillars, luck } from '../packages/core/src/systems/bazi/index.ts';
import { timelineFor, wheelFor } from '../packages/render/src/index.ts';
import { MOMENTS } from '../fixtures/moments.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function conventionsDoc(): string {
  const out: string[] = [
    '# Conventions',
    '',
    'Generated from `packages/core/src/conventions.ts` by `npm run generate`. Do not edit by hand.',
    '',
    'Two calculators can both be right and still print different charts, because each has made choices that it does not announce. This engine makes every such choice a named setting. Each result records the settings that produced it, and the sensitivity report recomputes the result under every alternative.',
    '',
  ];
  for (const spec of CONVENTION_SPECS) {
    out.push(`## ${spec.title}`, '', `Setting \`${spec.key}\`. Affects: ${spec.affects}.`, '', spec.why, '', '| Value | Meaning | Default |', '| --- | --- | --- |');
    for (const o of spec.options) out.push(`| \`${o.value}\` | ${o.label}. ${o.description} | ${o.value === DEFAULT_CONVENTIONS[spec.key] ? 'yes' : ''} |`);
    out.push('');
  }
  out.push(
    '## Choices that are not yet settings',
    '',
    'These are fixed in this version, and are listed so that nobody mistakes them for facts. The year pillar turns at Lichun only; the lunar-new-year and winter-solstice year boundaries are not offered. Solar terms are always the true-Sun terms, although the Chinese calendar used mean-time terms before 1645, so pillars for earlier dates follow the modern rule and not the rule in force at the time. Houses are whole-sign, the lunar node is the mean node, triplicity lords are the Dorothean set and bounds the Egyptian set; the Ptolemaic tables that William Lilly printed are not included yet. Hidden stems follow the common modern table. Vimshottari years are 365.25 days.',
    '',
  );
  return out.join('\n');
}

export function correspondencesDoc(): string {
  const out: string[] = [
    '# Correspondences between systems',
    '',
    'Generated from `packages/core/src/correspondences.ts` by `npm run generate`. Do not edit by hand.',
    '',
    'Links between systems are asserted everywhere and graded almost nowhere. Each one here carries a grade. *Exact* means the two things have the same boundaries by definition or arithmetic. *Structural* means one arrangement is a stated transformation of the other. *Historical* means the link was once an observation and has since been frozen into a count that no longer follows the sky. *Loose* means a resemblance of number or theme whose boundaries do not coincide. *Coincidence* means a numerical near-match with no shown common origin.',
    '',
  ];
  for (const c of CORRESPONDENCES) {
    out.push(
      `## ${c.between[0]} and ${c.between[1]}`,
      '',
      `Grade: **${c.grade}**${c.verifiedHere ? ' (checked by the test suite)' : ' (stated from the literature, not checked here)'}.`,
      '',
      `${c.claim} ${c.detail}`,
      '',
      `Sources: ${c.sources.join('; ')}.`,
      '',
    );
  }
  return out.join('\n');
}

/** Four pillars of every sample moment under every combination of the two conventions that bear on them. */
export function pillarVectors(): unknown {
  const bases = ['civil', 'standard', 'lmt', 'apparent'] as const;
  const boundaries = ['zi23', 'midnight'] as const;
  return {
    about:
      'Four Pillars of synthetic moments under each combination of clock basis and day boundary. Year and month pillars turn at the true-Sun Lichun and jie. Use these to check another calculator, convention by convention. None of these moments is anyone\'s birth data.',
    vectors: MOMENTS.map((f) => {
      const moment = makeMoment(f.civil, f.zone, f.place);
      const results: Record<string, string> = {};
      for (const timeBasis of bases) {
        for (const dayBoundary of boundaries) {
          const conventions: Conventions = { ...DEFAULT_CONVENTIONS, timeBasis, dayBoundary };
          const p = fourPillars(moment, conventions);
          results[`${timeBasis}/${dayBoundary}`] = `${p.year.hanzi} ${p.month.hanzi} ${p.day.hanzi} ${p.hour.hanzi}`;
        }
      }
      const l = (sex: 'male' | 'female') => {
        const x = luck(moment, DEFAULT_CONVENTIONS, sex);
        return { direction: x.forward ? 'forward' : 'backward', startAge: x.startAge, first: x.pillars[0]!.cycle.hanzi };
      };
      return {
        id: f.id,
        why: f.why,
        civil: f.civil,
        zone: f.zone,
        latitude: f.place.latitude,
        longitude: f.place.longitude,
        utc: new Date(moment.utcMs).toISOString(),
        pillars: results,
        luckUnderDefaults: { male: l('male'), female: l('female') },
      };
    }),
  };
}

/** Solar-term instants to the second, 2020 to 2030. */
export function termVectors(): unknown {
  const years: Record<string, Record<string, string>> = {};
  for (let y = 2020; y <= 2030; y++) {
    years[y] = Object.fromEntries(SOLAR_TERMS.map((t) => [t.pinyin, new Date(Math.round(solarTermInstant(y, t.index) / 1000) * 1000).toISOString().replace('.000Z', 'Z')]));
  }
  return {
    about:
      'Instants (UTC, to the second) at which the Sun\'s apparent geocentric longitude reaches 315 + 15k degrees, grouped by the Lichun-to-Lichun year they belong to, so Xiaohan and Dahan fall in the following January.',
    years,
  };
}

/** Rounds every number so that the stored document does not depend on the last bits of a floating-point library. */
export function stable(value: unknown): unknown {
  if (typeof value === 'number') return Number.isInteger(value) ? value : Math.round(value * 100) / 100;
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stable(v)]));
  return value;
}

export function exampleFacts(): unknown {
  const f = MOMENTS.find((m) => m.id === 'j2000')!;
  return stable(facts(makeMoment(f.civil, f.zone, f.place), { sex: 'female', uncertaintyMinutes: 10 }));
}

function sample(): ReturnType<typeof makeMoment> {
  const f = MOMENTS.find((m) => m.id === 'j2000')!;
  return makeMoment(f.civil, f.zone, f.place);
}

export const GENERATED: Array<{ path: string; content: () => string }> = [
  { path: 'docs/img/wheel-j2000.svg', content: () => `${wheelFor(sample(), DEFAULT_CONVENTIONS, { legend: true, title: 'The J2000 epoch read across seven rings' })}\n` },
  {
    path: 'docs/img/timeline-j2000.svg',
    content: () => {
      const m = sample();
      return `${timelineFor(m, DEFAULT_CONVENTIONS, { startUtcMs: m.utcMs, endUtcMs: m.utcMs + 90 * 365.2425 * 86_400_000, sex: 'female', title: 'Ninety years from the J2000 epoch, every track on one axis' })}\n`;
    },
  },
  { path: 'docs/CONVENTIONS.md', content: conventionsDoc },
  { path: 'docs/CORRESPONDENCES.md', content: correspondencesDoc },
  { path: 'fixtures/golden/pillars.json', content: () => `${JSON.stringify(pillarVectors(), null, 2)}\n` },
  { path: 'fixtures/golden/solar-terms.json', content: () => `${JSON.stringify(termVectors(), null, 2)}\n` },
  { path: 'fixtures/golden/facts-j2000.json', content: () => `${JSON.stringify(exampleFacts(), null, 2)}\n` },
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const g of GENERATED) {
    const target = join(root, g.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, g.content());
    process.stdout.write(`wrote ${g.path}\n`);
  }
}
