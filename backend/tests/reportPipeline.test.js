// End-to-end tests of the report pipeline: PDF bytes -> extraction -> parsing -> rules -> analysis.
// Gemini is disabled here so the results are deterministic; the AI prompt builder and the
// AI-output safety validator are tested separately below.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePdf } from './helpers/makePdf.js';
import { analyzeReport, INSUFFICIENT_MESSAGE, NORMAL_MESSAGE } from '../services/reportAnalysis.js';
import { buildReportPrompt, validateAIExplanation } from '../services/reportAI.js';
import { parseReportText } from '../services/labParser.js';
import { evaluateMeasurement, deriveFindings } from '../services/clinicalRules.js';
import { extractReportText } from '../services/reportExtraction.js';

process.env.AI_PROVIDER = 'local';

const header = ['CITY DIAGNOSTIC LAB', 'Patient Name: Test Patient   Age/Sex: 45 Y / Male', 'TEST NAME RESULT UNIT REF. RANGE'];
const REPORTS = {
  normal: [...header, 'Hemoglobin 14.6 g/dL 13.0 - 17.0', 'Total WBC Count 7200 cells/cumm 4000 - 11000', 'Platelet Count 2.6 lakhs/cumm 1.5 - 4.5', 'Fasting Blood Sugar 88 mg/dL 70 - 100', 'HbA1c 5.1 % 4.0 - 5.6', 'Total Cholesterol 172 mg/dL < 200', 'Triglycerides 110 mg/dL < 150', 'HDL Cholesterol 52 mg/dL > 40', 'LDL Cholesterol 92 mg/dL < 100', 'Serum Creatinine 0.9 mg/dL 0.7 - 1.3', 'SGPT (ALT) 24 U/L < 41', 'SGOT (AST) 22 U/L < 40', 'TSH 2.1 uIU/mL 0.35 - 4.94'],
  diabetes: [...header, 'DIABETES PROFILE', 'Fasting Blood Sugar 182 H mg/dL 70 - 100', 'Post Prandial Sugar 264 H mg/dL < 140', 'HbA1c 8.4 H % 4.0 - 5.6'],
  cholesterol: [...header, 'LIPID PROFILE', 'Total Cholesterol 262 H mg/dL < 200', 'Triglycerides 190 H mg/dL < 150', 'HDL Cholesterol 38 L mg/dL > 40', 'LDL Cholesterol 178 H mg/dL < 100'],
  liver: [...header, 'LIVER FUNCTION TEST', 'Total Bilirubin 2.4 H mg/dL 0.3 - 1.2', 'SGOT (AST) 140 H U/L < 40', 'SGPT (ALT) 180 H U/L < 41', 'Alkaline Phosphatase 160 H U/L 44 - 147', 'Albumin 4.0 g/dL 3.5 - 5.2'],
  kidney: [...header, 'KIDNEY FUNCTION TEST', 'Serum Creatinine 230 H umol/L 62 - 106', 'Blood Urea 88 H mg/dL 15 - 40', 'eGFR 24 L mL/min/1.73m2 > 90', 'Sodium 138 mmol/L 135 - 145', 'Potassium 5.0 mmol/L 3.5 - 5.1'],
  anemia: [...header.slice(0, 1), 'Age/Sex: 32 Y / Female', 'COMPLETE BLOOD COUNT', 'Hemoglobin 8.9 L g/dL 12.0 - 15.5', 'RBC Count 3.6 L mill/cumm 3.8 - 4.8', 'MCV 68 L fL 83 - 101', 'Serum Ferritin 6 L ng/mL 15 - 150'],
  thyroid: [...header, 'THYROID PROFILE', 'TSH 12.5 H uIU/mL 0.35 - 4.94', 'Free T4 0.6 L ng/dL 0.89 - 1.76'],
  infection: [...header, 'Temperature 38.9 C', 'COMPLETE BLOOD COUNT', 'Total WBC Count 16,500 H cells/cumm 4000 - 11000', 'Neutrophils 86 H % 40 - 75', 'CRP 64 H mg/L < 5'],
  multiple: [...header, 'Random Blood Sugar 214 H mg/dL 70 - 140', 'Triglycerides 260 H mg/dL < 150', 'HDL Cholesterol 34 L mg/dL > 40', 'SGPT (ALT) 78 H U/L < 41'],
  incomplete: ['Clinic note', 'Patient complained of headache for two days.', 'Advised rest. Report attached separately.'],
};

const analyzeLines = async (lines) => (await analyzeReport({ buffer: makePdf(lines), mimeType: 'application/pdf' })).analysis;
const ids = (analysis) => analysis.possibleConditions.map((f) => f.id);
const results = {};

