// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The web shell. It holds the form state in memory, recomputes everything locally on
 * each change, and writes the results into the page. It never calls the network, and it
 * never writes to storage or to the address bar.
 */
import {
  ATTRIBUTION,
  bazi,
  buildRings,
  buildTracks,
  CONVENTION_SPECS,
  CORRESPONDENCES,
  CREDIT,
  DEFAULT_CONVENTIONS,
  facts,
  findSeams,
  forecast,
  formatOffset,
  makeMoment,
  readAcross,
  utcMsFromFields,
  western,
  zoneOffsetMinutes,
  type Conventions,
  type Facts,
  type Moment,
  type Sex,
} from '@overlay/core';
import { markersFor, renderTimeline, renderWheel } from '@overlay/render';
import { MOMENTS } from '../../../fixtures/moments.ts';
import { initForecast } from './forecastPage.ts';
import { initScorecard } from './scorecardPage.ts';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const esc = (s: string | number): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const YEAR = 365.2425 * 86_400_000;
const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

const state = {
  conventions: { ...DEFAULT_CONVENTIONS } as Conventions,
  rings: new Set<string>(),
  theme: 'auto' as 'auto' | 'light' | 'dark',
  probe: null as number | null,
  wheelSvg: '',
  timelineSvg: '',
  facts: null as Facts | null,
};

// --- form ------------------------------------------------------------------

