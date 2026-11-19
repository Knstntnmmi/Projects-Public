// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ALL_RULES,
  canonicalJson,
  DIRECTIONS,
  HELD_BACK,
  hashOf,
  quoteWords,
  RULE_FILES,
  RULESET_VERSION,
  rulesetVersion,
  RuleDataError,
  sha256Hex,
  STAGES,
  TOPIC_DEFINITIONS,
  TOPICS,
  TRADITIONS,
  validateHeldBack,
  validateRuleFile,
  validateRuleSet,
  type Rule,
} from '../../src/forecast/index.ts';

const good = (): Record<string, unknown> => JSON.parse(JSON.stringify(RULE_FILES.find((f) => f.tradition === 'iching')));
const withRule = (patch: Record<string, unknown>): unknown => {
  const f = good() as { rules: Array<Record<string, unknown>> };
  f.rules = [{ ...f.rules[0], ...patch }];
  return f;
};

describe('the rule files', () => {
  it('load with the counts the specification states', () => {
    const n = Object.fromEntries(RULE_FILES.map((f) => [f.tradition, f.rules.length]));
    expect(n).toEqual({ bazi: 39, vedic: 36, iching: 11, western: 56 });
    expect(ALL_RULES).toHaveLength(142);
  });

  it('every rule has its required fields, valid enums, a weight of 1 to 3 and a unique id', () => {
    const ids = new Set<string>();
    for (const r of ALL_RULES) {
      expect(ids.has(r.id), r.id).toBe(false);
      ids.add(r.id);
      expect(STAGES).toContain(r.stage);
      expect(DIRECTIONS).toContain(r.direction);
      expect([1, 2, 3]).toContain(r.strength);
      expect(['confirmed', 'corrected']).toContain(r.verification);
      expect(['now', 'small-addition', 'needs-return-chart']).toContain(r.computable);
      expect(r.topics.length).toBeGreaterThan(0);
      for (const t of r.topics) expect(TOPICS).toContain(t);
      expect(r.template.length).toBeGreaterThan(0);
      expect(r.condition.length).toBeGreaterThan(0);
      if (r.sourceOpened) {
        expect(r.sourceCitation.trim()).not.toBe('');
        expect(r.sourceLocator.trim()).not.toBe('');
      }
      expect(quoteWords(r.sourceQuote), r.id).toBeLessThanOrEqual(25);
    }
  });

  it('keep each rule in the file of its own tradition', () => {
    for (const f of RULE_FILES) for (const r of f.rules) expect(r.tradition).toBe(f.tradition);
    expect(RULE_FILES.map((f) => f.tradition)).toEqual(['bazi', 'vedic', 'iching', 'western']);
  });

  it('keep every held-back id out of the rule files', () => {
    const ids = new Set(ALL_RULES.map((r) => r.id));
    expect(HELD_BACK.length).toBe(29);
    for (const h of HELD_BACK) {
      expect(ids.has(h.id), h.id).toBe(false);
      expect(TRADITIONS).toContain(h.tradition);
    }
  });

  it('carry no rule with a gate, as the specification says', () => {
    expect(ALL_RULES.filter((r) => r.gatedBy && r.gatedBy.length)).toEqual([]);
  });

  it('do not use any word the phrasebook forbids, in any rule template', async () => {
    const { BANNED_WORDS } = await import('../../src/forecast/phrasebook.ts');
    for (const r of ALL_RULES) expect(r.template.match(BANNED_WORDS), r.id).toBeNull();
  });

  it('name no real person: every example in a rule file is a template, never a date-time', () => {
    for (const r of ALL_RULES) expect(JSON.stringify(r)).not.toMatch(/\b(19|20)\d\d-\d\d-\d\d\b/);
  });
});

