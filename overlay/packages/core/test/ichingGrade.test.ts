// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import ichingRules from '../src/forecast/data/rules.iching.json' with { type: 'json' };
import fixture from './fixtures/iching-negated-formulas.json' with { type: 'json' };
import negations from '../src/forecast/data/iching-negations.json' with { type: 'json' };
import { ADVICE_TOKENS, formulaDetail, formulaNotes, gradeStatement, gradeText, scanTokens, VERDICT_TOKENS } from '../src/systems/iching/grade.ts';
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
  const keys = ['+3', '+2', '+1.5', '+1', '-0.5', '-1', '-1.5', '-2', '-3'];

  it('gives every token the value the rule file states', () => {
    const fromFile: Record<string, number> = {};
    for (const k of keys) for (const t of tokensOfCell(table[k]!)) fromFile[t] = Number(k);
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
    expect(scanTokens('无咎')).toEqual([]);
    expect(scanTokens('无大咎')).toEqual([]);
    expect(scanTokens('无不利').map((t) => t.token)).toEqual(['无不利']);
    expect(scanTokens('无攸利').map((t) => t.token)).toEqual(['无攸利']);
    expect(scanTokens('小亨').map((t) => t.token)).toEqual(['小亨']);
  });

  it('reads 无咎 beside 厲 as a note: the 厲 keeps its own value', () => {
    expect(gradeStatement('厲无咎').grade).toBe(-1.5);
    expect(gradeStatement('貞厲无咎').grade).toBe(-1.5);
    expect(grade('1.3').grade).toBe(-1.5);
    expect(grade('1.3').formulas.map((f) => f.formula)).toEqual(['无咎']);
    expect(gradeStatement('厲').grade).toBe(-1.5);
    expect(gradeStatement('厲吉').grade).toBe(1.25);
  });

  it('counts a bare 咎 only where it is not part of a negated formula', () => {
    expect(gradeStatement('有咎').grade).toBe(-1.5);
    expect(gradeStatement('无咎').grade).toBe(0);
    expect(gradeStatement('何咎').grade).toBe(0);
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
    expect(gradeStatement('厲，無咎。').grade).toBe(-1.5);
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
  // A negated word of misfortune (无咎 and the like) is a note without a direction, so the statements that hold only such notes now join them.
  it('leaves 130 of the 450 statements without a graded verdict word, and shows every one of them that holds a note', () => {
    const none = all.filter((x) => x.g.flags.includes('none'));
    expect(none).toHaveLength(130);
    // 69 had no verdict word before the notes; 61 more hold only a negated word of misfortune
    expect(none.filter((x) => formulaNotes(x.g).length > 0)).toHaveLength(63);
  });

  it('has judgments and lines of every sign', () => {
    expect(all.filter((x) => x.g.grade > 0).length).toBeGreaterThan(200);
    expect(all.filter((x) => x.g.grade < 0).length).toBeGreaterThan(80);
    expect(all.filter((x) => x.g.flags.includes('mixed')).length).toBeGreaterThan(10);
  });

  it('reads every negated formula as its class says: a and d are notes, b is unfavourable, c is favourable', () => {
    const dir = { a: null, b: 'unfavourable', c: 'favourable', d: null } as const;
    for (const f of negations.formulas) {
      const g = gradeStatement(f.formula);
      expect(g.formulas.map((x) => [x.formula, x.cls, x.gloss]), f.formula).toEqual([[f.formula, f.class, f.gloss]]);
      expect(g.formulas[0]!.direction, f.formula).toBe(dir[f.class as 'a' | 'b' | 'c' | 'd']);
      // a note carries no value; b and c count as the token table says
      expect(g.grade, f.formula).toBe(f.class === 'a' || f.class === 'd' ? 0 : VERDICT_TOKENS[f.formula]);
    }
    // the same negators before a word the table does not pair with them are read by the class rule
    for (const [text, cls] of [['无眚', 'a'], ['匪咎', 'a'], ['弗凶', 'a'], ['未吝', 'a'], ['無譽', 'd'], ['不吉', 'd'], ['未亨', 'd'], ['勿利', 'b'], ['弗利', 'b']] as const) {
      const g = gradeStatement(text);
      expect(g.formulas.map((x) => x.cls), text).toEqual([cls]);
      expect(formulaNotes(g).length > 0, text).toBe(cls === 'a' || cls === 'd');
    }
    // a verdict word is not negated by a word that is not a negator, and 勿用 and 不可涉大川 are tokens, not formulas
    expect(gradeStatement('勿用').formulas).toEqual([]);
    expect(gradeStatement('不可涉大川').formulas).toEqual([]);
    expect(gradeStatement('不終日').formulas).toEqual([]);
  });

  it('gives each note its characters and a literal gloss, and class b the thing it names', () => {
    expect(formulaDetail(gradeStatement('无咎'))).toBe('无咎 (no blame): states that something bad is absent; a note without a direction');
    expect(formulaDetail(gradeStatement('无譽'))).toBe('无譽 (no praise): a negated verdict word; a note without a direction');
    expect(formulaDetail(gradeStatement('不利涉大川'))).toBe('不利涉大川 (not advantageous): unfavourable for what it names');
    expect(formulaDetail(gradeStatement('无不利'))).toBe('无不利 (nothing that is not advantageous): favourable');
    expect(formulaDetail(gradeStatement('履霜堅冰至'))).toBeNull();
  });

  it('keeps the grade of the rest of a statement when a word in it is negated', () => {
    expect(gradeStatement('无咎无譽').grade).toBe(0);
    expect(gradeStatement('吉无眚').grade).toBe(2);
    expect(gradeStatement('吉无咎').grade).toBe(2);
    expect(gradeStatement('无咎无譽').formulas.map((f) => f.formula)).toEqual(['无咎', '无譽']);
  });

  it('keeps 悔亡 as a note and not as 悔', () => {
    expect(gradeStatement('悔亡').grade).toBe(0);
    expect(gradeStatement('有悔').grade).toBe(-0.5);
    expect(gradeStatement('悔').grade).toBe(-0.5);
  });
});

