// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BANNED_WORDS,
  GLOSSARY,
  GLOSSARY_GROUPS,
  GLOSSARY_HEADING,
  GLOSSARY_OWN_WORDING,
  glossaryLines,
  glossaryMarkdown,
  glossaryNames,
  glossaryTermsIn,
} from '../../src/forecast/index.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** A cited source names its author or its newsletter issue, and gives a page, except a project page, which has none. */
const CITATION = /^((Lackner|Kalinowski|Smith|Burton-Rose)\b.* pp?\. \d|fate no\. \d+, pp?\. \d|IKGF project page of [A-Z][a-z]+ [A-Z][a-z]+$)/;

describe('the glossary data', () => {
  it('is not empty and gives each entry a term, a definition and a source', () => {
    expect(GLOSSARY.length).toBeGreaterThan(100);
    for (const e of GLOSSARY) {
      expect(e.term.trim(), 'term').not.toBe('');
      expect(e.definition.trim(), e.term).not.toBe('');
      expect(e.source.trim(), e.term).not.toBe('');
      expect(GLOSSARY_GROUPS, e.term).toContain(e.group);
    }
  });

  it('names each term once', () => {
    const seen = new Set<string>();
    for (const e of GLOSSARY) {
      const key = e.term.toLowerCase();
      expect(seen.has(key), e.term).toBe(false);
      seen.add(key);
    }
  });

  it('takes every source from a citation or from the exact words "the project\'s own wording"', () => {
    expect(GLOSSARY_OWN_WORDING).toBe("the project's own wording");
    for (const e of GLOSSARY) expect(e.source === GLOSSARY_OWN_WORDING || CITATION.test(e.source), `${e.term}: ${e.source}`).toBe(true);
    expect(GLOSSARY.some((e) => e.source !== GLOSSARY_OWN_WORDING)).toBe(true);
  });

  it('uses none of the words the phrasebook bans', () => {
    for (const e of GLOSSARY) {
      expect(BANNED_WORDS.test(e.term), e.term).toBe(false);
      expect(BANNED_WORDS.test(e.definition), e.term).toBe(false);
    }
  });

  it('keeps the four words of the forecast, and no others, as the words of the forecast', () => {
    const words = GLOSSARY.filter((e) => e.group === 'The words of the forecast').slice(0, 4).map((e) => e.term);
    expect(words).toEqual(['supports', 'cautions', 'mixed', 'nothing said']);
  });
});

describe('docs/GLOSSARY.md', () => {
  it('is in step with the data file', () => {
    expect(readFileSync(join(root, 'docs/GLOSSARY.md'), 'utf8')).toBe(glossaryMarkdown());
  });

  it('has one row for each entry', () => {
    const rows = glossaryMarkdown().split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Term') && !l.startsWith('| ---'));
    expect(rows).toHaveLength(GLOSSARY.length);
  });
});

describe('finding the terms in a text', () => {
  const terms = (text: string): string[] => glossaryTermsIn(text).map((e) => e.term);

  it('does not mind case', () => {
    expect(terms('HEXAGRAM and Trigram')).toEqual(expect.arrayContaining(['hexagram', 'trigram']));
    expect(terms('hexagram')).toEqual(terms('HeXaGrAm'));
  });

  it('finds a term under any of its names, and by its original', () => {
    expect(terms('the xiantian order')).toContain('Fu Xi circle, xiantian, Former Heaven');
    expect(terms('a Former Heaven sequence')).toContain('Fu Xi circle, xiantian, Former Heaven');
    expect(terms('先天图')).toContain('Fu Xi circle, xiantian, Former Heaven');
  });

  it('does not find a term inside a longer word, and finds nothing in a text without terms', () => {
    expect(terms('Hexagrams')).not.toContain('hexagram');
    expect(terms('a leveller')).not.toContain('level');
    expect(terms('nothing here to define: 1 2 3')).toEqual([]);
  });

  it('lists the entries in the order of the file, each once', () => {
    const found = glossaryTermsIn('trigram hexagram trigram supports');
    expect(found.map((e) => e.term)).toEqual(GLOSSARY.filter((e) => found.includes(e)).map((e) => e.term));
    expect(new Set(found).size).toBe(found.length);
  });

  it('keeps every name usable as written', () => {
    for (const e of GLOSSARY) for (const n of glossaryNames(e)) expect(glossaryTermsIn(n), `${e.term}: ${n}`).toContain(e);
  });

  it('prints the list as lines under one heading, with the source, and nothing for no terms', () => {
    expect(glossaryLines([])).toEqual([]);
    const lines = glossaryLines(glossaryTermsIn('hexagram'));
    expect(lines[0]).toBe(GLOSSARY_HEADING);
    expect(lines[1]).toContain('hexagram');
    expect(lines[1]).toContain(`Source: ${GLOSSARY_OWN_WORDING}.`);
  });
});
