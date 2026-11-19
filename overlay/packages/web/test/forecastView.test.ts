// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The pure views of the forecast section, on a result computed from a sample moment. They check
 * what the page promises: the grid is real HTML with a name and a glyph on every cell, a year
 * shows every level, every statement opens to its rule and source, and nothing the page says
 * uses a word the phrasebook bans.
 */
import { describe, expect, it } from 'vitest';
import { forecast, makeMoment } from '@overlay/core';
import { fixture } from '../../../fixtures/moments.ts';
import {
  agreementHtml,
  birthHtml,
  BIRTH_PENDING,
  buildModel,
  cellLabel,
  characterHtml,
  defaultSpan,
  detailHtml,
  esc,
  FORECAST_SENTENCE,
  gridHtml,
  hexagramSign,
  isoDay,
  legendHtml,
  limitWords,
  natalHtml,
  notEvaluatedHtml,
  ruleCounts,
  sexChoices,
  spanFrom,
  splitStyle,
  statementHtml,
  textOf,
  topicChoices,
  windowFrom,
  wordsUsed,
  wordsUsedHtml,
  yearHtml,
  MAX_YEARS,
} from '../src/forecastView.ts';

const f = fixture('j2000');
const moment = makeMoment(f.civil, f.zone, f.place);
const input = forecast.makeInput(moment, { fromYear: 2026, toYear: 2035, birthTimeUncertaintyMinutes: 10 });
const result = forecast.evaluate(input, { topics: ['wealth'] });
const model = buildModel(result, 'wealth');

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

describe('controls', () => {
  it('lists the seven topics with the core\'s plain names, wealth first', () => {
    const t = topicChoices();
    expect(t).toHaveLength(7);
    expect(t[0]).toEqual({ value: 'wealth', label: 'wealth' });
    expect(t.map((x) => x.label)).toContain('home and travel');
  });

  it('offers the sex convention with the core\'s wording and a first state "not given"', () => {
    const c = sexChoices();
    expect(c.title).toBe('Sex the BaZi chart is read as');
    expect(c.options.map((o) => o.value)).toEqual(['none', 'male-chart', 'female-chart']);
    expect(c.options[0]!.label).toBe('not given');
    expect(c.options[1]!.label).toBe('Read as a male chart');
  });

  it('defaults to ten years from the current year, and keeps typed spans within bounds', () => {
    expect(defaultSpan(2031)).toEqual({ fromYear: 2031, years: 10 });
    expect(spanFrom('', '', 2031)).toEqual({ fromYear: 2031, toYear: 2040, years: 10 });
    expect(spanFrom('2026', '10', 2031)).toEqual({ fromYear: 2026, toYear: 2035, years: 10 });
    expect(spanFrom('2026', '500', 2031).years).toBe(MAX_YEARS);
    expect(spanFrom('2026', '0', 2031).years).toBe(1);
    expect(spanFrom('12', '3', 2031).fromYear).toBe(1800);
    expect(spanFrom('abc', '3.7', 2031)).toEqual({ fromYear: 2031, toYear: 2033, years: 3 });
  });

  it('turns a day and a number of days into a window of at most 62 days, or says what is missing', () => {
    const w = windowFrom('2031-03-01', '30');
    expect(typeof w).toBe('object');
    if (typeof w === 'string') return;
    expect((w.endUtcMs - w.startUtcMs) / 86_400_000).toBe(30);
    expect(isoDay(w.startUtcMs)).toBe('2031-03-01');
    expect((windowFrom('2031-03-01', '900') as { days: number }).days).toBe(62);
    expect(typeof windowFrom('', '30')).toBe('string');
  });

  it('the sentence is the documented sentence, and has no banned word', () => {
    expect(FORECAST_SENTENCE).toBe('Each line is what a named rule of one tradition says about this period, with its source. Nobody has tested these statements against outcomes yet.');
    expect(forecast.bannedIn(FORECAST_SENTENCE)).toBeNull();
  });
});

