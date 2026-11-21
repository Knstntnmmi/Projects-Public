// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Bindings of the BaZi natal-promise rules. Each reads the natal assessment (assessment.ts)
 * and fires once or more, always undated: a natal signal is context for the reader and
 * never part of a slice. Precedence among grades is the one the rule's own condition states;
 * where a condition leaves a case uncovered the rule fires nothing for it.
 */
import { BRANCHES, STEMS, tenGod } from '../../../systems/bazi/index.ts';
import {
  clashOf,
  generatedBy,
  mainQi,
  overcomeBy,
  PILLAR_NAMES,
  stemsCombine,
  twelveStage,
  branchAtStage,
  type Kin,
  type PillarName,
} from '../../../systems/bazi/relations.ts';
import type { ForecastContext } from '../../context.ts';
import type { Direction, Fact, Firing, Rule, RuleBinding, Topic } from '../../types.ts';
import {
  assessNatal,
  controllerOf,
  elementLabel,
  elementPresent,
  isRooted,
  kinChars,
  listChars,
  starsOf,
  units,
  weightOf,
  type NatalAssessment,
  type NatalChar,
} from './assessment.ts';

/** What this tradition's context builder returns; later binders add their own fields beside `natal`. */
export interface BaziContext {
  natal: NatalAssessment;
}

export function buildNatalContext(base: ForecastContext): BaziContext {
  return { natal: assessNatal(base.pillars(), base.input.forecastConventions) };
}

export const natalOf = (ctx: ForecastContext): NatalAssessment => ctx.extension<BaziContext>('bazi')!.natal;

export const fact = (key: string, label: string, value: string | number): Fact => ({ key, label, value });

/** Natal firings carry no date; the clock only says which group they belong to. */
export function natalFiring(facts: Fact[], rest: Partial<Omit<Firing, 'facts' | 'clock' | 'startUtcMs' | 'endUtcMs'>> = {}): Firing {
  return { clock: 'birthday', startUtcMs: null, endUtcMs: null, facts, ...rest };
}

const round1 = (x: number): number => Math.round(x * 10) / 10;
const hanzi = (stem: number): string => STEMS[stem]!.hanzi;

export const bind = (ruleId: string, fire: RuleBinding['fire'], requires: RuleBinding['requires'] = { birthTime: true }): RuleBinding => ({ ruleId, tradition: 'bazi', requires, fire });

// ---------------------------------------------------------------------------
// Assessment rules
// ---------------------------------------------------------------------------

const monthState = bind(
  'bazi.month-state',
  (ctx) => {
    const a = natalOf(ctx);
    return [
      natalFiring(
        [fact('dayStem', 'Day master', hanzi(a.dayStem)), fact('state', 'State in the month', a.monthState.state), fact('monthBranch', 'Month branch', a.pillars.month.branch.hanzi), fact('deLing', 'In season', a.monthState.deLing ? '得令' : '失令')],
        { conventionsUsed: ['baziEarthSeasons'], dedupeInstance: 'natal' },
      ),
    ];
  },
  // The month and the day stem need the date only, not the hour.
  { birthTime: false },
);

const twelveStages = bind('bazi.twelve-stages', (ctx) => {
  const a = natalOf(ctx);
  return PILLAR_NAMES.map((pillar) => {
    const branch = a.pillars[pillar].branch;
    const st = twelveStage(a.dayStem, branch.index, { school: a.school, yinReverse: a.yinReverse });
    return natalFiring([fact('stage', 'Stage', st.name), fact('class', 'Class', st.class), fact('pillarName', 'Pillar', pillar), fact('branch', 'Branch', branch.hanzi)], {
      conventionsUsed: ['baziEarthStages', 'baziYinStageReverse'],
      dedupeInstance: `natal-${pillar}`,
    });
  });
});

const hiddenStems = bind('bazi.hidden-stems', (ctx) => {
  const a = natalOf(ctx);
  const out: Firing[] = [];
  for (const pillar of PILLAR_NAMES) {
    const roots = a.roots.filter((c) => c.pillar === pillar);
    if (roots.length === 0) continue; // the sentence says what the root is; a branch without one has nothing to say
    const branch = a.pillars[pillar].branch;
    const hidden = a.chars.filter((c) => c.pillar === pillar && c.place === 'hidden');
    out.push(
      natalFiring(
        [
          fact('pillarName', 'Pillar', pillar),
          fact('branch', 'Branch', branch.hanzi),
          fact('hiddenList', 'Hidden stems', hidden.map((c) => `${hanzi(c.stem)} ${c.god}`).join(', ')),
          fact('rootStems', 'Root stems', roots.map((c) => hanzi(c.stem)).join(', ')),
        ],
        { dedupeInstance: `natal-${pillar}` },
      ),
    );
  }
  return out;
});

