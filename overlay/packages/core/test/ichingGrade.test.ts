// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import ichingRules from '../src/forecast/data/rules.iching.json' with { type: 'json' };
import { ADVICE_TOKENS, gradeStatement, gradeText, negatedDetail, scanTokens, VERDICT_TOKENS } from '../src/systems/iching/grade.ts';
import { allStatements, statementText } from '../src/systems/iching/zhouyiText.ts';

const grade = (id: string) => {
  const [n, l] = id.split('.').map(Number);
  return gradeStatement(statementText(n!, l!)!);
};

/** The leading run of Chinese characters of each top-level, comma-separated piece of a table cell. */
function tokensOfCell(cell: string): string[] {
  const pieces: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of cell) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      pieces.push(cur);
      cur = '';
    } else cur += ch;
  }
  pieces.push(cur);
  return pieces.map((p) => /^[\s;]*([一-鿿]+)/.exec(p)?.[1]).filter((x): x is string => x !== undefined);
}

describe('the verdict-token table', () => {
  const table = (ichingRules.tables as { tokens: Record<string, string> }).tokens;
  const keys = ['+3', '+2', '+1.5', '+1', '+0.5', '+0.25', '-0.5', '-1', '-1.5', '-2', '-3'];

  it('gives every token the value the rule file states', () => {
    const fromFile: Record<string, number> = {};
    for (const k of keys) for (const t of tokensOfCell(table[k]!)) fromFile[t] = Number(k);
    // 厲无咎 is a pair, not a token: its two halves are handled by the grader, not the table.
    delete fromFile['厲无咎'];
    // The cell for -2 reads "災 or 眚": two tokens of one value.
    fromFile['眚'] = fromFile['災']!;
    expect(VERDICT_TOKENS).toEqual(fromFile);
  });

  it('keeps the advice words out of the verdicts', () => {
    expect(ADVICE_TOKENS).toEqual(['不可疾貞', '不可貞']);
    for (const a of ADVICE_TOKENS) expect(VERDICT_TOKENS[a]).toBeUndefined();
    expect(scanTokens('不可疾貞')).toEqual([]);
    expect(scanTokens('不可貞')).toEqual([]);
  });
});

describe('the grader, on the cases the specification lists', () => {
  it('63.0 (ends 終亂) is negative, not positive', () => {
    const g = grade('63.0');
    expect(g.grade).toBe(-2);
    expect(g.flags).toContain('negative');
    expect(g.flags).toContain('mixed');
    expect(g.finalOutcome).toBe(true);
  });

  it('37.3 (ends 終吝) is not positive', () => {
    const g = grade('37.3');
    expect(g.grade).toBe(-1);
    expect(g.flags).toContain('negative');
  });

  it('27.5 counts 不可涉大川 and is not plus two', () => {
    const g = grade('27.5');
    expect(g.grade).not.toBe(2);
    expect(g.grade).toBe(1.25);
    expect(g.flags).toContain('mixed');
    expect(g.tokens.map((t) => t.token)).toEqual(['貞吉', '不可涉大川']);
  });

  it('25.5 has 有喜 and is positive', () => {
    const g = grade('25.5');
    expect(g.grade).toBe(1);
    expect(g.flags).toContain('positive');
  });

  // The specification's test list expects 56.4 to grade other than zero once the added tokens are in; that expectation was
  // wrong. The stored statement is 旅于處，得其資斧，我心不快, and it was compared again with the wikisource page
  // 周易/旅 (line 九四: 旅于處，得其資斧，我心不快; the page marks 于 as a variant mark and nothing else). The statement
  // has none of the added words (有喜 有慶 譽 福 有終) nor any other word of the token table, so by the table as the
  // rule file states it the grade is 0 with the flag none. The cue rule for goods still attaches it to wealth, on its own
  // stated sign (a gain), not on a grade. The grade is not made up; this test fixes what the text gives.
  it('56.4 has no verdict word in the transcribed text and grades 0 (none)', () => {
    const g = grade('56.4');
    expect(g.grade).toBe(0);
    expect(g.flags).toEqual(['none']);
    // The neighbouring line that does carry an added word is no longer zero.
    expect(grade('56.5').grade).toBe(1);
  });
});