function fillStatic(): void {
  const sample = $<HTMLSelectElement>('sample');
  sample.innerHTML = MOMENTS.map((m) => `<option value="${esc(m.id)}" title="${esc(m.why)}">${esc(m.id)}</option>`).join('') + '<option value="">(your own)</option>';
  const zones = ['UTC', '+08:00', '+09:00', '+05:30', '+01:00', '-05:00', '-08:00'];
  try {
    zones.push(...(Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone'));
  } catch {
    // Older browsers: the fixed offsets above still work, and any IANA name can be typed.
  }
  $('zones').innerHTML = zones.map((z) => `<option value="${esc(z)}"></option>`).join('');
  $<HTMLInputElement>('focus').value = day(Date.now());

  const rings = buildRings(Date.now(), DEFAULT_CONVENTIONS);
  for (const r of rings) if (r.defaultVisible) state.rings.add(r.id);
  $('rings').insertAdjacentHTML(
    'beforeend',
    rings
      .map((r) => `<label title="${esc(r.note)}"><input type="checkbox" data-ring="${esc(r.id)}"${r.defaultVisible ? ' checked' : ''} /> ${esc(r.title)} <span class="grade ${esc(r.grade)}">${esc(r.grade)}</span></label>`)
      .join(''),
  );

  $('correspondences').innerHTML =
    '<thead><tr><th>Between</th><th>Grade</th><th>Claim</th><th>What is actually true</th><th>Sources</th></tr></thead><tbody>' +
    CORRESPONDENCES.map(
      (c) =>
        `<tr><td>${esc(c.between[0])}<br />${esc(c.between[1])}</td><td><span class="grade ${esc(c.grade)}">${esc(c.grade)}</span>${c.verifiedHere ? '<br /><small>checked by the tests</small>' : ''}</td><td>${esc(c.claim)}</td><td>${esc(c.detail)}</td><td><small>${c.sources.map(esc).join('<br />')}</small></td></tr>`,
    ).join('') +
    '</tbody>';

  $('credit').innerHTML = `${esc(CREDIT)}. <a href="${esc(ATTRIBUTION.source)}" rel="noreferrer">Source</a>. Free for noncommercial use under the PolyForm Noncommercial License 1.0.0 if this credit stays; commercial use needs the owner's permission.`;
}

function loadSample(id: string): void {
  const m = MOMENTS.find((x) => x.id === id);
  if (!m) return;
  const p = (x: number, w = 2): string => String(x).padStart(w, '0');
  const c = m.civil;
  $<HTMLInputElement>('when').value = `${p(c.year, 4)}-${p(c.month)}-${p(c.day)}T${p(c.hour)}:${p(c.minute)}:${p(c.second)}`;
  $<HTMLInputElement>('zone').value = m.zone;
  $<HTMLInputElement>('lat').value = String(m.place.latitude);
  $<HTMLInputElement>('lon').value = String(m.place.longitude);
}

/** The birth moment of the form as typed (what a session file holds), or the message that says why there is none. */
function readNativity(): forecast.Nativity | string {
  const when = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec($<HTMLInputElement>('when').value);
  if (!when) return 'Enter a date and time.';
  const lat = Number($<HTMLInputElement>('lat').value);
  const lon = Number($<HTMLInputElement>('lon').value);
  if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) return 'Latitude must be within 90 degrees and longitude within 180.';
  const zone = $<HTMLInputElement>('zone').value.trim() || 'UTC';
  const nativity: forecast.Nativity = {
    civil: { year: +when[1]!, month: +when[2]!, day: +when[3]!, hour: +when[4]!, minute: +when[5]!, second: +(when[6] ?? 0) },
    zone,
    place: { latitude: lat, longitude: lon },
  };
  try {
    makeMoment(nativity.civil, nativity.zone, nativity.place);
  } catch {
    return `"${zone}" is not a time zone this browser knows. Use an IANA name such as Asia/Shanghai, or an offset such as +08:00.`;
  }
  return nativity;
}

function readMoment(): Moment | string {
  const n = readNativity();
  return typeof n === 'string' ? n : makeMoment(n.civil, n.zone, n.place);
}

// --- rendering ---------------------------------------------------------------

const span = (m: number | undefined): string => {
  if (m === undefined) return 'more than 40 days';
  if (m < 90) return `${m.toFixed(1)} min`;
  if (m < 48 * 60) return `${(m / 60).toFixed(1)} h`;
  return `${(m / 1440).toFixed(1)} days`;
};

function renderSummary(moment: Moment, f: Facts): void {
  const sun = f.western.positions[0]!;
  const moon = f.western.positions[1]!;
  $('summary').innerHTML = [
    ['Four pillars', `<span class="pillars">${esc(f.bazi.pillars)}</span>`, `day master ${esc(f.bazi.dayMaster)}; read from the ${esc(f.bazi.clockUsed)} clock`],
    ['Instant', esc(f.input.utc.replace('T', ' ').replace('Z', ' UTC')), `zone offset ${esc(formatOffset(zoneOffsetMinutes(moment.utcMs, moment.zone)))}; true solar time ${esc(f.substrate.clocks.apparent!.reading.slice(11, 19))}; equation of time ${f.substrate.equationOfTimeMinutes} min`],
    ['Sun, Moon, rising', `${esc(sun.position)}`, `Moon ${esc(moon.position)}; rising ${esc(f.western.ascendant)}; ${esc(f.western.sect)}`],
    ['Solar term (jieqi)', esc(f.substrate.solarTerm.current), `until ${esc(f.substrate.solarTerm.next)} at ${esc(f.substrate.solarTerm.at.replace('T', ' ').replace('Z', ' UTC'))}`],
    ['Hexagrams of the Sun', esc(f.iching.guaQi.hexagram), `gua qi (${esc(f.iching.guaQi.rank ?? '')}); sovereign ${esc(f.iching.sovereign)}; gate wheel ${esc(f.iching.gateWheel.hexagram)} line ${f.iching.gateWheel.line}`],
    ['Moon nakshatra', `${esc(f.vedic.moon.nakshatra)} pada ${f.vedic.moon.pada}`, `first dasha lord ${esc(f.vedic.moon.lord)}; Lahiri ayanamsa ${f.vedic.ayanamsa}°`],
    ['Day counts', esc(f.calendars.weekday), `${esc(f.calendars.maya)}; day officer (jianchu) ${esc(f.calendars.dayOfficer)}; lodge (xiu) ${esc(f.calendars.lodgeOfDay)}; nine-star year ${esc(f.calendars.nineStarOfYear)}`],
  ]
    .map(([k, v, s]) => `<div><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`)
    .join('');
  const notes = $('moment-notes');
  notes.hidden = moment.notes.length === 0;
  notes.textContent = moment.notes.join(' ');
}

function renderConventions(f: Facts): void {
  $('conventions').innerHTML = CONVENTION_SPECS.map((spec) => {
    const effects = f.conventionEffects.filter((e) => e.key === spec.key);
    const options = spec.options
      .map((o) => `<option value="${esc(o.value)}"${o.value === state.conventions[spec.key] ? ' selected' : ''} title="${esc(o.description)}">${esc(o.label)}</option>`)
      .join('');
    const lines = effects
      .map((e) =>
        e.changes.length
          ? `<div class="effect">${esc(e.label)} would give <b>${e.changes.map((c) => `${esc(c.output)} ${esc(c.to)} instead of ${esc(c.from)}`).join('; ')}</b></div>`
          : `<div class="effect">${esc(e.label)}: no difference for this moment</div>`,
      )
      .join('');
    return `<div class="c"><label>${esc(spec.title)}<select data-convention="${esc(spec.key)}"${spec.options.length < 2 ? ' disabled' : ''}>${options}</select></label><p>${esc(spec.why)}</p>${lines}</div>`;
  }).join('');
}

function renderSensitivity(f: Facts): void {
  const side = (x: { minutes: number; value: string } | null): string => (x ? `<td class="num">${span(x.minutes)}</td><td>${esc(x.value)}</td>` : `<td class="num">${span(undefined)}</td><td></td>`);
  $('sensitivity').innerHTML =
    '<thead><tr><th>Fact</th><th>Now</th><th>Earlier by</th><th>it would be</th><th>Later by</th><th>it would be</th></tr></thead><tbody>' +
    f.sensitivity.map((r) => `<tr class="${r.withinUncertainty || r.withinEngineMargin ? 'near' : ''}"><td>${esc(r.fact)}${r.withinEngineMargin ? '<br /><small>inside the engine\'s own two-minute margin: treat as undecided</small>' : ''}</td><td>${esc(r.value)}</td>${side(r.earlier)}${side(r.later)}</tr>`).join('') +
    '</tbody>';
}

function renderWheelSection(moment: Moment): void {
  const rings = buildRings(moment.utcMs, state.conventions);
  const markers = markersFor(moment);
  if (state.probe !== null) markers.push({ id: 'probe', glyph: '◇', label: `Probe at ${western.formatLongitude(state.probe)}`, longitude: state.probe, kind: 'point' });
  const p = bazi.fourPillars(moment, state.conventions);
  const orientation = $<HTMLSelectElement>('orientation').value as 'western' | 'chinese';
  state.wheelSvg = renderWheel(rings, {
    visible: rings.filter((r) => state.rings.has(r.id)).map((r) => r.id),
    orientation,
    markers,
    centre: [`${p.year.hanzi} ${p.month.hanzi} ${p.day.hanzi} ${p.hour.hanzi}`, new Date(moment.utcMs).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'],
    theme: state.theme === 'auto' ? undefined : state.theme,
  });
  $('wheel').innerHTML = state.wheelSvg;

  const c = western.chart(moment);
  const points: Array<[string, number]> = [...c.positions.map((x): [string, number] => [x.planet, x.longitude]), ['Ascendant', c.ascendant], ['Midheaven', c.midheaven]];
  $('probe-buttons').innerHTML = points.map(([name, lon]) => `<button type="button" data-probe="${lon}">${esc(name)}</button>`).join('');
  const at = state.probe ?? c.positions[0]!.longitude;
  $<HTMLInputElement>('probe').value = at.toFixed(2);
  $('across').innerHTML =
    `<thead><tr><th>${esc(western.formatLongitude(at))}</th><th></th></tr></thead><tbody>` +
    readAcross(rings, at)
      .map((r) => `<tr><td>${esc(r.title)} <span class="grade ${esc(r.grade)}">${esc(r.grade)}</span></td><td>${esc(r.label)}</td></tr>`)
      .join('') +
    '</tbody>';
}

function renderTimelineSection(moment: Moment, sex: Sex | undefined): void {
  const choice = $<HTMLSelectElement>('span').value;
  const focusRaw = /^(\d{4})-(\d{2})-(\d{2})$/.exec($<HTMLInputElement>('focus').value);
  const focus = focusRaw ? utcMsFromFields(+focusRaw[1]!, +focusRaw[2]!, +focusRaw[3]!) : Date.now();
  const years = choice === 'life' ? 90 : Number(choice);
  const startUtcMs = choice === 'life' ? moment.utcMs : focus - (years / 2) * YEAR;
  const endUtcMs = startUtcMs + years * YEAR;
  const tracks = buildTracks(moment, state.conventions, { startUtcMs, endUtcMs, sex });
  const report = findSeams(tracks, startUtcMs, endUtcMs, {
    windowDays: years > 20 ? 30 : years > 4 ? 10 : 3,
    levels: years > 4 ? ['life', 'year'] : ['life', 'year', 'month'],
  });
  state.timelineSvg = renderTimeline(tracks, {
    startUtcMs,
    endUtcMs,
    seams: report.seams,
    marks: [
      { utcMs: moment.utcMs, label: 'moment' },
      { utcMs: focus, label: choice === 'life' ? 'focus' : day(focus) },
    ],
    theme: state.theme === 'auto' ? undefined : state.theme,
  });
  $('timeline').innerHTML = state.timelineSvg;
  $('seam-note').textContent =
    `Windows of ${report.windowDays} days in which tracks on two or more independent clocks change: ${report.found} in this span, against about ${report.expectedByChance.toFixed(1)} expected if the boundaries fell at random. ` +
    'Tracks that share a clock, such as the firdaria and the profections (both turn on the birthday), count once. A seam describes the calendar arithmetic and says nothing about what happens.' +
    (sex ? '' : ' The BaZi luck pillars are left out because their direction depends on sex, which is not given.');
  $('seams').innerHTML = report.seams
    .map((s) => `<li><span class="when">${day(s.utcMs)}</span>, ${s.clocks} clocks${s.changes.map((c) => `<span class="ch">${esc(c.title)}: ${esc(c.from)} to ${esc(c.to)} on ${day(c.utcMs)}</span>`).join('')}</li>`)
    .join('');
}

let pending = 0;
function update(): void {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    const moment = readMoment();
    if (typeof moment === 'string') {
      const notes = $('moment-notes');
      notes.hidden = false;
      notes.textContent = moment;
      return;
    }
    const sexRaw = $<HTMLSelectElement>('sex').value;
    const sex = sexRaw === 'male' || sexRaw === 'female' ? sexRaw : undefined;
    const f = facts(moment, { conventions: state.conventions, sex, uncertaintyMinutes: Number($<HTMLInputElement>('uncertainty').value) || 0 });
    state.facts = f;
    renderSummary(moment, f);
    renderConventions(f);
    renderSensitivity(f);
    renderWheelSection(moment);
    renderTimelineSection(moment, sex);
    $('facts').textContent = JSON.stringify(f, null, 2);
  });
}

