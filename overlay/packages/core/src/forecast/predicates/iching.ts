// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Bindings for the I Ching rules (data/rules.iching.json). This tradition is the character
 * of a period, not a forecast about a person: it has no natal promise, it never depends on
 * the nativity at all, and it is labelled experimental everywhere (the framework adds the
 * badge). The calendar part (which hexagram rules a period, the growing or waning of the
 * sovereign hexagram, the cardinal hexagrams) rests on the Han sources the rule file cites;
 * the grading of the Zhouyi's own verdict words is a modern construction (systems/iching/grade.ts).
 *
 * Which statements are "in play" is the engine's choice and is stated here once: the judgment
 * of the gua qi hexagram for its whole period, the line of that hexagram on the day (equal
 * slices of the period, a reconstruction), and the line a solar term gives to a cardinal
 * hexagram in the Dayan calendar. The cue rules look only at these.
 */
import { nextSunLongitude, norm360 } from '../../substrate/sky.ts';
import { SOLAR_TERMS } from '../../substrate/terms.ts';
import { MS } from '../../substrate/time.ts';
import { gradeStatement, gradeText, negatedDetail, type Grade } from '../../systems/iching/grade.ts';
import { hexagramByName, type Hexagram } from '../../systems/iching/hexagrams.ts';
import type { HexagramSpan } from '../../systems/iching/index.ts';
import { GUA_QI_CARDINAL_POSITION, SOVEREIGN_SEQUENCE } from '../../systems/iching/wheels.ts';
import { statementText } from '../../systems/iching/zhouyiText.ts';
import type { ForecastContext } from '../context.ts';
import type { Direction, Fact, Firing, NotEvaluated, RuleBinding } from '../types.ts';
import { AUDIENCE_CUES, cueDirection, directionOfGrade, GOODS_CUES, gradeClause, ILLNESS_CUES, MARRIAGE_CUES, TRAVEL_CUES, type Cue } from './ichingCues.ts';

const CLOCK = 'solar-longitude' as const;
const FOUR_CARDINAL = ['坎', '震', '離', '兌'] as const;
const CARDINAL_NUMBERS: readonly number[] = FOUR_CARDINAL.map((n) => hexagramByName(n).number);

/** A statement in play, and when. */
interface Occurrence {
  id: string;
  number: number;
  line: number;
  startUtcMs: number;
  endUtcMs: number;
  how: string;
}

interface LineSlice {
  hexagram: Hexagram;
  line: number;
  startUtcMs: number;
  endUtcMs: number;
}

interface TermLine {
  term: string;
  hexagram: Hexagram;
  line: number;
  startUtcMs: number;
  endUtcMs: number;
}

export interface IchingContext {
  periods: HexagramSpan[];
  slices: LineSlice[];
  terms: TermLine[];
  occurrences: Occurrence[];
}

const isoDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const hexName = (h: Hexagram): string => `${h.hanzi} (${h.number})`;

const gradeCache = new Map<string, Grade>();
/** The grade of a whole statement by id; the text never changes, so it is graded once. */
function gradeOf(id: string, text: string): Grade {
  let g = gradeCache.get(id);
  if (!g) {
    g = gradeStatement(text);
    gradeCache.set(id, g);
  }
  return g;
}

const tokensText = (g: Grade): string => (g.tokens.length === 0 ? 'none' : g.tokens.map((t) => t.token).join('、'));
const flagText = (g: Grade): string => g.flags.join(', ');

/** The sovereign hexagram of the month that holds the instant, or null outside the span. */
function sovereignAt(ctx: ForecastContext, ms: number): Hexagram | null {
  for (const s of ctx.sovereign()) if (s.startUtcMs <= ms && ms < s.endUtcMs) return s.hexagram;
  return null;
}

