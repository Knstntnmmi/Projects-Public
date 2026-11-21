// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * What the agreement strip shows for a topic. One function decides, so that the command line
 * and the page cannot disagree: fewer than three independence groups speaking anywhere in the
 * span gives the one phrasebook line and no strip; otherwise the strip per year with the
 * baseline line and the three fixed sentences. Both carry one sentence that names the independent
 * groups present for the nativity, so that a reader sees why agreement is rare.
 */
import { groupSeries, type AgreementCell, type Verdict } from './agreement.ts';
import { groupLabel } from './clocks.ts';
import type { ForecastResult } from './evaluate.ts';
import { baselineLine, groupsSentence, TEXT, VERDICT_TEXT } from './phrasebook.ts';
import type { Topic } from './types.ts';

export const MIN_SPEAKING_GROUPS = 3;

export interface AgreementYear {
  year: number;
  slice: number;
  verdict: Verdict;
  text: string;
  groups: AgreementCell['groups'];
  notes: string[];
}

export type AgreementDisplay =
  | { topic: Topic; shown: false; speakingGroups: number; line: string; groupsLine: string }
  | { topic: Topic; shown: true; speakingGroups: number; years: AgreementYear[]; baselineLine: string; sentences: [string, string, string]; groupsLine: string };

/** Years in a row that carry the same verdict and the same notes, said once: "2026 to 2035" instead of ten identical lines. */
export interface AgreementRun {
  fromYear: number;
  toYear: number;
  verdict: Verdict;
  text: string;
  notes: string[];
}

export function agreementRuns(years: readonly AgreementYear[]): AgreementRun[] {
  const out: AgreementRun[] = [];
  for (const y of years) {
    const last = out[out.length - 1];
    if (last && last.verdict === y.verdict && last.notes.join('|') === y.notes.join('|') && last.toYear === y.year - 1) last.toYear = y.year;
    else out.push({ fromYear: y.year, toYear: y.year, verdict: y.verdict, text: y.text, notes: y.notes });
  }
  return out;
}

export const runLabel = (r: Pick<AgreementRun, 'fromYear' | 'toYear'>): string => (r.fromYear === r.toYear ? String(r.fromYear) : `${r.fromYear} to ${r.toYear}`);

export function agreementDisplay(result: ForecastResult, topic: Topic): AgreementDisplay {
  const series = groupSeries(result.readings, topic, result.slices.length);
  const speakingGroups = [...series.values()].filter((s) => s.some((w) => w !== 'nothing-said')).length;
  // The groups actually present for this nativity (they have a statement for the topic), speaking or not, in plain words.
  const groupsLine = groupsSentence([...series.keys()].map((g) => groupLabel(g)));
  if (speakingGroups < MIN_SPEAKING_GROUPS) return { topic, shown: false, speakingGroups, line: TEXT.needsThreeGroups, groupsLine };
  const baseline = result.baselines[topic];
  if (!baseline) throw new Error('an agreement strip cannot be shown without its baseline line');
  const years = result.agreement
    .filter((c) => c.topic === topic)
    .map((c) => ({ year: result.slices[c.slice]!.year, slice: c.slice, verdict: c.verdict, text: VERDICT_TEXT[c.verdict], groups: c.groups, notes: c.notes }));
  return {
    topic,
    shown: true,
    speakingGroups,
    years,
    baselineLine: baselineLine(baseline.found, baseline.expected, baseline.cellsLooked, result.slices.length),
    sentences: [TEXT.agreementA, TEXT.agreementB, TEXT.agreementC],
    groupsLine,
  };
}