const strengthScore = bind('bazi.strength-score', (ctx) => {
  const a = natalOf(ctx);
  return [
    natalFiring(
      [
        fact('class', 'Class', a.strengthClass),
        fact('deLing', 'In season (得令)', a.monthState.deLing ? 'yes' : 'no'),
        fact('roots', 'Roots (得地)', a.roots.length === 0 ? 'none' : a.roots.map((c) => `${hanzi(c.stem)} in the ${c.pillar} branch`).join(', ')),
        fact('stemSupport', 'Stem support (得勢)', a.stemSupport.length === 0 ? 'none' : a.stemSupport.map((c) => `${hanzi(c.stem)} (${c.pillar} stem)`).join(', ')),
      ],
      { conventionsUsed: ['baziStrengthThresholds', 'baziEarthSeasons'], badges: a.followerCandidate ? ['follower candidate (從格): a flag, no verdict'] : [], dedupeInstance: 'natal' },
    ),
  ];
});

const favourableFuyi = bind('bazi.favourable-fuyi', (ctx) => {
  const a = natalOf(ctx);
  const f = a.favourites;
  const set = (xs: readonly (typeof f.favourable)[number][]): string => (xs.length === 0 ? 'none' : xs.map(elementLabel).join(', '));
  const balanced = f.strengthClass === 'balanced';
  return [
    natalFiring(
      [
        fact('strengthClass', 'Strength class', f.strengthClass),
        fact('favourable', 'Favourable elements', balanced ? 'none (balanced: no favourite chosen)' : set(f.favourable)),
        fact('unfavourable', 'Unfavourable elements', balanced ? 'none (balanced: no dislike chosen, period signs from fav() are silent)' : set(f.unfavourable)),
      ],
      { conventionsUsed: ['baziStrengthThresholds'], badges: balanced ? ['balanced: no favourite chosen'] : [], dedupeInstance: 'natal' },
    ),
  ];
});

const tongguan = bind('bazi.tongguan', (ctx) => {
  const a = natalOf(ctx);
  const w = a.elementWeight8;
  const t = a.elementTotal8;
  const out: Firing[] = [];
  for (const x of ['Wood', 'Fire', 'Earth', 'Metal', 'Water'] as const) {
    const y = overcomeBy(x);
    const z = generatedBy(x);
    // each of the two at 30 in 100 of all weight or more, the connecting element under 10 in 100
    if (10 * w[x] >= 3 * t && 10 * w[y] >= 3 * t && 10 * w[z] < t) {
      out.push(natalFiring([fact('X', 'Overcoming element', elementLabel(x)), fact('Y', 'Overcome element', elementLabel(y)), fact('Z', 'Connecting element', elementLabel(z))], { dedupeInstance: `natal-${x}` }));
    }
  }
  return out;
});

// ---------------------------------------------------------------------------
// Topic promises
// ---------------------------------------------------------------------------

const has = (a: NatalAssessment, ...kins: Kin[]): boolean => kinChars(a, ...kins).length > 0;

const topicFiring = (topic: Topic, direction: Direction, facts: Fact[], extra: Partial<Firing> = {}): Firing => natalFiring(facts, { topics: [topic], direction, dedupeInstance: `natal-${topic}`, ...extra });

/** The natal wealth grade, or null where the condition's grades do not cover the chart. */
export function wealthGradeOf(a: NatalAssessment): { grade: 'absent' | 'too heavy' | 'robbed' | 'present and carried'; direction: Direction; stars: NatalChar[] } | null {
  const W = kinChars(a, 'wealth');
  const robbers = weightOf(kinChars(a, 'peer'));
  if (W.length === 0) return { grade: 'absent', direction: 'activates', stars: W };
  // wealth heavier than one and a half times what supports the day master
  if (2 * weightOf(W) > 3 * a.support8) return { grade: 'too heavy', direction: 'unfavourable', stars: W };
  if (robbers > weightOf(W) && !has(a, 'officer', 'output')) return { grade: 'robbed', direction: 'unfavourable', stars: W };
  if (W.some((c) => c.place === 'stem' || isRooted(a, c)) && (a.strengthClass === 'strong' || (a.strengthClass === 'weak' && has(a, 'resource', 'peer')))) return { grade: 'present and carried', direction: 'favourable', stars: W };
  return null; // a balanced chart, or a case the condition does not cover: nothing is said
}