test('PDF extraction returns the real text of each report', async () => {
  const a = await extractReportText(makePdf(REPORTS.diabetes));
  const b = await extractReportText(makePdf(REPORTS.thyroid));
  assert.equal(a.method, 'pdf-text');
  assert.match(a.text, /HbA1c 8\.4/);
  assert.match(b.text, /TSH 12\.5/);
  assert.notEqual(a.text, b.text);
});

for (const name of Object.keys(REPORTS)) {
  test(`analyzes the ${name} report`, async () => { results[name] = await analyzeLines(REPORTS[name]); });
}

test('1. normal report: no disease invented, caveat present', () => {
  const a = results.normal;
  assert.equal(a.possibleConditions.length, 0);
  assert.equal(a.abnormalValues.length, 0);
  assert.ok(a.summary.startsWith(NORMAL_MESSAGE));
  assert.match(a.summary, /does not rule out every medical condition/);
  assert.equal(a.score, 100);
  assert.equal(a.riskLevel, 'Low');
});

test('2. diabetes report: diabetes-range finding with strong evidence, not "confirmed"', () => {
  const a = results.diabetes;
  assert.ok(ids(a).includes('diabetes-range'));
  assert.equal(a.possibleConditions.find((f) => f.id === 'diabetes-range').evidenceLevel, 'strong');
  assert.ok(!ids(a).includes('prediabetes-range'));
});

test('3. high cholesterol report: dyslipidaemia, no diabetes', () => {
  assert.ok(ids(results.cholesterol).includes('dyslipidemia'));
  assert.ok(!ids(results.cholesterol).includes('diabetes-range'));
});

test('4. liver report: raised liver enzymes and bilirubin', () => {
  assert.ok(ids(results.liver).includes('liver-enzymes'));
  assert.ok(ids(results.liver).includes('bilirubin'));
});

test('5. kidney report: µmol/L creatinine converted, eGFR 24 → KDIGO G4, urgency soon', () => {
  const a = results.kidney;
  const creat = a.measurements.find((m) => m.key === 'creatinine');
  assert.equal(creat.unit, 'umol/L');
  assert.ok(Math.abs(creat.canonicalValue - 2.6) < 0.01);
  const kidney = a.possibleConditions.find((f) => f.id === 'kidney-function');
  assert.ok(kidney);
  assert.match(kidney.explanation, /G4/);
  assert.equal(kidney.urgency, 'soon');
});

test('6. anemia report: microcytic pattern with low ferritin', () => {
  const anemia = results.anemia.possibleConditions.find((f) => f.id === 'anemia');
  assert.ok(anemia);
  assert.equal(anemia.condition, 'Possible iron-deficiency anaemia');
  assert.match(anemia.explanation, /Small red cells/);
});

test('7. thyroid report: high TSH + low FT4 → hypothyroid pattern', () => {
  const thyroid = results.thyroid.possibleConditions.find((f) => f.id === 'tsh-high');
  assert.match(thyroid.condition, /hypothyroidism/);
});

test('8. infection report: raised WBC with neutrophils, CRP, fever', () => {
  const wbc = results.infection.possibleConditions.find((f) => f.id === 'wbc-high');
  assert.equal(wbc.condition, 'Possible infection or inflammation');
  assert.equal(wbc.evidenceLevel, 'moderate');
  assert.equal(results.infection.measurements.find((m) => m.key === 'wbc').value, 16500);
});

test('9. multiple-abnormality report returns several findings, not one label', () => {
  const found = ids(results.multiple);
  for (const id of ['diabetes-range', 'dyslipidemia', 'liver-enzymes']) assert.ok(found.includes(id), id);
  assert.ok(found.length >= 3);
});

test('10. incomplete report: insufficient information, no guess', () => {
  const a = results.incomplete;
  assert.equal(a.insufficientInformation, true);
  assert.equal(a.possibleConditions.length, 0);
  assert.ok(a.summary.startsWith(INSUFFICIENT_MESSAGE));
  assert.equal(a.score, null);
  assert.equal(a.riskLevel, 'Unknown');
});

test('every report produces a different analysis and no values leak between reports', () => {
  const summaries = Object.values(results).map((a) => JSON.stringify(a.measurements));
  assert.equal(new Set(summaries).size, summaries.length);
  // The thyroid report must not contain any value from the diabetes report analysed before it.
  const thyroidText = JSON.stringify(results.thyroid);
  for (const value of ['182', '264', '8.4']) assert.ok(!thyroidText.includes(`"valueText":"${value}"`));
});

test('glucose 280 vs glucose 90 give different results (no unit or range printed)', async () => {
  const high = await analyzeLines(['Lab report', 'Glucose 280']);
  const normal = await analyzeLines(['Lab report', 'Glucose 90']);
  assert.ok(ids(high).includes('diabetes-range'));
  assert.equal(high.measurements[0].referenceSource, 'default-adult');
  assert.equal(normal.possibleConditions.length, 0);
  assert.notEqual(high.summary, normal.summary);
});

