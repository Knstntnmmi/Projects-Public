// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import * as Tyme from 'tyme4ts';
import { DEFAULT_CONVENTIONS } from '../src/conventions.ts';
import { angles, eclipticPointAltitude, longitudeOf, meanObliquity, norm360 } from '../src/substrate/sky.ts';
import { equationOfTimeMinutes, julianDayNumber, makeMoment, momentFromUtc, MS, utcMsFromFields, zoneOffsetMinutes, deltaTSeconds } from '../src/substrate/time.ts';
import { dayOfficer, mansionOfDay, mayaDate, nineStarOfYear, weekday } from '../src/systems/calendars/index.ts';
import { dayIndexFromJdn, fourPillars } from '../src/systems/bazi/index.ts';
import { lahiriAyanamsa, lahiriMeanAyanamsa, nakshatraOf, nutationInLongitude, vimshottari, DASHA_YEARS } from '../src/systems/vedic/index.ts';
import { boundLord, chart, EGYPTIAN_BOUNDS, faceLord, firdaria, planetaryHour, profections, signIngresses, signOf } from '../src/systems/western/index.ts';
import { fixture, MOMENTS } from '../../../fixtures/moments.ts';

const moment = (id: string) => {
  const f = fixture(id);
  return makeMoment(f.civil, f.zone, f.place);
};

describe('time substrate', () => {
  it('reproduces known values at J2000', () => {
    const j = moment('j2000');
    expect(j.utcMs).toBe(946728000000);
    expect(julianDayNumber(2000, 1, 1)).toBe(2451545);
    expect(deltaTSeconds(j.utcMs)).toBeCloseTo(63.8, 0);
    // Sun's apparent longitude at J2000.0 UT noon, per the Astronomical Almanac: about 280.37.
    expect(longitudeOf('Sun', j.utcMs)).toBeCloseTo(280.37, 1);
    expect(meanObliquity(j.utcMs)).toBeCloseTo(23.4393, 3);
  });

  it('gives the equation of time at its four annual extremes', () => {
    // Published values: about -14.2 min on 11 February, +3.7 on 14 May, -6.5 on 26 July, +16.4 on 3 November.
    expect(equationOfTimeMinutes(utcMsFromFields(2015, 2, 11, 12))).toBeCloseTo(-14.2, 0);
    expect(equationOfTimeMinutes(utcMsFromFields(2015, 5, 14, 12))).toBeCloseTo(3.7, 0);
    expect(equationOfTimeMinutes(utcMsFromFields(2015, 7, 26, 12))).toBeCloseTo(-6.5, 0);
    expect(equationOfTimeMinutes(utcMsFromFields(2015, 11, 3, 12))).toBeCloseTo(16.4, 0);
  });

  it('knows the Chinese daylight saving of 1986 to 1991 and resolves skipped and repeated hours', () => {
    expect(zoneOffsetMinutes(utcMsFromFields(1988, 7, 1), 'Asia/Shanghai')).toBe(540);
    expect(zoneOffsetMinutes(utcMsFromFields(1988, 12, 1), 'Asia/Shanghai')).toBe(480);
    expect(zoneOffsetMinutes(utcMsFromFields(1995, 7, 1), 'Asia/Shanghai')).toBe(480);
    const gap = moment('skipped-hour');
    expect(gap.notes.join(' ')).toMatch(/did not exist/);
    const fold = moment('repeated-hour');
    expect(fold.notes.join(' ')).toMatch(/occurred twice/);
    expect(fold.utcMs).toBe(utcMsFromFields(2021, 11, 7, 5, 30));
  });
});

describe('angles', () => {
  it('put the ascendant on the eastern horizon and the midheaven on the meridian, for every fixture', () => {
    for (const f of MOMENTS) {
      const m = makeMoment(f.civil, f.zone, f.place);
      const a = angles(m.utcMs, m.place);
      expect(Math.abs(eclipticPointAltitude(a.ascendant, m.utcMs, m.place)), f.id).toBeLessThan(0.01);
      // Rising, not setting: a few minutes later that degree is above the horizon.
      expect(eclipticPointAltitude(a.ascendant, m.utcMs + 4 * MS.MIN, m.place), f.id).toBeGreaterThan(0);
      // The midheaven is the ecliptic degree with the meridian's right ascension.
      const e = (meanObliquity(m.utcMs) * Math.PI) / 180;
      const l = (a.midheaven * Math.PI) / 180;
      const ra = norm360((Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)) * 180) / Math.PI);
      expect(Math.abs(norm360(ra - a.ramc + 180) - 180), f.id).toBeLessThan(1e-6);
    }
  });
});

