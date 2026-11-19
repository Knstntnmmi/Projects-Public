// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * A mechanical grade for a Zhouyi statement, from the verdict words the text itself uses.
 * This is a modern construction and is labelled experimental wherever it is shown: only
 * the ordering anchor (Xici shang ch.3: 吉凶 gain and loss, 悔吝 a small flaw, 无咎
 * good at mending a fault) comes from the text; every number below is this engine's convention.
 *
 * Method (rules.iching.json, zhouyi.statement-grade): delete punctuation and spaces; scan left
 * to right, longest token first, no overlaps; each token gives a value from -3 to +3. A
 * final-outcome token (終吉 終凶 終亂 終吝 有終) overrides what came before it. Otherwise the
 * grade is P + (sum - P) / 2, P being the value of largest absolute size, clipped to [-3, +3].
 *
 * Negation: a negator (无, 匪, 不, 弗, 勿, 未) before a verdict word is read as a whole formula, by the table in
 * forecast/data/iching-negations.json, which is the project's own reading of the grammar (status derived, following no
 * commentary). A negated word of misfortune (无咎, 无悔, 悔亡 and the like) states that something bad is absent: it carries
 * no direction and is shown as a note (class a). A negated word of advantage (不利, 无攸利) is unfavourable (class b); 无不利 is
 * favourable (class c); every other case carries no direction and is shown as a note (class d). No formula is dropped:
 * each is reported in `Grade.formulas`.
 */

import negationsJson from '../../forecast/data/iching-negations.json' with { type: 'json' };

export const VERDICT_TOKENS: Readonly<Record<string, number>> = {
  元吉: 3,
  大吉: 3,
  吉: 2,
  貞吉: 2,
  終吉: 2,
  元亨: 2,
  无不利: 1.5,
  有慶: 1.5,
  亨: 1,
  小亨: 1,
  利: 1,
  初吉: 1,
  有喜: 1,
  譽: 1,
  福: 1,
  有終: 1,
  悔: -0.5,
  有悔: -0.5,
  吝: -1,
  貞吝: -1,
  勿用: -1,
  无攸利: -1,
  終吝: -1,
  厲: -1.5,
  貞厲: -1.5,
  不利: -1.5,
  咎: -1.5,
  不可涉大川: -1.5,
  災: -2,
  眚: -2,
  終亂: -2,
  凶: -3,
  貞凶: -3,
  征凶: -3,
  終凶: -3,
};

/** Advice rather than verdict: matched so that nothing inside them is graded, and never counted. */
export const ADVICE_TOKENS: readonly string[] = ['不可疾貞', '不可貞'];

/** A final outcome overrides every token before it. */
export const FINAL_OUTCOME_TOKENS: readonly string[] = ['終吉', '終凶', '終亂', '終吝', '有終'];

/** 貞 beside a verdict makes it conditional on steadfastness; a flag, not a change of value. */
export const CONDITIONAL_TOKENS: readonly string[] = ['貞吉', '貞凶', '貞厲', '貞吝', '利貞'];

export type FormulaClass = 'a' | 'b' | 'c' | 'd';

interface NegationTable {
  label: string;
  status: string;
  follows: string;
  negators: Record<string, string>;
  words: Record<string, { kind: 'misfortune' | 'advantage' | 'other'; gloss: string }>;
  formulas: Array<{ formula: string; class: FormulaClass; gloss: string }>;
}

/** The project's reading of negated verdict words, as the data file states it. */
export const NEGATION_TABLE: NegationTable = negationsJson as NegationTable;

/** The negators of the table. */
export const NEGATIONS: readonly string[] = Object.keys(NEGATION_TABLE.negators);

const FORMULAS = new Map(NEGATION_TABLE.formulas.map((f) => [f.formula, f]));
const WORD_ORDER = Object.keys(NEGATION_TABLE.words).sort((x, y) => y.length - x.length);

/** The direction a class gives: b is unfavourable, c is favourable, a and d give none. */
export const FORMULA_DIRECTION: Readonly<Record<FormulaClass, 'favourable' | 'unfavourable' | null>> = { a: null, b: 'unfavourable', c: 'favourable', d: null };

