/* Unit tests for the scoring engine. Run: node --test test/
   Every case here is one you can reproduce by hand from the D1 note. */

const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../src/model.js");
const S = require("../src/scoring.js");

// Helper: build answers from two arrays in dimension order (E1..E6, C1..C6)
const E_IDS = M.DIMENSIONS.filter((d) => d.group === "exposure").map((d) => d.id);
const C_IDS = M.DIMENSIONS.filter((d) => d.group === "controls").map((d) => d.id);
function answers(exposure, controls) {
  const a = {};
  (exposure || []).forEach((p, i) => { if (p != null) a[E_IDS[i]] = p; });
  (controls || []).forEach((p, i) => { if (p != null) a[C_IDS[i]] = p; });
  return a;
}
const ALL = { frameworks: ["iso27001", "iso42001", "caf"], regulations: ["cra", "sscop"], overlays: ["dtac"] };
const NONE = { frameworks: [], regulations: [], overlays: [] };

/* ----------------------------------------------------------------------
   Model integrity
---------------------------------------------------------------------- */
test("model: 6 exposure + 6 controls, weight totals 13 and 15", () => {
  assert.equal(E_IDS.length, 6);
  assert.equal(C_IDS.length, 6);
  const sum = (g) => M.DIMENSIONS.filter((d) => d.group === g).reduce((s, d) => s + d.weight, 0);
  assert.equal(sum("exposure"), 13);
  assert.equal(sum("controls"), 15);
});

test("model: every dimension has exactly four options scoring 0,1,2,3", () => {
  for (const d of M.DIMENSIONS) {
    assert.deepEqual(d.options.map((o) => o.points).sort(), [0, 1, 2, 3], d.id);
  }
});

test("model: every dimension maps to all five selectable frameworks (harmonisation rule)", () => {
  for (const d of M.DIMENSIONS) {
    for (const f of ["iso27001", "iso42001", "caf", "cra", "sscop"]) {
      assert.ok(typeof d.mapping[f] === "string" && d.mapping[f].length > 0, `${d.id} missing ${f}`);
    }
  }
});

test("model: every control has remediation text and a Meterian line; every exposure has an implication", () => {
  for (const d of M.DIMENSIONS) {
    if (d.group === "controls") {
      assert.ok(d.remediation && d.meterian && d.meterian.summary, d.id);
      for (const p of d.meterian.products) assert.ok(M.PRODUCTS[p], `${d.id} unknown product ${p}`);
    } else {
      assert.ok(d.implication, d.id);
      assert.equal(d.meterian, null, d.id);
    }
  }
});

test("model: obligation flags reference real dimensions and selections", () => {
  const ids = new Set(M.DIMENSIONS.map((d) => d.id));
  const sel = new Set([].concat(Object.keys(M.FRAMEWORKS), Object.keys(M.OVERLAYS)));
  for (const f of M.OBLIGATION_FLAGS) {
    for (const r of f.requires) assert.ok(sel.has(r), `${f.id} requires ${r}`);
    for (const c of f.when) assert.ok(ids.has(c.dimension), `${f.id} when ${c.dimension}`);
    for (const x of f.crossRef) assert.ok(ids.has(x), `${f.id} crossRef ${x}`);
  }
});

/* ----------------------------------------------------------------------
   Band boundaries
---------------------------------------------------------------------- */
test("bands: boundaries at 25/26, 50/51, 75/76", () => {
  const b = (s) => S.bandForScore(s).id;
  assert.equal(b(0), "low"); assert.equal(b(25), "low");
  assert.equal(b(26), "medium"); assert.equal(b(50), "medium");
  assert.equal(b(51), "high"); assert.equal(b(75), "high");
  assert.equal(b(76), "critical"); assert.equal(b(100), "critical");
});

/* ----------------------------------------------------------------------
   Worked examples from the D1 note (section 7)
---------------------------------------------------------------------- */
test("worked example: NHS trust, mid-level controls -> 77 / 67 / 72 High, no override", () => {
  const r = S.computeResults(answers([2, 3, 2, 2, 2, 3], [2, 2, 2, 2, 2, 2]), ALL);
  assert.equal(r.exposure.raw, 30); assert.equal(r.exposure.max, 39); assert.equal(r.exposure.score, 77);
  assert.equal(r.controls.raw, 30); assert.equal(r.controls.max, 45); assert.equal(r.controls.score, 67);
  assert.equal(r.overall, 72);
  assert.equal(r.finalBand.id, "high");
  assert.equal(r.override.applied, false);
  assert.equal(r.complete, true);
});

test("worked example: same trust, mature controls -> 38 Medium", () => {
  const r = S.computeResults(answers([2, 3, 2, 2, 2, 3], [0, 0, 0, 0, 0, 0]), ALL);
  assert.equal(r.controls.score, 0);
  assert.equal(r.overall, 38);
  assert.equal(r.finalBand.id, "medium");
  assert.equal(r.gaps.filter((g) => g.group === "controls").length, 0);
});

