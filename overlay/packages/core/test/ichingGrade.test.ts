// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import ichingRules from '../src/forecast/data/rules.iching.json' with { type: 'json' };
import { ADVICE_TOKENS, gradeStatement, gradeText, scanTokens, VERDICT_TOKENS } from '../src/systems/iching/grade.ts';
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

  // The specification expects 56.4 to grade other than zero once the added tokens are in. In the transcribed text
  // 56.4 is 旅于處，得其資斧，我心不快, which has none of the added words (有喜 有慶 譽 福 有終) nor any
  // other word of the table, so by the table as specified it grades 0 with the flag none. The grade is not made up;
  // this test fixes what the text gives and the report to the director says the expectation cannot be met.
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
  it('leaves 67 of the 450 statements without a verdict word', () => {
    expect(all.filter((x) => x.g.flags.includes('none'))).toHaveLength(67);
  });

  it('has judgments and lines of every sign', () => {
    expect(all.filter((x) => x.g.grade > 0).length).toBeGreaterThan(200);
    expect(all.filter((x) => x.g.grade < 0).length).toBeGreaterThan(80);
    expect(all.filter((x) => x.g.flags.includes('mixed')).length).toBeGreaterThan(10);
  });

  // Known defects of the table as the rule file states it, pinned so that a later fix is a decision and not a surprise.
  // A negated word is still counted as the word: 无眚 ("no mishap") counts as 眚, 无譽 ("no praise") as 譽, 匪咎 as 咎.
  it('pins the five statements in which a word is negated by 无 or 匪 and is still counted', () => {
    const negated: Record<string, number> = { '2.4': 1.25, '28.5': 1.25, '6.2': -2, '51.3': -2, '14.1': -1.25 };
    for (const [id, expected] of Object.entries(negated)) expect(all.find((x) => x.id === id)!.g.grade, id).toBe(expected);
  });
});
