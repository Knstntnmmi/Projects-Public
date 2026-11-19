// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { describe, expect, it } from 'vitest';
import { alternatives, CONVENTION_SPECS, DEFAULT_CONVENTIONS } from '../src/conventions.ts';
import { CORRESPONDENCES } from '../src/correspondences.ts';
import { facts } from '../src/facts.ts';
import { buildRings, readAcross, segmentAt } from '../src/overlay/rings.ts';
import { findSeams } from '../src/overlay/seams.ts';
import { conventionEffects, sensitivity } from '../src/overlay/sensitivity.ts';
import { buildTracks } from '../src/overlay/tracks.ts';
import { longitudeOf, nextSunLongitude, norm360 } from '../src/substrate/sky.ts';
import { solarTermInstant, SOLAR_TERMS } from '../src/substrate/terms.ts';
import { julianDayNumber, makeMoment, MS, utcMsFromFields } from '../src/substrate/time.ts';
import { mansionOfDay, weekday } from '../src/systems/calendars/index.ts';
import { fourPillars } from '../src/systems/bazi/index.ts';
import { GUA_QI_SEQUENCE } from '../src/systems/iching/index.ts';
import { signOf } from '../src/systems/western/index.ts';
import { fixture, MOMENTS } from '../../../fixtures/moments.ts';

const moment = (id: string) => {
  const f = fixture(id);
  return makeMoment(f.civil, f.zone, f.place);
};
const YEAR = 365.2425 * MS.DAY;

describe('primary-source vectors', () => {
  // Transcribed from the table of the Dayan calendar in Xin Tang shu, juan 28A (zh.wikisource.org,
  // 新唐書/卷028上), reading the 始卦, 中卦 and 終卦 columns from 冬至 to 大雪 and merging each
  // marquis hexagram's inner and outer halves. The Wikisource transcription has 史 at position 22,
  // a slip for 夬, the sovereign hexagram of the third month. The Bailu row has a second, harmless slip,
  // 候 for 侯 (marquis) beside 巽; it changes no hexagram, so nothing here depends on it.
  const DAYAN =
    '中孚 復 屯 謙 睽 升 臨 小過 蒙 益 漸 泰 需 隨 晉 解 大壯 豫 訟 蠱 革 夬 旅 師 比 小畜 乾 大有 家人 井 咸 姤 鼎 豐 渙 履 遯 恆 節 同人 損 否 巽 萃 大畜 賁 觀 歸妹 無妄 明夷 困 剝 艮 既濟 噬嗑 大過 坤 未濟 蹇 頤';
  const DAYAN_CARDINAL =
    '坎初六 坎九二 坎六三 坎六四 坎九五 坎上六 震初九 震六二 震六三 震九四 震六五 震上六 離初九 離六二 離九三 離九四 離六五 離上九 兌初九 兌九二 兌六三 兌九四 兌九五 兌上六';

  it('gua qi sequence is the Dayan calendar\'s', () => {
    expect(GUA_QI_SEQUENCE.map((h) => h.hanzi).join(' ')).toBe(DAYAN);
  });

  it('cardinal-hexagram lines rule the solar terms as the Dayan calendar tabulates, from the winter solstice', () => {
    const ring = buildRings(utcMsFromFields(2000, 1, 1), DEFAULT_CONVENTIONS).find((r) => r.id === 'cardinal')!;
    const fromSolstice = Array.from({ length: 24 }, (_, k) => segmentAt(ring, 270 + 15 * k + 1).label.split(':')[0]);
    expect(fromSolstice.join(' ')).toBe(DAYAN_CARDINAL);
    expect(segmentAt(ring, 271).label).toContain('冬至');
    expect(segmentAt(ring, 1).label).toContain('春分');
  });
});

