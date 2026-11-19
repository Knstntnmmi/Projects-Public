// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import * as Tyme from 'tyme4ts';
import { DEFAULT_CONVENTIONS, type Conventions } from '../src/conventions.ts';
import { fourPillars, luck, pillarsText, sixtyCycle } from '../src/systems/bazi/index.ts';
import { solarTermInstant, SOLAR_TERMS, termsAround } from '../src/substrate/terms.ts';
import { fieldsFromUtcMs, makeMoment, MS, utcMsFromFields } from '../src/substrate/time.ts';
import { fixture } from '../../../fixtures/moments.ts';

const PLACE = { latitude: 39.9042, longitude: 116.4074 };

/** Deterministic pseudo-random numbers, so that the corpus is the same on every run. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function tymePillars(c: { year: number; month: number; day: number; hour: number; minute: number; second: number }, late: boolean): string {
  Tyme.LunarHour.provider = late ? new Tyme.LunarSect2EightCharProvider() : new Tyme.DefaultEightCharProvider();
  const st = Tyme.SolarTime.fromYmdHms(c.year, c.month, c.day, c.hour, c.minute, Math.floor(c.second));
  return st.getLunarHour().getEightChar().toString();
}

describe('solar terms', () => {
  it('agree with the independent implementation to thirteen seconds on average and ninety at worst, every term from 1900 to 2100', () => {
    let worst = 0;
    let sum = 0;
    let count = 0;
    for (let year = 1900; year <= 2100; year++) {
      for (const term of SOLAR_TERMS) {
        const mine = solarTermInstant(year, term.index);
        // The other library numbers terms from the winter solstice of the previous year.
        const theirs = Tyme.SolarTerm.fromIndex(year, term.index + 3);
        if (year === 2000) {
          expect(theirs.getName()).toBe(term.hanzi.replace('驚蟄', '惊蛰').replace('穀雨', '谷雨').replace('小滿', '小满').replace('芒種', '芒种').replace('處暑', '处暑'));
        }
        const st = theirs.getJulianDay().getSolarTime();
        const theirMs =
          utcMsFromFields(st.getYear(), st.getMonth(), st.getDay(), st.getHour(), st.getMinute(), st.getSecond()) - 8 * MS.HOUR;
        const diff = Math.abs(mine - theirMs);
        worst = Math.max(worst, diff);
        sum += diff;
        count++;
      }
    }
    expect(count).toBe(201 * 24);
    expect(sum / count).toBeLessThan(15_000);
    expect(worst).toBeLessThan(90_000);
  });

  it('places Lichun 2024 at 16:26:5x Beijing time, as the observatories published', () => {
    const c = fieldsFromUtcMs(solarTermInstant(2024, 0) + 8 * MS.HOUR);
    expect([c.year, c.month, c.day, c.hour, c.minute]).toEqual([2024, 2, 4, 16, 26]);
  });
});

describe('four pillars', () => {
  it('match the independent implementation on a generated corpus, under both day-boundary conventions', () => {
    const random = rng(20240204);
    let compared = 0;
    let skippedNearTerm = 0;
    for (let i = 0; i < 4000; i++) {
      const utcMs = utcMsFromFields(1900, 3, 1) + Math.floor(random() * 200 * 365.2425 * MS.DAY);
      const civil = fieldsFromUtcMs(Math.floor(utcMs / 1000) * 1000 + 8 * MS.HOUR);
      const moment = makeMoment(civil, '+08:00', PLACE);
      // The two engines place each term a few seconds apart; inside that sliver the
      // month pillar may legitimately differ, so it is excluded and counted.
      const around = termsAround(moment.utcMs);
      if (Math.min(moment.utcMs - around.previous.utcMs, around.next.utcMs - moment.utcMs) < 90_000) {
        skippedNearTerm++;
        continue;
      }
      for (const dayBoundary of ['zi23', 'midnight'] as const) {
        const conventions: Conventions = { ...DEFAULT_CONVENTIONS, timeBasis: 'civil', dayBoundary };
        expect(pillarsText(fourPillars(moment, conventions)), JSON.stringify(civil)).toBe(
          tymePillars(civil, dayBoundary === 'midnight'),
        );
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(7900);
    expect(skippedNearTerm).toBeLessThan(10);
  });

  it('match on every late-Zi minute and around every hour boundary of a sample of days', () => {
    const random = rng(2300);
    for (let i = 0; i < 300; i++) {
      const dayMs = utcMsFromFields(1950, 1, 1) + Math.floor(random() * 120 * 365) * MS.DAY;
      const d = fieldsFromUtcMs(dayMs);
      for (const [hour, minute] of [[22, 59], [23, 0], [23, 30], [23, 59], [0, 0], [0, 59], [1, 0], [12, 59], [13, 0]] as const) {
        const civil = { year: d.year, month: d.month, day: d.day, hour, minute, second: 0 };
        const moment = makeMoment(civil, '+08:00', PLACE);
        const around = termsAround(moment.utcMs);
        if (Math.min(moment.utcMs - around.previous.utcMs, around.next.utcMs - moment.utcMs) < 90_000) continue;
        for (const dayBoundary of ['zi23', 'midnight'] as const) {
          const got = pillarsText(fourPillars(moment, { ...DEFAULT_CONVENTIONS, dayBoundary }));
          expect(got, `${JSON.stringify(civil)} ${dayBoundary}`).toBe(tymePillars(civil, dayBoundary === 'midnight'));
        }
      }
    }
  });

  it('gives the known pillars of the fixture moments', () => {
    const f = fixture('jiazi-1984');
    const p = fourPillars(makeMoment(f.civil, f.zone, f.place), DEFAULT_CONVENTIONS);
    expect(p.year.hanzi).toBe('甲子');
    expect(p.month.hanzi).toBe('丙寅');
    const j = fixture('j2000');
    expect(fourPillars(makeMoment(j.civil, j.zone, j.place), DEFAULT_CONVENTIONS).day.hanzi).toBe('戊午');
  });

  it('changes the year and month pillars across Lichun and nothing else', () => {
    const a = fixture('lichun-eve-2024');
    const b = fixture('lichun-after-2024');
    const pa = fourPillars(makeMoment(a.civil, a.zone, a.place), DEFAULT_CONVENTIONS);
    const pb = fourPillars(makeMoment(b.civil, b.zone, b.place), DEFAULT_CONVENTIONS);
    expect([pa.year.hanzi, pa.month.hanzi]).toEqual(['癸卯', '乙丑']);
    expect([pb.year.hanzi, pb.month.hanzi]).toEqual(['甲辰', '丙寅']);
    expect(pa.day.hanzi).toBe(pb.day.hanzi);
    expect(pa.hour.hanzi).toBe(pb.hour.hanzi);
  });

  it('differs between day-boundary conventions only in the day pillar, and only after 23:00', () => {
    const f = fixture('late-zi');
    const m = makeMoment(f.civil, f.zone, f.place);
    const zi = fourPillars(m, { ...DEFAULT_CONVENTIONS, dayBoundary: 'zi23' });
    const mid = fourPillars(m, { ...DEFAULT_CONVENTIONS, dayBoundary: 'midnight' });
    expect(zi.day.index).toBe((mid.day.index + 1) % 60);
    expect(zi.hour.hanzi).toBe(mid.hour.hanzi);
  });

  it('moves the hour pillar when the clock basis moves the reading across a double-hour', () => {
    const f = fixture('far-west-zone');
    const m = makeMoment(f.civil, f.zone, f.place);
    const civil = fourPillars(m, { ...DEFAULT_CONVENTIONS, timeBasis: 'civil' });
    const solar = fourPillars(m, { ...DEFAULT_CONVENTIONS, timeBasis: 'apparent' });
    expect(civil.hour.branch.hanzi).toBe('巳');
    expect(solar.hour.branch.hanzi).toBe('辰');
    expect(civil.day.hanzi).toBe(solar.day.hanzi);
  });

  it('reads an hour earlier on standard time during the 1988 Chinese daylight saving', () => {
    const f = fixture('china-dst-1988');
    const m = makeMoment(f.civil, f.zone, f.place);
    const civil = fourPillars(m, { ...DEFAULT_CONVENTIONS, timeBasis: 'civil' });
    const standard = fourPillars(m, { ...DEFAULT_CONVENTIONS, timeBasis: 'standard' });
    expect(civil.clock.hour).toBe(13);
    expect(standard.clock.hour).toBe(12);
    expect(civil.hour.branch.hanzi).toBe('未');
    expect(standard.hour.branch.hanzi).toBe('午');
  });
});

describe('nayin', () => {
  it('matches the independent implementation for all sixty', () => {
    const simplified: Record<string, string> = { 爐: '炉', 劍: '剑', 鋒: '锋', 頭: '头', 澗: '涧', 蠟: '蜡', 楊: '杨', 靂: '雳', 長: '长', 燈: '灯', 驛: '驿', 釵: '钗', 釧: '钏', 霹: '霹' };
    for (let i = 0; i < 60; i++) {
      const mine = [...sixtyCycle(i).nayin.hanzi].map((ch) => simplified[ch] ?? ch).join('');
      expect(mine, sixtyCycle(i).hanzi).toBe(Tyme.SixtyCycle.fromIndex(i).getSound().getName());
    }
  });
});

describe('luck pillars', () => {
  it('match the independent implementation in direction, first pillar and start age', () => {
    const random = rng(77);
    Tyme.LunarHour.provider = new Tyme.DefaultEightCharProvider();
    Tyme.ChildLimit.provider = new Tyme.DefaultChildLimitProvider();
    for (let i = 0; i < 400; i++) {
      const utcMs = utcMsFromFields(1930, 1, 1) + Math.floor(random() * 120 * 365.2425 * MS.DAY);
      const civil = fieldsFromUtcMs(Math.floor(utcMs / 1000) * 1000 + 8 * MS.HOUR);
      const moment = makeMoment(civil, '+08:00', PLACE);
      const around = termsAround(moment.utcMs);
      if (Math.min(moment.utcMs - around.previous.utcMs, around.next.utcMs - moment.utcMs) < 90_000) continue;
      const sex = random() < 0.5 ? 'male' : 'female';
      const mine = luck(moment, DEFAULT_CONVENTIONS, sex);
      const st = Tyme.SolarTime.fromYmdHms(civil.year, civil.month, civil.day, civil.hour, civil.minute, civil.second);
      const theirs = Tyme.ChildLimit.fromSolarTime(st, sex === 'male' ? Tyme.Gender.MAN : Tyme.Gender.WOMAN);
      expect(mine.forward).toBe(theirs.isForward());
      expect(mine.pillars[0]!.cycle.hanzi).toBe(theirs.getStartDecadeFortune().getName());
      // The start age scales the engines' disagreement about the jie (under a minute,
      // as tested above) by 120, so the comparison allows two hours of lifetime.
      const minutes = (a: { years: number; months: number; days: number; hours: number; minutes: number }): number =>
        (((a.years * 12 + a.months) * 30 + a.days) * 24 + a.hours) * 60 + a.minutes;
      const theirAge = {
        years: theirs.getYearCount(),
        months: theirs.getMonthCount(),
        days: theirs.getDayCount(),
        hours: theirs.getHourCount(),
        minutes: theirs.getMinuteCount(),
      };
      expect(Math.abs(minutes(mine.startAge) - minutes(theirAge))).toBeLessThanOrEqual(120);
    }
  });
});
