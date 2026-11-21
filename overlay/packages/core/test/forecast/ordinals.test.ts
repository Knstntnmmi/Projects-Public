// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import { ordinals } from '../../src/forecast/signals.ts';

describe('house numbers written as "{h}th" in the templates', () => {
  it('take their own English ending', () => {
    expect(ordinals('the 1th, 2th, 3th, 4th, 11th, 12th, 13th, 21th and 22th house')).toBe('the 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st and 22nd house');
  });
});