// --- events ------------------------------------------------------------------

function save(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function wire(): void {
  $('sample').addEventListener('change', (e) => {
    loadSample((e.target as HTMLSelectElement).value);
    state.probe = null;
    update();
    forecastPage.schedule();
  });
  $('moment').addEventListener('input', (e) => {
    if ((e.target as HTMLElement).id !== 'sample' && ['when', 'zone', 'lat', 'lon'].includes((e.target as HTMLElement).id)) $<HTMLSelectElement>('sample').value = '';
    update();
    forecastPage.schedule();
  });
  $('moment').addEventListener('submit', (e) => e.preventDefault());
  $('conventions').addEventListener('change', (e) => {
    const el = e.target as HTMLSelectElement;
    const key = el.dataset.convention as keyof Conventions | undefined;
    if (!key) return;
    const spec = CONVENTION_SPECS.find((s) => s.key === key)!;
    const option = spec.options.find((o) => String(o.value) === el.value)!;
    state.conventions = { ...state.conventions, [key]: option.value } as Conventions;
    update();
    forecastPage.schedule();
  });
  $('rings').addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (!el.dataset.ring) return;
    if (el.checked) state.rings.add(el.dataset.ring);
    else state.rings.delete(el.dataset.ring);
    update();
  });
  for (const id of ['orientation', 'span', 'focus']) $(id).addEventListener('change', update);
  $('probe').addEventListener('change', (e) => {
    const v = Number((e.target as HTMLInputElement).value);
    if (Number.isFinite(v)) state.probe = ((v % 360) + 360) % 360;
    update();
  });
  $('probe-buttons').addEventListener('click', (e) => {
    const v = (e.target as HTMLElement).dataset.probe;
    if (v === undefined) return;
    state.probe = Number(v);
    update();
  });
  $('wheel').addEventListener('click', (e) => {
    const svg = $('wheel').querySelector('svg');
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const scale = 1000 / box.width;
    const x = (e.clientX - box.left) * scale - 500;
    const y = 500 - (e.clientY - box.top) * scale; // the page draws the wheel without a title, so its centre is at 500
    if (Math.hypot(x, y) < 60) return;
    const theta = (Math.atan2(y, x) * 180) / Math.PI;
    const dir = $<HTMLSelectElement>('orientation').value === 'western' ? 1 : -1;
    state.probe = ((((theta - 180) * dir) % 360) + 360) % 360;
    update();
  });
  // The two sex controls are one choice: the moment's (luck-pillar direction for the drawings) and the forecast's (the chart BaZi is read as).
  const toForecast: Record<string, string> = { male: 'male-chart', female: 'female-chart', '': 'none' };
  const fromForecast: Record<string, string> = { 'male-chart': 'male', 'female-chart': 'female', none: '' };
  $('sex').addEventListener('change', () => {
    const el = $<HTMLSelectElement>('fc-sex');
    el.value = toForecast[$<HTMLSelectElement>('sex').value] ?? 'none';
    el.dispatchEvent(new Event('input'));
  });
  $('fc-sex').addEventListener('input', () => {
    $<HTMLSelectElement>('sex').value = fromForecast[$<HTMLSelectElement>('fc-sex').value] ?? '';
    update();
  });
  $('theme').addEventListener('click', () => {
    state.theme = state.theme === 'auto' ? 'dark' : state.theme === 'dark' ? 'light' : 'auto';
    if (state.theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = state.theme;
    $('theme').textContent = `Theme: ${state.theme}`;
    update();
  });
  $('copy').addEventListener('click', () => {
    if (state.facts) void navigator.clipboard?.writeText(JSON.stringify(state.facts, null, 2));
  });
  $('download').addEventListener('click', () => state.facts && save('overlay-facts.json', JSON.stringify(state.facts, null, 2), 'application/json'));
  $('dl-wheel').addEventListener('click', () => save('overlay-wheel.svg', state.wheelSvg, 'image/svg+xml'));
  $('dl-timeline').addEventListener('click', () => save('overlay-timeline.svg', state.timelineSvg, 'image/svg+xml'));
}

fillStatic();
loadSample('j2000');
const forecastPage = initForecast({
  readMoment,
  conventions: () => state.conventions,
  uncertaintyMinutes: () => Number($<HTMLInputElement>('uncertainty').value) || 0,
});
const scorecardPage = initScorecard({
  readNativity,
  conventions: () => state.conventions,
  forecastSettings: () => forecastPage.settings(),
  save,
});
wire();
update();
forecastPage.schedule();
// The form can change the moment the frozen forecasts were made for; the scorecard says so.
for (const id of ['when', 'zone', 'lat', 'lon', 'sample', 'fc-sex', 'sex']) $(id).addEventListener('input', () => scorecardPage.refresh());
