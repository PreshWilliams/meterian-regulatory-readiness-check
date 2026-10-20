# Meterian Regulatory Readiness Check

A free, non-invasive self-assessment of software supply-chain risk against ISO/IEC 27001, ISO/IEC 42001, the NCSC Cyber Assessment Framework (CAF) v4.0 (with an NHS DTAC overlay), the EU Cyber Resilience Act (CRA) and the UK Software Security Code of Practice (SSCoP). Built for Meterian under SoW PWMTR-001 as a sales-enablement and market-education asset. It is not a legal, regulatory, audit or certification assessment.

Draft 2 · model v0.2.0 · 20 October 2026

## Files

| Path | Purpose | Who edits it |
|---|---|---|
| `index.html` | The page. A complete document that loads `src/model.js` and `src/scoring.js`; serve it from GitHub Pages as-is. | Developer |
| `src/model.js` | The content: 12 dimensions, answer options, weights, framework mapping, obligation flags with dates, "How Meterian helps" lines, product glossary, disclaimer, methodology. | Meterian marketing / GRC, no developer needed |
| `src/scoring.js` | The rules: section scores, overall score, bands, override, prioritised gaps, obligation-flag evaluation, framework alignment rows, HubSpot payload. Pure functions, no DOM. | Developer; should rarely change |
| `test/scoring.test.js` | 23 unit tests reproducing the D1 worked examples, band boundaries, the cap/floor properties, the override and its carve-out, and the rule that selections never change the score. | Developer |
| `examples/worked-cases.js` | Prints a table of worked cases so the arithmetic can be checked by hand. | Anyone |
| `build.js` | Produces `dist/meterian-readiness-check.html` (one self-contained file for WordPress or HubSpot) and `artifact/index.html` (preview variant). | Developer |
| `dist/meterian-readiness-check.html` | Single-file build. Upload this one file to embed the tool on a page that cannot host a folder. | Generated |

## Uploading to GitHub

1. Upload `index.html`, the `src/` folder, `test/`, `examples/`, `build.js`, `package.json` and this README to the repository root.
2. Settings → Pages → deploy from the `main` branch, root folder. The page is served at `https://<user>.github.io/<repo>/`.
3. Nothing to build for the live page: React, ReactDOM and Babel load from cdnjs, fonts from Google Fonts. `node build.js` is only needed to regenerate the single-file `dist/` version.

## Run locally

```
npm test          # node --test test/
npm run examples  # node examples/worked-cases.js
npm run build     # node build.js
```

Node 18 or later; no dependencies. To view `index.html` locally, serve the folder (`npx serve .` or any static server); opening the file directly works in most browsers but some block the relative script loads from `file://`.

## Editing the content without a developer

All of this is in `src/model.js`.

- **Question or option wording**: edit the `question` / `label` strings. Keep four options per dimension with `points` 0, 1, 2, 3 (0 = least risk).
- **A weight**: edit `weight` (3, 2 or 1) and the `whyWeight` sentence so the rationale shown to prospects stays truthful. Scores renormalise automatically.
- **A clause reference**: edit the `mapping` entry. Every dimension must keep a string for `iso27001`, `iso42001`, `caf`, `cra` and `sscop` (a test enforces this); the `dtac` overlay may be `null`.
- **A date**: edit `KEY_DATES`; the obligation flags read from it. Review annually.
- **An obligation flag**: edit `OBLIGATION_FLAGS`. `requires` lists selection ids (any one triggers), `when` lists `{ dimension, minPoints }` conditions (all must hold), `crossRef` lists the Controls dimensions to report against.
- **A "How Meterian helps" line**: edit `meterian.summary`. `confirm` holds wording that still needs sign-off and is never shown to prospects.
- **Framework names**: `FRAMEWORKS[id].full` is used on first appearance (hero, setup chips, profile, report, footer); `short` thereafter.
- **Bands or the override**: edit `BANDS` / `OVERRIDE` and re-run the tests.

Then run `npm test` and `npm run build`.

## Scoring rules (as implemented)

1. Each answer carries 0–3 risk points.
2. Section score = Σ(points × weight) ÷ (3 × Σ weights) × 100 over answered dimensions. Exposure Σ weights = 13 (max 39 raw points); Controls Σ weights = 15 (max 45).
3. Overall = average of the two section ratios, rounded once. Shown once both sections have an answer; provisional until all twelve are answered.
4. Bands: 0–25 Low · 26–50 Medium · 51–75 High · 76–100 Critical.
5. Override: any one Controls dimension at 3 points floors the rating at High; two or more force Critical. Applies only when the Exposure score is ≥ 26. Exposure answers never trigger it.
6. Selections change the mapping, the obligation flags and the wording, never the score.

