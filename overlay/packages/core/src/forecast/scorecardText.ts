// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * What the scorecard says, as words and as lines of text. The command line, the page and the
 * generated sample print from here, so that they cannot disagree. Every sentence is plain
 * counting: no rate, no ratio, no adjective that ranks, no verdict.
 */
import { LEVEL_LABEL, TEXT, TOPIC_LABEL, TRADITION_NAME } from './phrasebook.ts';
import type { Counts, EventResult, EventStatus, NotScoredReason, Scorecard } from './scorecard.ts';
import { MIN_PAIRS_TO_COMPARE } from './scorecard.ts';

export const SCORECARD_SENTENCE = "These counts describe this reader's recorded events only.";

export const SCORECARD_WORDS = {
  title: 'Scorecard',
  held: 'held',
  didNotHold: 'did not hold',
  notScored: 'not scored',
  saidNothing: 'said nothing',
  wentWell: 'went well',
  wentBadly: 'went badly',
  tooFew: 'too few events to compare with shuffled dates',
  noEvents: 'No events are recorded in this session.',
  noFrozen: 'No forecast is frozen in this session, so no event can be scored.',
} as const;

export const EVENT_STATUS_TEXT: Readonly<Record<EventStatus, string>> = {
  scored: 'scored',
  'frozen-too-late': 'frozen too late: every forecast was frozen after this event, so it is not counted',
  'no-frozen-forecast': 'no forecast is frozen, so it is not counted',
  'outside-span': 'outside the span of every forecast frozen before it, so it is not counted',
  'not-reproducible': 'the forecast frozen before it cannot be reproduced under the rules loaded now, so it is not counted',
};

export const NOT_SCORED_TEXT: Readonly<Record<NotScoredReason, string>> = {
  mixed: 'mixed statement',
  'no-direction': 'note without a direction',
  natal: 'natal statement without dates',
};

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const countsHeader = (events: number, frozen: number): string => `${plural(events, 'event', 'events')} recorded. ${plural(frozen, 'frozen forecast', 'frozen forecasts')}.`;

export const valenceWords = (v: 'good' | 'bad'): string => (v === 'good' ? SCORECARD_WORDS.wentWell : SCORECARD_WORDS.wentBadly);

/** The date an event covers, as typed: a day, a month or a year. */
export function eventDateText(e: Pick<EventResult, 'dates' | 'precision'>): string {
  const iso = new Date(e.dates.startUtcMs).toISOString();
  return e.precision === 'day' ? iso.slice(0, 10) : e.precision === 'month' ? iso.slice(0, 7) : iso.slice(0, 4);
}

export function comparisonLine(c: Scorecard['comparison']): string {
  if (c.tooFew || c.atLeast === null) return `Fewer than ${MIN_PAIRS_TO_COMPARE} statement-event pairs were scored (${c.pairs}): ${SCORECARD_WORDS.tooFew}.`;
  return `With the dates shuffled, the held count was at least as high in ${c.atLeast} of ${c.runs} runs. Here the held count is ${c.held} of ${c.pairs} scored pairs.`;
}

export const comparisonExplanation = (runs: number, seed: number): string =>
  `Each run moves all the events together by one random number of whole days, round the span of the forecast, and counts the held pairs again against the same forecast. ${runs} runs, seed ${seed}.`;

export const countsLine = (c: Counts): string => `${SCORECARD_WORDS.held} ${c.held}, ${SCORECARD_WORDS.didNotHold} ${c.didNotHold}, ${SCORECARD_WORDS.notScored} ${c.notScored}, ${SCORECARD_WORDS.saidNothing} ${c.saidNothing}`;

export const SHARED_CLOCK_TEXT =
  'Techniques that count from the birth moment by fixed arithmetic (the luck pillar, the year pillar, the dashas, the profections, the firdaria and the solar return) share one clock, so they are also shown here once, as one group.';

export const SCORECARD_NOTES: readonly string[] = [TEXT.scorecardNote1, TEXT.scorecardNote2, TEXT.scorecardNote3, TEXT.scorecardNote4, TEXT.scorecardNote5, TEXT.scorecardNote6];

export interface CountRow {
  label: string;
  counts: Counts;
}

