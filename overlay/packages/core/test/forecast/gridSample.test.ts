// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * One test per point of the readable display on a sample moment, with the real rules: the
 * decade grid, the headline, the pointers, the edge of a year (j2000 has its birthday on
 * 1 January), joined spans, the rule read by period, the three Western rules after the page was
 * re-read, the plain words, the baseline and the JSON. Wealth, 2026 to 2035.
 */
import { describe, expect, it } from 'vitest';
import {
  agreementDisplay,
  createContext,
  DEFAULT_REGISTRY,
  decadeGrid,
  evaluate,
  HEADLINE_HEADING,
  LEVEL_IDS,
  makeInput,
  periodCharacter,
  reportJson,
  ruleById,
  statementList,
  TEXT,
  yearView,
  VERDICT_TEXT,
  type DecadeGrid,
  type ForecastResult,
} from '../../src/forecast/index.ts';
import type { WesternContext } from '../../src/forecast/predicates/western/context.ts';
import { makeMoment, MS } from '../../src/substrate/time.ts';
import { fixture } from '../../../../fixtures/moments.ts';

const FROM = 2026;
const TO = 2035;
const TOPIC = 'wealth' as const;

const inputOf = (id: string, extra: Partial<Parameters<typeof makeInput>[1]> = {}, from = FROM, to = TO) => {
  const f = fixture(id);
  return makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: from, toYear: to, forecastConventions: id === 'jiazi-1984' ? { baziSexConvention: 'male-chart' } : {}, ...extra });
};

const cache = new Map<string, ForecastResult>();
const resultOf = (id: string): ForecastResult => {
  let r = cache.get(id);
  if (!r) cache.set(id, (r = evaluate(inputOf(id), { topics: [TOPIC] })));
  return r;
};

const IDS = ['j2000', 'jiazi-1984', 'southern'] as const;
const cellOf = (g: DecadeGrid, level: string, year: number) => g.rows.find((r) => r.level === level)!.cells[year - FROM]!;