test("worked example: same trust, no inventory and no monitoring -> 80 controls, 78 Critical, override also says Critical", () => {
  const r = S.computeResults(answers([2, 3, 2, 2, 2, 3], [3, 2, 3, 2, 2, 2]), ALL);
  assert.equal(r.controls.raw, 36); assert.equal(r.controls.score, 80);
  assert.equal(r.overall, 78);
  assert.equal(r.baseBand.id, "critical");
  assert.equal(r.finalBand.id, "critical");
  assert.equal(r.override.tripwires.length, 2);
  assert.equal(r.override.applied, false, "already Critical by the average; override has nothing to raise");
});

/* ----------------------------------------------------------------------
   Structural properties of the model
---------------------------------------------------------------------- */
test("property: perfect controls cap the rating at Medium however exposed", () => {
  const r = S.computeResults(answers([3, 3, 3, 3, 3, 3], [0, 0, 0, 0, 0, 0]), ALL);
  assert.equal(r.exposure.score, 100);
  assert.equal(r.overall, 50);
  assert.equal(r.finalBand.id, "medium");
});

test("property: absent controls with nothing at stake -> Medium, override NOT applied (Low-exposure carve-out)", () => {
  const r = S.computeResults(answers([0, 0, 0, 0, 0, 0], [3, 3, 3, 3, 3, 3]), ALL);
  assert.equal(r.exposure.score, 0);
  assert.equal(r.overall, 50);
  assert.equal(r.baseBand.id, "medium");
  assert.equal(r.finalBand.id, "medium");
  assert.equal(r.override.eligible, false);
  assert.equal(r.override.applied, false);
  assert.equal(r.override.tripwires.length, 6);
  assert.match(r.override.note, /not applied/);
});

test("override: one absent control floors a Medium result at High when exposure >= 26", () => {
  const r = S.computeResults(answers([1, 1, 1, 1, 1, 1], [3, 0, 0, 0, 0, 0]), ALL);
  assert.equal(r.exposure.score, 33);
  assert.equal(r.controls.score, 20);
  assert.equal(r.overall, 27);
  assert.equal(r.baseBand.id, "medium");
  assert.equal(r.finalBand.id, "high");
  assert.equal(r.override.applied, true);
  assert.match(r.override.note, /C1/);
});

test("override: two absent controls force Critical from a Medium average", () => {
  const r = S.computeResults(answers([1, 1, 1, 1, 1, 1], [3, 0, 3, 0, 0, 0]), ALL);
  assert.equal(r.controls.score, 40);
  assert.equal(r.overall, 37);
  assert.equal(r.baseBand.id, "medium");
  assert.equal(r.finalBand.id, "critical");
  assert.equal(r.override.applied, true);
});

test("override: exposure answers at 3 never trigger it on their own", () => {
  const r = S.computeResults(answers([3, 3, 3, 3, 3, 3], [2, 2, 2, 2, 2, 2]), ALL);
  assert.equal(r.override.tripwires.length, 0);
  assert.equal(r.override.applied, false);
  assert.equal(r.overall, 83);
  assert.equal(r.finalBand.id, "critical");
});

test("override: exposure exactly at the carve-out boundary (26) is eligible; 25 is not", () => {
  // Exposure 26: raw 10/39 = 25.6 -> rounds to 26
  const eligible = S.computeResults({ reg_scope: 2, consequence: 1, oss_reliance: 0, ai_dev: 0, deploy_surface: 0, sector: 1, ...answers([], [3, 0, 0, 0, 0, 0]) }, ALL);
  assert.equal(eligible.exposure.score, 26);
  assert.equal(eligible.override.eligible, true);
  // Exposure 23: raw 9/39 = 23.1
  const notEligible = S.computeResults({ reg_scope: 2, consequence: 1, oss_reliance: 0, ai_dev: 0, deploy_surface: 0, sector: 0, ...answers([], [3, 0, 0, 0, 0, 0]) }, ALL);
  assert.equal(notEligible.exposure.score, 23);
  assert.equal(notEligible.override.eligible, false);
});

/* ----------------------------------------------------------------------
   Selections never change the score
---------------------------------------------------------------------- */
test("selections change mapping and flags, never the score or band", () => {
  const a = answers([2, 3, 2, 2, 2, 3], [3, 2, 2, 2, 2, 2]);
  const r1 = S.computeResults(a, ALL);
  const r2 = S.computeResults(a, NONE);
  const r3 = S.computeResults(a, { frameworks: ["caf"], regulations: ["cra"], overlays: [] });
  for (const r of [r2, r3]) {
    assert.equal(r.overall, r1.overall);
    assert.equal(r.finalBand.id, r1.finalBand.id);
    assert.equal(r.exposure.score, r1.exposure.score);
    assert.equal(r.controls.score, r1.controls.score);
  }
  assert.equal(r2.flags.length, 0);
  assert.equal(r2.alignment.length, 0);
  assert.ok(r1.flags.length > r3.flags.length);
});

