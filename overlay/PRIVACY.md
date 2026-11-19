# Privacy

A date, time and place of birth identify a person about as well as a name does, and they cannot be changed afterwards. This project is built so that it never has them.

## What the software does with what you enter

The engine is a set of pure functions. The command line reads its arguments, writes to standard output and exits. The web page computes in the browser tab and keeps its state in memory. The forecast is part of the engine and follows the same rules.

No part of it makes a network request. The built web page ships with a content security policy of `connect-src 'none'` and `form-action 'none'`, so the browser itself refuses any request a script might attempt; there are no analytics, no fonts or scripts from other hosts, and no geocoder (you type coordinates). Nothing is written to cookies, local storage, session storage or IndexedDB, and nothing is put in the address bar, so a link to the page never carries your data. Reloading the page forgets everything.

The buttons that copy or download a result act on your own machine and only when you press them. What you then do with the file is up to you; a facts document contains the moment and place it was computed for.

## What the forecast does with what you type

The forecast section of the page takes the same moment and place as the rest of the page, plus a topic, a first year, a number of years, an optional sex convention for the BaZi chart and, for the character of a period, a start day and a number of days. All of it is computed in the browser tab, by the same pure functions as on the command line. None of it is sent anywhere: the content security policy that forbids network requests covers the forecast section as it covers the rest of the page. None of it is stored: the forecast writes nothing to cookies, local storage, session storage or IndexedDB, and puts nothing in the address bar, so a link to the page does not carry the forecast and reloading forgets it. After each change the page waits a moment and then works in short steps inside the tab; it uses no background thread.

The forecast section has no button that copies, downloads or saves a forecast. The copy and download buttons of the page act on the facts document and the two drawings, and only when you press them. The command line prints the forecast to standard output and writes no file of its own; what you redirect it to is your choice. A file you save from a forecast or the facts document holds the birth moment you typed, so treat it as personal data.

## What is in the repository

No personal data: no real name, no email address, and no real person's birth data, living or dead. The author is identified by a handle only. Every example, fixture and test vector is a synthetic moment (an astronomical or computing epoch, or an instant constructed to sit on a boundary), and each one states why it exists.

## How this is enforced

`packages/web/test/guards.test.ts` runs with every build and fails if:

- any source file mentions `fetch`, `XMLHttpRequest`, `sendBeacon`, a socket or worker, browser storage, cookies, the history or location of the address bar, a remote script, style, font or image, or Node's networking modules;
- the content security policy loses its network or form restrictions;
- a literal date-time appears anywhere outside `fixtures/moments.ts`.

No test can prove that a date is not somebody's birthday. The last rule exists so that there is exactly one file in which a full moment can be written down, and therefore exactly one file to review.

## If you contribute

Do not add real birth data, yours or anyone else's, to code, tests, issues, pull requests or commit messages, not even of public or historical figures. If a bug only shows for a particular moment, shift it to a synthetic moment that shows the same bug (the same distance from the same boundary) and report that one.
