// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The forecast section of the page: reads the controls, evaluates after a short pause, keeps
 * the previous result on screen (greyed) while it computes, and writes the pure views of
 * forecastView.ts into the section. Nothing is stored and nothing leaves the tab. There is no
 * background thread (the guards forbid workers), so the work is cut into steps with a pause
 * between them and the page paints between the steps.
 */
import { forecast, type Conventions, type Moment } from '@overlay/core';
import {
  agreementHtml,
  buildModel,
  characterHtml,
  defaultSpan,
  esc,
  FORECAST_SENTENCE,
  gridHtml,
  natalHtml,
  notEvaluatedHtml,
  sexChoices,
  spanFrom,
  topicChoices,
  windowFrom,
  yearHtml,
  DEFAULT_WINDOW_DAYS,
  MAX_FIRST_YEAR,
  MAX_YEARS,
  MIN_FIRST_YEAR,
  type Model,
  type Selection,
} from './forecastView.ts';

export interface ForecastDeps {
  /** The moment of the form, or the message that says why there is none. */
  readMoment: () => Moment | string;
  /** The engine's conventions as the page holds them; they change the forecast too. */
  conventions: () => Conventions;
  uncertaintyMinutes: () => number;
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const PAUSE_MS = 400;

const localDay = (d: Date): string => `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function initForecast(deps: ForecastDeps): { schedule: () => void } {
  const now = new Date();
  const sel: Selection = { year: null, level: null };
  let model: Model | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let charTimer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;

  // --- controls, filled once ---
  const d = defaultSpan(now.getFullYear());
  $('fc-topic').innerHTML = topicChoices()
    .map((t) => `<option value="${esc(t.value)}"${t.value === forecast.DEFAULT_TOPIC ? ' selected' : ''}>${esc(t.label)}</option>`)
    .join('');
  const from = $<HTMLInputElement>('fc-from');
  const years = $<HTMLInputElement>('fc-years');
  from.min = String(MIN_FIRST_YEAR);
  from.max = String(MAX_FIRST_YEAR);
  from.value = String(d.fromYear);
  years.min = '1';
  years.max = String(MAX_YEARS);
  years.value = String(d.years);
  const sex = sexChoices();
  $('fc-sex-title').textContent = sex.title;
  $('fc-sex').innerHTML = sex.options.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
  $('fc-sex').title = sex.why;
  $('fc-sentence').textContent = FORECAST_SENTENCE;
  $<HTMLInputElement>('fc-win-start').value = localDay(now);
  $<HTMLInputElement>('fc-win-days').value = String(DEFAULT_WINDOW_DAYS);

  const settings = (): { topic: forecast.Topic; fromYear: number; toYear: number; sexConvention: forecast.SexConvention } => {
    const span = spanFrom(from.value, years.value, now.getFullYear());
    return {
      topic: $<HTMLSelectElement>('fc-topic').value as forecast.Topic,
      fromYear: span.fromYear,
      toYear: span.toYear,
      sexConvention: $<HTMLSelectElement>('fc-sex').value as forecast.SexConvention,
    };
  };

  const inputFor = (moment: Moment, fromYear: number, toYear: number, sexConvention: forecast.SexConvention): forecast.ForecastInput =>
    forecast.makeInput(moment, {
      fromYear,
      toYear,
      conventions: deps.conventions(),
      forecastConventions: { baziSexConvention: sexConvention },
      birthTimeUncertaintyMinutes: deps.uncertaintyMinutes(),
    });

  const status = (text: string): void => {
    $('fc-status').textContent = text;
  };

  // --- selection ---
  function applySelection(): void {
    for (const el of $('fc-grid').querySelectorAll<HTMLElement>('[data-year]')) {
      const year = Number(el.dataset.year);
      const isCell = el.dataset.level !== undefined;
      el.setAttribute('aria-pressed', String(year === sel.year && (!isCell || el.dataset.level === sel.level)));
      el.closest('th,td')?.classList.toggle('sel', year === sel.year);
    }
  }

  function renderYear(): void {
    const panel = $('fc-year');
    $('fc-hint').hidden = sel.year !== null;
    panel.hidden = sel.year === null;
    panel.innerHTML = model && sel.year !== null ? yearHtml(model, sel.year, sel.level) : '';
    if (model) $('fc-agree-body').innerHTML = agreementHtml(model, sel.year);
    applySelection();
  }

  function open(year: number, level: forecast.LevelId | null): void {
    sel.year = year;
    sel.level = level;
    renderYear();
    const target = level ? $('fc-year').querySelector<HTMLElement>(`[data-level="${level}"]`) : $('fc-year');
    target?.scrollIntoView({ block: 'nearest' });
  }

  // The fade at the right edge of the grid shows while there is more to scroll to.
  const marks = (): void => {
    const box = $('fc-grid').querySelector<HTMLElement>('.grid-box');
    if (!box) return;
    box.parentElement?.setAttribute('data-more', String(box.scrollWidth - box.clientWidth - box.scrollLeft > 4));
  };
  $('fc-grid').addEventListener('scroll', marks, true);
  window.addEventListener('resize', marks);

  $('fc-grid').addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button[data-year]');
    if (!el) return;
    const year = Number(el.dataset.year);
    if (el.dataset.level === undefined && sel.year === year && sel.level === null) {
      sel.year = null;
      renderYear();
      return;
    }
    open(year, (el.dataset.level as forecast.LevelId | undefined) ?? null);
  });

  // --- the forecast ---
  function render(): void {
    if (!model) return;
    $('fc-natal').innerHTML = natalHtml(model);
    $('fc-grid').innerHTML = gridHtml(model, sel);
    marks();
    $('fc-birth').innerHTML = `<p class="note">${esc(model.sensitivity.join(' '))}</p>`;
    $('fc-rules-body').innerHTML = notEvaluatedHtml(model);
    if (sel.year !== null && !model.grid.years.includes(sel.year)) sel.year = null;
    renderYear();
  }

  function run(): void {
    const mine = ++seq;
    const moment = deps.readMoment();
    if (typeof moment === 'string') {
      status(moment);
      return;
    }
    const s = settings();
    try {
      const input = inputFor(moment, s.fromYear, s.toYear, s.sexConvention);
      const result = forecast.evaluate(input, { topics: [s.topic] });
      if (mine !== seq) return;
      // With a stated uncertainty the evaluation is run twice more, with the birth moment moved earlier and later.
      const sensitivity = forecast.sensitivityLines(input, result, forecast.birthTimeSensitivity(input, result, { topics: [s.topic], runs: 20 }), s.topic);
      model = buildModel(result, s.topic, sensitivity);
      render();
      $('fc-body').classList.remove('stale');
      $('forecast').setAttribute('aria-busy', 'false');
      status('');
    } catch (err) {
      status(`The forecast could not be computed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
    scheduleCharacter(0);
  }

  function schedule(): void {
    clearTimeout(timer);
    if (model) $('fc-body').classList.add('stale');
    $('forecast').setAttribute('aria-busy', 'true');
    status('Calculating the forecast...');
    // The pause lets typing finish; the greyed result stays until the new one is ready.
    timer = setTimeout(run, PAUSE_MS);
  }

  // --- the character of a period ---
  function renderCharacter(): void {
    const out = $('fc-char-body');
    const win = windowFrom($<HTMLInputElement>('fc-win-start').value, $<HTMLInputElement>('fc-win-days').value);
    if (typeof win === 'string') {
      out.innerHTML = `<p class="note warn">${esc(win)}</p>`;
      return;
    }
    const moment = deps.readMoment();
    if (typeof moment === 'string') {
      out.innerHTML = `<p class="note warn">${esc(moment)}</p>`;
      return;
    }
    const s = settings();
    const startYear = new Date(win.startUtcMs).getUTCFullYear();
    try {
      const c = forecast.periodCharacter(inputFor(moment, startYear, startYear, s.sexConvention), { startUtcMs: win.startUtcMs, endUtcMs: win.endUtcMs });
      out.innerHTML = characterHtml(c);
    } catch (err) {
      out.innerHTML = `<p class="note warn">${esc(err instanceof Error ? err.message : 'The period could not be computed.')}</p>`;
    }
    out.classList.remove('stale');
  }

  function scheduleCharacter(wait: number): void {
    clearTimeout(charTimer);
    $('fc-char-body').classList.add('stale');
    charTimer = setTimeout(renderCharacter, wait);
  }

  for (const id of ['fc-topic', 'fc-from', 'fc-years', 'fc-sex']) $(id).addEventListener('input', schedule);
  for (const id of ['fc-win-start', 'fc-win-days']) $(id).addEventListener('input', () => scheduleCharacter(PAUSE_MS));
  $('fc-controls').addEventListener('submit', (e) => e.preventDefault());

  return {
    schedule: () => {
      schedule();
    },
  };
}
