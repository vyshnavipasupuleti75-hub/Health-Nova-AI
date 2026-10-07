// Builds the Dashboard numbers from the user's stored reports. Pure function (no DB access) so it is testable.
//
// - savedCount:   reports the user saved (same set Report History shows)
// - latest:       newest saved report
// - healthScore:  the existing per-report score ("% of interpretable values within their reference range",
//                 computed by reportAnalysis.js) taken from the newest saved report analysed by the current
//                 engine. Reports from the old demo version carried a fixed example score and are ignored.
//                 null when no saved report has enough values -> the UI shows "Not enough data".
// - latestDraft:  newest analysis that was uploaded but not saved yet (only if newer than the latest saved one)

const when = (report) => new Date(report.savedAt || report.createdAt).getTime();

function brief(report) {
  if (!report) return null;
  const a = report.analysis || {};
  return {
    _id: String(report._id),
    originalName: report.originalName,
    date: new Date(report.savedAt || report.createdAt).toISOString(),
    status: report.status || 'saved',
    prediction: a.prediction || null,
    riskLevel: a.riskLevel || null,
    score: typeof a.score === 'number' ? a.score : null,
    valuesChecked: Array.isArray(a.measurements) ? a.measurements.filter((m) => ['normal', 'high', 'low', 'abnormal'].includes(m.status)).length : null,
    legacy: !a.engineVersion,
  };
}

export function buildDashboardSummary({ saved = [], latestDraft = null }) {
  const ordered = [...saved].sort((a, b) => when(b) - when(a));
  const latest = ordered[0] || null;
  const scored = ordered.find((r) => r.analysis?.engineVersion && typeof r.analysis.score === 'number');
  const draftIsNewer = latestDraft && (!latest || when(latestDraft) > when(latest));
  return {
    savedCount: ordered.length,
    latest: brief(latest),
    healthScore: scored ? { value: scored.analysis.score, basedOn: brief(scored) } : null,
    latestDraft: draftIsNewer ? brief(latestDraft) : null,
  };
}
