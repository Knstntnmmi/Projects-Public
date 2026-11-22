// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
/**
 * What choosing a place does to the form, apart from the document: choosing fills latitude,
 * longitude and time zone and writes one plain line under the field; editing the coordinates
 * or the zone by hand forgets the city, so the line never says more than is true.
 */
import { describePlace, formatCoordinates, type Civil, type Place } from './places/search.ts';

export interface PlacePort {
  /** Writes the three fields and lets the rest of the page know the moment changed. */
  setPlace(latitude: number, longitude: number, zone: string): void;
  /** The date and time of birth as typed, or null if there is none yet. */
  civil(): Civil | null;
  /** The coordinates now in the number fields, or null if they are not numbers. */
  coordinates(): { latitude: number; longitude: number } | null;
  /** Writes the line under the field. */
  showLine(text: string): void;
  /** Writes the text of the search field. */
  showQuery(text: string): void;
}

export interface PlaceForm {
  choose(place: Place): void;
  /** The reader typed in latitude, longitude or the time zone. */
  editedByHand(): void;
  /** A new moment was loaded (a sample, for instance): forget the city. */
  reset(): void;
  /** The date changed: the offset on that date may have too. */
  refresh(): void;
  chosen(): Place | null;
}

export function createPlaceForm(port: PlacePort): PlaceForm {
  let chosen: Place | null = null;

  function refresh(): void {
    if (chosen) return port.showLine(describePlace(chosen, port.civil()));
    const c = port.coordinates();
    port.showLine(c ? `Coordinates in use: ${formatCoordinates(c.latitude, c.longitude)} (a sample moment, or entered by hand).` : '');
  }

  return {
    choose(place) {
      chosen = place;
      port.showQuery(place.label);
      port.setPlace(place.latitude, place.longitude, place.zone);
      refresh();
    },
    editedByHand() {
      chosen = null;
      port.showQuery('');
      refresh();
    },
    reset() {
      chosen = null;
      port.showQuery('');
      refresh();
    },
    refresh,
    chosen: () => chosen,
  };
}
