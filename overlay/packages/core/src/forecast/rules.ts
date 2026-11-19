// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Loads the rule files and validates them. The JSON under data/ is the source of truth;
 * nothing here restates a rule. Validation is strict so that a typo in a data file fails
 * at load, not in front of a reader.
 */
import baziJson from './data/rules.bazi.json' with { type: 'json' };
import heldBackJson from './data/held-back.json' with { type: 'json' };
import ichingJson from './data/rules.iching.json' with { type: 'json' };
import vedicJson from './data/rules.vedic.json' with { type: 'json' };
import westernJson from './data/rules.western.json' with { type: 'json' };
import { hashOf } from './hash.ts';
import { DIRECTIONS, STAGES, TOPICS, TRADITIONS, type HeldBack, type Rule, type RuleFile, type Tradition } from './types.ts';

export class RuleDataError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`rule data is invalid:\n  ${problems.join('\n  ')}`);
    this.name = 'RuleDataError';
    this.problems = problems;
  }
}

const MAX_QUOTE_WORDS = 25;
const CJK = /[\u2e80-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/g;

/** Words of a quotation. Classical Chinese is allowed in full, so only the other words are counted. */
export function quoteWords(quote: string): number {
  return quote.replace(CJK, ' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isString = (x: unknown): x is string => typeof x === 'string';

/** Checks one rule file and returns it typed, or throws a RuleDataError listing every problem. */
export function validateRuleFile(raw: unknown, tradition: Tradition): RuleFile {
  const problems: string[] = [];
  if (!isObject(raw)) throw new RuleDataError([`${tradition}: file is not an object`]);
  if (raw.tradition !== tradition) problems.push(`${tradition}: tradition field is ${JSON.stringify(raw.tradition)}`);
  if (!isString(raw.method)) problems.push(`${tradition}: method missing`);
  if (!Array.isArray(raw.rules)) throw new RuleDataError([...problems, `${tradition}: rules is not a list`]);
  const rules: Rule[] = [];
  for (const r of raw.rules as unknown[]) {
    const where = `${tradition}/${isObject(r) ? String(r.id) : '?'}`;
    if (!isObject(r)) {
      problems.push(`${where}: not an object`);
      continue;
    }
    const need = (key: string, ok: boolean, what: string): void => {
      if (!ok) problems.push(`${where}: ${key} ${what}`);
    };
    for (const k of ['id', 'name', 'condition', 'template', 'sourceCitation', 'sourceLocator', 'sourceQuote', 'variants']) need(k, isString(r[k]), 'must be a string');
    need('id', isString(r.id) && /^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(r.id), 'must look like family.name');
    need('stage', (STAGES as readonly unknown[]).includes(r.stage), 'is not a known stage');
    need('direction', (DIRECTIONS as readonly unknown[]).includes(r.direction), 'is not a known direction');
    need('strength', r.strength === 1 || r.strength === 2 || r.strength === 3, 'must be 1, 2 or 3');
    need('computable', r.computable === 'now' || r.computable === 'small-addition' || r.computable === 'needs-return-chart', 'must be now, small-addition or needs-return-chart');
    need('verification', r.verification === 'confirmed' || r.verification === 'corrected', 'must be confirmed or corrected');
    need('sourceOpened', typeof r.sourceOpened === 'boolean', 'must be a boolean');
    need('inputs', Array.isArray(r.inputs) && r.inputs.every(isString), 'must be a list of strings');
    need('topics', Array.isArray(r.topics) && r.topics.length > 0 && r.topics.every((t) => (TOPICS as readonly unknown[]).includes(t)), 'must be a non-empty list of known topics');
    if (Array.isArray(r.topics)) need('topics', new Set(r.topics).size === r.topics.length, 'has a repeated topic');
    need('dedupeKey', r.dedupeKey === undefined || isString(r.dedupeKey), 'must be a string');
    need('gatedBy', r.gatedBy === undefined || (Array.isArray(r.gatedBy) && r.gatedBy.every(isString)), 'must be a list of rule ids');
    need('directionByHouse', r.directionByHouse === undefined || (isObject(r.directionByHouse) && Object.values(r.directionByHouse).every((d) => (DIRECTIONS as readonly unknown[]).includes(d))), 'must map houses to directions');
    if (r.directionByBranch !== undefined) {
      const ok = isObject(r.directionByBranch) && Object.values(r.directionByBranch).every((b) => isObject(b) && isString(b.page) && isString(b.quote) && b.quote.trim() !== '' && quoteWords(b.quote) <= MAX_QUOTE_WORDS && (b.direction === undefined || (DIRECTIONS as readonly unknown[]).includes(b.direction)));
      need('directionByBranch', ok, `must map branches to a page, a quotation of at most ${MAX_QUOTE_WORDS} words and an optional direction`);
    }
    if (isString(r.template)) need('template', r.template.length > 0, 'is empty');
    if (r.sourceOpened === true) {
      need('sourceCitation', isString(r.sourceCitation) && r.sourceCitation.trim() !== '', 'is empty although the source is marked opened');
      need('sourceLocator', isString(r.sourceLocator) && r.sourceLocator.trim() !== '', 'is empty although the source is marked opened');
    }
    if (isString(r.sourceQuote)) need('sourceQuote', quoteWords(r.sourceQuote) <= MAX_QUOTE_WORDS, `is over ${MAX_QUOTE_WORDS} words`);
    if (problems.length === 0 || problems.every((p) => !p.startsWith(where))) rules.push({ ...(r as unknown as Rule), tradition });
  }
  if (problems.length) throw new RuleDataError(problems);
  return { tradition, method: raw.method as string, topicDefinitions: (raw.topicDefinitions as unknown[]) ?? [], tables: (raw.tables as Record<string, unknown>) ?? {}, rules };
}

/** Cross-file checks: unique ids, and gatedBy pointing at real rules of the same tradition. */
export function validateRuleSet(files: RuleFile[]): void {
  const problems: string[] = [];
  const seen = new Map<string, Tradition>();
  for (const f of files) for (const r of f.rules) {
    if (seen.has(r.id)) problems.push(`duplicate rule id ${r.id} (${seen.get(r.id)} and ${f.tradition})`);
    seen.set(r.id, f.tradition);
  }
  for (const f of files) for (const r of f.rules) for (const g of r.gatedBy ?? []) {
    if (seen.get(g) !== f.tradition) problems.push(`${r.id}: gatedBy ${g} is not a rule of ${f.tradition}`);
  }
  if (problems.length) throw new RuleDataError(problems);
}

export function validateHeldBack(raw: unknown): HeldBack[] {
  const problems: string[] = [];
  if (!Array.isArray(raw)) throw new RuleDataError(['held-back is not a list']);
  const out: HeldBack[] = [];
  for (const h of raw as unknown[]) {
    if (!isObject(h) || !isString(h.tradition) || !isString(h.id) || !isString(h.kind) || !isString(h.reason) || (h.verdict !== 'unverifiable' && h.verdict !== 'refuted')) {
      problems.push(`held-back entry is malformed: ${JSON.stringify(h)?.slice(0, 80)}`);
      continue;
    }
    if (!(TRADITIONS as readonly string[]).includes(h.tradition)) problems.push(`held-back ${h.id}: unknown tradition`);
    out.push({ tradition: h.tradition, id: h.id, kind: h.kind, verdict: h.verdict, reason: h.reason });
  }
  if (problems.length) throw new RuleDataError(problems);
  return out;
}

export const RULE_FILES: readonly RuleFile[] = [
  validateRuleFile(baziJson, 'bazi'),
  validateRuleFile(vedicJson, 'vedic'),
  validateRuleFile(ichingJson, 'iching'),
  validateRuleFile(westernJson, 'western'),
];
validateRuleSet([...RULE_FILES]);

export const HELD_BACK: readonly HeldBack[] = validateHeldBack(heldBackJson);

export const ALL_RULES: readonly Rule[] = RULE_FILES.flatMap((f) => f.rules);

export function ruleById(id: string): Rule | undefined {
  return ALL_RULES.find((r) => r.id === id);
}

/**
 * The version of a set of rules: a hash of the fields that change what the engine says
 * (id, condition, direction, strength, topics, stage, gatedBy, dedupeKey). Citations and
 * quotations are left out, so correcting a typo in a quote does not invalidate saved work.
 */
export function rulesetVersion(rules: readonly Rule[]): string {
  const behaviour = rules
    .map((r) => ({
      id: r.id,
      condition: r.condition,
      direction: r.direction,
      strength: r.strength,
      topics: [...r.topics].sort(),
      stage: r.stage,
      gatedBy: [...(r.gatedBy ?? [])].sort(),
      dedupeKey: r.dedupeKey ?? null,
      // Only the directions count; pages and quotations may be corrected without a new version.
      ...(r.directionByBranch ? { directionByBranch: Object.fromEntries(Object.entries(r.directionByBranch).map(([k, b]) => [k, b.direction ?? null])) } : {}),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return hashOf(behaviour).slice(0, 16);
}

export const RULESET_VERSION: string = rulesetVersion(ALL_RULES);