describe('the corrections the checker recorded', () => {
  it('lets a final-outcome word override an earlier favourable one', () => {
    expect(gradeStatement('初吉終亂').grade).toBe(-2);
    expect(gradeStatement('吉終凶').grade).toBe(-3);
    expect(gradeStatement('厲吉終吝').grade).toBe(-1);
    expect(gradeStatement('悔終吉').grade).toBe(2);
    expect(gradeStatement('凶无成有終').grade).toBe(1);
  });

  it('takes the last final-outcome word as the outcome', () => {
    expect(gradeStatement('終吉終凶').grade).toBe(-3);
  });

  it('grades the tokens the first table missed: 有喜 有慶 譽 福 有終', () => {
    expect(gradeStatement('有喜').grade).toBe(1);
    expect(gradeStatement('有慶').grade).toBe(1.5);
    expect(gradeStatement('終以譽命').grade).toBe(1);
    expect(gradeStatement('受茲介福').grade).toBe(1);
    expect(gradeStatement('有終').grade).toBe(1);
  });

  it('counts the object phrase once: 利涉大川 is one 利, 不利涉大川 is one 不利', () => {
    expect(scanTokens('利涉大川').map((t) => t.token)).toEqual(['利']);
    expect(scanTokens('不利涉大川').map((t) => t.token)).toEqual(['不利']);
    expect(scanTokens('用涉大川吉').map((t) => t.token)).toEqual(['吉']);
    expect(scanTokens('不可涉大川').map((t) => t.token)).toEqual(['不可涉大川']);
  });

  it('matches longest first and never inside a longer word', () => {
    expect(scanTokens('元吉').map((t) => t.token)).toEqual(['元吉']);
    expect(scanTokens('貞吉').map((t) => t.token)).toEqual(['貞吉']);
    expect(scanTokens('无咎').map((t) => t.token)).toEqual(['无咎']);
    expect(scanTokens('无大咎').map((t) => t.token)).toEqual(['无大咎']);
    expect(scanTokens('无不利').map((t) => t.token)).toEqual(['无不利']);
    expect(scanTokens('无攸利').map((t) => t.token)).toEqual(['无攸利']);
    expect(scanTokens('小亨').map((t) => t.token)).toEqual(['小亨']);
  });

  it('counts 厲 straight before 无咎 as -0.5 and the 无咎 as 0', () => {
    expect(gradeStatement('厲无咎').grade).toBe(-0.5);
    expect(gradeStatement('貞厲无咎').grade).toBe(-0.5);
    expect(grade('1.3').grade).toBe(-0.5);
    // A 厲 that is not followed by 无咎 keeps its own value.
    expect(gradeStatement('厲').grade).toBe(-1.5);
    expect(gradeStatement('厲吉').grade).toBe(1.25);
  });

  it('counts a bare 咎 only where it is not part of 无咎, 何咎 or 无大咎', () => {
    expect(gradeStatement('有咎').grade).toBe(-1.5);
    expect(gradeStatement('无咎').grade).toBe(0.5);
    expect(gradeStatement('何咎').grade).toBe(0.5);
  });

  it('grades a statement with no verdict word as 0 with the flag none', () => {
    const g = gradeStatement('履霜堅冰至');
    expect(g).toMatchObject({ grade: 0, flags: ['none'], tokens: [] });
  });

  it('flags opposite words as mixed and 貞 beside a verdict as conditional', () => {
    expect(gradeStatement('吉凶').flags).toContain('mixed');
    expect(gradeStatement('貞吉').flags).toContain('conditional');
    expect(gradeStatement('元亨利貞').flags).toContain('conditional');
    expect(gradeStatement('吉').flags).toEqual(['positive']);
  });

  it('uses the largest word and half of the rest, and clips at plus and minus three', () => {
    expect(gradeStatement('元吉吉').grade).toBe(3);
    expect(gradeStatement('凶凶凶').grade).toBe(-3);
    expect(gradeStatement('吉亨').grade).toBe(2.5);
    // 4.1 has 利 and 吝, equal and opposite: the first of the two sets the weight.
    expect(grade('4.1').grade).toBe(0.5);
  });

  it('prints a sign for any grade but zero', () => {
    expect(gradeText(gradeStatement('吉'))).toBe('+2');
    expect(gradeText(gradeStatement('凶'))).toBe('-3');
    expect(gradeText(gradeStatement('旅'))).toBe('0');
  });

  it('ignores punctuation, spaces and the other spelling of 无', () => {
    expect(gradeStatement('厲，無咎。').grade).toBe(-0.5);
    expect(gradeStatement('吉 ，').grade).toBe(2);
  });
});