| Worked case | Exposure | Controls | Overall | Final band |
|---|---|---|---|---|
| NHS trust digital team, mid-level controls | 30/39 = 77 | 30/45 = 67 | 72 | High |
| Same trust, mature controls | 77 | 0 | 38 | Medium |
| Same trust, no inventory and no monitoring | 77 | 36/45 = 80 | 78 | Critical |
| Maximum exposure, perfect controls | 100 | 0 | 50 | Medium (cap) |
| Nothing at stake, no controls | 0 | 100 | 50 | Medium (carve-out; override not applied) |
| Moderate exposure, one absent control | 33 | 20 | 27 | High (override floor) |
| Moderate exposure, two absent controls | 33 | 40 | 37 | Critical (override) |

## Accessibility (WCAG 2.2 AA)

The page is designed to meet WCAG 2.2 level AA so public-sector users can rely on it. What that means in the build:

- **Structure.** One `h1`, numbered `h2` sections, `h3` per question; `header`, `main`, `aside` (the live risk profile) and `footer` landmarks; a skip link to the assessment; `lang="en-GB"` on the document.
- **Forms.** Every question is a `fieldset` whose `legend` is the question; answers are native radio buttons with visible labels, so keyboard navigation (Tab to the group, arrow keys within it), screen-reader semantics and form-value restoration come from the browser. Framework and regulation choices are native checkboxes styled as chips. The organisation field has a visible label and `autocomplete="organization"`.
- **Colour and contrast.** Every text token is at least 4.5:1 on the surface it sits on (small grey labels were darkened from 3.5:1 to 5.7:1); form-control borders and the four status colours are at least 3:1 against white and against the dark surface. Risk level is never colour alone: each answer, band, gap and obligation status carries its label as text. Brand blue (#2883F8) is kept for the wordmark and tints; filled buttons use the brand's deeper blue (#073AC9, 8.5:1 with white).
- **Focus.** A 3px high-contrast focus ring on every control, including the custom-styled radios and chips. `scroll-padding-bottom` keeps a focused control clear of the fixed status bar on small screens (2.4.11 Focus Not Obscured). Opening the report moves focus to its heading; returning moves it back to the profile.
- **Targets.** Every interactive element is at least 24 × 24 CSS px (2.5.8 Target Size); most are 36–48px.
- **Status messages.** The live score is announced through a polite `role="status"` region that reads "Score 72 of 100, High. 9 of 12 answered" rather than re-reading the whole panel. The DTAC suggestion is a status message too.
- **Reflow and spacing.** The layout stacks to one column at narrow widths with no horizontal scrolling; no text container has a fixed height or clips with ellipsis, so text spacing and 200% zoom work.
- **Motion.** Transitions are disabled under `prefers-reduced-motion`.
- **Themes.** Light and dark palettes are both designed and contrast-checked; `color-scheme` makes native controls follow.
- **No dragging, no time limits, no flashing content, no audio.**
- **Redundant entry.** Answers and selections persist in the visitor's own browser (`localStorage`), so a reload or a return visit does not ask for them again. Nothing is transmitted.

Known limits of this draft: the report's "Save as PDF" relies on the browser's print dialog (the same approach as the AI Governance Risk Assessment tool); the Claude preview sandbox cannot open that dialog, so the button appears only on the live site. The status-colour ramp (teal, amber, orange, crimson) has weak separation between amber and orange for deuteranopia, which is why every band is also labelled and the score is always shown as a number. A manual screen-reader pass (NVDA and VoiceOver) is recommended at D4 before public-sector use; an automated axe check is a good addition to the review.

## What changed in draft 2 (20 October 2026)

- Mapping and "How Meterian helps" lines updated from Meterian's SSCoP document: Theme 2 (build environment) added to C2 and as an obligation flag; Theme 4 and principles 3.1/3.2 noted as handled through the JSON feed to partner tools; BOSS's automated reporting against 3.4; BOSSC added to continuous monitoring.
- Hero copy rewritten; step 1 renamed "Choose your frameworks and regulations".
- Full framework names on first use (hero, setup, profile, report, footer) with short names after.
- Framework alignment tables removed from the prospect view (the data stays in `scoring.js` for a future administrator view of submissions). Clause references were also removed from the question cards for the same reason.
- Report view with executive summary, obligations, gaps with Meterian capability lines, next steps, answers, methodology and disclaimer; print-ready with Save as PDF.
- WCAG 2.2 AA pass as described above.