describe('the decade grid', () => {
  const html = gridHtml(model, { year: null, level: null });

  it('is a table with a button for every level and year, and each has a glyph and a name', () => {
    const cells = count(html, 'class="cell ');
    expect(cells).toBe(model.grid.rows.length * model.grid.years.length);
    expect(html).toContain('<table class="dgrid">');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<svg');
    for (const row of model.grid.rows) {
      for (const c of row.cells) expect(html).toContain(`aria-label="${esc(cellLabel(row, c))}"`);
    }
  });

  it('names a cell as year, level and word', () => {
    const row = model.grid.rows.find((r) => r.level === 'saturn-moon')!;
    const cell = row.cells.find((c) => c.word === 'cautions')!;
    expect(cellLabel(row, cell)).toBe(`${cell.year}, Saturn from the Moon, cautions`);
  });

  it('gives a silent cell its stated reason', () => {
    const row = model.grid.rows.find((r) => r.level === 'bazi-luck')!;
    expect(row.cells[0]!.word).toBe('nothing-said');
    expect(cellLabel(row, row.cells[0]!)).toContain(forecast.NOTE.needsLuckDirection);
    expect(html).toContain(forecast.NOTE.needsLuckDirection);
  });

  it('draws a mixed cell split by its shares, and only a mixed one', () => {
    const mixed = model.grid.rows.flatMap((r) => r.cells).find((c) => c.word === 'mixed' && c.shares.supports > 0 && c.shares.cautions > 0)!;
    const s = splitStyle(mixed);
    expect(s).toMatch(/^--a:[\d.]+%;--b:[\d.]+%$/);
    expect(html).toContain('class="cell w-mixed split"');
    expect(html).not.toContain('class="cell w-supports split"');
  });

  it('keeps the year headers as buttons, marks the chosen year, and prints the period-read line under the grid', () => {
    const open = gridHtml(model, { year: 2031, level: 'saturn-moon' });
    expect(open).toContain('data-year="2031" aria-pressed="true"');
    expect(open).toContain('data-level="saturn-moon" aria-pressed="true"');
    expect(html).toContain(forecast.TEXT.ichingByPeriod);
  });

  it('has a legend that names every word with its glyph', () => {
    const t = textOf(legendHtml());
    for (const w of ['supports', 'cautions', 'mixed', 'nothing said']) expect(t).toContain(w);
    for (const g of Object.values(forecast.GRID_GLYPH)) expect(legendHtml()).toContain(`>${g}<`);
  });
});

describe('one year', () => {
  const year = yearHtml(model, 2031, 'saturn-moon');

  it('opens with the headline of the core and then every level with its word and tally', () => {
    const y = model.view.years.find((v) => v.year === 2031)!;
    expect(year).toContain(esc(y.headline));
    for (const l of y.levels) expect(year).toContain(`data-level="${l.level}"`);
    const saturn = model.grid.rows.find((r) => r.level === 'saturn-moon')!.cells.find((c) => c.year === 2031)!;
    expect(year).toContain(esc(saturn.tallyText));
  });

  it('shows each statement of a level with dates, sentence, badges and a folded detail', () => {
    const lvl = model.grid.rows.find((r) => r.level === 'saturn-moon')!.cells.find((c) => c.year === 2031)!;
    expect(lvl.entryIds.length).toBeGreaterThan(0);
    const e = model.entries.get(lvl.entryIds[0]!)!;
    const html = statementHtml(model, e);
    expect(html).toContain(esc(e.sentence));
    expect(html).toContain('class="when"');
    expect(html).toContain('<details class="why">');
    expect(html).not.toContain('<details class="why" open');
    for (const b of e.badges) expect(html).toContain(esc(b));
  });

  it('opens a statement to rule, condition, facts, conventions, source, locator and quotation', () => {
    const e = [...model.entries.values()].find((x) => x.startUtcMs !== null)!;
    const t = textOf(detailHtml(model, e));
    const s = model.signals.get(e.signalId)!;
    const rule = model.rules.get(e.ruleId)!;
    expect(t).toContain(rule.name);
    expect(t).toContain(rule.condition);
    expect(t).toContain(s.source.citation);
    expect(t).toContain(s.source.locator);
    for (const label of ['Rule', 'Condition', 'Facts used', 'Conventions', 'Source', 'Locator', 'Quotation']) expect(t).toContain(label);
    if (s.facts.length > 0) expect(t).toContain(s.facts[0]!.label);
  });

  it('says what the core says where there is no quotation', () => {
    const e = [...model.entries.values()][0]!;
    const s = model.signals.get(e.signalId)!;
    const original = { ...s.source };
    try {
      s.source.quote = '';
      expect(textOf(detailHtml(model, e))).toContain(forecast.TEXT.noQuotation);
      s.source.opened = false;
      expect(textOf(detailHtml(model, e))).toContain(forecast.TEXT.sourceNotOpened);
    } finally {
      Object.assign(s.source, original);
    }
  });

  it('never shows a quotation of more than 25 words', () => {
    const long = Array.from({ length: 40 }, (_, i) => `w${i}`).join(' ');
    expect(limitWords(long).split(' ').filter((w) => w !== '...').length).toBe(25);
    for (const r of forecast.DEFAULT_REGISTRY.rules) expect(limitWords(r.sourceQuote)).toBe(r.sourceQuote.trim());
  });

  it('puts pointers in one closed group per level, with the core\'s label', () => {
    const withPointers = model.grid.rows.flatMap((r) => r.cells).find((c) => c.pointers !== null)!;
    expect(withPointers).toBeDefined();
    const html = yearHtml(model, withPointers.year, null);
    expect(html).toContain(`<details class="ptr"><summary>${esc(withPointers.pointers!.label)}</summary>`);
    expect(html).not.toContain('<details class="ptr" open');
  });

  it('shows qualifiers under their statement', () => {
    const withQual = [...model.entries.values()].find((e) => e.qualifiers.length > 0);
    if (!withQual) return;
    const html = statementHtml(model, withQual);
    expect(html).toContain('class="quals"');
    expect(html).toContain(esc(withQual.qualifiers[0]!.sentence));
  });

  it('gives an unknown year nothing', () => {
    expect(yearHtml(model, 1999, null)).toBe('');
  });
});

