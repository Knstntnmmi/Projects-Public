// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The page code of the forecast section, run against a small stand-in for the document, so that the
 * order of what is drawn can be checked: the grid first, one line in the place of the birth-time
 * lines until they arrive, then the lines, and the words used under the forecast. The clock is
 * a fake one; nothing is waited for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONVENTIONS, makeMoment } from '@overlay/core';
import { fixture } from '../../../fixtures/moments.ts';
import { BIRTH_PENDING } from '../src/forecastView.ts';

class El {
  innerHTML = '';
  textContent = '';
  value = '';
  hidden = false;
  title = '';
  min = '';
  max = '';
  dataset: Record<string, string> = {};
  attrs = new Map<string, string>();
  classes = new Set<string>();
  parentElement = null;
  classList = {
    add: (c: string) => void this.classes.add(c),
    remove: (c: string) => void this.classes.delete(c),
    toggle: (c: string, on?: boolean) => void (on ?? !this.classes.has(c) ? this.classes.add(c) : this.classes.delete(c)),
  };
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v);
  }
  addEventListener(): void {}
  querySelector(): null {
    return null;
  }
  querySelectorAll(): El[] {
    return [];
  }
  closest(): null {
    return null;
  }
  scrollIntoView(): void {}
}

const elements = new Map<string, El>();
const el = (id: string): El => {
  if (!elements.has(id)) elements.set(id, new El());
  return elements.get(id)!;
};

describe('the forecast section of the page', () => {
  beforeEach(() => {
    elements.clear();
    vi.useFakeTimers();
    vi.stubGlobal('document', { getElementById: el });
    vi.stubGlobal('window', { addEventListener: () => {} });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('draws the grid, shows one line for the birth time until its lines arrive, then replaces it', async () => {
    const { initForecast } = await import('../src/forecastPage.ts');
    const f = fixture('j2000');
    const moment = makeMoment(f.civil, f.zone, f.place);
    const page = initForecast({ readMoment: () => moment, conventions: () => DEFAULT_CONVENTIONS, uncertaintyMinutes: () => 10 });
    el('fc-topic').value = 'wealth';
    el('fc-sex').value = 'none';

    page.schedule();
    expect(el('fc-status').textContent).toBe('Calculating the forecast...');

    // The grid is drawn; the birth-time lines are not there yet, and one line stands in their place.
    vi.advanceTimersToNextTimer();
    expect(el('fc-grid').innerHTML).toContain('class="dgrid"');
    expect(el('fc-birth').innerHTML).toContain(BIRTH_PENDING);
    expect(el('fc-birth').innerHTML.split('<p').length - 1).toBe(1);
    expect(el('fc-body').classes.has('stale')).toBe(false);

    // The lines arrive and the line is removed.
    vi.advanceTimersToNextTimer();
    expect(el('fc-birth').innerHTML).not.toContain(BIRTH_PENDING);
    expect(el('fc-birth').innerHTML).toContain('birth time');
  });

  it('lists the words used under the forecast, in a disclosure that is closed, once the forecast is shown', async () => {
    const { initForecast } = await import('../src/forecastPage.ts');
    const f = fixture('j2000');
    const moment = makeMoment(f.civil, f.zone, f.place);
    const page = initForecast({ readMoment: () => moment, conventions: () => DEFAULT_CONVENTIONS, uncertaintyMinutes: () => 10 });
    el('fc-topic').value = 'wealth';
    el('fc-sex').value = 'none';
    page.schedule();
    vi.advanceTimersToNextTimer();
    expect(el('fc-words').hidden).toBe(false);
    expect(el('fc-words-body').innerHTML).toContain('<dt>supports</dt>');
    expect(el('fc-words-body').innerHTML).toContain('Source:');
  });

  it('keeps the disclosure closed in the page and titled Words used', async () => {
    const { readFileSync } = await import('node:fs');
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const block = /<details[^>]*id="fc-words"[^>]*>\s*<summary>([^<]*)<\/summary>/.exec(html);
    expect(block).not.toBeNull();
    expect(block![1]).toBe('Words used');
    expect(/<details[^>]*id="fc-words"[^>]*\sopen[\s>]/.test(html)).toBe(false);
  });
});