const wealthPromise = bind('bazi.topic-wealth-promise', (ctx) => {
  const a = natalOf(ctx);
  const g = wealthGradeOf(a);
  if (!g) return [];
  return [
    topicFiring('wealth', g.direction, [fact('grade', 'Grade', g.grade), fact('wealthList', 'Wealth stars', listChars(g.stars)), fact('strengthClass', 'Strength class', a.strengthClass)], {
      conventionsUsed: ['baziStrengthThresholds'],
      badges: g.grade === 'present and carried' && has(a, 'output') ? ['strengthened by 食傷, the source of wealth'] : [],
    }),
  ];
});

/** Whether a stem character combines with another stem of the chart, the day stem included, and so is removed. */
function combinedAway(a: NatalAssessment, c: NatalChar): boolean {
  const stems = [a.pillars.year.stem.index, a.pillars.month.stem.index, a.pillars.day.stem.index, a.pillars.hour.stem.index];
  const mine = c.pillar;
  return stems.some((s, i) => PILLAR_NAMES[i] !== mine && stemsCombine(c.stem, s));
}

/** The natal career grade, or null where the condition's grades do not cover the chart. */
export function careerGradeOf(a: NatalAssessment): { grade: 'overpowering' | 'weak or absent' | 'mixed' | 'controlled' | 'clear officer'; direction: Direction; note: string; stars: NatalChar[] } | null {
  const O = kinChars(a, 'officer');
  const o8 = weightOf(O);
  const officerStems = O.filter((c) => c.place === 'stem');
  const direct = starsOf(a, '正官');
  const killing = starsOf(a, '七殺');
  const noteBoth = '官 and 殺 both appear';
  const none = 'no mixing of 官 and 殺 is flagged';
  if (o8 >= 2 * a.support8 && !has(a, 'resource', 'output')) return { grade: 'overpowering', direction: 'unfavourable', note: none, stars: O };
  // no 官殺 has a root, or the month branch holds none
  if (!O.some((c) => isRooted(a, c)) || !a.chars.some((c) => c.pillar === 'month' && c.place === 'hidden' && c.kin === 'officer')) return { grade: 'weak or absent', direction: 'activates', note: none, stars: O };
  if (direct.length > 0 && killing.length > 0 && !has(a, 'output') && !officerStems.some((c) => combinedAway(a, c))) {
    // 官殺混雜 is a flag only; the sources give it no fixed sign
    return { grade: 'mixed', direction: 'activates', note: `${noteBoth}, with nothing to remove one: a flag only, no sign`, stars: O };
  }
  if (killing.length > 0 && (starsOf(a, '食神').length > 0 || has(a, 'resource'))) {
    return { grade: 'controlled', direction: 'favourable', note: direct.length > 0 ? `${noteBoth}, one is checked` : none, stars: O };
  }
  if (new Set(officerStems.map((c) => c.god)).size === 1 && officerStems.some((c) => isRooted(a, c)) && (a.strengthClass === 'strong' || has(a, 'resource'))) {
    return { grade: 'clear officer', direction: 'favourable', note: none, stars: O };
  }
  return null;
}

const careerPromise = bind('bazi.topic-career-promise', (ctx) => {
  const a = natalOf(ctx);
  const g = careerGradeOf(a);
  if (!g) return [];
  return [topicFiring('career', g.direction, [fact('grade', 'Grade', g.grade), fact('officerList', 'Officer stars', listChars(g.stars)), fact('mixedNote', 'Mixing', g.note)], { conventionsUsed: ['baziStrengthThresholds'] })];
});

/** Whether the day branch sits in the void pair of the year pillar's cycle, the only void test a day branch can fail. */
export const dayBranchVoid = (a: NatalAssessment): boolean => a.yearVoidPair.includes(a.pillars.day.branch.index);

const spouseMan = bind(
  'bazi.topic-spouse-man',
  (ctx) => {
    if (ctx.sex !== 'male') return [];
    const a = natalOf(ctx);
    const W = kinChars(a, 'wealth');
    const seated = [a.pillars.day.branch.index, a.pillars.month.branch.index].some((b) => ['正財', '偏財', '正官'].includes(tenGod(a.dayStem, mainQi(b)).hanzi));
    let grade: string;
    if (W.length === 0) grade = 'absent';
    else if (2 * weightOf(W) > 3 * a.support8) grade = 'burdened';
    else if (weightOf(kinChars(a, 'peer')) > weightOf(W) && !has(a, 'officer', 'output')) grade = 'rivalled';
    else if (W.some((c) => isRooted(a, c)) && seated) grade = 'supported';
    else return [];
    return [
      topicFiring('relationships', 'activates', [
        fact('grade', 'Grade', grade),
        fact('wealthList', 'Wealth stars', listChars(W)),
        fact('dayBranch', 'Day branch', a.pillars.day.branch.hanzi),
        fact('kongwangNote', 'Void', dayBranchVoid(a) ? "is void (空亡) in the year pillar's cycle" : "is not void in the year pillar's cycle"),
      ]),
    ];
  },
  { sex: true, birthTime: true },
);