describe('western', () => {
  it('Egyptian bounds sum to the planets\' greater years', () => {
    const totals: Record<string, number> = {};
    for (const sign of EGYPTIAN_BOUNDS) {
      let from = 0;
      for (const [planet, end] of sign) {
        totals[planet] = (totals[planet] ?? 0) + end - from;
        from = end;
      }
      expect(from).toBe(30);
    }
    expect(totals).toEqual({ Saturn: 57, Jupiter: 79, Mars: 66, Venus: 82, Mercury: 76 });
  });

  it('faces run in Chaldean order from Mars and close on Mars', () => {
    expect(faceLord(0)).toBe('Mars');
    expect(faceLord(15)).toBe('Sun');
    expect(faceLord(25)).toBe('Venus');
    expect(faceLord(355)).toBe('Mars');
    expect(boundLord(0)).toBe('Jupiter');
    expect(boundLord(359.9)).toBe('Saturn');
  });

  it('places the J2000 planets where the ephemerides do', () => {
    const c = chart(moment('j2000'));
    const where = Object.fromEntries(c.positions.map((p) => [p.planet, `${Math.floor(p.degree)} ${p.sign}`]));
    // Standard ephemeris for 2000-01-01 12:00 UT.
    expect(where).toEqual({
      Sun: '10 Capricorn', Moon: '13 Scorpio', Mercury: '1 Capricorn', Venus: '1 Sagittarius',
      Mars: '27 Aquarius', Jupiter: '25 Aries', Saturn: '10 Taurus',
    });
    expect(c.isDayChart).toBe(true);
    expect(Math.floor(norm360(c.northNode))).toBe(125); // 5 Leo, mean node
  });

  it('profections return to the rising sign every twelve years, on solar returns', () => {
    const m = moment('j2000');
    const p = profections(m, 25);
    expect(p[12]!.label).toBe(p[0]!.label);
    expect(p[24]!.label).toBe(p[0]!.label);
    const sun0 = longitudeOf('Sun', m.utcMs);
    for (const span of p.slice(1, 6)) expect(Math.abs(norm360(longitudeOf('Sun', span.startUtcMs) - sun0 + 180) - 180)).toBeLessThan(1e-3);
  });

  it('firdaria total seventy-five years and open with the sect light', () => {
    const day = firdaria(moment('j2000'), DEFAULT_CONVENTIONS, 75);
    expect(day.major[0]!.lord).toBe('Sun');
    const nine = day.major.slice(0, 9);
    expect((nine[8]!.endUtcMs - nine[0]!.startUtcMs) / (365.2421897 * MS.DAY)).toBeCloseTo(75, 6);
    const night = firdaria(moment('unix-epoch'), DEFAULT_CONVENTIONS, 75);
    expect(night.major[0]!.lord).toBe('Moon');
    const alt = firdaria(moment('unix-epoch'), { ...DEFAULT_CONVENTIONS, firdariaNodes: 'after-mars' }, 75);
    expect(alt.major.slice(0, 6).map((x) => x.lord)).toEqual(['Moon', 'Saturn', 'Jupiter', 'Mars', 'North Node', 'South Node']);
  });

  it('finds Jupiter\'s sign changes', () => {
    const spans = signIngresses('Jupiter', utcMsFromFields(2020, 1, 1), utcMsFromFields(2022, 1, 1));
    // Jupiter entered Aquarius on 19 December 2020.
    const aq = spans.find((s) => s.label === 'Aquarius')!;
    expect(new Date(aq.startUtcMs).toISOString().slice(0, 10)).toBe('2020-12-19');
    for (let i = 1; i < spans.length; i++) expect(spans[i]!.startUtcMs).toBe(spans[i - 1]!.endUtcMs);
  });

  it('planetary hours: the first hour of the day belongs to the day ruler', () => {
    const m = moment('j2000'); // a Saturday, about noon at Greenwich
    const h = planetaryHour(m)!;
    expect(h.dayRuler).toBe('Saturn');
    expect(h.isDaytime).toBe(true);
    expect(h.startUtcMs).toBeLessThanOrEqual(m.utcMs);
    expect(h.endUtcMs).toBeGreaterThan(m.utcMs);
  });
});