describe('the natal promise and the agreement', () => {
  it('lists the undated statements under the core\'s heading, each with tradition and word', () => {
    const html = natalHtml(model);
    expect(html).toContain(esc(model.list.natalHeading));
    expect(model.list.natal.length).toBeGreaterThan(0);
    for (const e of model.list.natal) {
      expect(html).toContain(esc(e.sentence));
      expect(html).toContain(esc(forecast.TRADITION_NAME[e.tradition]));
    }
  });

  it('prints the note on shared charts once, in the item of the last BaZi entry, when the list carries it', () => {
    const note = model.list.sharedChartNote;
    expect(note).not.toBeNull();
    const html = natalHtml(model);
    expect(html.split(esc(note!.text)).length - 1).toBe(1);
    const last = model.list.natal.filter((e) => e.tradition === 'bazi').pop()!;
    expect(last.signalId).toBe(note!.afterSignalId);
    expect(natalHtml({ ...model, list: { ...model.list, sharedChartNote: null } })).not.toContain(esc(note!.text));
  });

  it('prints the agreement display as the core returns it, with the sentence naming the groups', () => {
    const html = agreementHtml(model, 2031);
    const a = model.agreement;
    expect(html).toContain(esc(a.groupsLine));
    if (a.shown) {
      expect(html).toContain(esc(a.baselineLine));
      for (const s of a.sentences) expect(html).toContain(esc(s));
      for (const y of a.years) expect(html).toContain(esc(y.text));
      expect(html).not.toMatch(/agree-supports|agree-cautions|no-agreement/);
    } else {
      expect(html).toContain(esc(a.line));
      expect(html).not.toContain('class="strip"');
    }
  });

  it('shows the strip when three groups speak, on a moment where the baseline is wanted', () => {
    const shown = { ...model, agreement: { topic: 'wealth', shown: true, speakingGroups: 3, years: [{ year: 2031, slice: 5, verdict: 'single', text: 'one group speaks', groups: { supports: 1, cautions: 0, mixed: 0, silent: 2 }, notes: [] }], baselineLine: 'found 0 agreeing slices', sentences: ['a.', 'b.', 'c.'], groupsLine: 'g' } as forecast.AgreementDisplay };
    const html = agreementHtml(shown, 2031);
    expect(html).toContain('<li class="sel"><b>2031</b> one group speaks');
    expect(html).toContain('found 0 agreeing slices');
  });
});

