/* Prints the worked cases from the D1 note so the arithmetic can be checked
   by hand. Run: node examples/worked-cases.js */

const M = require("../src/model.js");
const S = require("../src/scoring.js");

const E = M.DIMENSIONS.filter((d) => d.group === "exposure");
const C = M.DIMENSIONS.filter((d) => d.group === "controls");
const build = (e, c) => {
  const a = {};
  E.forEach((d, i) => { a[d.id] = e[i]; });
  C.forEach((d, i) => { a[d.id] = c[i]; });
  return a;
};
const ALL = { frameworks: ["iso27001", "iso42001", "caf"], regulations: ["cra", "sscop"], overlays: ["dtac"] };

const CASES = [
  ["NHS trust digital team, mid-level controls", [2, 3, 2, 2, 2, 3], [2, 2, 2, 2, 2, 2]],
  ["Same trust, mature controls", [2, 3, 2, 2, 2, 3], [0, 0, 0, 0, 0, 0]],
  ["Same trust, no inventory and no monitoring", [2, 3, 2, 2, 2, 3], [3, 2, 3, 2, 2, 2]],
  ["Fintech SaaS vendor, EU market, advisory scans only", [3, 3, 3, 2, 3, 2], [1, 2, 1, 1, 2, 1]],
  ["Retail SaaS, mostly in-house code, no process at all", [1, 2, 1, 1, 1, 1], [3, 3, 3, 3, 3, 3]],
  ["Maximum exposure, perfect controls (cap at Medium)", [3, 3, 3, 3, 3, 3], [0, 0, 0, 0, 0, 0]],
  ["Nothing at stake, no controls (carve-out)", [0, 0, 0, 0, 0, 0], [3, 3, 3, 3, 3, 3]],
  ["Moderate exposure, one absent control (floor at High)", [1, 1, 1, 1, 1, 1], [3, 0, 0, 0, 0, 0]],
  ["Moderate exposure, two absent controls (force Critical)", [1, 1, 1, 1, 1, 1], [3, 0, 3, 0, 0, 0]],
];

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nRegulatory Mapping Lead Capture Tool — scoring engine v${M.VERSION}\n`);
console.log(pad("Case", 58) + pad("Exp", 10) + pad("Ctl", 10) + pad("Overall", 9) + pad("Average", 10) + pad("Final", 10) + "Override");
console.log("-".repeat(118));
for (const [label, e, c] of CASES) {
  const r = S.computeResults(build(e, c), ALL);
  console.log(
    pad(label, 58) +
    pad(`${r.exposure.raw}/${r.exposure.max}=${r.exposure.score}`, 10) +
    pad(`${r.controls.raw}/${r.controls.max}=${r.controls.score}`, 10) +
    pad(r.overall, 9) +
    pad(r.baseBand.label, 10) +
    pad(r.finalBand.label, 10) +
    (r.override.applied ? `yes (${r.override.tripwires.map((t) => t.code).join(",")})`
      : !r.override.tripwires.length ? "no"
      : r.override.eligible ? `no (${r.override.tripwires.length} absent, already ${r.baseBand.label})`
      : `no (${r.override.tripwires.length} absent, exposure Low)`)
  );
}

// One full result, pretty-printed, for the first case
const r = S.computeResults(build(CASES[0][1], CASES[0][2]), ALL);
console.log("\n--- Prioritised gaps (case 1) ---");
for (const g of r.gaps) console.log(`${g.code} ${pad(g.name, 46)} ${g.level.label.padEnd(9)} impact ${g.impact}`);
console.log("\n--- Obligation flags (case 1, all frameworks selected) ---");
for (const f of r.flags) console.log(`${pad(f.id, 20)} ${f.title}  [${f.status.map((s) => `${s.code}:${s.level ? s.level.label : "-"}`).join(" ")}]`);
console.log("\n--- HubSpot hidden fields (case 1) ---");
console.log(S.hubspotFields(r));
console.log();
