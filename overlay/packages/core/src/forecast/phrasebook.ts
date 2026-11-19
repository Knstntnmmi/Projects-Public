// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The phrasebook: every word the forecast layer says on its own account lives in this
 * file. (The rule sentences come from the rule files; they are not rewritten.) Keeping
 * the words in one place is what lets one test forbid the words that claim more than a
 * rule says: likely, probably, chance, percent, probability, confidence and will.
 */
import type { Direction, ReadingWord, Stage, Topic, Tradition } from './types.ts';

export const BANNED_WORDS = /\b(likely|probably|chances?|percent(age)?|probabilit(y|ies)|confiden(ce|t)|will)\b|%/i;
/** Wording about death or diagnosis, which health sentences never carry. */
export const MORTALITY_WORDS = /\b(death|dead|die[sd]?|dying|mortal\w*|fatal\w*|diagnos\w*|disease\w*|cancer|terminal)\b/i;

/**
 * Rule templates are data and are never rewritten here. These rules carry a word the
 * health test would refuse, in a negated sentence; they are listed so that the exception
 * is one visible line and any new one fails the test.
 */
export const KNOWN_TEMPLATE_EXCEPTIONS: Readonly<Record<string, string>> = {
  'parashari.dasha-lord-2nd-7th-maraka': 'the template says the strain is "not a prediction of death"; the word occurs only in that negation',
};

export const bannedIn = (text: string): string | null => BANNED_WORDS.exec(text)?.[0] ?? null;

export type DisplayWord = ReadingWord | 'active';

export const WORD: Readonly<Record<DisplayWord, string>> = {
  supports: 'supports',
  cautions: 'cautions',
  mixed: 'mixed',
  active: 'active',
  'nothing-said': 'nothing said',
};

/** The word a single rule's direction is shown with. */
export function directionWord(d: Direction): Exclude<DisplayWord, 'nothing-said'> {
  return d === 'favourable' ? 'supports' : d === 'unfavourable' ? 'cautions' : d === 'mixed' ? 'mixed' : 'active';
}

/** The verb of a summary sentence, for one speaking group and for several; "caution wealth" reads badly, so cautions get a phrase. */
export const SUMMARY_VERB: Readonly<Record<'supports' | 'cautions', { one: string; many: string }>> = {
  supports: { one: 'supports', many: 'support' },
  cautions: { one: 'advises caution for', many: 'advise caution for' },
};

export const TRADITION_NAME: Readonly<Record<Tradition, string>> = {
  bazi: 'BaZi',
  vedic: 'Vedic astrology',
  iching: 'the I Ching',
  western: 'Western astrology',
};

export const TOPIC_LABEL: Readonly<Record<Topic, string>> = {
  wealth: 'wealth',
  career: 'career',
  relationships: 'relationships',
  health: 'health',
  learning: 'learning',
  'home-travel': 'home and travel',
  general: 'life in general',
};

const TOPIC_PHRASE: Readonly<Record<Topic, string>> = {
  wealth: 'money',
  career: 'work and standing',
  relationships: 'relationships',
  health: 'health, as tendencies',
  learning: 'learning',
  'home-travel': 'home and travel',
  general: 'life in general',
};

export const STAGE_PLAIN: Readonly<Record<Stage, string>> = {
  'natal-promise': 'the natal chart',
  'period-lord': 'the period lord',
  activation: 'the trigger',
  modifier: 'a modifier',
};

export const NOTE = {
  rulesConflict: 'rules conflict',
  topicActive: 'topic active',
  ruleStatesMixed: 'a rule here states a mixed result',
  oneGroupTwoVerdicts: 'one group, two verdicts',
  twoTraditionsOneGroup: 'two traditions, one group',
  onePlanetsMotion: "two traditions read one planet's motion",
  sameFactAlso: 'same fact, also reported by',
} as const;

export const BADGE = {
  ungated: 'no promise rule applied',
  experimental: 'experimental',
  conventionDependent: 'convention-dependent',
  health: 'a tendency only',
  unopened: 'source not opened',
  capped: 'rule weight capped at 1',
} as const;

export const GATE_UNGATED = 'ungated: no promise rule applied';

export const TEXT = {
  notTestedYet: 'Not tested yet.',
  noQuotation: 'no quotation shown (translation)',
  sourceNotOpened: 'source not opened',
  ruleWeight: 'rule weight 1 to 3 as rated by the extractor',
  agreementA: 'Agreement means rule sets keyed to different clocks gave the same sign for the same topic and period.',
  agreementB:
    'It does not yet say the outcome follows: that waits until the scorecard shows agreeing periods doing better than the baseline, and all traditions read one birth moment, so a wrong birth time moves them together.',
  agreementC: 'Full text: how agreement is read.',
  agreementLink: '#how-agreement-is-read',
  withheldWestern: 'withheld pending verification',
  needsThreeGroups: 'Agreement needs at least three independent groups to say anything; showing the signals only.',
  scorecardNote1: 'Events people record are not a random sample.',
  scorecardNote2:
    'The rules were not tuned to your events, but you may have chosen what to enter after seeing forecasts, which is why only events entered after the freeze count.',
  scorecardNote3: 'This is retrodiction unless the forecasts were frozen first.',
  scorecardNote4: 'A hit rate does not tell you how the next call turns out.',
} as const;

