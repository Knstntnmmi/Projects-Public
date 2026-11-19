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
 * final-outcome token (終吉 終凶 終亂 終吝 有終) overrides what came before it. A 厲 or 貞厲
 * straight before 无咎 counts -0.5 and the 无咎 counts 0. Otherwise the grade is P + (sum - P) / 2,
 * P being the value of largest absolute size, clipped to [-3, +3].
 *
 * Negation: a phrase the table lists (无咎, 无悔, 无攸利, 无不利, 无大咎, 不利, 勿用) is graded as the
 * table says. In any other phrase in which a negation (无, 匪, 不, 弗, 勿, 未) stands directly before
 * a verdict word, the word is not graded: 无眚 does not count as 眚, 匪咎 not as 咎, 无譽 not as 譽.
 * Such a phrase is reported in `Grade.negated` with the detail "negated, not graded".
 */

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
  无咎: 0.5,
  悔亡: 0.5,
  无悔: 0.5,
  何咎: 0.5,
  无大咎: 0.25,
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

/** The negations that, standing directly before a verdict word the table does not list with them, cancel the grading of that word. */
export const NEGATIONS: readonly string[] = ['无', '匪', '不', '弗', '勿', '未'];

/** The detail printed for a negated phrase. */
export const NEGATED_DETAIL = 'negated, not graded';

// Longest first so that a longer word always wins over the shorter word inside it.
const MATCH_ORDER: readonly string[] = [...Object.keys(VERDICT_TOKENS), ...ADVICE_TOKENS].sort((a, b) => b.length - a.length);
const VERDICT_ORDER: readonly string[] = Object.keys(VERDICT_TOKENS).sort((a, b) => b.length - a.length);

export interface GradedToken {
  token: string;
  value: number;
  /** Index in the stripped text. */
  at: number;
}

/** A verdict word that a negation stands directly before, in a phrase the table does not list. It is not graded. */
export interface NegatedPhrase {
  /** The negation and the verdict word, for example 无眚. */
  phrase: string;
  /** The verdict word the negation stands before. */
  word: string;
  /** Index in the stripped text. */
  at: number;
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
  /** Phrases whose verdict word was negated and so not graded; the detail of each is NEGATED_DETAIL. */
  negated: NegatedPhrase[];
}

const PUNCTUATION = /[\s　。，、；：！？．·「」『』（）()]/g;

/** The statement with punctuation and spaces removed; 無 is read as 无. */
export function stripStatement(text: string): string {
  return text.replace(PUNCTUATION, '').replace(/無/g, '无');
}

/** What one scan of a statement finds: the graded tokens and the negated phrases left ungraded. */
export interface Scan {
  tokens: GradedToken[];
  negated: NegatedPhrase[];
}

/** One scan, left to right, longest first, no overlaps; advice words are consumed and dropped. */
export function scanStatement(text: string): Scan {
  const s = stripStatement(text);
  const tokens: GradedToken[] = [];
  const negated: NegatedPhrase[] = [];
  let i = 0;
  while (i < s.length) {
    let hit: string | undefined;
    for (const t of MATCH_ORDER) {
      if (!s.startsWith(t, i)) continue;
      // A bare 咎 counts only where it is not the end of 无咎, 何咎 or 无大咎; those are longer tokens
      // and win above, but 无 or 何 next to a 咎 that a longer token did not take must still block it.
      if (t === '咎' && i > 0 && (s[i - 1] === '无' || s[i - 1] === '何')) continue;
      hit = t;
      break;
    }
    if (hit === undefined) {
      // No listed phrase starts here. A negation straight before a verdict word takes that word out of the grading.
      if (NEGATIONS.includes(s[i]!)) {
        const word = VERDICT_ORDER.find((t) => s.startsWith(t, i + 1));
        if (word !== undefined) {
          negated.push({ phrase: s[i]! + word, word, at: i });
          i += 1 + word.length;
          continue;
        }
      }
      i += 1;
      continue;
    }
    if (!ADVICE_TOKENS.includes(hit)) tokens.push({ token: hit, value: VERDICT_TOKENS[hit]!, at: i });
    i += hit.length;
  }
  return { tokens, negated };
}

/** The tokens of a statement that count towards its grade. */
export const scanTokens = (text: string): GradedToken[] => scanStatement(text).tokens;

/** The detail line of a grade's negated phrases, or null when there are none. */
export const negatedDetail = (g: Grade): string | null => (g.negated.length === 0 ? null : g.negated.map((n) => `${n.phrase}: ${NEGATED_DETAIL}`).join('; '));

const clip = (x: number): number => Math.max(-3, Math.min(3, x));
const sign = (x: number): number => (x > 0 ? 1 : x < 0 ? -1 : 0);

export function gradeStatement(text: string): Grade {
  const s = stripStatement(text);
  const { tokens: found, negated } = scanStatement(text);
  if (found.length === 0) return { grade: 0, tokens: [], flags: ['none'], finalOutcome: false, negated };
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
    return { grade, tokens: found, flags: [grade > 0 ? 'positive' : grade < 0 ? 'negative' : 'neutral', ...(opposite ? (['mixed'] as const) : []), ...flags], finalOutcome: true, negated };
  }

  // 厲 or 貞厲 straight before 无咎: the pair is -0.5 in all.
  const counted = found.map((t, k) => {
    const next = found[k + 1];
    if ((t.token === '厲' || t.token === '貞厲') && next && next.token === '无咎' && next.at === t.at + t.token.length) return { ...t, value: -0.5 };
    if (t.token === '无咎' && k > 0) {
      const prev = found[k - 1]!;
      if ((prev.token === '厲' || prev.token === '貞厲') && t.at === prev.at + prev.token.length) return { ...t, value: 0 };
    }
    return t;
  });

  let p = counted[0]!.value;
  for (const t of counted) if (Math.abs(t.value) > Math.abs(p)) p = t.value;
  const sum = counted.reduce((a, t) => a + t.value, 0);
  const grade = clip(p + 0.5 * (sum - p));
  const mixed = counted.some((t) => t.value >= 1) && counted.some((t) => t.value <= -1);
  return { grade, tokens: counted, flags: [grade > 0 ? 'positive' : grade < 0 ? 'negative' : 'neutral', ...(mixed ? (['mixed'] as const) : []), ...flags], finalOutcome: false, negated };
}

/** The grade as it is printed: a sign for anything not zero. */
export function gradeText(g: Grade): string {
  return g.grade > 0 ? `+${g.grade}` : String(g.grade);
}