describe('on the sample moments, wealth, 2026 to 2035', () => {
  // point 1
  it('the decade grid: a row for every declared level in the fixed order, silent where it never fires, with the stated reason', () => {
    for (const id of IDS) {
      const g = decadeGrid(resultOf(id), TOPIC);
      expect(g.years).toHaveLength(10);
      const order = g.rows.map((r) => LEVEL_IDS.indexOf(r.level));
      expect(order, id).toEqual([...order].sort((a, b) => a - b));
      expect(g.rows.map((r) => r.level), id).toEqual(['bazi-luck', 'bazi-year', 'vedic-maha', 'vedic-antar', 'saturn-moon', 'jupiter-moon', 'western-profection', 'western-solar-return']);
      expect(g.groups.map((x) => x.tradition)).toEqual(['bazi', 'vedic', 'western']);
      for (const r of g.rows) expect(r.cells).toHaveLength(10);
      expect(g.periodRead).toEqual([{ tradition: 'iching', line: TEXT.ichingByPeriod }]);
    }
    // the solar return of the two later moments never speaks for wealth in the span, and its row is there all the same
    for (const id of ['jiazi-1984', 'southern']) expect(decadeGrid(resultOf(id), TOPIC).rows.find((r) => r.level === 'western-solar-return')!.cells.every((c) => c.word === 'nothing-said')).toBe(true);
    // no luck pillar is cast without a sex convention, and the row says so; with one, a balanced chart says that it names no favourite
    const j = decadeGrid(resultOf('j2000'), TOPIC);
    expect(j.rows[0]).toMatchObject({ level: 'bazi-luck', note: 'needs the luck-direction convention' });
    expect(j.rows[0]!.cells.every((c) => c.word === 'nothing-said' && c.silentReason === 'needs the luck-direction convention')).toBe(true);
    expect(decadeGrid(resultOf('jiazi-1984'), TOPIC).rows[0]!.note).toBe('the chart is balanced, so the favourable-element method names no favourite');
    // a cell carries what the decision lists
    const c = cellOf(j, 'bazi-year', 2031);
    expect(Object.keys(c).sort()).toEqual(['entryIds', 'note', 'pointers', 'shares', 'signalIds', 'silentReason', 'slice', 'tally', 'tallyText', 'word', 'wordText', 'year'].sort());
    expect(c.shares.supports + c.shares.cautions + c.shares.mixed).toBeCloseTo(1, 10);
  });

  // point 2
  it('the year headline: each level label once, in the groups Supports, Cautions, Mixed, Silent, and nothing about pointers', () => {
    for (const id of IDS) {
      const res = resultOf(id);
      const g = decadeGrid(res, TOPIC);
      for (const [i, headline] of g.headlines.entries()) {
        for (const r of g.rows) expect(headline.split(r.label).length - 1, `${id} ${g.years[i]} ${r.label}`).toBe(1);
        const at = (w: string): number => headline.indexOf(`${w}: `);
        const present = (['supports', 'cautions', 'mixed', 'silent'] as const).map((k) => at(HEADLINE_HEADING[k])).filter((x) => x >= 0);
        expect(present, `${id} ${g.years[i]}`).toEqual([...present].sort((a, b) => a - b));
        expect(headline).not.toMatch(/active|pointer/);
        // a level is under Silent exactly when its word is nothing said
        const silentPart = headline.includes('Silent: ') ? headline.slice(headline.indexOf('Silent: ')) : '';
        for (const r of g.rows) expect(silentPart.includes(r.label), `${id} ${g.years[i]} ${r.label}`).toBe(r.cells[i]!.word === 'nothing-said');
      }
      expect(yearView(res, TOPIC).years.map((y) => y.headline)).toEqual(g.headlines);
    }
    // the form of the director's example, from real cells
    expect(decadeGrid(resultOf('j2000'), TOPIC).headlines[2031 - FROM]).toMatch(/^Supports: Vedic antardasha\. Cautions: Saturn from the Moon\. Mixed: BaZi year pillar \(3 rules support, 1 cautions\), Vedic mahadasha, Jupiter from the Moon \(2 rules support, 2 caution\), Western annual profection \([^)]+\)\. Silent: BaZi luck pillar, Western solar return\.$/);
  });

  // point 3
  it('pointers: out of the default list and the tallies, folded into one counted group per level and year', () => {
    for (const id of IDS) {
      const res = resultOf(id);
      const list = statementList(res, TOPIC);
      expect(list.dated.some((e) => e.word === 'active')).toBe(false);
      expect(list.natal.some((e) => e.word === 'active')).toBe(false);
      expect(list.pointers.length).toBeGreaterThan(50);
      expect(list.pointers.every((e) => e.word === 'active')).toBe(true);
      const g = decadeGrid(res, TOPIC);
      const groups = g.rows.flatMap((r) => r.cells.flatMap((c) => (c.pointers ? [c.pointers] : [])));
      expect(groups.length).toBe(20);
      for (const p of groups) {
        expect(p.count).toBe(p.entries.length);
        expect(p.signalIds).toHaveLength(p.count);
      }
      for (const r of g.rows) for (const c of r.cells) expect(c.tallyText).not.toMatch(/active|mark the topic/);
    }
    // the review's three nativities had 40 to 53 percent of the Western entries as pointers; the list now holds none
    const list = statementList(resultOf('j2000'), TOPIC);
    expect(list.pointers.every((e) => e.tradition === 'western')).toBe(true);
    expect(list.dated.filter((e) => e.tradition === 'western').length).toBeGreaterThan(10);
  });

  // point 4
  it('the edge of a year, on j2000 whose birthday is 1 January: a profection that begins at noon is not read into the year before', () => {
    expect(fixture('j2000').civil).toMatchObject({ month: 1, day: 1 });
    const edge15 = decadeGrid(resultOf('j2000'), TOPIC);
    const none = decadeGrid(evaluate(inputOf('j2000', { forecastConventions: { sliceEdgeDays: 0 } }), { topics: [TOPIC], runs: 5 }), TOPIC);
    const total = (g: DecadeGrid, level: string) => g.rows.find((r) => r.level === level)!.cells.reduce((n, c) => n + c.signalIds.length, 0);
    // without the edge a birthday statement counts in two years; with it, in one
    expect(total(none, 'western-profection')).toBeGreaterThan(total(edge15, 'western-profection'));
    const pointers = (g: DecadeGrid) => g.rows.find((r) => r.level === 'western-solar-return')!.cells.map((c) => c.pointers?.count ?? 0);
    expect(pointers(edge15)).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    expect(Math.max(...pointers(none))).toBeGreaterThan(3);
    // every statement that counts for a year lies wholly inside it or overlaps it by at least 15 days
    const res = resultOf('j2000');
    for (const row of edge15.rows) {
      for (const [i, c] of row.cells.entries()) {
        const slice = res.slices[i]!;
        for (const id of [...c.signalIds, ...(c.pointers?.signalIds ?? [])]) {
          const s = res.signals.find((x) => x.id === id)!;
          const inside = s.startUtcMs! >= slice.startUtcMs && s.endUtcMs! <= slice.endUtcMs;
          const overlap = Math.min(s.endUtcMs!, slice.endUtcMs) - Math.max(s.startUtcMs!, slice.startUtcMs);
          expect(inside || overlap >= 15 * MS.DAY, `${row.level} ${slice.year} ${id}`).toBe(true);
        }
      }
    }
    // the list keeps the true dates of a statement that does not count for the year it touches
    const list = statementList(res, TOPIC);
    // (a profection that begins on 1 January overlaps the year before by hours)
    expect(list.pointers.some((e) => e.fullStartUtcMs !== null && new Date(e.fullStartUtcMs).getUTCMonth() === 0 && new Date(e.fullStartUtcMs).getUTCDate() <= 2)).toBe(true);
  });

  // point 5
  it('joined spans: a lord of the year that is the same for two touching years is one entry that keeps both firings, and the readings still count both', () => {
    const res = resultOf('j2000');
    const list = statementList(res, TOPIC);
    const joined = list.dated.filter((e) => e.signalIds.length > 1);
    expect(joined.map((e) => e.ruleId)).toEqual(['lilly.profection.lord-condition']);
    const e = joined[0]!;
    expect(e.signalIds).toHaveLength(2);
    expect(new Date(e.fullStartUtcMs!).getUTCFullYear()).toBe(2034);
    expect(new Date(e.fullEndUtcMs!).getUTCFullYear()).toBe(2035);
    // the lord is Jupiter from the change of the lord in 2034 to the change in 2035: a year, from two firings in two profected years
    expect((e.fullEndUtcMs! - e.fullStartUtcMs!) / MS.DAY).toBeGreaterThan(360);
    // one entry in the list; a count in each of the two years the span covers
    const g = decadeGrid(res, TOPIC);
    for (const y of [2034, 2035]) expect(cellOf(g, 'western-profection', y).entryIds).toContain(e.signalId);
    expect(cellOf(g, 'western-profection', 2034).signalIds.filter((id) => e.signalIds.includes(id))).toHaveLength(1);
    expect(cellOf(g, 'western-profection', 2035).signalIds.filter((id) => e.signalIds.includes(id))).toHaveLength(1);
  });

  // point 6
  it('a rule read by period: the day passes are not computed over a span, and come back from the window function in their own part', () => {
    expect(DEFAULT_REGISTRY.periodReadRules.has('lilly.transit.daily-cusps')).toBe(true);
    const res = resultOf('j2000');
    expect(res.periodReadRules).toEqual(['lilly.transit.daily-cusps']);
    expect(res.signals.some((s) => s.ruleId === 'lilly.transit.daily-cusps')).toBe(false);
    const withDays = evaluate(inputOf('j2000', {}, 2031, 2032), { topics: ['general'], runs: 5, includePeriodRead: true, traditions: ['western'] });
    expect(withDays.signals.filter((s) => s.ruleId === 'lilly.transit.daily-cusps').length).toBeGreaterThan(100);
    expect(statementList(withDays, 'general').dated.some((e) => e.ruleId === 'lilly.transit.daily-cusps')).toBe(false);
    const window = { startUtcMs: Date.UTC(2031, 2, 1), endUtcMs: Date.UTC(2031, 2, 1) + 45 * MS.DAY };
    const c = periodCharacter(inputOf('j2000', {}, 2031, 2031), window);
    expect(c.iching.periods.length).toBeGreaterThan(0);
    expect(c.western.statements.length).toBeGreaterThan(15);
    expect(c.western.badges).toEqual([]);
    for (const s of c.western.statements) {
      expect(s.ruleId).toBe('lilly.transit.daily-cusps');
      expect(s.badges).not.toContain('experimental');
      expect(s.dayUtcMs).toBeGreaterThan(window.startUtcMs - MS.DAY);
      expect(s.dayUtcMs).toBeLessThan(window.endUtcMs);
      expect(s.sentence).toMatch(/^On \d{4}-\d{2}-\d{2}, transiting \w+ (conjoins|sextiles|squares|trines|opposes) the natal /);
    }
    const days = c.western.statements.map((s) => s.dayUtcMs);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });

  // point 7a
  it('lilly.revolution.lord2-fortune-house: a pointer, for the three significators of the birth chart, in the houses of the return', () => {
    const res = resultOf('j2000');
    const ctx = createContext(inputOf('j2000'), DEFAULT_REGISTRY.builders);
    const radix = ctx.extension<WesternContext>('western')!.model;
    const names = new Set([String(radix.lordOfHouse(2)), 'the Part of Fortune', 'Jupiter']);
    const mine = res.signals.filter((s) => s.ruleId === 'lilly.revolution.lord2-fortune-house');
    expect(mine.length).toBeGreaterThanOrEqual(10 * (names.size - 1));
    expect(new Set(mine.map((s) => String(s.facts.find((f) => f.key === 'significator')!.value)))).toEqual(names);
    expect(mine.every((s) => s.direction === 'activates')).toBe(true);
    const list = statementList(res, TOPIC);
    expect(list.pointers.filter((e) => e.ruleId === 'lilly.revolution.lord2-fortune-house').length).toBe(mine.length);
    expect(list.dated.some((e) => e.ruleId === 'lilly.revolution.lord2-fortune-house')).toBe(false);
    // the solar return no longer says "supports" in every year
    expect(decadeGrid(res, TOPIC).rows.find((r) => r.level === 'western-solar-return')!.cells.filter((c) => c.word === 'supports').length).toBeLessThanOrEqual(1);
  });

  // point 7b
  it('valens.critical-year-node: the point form only, within one degree, with the derived-threshold badge', () => {
    const ctx = createContext(inputOf('j2000', {}, 2020, 2060), DEFAULT_REGISTRY.builders);
    const rule = ruleById('valens.critical-year-node')!;
    const firings = DEFAULT_REGISTRY.bindings.get(rule.id)!.fire(ctx, rule);
    expect(firings.length).toBeGreaterThan(0);
    for (const f of firings) {
      expect(f.facts.find((x) => x.key === 'degreeMatch')!.value).toBe('within 1 degree');
      expect(f.badges!.some((b) => b.startsWith('derived threshold:'))).toBe(true);
    }
    expect(rule.condition).not.toMatch(/same-sign as the weak form/);
  });

  // point 7c
  it('lilly.transit.daily-cusps: each reading only by the aspects Lilly gives it, in his words', () => {
    const f = inputOf('j2000', {}, 2031, 2031);
    const seen = new Set<string>();
    for (let k = 0; k < 6; k++) {
      const start = Date.UTC(2031, k * 2, 1);
      for (const s of periodCharacter(f, { startUtcMs: start, endUtcMs: start + 60 * MS.DAY }).western.statements) {
        const m = /transiting (\w+) (\w+) the natal ([\w ]+): (.*)\.$/.exec(s.sentence)!;
        const [, planet, aspect, point, meaning] = m as unknown as [string, string, string, string, string];
        seen.add(meaning);
        if (meaning === 'a fortunate day') expect(['sextiles', 'trines'], s.sentence).toContain(aspect);
        else if (meaning === 'an unsuccessful day') {
          expect(['conjoins', 'squares', 'opposes'], s.sentence).toContain(aspect);
          expect(['Saturn', 'Mars']).toContain(planet);
        } else {
          // the healthful, choler and gravity readings: the passage over the Ascendant only
          expect([aspect, point], s.sentence).toEqual(['conjoins', 'Ascendant']);
          expect(['a healthful, cheerful, successful day', 'choler or passion for two or three days', 'gravity, soberness, melancholy']).toContain(meaning);
        }
        if (/days$/.test(meaning)) expect(planet).toBe('Mars');
      }
    }
    expect(seen.has('a fortunate day')).toBe(true);
  });

  // point 8
  it('plain words: no internal token in the agreement text, and the groups present are named', () => {
    const d = agreementDisplay(resultOf('southern'), TOPIC);
    if (!d.shown) throw new Error('expected a strip');
    expect(d.years.some((y) => y.text === VERDICT_TEXT.contradiction)).toBe(true);
    for (const y of d.years) expect(`${y.text} ${y.notes.join(' ')}`).not.toMatch(/nothing-said|no-agreement|agree-|birth-arithmetic|-sidereal|-tropical|contradiction - contradiction/);
    expect(d.groupsLine).toContain('clocks counted from the birth moment');
    expect(d.groupsLine).toContain('Jupiter (sidereal signs)');
    expect(d.groupsLine).toContain('Saturn (sidereal signs)');
    expect(agreementDisplay(resultOf('j2000'), TOPIC).groupsLine).toContain('each planet whose real motion is read is one more');
  });

  // point 9
  // The time of a ten-year evaluation (about one second on the three moments, the baseline included) is measured in the
  // review script and reported, not asserted: a wall-clock limit belongs to the machine.
  it('the baseline keeps the specification\'s 1000 runs, with all four traditions on', () => {
    for (const id of IDS) {
      const r = resultOf(id);
      expect(r.baselines[TOPIC]!.runs).toBe(1000);
      expect(r.traditions).toEqual(['bazi', 'vedic', 'iching', 'western']);
    }
  });

  // point 10
  it('the JSON report carries the grid and the headlines, and keeps its schema name', () => {
    const res = resultOf('j2000');
    const j = reportJson(res, TOPIC) as { schema: string; grid: DecadeGrid; headlines: Array<{ year: number; headline: string }> };
    expect(j.schema).toBe('overlay-forecast/1');
    expect(j.grid).toEqual(decadeGrid(res, TOPIC));
    expect(j.headlines.map((h) => h.year)).toEqual(j.grid.years);
    expect(j.headlines.map((h) => h.headline)).toEqual(j.grid.headlines);
    expect(JSON.parse(JSON.stringify(j))).toEqual(j);
  });
});