const children = bind(
  'bazi.topic-children',
  (ctx) => {
    if (ctx.sex !== 'female') return []; // the man's half is held back
    const a = natalOf(ctx);
    const stars = starsOf(a, '傷官', '食神');
    const struck = starsOf(a, '偏印', '正印').length > 0;
    const placed = stars.filter((c) => c.place === 'stem' || c.pillar === 'hour');
    let grade: string;
    let starList: string;
    let pillarName: string;
    if (stars.length === 0) {
      grade = 'thin';
      starList = 'none';
      pillarName = 'none';
    } else if (!struck && placed.some((c) => isRooted(a, c))) {
      grade = 'supported';
      const shown = placed.filter((c) => isRooted(a, c));
      starList = shown.map((c) => `${c.god} ${hanzi(c.stem)}`).join(', ');
      pillarName = [...new Set(shown.map((c) => c.pillar))].join(' and ');
    } else return [];
    const hourBranch = a.pillars.hour.branch.index;
    const badges: string[] = [];
    if (PILLAR_NAMES.some((p) => p !== 'hour' && a.pillars[p].branch.index === clashOf(hourBranch))) badges.push('hour branch clashed (時沖): a flag, no sign');
    if (a.voidPair.includes(hourBranch)) badges.push('hour branch void (空亡): a flag, no sign');
    return [topicFiring('relationships', 'activates', [fact('grade', 'Grade', grade), fact('starList', 'Child stars', starList), fact('pillarName', 'Pillar', pillarName)], { badges })];
  },
  { sex: true, birthTime: true },
);

const learning = bind('bazi.topic-learning', (ctx) => {
  const a = natalOf(ctx);
  const Y = kinChars(a, 'resource');
  const rest = a.total8 - weightOf(Y);
  let grade: string;
  if (Y.length === 0) grade = 'absent';
  else if (a.strengthClass === 'strong' && 2 * weightOf(Y) > 3 * rest) grade = 'excess';
  else {
    const uncheckedWealth = has(a, 'wealth') && !has(a, 'peer');
    if (starsOf(a, '正印').some((c) => isRooted(a, c)) && !uncheckedWealth && a.strengthClass !== 'strong') grade = 'supported';
    else return [];
  }
  // 學堂 is the day master's 長生 branch and 詞館 its 臨官 branch, present unclashed and not void (a derived convention)
  const opts = { school: a.school, yinReverse: a.yinReverse };
  const natal = PILLAR_NAMES.map((p) => a.pillars[p].branch.index);
  const flagged: string[] = [];
  for (const [name, stage] of [['學堂', '長生'], ['詞館', '臨官']] as const) {
    const b = branchAtStage(a.dayStem, stage, opts);
    if (natal.includes(b) && !natal.includes(clashOf(b)) && !a.voidPair.includes(b)) flagged.push(`${name} ${BRANCHES[b]!.hanzi}`);
  }
  return [
    topicFiring('learning', 'activates', [fact('grade', 'Grade', grade), fact('resourceList', 'Resource stars', listChars(Y)), fact('academy', 'Academy flag', flagged.length === 0 ? 'none' : flagged.join(', '))], {
      conventionsUsed: ['baziStrengthThresholds', 'baziEarthStages', 'baziYinStageReverse'],
    }),
  ];
});

const ORGAN: Readonly<Record<string, string>> = { Wood: '肝 (liver)', Fire: '心 (heart)', Earth: '脾 (spleen)', Metal: '肺 (lung)', Water: '腎 (kidney)' };