/* ----------------------------------------------------------------------
   Partial answers (live panel)
---------------------------------------------------------------------- */
test("partial: no overall until both sections have an answer; sections score over answered dims only", () => {
  const r0 = S.computeResults({}, ALL);
  assert.equal(r0.overall, null); assert.equal(r0.finalBand, null);
  const r1 = S.computeResults({ reg_scope: 3 }, ALL);
  assert.equal(r1.exposure.score, 100); assert.equal(r1.overall, null);
  const r2 = S.computeResults({ reg_scope: 3, inventory: 0 }, ALL);
  assert.equal(r2.overall, 50); assert.equal(r2.complete, false);
});

/* ----------------------------------------------------------------------
   Gaps and flags
---------------------------------------------------------------------- */
test("gaps: controls first, ordered by points x weight, then exposure", () => {
  const r = S.computeResults(answers([2, 3, 1, 2, 1, 3], [1, 2, 3, 2, 3, 1]), ALL);
  const codes = r.gaps.map((g) => g.code);
  // controls: C3 (3x3=9), C5 (3x2=6), C2 (2x2=4), C4 (2x3=6) -> C3, C4, C5, C2
  assert.deepEqual(codes.slice(0, 4), ["C3", "C4", "C5", "C2"]);
  // exposure: E2 (3x3=9), E1 (2x3=6), E4 (2x2=4), E6 (3x1=3)
  assert.deepEqual(codes.slice(4), ["E2", "E1", "E4", "E6"]);
  assert.equal(r.gaps[0].meterian.products[0], "sentinel");
  assert.equal(r.gaps[4].meterian, null);
});

test("flags: CRA flags appear only when CRA selected and reg_scope >= 2, and report the cross-referenced control status", () => {
  const a = answers([3, 3, 2, 2, 2, 3], [3, 2, 2, 2, 1, 2]);
  const r = S.computeResults(a, { frameworks: [], regulations: ["cra"], overlays: [] });
  const ids = r.flags.map((f) => f.id);
  assert.ok(ids.includes("cra_reporting") && ids.includes("cra_sbom") && ids.includes("cra_docs"));
  const sbom = r.flags.find((f) => f.id === "cra_sbom");
  assert.equal(sbom.status[0].code, "C1");
  assert.equal(sbom.status[0].points, 3);
  assert.equal(sbom.hasGap, true);
  const rep = r.flags.find((f) => f.id === "cra_reporting");
  assert.equal(rep.status.find((s) => s.code === "C5").points, 1);
  // internal-only organisation: CRA flags do not fire
  const internal = S.computeResults(answers([0, 3, 2, 2, 2, 3], [3, 2, 2, 2, 1, 2]), { frameworks: [], regulations: ["cra"], overlays: [] });
  assert.equal(internal.flags.filter((f) => f.id.startsWith("cra_")).length, 0);
});

test("flags: ISO 27001 flag fires on selection alone; ISO 42001 tooling flag needs ai_dev >= 1", () => {
  const sel = { frameworks: ["iso27001", "iso42001"], regulations: [], overlays: [] };
  const noAI = S.computeResults(answers([1, 1, 1, 0, 1, 1], [1, 1, 1, 1, 1, 1]), sel);
  assert.ok(noAI.flags.some((f) => f.id === "iso27001_2022"));
  assert.ok(!noAI.flags.some((f) => f.id === "iso42001_tooling"));
  const withAI = S.computeResults(answers([1, 1, 1, 2, 1, 1], [1, 1, 1, 1, 1, 1]), sel);
  assert.ok(withAI.flags.some((f) => f.id === "iso42001_tooling"));
});

test("overlays: DTAC suggested when CAF selected and sector = 3, not once selected", () => {
  const a = answers([2, 2, 2, 2, 2, 3], [2, 2, 2, 2, 2, 2]);
  assert.deepEqual(S.computeResults(a, { frameworks: ["caf"], regulations: [], overlays: [] }).suggestedOverlays, ["dtac"]);
  assert.deepEqual(S.computeResults(a, { frameworks: ["caf"], regulations: [], overlays: ["dtac"] }).suggestedOverlays, []);
  assert.deepEqual(S.computeResults(a, { frameworks: ["iso27001"], regulations: [], overlays: [] }).suggestedOverlays, []);
});

test("alignment: one block per selected framework/regulation/overlay, twelve rows each", () => {
  const r = S.computeResults(answers([1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1]), ALL);
  assert.equal(r.alignment.length, 6);
  for (const block of r.alignment) assert.equal(block.rows.length, 12);
  const dtac = r.alignment.find((b) => b.id === "dtac");
  assert.ok(dtac.rows.some((row) => row.clause === null), "DTAC overlay may leave rows blank");
});

test("hubspot: flat string payload", () => {
  const r = S.computeResults(answers([2, 3, 2, 2, 2, 3], [2, 2, 2, 2, 2, 2]), ALL);
  const h = S.hubspotFields(r);
  assert.equal(h.rmlc_score, "72");
  assert.equal(h.rmlc_band, "High");
  assert.equal(h.rmlc_sector, "public_sector_health");
  assert.equal(h.rmlc_frameworks, "iso27001;iso42001;caf");
  assert.equal(h.rmlc_top_gaps, "C1;C3;C4");
  for (const v of Object.values(h)) assert.equal(typeof v, "string");
});