export function sensitivityText(minutes: number): string {
  return `would change if the birth time were ${minutes} minutes off`;
}

export function listIntro(topic: Topic): string {
  return `Each line is something a named rule says about ${TOPIC_PHRASE[topic]} in this period, with its source. ${TEXT.notTestedYet}`;
}

export function rulesLine(available: number, withheld: number): string {
  return `${available} rules available, ${withheld} withheld (source not opened or unverified)`;
}

export function coverageNote(tradition: Tradition, topic: Topic, bound: number): string {
  return `${TRADITION_NAME[tradition]}: ${bound} bound ${bound === 1 ? 'rule' : 'rules'} for ${TOPIC_LABEL[topic]}.`;
}

export function withheldTraditionNote(tradition: Tradition, count: number): string {
  return `${TRADITION_NAME[tradition]}: ${count} rules ${TEXT.withheldWestern}.`;
}

export function supportsFromCautionsFrom(fav: Stage[], unf: Stage[]): string {
  const plain = (xs: Stage[]): string => [...new Set(xs)].map((s) => STAGE_PLAIN[s]).join(' and ');
  return `supports from ${plain(fav)}, cautions from ${plain(unf)}`;
}

export const VERDICT_TEXT = {
  'agree-supports': 'agree: supports',
  'agree-cautions': 'agree: cautions',
  contradiction: 'contradiction',
  single: 'one group speaks',
  silent: 'nothing said',
  'no-agreement': 'groups speak but do not agree',
} as const;

export function baselineLine(found: number, expected: number, cellsLooked: number, slices: number): string {
  const base = `found ${found} agreeing ${found === 1 ? 'slice' : 'slices'}; about ${expected.toFixed(1)} expected if the groups were unrelated; ${cellsLooked} ${cellsLooked === 1 ? 'cell' : 'cells'} looked at on this page`;
  return slices <= 12 ? `${base}. With only ${slices} slices this shows nothing by itself.` : `${base}.`;
}

export function summarySentence(year: number, topic: Topic, word: 'supports' | 'cautions', agreeing: number, speaking: number, names: string[], silent: string[]): string {
  const head = `In ${year}, ${agreeing} of ${speaking} speaking ${speaking === 1 ? 'group' : 'groups'} ${speaking === 1 ? SUMMARY_VERB[word].one : SUMMARY_VERB[word].many} ${TOPIC_LABEL[topic]} (${names.join(', ')})`;
  return silent.length ? `${head}; nothing was said by ${silent.join(' and ')}.` : `${head}.`;
}

export function groupSplitSentence(year: number, topic: Topic, groups: Array<{ name: string; word: ReadingWord }>): string {
  return `In ${year}, the groups differ on ${TOPIC_LABEL[topic]}: ${groups.map((g) => `${g.name} ${WORD[g.word]}`).join('; ')}.`;
}

export function silenceSentence(tradition: Tradition, topic: Topic, year: number): string {
  return `No rule of ${TRADITION_NAME[tradition]} fired for ${TOPIC_LABEL[topic]} in ${year}.`;
}

export function signalLine(sentence: string, word: DisplayWord, topic: Topic): string {
  return topic === 'health' ? `${sentence} (${WORD[word]}; ${BADGE.health})` : `${sentence} (${WORD[word]})`;
}

/** Every string this file can say, for the banned-word test. */
export function allPhrases(): string[] {
  const out: string[] = [];
  const walk = (x: unknown): void => {
    if (typeof x === 'string') out.push(x);
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  [WORD, SUMMARY_VERB, TRADITION_NAME, TOPIC_LABEL, TOPIC_PHRASE, STAGE_PLAIN, NOTE, BADGE, TEXT, VERDICT_TEXT, GATE_UNGATED].forEach(walk);
  for (const t of Object.keys(TOPIC_LABEL) as Topic[]) out.push(listIntro(t), coverageNote('bazi', t, 3));
  out.push(
    rulesLine(5, 2),
    withheldTraditionNote('western', 18),
    supportsFromCautionsFrom(['activation'], ['natal-promise']),
    baselineLine(2, 1.2, 3, 10),
    baselineLine(2, 1.2, 3, 30),
    summarySentence(2033, 'wealth', 'supports', 2, 2, ['a', 'b'], ['c']),
    summarySentence(2033, 'wealth', 'cautions', 1, 1, ['a'], []),
    silenceSentence('western', 'wealth', 2034),
    groupSplitSentence(2036, 'wealth', [{ name: 'a', word: 'supports' }, { name: 'b', word: 'mixed' }]),
    signalLine('x', 'supports', 'health'),
    signalLine('x', 'active', 'wealth'),
    sensitivityText(30),
  );
  return out;
}
