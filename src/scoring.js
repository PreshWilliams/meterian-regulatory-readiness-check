/* ============================================================================
   Regulatory Mapping Lead Capture Tool — SCORING ENGINE
   SoW PWMTR-001 · D1 v0.1 (18 Oct 2026)

   Pure functions over the data model. No DOM, no state. Every number the
   interface shows comes from computeResults(answers, selections).

   answers:    { [dimensionId]: points (0-3) }   - unanswered keys absent
   selections: { frameworks: [ids], regulations: [ids], overlays: [ids] }

   Runs unchanged in the browser (window.RMLC_SCORING) and in Node.
============================================================================ */

const RMLC_SCORING = (function (MODEL) {
  "use strict";

  const M = MODEL;

  /* ---------------------------------------------------------------------
     Helpers
  --------------------------------------------------------------------- */
  function bandForScore(score) {
    if (score == null) return null;
    for (const b of M.BANDS) if (score >= b.min && score <= b.max) return b;
    return score < 0 ? M.BANDS[0] : M.BANDS[M.BANDS.length - 1];
  }
  function bandById(id) { return M.BANDS.find((b) => b.id === id) || null; }
  function rank(id) { const b = bandById(id); return b ? b.rank : -1; }
  function dimsIn(group) { return M.DIMENSIONS.filter((d) => d.group === group); }
  function dimById(id) { return M.DIMENSIONS.find((d) => d.id === id) || null; }
  function levelFor(points) { return points == null ? null : M.LEVELS[points]; }
  function optionFor(dim, points) { return dim.options.find((o) => o.points === points) || null; }

  function allSelected(selections) {
    const s = selections || {};
    return [].concat(s.frameworks || [], s.regulations || [], s.overlays || []);
  }

  /* ---------------------------------------------------------------------
     Section statistics
     raw   = sum(points x weight) over answered dimensions
     max   = 3 x sum(weight) over answered dimensions
     ratio = raw / max  (0..1)
     score = round(ratio x 100)
  --------------------------------------------------------------------- */
  function sectionStats(group, answers) {
    const dims = dimsIn(group);
    const answered = dims.filter((d) => answers[d.id] != null);
    const raw = answered.reduce((s, d) => s + answers[d.id] * d.weight, 0);
    const max = answered.reduce((s, d) => s + M.MAX_POINTS * d.weight, 0);
    const ratio = max > 0 ? raw / max : null;
    return {
      group, raw, max, ratio,
      score: ratio == null ? null : Math.round(ratio * 100),
      count: answered.length, total: dims.length,
      weightTotal: dims.reduce((s, d) => s + d.weight, 0),
      maxPossible: dims.reduce((s, d) => s + M.MAX_POINTS * d.weight, 0),
    };
  }

  /* ---------------------------------------------------------------------
     Override
  --------------------------------------------------------------------- */
  function applyOverride(baseBandId, exposureScore, answers) {
    const O = M.OVERRIDE;
    const tripwires = dimsIn(O.group).filter((d) => answers[d.id] === O.tripwirePoints && d.contextual !== true);
    let finalBandId = baseBandId;
    let note = null;
    let applied = false;
    const eligible = baseBandId != null && exposureScore != null && exposureScore >= O.minExposureScore;

    if (eligible && tripwires.length >= 2 && rank(baseBandId) < rank(O.multiForce)) {
      finalBandId = O.multiForce; applied = true;
      note = `${tripwires.length} controls are absent (${tripwires.map((d) => d.code).join(", ")}), so the rating is raised to ${bandById(O.multiForce).label}. The weighted average alone would read ${bandById(baseBandId).label}.`;
    } else if (eligible && tripwires.length === 1 && rank(baseBandId) < rank(O.singleFloor)) {
      finalBandId = O.singleFloor; applied = true;
      note = `One foundational control is absent (${tripwires[0].code} ${tripwires[0].name}), so the rating is floored at ${bandById(O.singleFloor).label}. The weighted average alone would read ${bandById(baseBandId).label}.`;
    } else if (!eligible && tripwires.length > 0 && baseBandId != null) {
      note = `${tripwires.length === 1 ? "One control is" : tripwires.length + " controls are"} absent, but Exposure is in the Low band, so the override is not applied: record the gap rather than escalate it.`;
    }
    return { tripwires, applied, finalBandId, note, eligible };
  }

  /* ---------------------------------------------------------------------
     Prioritised gaps: dimensions answered at 2 or 3 points, Controls first
     (actionable), each list ordered by points x weight, then by weight.
  --------------------------------------------------------------------- */
  function prioritisedGaps(answers) {
    const impact = (d) => answers[d.id] * d.weight;
    const pick = (group) => dimsIn(group)
      .filter((d) => answers[d.id] != null && answers[d.id] >= 2)
      .sort((a, b) => impact(b) - impact(a) || b.weight - a.weight || a.code.localeCompare(b.code))
      .map((d) => ({
        id: d.id, code: d.code, group: d.group, name: d.name,
        points: answers[d.id], weight: d.weight, impact: impact(d),
        level: levelFor(answers[d.id]),
        answer: optionFor(d, answers[d.id]) ? optionFor(d, answers[d.id]).label : null,
        action: d.group === "controls" ? d.remediation : d.implication,
        meterian: d.meterian || null,
        mapping: d.mapping,
      }));
    return pick("controls").concat(pick("exposure"));
  }

  /* ---------------------------------------------------------------------
     Obligation flags: triggered by Exposure answers + selections, reported
     against the referenced Controls answers.
  --------------------------------------------------------------------- */
  function obligationFlags(answers, selections) {
    const sel = allSelected(selections);
    return M.OBLIGATION_FLAGS
      .filter((f) => f.requires.some((r) => sel.includes(r)))
      .filter((f) => f.when.every((c) => answers[c.dimension] != null && answers[c.dimension] >= c.minPoints))
      .map((f) => ({
        id: f.id, title: f.title, text: f.text, date: f.date,
        status: f.crossRef.map((id) => {
          const d = dimById(id);
          const p = answers[id];
          return { id, code: d.code, name: d.name, points: p == null ? null : p, level: levelFor(p), gap: p != null && p >= 2 };
        }),
        hasGap: f.crossRef.some((id) => answers[id] != null && answers[id] >= 2),
      }));
  }

  /* ---------------------------------------------------------------------
     Framework alignment rows for the report (selected frameworks only)
  --------------------------------------------------------------------- */
  function alignment(selections) {
    const sel = allSelected(selections);
    const ids = [].concat(M.FRAMEWORK_ORDER, M.REGULATION_ORDER, Object.keys(M.OVERLAYS)).filter((id) => sel.includes(id));
    return ids.map((fid) => ({
      id: fid,
      label: (M.FRAMEWORKS[fid] || M.OVERLAYS[fid]).full,
      rows: M.DIMENSIONS.map((d) => ({ code: d.code, name: d.name, group: d.group, clause: d.mapping[fid] || null })),
    }));
  }

  /* ---------------------------------------------------------------------
     Suggested overlays (e.g. DTAC when sector = public sector / health)
  --------------------------------------------------------------------- */
  function suggestedOverlays(answers, selections) {
    const sel = allSelected(selections);
    return Object.keys(M.OVERLAYS).filter((oid) => {
      const o = M.OVERLAYS[oid];
      if (sel.includes(oid)) return false;
      if (!sel.includes(o.parent)) return false;
      const w = o.suggestWhen;
      return answers[w.dimension] != null && answers[w.dimension] >= w.minPoints;
    });
  }

  /* ---------------------------------------------------------------------
     Main entry point
  --------------------------------------------------------------------- */
  function computeResults(answers, selections) {
    answers = answers || {};
    selections = selections || {};
    const exposure = sectionStats("exposure", answers);
    const controls = sectionStats("controls", answers);
    const complete = exposure.count === exposure.total && controls.count === controls.total;

    // Overall = mean of the two section ratios, rounded once. Both sections
    // must have at least one answer before an overall is shown.
    let overall = null;
    if (exposure.ratio != null && controls.ratio != null) {
      overall = Math.round(((exposure.ratio + controls.ratio) / 2) * 100);
    }
    const baseBand = bandForScore(overall);
    const override = applyOverride(baseBand ? baseBand.id : null, exposure.score, answers);
    const finalBand = override.finalBandId ? bandById(override.finalBandId) : null;

    return {
      version: M.VERSION,
      answers: { ...answers },
      selections: {
        frameworks: (selections.frameworks || []).slice(),
        regulations: (selections.regulations || []).slice(),
        overlays: (selections.overlays || []).slice(),
      },
      exposure, controls, overall, complete,
      baseBand, finalBand,
      override: {
        applied: override.applied,
        eligible: override.eligible,
        note: override.note,
        tripwires: override.tripwires.map((d) => ({ id: d.id, code: d.code, name: d.name })),
      },
      gaps: prioritisedGaps(answers),
      flags: obligationFlags(answers, selections),
      alignment: alignment(selections),
      suggestedOverlays: suggestedOverlays(answers, selections),
      sector: (function () {
        const d = dimById("sector"); const o = optionFor(d, answers.sector);
        return o ? { points: o.points, label: o.label, segment: o.segment } : null;
      })(),
    };
  }

  /* ---------------------------------------------------------------------
     Hidden-field payload for the HubSpot form (D3). Flat strings only.
  --------------------------------------------------------------------- */
  function hubspotFields(results) {
    const r = results;
    return {
      rmlc_version: r.version,
      rmlc_score: r.overall == null ? "" : String(r.overall),
      rmlc_band: r.finalBand ? r.finalBand.label : "",
      rmlc_exposure_score: r.exposure.score == null ? "" : String(r.exposure.score),
      rmlc_controls_score: r.controls.score == null ? "" : String(r.controls.score),
      rmlc_override: r.override.applied ? "yes" : "no",
      rmlc_sector: r.sector ? r.sector.segment : "",
      rmlc_frameworks: r.selections.frameworks.join(";"),
      rmlc_regulations: r.selections.regulations.join(";"),
      rmlc_overlays: r.selections.overlays.join(";"),
      rmlc_top_gaps: r.gaps.slice(0, 3).map((g) => g.code).join(";"),
      rmlc_answers: M.DIMENSIONS.map((d) => `${d.code}=${r.answers[d.id] == null ? "-" : r.answers[d.id]}`).join(";"),
    };
  }

  return {
    computeResults, sectionStats, bandForScore, bandById, prioritisedGaps,
    obligationFlags, alignment, suggestedOverlays, hubspotFields, levelFor, dimById,
  };
})(typeof RMLC_MODEL !== "undefined" ? RMLC_MODEL : require("./model.js"));

if (typeof module !== "undefined" && module.exports) module.exports = RMLC_SCORING;
if (typeof window !== "undefined") window.RMLC_SCORING = RMLC_SCORING;