describe('vedic', () => {
  // Instants below are given in TT (the published tables are in Ephemeris Time or TT), so the
  // UTC instant that has the stated TT is found by taking Delta T off.
  const atTT = (y: number, mo: number, d: number, h: number) => {
    const u = utcMsFromFields(y, mo, d, h);
    return u - deltaTSeconds(u) * 1000;
  };
  const arc = (deg: number, min: number, sec: number) => deg + min / 60 + sec / 3600;

  it('the nutation series reproduces the worked example in Meeus, Astronomical Algorithms, ch. 22', () => {
    // 10 April 1987, 0h TD (JDE 2446895.5): nutation in longitude -3.788 arcseconds.
    expect(nutationInLongitude((2446895.5 - 2451545) / 36525) * 3600).toBeCloseTo(-3.788, 1);
  });

  it('Lahiri ayanamsa sits on its definition: 23 deg 15 min 00.658 sec, true, at 21 March 1956 0h TT', () => {
    // The value is the anchor, so this checks the code, not the definition. The Committee's
    // original 23 deg 15 min 00 sec is 0.658 arcsecond lower. Source: Swiss Ephemeris
    // documentation, section 2.8.5, quoting the Indian Astronomical Ephemeris 1989 p. 556.
    expect(lahiriAyanamsa(atTT(1956, 3, 21, 0))).toBeCloseTo(arc(23, 15, 0.658), 9);
  });

  it('mean Lahiri ayanamsa agrees with the mean values printed in the Indian Astronomical Ephemeris', () => {
    // MEAN values. Read from Swiss Ephemeris documentation, appendix E, which quotes them
    // from the Ephemeris and compares them with its own results. Tolerance 0.3 arcsecond:
    // the Ephemeris uses the IAU 1976 precession rate, this project the IAU 2006 one.
    // 1 January 2000, 12h TT, Ephemeris 2019 p. 429: 23 deg 51 min 25.53 sec.
    expect(Math.abs(lahiriMeanAyanamsa(atTT(2000, 1, 1, 12)) - arc(23, 51, 25.53)) * 3600).toBeLessThan(0.3);
    // 1 January 1989, 0h TT, Ephemeris 1989 p. 512: 23 deg 42 min 12.34 sec.
    expect(Math.abs(lahiriMeanAyanamsa(atTT(1989, 1, 1, 0)) - arc(23, 42, 12.34)) * 3600).toBeLessThan(0.3);
    // 1 January 1990, 0h TT, Ephemeris 1989 p. 512: 23 deg 43 min 02.62 sec.
    expect(Math.abs(lahiriMeanAyanamsa(atTT(1990, 1, 1, 0)) - arc(23, 43, 2.62)) * 3600).toBeLessThan(0.3);
  });

  it('true Lahiri ayanamsa agrees with the true values that the Swiss Ephemeris reproduces from the Ephemeris', () => {
    // TRUE values (nutation included). Swiss Ephemeris documentation, appendix E, lists
    // these as its own output for 0h UT, and reports that they match the Indian
    // Astronomical Ephemeris 2019 table of true ayanamsa (p. 427) to 0.1 arcsecond.
    // The Ephemeris table itself was not seen. Tolerance 0.3 arcsecond.
    const cases: [number, number, number, number, number, number][] = [
      [2019, 1, 1, 24, 7, 5.9864],
      [2019, 1, 31, 24, 7, 10.9122],
      [2020, 1, 1, 24, 7, 54.8411],
    ];
    for (const [y, m, d, dg, mn, sc] of cases) {
      expect(Math.abs(lahiriAyanamsa(utcMsFromFields(y, m, d, 0)) - arc(dg, mn, sc)) * 3600).toBeLessThan(0.3);
    }
  });

  it('true and mean ayanamsa differ by the nutation, which reaches about 17 arcseconds', () => {
    const t = utcMsFromFields(1956, 3, 21, 0);
    const diff = (lahiriAyanamsa(t) - lahiriMeanAyanamsa(t)) * 3600;
    expect(diff).toBeGreaterThan(15);
    expect(diff).toBeLessThan(17.5);
  });

  it('vimshottari periods total one hundred and twenty years and begin with the nakshatra lord', () => {
    const m = moment('j2000');
    const moon = nakshatraOf(longitudeOf('Moon', m.utcMs), m.utcMs);
    const v = vimshottari(m, 120);
    expect(v.maha[0]!.lord).toBe(moon.lord);
    expect(v.maha[0]!.startUtcMs).toBeLessThanOrEqual(m.utcMs);
    expect(v.maha[0]!.endUtcMs).toBeGreaterThan(m.utcMs);
    expect(Object.values(DASHA_YEARS).reduce((a, b) => a + b, 0)).toBe(120);
    const nine = v.maha.slice(0, 9);
    expect((nine[8]!.endUtcMs - nine[0]!.startUtcMs) / (365.25 * MS.DAY)).toBeCloseTo(120, 6);
    // Antardashas tile each mahadasha exactly.
    expect(v.antar[8]!.endUtcMs).toBeCloseTo(v.maha[0]!.endUtcMs, -1);
  });
});