/** The three breakdowns as labelled rows, for the text, the page and the sample. */
export function breakdowns(card: Scorecard): { rule: CountRow[]; technique: CountRow[]; tradition: CountRow[]; sharedClock: CountRow } {
  return {
    rule: card.byRule.map((r) => ({ label: `${r.ruleId} (${LEVEL_LABEL[r.level]})`, counts: r.counts })),
    technique: card.byLevel.map((r) => ({ label: r.tradition ? `${LEVEL_LABEL[r.level]} (${TRADITION_NAME[r.tradition]})` : LEVEL_LABEL[r.level], counts: r.counts })),
    tradition: card.byTradition.map((r) => ({ label: TRADITION_NAME[r.tradition], counts: r.counts })),
    sharedClock: { label: 'The group, counted once', counts: card.sharedClock.counts },
  };
}

export const eventLine = (e: EventResult): string => `${e.eventId}  ${eventDateText(e)}  ${TOPIC_LABEL[e.topic]}  ${valenceWords(e.valence)}  ${EVENT_STATUS_TEXT[e.status]}`;

const pad = (s: string, w: number): string => s + ' '.repeat(Math.max(0, w - s.length));

function table(rows: readonly CountRow[]): string[] {
  if (rows.length === 0) return ['  (nothing to count)'];
  const w = Math.max(...rows.map((r) => r.label.length));
  const head = `  ${pad('', w)}  held  did not hold  not scored  said nothing`;
  return [head, ...rows.map((r) => `  ${pad(r.label, w)}  ${pad(String(r.counts.held), 4)}  ${pad(String(r.counts.didNotHold), 12)}  ${pad(String(r.counts.notScored), 10)}  ${r.counts.saidNothing}`)];
}

/** The scorecard as lines of text. Always begins with the number of events, the number of frozen forecasts and the sentence. */
export function scorecardLines(card: Scorecard): string[] {
  const b = breakdowns(card);
  const out: string[] = [countsHeader(card.eventCount, card.frozenCount), SCORECARD_SENTENCE, ''];
  out.push(SCORECARD_WORDS.title, '');
  if (card.eventCount === 0) out.push(SCORECARD_WORDS.noEvents, '');
  else if (card.frozenCount === 0) out.push(SCORECARD_WORDS.noFrozen, '');
  out.push('Events');
  for (const e of card.events) out.push(`  ${eventLine(e)}`);
  const scored = card.events.filter((e) => e.status === 'scored').length;
  out.push('', `${plural(scored, 'event was', 'events were')} scored against a forecast frozen before ${scored === 1 ? 'it' : 'them'}.`, '');
  out.push('Counts', `  ${countsLine(card.totals)}`);
  out.push(`  Not scored: ${(Object.keys(NOT_SCORED_TEXT) as NotScoredReason[]).map((r) => `${card.notScoredByReason[r]} ${NOT_SCORED_TEXT[r]}`).join(', ')}.`, '');
  out.push('By technique', ...table(b.technique), '');
  out.push('By tradition', ...table(b.tradition), '');
  out.push('By rule', ...table(b.rule), '');
  out.push('By shared clock', `  ${SHARED_CLOCK_TEXT}`, `  In the group here: ${card.sharedClock.levels.map((l) => LEVEL_LABEL[l]).join(', ') || 'no technique spoke'}.`, ...table([b.sharedClock]), '');
  out.push('Compared with shuffled dates', `  ${comparisonLine(card.comparison)}`);
  if (!card.comparison.tooFew) out.push(`  ${comparisonExplanation(card.comparison.runs, card.comparison.seed)}`);
  out.push('', 'Read this with care');
  for (const n of SCORECARD_NOTES) out.push(`  ${n}`);
  return out;
}

/** The JSON of the scorecard: the same counts, with the header sentence. */
export function scorecardJson(card: Scorecard): Record<string, unknown> {
  return { about: SCORECARD_SENTENCE, ...card, notes: SCORECARD_NOTES };
}

/** Every string this file can say, for the banned-word test. */
export function scorecardPhrases(card: Scorecard): string[] {
  return [
    SCORECARD_SENTENCE,
    ...Object.values(SCORECARD_WORDS),
    ...Object.values(EVENT_STATUS_TEXT),
    ...Object.values(NOT_SCORED_TEXT),
    SHARED_CLOCK_TEXT,
    ...SCORECARD_NOTES,
    comparisonExplanation(card.comparison.runs, card.comparison.seed),
    ...scorecardLines(card),
  ];
}
