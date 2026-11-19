// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The forecast section of the page as pure functions from the core's results to HTML text.
 * Nothing here touches the document, the clock or the network, so every function can be tested
 * on a result computed from a sample moment. Every word a reader sees about a rule, a level or a
 * count comes from the core (the phrasebook and the views built on it); what is written here is
 * only the labels of the controls and the headings. Colour is never the only signal: every cell
 * carries a glyph and an accessible name.
 */
import { forecast, utcMsFromFields } from '@overlay/core';

type Result = forecast.ForecastResult;
type Entry = forecast.StatementEntry;
type Topic = forecast.Topic;
type LevelId = forecast.LevelId;
type GridCell = forecast.GridCell;
type GridRow = forecast.GridRow;

/** The one sentence that stands wherever a forecast is shown. */
export const FORECAST_SENTENCE =
  'Each line is what a named rule of one tradition says about this period, with its source. Nobody has tested these statements against outcomes yet.';

export const MAX_YEARS = 20;
export const MIN_FIRST_YEAR = 1800;
export const MAX_FIRST_YEAR = 2200;
export const DEFAULT_YEARS = 10;
export const DEFAULT_WINDOW_DAYS = 30;

export const esc = (s: string | number): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The calendar day of an instant, in UTC, as the core dates its statements. */
export const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

// --- controls ----------------------------------------------------------------

export const topicChoices = (): Array<{ value: Topic; label: string }> => forecast.TOPICS.map((t) => ({ value: t, label: forecast.TOPIC_LABEL[t] }));

const SEX_SPEC = forecast.FORECAST_CONVENTION_SPECS.find((s) => s.key === 'baziSexConvention')!;

/** The core's own title and option labels for the BaZi sex convention; the first state is "not given". */
export function sexChoices(): { title: string; why: string; options: Array<{ value: forecast.SexConvention; label: string }> } {
  const labels: Record<string, string> = {};
  for (const o of SEX_SPEC.options) labels[String(o.value)] = o.label;
  return {
    title: SEX_SPEC.title,
    why: SEX_SPEC.why,
    options: [
      { value: 'none', label: 'not given' },
      { value: 'male-chart', label: labels['male-chart']! },
      { value: 'female-chart', label: labels['female-chart']! },
    ],
  };
}

/** The first year and the number of years a reader gets without choosing: ten years from the current year. */
export const defaultSpan = (currentYear: number): { fromYear: number; years: number } => ({ fromYear: currentYear, years: DEFAULT_YEARS });

const whole = (raw: string, fallback: number, lo: number, hi: number): number => {
  const n = Math.trunc(Number(raw));
  return raw.trim() === '' || !Number.isFinite(n) ? fallback : Math.min(hi, Math.max(lo, n));
};

/** The span from what was typed: whole numbers, kept within what the page computes in reasonable time. */
export function spanFrom(rawFrom: string, rawYears: string, currentYear: number): { fromYear: number; toYear: number; years: number } {
  const d = defaultSpan(currentYear);
  const fromYear = whole(rawFrom, d.fromYear, MIN_FIRST_YEAR, MAX_FIRST_YEAR);
  const years = whole(rawYears, d.years, 1, MAX_YEARS);
  return { fromYear, toYear: fromYear + years - 1, years };
}

/** The window of the character card from a typed day and a number of days (1 to 62), or a message. */
export function windowFrom(rawDay: string, rawDays: string): { startUtcMs: number; endUtcMs: number; days: number } | string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDay);
  if (!m) return 'Pick a date for the period.';
  const days = whole(rawDays, DEFAULT_WINDOW_DAYS, 1, forecast.MAX_WINDOW_DAYS);
  const startUtcMs = utcMsFromFields(+m[1]!, +m[2]!, +m[3]!);
  return { startUtcMs, endUtcMs: startUtcMs + days * 86_400_000, days };
}

// --- the model ---------------------------------------------------------------