/** The 24 solar terms from the winter solstice, each with the cardinal hexagram and line the Dayan calendar gives it. */
function termLines(startMs: number, endMs: number): TermLine[] {
  const out: TermLine[] = [];
  let solstice = nextSunLongitude(270, startMs - 400 * MS.DAY);
  for (let next = nextSunLongitude(270, solstice + 300 * MS.DAY); next <= startMs; next = nextSunLongitude(270, solstice + 300 * MS.DAY)) solstice = next;
  while (solstice < endMs) {
    const edges: number[] = [solstice];
    for (let k = 1; k < 24; k++) edges.push(nextSunLongitude(norm360(270 + 15 * k), edges[k - 1]!));
    edges.push(nextSunLongitude(270, edges[23]!));
    for (let k = 0; k < 24; k++) {
      const info = SOLAR_TERMS[(21 + k) % 24]!;
      out.push({
        term: `${info.hanzi} (${info.pinyin})`,
        hexagram: hexagramByName(FOUR_CARDINAL[Math.floor(k / 6)]!),
        line: (k % 6) + 1,
        startUtcMs: edges[k]!,
        endUtcMs: edges[k + 1]!,
      });
    }
    solstice = edges[24]!;
  }
  return out.filter((t) => t.endUtcMs > startMs && t.startUtcMs < endMs);
}

/**
 * Everything the rules share, built once per evaluation. None of it depends on the nativity:
 * the calendar is the calendar. Lines are equal slices of a period, line = 1 + floor(6 (t - t0) / (t1 - t0)),
 * and are not given to the cardinal periods (position 60 and above), which the Han sources do not slice that way.
 */
export function buildContext(base: ForecastContext): IchingContext {
  const { startUtcMs, endUtcMs } = base.input.span;
  const periods = base.guaQi();
  const slices: LineSlice[] = [];
  for (const p of periods) {
    if (p.position >= GUA_QI_CARDINAL_POSITION) continue;
    const edge = (k: number): number => (k === 6 ? p.endUtcMs : Math.round(p.startUtcMs + ((p.endUtcMs - p.startUtcMs) * k) / 6));
    for (let k = 0; k < 6; k++) {
      const a = edge(k);
      const b = edge(k + 1);
      if (b > startUtcMs && a < endUtcMs) slices.push({ hexagram: p.hexagram, line: k + 1, startUtcMs: a, endUtcMs: b });
    }
  }
  const terms = termLines(startUtcMs, endUtcMs);
  const occurrences: Occurrence[] = [
    ...periods.map((p) => ({ id: `${p.hexagram.number}.0`, number: p.hexagram.number, line: 0, startUtcMs: p.startUtcMs, endUtcMs: p.endUtcMs, how: 'judgment of the gua qi hexagram' })),
    ...slices.map((s) => ({ id: `${s.hexagram.number}.${s.line}`, number: s.hexagram.number, line: s.line, startUtcMs: s.startUtcMs, endUtcMs: s.endUtcMs, how: 'line of the gua qi hexagram by equal slice' })),
    ...terms.map((t) => ({ id: `${t.hexagram.number}.${t.line}`, number: t.hexagram.number, line: t.line, startUtcMs: t.startUtcMs, endUtcMs: t.endUtcMs, how: 'line given by the solar term (Dayan)' })),
  ];
  return { periods, slices, terms, occurrences };
}

const ext = (ctx: ForecastContext): IchingContext => ctx.extension<IchingContext>('iching')!;

function statementFacts(id: string, text: string, g: Grade): Fact[] {
  const negated = negatedDetail(g);
  return [
    { key: 'id', label: 'Statement', value: id },
    { key: 'text', label: 'Statement text', value: text },
    { key: 'grade', label: 'Grade of the verdict words (-3 to +3)', value: gradeText(g) },
    { key: 'flag', label: 'Grade flags', value: flagText(g) },
    { key: 'tokens', label: 'Verdict words counted', value: tokensText(g) },
    ...(negated === null ? [] : [{ key: 'negated', label: 'Words not graded', value: negated }]),
  ];
}

/**
 * A statement of grade 0 has no verdict to report under 'general'. Where a cue rule names it for
 * a topic that rule attaches it; where none does it is attached to no topic and these rules say nothing of it.
 */
const attachedToGeneral = (g: Grade): boolean => g.grade !== 0;

