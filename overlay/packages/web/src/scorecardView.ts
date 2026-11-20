// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The scorecard section of the page as pure functions from the core's scorecard to HTML text. Nothing
 * here touches the document, the clock, a file or the network. Every sentence about counts comes from
 * the core (scorecardText.ts); what is written here is the labels of the controls and the layout.
 */
import { forecast } from '@overlay/core';
import { esc } from './forecastView.ts';

export const SAVE_LABEL = 'Save session file';
export const OPEN_LABEL = 'Open session file';
export const FREEZE_LABEL = 'Freeze the forecast shown';
export const ADD_LABEL = 'Add event';
export const SAVE_NAME = 'overlay.session.json';

/** What the section says about where the session lives. It is the same promise as PRIVACY.md makes. */
export const SESSION_NOTE =
  'The session lives in this tab only. Nothing is stored in the browser or put in the address bar. It leaves the tab only when you press "Save session file", which downloads a file that holds the birth moment in clear text. "Open session file" brings it back. Reload the page and an unsaved session is gone.';

export const FREEZE_NOTE =
  'Freezing fixes the forecast shown now, for the moment, settings and years in the form, without a stated birth-time uncertainty. An event is scored only against a forecast frozen before the event\'s date.';

export const PRECISION_CHOICES: ReadonlyArray<{ value: 'day' | 'month' | 'year'; label: string }> = [
  { value: 'day', label: 'the day' },
  { value: 'month', label: 'the month' },
  { value: 'year', label: 'the year' },
];

export const WENT_CHOICES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'went well', label: forecast.SCORECARD_WORDS.wentWell },
  { value: 'went badly', label: forecast.SCORECARD_WORDS.wentBadly },
];

export const topicOptions = (): string => forecast.TOPICS.map((t) => `<option value="${esc(t)}">${esc(forecast.TOPIC_LABEL[t])}</option>`).join('');
export const precisionOptions = (): string => PRECISION_CHOICES.map((p) => `<option value="${p.value}">${esc(p.label)}</option>`).join('');
export const wentOptions = (): string => WENT_CHOICES.map((w) => `<option value="${esc(w.value)}">${esc(w.label)}</option>`).join('');

/** The event the form describes, or the message that says what is missing. */
export function newEventFrom(raw: { date: string; precision: string; topic: string; went: string; note: string }): forecast.NewEvent | string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.date);
  if (!m) return 'Pick the date of the event.';
  const text = raw.precision === 'year' ? m[1]! : raw.precision === 'month' ? `${m[1]}-${m[2]}` : raw.date;
  try {
    const note = raw.note.trim();
    return { date: forecast.parseEventDate(text), topic: forecast.parseTopic(raw.topic), valence: forecast.parseWent(raw.went), ...(note ? { note } : {}) };
  } catch (e) {
    return e instanceof Error ? e.message : 'The event could not be read.';
  }
}

const num = (n: number): string => String(n);

function countsTable(caption: string, rows: readonly forecast.CountRow[]): string {
  if (rows.length === 0) return `<p class="note">${esc(caption)}: nothing to count.</p>`;
  const head = `<tr><th scope="col"><span class="sr">${esc(caption)}</span></th><th scope="col">held</th><th scope="col">did not hold</th><th scope="col">not scored</th><th scope="col">said nothing</th></tr>`;
  const body = rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th><td>${num(r.counts.held)}</td><td>${num(r.counts.didNotHold)}</td><td>${num(r.counts.notScored)}</td><td>${num(r.counts.saidNothing)}</td></tr>`).join('');
  return `<div class="sc-table-wrap"><table class="sc-table"><caption>${esc(caption)}</caption><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/** The first lines of every scorecard output: how many events, how many frozen forecasts, and the sentence. */
export const headHtml = (card: forecast.Scorecard): string => `<p class="sc-head">${esc(forecast.countsHeader(card.eventCount, card.frozenCount))}</p><p class="sentence">${esc(forecast.SCORECARD_SENTENCE)}</p>`;

/** The events of the session, each with its status, and a button to take it out. */
export function eventsHtml(card: forecast.Scorecard): string {
  if (card.events.length === 0) return `<p class="note">${esc(forecast.SCORECARD_WORDS.noEvents)}</p>`;
  const items = card.events.map(
    (e) =>
      `<li><div class="ev-line"><span class="ev-date">${esc(forecast.eventDateText(e))}</span> <span>${esc(forecast.TOPIC_LABEL[e.topic])}</span> <span>${esc(forecast.valenceWords(e.valence))}</span></div><div class="ev-status ${e.status === 'scored' ? '' : 'warn'}">${esc(forecast.EVENT_STATUS_TEXT[e.status])}</div><button type="button" class="quiet" data-remove="${esc(e.eventId)}" aria-label="Remove the event of ${esc(forecast.eventDateText(e))}, ${esc(forecast.TOPIC_LABEL[e.topic])}">Remove</button></li>`,
  );
  return `<ul class="sc-events plain">${items.join('')}</ul>`;
}

/** The counts: totals, the three breakdowns, the shared clock and the comparison with shuffled dates, then the notes. */
export function countsHtml(card: forecast.Scorecard): string {
  const b = forecast.breakdowns(card);
  const reasons = (Object.keys(forecast.NOT_SCORED_TEXT) as forecast.NotScoredReason[]).map((r) => `${card.notScoredByReason[r]} ${forecast.NOT_SCORED_TEXT[r]}`).join(', ');
  const parts: string[] = [];
  if (card.eventCount > 0 && card.frozenCount === 0) parts.push(`<p class="note warn">${esc(forecast.SCORECARD_WORDS.noFrozen)}</p>`);
  parts.push(`<p class="sc-totals">${esc(forecast.countsLine(card.totals))}</p>`, `<p class="note">Not scored: ${esc(reasons)}.</p>`);
  parts.push('<h4>By technique</h4>', countsTable('By technique', b.technique));
  parts.push('<h4>By tradition</h4>', countsTable('By tradition', b.tradition));
  parts.push(`<details class="subcard"><summary>By rule (${card.byRule.length})</summary>${countsTable('By rule', b.rule)}</details>`);
  parts.push('<h4>By shared clock</h4>', `<p class="note">${esc(forecast.SHARED_CLOCK_TEXT)} In the group here: ${esc(card.sharedClock.levels.map((l) => forecast.LEVEL_LABEL[l]).join(', ') || 'no technique spoke')}.</p>`, countsTable('By shared clock', [b.sharedClock]));
  parts.push('<h4>Compared with shuffled dates</h4>', `<p>${esc(forecast.comparisonLine(card.comparison))}</p>`);
  if (!card.comparison.tooFew) parts.push(`<p class="note">${esc(forecast.comparisonExplanation(card.comparison.runs, card.comparison.seed))}</p>`);
  parts.push('<h4>Read this with care</h4>', `<ul class="sc-notes">${forecast.SCORECARD_NOTES.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`);
  return parts.join('');
}

export function scorecardHtml(card: forecast.Scorecard): { head: string; events: string; counts: string } {
  return { head: headHtml(card), events: eventsHtml(card), counts: countsHtml(card) };
}

/** Every visible string of the section's controls, for the banned-word test. */
export const controlPhrases = (): string[] => [SESSION_NOTE, FREEZE_NOTE, SAVE_LABEL, OPEN_LABEL, FREEZE_LABEL, ADD_LABEL, ...PRECISION_CHOICES.map((p) => p.label), ...WENT_CHOICES.map((w) => w.label)];
