// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The cue rules of the I Ching tradition map a Zhouyi statement to a topic only where the
 * text itself names it. Each cue is graded on its own clause, never on the whole statement
 * (rules.iching.json: statement 6.0 grades -3 by 終凶 while its audience clause is favourable).
 * The clauses below are the phrases the rule conditions themselves name; nothing is added.
 * A clause with no verdict word has no sign: it is reported as a topic touched, not as good or bad.
 */
import { statementText } from '../../systems/iching/zhouyiText.ts';
import { gradeStatement, type Grade } from '../../systems/iching/grade.ts';
import type { Direction, Topic } from '../types.ts';

export interface Cue {
  /** King Wen number and line, 0 being the judgment: '56.4'. */
  id: string;
  /** The phrase the rule names; always a part of the statement. */
  clause: string;
  /** A sign the rule states outright; otherwise the sign is the grader's on the clause. 'neutral' means the rule says the direction is contested. */
  stated?: 'favourable' | 'unfavourable' | 'neutral';
  /** A short plain note shown as a badge. */
  note?: string;
}

/** Statements that carry a travel or crossing phrase, found by the phrase itself. */
export interface TravelCue extends Cue {
  stated: 'favourable' | 'unfavourable';
  goAhead: boolean;
}

const PHRASES: ReadonlyArray<{ re: RegExp; sign: 'favourable' | 'unfavourable'; goAhead: boolean }> = [
  { re: /不利涉大川|不可涉大川/, sign: 'unfavourable', goAhead: false },
  { re: /(?<![不可])[利用]涉大川/, sign: 'favourable', goAhead: false },
  { re: /不利有攸往|勿用有攸往/, sign: 'unfavourable', goAhead: true },
  { re: /(?<!不)利有攸往/, sign: 'favourable', goAhead: true },
];

/** The text of a statement by id such as '56.4'. */
export function textById(id: string): string | undefined {
  const [n, l] = id.split('.').map(Number);
  return statementText(n!, l!);
}

function scanAll(): string[] {
  const out: string[] = [];
  for (let n = 1; n <= 64; n++) for (const l of [0, 1, 2, 3, 4, 5, 6, 7]) if (statementText(n, l) !== undefined) out.push(`${n}.${l}`);
  return out;
}

/**
 * Journey and crossing cues, from the phrases of the rule condition. Where one statement has
 * phrases of both signs the cue says so by its sign being 'unfavourable' only if every phrase is.
 */
export const TRAVEL_CUES: readonly TravelCue[] = scanAll().flatMap((id) => {
  const text = textById(id)!;
  const hits = PHRASES.flatMap((p) => {
    const m = p.re.exec(text);
    return m ? [{ clause: m[0], sign: p.sign, goAhead: p.goAhead }] : [];
  });
  if (hits.length === 0) return [];
  const negative = hits.some((h) => h.sign === 'unfavourable');
  // A negative phrase decides the statement: 不利有攸往 contains 利有攸往 and is not a positive one.
  const chosen = negative ? hits.filter((h) => h.sign === 'unfavourable') : hits;
  return [{ id, clause: chosen.map((h) => h.clause).join('、'), stated: chosen[0]!.sign, goAhead: chosen.every((h) => h.goAhead) } satisfies TravelCue];
});

/** 利見大人: the rule says favourable and keeps the whole-statement grade out of it. */
export const AUDIENCE_CUES: readonly Cue[] = scanAll().flatMap((id) => (textById(id)!.includes('利見大人') ? [{ id, clause: '利見大人', stated: 'favourable' as const }] : []));

/** Marriage cues: the phrases the rule condition lists. The sign is the grader's on that phrase. */
export const MARRIAGE_CUES: readonly Cue[] = [
  { id: '3.2', clause: '匪寇婚媾' },
  { id: '3.4', clause: '婚媾' },
  { id: '4.2', clause: '納婦' },
  { id: '4.3', clause: '勿用取女' },
  { id: '9.6', clause: '婦貞' },
  { id: '22.4', clause: '婚媾' },
  { id: '28.2', clause: '老夫得其女妻' },
  { id: '28.5', clause: '老婦得其士夫' },
  { id: '31.0', clause: '取女吉' },
  { id: '32.5', clause: '婦人吉夫子凶' },
  { id: '38.6', clause: '婚媾' },
  { id: '44.0', clause: '勿用取女' },
  { id: '51.6', clause: '婚媾有言' },
  { id: '53.0', clause: '女歸吉' },
  { id: '53.3', clause: '夫征不復婦孕不育' },
  { id: '53.5', clause: '婦三歲不孕' },
  { id: '63.2', clause: '婦喪其茀' },
];