describe('the character of a period', () => {
  const c = forecast.periodCharacter(forecast.makeInput(moment, { fromYear: 2031, toYear: 2031, birthTimeUncertaintyMinutes: 10 }), {
    startUtcMs: Date.UTC(2031, 2, 1),
    endUtcMs: Date.UTC(2031, 2, 1) + 30 * 86_400_000,
  });
  const html = characterHtml(c);

  it('shows the I Ching part with hexagram, Chinese text, grade and the badge experimental', () => {
    const p = c.iching.periods[0]!;
    expect(html).toContain(p.hexagram.hanzi);
    expect(html).toContain(esc(p.text));
    expect(html).toContain(esc(`as a whole it reads: ${p.reading}`));
    expect(html).not.toMatch(/grade [+-]?\d/);
    expect(html).toContain('class="badge">experimental<');
    expect(html).toContain(hexagramSign(p.hexagram.number));
  });

  it('shows the topic a line is named for, with the sign of that clause, and the sovereign month for career', () => {
    const w = forecast.periodCharacter(forecast.makeInput(moment, { fromYear: 2026, toYear: 2026 }), { startUtcMs: Date.UTC(2026, 4, 1), endUtcMs: Date.UTC(2026, 4, 9) });
    const h = characterHtml(w);
    expect(textOf(h)).toContain('named for wealth by the words 得其資斧: supports (named in the rule as a gain)');
    expect(textOf(h)).toContain('named for wealth by the words 喪牛于易: cautions');
    expect(textOf(h)).toContain('career supports');
  });

  it('shows the note for a negated word of misfortune on a line, with its characters, a gloss and no direction', () => {
    const w = forecast.periodCharacter(forecast.makeInput(moment, { fromYear: 2026, toYear: 2026 }), { startUtcMs: Date.UTC(2026, 3, 8), endUtcMs: Date.UTC(2026, 3, 9) });
    expect(textOf(characterHtml(w))).toMatch(/\([a-z ?,]+\): (states that something bad is absent|a negated verdict word); a note without a direction/);
  });

  it('shows Lilly\'s day transits in their own part, without the badge experimental', () => {
    const west = html.slice(html.indexOf('Lilly'));
    expect(west).not.toContain('experimental');
    expect(west).toContain(esc(forecast.TEXT.westernWindow));
    expect(textOf(west)).toContain(c.western.statements[0]!.sentence);
  });

  it('draws the Unicode hexagram sign of the King Wen number', () => {
    expect(hexagramSign(1)).toBe('䷀');
    expect(hexagramSign(64)).toBe('䷿');
  });
});

describe('rules not evaluated', () => {
  it('counts the rules evaluated, not evaluated and held back, and lists the reasons', () => {
    const counts = ruleCounts(result);
    expect(counts.evaluated).toBe(result.availableCount);
    expect(counts.heldBack).toBeGreaterThan(0);
    const html = notEvaluatedHtml(model);
    expect(html).toContain(`<b>${counts.evaluated}</b> rules evaluated, <b>${counts.notEvaluated}</b> not evaluated, <b>${counts.heldBack}</b> held back`);
    const listed = count(html, '<li>');
    expect(listed).toBe(counts.notEvaluated + result.registry.branches.length + counts.heldBack);
  });
});

