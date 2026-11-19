// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The forecast as plain text lines, shared by the command line and the generated sample so that
 * the two cannot disagree. Every word the layer says on its own account comes from the phrasebook
 * of the core; what is added here is only layout. Nothing reads a clock: the span, the topic and the
 * result are arguments.
 */
import { CONVENTION_SPECS, forecast } from '@overlay/core';
import { FORECAST_SENTENCE } from './forecastGrid.ts';

const DAY = 86_400_000;

export const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

const topicLabel = (t: forecast.Topic): string => forecast.TOPIC_LABEL[t];

/** The glyph legend printed above a text grid. */
export const GRID_LEGEND = '+ supports, - cautions, ~ mixed, . nothing said';

export interface RuleCounts {
  /** Rules that were run for the span: bound, of a tradition switched on, and read by year. */
  evaluated: number;
  /** Rules bound but read by period (the I Ching and single day-transit rules), so not run for a span of years. */
  byWindow: number;
  /** Rules, or branches of rules, that are not evaluated, each with its reason. */
  notEvaluated: Array<{ ruleId: string; name: string; reason: string }>;
}

/** How many rules were evaluated and which were not, from the accounting of the run. */
export function ruleCounts(result: forecast.ForecastResult): RuleCounts {
  const names = new Map(forecast.DEFAULT_REGISTRY.rules.map((r) => [r.id, r.name]));
  const nameOf = (id: string): string => names.get(id) ?? '';
  let evaluated = 0;
  let byWindow = 0;
  const notEvaluated: RuleCounts['notEvaluated'] = [];
  for (const s of result.registry.statuses) {
    // Rules held back after checking are counted by the core as withheld and printed by its own line; the list here is the one of the JSON report.
    if (!result.traditions.includes(s.tradition) || s.state === 'held-back') continue;
    if (s.state === 'withheld' && s.reason === 'tradition-off') continue;
    if (s.state === 'bound') {
      if (result.periodRead.includes(s.tradition) || result.periodReadRules.includes(s.ruleId)) byWindow++;
      else evaluated++;
    } else notEvaluated.push({ ruleId: s.ruleId, name: nameOf(s.ruleId), reason: s.detail });
  }
  for (const b of result.registry.branches) notEvaluated.push({ ruleId: b.ruleId, name: nameOf(b.ruleId), reason: forecast.notEvaluatedBranchLine(b.branch, b.reason) });
  return { evaluated, byWindow, notEvaluated };
}

/** The one closing line of the short output: how many rules were evaluated, how many were not, and where the list is. */
export function closingLine(counts: RuleCounts): string {
  const w = counts.byWindow > 0 ? ` (${counts.byWindow} more are read by window, not by year)` : '';
  return `${counts.evaluated} rules were evaluated and ${counts.notEvaluated.length} were not${w}, over every topic; the list of those not evaluated is under --full and in the JSON report (notEvaluated).`;
}

/** Both families of conventions the run used, as name and value, in the order of their specifications. */
export function conventionPairs(result: forecast.ForecastResult): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const pick = (specs: ReadonlyArray<{ key: string }>, values: object): void => {
    for (const spec of specs) out.push([spec.key, String((values as Record<string, unknown>)[spec.key])]);
  };
  pick(CONVENTION_SPECS, result.conventions.engine);
  pick(forecast.FORECAST_CONVENTION_SPECS, result.conventions.forecast);
  return out;
}

/** The natal promise: what the chart itself says, without dates. */
export function natalLines(list: forecast.StatementList): string[] {
  const out = [list.natalHeading];
  if (list.natal.length === 0) out.push('  nothing said');
  for (const e of list.natal) out.push(`  ${e.levelLabel.replace(/^./, (c) => c.toUpperCase())}, ${forecast.WORD[e.word]}: ${e.sentence}`);
  if (list.natalPointers.length > 0) out.push(`  ${forecast.pointerLabel(list.natalPointers.length)} (listed with --full)`);
  for (const note of list.chartNotes) out.push(`  ${note}`);
  return out;
}

export function headlineLines(view: forecast.YearView): string[] {
  return view.years.map((y) => `${y.year}: ${y.headline}`);
}

export interface TextReportOptions {
  full?: boolean;
  /** For the full part: only these years (the sample prints the first three). */
  fullYears?: readonly number[];
}

