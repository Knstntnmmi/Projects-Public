# Privacy

A date, time and place of birth identify a person about as well as a name does, and they cannot be changed afterwards. This project is built so that it never has them.

## What the software does with what you enter

The engine is a set of pure functions. The command line reads its arguments, writes to standard output and exits. The web page computes in the browser tab and keeps its state in memory.

No part of it makes a network request. The built web page ships with a content security policy of `connect-src 'none'` and `form-action 'none'`, so the browser itself refuses any request a script might attempt; there are no analytics, no fonts or scripts from other hosts, and no geocoder (you type coordinates). Nothing is written to cookies, local storage, session storage or IndexedDB, and nothing is put in the address bar, so a link to the page never carries your data. Reloading the page forgets everything.

The buttons that copy or download a result act on your own machine and only when you press them. What you then do with the file is up to you; a facts document contains the moment and place it was computed for.

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