const judgment: RuleBinding = {
  ruleId: 'zhouyi.period-hexagram-judgment',
  tradition: 'iching',
  fire(ctx) {
    return ext(ctx).periods.flatMap((p): Firing[] => {
      const id = `${p.hexagram.number}.0`;
      const text = statementText(p.hexagram.number, 0)!;
      const g = gradeOf(id, text);
      if (!attachedToGeneral(g)) return [];
      // When the gua qi hexagram is also the month's sovereign one, there is one reading and it says so.
      const sov = sovereignAt(ctx, Math.round((p.startUtcMs + p.endUtcMs) / 2));
      return [{
        clock: CLOCK,
        startUtcMs: p.startUtcMs,
        endUtcMs: p.endUtcMs,
        facts: [
          { key: 'start', label: 'Period starts', value: isoDate(p.startUtcMs) },
          { key: 'end', label: 'Period ends', value: isoDate(p.endUtcMs) },
          { key: 'hexName', label: 'Hexagram', value: hexName(p.hexagram) },
          ...statementFacts(id, text, g),
        ],
        direction: directionOfGrade(g),
        conventionsUsed: ['guaQi'],
        badges: sov && sov.number === p.hexagram.number ? ['also the sovereign hexagram of the month'] : [],
      }];
    });
  },
};

const lineOfDay: RuleBinding = {
  ruleId: 'zhouyi.line-of-day-reconstruction',
  tradition: 'iching',
  fire(ctx) {
    return ext(ctx).slices.flatMap((s): Firing[] => {
      const id = `${s.hexagram.number}.${s.line}`;
      const text = statementText(s.hexagram.number, s.line)!;
      const g = gradeOf(id, text);
      if (!attachedToGeneral(g)) return [];
      return [{
        clock: CLOCK,
        startUtcMs: s.startUtcMs,
        endUtcMs: s.endUtcMs,
        facts: [
          { key: 'date', label: 'Day', value: isoDate(s.startUtcMs) },
          { key: 'hexName', label: 'Hexagram', value: hexName(s.hexagram) },
          { key: 'line', label: 'Line (1 = bottom)', value: s.line },
          ...statementFacts(id, text, g),
        ],
        direction: directionOfGrade(g),
        conventionsUsed: ['guaQi'],
        badges: ['reconstruction'],
      }];
    });
  },
};

const dayan: RuleBinding = {
  ruleId: 'dayan.cardinal-line-by-term',
  tradition: 'iching',
  fire(ctx) {
    return ext(ctx).terms.flatMap((t): Firing[] => {
      const id = `${t.hexagram.number}.${t.line}`;
      const text = statementText(t.hexagram.number, t.line)!;
      const g = gradeOf(id, text);
      if (!attachedToGeneral(g)) return [];
      return [{
        clock: CLOCK,
        startUtcMs: t.startUtcMs,
        endUtcMs: t.endUtcMs,
        facts: [
          { key: 'term', label: 'Solar term', value: t.term },
          { key: 'hexName', label: 'Hexagram', value: hexName(t.hexagram) },
          { key: 'line', label: 'Line (1 = bottom)', value: t.line },
          ...statementFacts(id, text, g),
        ],
        badges: ['inference from one sentence'],
      }];
    });
  },
};

const sovereign: RuleBinding = {
  ruleId: 'yiwei.growing-waning-sovereign',
  tradition: 'iching',
  fire(ctx) {
    return ctx.sovereign().map((s): Firing => {
      const growing = SOVEREIGN_SEQUENCE.findIndex((h) => h.number === s.hexagram.number) < 6;
      return {
        clock: CLOCK,
        startUtcMs: s.startUtcMs,
        endUtcMs: s.endUtcMs,
        facts: [
          { key: 'hexName', label: 'Sovereign hexagram', value: hexName(s.hexagram) },
          { key: 'growing_or_waning', label: 'Growing or waning', value: growing ? 'growing' : 'waning' },
          { key: 'emolument_or_punishment', label: 'Assigned by the Yi wei', value: growing ? 'emolument (祿)' : 'punishment (刑)' },
        ],
        direction: growing ? 'favourable' : 'unfavourable',
        conventionsUsed: ['sovereignBoundary'],
      };
    });
  },
};