describe('validation', () => {
  it('accepts the shipped data and returns typed rules', () => {
    expect(validateRuleFile(good(), 'iching').rules.length).toBe(11);
  });

  it('rejects, naming the rule and the field', () => {
    const cases: Array<[Record<string, unknown>, RegExp]> = [
      [{ strength: 4 }, /strength must be 1, 2 or 3/],
      [{ strength: 0 }, /strength must be 1, 2 or 3/],
      [{ stage: 'later' }, /stage is not a known stage/],
      [{ direction: 'good' }, /direction is not a known direction/],
      [{ topics: [] }, /topics must be a non-empty list/],
      [{ topics: ['money'] }, /topics must be a non-empty list of known topics/],
      [{ topics: ['wealth', 'wealth'] }, /repeated topic/],
      [{ verification: 'rumoured' }, /verification must be confirmed or corrected/],
      [{ computable: 'not-computable' }, /computable must be now, small-addition or needs-return-chart/],
      [{ id: 'NoDots' }, /must look like family.name/],
      [{ template: '' }, /template is empty/],
      [{ sourceOpened: true, sourceCitation: ' ' }, /sourceCitation is empty although the source is marked opened/],
      [{ sourceOpened: true, sourceLocator: '' }, /sourceLocator is empty/],
      [{ sourceQuote: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one twenty-two twenty-three twenty-four twenty-five twenty-six' }, /over 25 words/],
      [{ gatedBy: 'x' }, /gatedBy must be a list/],
      [{ inputs: 'x' }, /inputs must be a list/],
      [{ sourceOpened: 'yes' }, /sourceOpened must be a boolean/],
    ];
    for (const [patch, message] of cases) expect(() => validateRuleFile(withRule(patch), 'iching'), JSON.stringify(patch)).toThrow(message);
    expect(() => validateRuleFile(withRule({ name: undefined }), 'iching')).toThrow(RuleDataError);
    expect(() => validateRuleFile({ ...(good() as object), tradition: 'bazi' }, 'iching')).toThrow(/tradition field/);
    expect(() => validateRuleFile(null, 'iching')).toThrow(RuleDataError);
    expect(() => validateRuleFile({ tradition: 'iching', method: 'x' }, 'iching')).toThrow(/rules is not a list/);
  });

  it('allows a long classical Chinese quotation, counting only the other words', () => {
    expect(quoteWords('傷官見官，為禍百端')).toBe(0);
    expect(quoteWords('傷官見官 means the hurting officer meets the officer')).toBe(7);
    expect(() => validateRuleFile(withRule({ sourceQuote: '傷官見官，為禍百端'.repeat(10) }), 'iching')).not.toThrow();
  });

  it('rejects duplicate ids across files and a gate pointing nowhere', () => {
    const a = validateRuleFile(good(), 'iching');
    const b = validateRuleFile(good(), 'iching');
    expect(() => validateRuleSet([a, b])).toThrow(/duplicate rule id/);
    const gated: Rule = { ...a.rules[0]!, id: 'zhouyi.gated', gatedBy: ['nothing.here'] };
    expect(() => validateRuleSet([{ ...a, rules: [gated] }])).toThrow(/gatedBy nothing.here/);
  });

  it('checks the held-back list', () => {
    expect(() => validateHeldBack({})).toThrow(RuleDataError);
    expect(() => validateHeldBack([{ tradition: 'bazi', id: 'x' }])).toThrow(/malformed/);
    expect(() => validateHeldBack([{ tradition: 'mars', id: 'x.y', kind: 'rule', verdict: 'refuted', reason: 'r' }])).toThrow(/unknown tradition/);
  });
});

describe('the ruleset version', () => {
  it('is a short hash of the behaviour fields only', () => {
    expect(RULESET_VERSION).toMatch(/^[0-9a-f]{16}$/);
    expect(rulesetVersion(ALL_RULES)).toBe(RULESET_VERSION);
    // Pinned so that an accidental edit of a rule file is noticed; change it when a rule is changed on purpose.
    // Changed once on purpose when the verified Western rule file replaced the earlier file's (56 rules).
    // Changed again on purpose when the page was re-read for three Western rules: the direction of
    // lilly.revolution.lord2-fortune-house became a pointer, valens.critical-year-node lost its same-sign branch, and
    // the aspects of lilly.transit.daily-cusps were restricted by cluster.
    // Changed a third time on purpose in a later revision: six Valens quotations and a file path left the data,
    // the goods, wealth-houses, jupiter-year-sign, return and day-transit templates were reworded.
    // Changed a fourth time on purpose: the peer rule got its own dedupeKey, the blade rule became a note, the two honour rules took their directions branch by branch from the printed page, and the Vedic wording was changed.
    // Changed a fifth time on purpose: the strength-score and peer templates no longer print a number, and two condition texts say the project's own reading.
    // Changed a sixth time: the wording of notes in the rule data changed and no rule changed.
    // Changed a seventh time: one condition text now says 'no source read' instead of 'no source'.
    expect(RULESET_VERSION).toBe('ad087fc394c58c6f');
  });

  it('does not change when a quotation, citation, name or variant is corrected, and does when behaviour changes', () => {
    const r = ALL_RULES;
    const edit = (patch: Partial<Rule>): string => rulesetVersion(r.map((x, i) => (i === 3 ? { ...x, ...patch } : x)));
    expect(edit({ sourceQuote: 'a corrected quotation' })).toBe(RULESET_VERSION);
    expect(edit({ sourceCitation: 'another edition' })).toBe(RULESET_VERSION);
    expect(edit({ name: 'a better name', template: 'a better {sentence}', variants: 'v', sourceLocator: 'p. 1' })).toBe(RULESET_VERSION);
    expect(edit({ condition: r[3]!.condition + ' ' })).not.toBe(RULESET_VERSION);
    expect(edit({ strength: r[3]!.strength === 1 ? 2 : 1 })).not.toBe(RULESET_VERSION);
    expect(edit({ direction: r[3]!.direction === 'mixed' ? 'favourable' : 'mixed' })).not.toBe(RULESET_VERSION);
    expect(edit({ dedupeKey: 'something-else' })).not.toBe(RULESET_VERSION);
    expect(edit({ topics: ['general', 'home-travel'] })).not.toBe(RULESET_VERSION);
    expect(rulesetVersion([...r].reverse())).toBe(RULESET_VERSION);
    // A page, a quotation or a note without a direction in directionByBranch may be corrected; a direction may not.
    const honour = ALL_RULES.find((x) => x.id === 'lilly.career.honour-angularity')!;
    const withBranch = (patch: Record<string, unknown>): string =>
      rulesetVersion(r.map((x) => (x.id === honour.id ? { ...x, directionByBranch: { ...x.directionByBranch, angular: { ...x.directionByBranch!.angular!, ...patch } } } : x)));
    expect(withBranch({ quote: 'a corrected quotation', page: '99' })).toBe(RULESET_VERSION);
    expect(withBranch({ direction: 'unfavourable' })).not.toBe(RULESET_VERSION);
  });
});

describe('topics.json', () => {
  it('defines all seven topics for all four traditions, and every rule id it names exists with that topic', () => {
    expect(TOPIC_DEFINITIONS.map((t) => t.id).sort()).toEqual([...TOPICS].sort());
    const byId = new Map(ALL_RULES.map((r) => [r.id, r]));
    for (const t of TOPIC_DEFINITIONS) {
      for (const tr of TRADITIONS) {
        for (const id of t.byTradition[tr].ruleIds) {
          expect(byId.get(id)!.tradition).toBe(tr);
          expect(byId.get(id)!.topics, `${t.id} lists ${id}`).toContain(t.id);
        }
      }
    }
  });
});

describe('hash', () => {
  const texts = ['', 'abc', 'The quick brown fox jumps over the lazy dog', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000), '傷官見官，為禍百端', '{"k":[1,2,3]}'];
  it('equals the platform SHA-256 for short, block-edge, long and non-Latin text', () => {
    for (const t of texts) expect(sha256Hex(t), t.slice(0, 20)).toBe(createHash('sha256').update(t).digest('hex'));
  });
  it('writes canonical JSON with sorted keys, so equal data hashes equally', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe('{"a":[2,{"d":1}],"b":1}');
    expect(hashOf({ a: 1, b: 2 })).toBe(hashOf({ b: 2, a: 1 }));
    expect(hashOf({ a: 1 })).not.toBe(hashOf({ a: 2 }));
    expect(canonicalJson(undefined)).toBe('null');
  });
});