describe('the grader over the whole corpus', () => {
  const all = allStatements().map((s) => ({ id: s.id, g: gradeStatement(s.text) }));

  it('stays within bounds and is the same twice', () => {
    for (const { id, g } of all) {
      expect(g.grade, id).toBeGreaterThanOrEqual(-3);
      expect(g.grade, id).toBeLessThanOrEqual(3);
      expect(Number.isFinite(g.grade)).toBe(true);
    }
    expect(allStatements().map((s) => gradeStatement(s.text))).toEqual(all.map((x) => x.g));
  });

  // The extractor's figure ("76 of 450 have no verdict word") was made before the missing tokens were added; recomputed here.
  // 67 before negation was honoured; 6.2 and 51.3 had only 无眚, which is now not graded, so they join the statements with none.
  it('leaves 69 of the 450 statements without a graded verdict word', () => {
    expect(all.filter((x) => x.g.flags.includes('none'))).toHaveLength(69);
  });

  it('has judgments and lines of every sign', () => {
    expect(all.filter((x) => x.g.grade > 0).length).toBeGreaterThan(200);
    expect(all.filter((x) => x.g.grade < 0).length).toBeGreaterThan(80);
    expect(all.filter((x) => x.g.flags.includes('mixed')).length).toBeGreaterThan(10);
  });

  // A negation straight before a verdict word that the table does not list with it takes the word out of the grading.
  // The table's own phrases (无咎 among them) are graded as the table says.
  it('does not grade a negated word: 无眚, 无譽 and 匪咎 are reported as negated, not graded', () => {
    const expected: Record<string, { grade: number; negated: string[] }> = {
      '2.4': { grade: 0.5, negated: ['无譽'] },
      '28.5': { grade: 0.5, negated: ['无譽'] },
      '6.2': { grade: 0, negated: ['无眚'] },
      '51.3': { grade: 0, negated: ['无眚'] },
      '14.1': { grade: 0.5, negated: ['匪咎'] },
    };
    for (const [id, e] of Object.entries(expected)) {
      const g = all.find((x) => x.id === id)!.g;
      expect(g.grade, id).toBe(e.grade);
      expect(g.negated.map((n) => n.phrase), id).toEqual(e.negated);
      expect(negatedDetail(g), id).toBe(e.negated.map((n) => `${n}: negated, not graded`).join('; '));
    }
    // these five are the only statements of the corpus that carry a negated word
    expect(all.filter((x) => x.g.negated.length > 0).map((x) => x.id).sort()).toEqual(Object.keys(expected).sort());
  });

  it('grades the phrases the table lists as the table says, 无咎 first', () => {
    expect(gradeStatement('无咎').grade).toBe(0.5);
    expect(gradeStatement('无咎').negated).toEqual([]);
    for (const phrase of ['无悔', '无大咎', '无不利', '无攸利', '何咎', '不利', '勿用', '不可涉大川']) {
      const g = gradeStatement(phrase);
      expect(g.grade, phrase).toBe(VERDICT_TOKENS[phrase]);
      expect(g.negated, phrase).toEqual([]);
    }
    // the same negation before a word the table does not pair with it is not graded
    for (const [text, word] of [['无眚', '眚'], ['无譽', '譽'], ['匪咎', '咎'], ['不吉', '吉'], ['弗凶', '凶'], ['未亨', '亨'], ['勿利', '利']] as const) {
      const g = gradeStatement(text);
      expect(g.grade, text).toBe(0);
      expect(g.flags, text).toEqual(['none']);
      expect(g.negated.map((n) => [n.phrase, n.word]), text).toEqual([[text, word]]);
    }
    // 無 is read as 无, so the traditional character negates as well
    expect(gradeStatement('無眚').negated.map((n) => n.phrase)).toEqual(['无眚']);
  });

  it('keeps the grade of the rest of a statement when one word in it is negated', () => {
    expect(gradeStatement('无咎无譽').grade).toBe(0.5);
    expect(gradeStatement('吉无眚').grade).toBe(2);
    expect(gradeStatement('无咎无譽').tokens.map((t) => t.token)).toEqual(['无咎']);
  });
});
