// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * The place field of the form: a combobox with a listbox of matching cities, by keyboard or
 * touch. The list of cities is a local chunk of the page, loaded the first time the field is
 * used. Nothing is sent anywhere.
 */
import { createPlaceForm, type PlaceForm } from './placeForm.ts';
import { esc } from './forecastView.ts';
import { loadPlaces, searchPlaces, type Civil, type Place } from './places/search.ts';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function readCivil(): Civil | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec($<HTMLInputElement>('when').value);
  return m ? { year: +m[1]!, month: +m[2]!, day: +m[3]!, hour: +m[4]!, minute: +m[5]!, second: +(m[6] ?? 0) } : null;
}

export function initPlacePicker(): PlaceForm {
  const input = $<HTMLInputElement>('place');
  const list = $<HTMLUListElement>('place-list');
  const line = $('place-line');
  let shown: Place[] = [];
  let active = -1;
  let programmatic = false;

  const form = createPlaceForm({
    setPlace(latitude, longitude, zone) {
      $<HTMLInputElement>('lat').value = String(latitude);
      $<HTMLInputElement>('lon').value = String(longitude);
      $<HTMLInputElement>('zone').value = zone;
      // One input event tells the form and the scorecard that the moment changed.
      programmatic = true;
      $('lat').dispatchEvent(new Event('input', { bubbles: true }));
      programmatic = false;
    },
    civil: readCivil,
    coordinates() {
      const latitude = Number($<HTMLInputElement>('lat').value);
      const longitude = Number($<HTMLInputElement>('lon').value);
      return $<HTMLInputElement>('lat').value !== '' && $<HTMLInputElement>('lon').value !== '' && Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
    },
    showLine: (text) => void (line.textContent = text),
    showQuery: (text) => void (input.value = text),
  });

  function close(): void {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function setActive(i: number): void {
    const items = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled])'));
    if (!items.length) return;
    active = (i + items.length) % items.length;
    items.forEach((el, k) => el.setAttribute('aria-selected', String(k === active)));
    input.setAttribute('aria-activedescendant', items[active]!.id);
    items[active]!.scrollIntoView({ block: 'nearest' });
  }

  function open(query: string, places: readonly Place[] | null): void {
    if (!query.trim()) return close();
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    input.removeAttribute('aria-activedescendant');
    active = -1;
    if (!places) {
      shown = [];
      list.innerHTML = '<li role="option" aria-disabled="true" class="none">Loading the list of cities…</li>';
      return;
    }
    shown = searchPlaces(places, query);
    list.innerHTML = shown.length
      ? shown.map((p, i) => `<li role="option" id="place-opt-${i}" data-i="${i}" aria-selected="false">${esc(p.label)}</li>`).join('')
      : '<li role="option" aria-disabled="true" class="none">No city in the list matches. Use “Enter coordinates by hand” below.</li>';
  }

  async function search(): Promise<void> {
    const query = input.value;
    open(query, null);
    const places = await loadPlaces();
    // The reader may have typed on while the list loaded.
    if (input.value === query) open(query, places);
  }

  function pick(i: number): void {
    const place = shown[i];
    if (!place) return;
    close();
    form.choose(place);
  }

  input.addEventListener('input', (e) => {
    // The typing is a search, not a change of the moment; the form need not recompute for it.
    e.stopPropagation();
    void search();
  });
  input.addEventListener('focus', () => {
    void loadPlaces();
  });
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (list.hidden) void search();
      else setActive(active + (e.key === 'ArrowDown' ? 1 : -1));
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (!list.hidden && shown.length) {
        pick(active >= 0 ? active : 0);
        e.preventDefault();
      }
    } else if (e.key === 'Escape') {
      close();
    }
  });
  // Keep the focus in the field while the list is pressed, so a tap does not close the list before it is read.
  list.addEventListener('mousedown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (item) pick(Number(item.dataset.i));
  });

  const hand = (): void => {
    if (!programmatic) form.editedByHand();
  };
  for (const id of ['lat', 'lon', 'zone']) $(id).addEventListener('input', hand);
  $('when').addEventListener('input', () => form.refresh());

  return form;
}
