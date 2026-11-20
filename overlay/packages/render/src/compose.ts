// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/** Puts the pieces together: from a moment to a finished wheel or timeline. */
import {
  bazi,
  buildRings,
  buildTracks,
  DEFAULT_CONVENTIONS,
  findSeams,
  formatCivil,
  clockReading,
  western,
  type Conventions,
  type Moment,
  type Sex,
  type Track,
} from '@overlay/core';
import { renderTimeline } from './timeline.ts';
import { renderWheel, type WheelMarker, type WheelOptions } from './wheel.ts';

export function markersFor(moment: Moment): WheelMarker[] {
  const c = western.chart(moment);
  const markers: WheelMarker[] = c.positions.map((p) => ({
    id: p.planet.toLowerCase(),
    glyph: western.PLANET_GLYPHS[p.planet],
    label: `${p.planet} at ${western.formatLongitude(p.longitude)}${p.retrograde ? ', retrograde' : ''}`,
    longitude: p.longitude,
    kind: 'planet',
  }));
  markers.push({ id: 'node', glyph: '☊', label: `North Node (mean) at ${western.formatLongitude(c.northNode)}`, longitude: c.northNode, kind: 'point' });
  markers.push({ id: 'asc', glyph: 'ASC', label: `Ascendant at ${western.formatLongitude(c.ascendant)}`, longitude: c.ascendant, kind: 'angle' });
  markers.push({ id: 'mc', glyph: 'MC', label: `Midheaven at ${western.formatLongitude(c.midheaven)}`, longitude: c.midheaven, kind: 'angle' });
  return markers;
}

export function wheelFor(moment: Moment, conventions: Conventions = DEFAULT_CONVENTIONS, options: WheelOptions = {}): string {
  const p = bazi.fourPillars(moment, conventions);
  return renderWheel(buildRings(moment.utcMs, conventions), {
    markers: markersFor(moment),
    centre: [
      `${p.year.hanzi} ${p.month.hanzi} ${p.day.hanzi} ${p.hour.hanzi}`,
      `${formatCivil(clockReading(moment, 'civil')).slice(0, 16)} civil`,
      `${new Date(moment.utcMs).toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    ],
    ...options,
  });
}

export interface TimelineForOptions {
  startUtcMs: number;
  endUtcMs: number;
  sex?: Sex;
  title?: string;
  nowUtcMs?: number;
  seamWindowDays?: number;
  theme?: 'light' | 'dark';
  /** Track ids to leave out. */
  hidden?: string[];
  /** Tracks drawn after the engine's own, for example the forecast tracks. They are not given to the seam finder: a seam describes calendar arithmetic. */
  extraTracks?: readonly Track[];
  footnote?: string;
}

export function timelineFor(moment: Moment, conventions: Conventions, options: TimelineForOptions): string {
  const tracks = buildTracks(moment, conventions, options).filter((t) => !options.hidden?.includes(t.id));
  const years = (options.endUtcMs - options.startUtcMs) / (365.2425 * 86_400_000);
  const seams = findSeams(tracks, options.startUtcMs, options.endUtcMs, {
    windowDays: options.seamWindowDays ?? (years > 20 ? 30 : years > 4 ? 10 : 3),
    levels: years > 20 ? ['life', 'year'] : years > 4 ? ['life', 'year'] : ['life', 'year', 'month'],
  });
  const marks = [{ utcMs: moment.utcMs, label: 'moment' }];
  if (options.nowUtcMs) marks.push({ utcMs: options.nowUtcMs, label: 'today' });
  return renderTimeline([...tracks, ...(options.extraTracks ?? [])], {
    startUtcMs: options.startUtcMs,
    endUtcMs: options.endUtcMs,
    marks,
    seams: seams.seams,
    title: options.title,
    theme: options.theme,
    footnote: options.footnote,
  });
}