/** What each class says, in plain words. */
export const FORMULA_CLASS_TEXT: Readonly<Record<FormulaClass, string>> = {
  a: 'states that something bad is absent; a note without a direction',
  b: 'unfavourable for what it names',
  c: 'favourable',
  d: 'a negated verdict word; a note without a direction',
};

// Longest first so that a longer word always wins over the shorter word inside it.
const MATCH_ORDER: readonly string[] = [...new Set([...Object.keys(VERDICT_TOKENS), ...ADVICE_TOKENS, ...FORMULAS.keys()])].sort((a, b) => b.length - a.length);

export interface GradedToken {
  token: string;
  value: number;
  /** Index in the stripped text. */
  at: number;
}

/** A negated verdict formula found in a statement, with its class, its literal gloss and the direction it gives, if any. */
export interface FormulaRead {
  /** The formula in characters, for example 无咎. */
  formula: string;
  cls: FormulaClass;
  /** A literal gloss, for example 'no blame'. */
  gloss: string;
  /** Index in the stripped text. */
  at: number;
  /** For class b, the words that follow the formula up to the next verdict word: the thing the formula names. Empty otherwise. */
  follows: string;
  direction: 'favourable' | 'unfavourable' | null;
}

export type GradeFlag = 'none' | 'mixed' | 'positive' | 'negative' | 'neutral' | 'conditional';

export interface Grade {
  /** -3 to +3, quarter steps; 0 when no token was found. */
  grade: number;
  /** The tokens that were counted, in text order, with the values that entered the grade (厲 before 无咎 as -0.5). */
  tokens: GradedToken[];
  /** 'none' alone, or one of positive, negative, neutral, with 'mixed' and 'conditional' where they apply. */
  flags: GradeFlag[];
  /** True when a final-outcome token set the grade. */
  finalOutcome: boolean;
  /** Every negated verdict formula of the statement, in text order, each with its class (a to d). Classes a and d are notes without a direction; b and c are also counted among the tokens. */
  formulas: FormulaRead[];
}

const PUNCTUATION = /[\s　。，、；：！？．·「」『』（）()]/g;

/** The statement with punctuation and spaces removed; 無 is read as 无. */
export function stripStatement(text: string): string {
  return text.replace(PUNCTUATION, '').replace(/無/g, '无');
}

/** What one scan of a statement finds: the graded tokens and the negated formulas. */
export interface Scan {
  tokens: GradedToken[];
  formulas: FormulaRead[];
}

/** A negator directly before a verdict word the table does not list: read by the class rule of the table. */
function genericFormula(s: string, i: number): { formula: string; cls: FormulaClass; gloss: string } | undefined {
  const neg = NEGATION_TABLE.negators[s[i]!];
  if (neg === undefined) return undefined;
  const word = WORD_ORDER.find((w) => s.startsWith(w, i + 1));
  if (word === undefined) return undefined;
  const w = NEGATION_TABLE.words[word]!;
  const cls: FormulaClass = w.kind === 'misfortune' ? 'a' : w.kind === 'advantage' ? 'b' : 'd';
  return { formula: s[i]! + word, cls, gloss: `${neg} ${w.gloss}` };
}

