// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Guards for the promises made in PRIVACY.md and NOTICE. They read the repository
 * itself, so they fail when someone breaks a promise, not when someone notices.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GENERATED } from '../../../scripts/generate.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.git')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(root);
const rel = (p: string): string => relative(root, p).replace(/\\/g, '/');
const sources = files.filter((p) => /packages\/[^/]+\/src\/.*\.(ts|css)$|packages\/web\/index\.html$/.test(rel(p)));

describe('privacy', () => {
  it('no source file can reach the network, storage or the address bar', () => {
    const forbidden: Array<[RegExp, string]> = [
      [/\bfetch\s*\(/, 'fetch'],
      [/XMLHttpRequest/, 'XMLHttpRequest'],
      [/sendBeacon/, 'sendBeacon'],
      [/\bnew\s+(WebSocket|EventSource|Worker|SharedWorker)\b/, 'sockets or workers'],
      [/\b(localStorage|sessionStorage|indexedDB)\b/, 'browser storage'],
      [/document\.cookie/, 'cookies'],
      [/history\.(pushState|replaceState)/, 'address bar history'],
      [/location\.(hash|search|href)\s*=/, 'address bar'],
      [/<(script|link|img|iframe)[^>]+(src|href)=["']https?:/, 'third-party resources'],
      [/@import\s+url\(|url\(\s*["']?https?:/, 'remote styles or fonts'],
      [/node:(http|https|net|dgram|dns|tls)\b/, 'node networking'],
    ];
    expect(sources.length).toBeGreaterThan(20);
    for (const p of sources) {
      const text = readFileSync(p, 'utf8');
      for (const [pattern, what] of forbidden) expect(pattern.test(text), `${rel(p)} uses ${what}`).toBe(false);
    }
  });

  it('no source file builds a global name from pieces to get round the patterns above', () => {
    for (const p of sources) {
      const text = readFileSync(p, 'utf8');
      expect(/\b(globalThis|window|self)\s*\[/.test(text), `${rel(p)} looks a global up by a computed name`).toBe(false);
      expect(/\beval\s*\(|new\s+Function\s*\(/.test(text), `${rel(p)} runs code from a string`).toBe(false);
    }
  });

  it('no test is skipped, narrowed to one case or left as a to-do', () => {
    const tests = files.filter((p) => /packages\/[^/]+\/test\/.*\.test\.ts$/.test(rel(p)) && !rel(p).endsWith('guards.test.ts'));
    expect(tests.length).toBeGreaterThan(20);
    for (const p of tests) expect(/\b(it|test|describe)\.(skip|only|todo)\b/.test(readFileSync(p, 'utf8')), `${rel(p)} skips or narrows a test`).toBe(false);
  });

  it('the built page forbids network requests through its content security policy', () => {
    const config = readFileSync(join(root, 'packages/web/vite.config.ts'), 'utf8');
    expect(config).toContain("connect-src 'none'");
    expect(config).toContain("form-action 'none'");
  });

  it('literal date-times with a place live only in the reviewed sample file', () => {
    // No test can prove that a date is not somebody's birthday. What can be enforced is
    // that there is exactly one file in which a full moment may be written down, so that
    // there is exactly one file to review.
    // A date-time written out as fields: a three- or four-digit year followed by a month.
    const literal = /\byear:\s*-?\d{3,4}\s*,\s*month:/;
    const offenders = files
      .filter((p) => /\.(ts|md|html|json)$/.test(p))
      .map(rel)
      .filter((p) => p !== 'fixtures/moments.ts' && !p.startsWith('fixtures/golden/') && p !== 'package-lock.json')
      .filter((p) => literal.test(readFileSync(join(root, p), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('the sample moments each say why they exist', () => {
    const text = readFileSync(join(root, 'fixtures/moments.ts'), 'utf8');
    expect(text).toMatch(/None is anyone's birth data/);
    expect((text.match(/\bwhy: '/g) ?? []).length).toBe((text.match(/\bid: '/g) ?? []).length);
  });
});

describe('attribution and licence', () => {
  it('every source file carries the licence identifier and the credit', () => {
    const headed = files.filter((p) => /\.(ts|css)$/.test(p) || rel(p) === 'packages/web/index.html');
    for (const p of headed) {
      const head = readFileSync(p, 'utf8').slice(0, 400);
      expect(head, rel(p)).toContain('SPDX-License-Identifier: AGPL-3.0-or-later');
      expect(head, rel(p)).toContain('Copyright (C) 2026 Knstntnmmi');
    }
  });

  it('the licence, notice and package metadata agree', () => {
    expect(readFileSync(join(root, 'LICENSE'), 'utf8')).toContain('GNU AFFERO GENERAL PUBLIC LICENSE');
    expect(readFileSync(join(root, 'NOTICE'), 'utf8')).toContain('Knstntnmmi');
    for (const p of files.filter((f) => f.endsWith('package.json'))) {
      expect(JSON.parse(readFileSync(p, 'utf8')).license, rel(p)).toBe('AGPL-3.0-or-later');
    }
  });
});

describe('generated files', () => {
  it('are up to date with the code (run `npm run generate` if this fails)', () => {
    for (const g of GENERATED) {
      expect(readFileSync(join(root, g.path), 'utf8'), g.path).toBe(g.content());
    }
  });
});

describe('forecast privacy', () => {
  const text = (p: string): string => readFileSync(p, 'utf8');
  const forecastSources = sources.filter((p) => rel(p).startsWith('packages/core/src/forecast/'));

  it('session files are ignored by git', () => {
    expect(text(join(root, '.gitignore')).split('\n')).toContain('*.session.json');
  });

  it('the session marker appears in no data file, document or other source file', () => {
    const allowed = new Set(['packages/core/src/forecast/session.ts', 'packages/core/src/forecast/BINDINGS.md']);
    const offenders = files
      .map(rel)
      .filter((p) => /\.(ts|md|html|json)$/.test(p) && p !== 'package-lock.json' && !allowed.has(p) && !/\/test\//.test(p))
      .filter((p) => text(join(root, p)).includes('overlay-session/'));
    expect(offenders).toEqual([]);
  });

  it('no event is written as a date-time anywhere but the synthetic event file', () => {
    // Events are built from day offsets of the sample moments; a literal instant would be somebody's day.
    const literal = /\b(utcMs|enteredAtUtcMs|UtcMs):\s*-?\d{9,}/;
    const offenders = files
      .map(rel)
      .filter((p) => /\.(ts|md|html|json)$/.test(p) && p !== 'fixtures/events.ts' && p !== 'package-lock.json' && !p.startsWith('fixtures/golden/'))
      .filter((p) => literal.test(text(join(root, p))));
    expect(offenders).toEqual([]);
  });

  it('the forecast code does no input or output of its own', () => {
    expect(forecastSources.length).toBeGreaterThan(15);
    const forbidden: Array<[RegExp, string]> = [
      [/\bconsole\./, 'logging'],
      [/\b(window|document|navigator|location)\.[a-zA-Z]/, 'the browser'],
      [/\bprocess\./, 'the process'],
      [/from\s+['"]node:/, 'a Node module'],
      [/\brequire\s*\(/, 'require'],
      [/\bBuffer\b/, 'Buffer'],
      [/\b(readFile|writeFile)\w*\s*\(/, 'files'],
      [/URLSearchParams|new\s+URL\(/, 'the address'],
    ];
    for (const p of forecastSources) for (const [pattern, what] of forbidden) expect(pattern.test(text(p)), `${rel(p)} uses ${what}`).toBe(false);
  });

  it('no test logs anything', () => {
    for (const p of files.map(rel).filter((x) => /packages\/[^/]+\/test\/.*\.ts$/.test(x))) expect(/\bconsole\./.test(text(join(root, p))), p).toBe(false);
  });
});