export interface Model {
  result: Result;
  topic: Topic;
  list: forecast.StatementList;
  grid: forecast.DecadeGrid;
  view: forecast.YearView;
  agreement: forecast.AgreementDisplay;
  entries: Map<string, Entry>;
  /** What is said about the birth time: the cells that would change, that none would, or that it was not checked. */
  sensitivity: readonly string[];
  signals: Map<string, forecast.Signal>;
  rules: Map<string, forecast.Rule>;
}

/** Every readable form of one evaluation, made once, so that the grid and the year panel cannot disagree. */
export function buildModel(result: Result, topic: Topic, sensitivity: readonly string[] = []): Model {
  const list = forecast.statementList(result, topic);
  const entries = new Map<string, Entry>();
  for (const e of [...list.natal, ...list.natalPointers, ...list.dated, ...list.pointers]) entries.set(e.signalId, e);
  return {
    result,
    topic,
    list,
    grid: forecast.decadeGrid(result, topic),
    view: forecast.yearView(result, topic),
    agreement: forecast.agreementDisplay(result, topic),
    entries,
    sensitivity,
    signals: new Map(result.signals.map((s) => [s.id, s])),
    rules: new Map(forecast.DEFAULT_REGISTRY.rules.map((r) => [r.id, r])),
  };
}

// --- statements --------------------------------------------------------------

/** A quotation of at most 25 words, whatever the data holds. */
export function limitWords(quote: string, max = 25): string {
  const words = quote.trim().split(/\s+/);
  return words.length <= max ? quote.trim() : `${words.slice(0, max).join(' ')} ...`;
}

const chip = (word: string, text: string): string => `<span class="chip w-${esc(word)}">${esc(text)}</span>`;

function datesOf(e: Entry): string {
  if (e.fullStartUtcMs === null || e.fullEndUtcMs === null) return 'no dates: a statement of the chart itself';
  const edge = [e.beganBefore ? 'began before the span' : '', e.endsAfter ? 'ends after the span' : ''].filter((x) => x !== '');
  const joined = e.signalIds.length > 1 ? `joined from ${e.signalIds.length} periods that touch` : '';
  const notes = [...edge, joined].filter((x) => x !== '');
  return `${isoDay(e.fullStartUtcMs)} to ${isoDay(e.fullEndUtcMs)}${notes.length > 0 ? ` (${notes.join('; ')})` : ''}`;
}