const health = bind('bazi.topic-health', (ctx) => {
  const a = natalOf(ctx);
  const w = a.elementWeight8;
  const t = a.elementTotal8;
  const elements = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'] as const;
  const firings: Firing[] = [];
  const tendency = (organ: string, reason: string): Firing => topicFiring('health', 'unfavourable', [fact('organList', 'Organ', organ), fact('reason', 'Reason', reason)], { dedupeInstance: `natal-health-${organ}` });
  // (a) a disliked element nothing in the chart overcomes strikes the organ of the element it overcomes
  for (const x of a.favourites.unfavourable) {
    if (!elementPresent(a, x) || elementPresent(a, controllerOf(x))) continue;
    firings.push(tendency(ORGAN[overcomeBy(x)]!, `the unfavourable element ${elementLabel(x)} is not checked, since no element in the chart overcomes it`));
  }
  // (b) an element under 5 in 100 of the weight with no hidden-stem root counts as cut off
  const cutOff = elements.filter((e) => 20 * w[e] < t && !a.hiddenElements.has(e));
  for (const e of cutOff) firings.push(tendency(ORGAN[e]!, `${elementLabel(e)} has under one twentieth of the chart weight and no root in a hidden stem`));
  if (firings.length > 0) return firings;
  // (c) otherwise harmonious: nothing under one twentieth or over two fifths, and no unchecked disliked element
  const lopsided = elements.some((e) => 20 * w[e] < t || 5 * w[e] > 2 * t);
  if (lopsided) return [];
  return [topicFiring('health', 'favourable', [fact('organList', 'Organ', 'none'), fact('reason', 'Reason', 'no element has under one twentieth or over two fifths of the chart weight, and no unfavourable element is unchecked')])];
});

const peersRivals = bind('bazi.peers-rivals', (ctx) => {
  const a = natalOf(ctx);
  const B = kinChars(a, 'peer');
  const b8 = weightOf(B);
  const out: Firing[] = [];
  const fire = (helpOrStrong: string): void => {
    out.push(topicFiring('relationships', 'activates', [fact('helpOrStrong', 'Peers', helpOrStrong)], { conventionsUsed: ['baziStrengthThresholds'], dedupeInstance: `natal-peers-${out.length}` }));
  };
  if (a.strengthClass === 'weak' && B.some((c) => isRooted(a, c))) fire('helping the weak day master');
  // 40 in 100 of the chart weight, the day stem counted
  if (5 * b8 >= 2 * a.elementTotal8) fire('strong, holding two fifths or more of the chart');
  return out;
});

// ---------------------------------------------------------------------------
// Ten gods by topic
// ---------------------------------------------------------------------------

const tenGodsByTopic = bind('bazi.ten-gods-by-topic', (ctx) => {
  const a = natalOf(ctx);
  const male = ctx.sex === 'male';
  const female = ctx.sex === 'female';
  const out: Firing[] = [];
  for (const c of a.chars.filter((x) => x.place === 'stem')) {
    let topics: Topic[];
    let meaning: string;
    if (c.kin === 'wealth') {
      topics = male ? ['wealth', 'relationships'] : ['wealth'];
      meaning = male ? 'wealth and, for a man, the wife' : 'wealth';
    } else if (c.kin === 'officer') {
      topics = female ? ['career', 'relationships'] : ['career'];
      meaning = female ? 'career and rank and, for a woman, the husband' : 'career and rank';
    } else if (c.kin === 'resource') {
      topics = ['learning'];
      meaning = 'learning and support';
    } else if (c.kin === 'output') {
      topics = female ? ['general', 'relationships'] : ['general'];
      meaning = female ? 'output and skill and, for a woman, children' : 'output and skill';
    } else {
      topics = ['general', 'relationships'];
      meaning = 'peers, siblings and rivals, which compete for wealth';
    }
    out.push(
      natalFiring([fact('stem', 'Stem', `${hanzi(c.stem)} (${c.pillar} stem)`), fact('tenGod', 'Ten god', c.god), fact('dayStem', 'Day master', hanzi(a.dayStem)), fact('topicMeaning', 'Stands for', meaning)], {
        topics,
        dedupeInstance: `natal-${c.pillar}`,
      }),
    );
  }
  return out;
});

/** The natal-promise bindings, in the order of the rule file. */
export const NATAL_BINDINGS: readonly RuleBinding[] = [
  monthState,
  twelveStages,
  hiddenStems,
  strengthScore,
  favourableFuyi,
  tongguan,
  wealthPromise,
  careerPromise,
  spouseMan,
  children,
  learning,
  health,
  peersRivals,
  tenGodsByTopic,
];

export const NATAL_NOT_EVALUATED = [
  {
    ruleId: 'bazi.topic-spouse-woman',
    reason:
      "the source gives four grades for a woman's husband star and does not say which one counts when two of them hold at once (three or more 官殺 stars, and a 傷官 beside a rooted 正官, can both be true of one chart); the engine does not choose between them, so it says nothing about the husband star of a woman's chart",
  },
] as const;