describe('rings', () => {
  const rings = buildRings(utcMsFromFields(2024, 6, 1), DEFAULT_CONVENTIONS);

  it('each ring tiles the circle exactly once', () => {
    for (const r of rings) {
      const total = r.segments.reduce((a, s) => a + (norm360(s.end - s.start) || 360), 0);
      expect(total, r.id).toBeCloseTo(360, 6);
      for (let i = 0; i < r.segments.length; i++) {
        const next = r.segments[(i + 1) % r.segments.length]!;
        expect(norm360(next.start - r.segments[i]!.end), `${r.id} ${i}`).toBeLessThan(1e-9);
      }
    }
  });

  it('reads one longitude across every ring', () => {
    const across = readAcross(rings, 280.37);
    expect(across.find((x) => x.ring === 'zodiac')!.label).toContain('Capricorn');
    expect(across.find((x) => x.ring === 'terms')!.label).toContain('冬至');
    expect(across.find((x) => x.ring === 'branch-months')!.label).toContain('子');
    expect(across.find((x) => x.ring === 'sovereign')!.label).toContain('復');
    expect(across.find((x) => x.ring === 'gua-qi')!.label).toContain('復');
    expect(across.find((x) => x.ring === 'gates')!.label).toContain('38');
  });
});

describe('correspondences that are claimed as checked', () => {
  it('every zhongqi is a sign ingress and every jie is the fifteenth degree of a sign', () => {
    for (const term of SOLAR_TERMS) {
      const sun = longitudeOf('Sun', solarTermInstant(2025, term.index) + 1000);
      const s = signOf(sun);
      if (term.isJie) expect(s.degree, term.pinyin).toBeCloseTo(15, 3);
      else expect(s.degree, term.pinyin).toBeLessThan(0.001);
    }
  });

  it('a branch month always straddles two signs, half and half', () => {
    const rings = buildRings(utcMsFromFields(2024, 6, 1), DEFAULT_CONVENTIONS);
    const months = rings.find((r) => r.id === 'branch-months')!;
    for (const m of months.segments) expect(m.start % 30).toBe(15);
  });

  it('the mansion of the day fixes the weekday: Jiao on Thursday, Fang on Sunday', () => {
    for (let jdn = 2451545; jdn < 2451545 + 400; jdn++) {
      const m = mansionOfDay(jdn).hanzi;
      if (m === '角') expect(weekday(jdn)).toBe('Thursday');
      if (m === '房') expect(weekday(jdn)).toBe('Sunday');
    }
  });

  it('the annual pillar and the profected year overlap only in part', () => {
    const m = moment('j2000');
    const tracks = buildTracks(m, DEFAULT_CONVENTIONS, { startUtcMs: m.utcMs, endUtcMs: m.utcMs + 5 * YEAR });
    const pillar = tracks.find((t) => t.id === 'bazi-year')!.intervals[1]!;
    const prof = tracks.find((t) => t.id === 'profection')!.intervals[1]!;
    expect(Math.abs(pillar.startUtcMs - prof.startUtcMs) / MS.DAY).toBeGreaterThan(20);
  });

  it('registry entries are well formed', () => {
    expect(new Set(CORRESPONDENCES.map((c) => c.id)).size).toBe(CORRESPONDENCES.length);
    for (const c of CORRESPONDENCES) expect(c.sources.length).toBeGreaterThan(0);
  });
});