/** A citation and its locator in one phrase; the citations end in a full stop of their own. */
const citeOf = (src: { citation: string; locator: string }): string => `${src.citation.replace(/\.$/, '')}, ${src.locator}`;

const spanOf = (e: Pick<forecast.StatementEntry, 'fullStartUtcMs' | 'fullEndUtcMs'>): string =>
  e.fullStartUtcMs === null || e.fullEndUtcMs === null ? 'undated' : `${isoDay(e.fullStartUtcMs)} to ${isoDay(e.fullEndUtcMs - 1)}`;

/** One statement in full: the sentence under its word, then its dates, rule and source, then its qualifiers. */
export function entryLines(result: forecast.ForecastResult, e: forecast.StatementEntry, indent: string): string[] {
  const s = result.signals.find((x) => x.id === e.signalId);
  const out = [`${indent}${forecast.WORD[e.word]}: ${e.sentence}`];
  const parts = [spanOf(e), `rule ${e.ruleId}${s ? ` (${s.ruleName})` : ''}`];
  if (s) parts.push(`source: ${citeOf(s.source)}`);
  out.push(`${indent}  ${parts.join('; ')}`);
  if (e.badges.length > 0) out.push(`${indent}  ${e.badges.join(', ')}`);
  if (e.alsoReportedBy > 0) out.push(`${indent}  ${forecast.NOTE.sameFactAlso} ${e.alsoReportedBy} other ${e.alsoReportedBy === 1 ? 'rule' : 'rules'}`);
  for (const q of e.qualifiers) {
    const more = q.alsoQualifies > 0 ? `; it qualifies ${q.alsoQualifies} more ${q.alsoQualifies === 1 ? 'statement' : 'statements'} that do not repeat it` : '';
    out.push(`${indent}  qualified by (${q.levelLabel}, rule ${q.ruleId}): ${q.sentence}${more}`);
  }
  return out;
}

/** The statements of the given years, year by year and level by level; a statement that runs on is said in full once and named after that. */
export function yearStatementLines(result: forecast.ForecastResult, topic: forecast.Topic, years: readonly number[]): string[] {
  const list = forecast.statementList(result, topic);
  const grid = forecast.decadeGrid(result, topic);
  const byId = new Map([...list.natal, ...list.dated].map((e) => [e.signalId, e]));
  const said = new Map<string, number>();
  const out: string[] = [];
  for (const [i, year] of grid.years.entries()) {
    if (!years.includes(year)) continue;
    out.push('', String(year), `  ${grid.headlines[i]}`);
    for (const row of grid.rows) {
      const cell = row.cells[i]!;
      const body: string[] = [];
      for (const id of cell.entryIds) {
        const e = byId.get(id);
        if (!e) continue;
        const first = said.get(id);
        if (first === undefined) {
          said.set(id, year);
          body.push(...entryLines(result, e, '      '));
        } else body.push(`      ${forecast.WORD[e.word]}: ${e.sentence} (rule ${e.ruleId}; said in full under ${first})`);
      }
      if (cell.pointers) {
        body.push(`      ${cell.pointers.label}`);
        for (const p of cell.pointers.entries) body.push(`        - ${p.sentence} (rule ${p.ruleId}; ${spanOf(p)})`);
      }
      if (body.length === 0 && cell.silentReason === null) continue;
      out.push(`    ${row.label}: ${cell.wordText}${cell.note ? ` (${cell.note})` : ''}${cell.tally.supports + cell.tally.cautions + cell.tally.mixed > 0 ? `; ${cell.tallyText}` : ''}`);
      if (body.length === 0) out.push(`      ${cell.silentReason}`);
      out.push(...body);
    }
  }
  return out;
}

/** The agreement display of a topic, printed where the command asked for everything. */
export function agreementLines(result: forecast.ForecastResult, topic: forecast.Topic): string[] {
  const a = forecast.agreementDisplay(result, topic);
  const out = [a.groupsLine];
  if (!a.shown) return [...out, a.line];
  for (const y of a.years) out.push(`${y.year}: ${[y.text, ...y.notes].join('; ')}`);
  out.push(a.baselineLine, ...a.sentences);
  return out;
}

export function notEvaluatedLines(counts: RuleCounts): string[] {
  return counts.notEvaluated.map((n) => `${n.ruleId}${n.name ? ` (${n.name})` : ''}: ${n.reason}`);
}

