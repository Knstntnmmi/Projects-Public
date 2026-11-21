// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/** The sample of the forecast tests: the constructed moment j2000, wealth, 2026 to 2035. One evaluation is shared by the tests of a file. */
import { forecast, makeMoment } from '@overlay/core';
import { fixture } from '../../../fixtures/moments.ts';

export function sampleResult(id = 'j2000', forecastConventions: Partial<forecast.ForecastConventions> = {}): forecast.ForecastResult {
  const f = fixture(id);
  const input = forecast.makeInput(makeMoment(f.civil, f.zone, f.place), { fromYear: 2026, toYear: 2035, forecastConventions });
  // Twenty shifted runs are enough here: the grid and the statements do not depend on the baseline.
  return forecast.evaluate(input, { topics: ['wealth'], runs: 20 });
}