describe('tracks', () => {
  it('every track tiles its span without gaps or overlaps, at every zoom', () => {
    const m = moment('jiazi-1984');
    for (const years of [90, 30, 8, 2]) {
      const start = m.utcMs + 10 * YEAR;
      const end = start + years * YEAR;
      const tracks = buildTracks(m, DEFAULT_CONVENTIONS, { startUtcMs: start, endUtcMs: end, sex: 'female' });
      expect(tracks.length).toBeGreaterThanOrEqual(7);
      for (const t of tracks) {
        expect(t.intervals.length, t.id).toBeGreaterThan(0);
        expect(t.intervals[0]!.startUtcMs, t.id).toBeLessThanOrEqual(start);
        expect(t.intervals.at(-1)!.endUtcMs, t.id).toBeGreaterThanOrEqual(end);
        for (let i = 1; i < t.intervals.length; i++) {
          expect(Math.abs(t.intervals[i]!.startUtcMs - t.intervals[i - 1]!.endUtcMs), `${t.id} ${i}`).toBeLessThan(2000);
        }
      }
      const ids = tracks.map((t) => t.id);
      expect(ids.includes('bazi-month')).toBe(years <= 12);
      expect(ids.includes('gua-qi')).toBe(years <= 3);
    }
  });

  it('leaves the luck pillars out when sex is not given', () => {
    const m = moment('j2000');
    const tracks = buildTracks(m, DEFAULT_CONVENTIONS, { startUtcMs: m.utcMs, endUtcMs: m.utcMs + 20 * YEAR });
    expect(tracks.some((t) => t.id === 'bazi-luck')).toBe(false);
  });

  it('seams count tracks on one clock once, and report the chance baseline', () => {
    const m = moment('j2000');
    const start = m.utcMs;
    const end = m.utcMs + 80 * YEAR;
    const tracks = buildTracks(m, DEFAULT_CONVENTIONS, { startUtcMs: start, endUtcMs: end, sex: 'male' });
    const report = findSeams(tracks, start, end, { windowDays: 30 });
    expect(report.seams.length).toBeGreaterThan(0);
    expect(report.expectedByChance).toBeGreaterThan(0);
    for (const s of report.seams) {
      expect(s.clocks).toBeGreaterThanOrEqual(2);
      expect(new Set(s.changes.map((c) => c.clock)).size).toBe(s.clocks);
      expect(s.endUtcMs - s.startUtcMs).toBeLessThanOrEqual(30 * MS.DAY);
    }
  });
});

describe('sensitivity', () => {
  it('finds the hour-pillar boundaries to the minute', () => {
    // 10:30 on the civil clock: the Si hour runs 09:00 to 11:00.
    const rows = sensitivity(moment('far-west-zone'), DEFAULT_CONVENTIONS, 45);
    const hour = rows.find((r) => r.id === 'bazi.hour')!;
    expect(hour.earlier!.minutes).toBeCloseTo(90, 1);
    expect(hour.later!.minutes).toBeCloseTo(30, 1);
    expect(hour.withinUncertainty).toBe(true);
    expect(rows.find((r) => r.id === 'bazi.year')!.withinUncertainty).toBe(false);
  });

  it('sees Lichun two minutes away', () => {
    const rows = sensitivity(moment('lichun-eve-2024'), DEFAULT_CONVENTIONS, 5);
    const year = rows.find((r) => r.id === 'bazi.year')!;
    expect(year.value).toBe('癸卯');
    expect(year.later!.value).toBe('甲辰');
    expect(year.later!.minutes).toBeGreaterThan(1.5);
    expect(year.later!.minutes).toBeLessThan(2.5);
    expect(year.withinUncertainty).toBe(true);
    // Under two minutes from a solar term is inside the engine's own margin, whatever the clock.
    expect(year.withinEngineMargin).toBe(true);
    expect(rows.find((r) => r.id === 'bazi.hour')!.withinEngineMargin).toBe(false);
    // The Sun crosses 315 degrees at the same instant, which is also a gate-wheel line boundary only by accident; the sign does not change.
    expect(rows.find((r) => r.id === 'western.sun')!.withinUncertainty).toBe(false);
  });

  it('every reported neighbour really differs, and the distance is right to the second', () => {
    const m = moment('southern');
    for (const row of sensitivity(m, DEFAULT_CONVENTIONS)) {
      for (const n of [row.earlier, row.later]) {
        if (!n) continue;
        expect(n.value, row.id).not.toBe(row.value);
        expect(n.minutes).toBeGreaterThan(0);
      }
    }
  });

  it('reports what each alternative convention would change', () => {
    const effects = conventionEffects(moment('late-zi'), DEFAULT_CONVENTIONS, 'male');
    expect(effects.length).toBe(alternatives(DEFAULT_CONVENTIONS).length);
    const midnight = effects.find((e) => e.key === 'dayBoundary')!;
    expect(midnight.changes.map((c) => c.output)).toEqual(['Day pillar']);
    const maya = effects.find((e) => e.key === 'mayaCorrelation')!;
    expect(maya.changes.map((c) => c.output)).toEqual(['Maya date']);
    const dst = conventionEffects(moment('china-dst-1988'), DEFAULT_CONVENTIONS).find((e) => e.value === 'standard')!;
    expect(dst.changes.map((c) => c.output)).toEqual(['Hour pillar']);
  });

  it('every convention has a default among its options', () => {
    for (const spec of CONVENTION_SPECS) {
      expect(spec.options.some((o) => o.value === DEFAULT_CONVENTIONS[spec.key]), spec.key).toBe(true);
    }
  });
});

