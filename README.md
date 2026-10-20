# Meterian Regulatory Readiness Check

A free, non-invasive self-assessment of software supply-chain risk against ISO/IEC 27001, ISO/IEC 42001, the NCSC Cyber Assessment Framework (CAF) v4.0 (with an NHS DTAC overlay), the EU Cyber Resilience Act (CRA) and the UK Software Security Code of Practice (SSCoP). Built for Meterian under SoW PWMTR-001 as a sales-enablement and market-education asset. It is not a legal, regulatory, audit or certification assessment.

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


