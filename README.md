# FormCalc · 3D Calculator

A focused, tactile calculator workspace built with **TypeScript**, CSS 3D transforms and a small Node.js build pipeline. All calculations happen on your device. No API keys, accounts or backend services are needed.

Repository: https://github.com/Nikhil-Lucky/formcalc

## Open the app

Double-click **index.html**. The compiled files in `assets/` are included, so the app works directly from disk and without a network connection. Keep the `assets` folder next to `index.html`.

## Develop

Install Node.js 22 or newer, then run:

```sh
npm ci
npm run build
npm run dev
```

Open `http://127.0.0.1:4173`. After editing TypeScript or CSS in `src/`, run `npm run build` and refresh. `dev` serves the current build; it is not a hot-reload server.

## Features

- Editable expressions with live results and proper operator precedence.
- Parentheses, powers, percentages, constants, factorials and scientific functions.
- Sine, cosine and tangent in degrees or radians; square root, log, natural log, absolute value and exponentials.
- Previous answer (`ans`), memory add/subtract/recall/clear and input undo/redo.
- Up to 100 locally saved calculations; reuse, copy, remove and export as CSV.
- Six unit-conversion categories: length, mass, temperature, area, volume and time.
- Sage, sand and graphite themes, adjustable 3D perspective and a flat view.
- Keyboard shortcuts, accessible controls, responsive layouts and reduced-motion support.
- Offline operation with no third-party scripts, fonts, analytics or runtime dependencies.

## Math behavior

Expressions follow mathematical precedence: `2 + 3 * 4 = 14`, `-2^2 = -4`, and powers associate right to left. Multiplication can be implicit before a function, constant or parenthesis: `2pi` or `2(3+4)`.

`%` is a postfix division by 100. `200 * 10% = 20`; add ten percent with `200 * (1 + 10%)`. This is mathematical percentage syntax, not the relative-percent behavior of some desk calculators.

Functions require parentheses: `sqrt(81)`, `sin(30)`, `log(100)`. Scientific functions can also be typed in standard mode. Results display up to 12 significant digits; calculations use JavaScript's double-precision numbers. This is not an arbitrary-precision financial engine.

Press Enter or `=` to save a result. Further digits start a new calculation; an operator continues from the result. Repeated Enter does not create duplicate history entries. `ans` refers to the last completed result. Changing angle mode re-evaluates the current expression.

Volume uses US gallons and US cups. Temperatures below absolute zero are rejected. History, memory and preferences are stored locally and are not synced between devices. If browser storage is disabled, the app works for the current session. File URLs and HTTP URLs have separate browser storage.

## Tests

```sh
npm test
npm run test:browser
```

Browser tests use an installed Chrome on Windows. Elsewhere install Chromium once with `npx playwright install chromium`, or set `CHROME_PATH` to your browser executable. `npm run check` runs type checking, build, engine tests and browser tests. Screenshots and CSV fixtures go into the ignored `test-results/` directory.

## Project structure

```text
src/engine.ts          Typed math parser and unit-conversion engine
src/app.ts             UI interactions, persistence and history
src/styles.css        Responsive styles, themes and 3D treatment
assets/               Compiled application and favicon
scripts/              Build, local server and test entry points
tests/                Math and browser regression tests
index.html            App shell; opens directly in your browser
.github/workflows/    CI validation
```

## GitHub Pages

After pushing the project to GitHub, open **Settings → Pages**, select **Deploy from a branch**, and choose **main / (root)**. Because compiled assets are committed, Pages needs no special build step.

To publish from this local folder after configuring Git and signing in to GitHub:

```sh
git add .
git commit -m "Build professional TypeScript calculator workspace"
git push -u origin main
```

The `.gitignore` excludes dependencies, test screenshots and local tooling. Commit the generated `assets/app.js`, `assets/app.js.map`, `assets/styles.css` and `package-lock.json` with source changes.
