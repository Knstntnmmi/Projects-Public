// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Topics: what each tradition means by each. The definitions are data from topics.json,
 * which was built only from the rule files; nothing here adds a hypothesis.
 */
import topicsJson from './data/topics.json' with { type: 'json' };
import { RuleDataError, ALL_RULES } from './rules.ts';
import { TOPICS, TRADITIONS, type Topic, type Tradition } from './types.ts';

export interface TopicMeaning {
  means: string;
  carriedBy: string;
  differsFrom: string;
  sources: string;
  ruleIds: string[];
}

export interface TopicDefinition {
  id: Topic;
  plain: string;
  notThis: string;
  byTradition: Record<Tradition, TopicMeaning>;
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function load(raw: unknown): TopicDefinition[] {
  const problems: string[] = [];
  const list = isObject(raw) && Array.isArray(raw.topics) ? (raw.topics as unknown[]) : [];
  const out: TopicDefinition[] = [];
  const ruleIds = new Set(ALL_RULES.map((r) => r.id));
  for (const t of list) {
    if (!isObject(t) || !(TOPICS as readonly unknown[]).includes(t.id) || typeof t.plain !== 'string' || typeof t.notThis !== 'string' || !isObject(t.byTradition)) {
      problems.push(`topic entry is malformed: ${JSON.stringify(t)?.slice(0, 60)}`);
      continue;
    }
    const by = {} as Record<Tradition, TopicMeaning>;
    for (const tr of TRADITIONS) {
      const m = (t.byTradition as Record<string, unknown>)[tr];
      const ids = isObject(m) && Array.isArray(m.ruleIds) ? (m.ruleIds as unknown[]) : null;
      if (!isObject(m) || !ids || !ids.every((i) => typeof i === 'string')) {
        problems.push(`topic ${String(t.id)}: tradition ${tr} is malformed`);
        continue;
      }
      for (const i of ids as string[]) if (!ruleIds.has(i)) problems.push(`topic ${String(t.id)}/${tr}: unknown rule ${i}`);
      by[tr] = { means: String(m.means ?? ''), carriedBy: String(m.carriedBy ?? ''), differsFrom: String(m.differsFrom ?? ''), sources: String(m.sources ?? ''), ruleIds: ids as string[] };
    }
    out.push({ id: t.id as Topic, plain: t.plain, notThis: t.notThis, byTradition: by });
  }
  for (const id of TOPICS) if (!out.some((t) => t.id === id)) problems.push(`topic ${id} is not defined`);
  if (problems.length) throw new RuleDataError(problems);
  return out;
}

export const TOPIC_DEFINITIONS: readonly TopicDefinition[] = load(topicsJson);

export function topicDefinition(topic: Topic): TopicDefinition {
  return TOPIC_DEFINITIONS.find((t) => t.id === topic)!;
}

export const DEFAULT_TOPIC: Topic = 'wealth';

/** Short labels printed beside a topic. */
export const TOPIC_NOTES: Readonly<Partial<Record<Topic, string>>> = {
  relationships: 'convention-dependent',
  health: 'tendencies only',
};

/** Number of rules the data declares for a topic and tradition (before asking which are bound). */
export function declaredRuleCount(topic: Topic, tradition: Tradition): number {
  return topicDefinition(topic).byTradition[tradition].ruleIds.length;
}