describe('calendars', () => {
  it('Maya: 21 December 2012 is 13.0.0.0.0, 4 Ahau 3 Kankin', () => {
    const d = mayaDate(julianDayNumber(2012, 12, 21), 584283);
    expect(d.text).toBe('13.0.0.0.0  4 Ahau  3 Kankin');
  });

  it('weekday: J2000 was a Saturday, the Unix epoch a Thursday', () => {
    expect(weekday(julianDayNumber(2000, 1, 1))).toBe('Saturday');
    expect(weekday(julianDayNumber(1970, 1, 1))).toBe('Thursday');
  });

  it('day officers, mansion days and year stars match the independent implementation', () => {
    const simplified: Record<string, string> = { 滿: '满', 執: '执', 開: '开', 閉: '闭', 虛: '虚', 婁: '娄', 畢: '毕', 參: '参', 張: '张', 軫: '轸', 綠: '绿', 黃: '黄' };
    const s = (x: string): string => [...x].map((ch) => simplified[ch] ?? ch).join('');
    for (let i = 0; i < 400; i++) {
      const ms = utcMsFromFields(1950, 1, 1, 4) + i * 53 * MS.DAY;
      const d = new Date(ms);
      const [y, mo, da] = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
      const lunarDay = Tyme.SolarDay.fromYmd(y, mo, da).getLunarDay();
      const jdn = julianDayNumber(y, mo, da);
      expect(s(mansionOfDay(jdn).hanzi), `${y}-${mo}-${da}`).toBe(lunarDay.getTwentyEightStar().getName());
      // Noon Beijing time, well away from any jie on the days where it matters little.
      const p = fourPillars(momentFromUtc(utcMsFromFields(y, mo, da, 4), '+08:00', { latitude: 39.9, longitude: 116.4 }), DEFAULT_CONVENTIONS);
      expect(p.day.index).toBe(dayIndexFromJdn(jdn));
      const sixty = Tyme.SolarTime.fromYmdHms(y, mo, da, 12, 0, 0).getSixtyCycleHour().getSixtyCycleDay();
      expect(s(dayOfficer(p.day.branch.index, p.month.branch.index).hanzi), `${y}-${mo}-${da}`).toBe(sixty.getDuty().getName());
      expect(s(nineStarOfYear(p.cycleYear).hanzi), `${y}`).toBe(sixty.getSixtyCycleMonth().getSixtyCycleYear().getNineStar().toString().slice(0, 2));
    }
  });
});

describe('sign arithmetic', () => {
  it('wraps', () => {
    expect(signOf(-1).sign).toBe('Pisces');
    expect(signOf(360).sign).toBe('Aries');
  });
});
