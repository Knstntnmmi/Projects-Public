// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The four traditions together: Western firings carry their levels into the statement list,
 * the year view and the agreement display, and the plain wording faults the first full
 * read found stay fixed.
 */
import { describe, expect, it } from 'vitest';
import { agreementDisplay, DEFAULT_TRADITIONS, evaluate, fillTemplate, LEVEL_LABEL, makeInput, singularHouse, statementList, yearView } from '../../src/forecast/index.ts';
import { makeMoment } from '../../src/substrate/time.ts';
import { fixture } from '../../../../fixtures/moments.ts';

const run = (id: string, conv = {}) => {
  const f = fixture(id);
  return evaluate(makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2031, toYear: 2040, forecastConventions: conv }), { topics: ['wealth'], runs: 20, seed: 1 });
};

describe('Western in the default forecast', () => {
  it('is switched on with the other three traditions', () => {
    expect([...DEFAULT_TRADITIONS].sort()).toEqual(['bazi', 'iching', 'vedic', 'western']);
  });

  it.each(['j2000', 'southern'])('puts its statements on named Western levels in the statement list, the year view and the agreement display (%s)', (id) => {
    const res = run(id);
    const list = statementList(res, 'wealth');
    // the pointers are no entry of the list, so the levels are read from the entries and the pointers together
    const western = [...list.dated, ...list.pointers].filter((e) => e.tradition === 'western');
    expect(western.length).toBeGreaterThan(0);
    const levels = new Set(western.map((e) => e.level));
    expect(levels.has('western-profection')).toBe(true);
    expect(levels.has('western-solar-return')).toBe(true);
    for (const e of western) {
      expect(['western-profection', 'western-firdaria', 'western-solar-return', 'western-transits']).toContain(e.level);
      expect(e.levelLabel).toBe(LEVEL_LABEL[e.level]);
    }
    const view = yearView(res, 'wealth');
    for (const y of view.years) {
      const cell = y.levels.find((c) => c.level === 'western-profection');
      expect(cell).toBeDefined();
      expect(y.headline).toContain(LEVEL_LABEL['western-profection']);
      for (const c of y.levels) for (const r of c.entries) expect(list.dated.some((e) => e.signalIds.includes(r.signalId) && e.level === c.level)).toBe(true);
    }
    const agreement = agreementDisplay(res, 'wealth');
    expect(agreement.shown).toBe(true);
  });

  it('names no internal group id in the agreement notes', () => {
    const agreement = agreementDisplay(run('j2000'), 'wealth');
    if (!agreement.shown) throw new Error('expected a strip');
    const notes = agreement.years.flatMap((y) => y.notes).join(' | ');
    expect(notes).toContain('clocks counted from the birth moment');
    expect(notes).not.toMatch(/birth-arithmetic|-sidereal|-tropical/);
  });
});

describe('plain wording', () => {
  it('says "house" for a list of one house and "houses" for several', () => {
    expect(singularHouse('stand in houses 7: Lilly')).toBe('stand in house 7: Lilly');
    expect(singularHouse('stand in houses 1, 2 and 9: Lilly')).toBe('stand in houses 1, 2 and 9: Lilly');
    expect(singularHouse('stand in houses 1 and 9: Lilly')).toBe('stand in houses 1 and 9: Lilly');
    expect(singularHouse('stand in houses 10 and 12:')).toBe('stand in houses 10 and 12:');
    expect(singularHouse('lords of houses 4 and 5')).toBe('lords of houses 4 and 5');
  });

  it('applies it when a rule template is filled', () => {
    const one = fillTemplate('t', 'The significators stand in houses {houses}: x.', [{ key: 'houses', label: 'Houses', value: '7' }]);
    expect(one).toBe('The significators stand in house 7: x.');
  });

  it('prints "house 7" for the real southern chart', () => {
    const list = statementList(run('southern'), 'wealth');
    // the sentence names where the significators stand and gives no direction, so it is a pointer
    const line = list.natalPointers.find((e) => e.ruleId === 'lilly.wealth.life-phase');
    expect(line?.sentence).toContain('stand in house 7:');
    for (const e of [...list.natal, ...list.natalPointers, ...list.dated, ...list.pointers]) expect(e.sentence).not.toMatch(/\bhouses \d+(?![\d,]| and)/);
  });
});