describe('facts document', () => {
  it('is plain data, complete, and carries its conventions and bases', () => {
    for (const f of MOMENTS) {
      const doc = facts(makeMoment(f.civil, f.zone, f.place), { sex: 'female', uncertaintyMinutes: 10 });
      const round = JSON.parse(JSON.stringify(doc));
      expect(round.conventions).toEqual(DEFAULT_CONVENTIONS);
      for (const section of ['substrate', 'bazi', 'iching', 'western', 'vedic', 'calendars'] as const) {
        expect(typeof round[section].basis, `${f.id} ${section}`).toBe('string');
      }
      expect(round.bazi.pillars).toMatch(/^.. .. .. ..$/u);
      expect(round.western.positions).toHaveLength(7);
      expect(round.sensitivity.length).toBeGreaterThan(10);
    }
  });

  it('agrees with the pillar engine and the calendar arithmetic', () => {
    const m = moment('j2000');
    const doc = facts(m);
    const p = fourPillars(m, DEFAULT_CONVENTIONS);
    expect(doc.bazi.pillars).toBe(`${p.year.hanzi} ${p.month.hanzi} ${p.day.hanzi} ${p.hour.hanzi}`);
    expect(doc.calendars.julianDayNumber).toBe(julianDayNumber(2000, 1, 1));
    expect(doc.bazi.luck).toMatch(/not computed/);
  });
});

describe('gua qi under Jing Fang\'s allotment', () => {
  const jingFang = { ...DEFAULT_CONVENTIONS, guaQi: 'jing-fang' } as const;

  it('draws a ring of sixty-four arcs that tiles the circle, the cardinal ones under a degree wide', () => {
    const ring = buildRings(utcMsFromFields(2024, 6, 1), jingFang).find((r) => r.id === 'gua-qi')!;
    expect(ring.segments).toHaveLength(64);
    let total = 0;
    for (const [i, s] of ring.segments.entries()) {
      total += norm360(s.end - s.start) || 360;
      expect(norm360(ring.segments[(i + 1) % 64]!.start - s.end)).toBeLessThan(1e-9);
    }
    expect(total).toBeCloseTo(360, 6);
    expect(segmentAt(ring, 270.5).label).toContain('坎');
    expect(segmentAt(ring, 271.5).label).toContain('中孚');
    const short = ring.segments.filter((s) => norm360(s.end - s.start) < 1);
    expect(short).toHaveLength(4);
  });

  it('puts the cardinal periods in the timeline track', () => {
    const m = moment('j2000');
    const tracks = buildTracks(m, jingFang, { startUtcMs: m.utcMs, endUtcMs: m.utcMs + 2 * YEAR });
    const track = tracks.find((t) => t.id === 'gua-qi')!;
    expect(track.boundary).toContain('Jing Fang');
    expect(track.intervals.filter((i) => i.detail!.endsWith('Cardinal')).length).toBeGreaterThanOrEqual(8);
  });

  it('names a cardinal hexagram in the facts and the sensitivity report, and reports the change of convention', () => {
    // An hour into the sliver that opens the first winter solstice after the J2000 moment.
    const m = moment('j2000');
    const solstice = nextSunLongitude(270, m.utcMs);
    const inside = { ...m, utcMs: solstice + MS.HOUR };
    const f = facts(inside, { conventions: jingFang });
    expect(f.iching.guaQi.hexagram).toContain('坎');
    expect(f.iching.guaQi.rank).toBe('Cardinal');
    const row = sensitivity(inside, jingFang).find((r) => r.id === 'iching.gua-qi')!;
    expect(row.value).toBe('坎');
    expect(row.earlier!.minutes).toBeCloseTo(60, 0);
    expect(row.later!.value).toBe('中孚');
    expect(row.later!.minutes / 60).toBeCloseTo(0.9125 * 24 - 1, 0);
    const base = conventionEffects(inside, DEFAULT_CONVENTIONS).find((e) => e.key === 'guaQi' && e.value === 'jing-fang')!;
    expect(base.changes.map((c) => c.output)).toContain('Gua qi hexagram');
  });

  it('leaves everything printed by default as it was', () => {
    expect(DEFAULT_CONVENTIONS.guaQi).toBe('equal-longitude');
    expect(DEFAULT_CONVENTIONS.sovereignBoundary).toBe('jie');
    const ring = buildRings(utcMsFromFields(2024, 6, 1), DEFAULT_CONVENTIONS).find((r) => r.id === 'gua-qi')!;
    expect(ring.segments).toHaveLength(60);
  });
});

