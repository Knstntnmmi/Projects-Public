// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The facts document: everything the engine can say about one moment, as plain data,
 * with the conventions that produced it and the sources behind each part. It is meant
 * to be handed to a person or to a language model in place of asking either to compute.
 */
import { DEFAULT_CONVENTIONS, type Conventions } from './conventions.ts';
import { buildRings, readAcross } from './overlay/rings.ts';
import { conventionEffects, sensitivity, type ConventionEffect, type SensitivityRow } from './overlay/sensitivity.ts';
import { angles, longitudeOf } from './substrate/sky.ts';
import { termsAround } from './substrate/terms.ts';
import {
  clockReading,
  deltaTSeconds,
  equationOfTimeMinutes,
  fieldsFromUtcMs,
  formatCivil,
  formatOffset,
  basisOffsetMinutes,
  julianDate,
  julianDayNumber,
  MS,
  zoneOffsetMinutes,
  type Moment,
  type TimeBasis,
} from './substrate/time.ts';
import { fourPillars, luck, type Pillar, type Sex } from './systems/bazi/index.ts';
import { phaseText } from './systems/bazi/tables.ts';
import { dayOfficer, mansionOfDay, mayaDate, nineStarOfYear, weekday } from './systems/calendars/index.ts';
import {
  CARDINAL_HEXAGRAMS,
  FUXI_SEQUENCE,
  FUXI_START,
  GATE_SEQUENCE,
  GATE_START,
  GUA_QI_SEQUENCE,
  GUA_QI_START,
  guaQiRank,
  guaQiSpans,
  SOVEREIGN_SEQUENCE,
  sovereignStart,
  wheelPosition,
} from './systems/iching/index.ts';
import { lahiriAyanamsa, nakshatraOf, vimshottari } from './systems/vedic/index.ts';
import { chart, firdaria, formatLongitude, planetaryHour, profections } from './systems/western/index.ts';

/** Who made this, and under what terms it may be reused. The licence notice asks that this credit be kept. */
export const ATTRIBUTION = {
  author: 'Knstntnmmi',
  source: 'https://github.com/Knstntnmmi/Projects-Public',
  license: 'PolyForm-Noncommercial-1.0.0',
  year: 2026,
} as const;

/** The one-line credit carried by every drawing and page. */
export const CREDIT = `overlay © ${ATTRIBUTION.year} ${ATTRIBUTION.author} · github.com/${ATTRIBUTION.author}/Projects-Public · ${ATTRIBUTION.license}`;

export const ENGINE = {
  name: 'overlay',
  version: '0.1.0',
  author: ATTRIBUTION.author,
  source: ATTRIBUTION.source,
  license: ATTRIBUTION.license,
  ephemeris: 'astronomy-engine 2.1.19 (MIT): truncated VSOP87 and the NOVAS reductions, good to about one arcminute',
} as const;

export interface FactsOptions {
  conventions?: Conventions;
  sex?: Sex;
  /** How uncertain the clock time is, in minutes either way. */
  uncertaintyMinutes?: number;
}

const iso = (ms: number): string => new Date(ms).toISOString().replace('.000Z', 'Z');

function pillarFacts(p: Pillar) {
  return {
    hanzi: p.hanzi,
    pinyin: p.pinyin,
    stem: { hanzi: p.stem.hanzi, phase: phaseText(p.stem.element), polarity: p.stem.polarity, tenGod: p.stemGod ? `${p.stemGod.hanzi} ${p.stemGod.pinyin} ${p.stemGod.english}` : 'day master' },
    branch: { hanzi: p.branch.hanzi, animal: p.branch.animal, phase: phaseText(p.branch.element) },
    hiddenStems: p.hidden.map((h) => ({ hanzi: h.stem.hanzi, phase: phaseText(h.stem.element), tenGod: `${h.god.hanzi} ${h.god.pinyin} ${h.god.english}` })),
    nayin: `${p.nayin.hanzi} ${p.nayin.english}`,
  };
}

