// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The glossary of the terms of art that the forecast prints. The one source of truth is
 * data/glossary.json: docs/GLOSSARY.md is written from it by `npm run generate`, the page lists
 * the entries whose terms occur in the forecast it shows, and "overlay forecast --glossary"
 * prints the same list. An entry gives the term (several names for one thing are separated by
 * a comma and a space), the original word or characters where there are any, the meaning, and the
 * source: a work cited with its page, or the exact words {@link GLOSSARY_OWN_WORDING}.
 */
import glossaryJson from './data/glossary.json' with { type: 'json' };

export interface GlossaryEntry {
  /** The heading of the table of GLOSSARY.md that the entry stands in. */
  group: string;
  term: string;
  original: string;
  definition: string;
  source: string;
}

export const GLOSSARY_OWN_WORDING = "the project's own wording";

export const GLOSSARY: readonly GlossaryEntry[] = glossaryJson as GlossaryEntry[];

/** The heading that opens the list of words used, on the page and on the command line. */
export const GLOSSARY_HEADING = 'Words used';

/** The two paragraphs that open GLOSSARY.md. */
export const GLOSSARY_INTRO: readonly string[] = [
  "This page defines the terms of art that the forecast prints, in the rule files, the level labels, the badges and the sample. A definition says what the term means in this project, in one or two plain sentences, and where the engine acts on the term it keeps to what the engine does. The last column says where the definition comes from. It is either a work from the scholarship set out in [SCHOLARSHIP.md](SCHOLARSHIP.md), cited with its page, or the exact words \"the project's own wording\". The glossary does not define a term from memory of a book that was not read. Where an original word or the characters are given, they are those of the rule files or of the work cited.",
  "The words of the forecast are few. It speaks in four words only: supports, cautions, mixed and nothing said. They carry no number."
];

/** The group headings, in the order of the file. */
export const GLOSSARY_GROUPS: readonly string[] = ["The words of the forecast", "Words about the arts", "BaZi", "Vedic astrology", "Western astrology", "I Ching"];

/** The names under which an entry is looked for: the whole term, each name between its commas, and the original where there is one. */
export function glossaryNames(e: GlossaryEntry): string[] {
  const names = [e.term, ...e.term.split(', ')];
  if (e.original !== '') names.push(e.original);
  return [...new Set(names.map((n) => n.trim()).filter((n) => n !== ''))];
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A name written in Han characters has no spaces round it, so it is found inside a run of them; any other name must stand alone as a word. */
const pattern = (name: string): string => (/\p{Script=Han}/u.test(name) ? escapeRegExp(name) : `(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`);

const MATCHERS: ReadonlyMap<GlossaryEntry, RegExp> = new Map(GLOSSARY.map((e) => [e, new RegExp(glossaryNames(e).map(pattern).join('|'), 'iu')]));

/** The entries whose term occurs in a text, in the order of the file. Case does not matter; a term inside a longer word does not count. */
export function glossaryTermsIn(text: string): GlossaryEntry[] {
  return GLOSSARY.filter((e) => MATCHERS.get(e)!.test(text));
}

/** The list of words used as plain lines, for the command line; nothing when no term occurs. */
export function glossaryLines(entries: readonly GlossaryEntry[]): string[] {
  if (entries.length === 0) return [];
  return [
    GLOSSARY_HEADING,
    ...entries.map((e) => `- ${e.term}${e.original === '' ? '' : ` (${e.original})`}: ${e.definition} Source: ${e.source}.`),
  ];
}

const cell = (s: string): string => s.replace(/\|/g, '\\|');

/** The text of docs/GLOSSARY.md. */
export function glossaryMarkdown(): string {
  const out: string[] = ['# Glossary', '', GLOSSARY_INTRO[0]!, '', GLOSSARY_INTRO[1]!, ''];
  for (const group of GLOSSARY_GROUPS) {
    out.push(`## ${group}`, '', '| Term | Original | Meaning | Source |', '| --- | --- | --- | --- |');
    for (const e of GLOSSARY) if (e.group === group) out.push(`| ${cell(e.term)} | ${cell(e.original)} | ${cell(e.definition)} | ${cell(e.source)} |`.replace('|  |', '| |'));
    out.push('');
  }
  return out.join('\n');
}