/** One scan, left to right, longest first, no overlaps; advice words are consumed and dropped. */
export function scanStatement(text: string): Scan {
  const s = stripStatement(text);
  const tokens: GradedToken[] = [];
  const formulas: FormulaRead[] = [];
  const starts: number[] = [];
  let i = 0;
  while (i < s.length) {
    let hit: string | undefined;
    for (const t of MATCH_ORDER) {
      if (s.startsWith(t, i)) {
        hit = t;
        break;
      }
    }
    if (hit === undefined) {
      const g = genericFormula(s, i);
      if (g !== undefined) {
        starts.push(i);
        formulas.push({ ...g, at: i, follows: '', direction: FORMULA_DIRECTION[g.cls] });
        // a generic class b reads as unfavourable and counts like 不利
        if (g.cls === 'b') tokens.push({ token: g.formula, value: VERDICT_TOKENS['不利']!, at: i });
        i += g.formula.length;
        continue;
      }
      i += 1;
      continue;
    }
    starts.push(i);
    const f = FORMULAS.get(hit);
    if (f !== undefined) formulas.push({ formula: hit, cls: f.class, gloss: f.gloss, at: i, follows: '', direction: FORMULA_DIRECTION[f.class] });
    // a verdict word counts unless it is a formula of class a or d, which are notes; advice words never count
    if (!ADVICE_TOKENS.includes(hit) && (f === undefined || f.class === 'b' || f.class === 'c')) tokens.push({ token: hit, value: VERDICT_TOKENS[hit]!, at: i });
    i += hit.length;
  }
  // the thing a class b formula names: the words after it, up to the next word that is read
  for (const f of formulas) {
    if (f.cls !== 'b') continue;
    const from = f.at + f.formula.length;
    const next = starts.find((x) => x >= from) ?? s.length;
    f.follows = s.slice(from, next);
  }
  return { tokens, formulas };
}

/** The tokens of a statement that count towards its grade. */
export const scanTokens = (text: string): GradedToken[] => scanStatement(text).tokens;

/** The formulas that are notes without a direction (classes a and d). */
export const formulaNotes = (g: Grade): FormulaRead[] => g.formulas.filter((f) => f.direction === null);

/** One formula as it is printed: the formula in characters (with the words it names, for class b), the literal gloss and what it says. */
export const formulaText = (f: FormulaRead): string => `${f.formula}${f.follows} (${f.gloss}): ${FORMULA_CLASS_TEXT[f.cls]}`;

/** The detail line of a grade's negated formulas, or null when there are none. */
export const formulaDetail = (g: Grade): string | null => (g.formulas.length === 0 ? null : g.formulas.map(formulaText).join('; '));

const clip = (x: number): number => Math.max(-3, Math.min(3, x));
const sign = (x: number): number => (x > 0 ? 1 : x < 0 ? -1 : 0);

export function gradeStatement(text: string): Grade {
  const s = stripStatement(text);
  const { tokens: found, formulas } = scanStatement(text);
  if (found.length === 0) return { grade: 0, tokens: [], flags: ['none'], finalOutcome: false, formulas };
  const flags: GradeFlag[] = [];
  if (found.some((t) => CONDITIONAL_TOKENS.includes(t.token)) || /利貞/.test(s)) flags.push('conditional');

  // The last final-outcome token is the statement's outcome.
  let last = -1;
  found.forEach((t, k) => {
    if (FINAL_OUTCOME_TOKENS.includes(t.token)) last = k;
  });
  if (last >= 0) {
    const outcome = found[last]!;
    const before = found.slice(0, last);
    const opposite = before.some((t) => sign(t.value) !== 0 && sign(t.value) === -sign(outcome.value));
    const grade = clip(outcome.value);
    return { grade, tokens: found, flags: [grade > 0 ? 'positive' : grade < 0 ? 'negative' : 'neutral', ...(opposite ? (['mixed'] as const) : []), ...flags], finalOutcome: true, formulas };
  }

  const counted = found;

  let p = counted[0]!.value;
  for (const t of counted) if (Math.abs(t.value) > Math.abs(p)) p = t.value;
  const sum = counted.reduce((a, t) => a + t.value, 0);
  const grade = clip(p + 0.5 * (sum - p));
  const mixed = counted.some((t) => t.value >= 1) && counted.some((t) => t.value <= -1);
  return { grade, tokens: counted, flags: [grade > 0 ? 'positive' : grade < 0 ? 'negative' : 'neutral', ...(mixed ? (['mixed'] as const) : []), ...flags], finalOutcome: false, formulas };
}

/** The grade as it is printed: a sign for anything not zero. */
export function gradeText(g: Grade): string {
  return g.grade > 0 ? `+${g.grade}` : String(g.grade);
}
