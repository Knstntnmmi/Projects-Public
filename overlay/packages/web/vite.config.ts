// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Knstntnmmi <https://github.com/Knstntnmmi/Projects-Public>
import { defineConfig, type Plugin } from 'vite';

/**
 * The built page carries a Content-Security-Policy that forbids every network request
 * a script could make. The privacy claim is then enforced by the browser rather than
 * resting on a reading of the source. (It is left off the dev server, whose live reload
 * needs a socket.)
 */
const lockdown: Plugin = {
  name: 'overlay-lockdown',
  apply: 'build',
  transformIndexHtml(html) {
    const policy = "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'";
    return html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
  },
};

// Relative base so the build can be served from any path, including a project page.
export default defineConfig({
  base: './',
  plugins: [lockdown],
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
