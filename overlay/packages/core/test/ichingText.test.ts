// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import { HEXAGRAMS } from '../src/systems/iching/hexagrams.ts';
import { allStatements, statementText, ZHOUYI_TEXT, ZHOUYI_TEXT_SOURCE } from '../src/systems/iching/zhouyiText.ts';

describe('the Zhouyi text', () => {
  it('has 64 hexagrams in King Wen order whose names are the engine table\'s', () => {
    expect(ZHOUYI_TEXT).toHaveLength(64);
    for (const [i, h] of ZHOUYI_TEXT.entries()) {
      expect(h.number).toBe(i + 1);
      expect(h.name, `hexagram ${i + 1}`).toBe(HEXAGRAMS[i]!.hanzi);
      expect(h.judgment.length, `${i + 1}.0`).toBeGreaterThan(0);
      expect(h.lines, `hexagram ${i + 1}`).toHaveLength(6);
    }
  });

  it('has 64 judgments, 384 lines and the two extra lines: 450 statements, 386 of them line statements', () => {
    const all = allStatements();
    expect(all).toHaveLength(450);
    expect(all.filter((s) => s.line === 0)).toHaveLength(64);
    expect(all.filter((s) => s.line >= 1)).toHaveLength(386);
    expect(all.filter((s) => s.line >= 1 && s.line <= 6)).toHaveLength(384);
    expect(all.filter((s) => s.line === 7).map((s) => s.id)).toEqual(['1.7', '2.7']);
    expect(new Set(all.map((s) => s.id)).size).toBe(450);
  });

  it('holds only classical characters: no punctuation, markup, spaces or Latin letters, and 無 is written 无', () => {
    for (const s of allStatements()) {
      expect(s.text, s.id).toMatch(/^[㐀-鿿\u{20000}-\u{2ffff}]+$/u);
      expect(s.text, s.id).not.toContain('無');
    }
  });

  it('looks statements up by number and line', () => {
    expect(statementText(1, 0)).toBe('元亨利貞');
    expect(statementText(1, 7)).toBe('見羣龍无首吉');
    expect(statementText(2, 7)).toBe('利永貞');
    expect(statementText(3, 7)).toBeUndefined();
    expect(statementText(65, 0)).toBeUndefined();
    expect(statementText(1, 8)).toBeUndefined();
  });

  it('records where and when the text was taken from', () => {
    expect(ZHOUYI_TEXT_SOURCE.site).toBe('zh.wikisource.org');
    expect(ZHOUYI_TEXT_SOURCE.fetchedOn).toBe('2026-11-19');
  });

  // Compared by eye, on the day of the fetch, with the Zhu Xi edition (Zhouyi benyi, Siku quanshu) on the
  // same site. Each is a statement that reads the same in both; the editions differ elsewhere only in
  // orthographic variants and in a few readings, which the header of the data file lists.
  it('reads the same as a second edition in a handful of statements', () => {
    const second: Array<[string, string]> = [
      ['1.3', '君子終日乾乾夕惕若厲无咎'],
      ['1.7', '見羣龍无首吉'],
      ['63.0', '亨小利貞初吉終亂'],
      ['37.3', '家人嗃嗃悔厲吉婦子嘻嘻終吝'],
      ['27.5', '拂經居貞吉不可涉大川'],
      ['25.5', '无妄之疾勿藥有喜'],
      ['56.5', '射雉一矢亡終以譽命'],
      ['56.4', '旅于處得其資斧我心不快'],
      ['6.0', '有孚窒惕中吉終凶利見大人不利涉大川'],
      ['33.3', '係遯有疾厲畜臣妾吉'],
      ['3.0', '元亨利貞勿用有攸往利建侯'],
      ['44.0', '女壯勿用取女'],
      ['57.6', '巽在牀下喪其資斧貞凶'],
      ['45.0', '王假有廟利見大人亨利貞用大牲吉利有攸往'],
    ];
    const byId = new Map(allStatements().map((s) => [s.id, s.text]));
    for (const [id, text] of second) expect(byId.get(id), id).toBe(text);
  });
});