describe('what the whole section says', () => {
  const years = model.grid.years;
  const all = [natalHtml(model), gridHtml(model, { year: 2031, level: null }), ...years.map((y) => yearHtml(model, y, null)), agreementHtml(model, 2031)].join(' ');
  // What the page and the phrasebook word themselves: the statements' own sentences, their badges
  // and the folded detail (which quotes the rule file) are core data and are checked apart below.
  const own = textOf(all.replace(/<dl class="detail">.*?<\/dl>/gs, ' ').replace(/<p class="sent">.*?<\/p>/gs, ' ').replace(/<p class="badges">.*?<\/p>/gs, ' '));

  it('uses none of the words the phrasebook bans and says nothing about death or diagnosis', () => {
    expect(forecast.bannedIn(own)).toBeNull();
    expect(forecast.MORTALITY_WORDS.test(own)).toBe(false);
  });

  it('prints no internal token as a word', () => {
    expect(textOf(all)).not.toMatch(/nothing-said|no-agreement|agree-supports|undefined|NaN|\[object/);
  });

  it('shows no number as a score, share or confidence', () => {
    expect(own).not.toMatch(/\bscore\b|\bconfidence\b|\d\s?%/i);
  });

  it('keeps the banned words out of every statement the rules state', () => {
    for (const e of model.entries.values()) expect(forecast.bannedIn(e.sentence), e.signalId).toBeNull();
  });
});

describe('the lines about the birth time', () => {
  it('stand in for one line until they are ready', () => {
    expect(BIRTH_PENDING).toBe('Checking what a different birth time would change.');
    const pending = birthHtml(null);
    expect(textOf(pending)).toBe(BIRTH_PENDING);
    expect(count(pending, '<p')).toBe(1);
  });

  it('replace that line when they arrive, and the line is gone', () => {
    const lines = forecast.sensitivityLines(input, result, forecast.birthTimeSensitivity(input, result, { topics: ['wealth'], runs: 20 }), 'wealth');
    expect(lines.length).toBeGreaterThan(0);
    const html = birthHtml(lines);
    expect(html).not.toContain(BIRTH_PENDING);
    expect(html).not.toContain('data-pending');
    expect(textOf(html)).toBe(lines.join(' '));
    expect(birthHtml([])).toBe('');
  });
});

describe('the words used', () => {
  const none = { year: null, level: null } as const;
  const terms = (m: typeof model, sel: { year: number | null; level: forecast.LevelId | null } = none): string[] => wordsUsed(m, sel).map((e) => e.term);

  it('lists the four words of the forecast, since the legend shows them, and only terms that occur', () => {
    const t = terms(model);
    for (const w of ['supports', 'cautions', 'mixed', 'nothing said']) expect(t).toContain(w);
    const shown = textOf(natalHtml(model) + gridHtml(model, none) + agreementHtml(model, null)).toLowerCase();
    expect(t.length).toBeLessThan(forecast.GLOSSARY.length / 2);
    for (const e of wordsUsed(model, none)) expect(forecast.glossaryNames(e).some((n) => shown.includes(n.toLowerCase()) || FORECAST_SENTENCE.toLowerCase().includes(n.toLowerCase())), e.term).toBe(true);
  });

  it('leaves out a term that the forecast shown does not use', () => {
    // The sample is read without a sex convention and for wealth; no firdaria and no gua qi appear in the grid.
    expect(terms(model)).not.toContain('sixty-four-gate wheel');
  });

  it('matches without regard to case', () => {
    const upper = { ...model, sensitivity: ['SOLAR RETURN and PROFECTION'] };
    expect(terms(upper)).toEqual(expect.arrayContaining(['solar return, revolution', 'profection, annual profection']));
  });

  it('follows the year that is open', () => {
    const year = model.grid.years[0]!;
    const open = terms(model, { year, level: null });
    expect(open.length).toBeGreaterThanOrEqual(terms(model).length);
  });

  it('gives each term its meaning and its source, and nothing when there is none', () => {
    const html = wordsUsedHtml(wordsUsed(model, none));
    expect(count(html, '<details class="word">')).toBe(wordsUsed(model, none).length);
    expect(count(html, '<summary>')).toBe(count(html, '<details class="word">'));
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toContain('Source: the project&#39;s own wording.'.replace('&#39;', "'"));
    expect(textOf(html)).toContain(forecast.GLOSSARY.find((e) => e.term === 'supports')!.definition);
    expect(wordsUsedHtml([])).toBe('');
  });

  it('groups the terms under short headings by tradition, in the order of the glossary groups', () => {
    const html = wordsUsedHtml(wordsUsed(model, none));
    const heads = [...html.matchAll(/<h4 class="words-group">([^<]*)<\/h4>/g)].map((m) => m[1]!);
    expect(heads.length).toBeGreaterThan(1);
    expect(heads).toEqual(forecast.GLOSSARY_GROUPS.filter((g) => heads.includes(g)));
    for (const h of heads) expect(h.length).toBeLessThan(30);
  });

  it('does not list a common word that is marked for the full glossary only, though it occurs', () => {
    const marked = forecast.GLOSSARY.filter((e) => e.fullGlossaryOnly === true).map((e) => e.term);
    for (const w of ['level', 'window', 'face', 'root', 'house', 'active']) expect(marked, w).toContain(w);
    const withWords = { ...model, sensitivity: ['the level, the window, the face, the root, the house and the active year'] };
    const t = terms(withWords);
    for (const w of marked) expect(t, w).not.toContain(w);
  });

  it('uses none of the words the phrasebook bans', () => {
    expect(forecast.bannedIn(textOf(wordsUsedHtml(wordsUsed(model, none))))).toBeNull();
  });
});
