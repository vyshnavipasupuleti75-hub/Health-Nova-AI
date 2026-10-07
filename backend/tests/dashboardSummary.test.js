// Dashboard summary: report count, latest report, health-score source and unsaved analyses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardSummary } from '../services/dashboardSummary.js';

const report = (id, savedAt, analysis = {}, extra = {}) => ({ _id: id, originalName: `${id}.pdf`, status: 'saved', savedAt: new Date(savedAt), createdAt: new Date(savedAt), analysis: { engineVersion: '2.0.0', ...analysis }, ...extra });

test('no reports -> zero count, no latest, no score', () => {
  assert.deepEqual(buildDashboardSummary({ saved: [] }), { savedCount: 0, latest: null, healthScore: null, latestDraft: null });
});

test('count and latest come from the saved reports, newest first', () => {
  const s = buildDashboardSummary({ saved: [report('a', '2026-09-01', { score: 50 }), report('c', '2026-09-20', { score: 90 }), report('b', '2026-09-10', { score: 70 })] });
  assert.equal(s.savedCount, 3);
  assert.equal(s.latest._id, 'c');
  assert.equal(s.latest.date, '2026-09-20T00:00:00.000Z');
});

test('health score is the newest saved report score and changes with the data', () => {
  const older = report('old', '2026-09-01', { score: 40 });
  assert.equal(buildDashboardSummary({ saved: [older] }).healthScore.value, 40);
  const s = buildDashboardSummary({ saved: [older, report('new', '2026-09-05', { score: 100 })] });
  assert.equal(s.healthScore.value, 100);
  assert.equal(s.healthScore.basedOn._id, 'new');
});

test('is deterministic for the same data', () => {
  const data = { saved: [report('x', '2026-09-01', { score: 67, measurements: [{ status: 'normal' }, { status: 'high' }, { status: 'normal' }, { status: 'info' }] })] };
  assert.deepEqual(buildDashboardSummary(data), buildDashboardSummary(data));
  assert.equal(buildDashboardSummary(data).latest.valuesChecked, 3);
});

test('old demo reports (fixed example score) never produce a health score', () => {
  const demo = report('demo', '2026-09-01', { score: 82 });
  delete demo.analysis.engineVersion;
  const s = buildDashboardSummary({ saved: [demo] });
  assert.equal(s.savedCount, 1);
  assert.equal(s.healthScore, null);
  assert.equal(s.latest.legacy, true);
});

test('a report with too little data (score null) falls back to the previous real score, or none', () => {
  assert.equal(buildDashboardSummary({ saved: [report('empty', '2026-09-02', { score: null })] }).healthScore, null);
  const s = buildDashboardSummary({ saved: [report('real', '2026-09-01', { score: 75 }), report('empty', '2026-09-02', { score: null })] });
  assert.equal(s.latest._id, 'empty');
  assert.equal(s.healthScore.value, 75);
});

test('an unsaved analysis is reported separately and never counted as saved', () => {
  const draft = report('draft', '2026-09-30', { score: 10 }, { status: 'draft', savedAt: undefined });
  const s = buildDashboardSummary({ saved: [], latestDraft: draft });
  assert.equal(s.savedCount, 0);
  assert.equal(s.healthScore, null);
  assert.equal(s.latestDraft._id, 'draft');
  assert.equal(s.latestDraft.status, 'draft');
  // a draft older than the latest saved report is not surfaced
  assert.equal(buildDashboardSummary({ saved: [report('saved', '2026-10-01', { score: 80 })], latestDraft: draft }).latestDraft, null);
});
