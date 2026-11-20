// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The scorecard section: the pure views, the wording, and the page code run against a small stand-in
 * for the document. The page keeps its session in memory; the guards in guards.test.ts check that it
 * stores nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forecast } from '@overlay/core';
import { controlPhrases, countsHtml, eventsHtml, headHtml, newEventFrom, OPEN_LABEL, SAVE_LABEL, scorecardHtml } from '../src/scorecardView.ts';
import { initScorecard } from '../src/scorecardPage.ts';
import { nativityOf, SCORECARD_SAMPLE_OFFSETS, eventsFrom, SCORECARD_FREEZE_DAYS } from '../../../fixtures/events.ts';
import { DEFAULT_CONVENTIONS, makeMoment, MS } from '@overlay/core';
import { fixture } from '../../../fixtures/moments.ts';

const f = fixture('j2000');
const base = makeMoment(f.civil, f.zone, f.place).utcMs;
const textOf = (html: string): string => html.replace(/<[^>]+>/g, ' ');

function card(): forecast.Scorecard {
  return forecast.scoreAgainst(eventsFrom('j2000', SCORECARD_SAMPLE_OFFSETS).slice(0, 3), [], forecast.RULESET_VERSION);
}

describe('the scorecard views', () => {
  it('begin with the number of events, the number of frozen forecasts and the sentence', () => {
    const html = headHtml(card());
    expect(textOf(html)).toContain('3 events recorded. 0 frozen forecasts.');
    expect(html.indexOf('events recorded')).toBeLessThan(html.indexOf(forecast.SCORECARD_SENTENCE.slice(0, 10)));
    expect(textOf(html)).toContain("These counts describe this reader's recorded events only.");
  });
  it('list every event with its status and a button to remove it, named for its date', () => {
    const html = eventsHtml(card());
    expect(html.match(/data-remove="/g)).toHaveLength(3);
    expect(html).toContain('no forecast is frozen');
    expect(html).toMatch(/aria-label="Remove the event of /);
  });
  it('say that no forecast is frozen when events exist without one, and print plain counts', () => {
    const text = textOf(countsHtml(card()));
    expect(text).toContain(forecast.SCORECARD_WORDS.noFrozen);
    expect(text).toContain('held 0, did not hold 0, not scored 0, said nothing 0');
    expect(text).toContain('too few scored pairs to compare with shuffled dates');
  });
  it('use no banned word and no percent sign anywhere in the section', () => {
    const c = card();
    const h = scorecardHtml(c);
    for (const s of [textOf(h.head), textOf(h.events), textOf(h.counts), ...controlPhrases()]) expect(forecast.bannedIn(s), s).toBeNull();
    expect(forecast.MORTALITY_WORDS.test(textOf(h.counts))).toBe(false);
  });
  it('name the two session buttons as the privacy page does', () => {
    expect(SAVE_LABEL).toBe('Save session file');
    expect(OPEN_LABEL).toBe('Open session file');
  });
  it('read the event form: a day, a month or a year, and refuse what is missing', () => {
    const ok = newEventFrom({ date: '2031-03-09', precision: 'month', topic: 'career', went: 'went badly', note: ' n ' });
    expect(ok).toMatchObject({ topic: 'career', valence: 'bad', note: 'n' });
    expect(typeof newEventFrom({ date: '', precision: 'day', topic: 'career', went: 'went well', note: '' })).toBe('string');
    expect(typeof newEventFrom({ date: '2031-03-09', precision: 'day', topic: 'luck', went: 'went well', note: '' })).toBe('string');
  });
});

class El {
  innerHTML = '';
  textContent = '';
  value = '';
  hidden = false;
  files: Array<{ text: () => Promise<string> }> | undefined;
  dataset: Record<string, string> = {};
  handlers = new Map<string, Array<(e: unknown) => void>>();
  addEventListener(k: string, h: (e: unknown) => void): void {
    this.handlers.set(k, [...(this.handlers.get(k) ?? []), h]);
  }
  fire(k: string, e: unknown = { preventDefault() {}, target: this }): void {
    for (const h of this.handlers.get(k) ?? []) h(e);
  }
  click(): void {
    this.fire('click');
  }
}
const els = new Map<string, El>();
const el = (id: string): El => (els.has(id) ? els.get(id)! : (els.set(id, new El()), els.get(id)!));

describe('the scorecard page code', () => {
  const saved: Array<{ name: string; text: string }> = [];
  beforeEach(() => {
    els.clear();
    saved.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(base + (SCORECARD_FREEZE_DAYS.first + 1) * MS.DAY);
    vi.stubGlobal('document', { getElementById: el });
    vi.stubGlobal('confirm', () => true);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const start = () =>
    initScorecard({
      readNativity: () => nativityOf('j2000'),
      conventions: () => DEFAULT_CONVENTIONS,
      forecastSettings: () => ({ fromYear: 2026, toYear: 2027, sexConvention: 'none' }),
      save: (name, text) => void saved.push({ name, text }),
    });

  it('keeps events in memory, shows the header first and writes a file only when Save is pressed', () => {
    start();
    vi.runAllTimers();
    expect(el('sc-head').innerHTML).toContain('0 events recorded. 0 frozen forecasts.');
    el('sc-date').value = '2027-01-05';
    el('sc-precision').value = 'day';
    el('sc-topic').value = 'wealth';
    el('sc-went').value = 'went well';
    el('sc-note').value = 'mine';
    el('sc-add').fire('submit');
    vi.runAllTimers();
    expect(el('sc-head').innerHTML).toContain('1 event recorded.');
    expect(el('sc-events').innerHTML).toContain('2027-01-05');
    expect(saved).toEqual([]);
    el('sc-save').click();
    expect(saved).toHaveLength(1);
    expect(saved[0]!.name).toBe('overlay.session.json');
    const back = forecast.importSession(saved[0]!.text);
    expect(back.events).toHaveLength(1);
    expect(back.events[0]!.note).toBe('mine');
  });

  it('freezes the forecast shown, pins the moment, scores later events and takes one out', () => {
    start();
    el('sc-freeze').click();
    vi.runAllTimers();
    expect(el('sc-head').innerHTML).toContain('0 events recorded. 1 frozen forecast.');
    el('sc-date').value = '2027-02-03';
    el('sc-precision').value = 'day';
    el('sc-topic').value = 'wealth';
    el('sc-went').value = 'went badly';
    el('sc-add').fire('submit');
    vi.runAllTimers();
    expect(el('sc-events').innerHTML).toContain('scored');
    expect(el('sc-counts').innerHTML).toContain('By technique');
    el('sc-events').fire('click', { target: { closest: () => ({ dataset: { remove: 'e1' } }) } });
    vi.runAllTimers();
    expect(el('sc-head').innerHTML).toContain('0 events recorded.');
  });

  it('opens a session file, and says why when the file cannot be read', async () => {
    start();
    vi.runAllTimers();
    const sess = forecast.newSession(nativityOf('j2000'));
    const { session } = forecast.addEvent(sess, { date: forecast.parseEventDate('2027-02-03'), topic: 'wealth', valence: 'good' }, 0);
    el('sc-open').files = [{ text: async () => forecast.exportSession(session) }];
    el('sc-open').fire('change');
    await vi.runAllTimersAsync();
    expect(el('sc-head').innerHTML).toContain('1 event recorded.');
    el('sc-open').files = [{ text: async () => '{}' }];
    el('sc-open').fire('change');
    await vi.runAllTimersAsync();
    expect(el('sc-status').textContent).toMatch(/could not be opened/);
  });
});
