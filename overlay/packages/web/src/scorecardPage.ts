// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The scorecard section of the page. The session lives in this module's variables and nowhere else:
 * nothing is stored, nothing is put in the address bar, and nothing leaves the tab unless the reader
 * presses "Save session file", which hands a download to the browser. "Open session file" reads a file
 * the reader picks. There is no timer that saves, and no request of any kind. The counting is cut
 * into steps with a pause so that the page paints between them.
 */
import { forecast, type Conventions } from '@overlay/core';
import {
  ADD_LABEL,
  FREEZE_LABEL,
  FREEZE_NOTE,
  newEventFrom,
  precisionOptions,
  SAVE_NAME,
  scorecardHtml,
  SESSION_NOTE,
  topicOptions,
  wentOptions,
} from './scorecardView.ts';

export interface ScorecardDeps {
  /** The birth moment of the form as typed, or the message that says why there is none. */
  readNativity: () => forecast.Nativity | string;
  /** The engine's conventions as the page holds them. */
  conventions: () => Conventions;
  /** The settings of the forecast shown: its years and the sex the chart is read as. */
  forecastSettings: () => { fromYear: number; toYear: number; sexConvention: forecast.SexConvention };
  /** Hands a file to the browser as a download. */
  save: (name: string, text: string, type: string) => void;
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

/** What the page keeps of a session between presses. */
interface State {
  events: forecast.ForecastEvent[];
  frozen: forecast.FrozenForecast[];
  /** Set once a forecast is frozen, or a file with frozen forecasts is opened: the moment and settings they were made for. */
  pinned: { nativity: forecast.Nativity; conventions: forecast.Session['conventions'] } | null;
}

export function initScorecard(deps: ScorecardDeps): { refresh: () => void } {
  const state: State = { events: [], frozen: [], pinned: null };
  // Forecasts already re-evaluated, kept for as long as the tab lives, so that adding an event does not evaluate again.
  const cache = new Map<string, forecast.ForecastResult | null>();
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  $('sc-session-note').textContent = SESSION_NOTE;
  $('sc-freeze-note').textContent = FREEZE_NOTE;
  $('sc-freeze').textContent = FREEZE_LABEL;
  $('sc-add-button').textContent = ADD_LABEL;
  $('sc-topic').innerHTML = topicOptions();
  $('sc-precision').innerHTML = precisionOptions();
  $('sc-went').innerHTML = wentOptions();

  const status = (text: string): void => {
    $('sc-status').textContent = text;
  };

  const conventionsNow = (): forecast.Session['conventions'] => ({
    engine: deps.conventions(),
    forecast: { ...forecast.DEFAULT_FORECAST_CONVENTIONS, baziSexConvention: deps.forecastSettings().sexConvention },
  });

  /** The session as it stands, or the message that says why it cannot be made (no valid birth moment yet). */
  function sessionNow(): forecast.Session | string {
    const nativity = state.pinned?.nativity ?? deps.readNativity();
    if (typeof nativity === 'string') return nativity;
    return {
      schema: forecast.SESSION_SCHEMA,
      rulesetVersion: forecast.RULESET_VERSION,
      conventions: state.pinned?.conventions ?? conventionsNow(),
      nativity,
      events: state.events,
      frozen: state.frozen,
    };
  }

  function render(done = ''): void {
    const mine = ++seq;
    status(state.frozen.length > 0 ? 'Counting...' : done);
    clearTimeout(timer);
    // The pause lets the page paint the events first; the reproduction of a frozen forecast takes about a second.
    timer = setTimeout(() => {
      if (mine !== seq) return;
      try {
        const session = sessionNow();
        const card = typeof session === 'string' || state.frozen.length === 0 ? forecast.scoreAgainst(state.events, [], forecast.RULESET_VERSION) : forecast.scoreSession(session, { cache });
        const html = scorecardHtml(card);
        $('sc-head').innerHTML = html.head;
        $('sc-events').innerHTML = html.events;
        $('sc-counts').innerHTML = html.counts;
        status(done);
      } catch (err) {
        status(`The scorecard could not be counted: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
      showPinned();
    }, 0);
  }

  /** A line when the form no longer shows the moment or settings the frozen forecasts were made for. */
  function showPinned(): void {
    const line = $('sc-pinned');
    const now = deps.readNativity();
    const pinned = state.pinned;
    const differs = pinned !== null && (typeof now === 'string' || forecast.hashNativity(now) !== forecast.hashNativity(pinned.nativity) || forecast.hashOf(conventionsNow()) !== forecast.hashOf(pinned.conventions));
    line.hidden = !differs;
    line.textContent = differs ? forecast.PINNED_MESSAGE : '';
  }

  $('sc-freeze').addEventListener('click', () => {
    const nativity = deps.readNativity();
    if (typeof nativity === 'string') {
      status(nativity);
      return;
    }
    status('Freezing the forecast...');
    setTimeout(() => {
      try {
        const years = deps.forecastSettings();
        const base: forecast.Session = {
          schema: forecast.SESSION_SCHEMA,
          rulesetVersion: forecast.RULESET_VERSION,
          conventions: state.pinned?.conventions ?? conventionsNow(),
          nativity: state.pinned?.nativity ?? nativity,
          events: state.events,
          frozen: state.frozen,
        };
        const next = forecast.freezeInSession(base, { nativity, conventions: conventionsNow() }, years, Date.now());
        state.frozen = next.frozen;
        state.pinned = { nativity: next.nativity, conventions: next.conventions };
        render(`Frozen: ${years.fromYear} to ${years.toYear}. Events dated after this moment can be scored against it.`);
      } catch (err) {
        status(err instanceof Error ? err.message : 'The forecast could not be frozen.');
      }
    }, 0);
  });

  $('sc-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const made = newEventFrom({
      date: $<HTMLInputElement>('sc-date').value,
      precision: $<HTMLSelectElement>('sc-precision').value,
      topic: $<HTMLSelectElement>('sc-topic').value,
      went: $<HTMLSelectElement>('sc-went').value,
      note: $<HTMLInputElement>('sc-note').value,
    });
    if (typeof made === 'string') {
      status(made);
      return;
    }
    try {
      const { session, event } = forecast.addEvent({ events: state.events }, made, Date.now());
      state.events = session.events;
      $<HTMLInputElement>('sc-note').value = '';
      render(`Added ${event.id}.`);
    } catch (err) {
      status(err instanceof Error ? err.message : 'The event could not be added.');
    }
  });

  $('sc-events').addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('button[data-remove]')?.dataset.remove;
    if (id === undefined) return;
    state.events = state.events.filter((x) => x.id !== id);
    render(`Removed ${id}.`);
  });

  $('sc-save').addEventListener('click', () => {
    const session = sessionNow();
    if (typeof session === 'string') {
      status(session);
      return;
    }
    try {
      if (!confirm(forecast.exportConfirmation(session))) return;
      deps.save(SAVE_NAME, forecast.exportSession(session), 'application/json');
      status('The session file was handed to your browser as a download.');
    } catch (err) {
      status(err instanceof Error ? err.message : 'The session file could not be written.');
    }
  });

  $('sc-open-button').addEventListener('click', () => $<HTMLInputElement>('sc-open').click());
  $('sc-open').addEventListener('change', () => {
    const input = $<HTMLInputElement>('sc-open');
    const file = input.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        const s = forecast.importSession(text);
        state.events = s.events;
        state.frozen = s.frozen;
        state.pinned = s.frozen.length > 0 ? { nativity: s.nativity, conventions: s.conventions } : null;
        render(`Opened ${s.events.length} ${s.events.length === 1 ? 'event' : 'events'} and ${s.frozen.length} frozen ${s.frozen.length === 1 ? 'forecast' : 'forecasts'}.${forecast.sessionRulesetMatches(s) ? '' : ' The file was made under other rules, so its frozen forecasts cannot be reproduced and are not counted.'}`);
      })
      .catch((err: unknown) => status(`That file could not be opened: ${err instanceof Error ? err.message : 'unreadable'}`))
      .finally(() => {
        input.value = '';
      });
  });

  render();
  return { refresh: showPinned };
}