/** The detail of one statement: the rule, what it says, the facts it was read from, the conventions, and its source. */
export function detailHtml(m: Model, e: Entry): string {
  const s = m.signals.get(e.signalId);
  const rule = m.rules.get(e.ruleId);
  if (!s) return '';
  const facts = s.facts.length === 0 ? '' : `<table class="facts"><tbody>${s.facts.map((f) => `<tr><th scope="row">${esc(f.label)}</th><td>${esc(f.value)}${f.unit ? ` ${esc(f.unit)}` : ''}</td></tr>`).join('')}</tbody></table>`;
  const quote = !s.source.opened ? forecast.TEXT.sourceNotOpened : s.source.quote.trim() === '' ? forecast.TEXT.noQuotation : `“${limitWords(s.source.quote)}”`;
  const rows: Array<[string, string]> = [
    ['Rule', `${esc(rule?.name ?? s.ruleName)} <code>${esc(s.ruleId)}</code>`],
    ['Condition', esc(rule?.condition ?? '')],
    ['Facts used', facts === '' ? 'none recorded' : facts],
    ['Conventions', s.conventionsUsed.length === 0 ? 'none named' : esc(s.conventionsUsed.join(', '))],
    ['Source', esc(s.source.citation)],
    ['Locator', esc(s.source.locator)],
    ['Quotation', esc(quote)],
  ];
  if (s.variants.trim() !== '') rows.push(['Other schools', esc(s.variants)]);
  if (e.alsoReportedBy > 0) rows.push([forecast.NOTE.sameFactAlso.replace(/^./, (c) => c.toUpperCase()), `${e.alsoReportedBy} other ${e.alsoReportedBy === 1 ? 'rule' : 'rules'}`]);
  return `<dl class="detail">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
}

/** One statement: its dates, its word and sentence, its badges, the detail folded under it, and its qualifiers. */
export function statementHtml(m: Model, e: Entry): string {
  const badges = e.badges.length === 0 ? '' : `<p class="badges">${e.badges.map((b) => `<span class="badge">${esc(b)}</span>`).join('')}</p>`;
  const quals =
    e.qualifiers.length === 0
      ? ''
      : `<ul class="quals">${e.qualifiers
          .map((q) => {
            const more = q.alsoQualifies > 0 ? ` <span class="muted">(it also qualifies ${q.alsoQualifies} further ${q.alsoQualifies === 1 ? 'statement' : 'statements'})</span>` : '';
            return `<li><span class="muted">Qualifier, ${esc(isoDay(q.startUtcMs))} to ${esc(isoDay(q.endUtcMs))}:</span> ${esc(q.sentence)}${more}</li>`;
          })
          .join('')}</ul>`;
  return (
    `<article class="stmt w-${esc(e.word)}" data-signal="${esc(e.signalId)}">` +
    `<p class="when">${esc(datesOf(e))}</p>` +
    `<p class="sent">${chip(e.word, forecast.WORD[e.word])} <span class="tr">${esc(forecast.TRADITION_NAME[e.tradition])}, ${esc(e.levelLabel)}.</span> ${esc(e.sentence)}</p>` +
    badges +
    `<details class="why"><summary>Rule, source and facts</summary>${detailHtml(m, e)}</details>` +
    quals +
    `</article>`
  );
}

// --- the natal promise ---------------------------------------------------------

export function natalHtml(m: Model): string {
  const { list } = m;
  const items = list.natal.map((e) => `<li>${statementHtml(m, e)}</li>`).join('');
  const pointers =
    list.natalPointers.length === 0
      ? ''
      : `<details class="ptr"><summary>${esc(forecast.pointerLabel(list.natalPointers.length))}</summary><ul class="stmts">${list.natalPointers.map((e) => `<li>${statementHtml(m, e)}</li>`).join('')}</ul></details>`;
  const notes = list.chartNotes.map((n) => `<p class="note">${esc(n)}</p>`).join('');
  const body = items === '' ? '<p class="note">The chart states nothing undated for this topic.</p>' : `<ul class="stmts">${items}</ul>`;
  return `<h3>${esc(list.natalHeading)}</h3>${notes}${body}${pointers}`;
}

// --- the decade grid -----------------------------------------------------------

/** The accessible name of a cell: "2031, Saturn from the Moon, cautions". */
export function cellLabel(row: GridRow, cell: GridCell): string {
  const parts = [`${cell.year}`, row.label, cell.wordText];
  if (cell.word === 'mixed') parts.push(cell.tallyText);
  if (cell.word === 'nothing-said' && cell.silentReason) parts.push(cell.silentReason);
  if (cell.pointers) parts.push(cell.pointers.label.split(':')[0]!);
  return parts.join(', ');
}

/** The background of a split cell: supporting, then mixed, then cautioning, each as wide as its share. For drawing only. */
export function splitStyle(c: GridCell): string {
  const a = Math.round(c.shares.supports * 1000) / 10;
  const b = Math.round((c.shares.supports + c.shares.mixed) * 1000) / 10;
  return `--a:${a}%;--b:${b}%`;
}

export interface Selection {
  year: number | null;
  level: LevelId | null;
}

export function legendHtml(): string {
  const g = forecast.GRID_GLYPH;
  return (
    `<ul class="legend" aria-label="Legend">` +
    `<li><span class="sw w-supports"><span class="g">${esc(g.supports)}</span></span> ${esc(forecast.WORD.supports)}</li>` +
    `<li><span class="sw w-cautions"><span class="g">${esc(g.cautions)}</span></span> ${esc(forecast.WORD.cautions)}</li>` +
    `<li><span class="sw w-mixed split" style="--a:50%;--b:50%"><span class="g">${esc(g.mixed)}</span></span> ${esc(forecast.WORD.mixed)}: split by the shares of supporting and cautioning statements, and of those a rule states as mixed</li>` +
    `<li><span class="sw w-nothing-said"><span class="g">${esc(g['nothing-said'])}</span></span> ${esc(forecast.WORD['nothing-said'])}</li>` +
    `</ul>`
  );
}

export function gridHtml(m: Model, sel: Selection): string {
  const { grid } = m;
  const cols = grid.years.length + 1;
  const head = grid.years
    .map((y) => `<th scope="col"${y === sel.year ? ' class="sel"' : ''}><button type="button" class="yr" data-year="${y}" aria-pressed="${y === sel.year}">${y}</button></th>`)
    .join('');
  const body = grid.groups
    .map((g) => {
      const rows = g.rows
        .map((r) => {
          const cells = r.cells
            .map((c) => {
              const split = c.word === 'mixed' ? ' split' : '';
              const style = c.word === 'mixed' ? ` style="${splitStyle(c)}"` : '';
              const pressed = c.year === sel.year && r.level === sel.level;
              return (
                `<td${c.year === sel.year ? ' class="sel"' : ''}><button type="button" class="cell w-${esc(c.word)}${split}" data-year="${c.year}" data-level="${esc(r.level)}" aria-pressed="${pressed}" aria-label="${esc(cellLabel(r, c))}"${style}>` +
                `<span class="g" aria-hidden="true">${esc(forecast.GRID_GLYPH[c.word])}</span></button></td>`
              );
            })
            .join('');
          return `<tr><th scope="row" class="lv">${esc(r.label)}${r.note ? `<small>${esc(r.note)}</small>` : ''}</th>${cells}</tr>`;
        })
        .join('');
      return `<tr class="trad"><th scope="colgroup" colspan="${cols}"><span class="stick">${esc(g.name)}</span></th></tr>${rows}`;
    })
    .join('');
  const periodRead = grid.periodRead.map((p) => `<p class="note">${esc(p.line)}</p>`).join('');
  return (
    `<div class="grid-box" role="region" aria-label="Decade grid, scrolls sideways" tabindex="0">` +
    `<table class="dgrid"><thead><tr><th scope="col" class="lv"><span class="sr">Level</span></th>${head}</tr></thead><tbody>${body}</tbody></table></div>` +
    legendHtml() +
    periodRead
  );
}

// --- one year ------------------------------------------------------------------

function levelHtml(m: Model, row: forecast.YearLevelCell, focus: LevelId | null): string {
  const tradition = forecast.TRADITION_NAME[m.grid.rows.find((r) => r.level === row.level)!.tradition];
  const note = row.word === 'nothing-said' ? (row.silentReason ?? row.chartNote) : row.note;
  const dated = row.entryIds.map((id) => m.entries.get(id)).filter((e): e is Entry => e !== undefined);
  const tally = row.word === 'nothing-said' ? '' : `<p class="tally">${esc(row.tallyText)}${row.note ? ` <span class="muted">(${esc(row.note)})</span>` : ''}</p>`;
  const silentNote = row.word === 'nothing-said' && note ? `<p class="note">${esc(note)}</p>` : '';
  const stmts = dated.length === 0 ? '' : `<ul class="stmts">${dated.map((e) => `<li>${statementHtml(m, e)}</li>`).join('')}</ul>`;
  const pointers = row.pointers
    ? `<details class="ptr"><summary>${esc(row.pointers.label)}</summary><ul class="stmts">${row.pointers.entries.map((e) => `<li>${statementHtml(m, e)}</li>`).join('')}</ul></details>`
    : '';
  return (
    `<div class="lvl w-${esc(row.word)}${row.level === focus ? ' focus' : ''}" data-level="${esc(row.level)}">` +
    `<h4>${chip(row.word, row.wordText)} ${esc(row.label)} <span class="tr">${esc(tradition)}</span></h4>` +
    tally +
    silentNote +
    stmts +
    pointers +
    `</div>`
  );
}

export function yearHtml(m: Model, year: number, focus: LevelId | null): string {
  const y = m.view.years.find((v) => v.year === year);
  if (!y) return '';
  return `<h3 id="year-h">${y.year}</h3><p class="headline">${esc(y.headline)}</p>${y.levels.map((l) => levelHtml(m, l, focus)).join('')}`;
}

// --- agreement -----------------------------------------------------------------

/** The agreement display as the core returns it: the strip with its baseline line and sentences, or the one line, and the sentence naming the groups. */
export function agreementHtml(m: Model, year: number | null): string {
  const a = m.agreement;
  if (!a.shown) return `<p class="note">${esc(a.line)}</p><p class="note">${esc(a.groupsLine)}</p>`;
  const strip = forecast
    .agreementRuns(a.years)
    .map((r) => `<li${year !== null && year >= r.fromYear && year <= r.toYear ? ' class="sel"' : ''}><b>${forecast.runLabel(r)}</b> ${esc(r.text)}${r.notes.length > 0 ? ` <span class="muted">(${esc(r.notes.join('; '))})</span>` : ''}</li>`)
    .join('');
  return `<ol class="strip">${strip}</ol><p>${esc(a.baselineLine)}</p>${a.sentences.map((s) => `<p class="note">${esc(s)}</p>`).join('')}<p class="note">${esc(a.groupsLine)}</p>`;
}

// --- the character of a period --------------------------------------------------

/** King Wen number to the Unicode hexagram sign. */
export const hexagramSign = (n: number): string => String.fromCodePoint(0x4dc0 + n - 1);

function ichingLine(s: forecast.IchingStatement, extra = '', sign = ''): string {
  return (
    `<li><span class="when">${esc(isoDay(s.startUtcMs))} to ${esc(isoDay(s.endUtcMs))}</span> ` +
    `<span class="hex" aria-hidden="true">${esc(hexagramSign(s.hexagram.number))}</span> ` +
    `<b>${s.hexagram.number} ${esc(s.hexagram.hanzi)}</b> ${esc(s.hexagram.pinyin)}${extra}` +
    `<span class="zh" lang="zh">${esc(s.text)}</span> ` +
    `${sign ? `<span class="muted">${esc(sign)}</span> ` : ''}<span class="muted">${esc(forecast.ichingNotes(s).join('; '))}</span> ${s.badges.map((b) => `<span class="badge">${esc(b)}</span>`).join('')}</li>`
  );
}

export function characterHtml(c: forecast.PeriodCharacter): string {
  const { iching, western } = c;
  const days = iching.days.length === 0 ? '' : `<details class="ptr"><summary>The line of each day (${iching.days.length} days)</summary><ul class="plain">${iching.days.map((d) => ichingLine(d, ` line ${d.line} `)).join('')}</ul></details>`;
  const ich =
    `<h4>The I Ching</h4><p class="note">${esc(iching.note)}</p>` +
    `<p class="muted">Hexagram periods</p><ul class="plain">${iching.periods.map((p) => ichingLine(p, ' ')).join('')}</ul>` +
    `<p class="muted">Sovereign hexagram of the month</p><ul class="plain">${iching.sovereign.map((p) => ichingLine(p, `${p.growing ? ' growing ' : ' waning '}`, p.growing ? 'career supports' : 'career cautions')).join('')}</ul>` +
    (iching.cardinal.length === 0 ? '' : `<p class="muted">Cardinal hexagrams</p><ul class="plain">${iching.cardinal.map((p) => ichingLine(p, ' ')).join('')}</ul>`) +
    days;
  const st = western.statements
    .map(
      (s) =>
        `<li><span class="when">${esc(isoDay(s.dayUtcMs))}</span> ${chip(s.word, forecast.WORD[s.word])} ${esc(s.sentence)}` +
        `<details class="why"><summary>Rule and source</summary><dl class="detail"><dt>Rule</dt><dd>${esc(s.ruleId)}</dd><dt>Source</dt><dd>${esc(s.source.citation)}</dd><dt>Locator</dt><dd>${esc(s.source.locator)}</dd>` +
        `${s.badges.length > 0 ? `<dt>Notes</dt><dd>${s.badges.map((b) => `<span class="badge">${esc(b)}</span>`).join('')}</dd>` : ''}</dl></details></li>`,
    )
    .join('');
  const wes =
    `<h4>Lilly&rsquo;s day transits</h4><p class="note">${esc(western.note)}</p>` +
    (western.unavailable ? `<p class="note">${esc(western.unavailable)}</p>` : '') +
    (western.statements.length === 0 && !western.unavailable ? '<p class="note">No day statement falls in this window.</p>' : `<ul class="plain">${st}</ul>`);
  return `<div class="two">${`<div>${ich}</div><div>${wes}</div>`}</div>`;
}

// --- rules not evaluated --------------------------------------------------------

export interface RuleCounts {
  evaluated: number;
  notEvaluated: number;
  heldBack: number;
}

export function ruleCounts(result: Result): RuleCounts {
  let evaluated = 0;
  let notEvaluated = 0;
  let heldBack = 0;
  for (const s of result.registry.statuses) {
    if (s.state === 'bound') evaluated++;
    else if (s.state === 'held-back') heldBack++;
    else if (!(s.state === 'withheld' && s.reason === 'tradition-off')) notEvaluated++;
  }
  return { evaluated, notEvaluated, heldBack };
}

export function notEvaluatedHtml(m: Model): string {
  const { result } = m;
  const counts = ruleCounts(result);
  const nameOf = (id: string): string => m.rules.get(id)?.name ?? id;
  const row = (tradition: string, id: string, name: string, reason: string): string => `<li><b>${esc(name)}</b> <code>${esc(id)}</code> <span class="muted">${esc(tradition)}</span><br />${esc(reason)}</li>`;
  const out: string[] = [];
  for (const s of result.registry.statuses) {
    if (s.state === 'withheld' && s.reason !== 'tradition-off') out.push(row(forecast.TRADITION_NAME[s.tradition], s.ruleId, nameOf(s.ruleId), s.detail));
    else if (s.state === 'unbound') out.push(row(forecast.TRADITION_NAME[s.tradition], s.ruleId, nameOf(s.ruleId), s.detail));
  }
  for (const b of result.registry.branches) {
    const tradition = m.rules.get(b.ruleId)?.tradition;
    out.push(row(tradition ? forecast.TRADITION_NAME[tradition] : '', b.ruleId, nameOf(b.ruleId), forecast.notEvaluatedBranchLine(b.branch, b.reason)));
  }
  const held = result.registry.statuses.filter((s) => s.state === 'held-back').map((s) => row(forecast.TRADITION_NAME[s.tradition], s.ruleId, s.ruleId, s.detail));
  return (
    `<p class="counts"><b>${counts.evaluated}</b> rules evaluated, <b>${counts.notEvaluated}</b> not evaluated, <b>${counts.heldBack}</b> held back (source not opened or unverified).</p>` +
    `<h4>Not evaluated</h4><ul class="plain">${out.join('')}</ul>` +
    `<h4>Held back</h4><ul class="plain">${held.join('')}</ul>`
  );
}

// --- plain text, for tests and the sample ------------------------------------------

/** The text a reader sees in a piece of HTML: tags removed, entities restored, runs of space joined. */
export function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&rsquo;/g, '’')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