/**
 * The forecast as text: the sentence, the natal promise, the grid as a table, the headline of each
 * year and one closing line. With `full` the statements of every year follow, then the agreement
 * display, the rules not evaluated and the conventions used.
 */
export function forecastTextLines(result: forecast.ForecastResult, topic: forecast.Topic, options: TextReportOptions = {}): string[] {
  const list = forecast.statementList(result, topic);
  const grid = forecast.decadeGrid(result, topic);
  const view = forecast.yearView(result, topic);
  const counts = ruleCounts(result);
  const first = grid.years[0];
  const last = grid.years[grid.years.length - 1];
  const out = [`Forecast for ${topicLabel(topic)}, ${first} to ${last}`, FORECAST_SENTENCE, '', ...natalLines(list), '', `Grid (${GRID_LEGEND})`, ...forecast.gridText(grid), '', 'Each year', ...headlineLines(view)];
  if (options.full) {
    out.push('', 'The statements, year by year', ...yearStatementLines(result, topic, options.fullYears ?? grid.years).slice(1));
    if (list.natalPointers.length > 0) out.push('', `The natal pointers (${forecast.pointerLabel(list.natalPointers.length)})`, ...list.natalPointers.map((p) => `  - ${p.sentence} (rule ${p.ruleId})`));
    out.push('', 'Agreement between independent groups', ...agreementLines(result, topic));
    out.push('', `The rules not evaluated (${counts.notEvaluated.length})`, ...notEvaluatedLines(counts).map((l) => `  ${l}`), `  ${forecast.rulesLine(result.availableCount, result.withheldCount)}`);
    out.push('', 'The conventions used', ...conventionPairs(result).map(([k, v]) => `  ${k}: ${v}`));
  }
  out.push('', closingLine(counts));
  return out;
}

// ---------------------------------------------------------------------------
// The short window
// ---------------------------------------------------------------------------

/** The character of a window of at most 62 days: the I Ching and the Western day statements, each in its own part. */
export function windowTextLines(c: forecast.PeriodCharacter): string[] {
  const out = [`The character of the window ${isoDay(c.window.startUtcMs)} to ${isoDay(c.window.endUtcMs - 1)} (${Math.round((c.window.endUtcMs - c.window.startUtcMs) / DAY)} days)`, FORECAST_SENTENCE, ''];
  out.push(`The I Ching, read by period [${c.iching.badges.join(', ')}]`, `  ${c.iching.note}`);
  const hex = (h: forecast.IchingStatement['hexagram']): string => `${h.number} ${h.hanzi} ${h.pinyin}`;
  const span = (s: { startUtcMs: number; endUtcMs: number }): string => `${isoDay(s.startUtcMs)} to ${isoDay(s.endUtcMs - 1)}`;
  out.push('  Hexagram periods');
  for (const p of c.iching.periods) out.push(`    ${span(p)}  ${hex(p.hexagram)}`);
  out.push('  Sovereign hexagram of the month');
  for (const p of c.iching.sovereign) out.push(`    ${span(p)}  ${hex(p.hexagram)}${p.growing ? ', growing' : ', waning'}`);
  if (c.iching.cardinal.length > 0) {
    out.push('  Cardinal hexagram periods');
    for (const p of c.iching.cardinal) out.push(`    ${span(p)}  ${hex(p.hexagram)}`);
  }
  out.push('  Day by day: the line of the period hexagram the day falls in');
  for (const d of c.iching.days) out.push(`    ${isoDay(d.startUtcMs)}  ${hex(d.hexagram)}, line ${d.line}: ${d.text} (grade ${d.gradeText})`);
  out.push('', 'Western astrology, the days a planet passes a point of the birth chart');
  out.push(`  ${c.western.note}`);
  if (c.western.unavailable) out.push(`  not available: ${c.western.unavailable}`);
  else if (c.western.statements.length === 0) out.push('  no such pass in this window');
  for (const s of c.western.statements) {
    out.push(`  ${isoDay(s.dayUtcMs)}  ${s.levelLabel}, ${forecast.WORD[s.word]}: ${s.sentence}`, `    rule ${s.ruleId}; source: ${citeOf(s.source)}`);
  }
  // The badges are the same on every day of a rule, so they are said once.
  const badges = [...new Set(c.western.statements.flatMap((s) => s.badges))];
  if (badges.length > 0) out.push('  How these statements were derived', ...badges.map((b) => `    ${b}`));
  return out;
}