describe('the whole list of negated formulas of the Zhouyi text', () => {
  const all = allStatements().map((s) => ({ id: s.id, text: s.text, g: gradeStatement(s.text) }));

  it('has the counts the fixture states, over 450 statements', () => {
    expect(fixture.statements).toBe(450);
    expect(all).toHaveLength(450);
    expect(fixture.entries).toHaveLength(159);
    expect(fixture.counts).toEqual({ a: 126, b: 18, c: 13, d: 2 });
    expect(fixture.statementsWithAFormula).toBe(148);
    expect(new Set(fixture.entries.map((e) => e.id)).size).toBe(148);
  });

  it('is read by the grader exactly as the fixture lists it: same formulas, same classes, in the same statements', () => {
    const got = all.flatMap((x) => x.g.formulas.map((f) => ({ id: x.id, formula: f.formula, class: f.cls })));
    expect(got).toEqual(fixture.entries);
  });

  it('shows no statement without its note: every statement with a class a or d formula carries it, and none is left unread', () => {
    for (const x of all) {
      const listed = fixture.entries.filter((e) => e.id === x.id);
      expect(x.g.formulas.length, x.id).toBe(listed.length);
      const notes = listed.filter((e) => e.class === 'a' || e.class === 'd').length;
      expect(formulaNotes(x.g).length, x.id).toBe(notes);
    }
  });

  it('gives a direction only through classes b and c', () => {
    for (const x of all) {
      const fromFormulas = x.g.formulas.filter((f) => f.direction !== null);
      const tokenNames = x.g.tokens.map((t) => t.token);
      for (const f of fromFormulas) expect(tokenNames, `${x.id} ${f.formula}`).toContain(f.formula);
      for (const f of x.g.formulas.filter((f) => f.direction === null)) expect(tokenNames, `${x.id} ${f.formula}`).not.toContain(f.formula);
    }
  });
});