// The cardinal hexagrams are periods of their own only in Jing Fang's allotment, which is the
// engine's `jing-fang` guaQi convention. Under the others no gua qi hexagram is a cardinal one
// and the marker never fires; that is what the condition says.
const cardinalMarker: RuleBinding = {
  ruleId: 'yiwei.cardinal-hexagram-arms',
  tradition: 'iching',
  fire(ctx) {
    return ext(ctx)
      .periods.filter((p) => p.position >= GUA_QI_CARDINAL_POSITION && CARDINAL_NUMBERS.includes(p.hexagram.number))
      .map(
        (p): Firing => ({
          clock: CLOCK,
          startUtcMs: p.startUtcMs,
          endUtcMs: p.endUtcMs,
          facts: [{ key: 'hexName', label: 'Cardinal hexagram', value: hexName(p.hexagram) }],
          conventionsUsed: ['guaQi'],
        }),
      );
  },
};

interface CueRuleOptions {
  ruleId: string;
  cues: readonly Cue[];
  /** Extra facts and badges for one cue. */
  extra?: (cue: Cue) => { facts?: Fact[]; badges?: string[] };
}

/** A cue rule fires when a statement it names is in play; the sign is that of its clause, never of the whole statement. */
function cueBinding(o: CueRuleOptions): RuleBinding {
  const byId = new Map(o.cues.map((c) => [c.id, c]));
  return {
    ruleId: o.ruleId,
    tradition: 'iching',
    fire(ctx) {
      const out: Firing[] = [];
      for (const occ of ext(ctx).occurrences) {
        const cue = byId.get(occ.id);
        if (!cue) continue;
        const text = statementText(occ.number, occ.line)!;
        const g = gradeClause(cue.clause);
        const more = o.extra?.(cue);
        const direction: Direction = cueDirection(cue, g);
        out.push({
          clock: CLOCK,
          startUtcMs: occ.startUtcMs,
          endUtcMs: occ.endUtcMs,
          facts: [
            { key: 'id', label: 'Statement', value: occ.id },
            { key: 'text', label: 'Statement text', value: text },
            { key: 'clause', label: 'Clause the rule grades', value: cue.clause },
            { key: 'grade', label: 'Grade of the clause (-3 to +3)', value: gradeText(g) },
            { key: 'via', label: 'In play as', value: occ.how },
            ...(negatedDetail(g) === null ? [] : [{ key: 'negated', label: 'Words not graded', value: negatedDetail(g)! }]),
            ...(more?.facts ?? []),
          ],
          direction,
          conventionsUsed: occ.how.startsWith('line given') ? [] : ['guaQi'],
          badges: [...(cue.note ? [cue.note] : []), ...(more?.badges ?? [])],
        });
      }
      return out;
    },
  };
}

const travel = cueBinding({
  ruleId: 'zhouyi.cue-travel',
  cues: TRAVEL_CUES,
  extra: (cue) => {
    const t = TRAVEL_CUES.find((c) => c.id === cue.id)!;
    return { facts: [{ key: 'positive_or_negative', label: 'Wording', value: t.stated === 'favourable' ? 'positive' : 'negative' }], badges: t.goAhead ? ['undertaking or journey'] : [] };
  },
});
const audience = cueBinding({ ruleId: 'zhouyi.cue-audience', cues: AUDIENCE_CUES });
const marriage = cueBinding({ ruleId: 'zhouyi.cue-marriage', cues: MARRIAGE_CUES });
const illness = cueBinding({ ruleId: 'zhouyi.cue-illness', cues: ILLNESS_CUES });
const goods = cueBinding({ ruleId: 'zhouyi.cue-goods', cues: GOODS_CUES });

/** One binding per rule the engine can evaluate. */
export const BINDINGS: readonly RuleBinding[] = [judgment, lineOfDay, dayan, sovereign, cardinalMarker, travel, audience, marriage, illness, goods];

/** Rules deliberately not evaluated, each with the reason; the registry lists them. */
export const NOT_EVALUATED: readonly NotEvaluated[] = [
  {
    ruleId: 'zhouyi.statement-grade',
    reason: 'this rule is the grading method the other I Ching rules use; it names no period of its own, so each statement it grades is shown by the rule that puts it in play',
  },
];

/** Set to true when every rule of this tradition is bound or listed above; the registry test then enforces it. */
export const COMPLETE = true;

/** The I Ching is the character of a period, not a yearly forecast: see periodCharacter in ../period.ts. */
export const PERIOD_READ = true;
