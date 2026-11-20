// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * Forecast tracks: ordinary Track objects, so the existing timeline renderer draws them.
 * One track per tradition and clock holding that clock's signals, and one overlay track
 * for the agreement verdict of each calendar year. They are not fed to findSeams: a seam
 * describes calendar arithmetic, and these are readings of it.
 */
import type { Interval, Track } from '../overlay/tracks.ts';
import type { SystemId } from '../overlay/rings.ts';
import { CLOCKS } from './clocks.ts';
import type { ForecastResult } from './evaluate.ts';
import { TRADITION_NAME, TOPIC_LABEL, VERDICT_TEXT } from './phrasebook.ts';
import { dedupe } from './readings.ts';
import type { AgreementCell, Verdict } from './agreement.ts';
import type { Direction, Signal, Topic, Tradition } from './types.ts';

export type ForecastTone = 'supports' | 'cautions' | 'mixed' | 'quiet';

const GLYPH: Record<ForecastTone, string> = { supports: '+', cautions: '-', mixed: '~', quiet: '.' };

const SYSTEM: Record<Tradition, SystemId> = { bazi: 'chinese', western: 'western', vedic: 'vedic', iching: 'iching' };

export const toneOfDirection = (d: Direction): ForecastTone => (d === 'favourable' ? 'supports' : d === 'unfavourable' ? 'cautions' : d === 'mixed' ? 'mixed' : 'quiet');

export function toneOfVerdict(c: AgreementCell): ForecastTone {
  const v: Verdict = c.verdict;
  if (v === 'agree-supports') return 'supports';
  if (v === 'agree-cautions') return 'cautions';
  if (v === 'contradiction' || v === 'no-agreement') return 'mixed';
  if (v === 'single') return c.groups.supports ? 'supports' : c.groups.cautions ? 'cautions' : 'mixed';
  return 'quiet';
}

/** Puts intervals in as few lanes as possible so that no interval in a lane overlaps another. */
function lanes(signals: Signal[]): Signal[][] {
  const out: Signal[][] = [];
  for (const s of [...signals].sort((a, b) => a.startUtcMs! - b.startUtcMs!)) {
    const lane = out.find((l) => l[l.length - 1]!.endUtcMs! <= s.startUtcMs!);
    if (lane) lane.push(s);
    else out.push([s]);
  }
  return out;
}

export function forecastTracks(result: ForecastResult, topic: Topic): Track[] {
  const { kept } = dedupe(result.signals.filter((s) => s.topic === topic && s.startUtcMs !== null));
  const tracks: Track[] = [];
  const keys = [...new Set(kept.map((s) => `${s.tradition}|${s.clock}`))].sort();
  for (const key of keys) {
    const [tradition, clock] = key.split('|') as [Tradition, Signal['clock']];
    const mine = kept.filter((s) => s.tradition === tradition && s.clock === clock);
    lanes(mine).forEach((lane, i) => {
      const intervals: Interval[] = lane.map((s) => {
        const tone = toneOfDirection(s.direction);
        return { startUtcMs: s.startUtcMs!, endUtcMs: s.endUtcMs!, label: GLYPH[tone], detail: s.sentence, tone };
      });
      tracks.push({
        id: `fc-${topic}-${tradition}-${clock}${i ? `-${i + 1}` : ''}`,
        title: `${TRADITION_NAME[tradition]}, ${CLOCKS[clock].label}: ${TOPIC_LABEL[topic]}`,
        system: SYSTEM[tradition],
        level: 'year',
        boundary: `Rules of ${TRADITION_NAME[tradition]} that fire on the ${CLOCKS[clock].label} clock`,
        clock,
        intervals,
      });
    });
  }
  const cells = result.agreement.filter((c) => c.topic === topic);
  if (cells.length) {
    tracks.push({
      id: `fc-${topic}-agreement`,
      title: `Agreement between independent clocks: ${TOPIC_LABEL[topic]}`,
      system: 'calendar',
      level: 'year',
      boundary: 'Calendar years; each cell states how the speaking clock groups stand',
      clock: 'calendar-year',
      intervals: cells.map((c) => {
        const slice = result.slices[c.slice]!;
        const tone = toneOfVerdict(c);
        return { startUtcMs: slice.startUtcMs, endUtcMs: slice.endUtcMs, label: GLYPH[tone], detail: `${VERDICT_TEXT[c.verdict]}${c.notes.length ? `; ${c.notes.join('; ')}` : ''}`, tone };
      }),
    });
  }
  return tracks;
}