test('mmol/L glucose is converted before guideline thresholds are applied', async () => {
  const a = await analyzeLines(['Fasting Plasma Glucose 7.8 mmol/L 3.9 - 5.5']);
  assert.ok(Math.abs(a.measurements[0].canonicalValue - 140.5) < 0.5);
  assert.ok(ids(a).includes('diabetes-range'));
});

test('the report’s own reference range takes priority over default ranges', () => {
  const [m] = parseReportText('Hemoglobin 12.4 g/dL 12.0 - 15.5').measurements;
  const e = evaluateMeasurement(m, { sex: 'male' }); // default male range would call 12.4 low
  assert.equal(e.status, 'normal');
  assert.equal(e.rangeUsed.source, 'report');
});

test('a single raised TSH without T4 is described as limited evidence', () => {
  const evaluated = parseReportText('TSH 6.2 uIU/mL 0.4 - 4.0').measurements.map((m) => evaluateMeasurement(m));
  const [finding] = deriveFindings(evaluated);
  assert.equal(finding.evidenceLevel, 'limited');
  assert.match(finding.condition, /free T4 needed/);
});

test('missing vital signs never count as abnormal', async () => {
  const a = await analyzeLines(['Temperature 38.6 C', 'Heart Rate 94 bpm', 'Respiratory Rate 18 /min', 'Blood Pressure 118/76 mmHg']);
  const vitals = a.possibleConditions.find((f) => f.id === 'vitals');
  assert.equal(vitals.title, 'Fever');
  assert.equal(vitals.urgency, 'soon');
});

test('critical vitals are flagged urgent', async () => {
  const a = await analyzeLines(['Blood Pressure 88/56 mmHg', 'Heart Rate 124 bpm', 'SpO2 84 %', 'GCS 12/15']);
  assert.equal(a.riskLevel, 'High');
  assert.ok(a.urgentFindings.length >= 1);
});

test('implausible values are not interpreted', async () => {
  const a = await analyzeLines(['Hemoglobin 140 g/dL 13.0 - 17.0']);
  assert.equal(a.measurements[0].status, 'implausible');
  assert.equal(a.insufficientInformation, true);
});

test('a value with a lost decimal point (OCR) is flagged, excluded, and not sent to the AI', async () => {
  const a = await analyzeLines(['BMI 228', 'Hemoglobin 13.4 g/dL 12.0 - 15.5']);
  assert.equal(a.measurements.find((m) => m.key === 'bmi').status, 'implausible');
  assert.ok(a.warnings.some((w) => /implausible/.test(w)));
  const { patient, measurements } = parseReportText('BMI 228\nHemoglobin 13.4 g/dL 12.0 - 15.5');
  const evaluated = measurements.map((m) => evaluateMeasurement(m, patient));
  assert.doesNotMatch(buildReportPrompt({ patient, evaluated, findings: [], reportType: 'test' }), /BMI/);
});

test('a non-PDF file renamed to .pdf is rejected', async () => {
  await assert.rejects(() => analyzeReport({ buffer: Buffer.from('hello, this is not a pdf'), mimeType: 'application/pdf' }), /not a valid PDF/);
});

test('Gemini prompt contains this report’s actual values and differs per report', () => {
  const build = (lines) => {
    const { patient, measurements } = parseReportText(lines.join('\n'));
    const evaluated = measurements.map((m) => evaluateMeasurement(m, patient));
    return buildReportPrompt({ patient, evaluated, findings: deriveFindings(evaluated, patient), reportType: 'test' });
  };
  const a = build(REPORTS.diabetes);
  const b = build(REPORTS.thyroid);
  assert.match(a, /HbA1c: 8\.4 %/);
  assert.match(a, /Fasting glucose: 182 mg\/dL \(report range 70 - 100\) — High/);
  assert.match(b, /TSH: 12\.5 uIU\/mL/);
  assert.doesNotMatch(a, /TSH/);
  assert.doesNotMatch(a, /Test Patient/); // patient name is not sent to the AI
});

test('AI output safety validator rejects invented values, dosing and certainty', () => {
  const evaluated = parseReportText(REPORTS.diabetes.join('\n')).measurements.map((m) => evaluateMeasurement(m));
  const base = { keyPoints: [], questionsForDoctor: [] };
  assert.equal(validateAIExplanation({ ...base, summary: 'Your HbA1c of 8.4% may suggest diabetes.', doctorExplanation: 'A doctor should confirm this.' }, evaluated).ok, true);
  assert.equal(validateAIExplanation({ ...base, summary: 'Your cholesterol of 245 is high.', doctorExplanation: 'x' }, evaluated).ok, false);
  assert.equal(validateAIExplanation({ ...base, summary: 'Take 500 mg metformin daily.', doctorExplanation: 'x' }, evaluated).ok, false);
  assert.equal(validateAIExplanation({ ...base, summary: 'This is 100% confirmed.', doctorExplanation: 'x' }, evaluated).ok, false);
});
