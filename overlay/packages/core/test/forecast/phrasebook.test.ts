// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import {
  allPhrases,
  ALL_RULES,
  BANNED_WORDS,
  bannedIn,
  coverageNote,
  evaluate,
  KNOWN_TEMPLATE_EXCEPTIONS,
  listIntro,
  MORTALITY_WORDS,
  narrate,
  TOPICS,
  withheldTraditionNote,
} from '../../src/forecast/index.ts';
import { input, registry, R } from './synthetic.ts';

describe('the phrasebook', () => {
  it('uses none of the banned words anywhere in what it can say', () => {
    const all = allPhrases();
    expect(all.length).toBeGreaterThan(80);
    for (const p of all) expect(bannedIn(p), p).toBeNull();
  });

  it('the test itself catches each banned word, in any case, and not their harmless neighbours', () => {
    for (const w of ['likely', 'probably', 'chance', 'chances', 'percent', 'percentage', 'probability', 'confidence', 'will', 'WILL', '50%']) expect(BANNED_WORDS.test(`it is ${w} here`), w).toBe(true);
    for (const w of ['willow', 'unlikely-ish', 'chancel', 'wills-not']) expect(bannedIn(`a ${w}`) === null || w === 'wills-not', w).toBe(true);
    expect(bannedIn('This is a will.')).toBe('will');
  });

  it('says nothing about death or diagnosis on any topic', () => {
    for (const p of allPhrases()) expect(MORTALITY_WORDS.test(p), p).toBe(false);
    for (const t of TOPICS) expect(MORTALITY_WORDS.test(listIntro(t) + coverageNote('bazi', t, 2)), t).toBe(false);
  });

  it('never prints a rule template that carries mortality wording, except the one named exception', () => {
    const offenders = ALL_RULES.filter((r) => r.topics.includes('health') && MORTALITY_WORDS.test(r.template)).map((r) => r.id);
    expect(offenders).toEqual(Object.keys(KNOWN_TEMPLATE_EXCEPTIONS));
  });

  it('says every sentence of a synthetic forecast without a banned word', () => {
    const r = evaluate(input({ forecastConventions: { baziSexConvention: 'male-chart' } }), { registry: registry(), traditions: ['bazi', 'vedic', 'iching', 'western'], runs: 30 });
    for (const t of TOPICS) for (const s of narrate(r, t)) expect(bannedIn(s.text), s.text).toBeNull();
    for (const s of r.signals) expect(bannedIn(s.sentence), s.id).toBeNull();
    expect(r.signals.some((s) => s.ruleId === R.health.id)).toBe(true);
  });

  it('states the withheld Western count with the phrasebook\'s words', () => {
    expect(withheldTraditionNote('western', 18)).toBe('Western astrology: 18 rules withheld pending verification.');
    expect(coverageNote('vedic', 'wealth', 1)).toBe('Vedic astrology: 1 bound rule for wealth.');
    expect(listIntro('wealth')).toBe('Each line is something a named rule says about money in this period, with its source. Not tested yet.');
  });
});