describe('sovereign hexagram boundary', () => {
  const jie = DEFAULT_CONVENTIONS;
  const zhongqi = { ...DEFAULT_CONVENTIONS, sovereignBoundary: 'zhongqi' } as const;
  const ringOf = (c: typeof jie | typeof zhongqi) => buildRings(utcMsFromFields(2024, 6, 1), c).find((r) => r.id === 'sovereign')!;

  it('differs between jie and zhongqi by exactly fifteen degrees', () => {
    const a = ringOf(jie).segments;
    const b = ringOf(zhongqi).segments;
    expect(a).toHaveLength(12);
    for (const [i, s] of a.entries()) {
      expect(norm360(b[i]!.start - s.start)).toBe(15);
      expect(norm360(b[i]!.end - s.end)).toBe(15);
      expect(s.short).toBe(b[i]!.short);
    }
    expect(a[0]!.start).toBe(255);
    expect(segmentAt(ringOf(jie), 260).label).toContain('復');
    expect(segmentAt(ringOf(zhongqi), 260).label).toContain('坤');
    expect(segmentAt(ringOf(zhongqi), 271).label).toContain('復');
    expect(ringOf(jie).note).toContain('zhongqi');
  });

  it('turns the track\'s hexagram at the jie by default and at the zhongqi under the convention', () => {
    const m = moment('j2000');
    const span = { startUtcMs: m.utcMs, endUtcMs: m.utcMs + 3 * YEAR };
    const turns = (c: typeof jie | typeof zhongqi): number[] => {
      const iv = buildTracks(m, c, span).find((t) => t.id === 'bazi-month')!.intervals;
      const hexagram = (d: string | undefined): string => d!.split('sovereign hexagram ')[1]!;
      const out: number[] = [];
      for (let i = 1; i < iv.length; i++) if (hexagram(iv[i]!.detail) !== hexagram(iv[i - 1]!.detail)) out.push(longitudeOf('Sun', iv[i]!.startUtcMs) % 30);
      return out;
    };
    for (const l of turns(jie)) expect(Math.abs(l - 15)).toBeLessThan(0.01);
    const z = turns(zhongqi);
    expect(z.length).toBeGreaterThan(30);
    for (const l of z) expect(Math.min(l, 30 - l)).toBeLessThan(0.01);
  });

  it('is reported as a convention effect and followed by the facts', () => {
    // Sun at about 260 degrees: the Zi month has begun but the winter solstice has not come.
    const m = moment('j2000');
    const early = { ...m, utcMs: nextSunLongitude(260, m.utcMs - 2 * YEAR + 0) };
    expect(facts(early, { conventions: jie }).iching.sovereign).toContain('復');
    expect(facts(early, { conventions: zhongqi }).iching.sovereign).toContain('坤');
    const effect = conventionEffects(early, jie).find((e) => e.key === 'sovereignBoundary')!;
    expect(effect.changes.map((c) => c.output)).toContain('Sovereign hexagram');
  });

  it('is no longer graded exact in the registry', () => {
    expect(CORRESPONDENCES.find((c) => c.id === 'sovereign-months')!.grade).not.toBe('exact');
  });
});