/** Illness cues: certain ones, then the ambiguous ones, which carry a note. 36.3 and 50.2 are excluded by the rule. */
export const ILLNESS_CUES: readonly Cue[] = [
  { id: '16.5', clause: '貞疾恆不死' },
  { id: '25.5', clause: '无妄之疾勿藥有喜' },
  { id: '33.3', clause: '有疾厲' },
  { id: '41.4', clause: '損其疾使遄有喜' },
  { id: '24.0', clause: '出入无疾', note: 'ambiguous cue' },
  { id: '55.2', clause: '往得疑疾', note: 'ambiguous cue' },
  { id: '58.4', clause: '介疾有喜', note: 'ambiguous cue' },
];

/**
 * The nine statements that name goods or retainers. A gain or a loss is the rule's own word
 * for six of them; 9.5 and 11.4 are contested and carry no sign; 56.2 names no gain or loss
 * outright, so it is left to its clause, which carries no verdict word.
 */
export const GOODS_CUES: readonly Cue[] = [
  { id: '9.5', clause: '富以其鄰', stated: 'neutral', note: 'direction contested' },
  { id: '11.4', clause: '不富以其鄰', stated: 'neutral', note: 'direction contested' },
  { id: '34.5', clause: '喪羊于易', stated: 'unfavourable', note: 'named in the rule as a loss' },
  { id: '51.2', clause: '億喪貝', stated: 'unfavourable', note: 'named in the rule as a loss' },
  { id: '56.2', clause: '懷其資得僮僕貞' },
  { id: '56.3', clause: '喪其僮僕', stated: 'unfavourable', note: 'named in the rule as a loss' },
  { id: '56.4', clause: '得其資斧', stated: 'favourable', note: 'named in the rule as a gain' },
  { id: '56.6', clause: '喪牛于易', stated: 'unfavourable', note: 'named in the rule as a loss' },
  { id: '57.6', clause: '喪其資斧貞凶', stated: 'unfavourable', note: 'named in the rule as a loss' },
];

/** The sign of a clause: the rule's stated one, else the grader's. A grade with no verdict word is no sign. */
export function cueDirection(cue: Cue, g: Grade): Direction {
  if (cue.stated === 'favourable') return 'favourable';
  if (cue.stated === 'unfavourable') return 'unfavourable';
  if (cue.stated === 'neutral') return 'activates';
  return directionOfGrade(g);
}

/**
 * The direction a grade gives. No verdict word: no sign (the statement only touches the topic).
 * Opposite words in one statement, with no final outcome to settle them: mixed. Otherwise the sign of the grade.
 */
export function directionOfGrade(g: Grade): Direction {
  if (g.flags.includes('none')) return 'activates';
  if (g.flags.includes('mixed') && !g.finalOutcome) return 'mixed';
  return g.grade > 0 ? 'favourable' : g.grade < 0 ? 'unfavourable' : 'mixed';
}

/** The grade of a clause. */
export function gradeClause(clause: string): Grade {
  return gradeStatement(clause);
}

/** The topics a statement is named for by the cue rules; empty when the text names none. */
export function cueTopicsOf(id: string): Topic[] {
  const topics: Topic[] = [];
  const add = (t: Topic, cues: readonly Cue[]): void => {
    if (cues.some((c) => c.id === id)) topics.push(t);
  };
  add('home-travel', TRAVEL_CUES);
  add('career', AUDIENCE_CUES);
  add('relationships', MARRIAGE_CUES);
  add('health', ILLNESS_CUES);
  add('wealth', GOODS_CUES);
  return topics;
}

/** What a cue rule says of one statement for one topic, with the sign the rule or the grader gives its clause. */
export interface CueRead {
  topic: Topic;
  clause: string;
  direction: Direction;
  note: string | null;
}

/** The cues that name a statement, one per topic, each with its own sign: the sign of the clause, not of the whole statement. */
export function cuesOfStatement(id: string): CueRead[] {
  const out: CueRead[] = [];
  const add = (t: Topic, cues: readonly Cue[]): void => {
    for (const c of cues) if (c.id === id) out.push({ topic: t, clause: c.clause, direction: cueDirection(c, gradeClause(c.clause)), note: c.note ?? null });
  };
  add('home-travel', TRAVEL_CUES);
  add('career', AUDIENCE_CUES);
  add('relationships', MARRIAGE_CUES);
  add('health', ILLNESS_CUES);
  add('wealth', GOODS_CUES);
  return out;
}

/**
 * The topics a statement is attached to: 'general' where its verdict words give it a grade,
 * and every topic a cue rule names it for. A statement with grade 0 and no topic cue is
 * attached to no topic at all; it says nothing about anything.
 */
export function topicsOfStatement(id: string, g: Grade): Topic[] {
  return g.grade === 0 ? cueTopicsOf(id) : ['general', ...cueTopicsOf(id)];
}
