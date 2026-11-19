// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * What the agreement strip shows for a topic. One function decides, so that the command line
 * and the page cannot disagree: fewer than three independence groups speaking anywhere in the
 * span gives the one phrasebook line and no strip; otherwise the strip per year with the
 * baseline line and the three fixed sentences.
 */
import { groupSeries, type AgreementCell, type Verdict } from './agreement.ts';
import type { ForecastResult } from './evaluate.ts';
import { baselineLine, TEXT, VERDICT_TEXT } from './phrasebook.ts';
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
  | { topic: Topic; shown: false; speakingGroups: number; line: string }
  | { topic: Topic; shown: true; speakingGroups: number; years: AgreementYear[]; baselineLine: string; sentences: [string, string, string] };

export function agreementDisplay(result: ForecastResult, topic: Topic): AgreementDisplay {
  const series = groupSeries(result.readings, topic, result.slices.length);
  const speakingGroups = [...series.values()].filter((s) => s.some((w) => w !== 'nothing-said')).length;
  if (speakingGroups < MIN_SPEAKING_GROUPS) return { topic, shown: false, speakingGroups, line: TEXT.needsThreeGroups };
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
  };
}