export function facts(moment: Moment, options: FactsOptions = {}) {
  const conventions = options.conventions ?? DEFAULT_CONVENTIONS;
  const { utcMs, place, zone } = moment;
  const sun = longitudeOf('Sun', utcMs);
  const moon = longitudeOf('Moon', utcMs);

  const clocks = Object.fromEntries(
    (['civil', 'standard', 'lmt', 'apparent'] as TimeBasis[]).map((basis) => [
      basis,
      { reading: formatCivil(clockReading(moment, basis)), offsetFromUtc: formatOffset(basisOffsetMinutes(moment, basis)) },
    ]),
  );

  const terms = termsAround(utcMs);
  const pillars = fourPillars(moment, conventions);
  const c = chart(moment);
  const civil = fieldsFromUtcMs(utcMs + zoneOffsetMinutes(utcMs, zone) * MS.MIN);
  const jdn = julianDayNumber(civil.year, civil.month, civil.day);
  const rings = buildRings(utcMs, conventions);
  const moonNak = nakshatraOf(moon, utcMs);
  const dashas = vimshottari(moment, 1);
  const fird = firdaria(moment, conventions, 1);
  const hour = planetaryHour(moment);
  const gate = wheelPosition(GATE_SEQUENCE, GATE_START, sun);
  const guaQiEqual = wheelPosition(GUA_QI_SEQUENCE, GUA_QI_START, sun);
  const guaQi = conventions.guaQi === 'equal-longitude' ? null : guaQiSpans(utcMs, utcMs + 1, conventions.guaQi)[0]!;
  const guaQiHex = guaQi ? guaQi.hexagram : guaQiEqual.hexagram;
  const guaQiPos = guaQi ? guaQi.position : guaQiEqual.position;
  const sovereign = wheelPosition(SOVEREIGN_SEQUENCE, sovereignStart(conventions.sovereignBoundary), sun).hexagram;
  const fuxi = wheelPosition(FUXI_SEQUENCE, FUXI_START, sun).hexagram;
  const cardinal = CARDINAL_HEXAGRAMS[Math.floor((((sun - 270) % 360) + 360) % 360 / 90)]!;
  const name = (h: { number: number; hanzi: string; pinyin: string; gloss: string }): string => `${h.number} ${h.hanzi} ${h.pinyin} (${h.gloss})`;

  const l = options.sex ? luck(moment, conventions, options.sex) : null;

  return {
    engine: ENGINE,
    input: {
      utc: iso(utcMs),
      zone,
      zoneOffset: formatOffset(zoneOffsetMinutes(utcMs, zone)),
      latitude: place.latitude,
      longitude: place.longitude,
      notes: moment.notes,
    },
    conventions,
    substrate: {
      julianDate: Number(julianDate(utcMs).toFixed(6)),
      deltaTSeconds: Number(deltaTSeconds(utcMs).toFixed(2)),
      equationOfTimeMinutes: Number(equationOfTimeMinutes(utcMs).toFixed(2)),
      clocks,
      sunLongitude: Number(sun.toFixed(5)),
      solarTerm: {
        current: `${terms.previous.term.hanzi} ${terms.previous.term.pinyin}`,
        since: iso(terms.previous.utcMs),
        next: `${terms.next.term.hanzi} ${terms.next.term.pinyin}`,
        at: iso(terms.next.utcMs),
      },
      basis: 'Positions are apparent, geocentric, of date. Zone offsets come from the tz database of the runtime.',
    },
    bazi: {
      pillars: `${pillars.year.hanzi} ${pillars.month.hanzi} ${pillars.day.hanzi} ${pillars.hour.hanzi}`,
      year: pillarFacts(pillars.year),
      month: pillarFacts(pillars.month),
      day: pillarFacts(pillars.day),
      hour: pillarFacts(pillars.hour),
      dayMaster: `${pillars.day.stem.hanzi} ${pillars.day.stem.polarity} ${phaseText(pillars.day.stem.element)}`,
      clockUsed: `${conventions.timeBasis}: ${formatCivil(pillars.clock)}`,
      luck: l
        ? {
            direction: l.forward ? 'forward' : 'backward',
            countedTo: `${l.jie.hanzi} at ${iso(l.jie.utcMs)}`,
            startAge: l.startAge,
            begins: iso(l.startUtcMs),
            pillars: l.pillars.map((p) => ({ pillar: p.cycle.hanzi, from: iso(p.startUtcMs), to: iso(p.endUtcMs) })),
          }
        : 'not computed: the direction of the luck pillars depends on sex, which was not given',
      basis: `Ten gods (shishen), hidden stems (canggan) and the Five Phases (wuxing) are printed in hanzi, pinyin and English; the ten gods' English names are trade usage. Year from Lichun and month from the jie (both by the Sun's longitude, independent of any clock). Day and hour from the ${conventions.timeBasis} clock with the day turning at ${conventions.dayBoundary === 'zi23' ? '23:00' : 'midnight'}. Cross-checked against tyme4ts in the test suite.`,
    },
    iching: {
      guaQi: { hexagram: name(guaQiHex), rank: guaQiRank(guaQiPos).english, mode: conventions.guaQi },
      sovereign: name(sovereign),
      cardinal: name(cardinal.hexagram),
      fuxiCircle: name(fuxi),
      gateWheel: { hexagram: name(gate.hexagram), line: gate.line },
      basis: 'The gua qi hexagram follows the guaQi convention and the sovereign hexagram the sovereignBoundary convention. All five are readings of the Sun\'s longitude against a hexagram arrangement; they are different arrangements and are not expected to agree. No hexagram is cast: casting is a chance procedure, not a calculation.',
    },
    western: {
      ascendant: formatLongitude(c.ascendant),
      midheaven: formatLongitude(c.midheaven),
      sect: c.isDayChart ? 'day chart' : 'night chart',
      positions: c.positions.map((p) => ({
        planet: p.planet,
        position: formatLongitude(p.longitude),
        longitude: Number(p.longitude.toFixed(4)),
        house: p.house,
        retrograde: p.retrograde,
        dignities: p.dignities,
      })),
      northNode: formatLongitude(c.northNode),
      lotOfFortune: formatLongitude(c.fortune),
      profectionAtBirth: profections(moment, 1)[0],
      firdariaAtBirth: fird.major[0] ? { lord: fird.major[0].lord, until: iso(fird.major[0].endUtcMs) } : null,
      planetaryHour: hour
        ? { dayRuler: hour.dayRuler, hourRuler: hour.hourRuler, hourNumber: hour.hourNumber, from: iso(hour.startUtcMs), to: iso(hour.endUtcMs) }
        : 'undefined at this latitude and date: the Sun does not rise or set',
      basis: 'Tropical zodiac, whole-sign houses, mean lunar node, Dorothean triplicities, Egyptian bounds, Chaldean faces.',
    },
    vedic: {
      ayanamsa: Number(lahiriAyanamsa(utcMs).toFixed(4)),
      moon: { nakshatra: moonNak.name, pada: moonNak.pada, lord: moonNak.lord, siderealLongitude: Number(moonNak.siderealLongitude.toFixed(4)) },
      dashaAtBirth: dashas.maha[0] ? { lord: dashas.maha[0].lord, began: iso(dashas.maha[0].startUtcMs), until: iso(dashas.maha[0].endUtcMs) } : null,
      basis: 'Lahiri ayanamsa, true (nutation included), fixed at 23 degrees 15 minutes 00.658 seconds on 21 March 1956 and carried by the IAU precession; vimshottari years of 365.25 days.',
    },
    calendars: {
      julianDayNumber: jdn,
      weekday: weekday(jdn),
      maya: mayaDate(jdn, conventions.mayaCorrelation).text,
      dayOfficer: (() => {
        const o = dayOfficer(pillars.day.branch.index, pillars.month.branch.index);
        return `${o.hanzi} ${o.pinyin} ${o.english}`;
      })(),
      lodgeOfDay: (() => {
        const l = mansionOfDay(jdn);
        return `${l.hanzi} ${l.pinyin}`;
      })(),
      nineStarOfYear: (() => {
        const s = nineStarOfYear(pillars.cycleYear);
        return `${s.hanzi} ${s.pinyin} ${s.english}`;
      })(),
      basis: 'Day officer (jianchu), lodge (xiu) of the almanac day cycle and nine stars (zibai) in hanzi, pinyin and English. Counted on the civil date, except the day officer, which follows the day pillar.',
    },
    acrossTheRings: {
      sun: readAcross(rings, sun),
      moon: readAcross(rings, moon),
      ascendant: readAcross(rings, angles(utcMs, place).ascendant),
    },
    sensitivity: sensitivity(moment, conventions, options.uncertaintyMinutes ?? 0) as SensitivityRow[],
    conventionEffects: conventionEffects(moment, conventions, options.sex) as ConventionEffect[],
  };
}

export type Facts = ReturnType<typeof facts>;
