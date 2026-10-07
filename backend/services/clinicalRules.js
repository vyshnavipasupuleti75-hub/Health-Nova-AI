// Deterministic interpretation layer.
// 1. evaluateMeasurement: judges each value against the report's own reference range first,
//    then the report's H/L flag, and only then a fallback adult range (clearly labelled).
// 2. deriveFindings: groups abnormal values into *possible* findings using published guideline
//    thresholds (ADA, KDIGO, ACC/AHA, NCEP ATP III, WHO). Findings are never presented as a
//    confirmed diagnosis, and none is produced without supporting values from the report.
import { ANALYTE_BY_KEY } from './labCatalog.js';

const POSITIVE = /^(reactive|positive|detected|present|trace|\+{1,4}|[1-4]\+)$/i;
const NEGATIVE = /^(non[\s-]?reactive|negative|not\s+detected|nil|absent|normal)$/i;

// Canonical-unit thresholds that change severity regardless of the printed range.
const SEVERITY = {
  hemoglobin: { criticalLow: 7, markedLow: 8, criticalHigh: 20 },
  wbc: { criticalLow: 2000, criticalHigh: 30000, markedHigh: 20000, markedLow: 3000 },
  anc: { criticalLow: 500, markedLow: 1000 },
  platelets: { criticalLow: 20000, markedLow: 50000, criticalHigh: 1000000 },
  glucose_fasting: { criticalLow: 54, criticalHigh: 400, markedHigh: 250 },
  glucose_random: { criticalLow: 54, criticalHigh: 400, markedHigh: 300 },
  glucose_pp: { criticalLow: 54, criticalHigh: 400, markedHigh: 300 },
  potassium: { criticalLow: 3.0, criticalHigh: 6.0 },
  sodium: { criticalLow: 125, criticalHigh: 155 },
  calcium: { criticalLow: 7, criticalHigh: 12 },
  egfr: { criticalLow: 15, markedLow: 30 },
  triglycerides: { markedHigh: 500, criticalHigh: 1000 },
  bilirubin_total: { markedHigh: 3 },
  alt: { markedHigh: 275 }, ast: { markedHigh: 200 },
  inr: { markedHigh: 3, criticalHigh: 5 },
  spo2: { criticalLow: 90, markedLow: 93 },
  heart_rate: { criticalHigh: 130, markedHigh: 120, criticalLow: 40, markedLow: 50 },
  respiratory_rate: { criticalHigh: 28, markedHigh: 24, criticalLow: 8 },
  temperature: { criticalHigh: 40, markedHigh: 39, criticalLow: 35 },
  gcs: { criticalLow: 12.5, markedLow: 14.5 },
};

const fmt = (n) => (n == null ? '' : Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

function pickDefaultRange(analyte, sex) {
  const range = analyte.range;
  if (!range) return null;
  if (Array.isArray(range)) return range;
  if (sex && range[sex]) return range[sex];
  // Sex unknown: use the widest combined range so we do not over-flag.
  const lows = [range.male?.[0], range.female?.[0]].filter((v) => v != null);
  const highs = [range.male?.[1], range.female?.[1]].filter((v) => v != null);
  return [lows.length ? Math.min(...lows) : null, highs.length ? Math.max(...highs) : null];
}

function severityFor(m, status, value, low, high) {
  if (status === 'normal' || status === 'unknown' || status === 'info' || status === 'implausible') return 'none';
  const t = SEVERITY[m.key] || {};
  const c = m.canonicalValue;
  if (c != null) {
    if ((t.criticalLow != null && c < t.criticalLow) || (t.criticalHigh != null && c > t.criticalHigh)) return 'critical';
    if ((t.markedLow != null && c < t.markedLow) || (t.markedHigh != null && c > t.markedHigh)) return 'marked';
  }
  if (value == null) return 'mild';
  const deviation = status === 'high' && high ? (value - high) / Math.abs(high) : status === 'low' && low ? (low - value) / Math.abs(low) : 0;
  if (deviation > 1) return 'marked';
  if (deviation > 0.25) return 'moderate';
  return 'mild';
}

export function evaluateMeasurement(m, patient = {}) {
  const analyte = ANALYTE_BY_KEY[m.key] || {};
  const result = { ...m, status: 'unknown', severity: 'none', rangeUsed: null };

  if (m.key === 'blood_pressure') {
    const { systolic: s, diastolic: d } = m;
    result.rangeUsed = { text: 'below 120/80 mmHg (ACC/AHA adult guideline)', source: 'guideline' };
    result.status = s >= 130 || d >= 80 ? 'high' : s < 90 || d < 60 ? 'low' : 'normal';
    result.severity = s >= 180 || d >= 120 || s < 90 ? 'critical' : s >= 140 || d >= 90 ? 'moderate' : result.status === 'normal' ? 'none' : 'mild';
    return result;
  }

  if (m.qualitative) {
    result.rangeUsed = m.reportRange?.text ? { text: m.reportRange.text, source: 'report' } : { text: 'Negative / Nil expected', source: 'default' };
    if (POSITIVE.test(m.qualitative.trim())) {
      result.status = 'abnormal';
      result.severity = /trace/i.test(m.qualitative) ? 'mild' : 'moderate';
    } else if (NEGATIVE.test(m.qualitative.trim())) result.status = 'normal';
    return result;
  }

  if (analyte.informational) { result.status = 'info'; return result; }

  if (m.implausible || (m.canonicalValue != null && analyte.plausible && (m.canonicalValue < analyte.plausible[0] || m.canonicalValue > analyte.plausible[1]))) {
    result.status = 'implausible';
    return result;
  }

  const value = m.value;
  const range = m.reportRange;
  const rangeScaleMismatch = range && value && ((range.high && value / range.high > 100) || (range.low && range.low / value > 100));
  const flags = (m.flags || []).join(' ');

  if (range && (range.low != null || range.high != null) && !rangeScaleMismatch) {
    result.rangeUsed = { low: range.low, high: range.high, text: range.text, unit: m.unit, source: 'report' };
    const cmpValue = m.comparator?.startsWith('<') && range.high != null ? Math.min(value, range.high) : value;
    if (range.high != null && cmpValue > range.high) result.status = 'high';
    else if (range.low != null && cmpValue < range.low) result.status = 'low';
    else result.status = 'normal';
    result.severity = severityFor(m, result.status, value, range.low, range.high);
    return result;
  }

  if (/\b(H|HIGH|HH|↑)\b/.test(flags) || /\b(L|LOW|LL|↓)\b/.test(flags)) {
    result.status = /\b(H|HIGH|HH|↑)\b/.test(flags) ? 'high' : 'low';
    result.rangeUsed = { text: 'flagged on report', source: 'report-flag' };
    result.severity = severityFor(m, result.status, null, null, null);
    return result;
  }

  const fallback = pickDefaultRange(analyte, patient.sex);
  if (fallback && m.canonicalValue != null) {
    const [low, high] = fallback;
    const c = m.canonicalValue;
    result.rangeUsed = { low, high, unit: analyte.unit, text: low != null && high != null ? `${fmt(low)} - ${fmt(high)}` : low != null ? `> ${fmt(low)}` : `< ${fmt(high)}`, source: 'default-adult' };
    result.status = high != null && c > high ? 'high' : low != null && c < low ? 'low' : 'normal';
    result.severity = severityFor(m, result.status, c, low, high);
  }
  return result;
}

// ---------------------------------------------------------------------------------------------

function describe(e) {
  if (!e) return '';
  const range = e.rangeUsed?.text ? ` (${e.rangeUsed.source === 'report' ? 'report range' : e.rangeUsed.source === 'default-adult' ? 'typical adult range' : 'reference'} ${e.rangeUsed.text}${e.rangeUsed.source === 'default-adult' && e.rangeUsed.unit ? ` ${e.rangeUsed.unit}` : ''})` : '';
  const status = { high: 'High', low: 'Low', abnormal: 'Positive/abnormal', normal: 'Within range' }[e.status] || '';
  return `${e.name}: ${e.valueText}${e.unit ? ` ${e.unit}` : ''}${range}${status ? ` — ${status}` : ''}`;
}

function makeContext(evaluated, patient) {
  const byKey = Object.fromEntries(evaluated.map((e) => [e.key, e]));
  const usable = (key) => byKey[key] && !['implausible', 'unknown', 'info'].includes(byKey[key].status) ? byKey[key] : null;
  return {
    patient,
    get: usable,
    val: (key) => usable(key)?.canonicalValue ?? null,
    // Null-safe "less than": a missing value must never count as low (null < 92 is true in JS).
    below: (key, limit) => usable(key)?.canonicalValue != null && usable(key).canonicalValue < limit,
    status: (key) => usable(key)?.status ?? null,
    high: (key) => usable(key)?.status === 'high',
    low: (key) => usable(key)?.status === 'low',
    positive: (key) => usable(key)?.status === 'abnormal',
    describe: (...keys) => keys.map((k) => usable(k)).filter(Boolean).map(describe),
  };
}

function finding({ id, title, condition = null, category, kind = 'possible-condition', evidenceLevel = 'limited', urgency = 'routine', evidence, explanation, nextSteps = [], keys = [] }) {
  return { id, title, condition, category, kind, evidenceLevel, urgency, evidence, explanation, nextSteps, keys };
}

const RULES = [
  // ---- Glucose / diabetes ----
  (c) => {
    const criteria = [];
    if (c.val('hba1c') >= 6.5) criteria.push('hba1c');
    if (c.val('glucose_fasting') >= 126) criteria.push('glucose_fasting');
    if (c.val('glucose_random') >= 200) criteria.push('glucose_random');
    if (c.val('glucose_pp') >= 200) criteria.push('glucose_pp');
    if (!criteria.length) return null;
    const urgent = ['glucose_fasting', 'glucose_random', 'glucose_pp'].some((k) => c.val(k) > 400) || (c.positive('urine_ketones') && criteria.length > 0);
    return finding({
      id: 'diabetes-range', title: 'Blood sugar in the diabetes range', condition: 'Possible diabetes mellitus', category: 'Metabolic',
      evidenceLevel: criteria.length >= 2 ? 'strong' : 'moderate', urgency: urgent ? 'urgent' : 'soon',
      evidence: c.describe(...criteria, 'urine_glucose', 'urine_ketones'),
      explanation: criteria.length >= 2
        ? 'More than one glucose measure is in the range that guidelines (ADA) use for diabetes. A diagnosis still has to be made by a clinician who reviews how and when the samples were taken.'
        : 'One glucose measure is in the range that guidelines (ADA) use for diabetes. A single result is not enough for a diagnosis; guidelines require confirmation with a repeat or second test.',
      nextSteps: [urgent ? 'Very high glucose (or glucose with ketones) can be dangerous — seek medical care promptly, especially with vomiting, drowsiness, or rapid breathing.' : 'See a doctor to confirm with repeat fasting glucose or HbA1c testing.', 'Ask about kidney, eye, and cholesterol checks if diabetes is confirmed.'],
      keys: criteria,
    });
  },
  (c) => {
    if (c.val('hba1c') >= 6.5 || c.val('glucose_fasting') >= 126 || c.val('glucose_random') >= 200 || c.val('glucose_pp') >= 200) return null;
    const keys = [];
    if (c.val('hba1c') >= 5.7) keys.push('hba1c');
    if (c.val('glucose_fasting') >= 100) keys.push('glucose_fasting');
    if (c.val('glucose_pp') >= 140) keys.push('glucose_pp');
    if (!keys.length) return null;
    return finding({
      id: 'prediabetes-range', title: 'Blood sugar in the prediabetes range', condition: 'Possible prediabetes', category: 'Metabolic',
      evidenceLevel: keys.length >= 2 ? 'moderate' : 'limited', evidence: c.describe(...keys),
      explanation: 'These values fall between normal and the diabetes range (ADA prediabetes thresholds: fasting glucose 100–125 mg/dL, HbA1c 5.7–6.4%). This indicates higher future risk, not diabetes.',
      nextSteps: ['Discuss repeat testing with a doctor (often yearly).', 'Lifestyle changes such as activity and weight management can lower risk.'], keys,
    });
  },
  (c) => {
    const keys = ['glucose_fasting', 'glucose_random', 'glucose_pp'].filter((k) => c.val(k) != null && c.val(k) < 70);
    if (!keys.length) return null;
    const urgent = keys.some((k) => c.val(k) < 54);
    return finding({
      id: 'low-glucose', title: 'Low blood sugar', condition: 'Possible hypoglycaemia', category: 'Metabolic', kind: urgent ? 'urgent' : 'abnormal-pattern',
      evidenceLevel: 'moderate', urgency: urgent ? 'urgent' : 'soon', evidence: c.describe(...keys),
      explanation: 'Glucose below 70 mg/dL is low; below 54 mg/dL is considered clinically significant. Delayed sample processing can also lower measured glucose.',
      nextSteps: [urgent ? 'If there is confusion, sweating, shakiness, or fainting, seek urgent care.' : 'Discuss this result with a doctor, especially if you take diabetes medicines.'], keys,
    });
  },

  // ---- Lipids / cardiovascular ----
  (c) => {
    const sexLowHdl = c.patient.sex === 'female' ? 50 : 40;
    const keys = [];
    if (c.val('total_cholesterol') >= 200) keys.push('total_cholesterol');
    if (c.val('ldl') >= 130) keys.push('ldl');
    if (c.val('triglycerides') >= 150) keys.push('triglycerides');
    if (c.val('hdl') != null && c.val('hdl') < sexLowHdl) keys.push('hdl');
    if (c.val('non_hdl') >= 160) keys.push('non_hdl');
    if (!keys.length) return null;
    const veryHighTg = c.val('triglycerides') >= 500;
    const veryHighLdl = c.val('ldl') >= 190;
    return finding({
      id: 'dyslipidemia', title: 'Abnormal cholesterol / lipid levels', condition: 'Possible dyslipidaemia', category: 'Cardiovascular',
      evidenceLevel: keys.length >= 2 ? 'moderate' : 'limited', urgency: veryHighTg || veryHighLdl ? 'soon' : 'routine',
      evidence: c.describe(...keys),
      explanation: `One or more lipid values are outside the NCEP ATP III desirable ranges.${veryHighTg ? ' Triglycerides of 500 mg/dL or more raise the risk of pancreatitis.' : ''}${veryHighLdl ? ' LDL of 190 mg/dL or more can suggest an inherited cholesterol disorder.' : ''} Lipid levels are one part of heart-disease risk, alongside blood pressure, smoking, diabetes, age, and family history.`,
      nextSteps: ['Ask a doctor to assess overall cardiovascular risk.', 'A repeat fasting lipid profile may be advised.'], keys,
    });
  },
  (c) => {
    const parts = [];
    if (c.val('triglycerides') >= 150) parts.push('triglycerides');
    if (c.val('hdl') != null && c.val('hdl') < (c.patient.sex === 'female' ? 50 : 40)) parts.push('hdl');
    if (c.val('glucose_fasting') >= 100) parts.push('glucose_fasting');
    const bp = c.get('blood_pressure');
    if (bp && (bp.systolic >= 130 || bp.diastolic >= 85)) parts.push('blood_pressure');
    if (parts.length < 3) return null;
    return finding({
      id: 'metabolic-syndrome-pattern', title: 'Several metabolic risk markers together', condition: 'Possible metabolic syndrome pattern', category: 'Metabolic',
      evidenceLevel: parts.length >= 4 ? 'moderate' : 'limited', evidence: c.describe(...parts),
      explanation: 'Three or more of these markers together match the metabolic syndrome criteria (NCEP ATP III). Waist circumference is part of the definition and is not available in this report.',
      nextSteps: ['Discuss overall heart and diabetes risk with a doctor, including waist measurement.'], keys: parts,
    });
  },
  (c) => {
    const bp = c.get('blood_pressure');
    if (!bp) return null;
    const { systolic: s, diastolic: d } = bp;
    if (s >= 180 || d >= 120) return finding({ id: 'bp-crisis', title: 'Very high blood pressure reading', condition: 'Severely elevated blood pressure', category: 'Cardiovascular', kind: 'urgent', evidenceLevel: 'moderate', urgency: 'urgent', evidence: c.describe('blood_pressure'), explanation: 'A reading of 180/120 mmHg or higher is in the hypertensive-crisis range (ACC/AHA).', nextSteps: ['Seek urgent medical care, immediately if there is chest pain, breathlessness, weakness, vision change, or severe headache.'], keys: ['blood_pressure'] });
    if (s < 90) return finding({ id: 'bp-low', title: 'Low blood pressure reading', condition: 'Hypotension', category: 'Cardiovascular', kind: 'urgent', evidenceLevel: 'moderate', urgency: c.val('heart_rate') > 100 || c.below('spo2', 94) ? 'urgent' : 'soon', evidence: c.describe('blood_pressure', 'heart_rate'), explanation: 'Systolic pressure below 90 mmHg is low. Together with a fast heart rate or low oxygen, it can be a sign of a medical emergency.', nextSteps: ['Seek prompt medical assessment, urgently if there is dizziness, fainting, confusion, or breathlessness.'], keys: ['blood_pressure'] });
    if (s >= 130 || d >= 80) return finding({ id: 'bp-high', title: 'Raised blood pressure reading', condition: 'Possible hypertension', category: 'Cardiovascular', evidenceLevel: 'limited', urgency: 'routine', evidence: c.describe('blood_pressure'), explanation: `This reading is in the ${s >= 140 || d >= 90 ? 'stage 2' : 'stage 1'} hypertension range (ACC/AHA). Hypertension is diagnosed from repeated readings on separate occasions, not a single measurement.`, nextSteps: ['Repeat blood pressure measurements on different days, or use home monitoring as a doctor advises.'], keys: ['blood_pressure'] });
    return null;
  },
  (c) => {
    if (!c.high('troponin')) return null;
    return finding({ id: 'troponin', title: 'Raised troponin', condition: 'Possible heart muscle injury', category: 'Cardiovascular', kind: 'urgent', evidenceLevel: 'moderate', urgency: 'urgent', evidence: c.describe('troponin'), explanation: 'Troponin above the laboratory reference can indicate heart muscle injury, for example a heart attack, but also occurs in other conditions.', nextSteps: ['Seek emergency medical care now, especially with chest pain, breathlessness, sweating, or fainting.'], keys: ['troponin'] });
  },
  (c) => {
    const keys = ['nt_probnp', 'bnp'].filter((k) => c.high(k));
    if (!keys.length) return null;
    return finding({ id: 'natriuretic', title: 'Raised heart strain marker (BNP / NT-proBNP)', condition: 'Possible heart strain — heart failure among possible causes', category: 'Cardiovascular', evidenceLevel: 'limited', urgency: 'soon', evidence: c.describe(...keys), explanation: 'These markers rise when the heart is under strain. Heart failure is one cause; kidney disease, age, and lung conditions also raise them. Diagnosis requires clinical evaluation and usually an echocardiogram.', nextSteps: ['See a doctor soon; seek urgent care for breathlessness at rest, leg swelling, or chest pain.'], keys });
  },

  // ---- Liver ----
  (c) => {
    const keys = ['alt', 'ast', 'alp', 'ggt'].filter((k) => c.high(k));
    if (!keys.length) return null;
    const alt = c.get('alt');
    const altUln = alt?.rangeUsed?.high;
    const marked = altUln && alt.value > altUln * 5;
    const metabolic = c.high('triglycerides') || c.val('hba1c') >= 5.7 || c.val('glucose_fasting') >= 100 || c.val('bmi') >= 25;
    return finding({
      id: 'liver-enzymes', title: 'Raised liver enzymes', condition: 'Liver-function abnormality (cause not determined)', category: 'Liver', kind: 'abnormal-pattern',
      evidenceLevel: keys.length >= 2 ? 'moderate' : 'limited', urgency: marked ? 'soon' : 'routine',
      evidence: c.describe(...keys, 'bilirubin_total', 'albumin'),
      explanation: `Liver enzymes above the reference range show liver cells are under stress. Common causes include fatty liver, alcohol, viral hepatitis, and some medicines.${metabolic ? ' The metabolic markers in this report make fatty liver one possibility to discuss, but it can only be confirmed with imaging and clinical assessment.' : ''}${marked ? ' ALT above 5 times the upper limit warrants prompt evaluation.' : ''}`,
      nextSteps: ['Discuss with a doctor; repeat liver tests, hepatitis screening, or an abdominal ultrasound may be considered.', 'Do not stop prescribed medicines on your own; ask your doctor whether any could be contributing.'], keys,
    });
  },
  (c) => {
    if (!c.high('bilirubin_total') && !c.high('bilirubin_direct')) return null;
    const keys = ['bilirubin_total', 'bilirubin_direct', 'bilirubin_indirect'].filter((k) => c.get(k));
    return finding({ id: 'bilirubin', title: 'Raised bilirubin', condition: 'Hyperbilirubinaemia (cause not determined)', category: 'Liver', kind: 'abnormal-pattern', evidenceLevel: 'limited', urgency: c.val('bilirubin_total') > 3 ? 'soon' : 'routine', evidence: c.describe(...keys), explanation: 'High bilirubin can come from liver conditions, bile-duct blockage, breakdown of red blood cells, or a harmless inherited trait (Gilbert syndrome). The direct/indirect split helps tell these apart.', nextSteps: ['See a doctor, sooner if there is yellow skin or eyes, dark urine, pale stools, or abdominal pain.'], keys });
  },
  (c) => (c.low('albumin') ? finding({ id: 'albumin-low', title: 'Low albumin', condition: null, category: 'Liver', kind: 'abnormal-pattern', evidenceLevel: 'limited', evidence: c.describe('albumin'), explanation: 'Low albumin can be related to nutrition, liver function, kidney protein loss, or inflammation.', nextSteps: ['Discuss with a doctor alongside liver and kidney results.'], keys: ['albumin'] }) : null),
  (c) => (c.positive('hbsag') ? finding({ id: 'hbsag', title: 'Hepatitis B screening test reactive', condition: 'Possible hepatitis B infection', category: 'Infection', kind: 'screening-result', evidenceLevel: 'moderate', urgency: 'soon', evidence: c.describe('hbsag'), explanation: 'A reactive HBsAg is a screening result that needs confirmatory testing and specialist assessment.', nextSteps: ['See a doctor for confirmatory hepatitis B tests and liver assessment.'], keys: ['hbsag'] }) : null),
  (c) => (c.positive('anti_hcv') ? finding({ id: 'hcv', title: 'Hepatitis C antibody reactive', condition: 'Possible hepatitis C exposure or infection', category: 'Infection', kind: 'screening-result', evidenceLevel: 'limited', urgency: 'soon', evidence: c.describe('anti_hcv'), explanation: 'A reactive antibody shows past or current exposure. An HCV RNA test is needed to tell whether infection is active.', nextSteps: ['See a doctor for an HCV RNA test.'], keys: ['anti_hcv'] }) : null),

  // ---- Kidney ----
  (c) => {
    const egfr = c.val('egfr');
    const creatHigh = c.high('creatinine');
    if (!(egfr != null && egfr < 60) && !creatHigh) return null;
    const stage = egfr == null ? null : egfr < 15 ? 'G5' : egfr < 30 ? 'G4' : egfr < 45 ? 'G3b' : egfr < 60 ? 'G3a' : null;
    return finding({
      id: 'kidney-function', title: 'Reduced kidney function markers', condition: 'Possible chronic kidney disease (needs confirmation over 3 months)', category: 'Kidney',
      kind: egfr != null && egfr < 15 ? 'urgent' : 'possible-condition', evidenceLevel: egfr != null && egfr < 60 && creatHigh ? 'moderate' : 'limited',
      urgency: egfr != null && egfr < 15 ? 'urgent' : egfr != null && egfr < 30 ? 'soon' : 'routine',
      evidence: c.describe('egfr', 'creatinine', 'urea', 'bun', 'urine_protein'),
      explanation: `${stage ? `An eGFR in this range corresponds to KDIGO category ${stage}. ` : ''}Chronic kidney disease is only diagnosed when reduced function or kidney damage persists for more than 3 months. A single result can be affected by dehydration, recent illness, muscle mass, or medicines.`,
      nextSteps: ['Ask a doctor about repeating creatinine/eGFR and a urine albumin-to-creatinine test.', 'Avoid over-the-counter painkillers such as NSAIDs unless a doctor approves, and keep blood pressure and blood sugar controlled.'],
      keys: ['egfr', 'creatinine'].filter((k) => c.get(k)),
    });
  },
  (c) => ((c.high('urea') || c.high('bun')) && !c.high('creatinine') && !c.below('egfr', 60) ? finding({ id: 'urea-high', title: 'Raised urea', condition: null, category: 'Kidney', kind: 'abnormal-pattern', evidenceLevel: 'limited', evidence: c.describe('urea', 'bun', 'creatinine'), explanation: 'Urea can rise with dehydration, a high-protein diet, bleeding in the gut, or reduced kidney function.', nextSteps: ['Discuss with a doctor along with creatinine and hydration status.'], keys: ['urea', 'bun'] }) : null),
  (c) => (c.high('uric_acid') ? finding({ id: 'uric-acid', title: 'Raised uric acid', condition: 'Hyperuricaemia', category: 'Kidney', kind: 'abnormal-pattern', evidenceLevel: 'limited', evidence: c.describe('uric_acid'), explanation: 'High uric acid is a risk factor for gout and kidney stones, but many people with high levels never develop symptoms.', nextSteps: ['Discuss with a doctor, especially if there is joint pain or a history of kidney stones.'], keys: ['uric_acid'] }) : null),
  (c) => (c.positive('urine_protein') ? finding({ id: 'proteinuria', title: 'Protein in urine', condition: 'Proteinuria (cause not determined)', category: 'Kidney', kind: 'abnormal-pattern', evidenceLevel: 'limited', evidence: c.describe('urine_protein'), explanation: 'Protein in urine can be temporary (fever, exercise, dehydration) or a sign of kidney damage, particularly with diabetes or high blood pressure.', nextSteps: ['Ask a doctor about a repeat urine test or urine albumin-to-creatinine ratio.'], keys: ['urine_protein'] }) : null),

  // ---- Blood ----
  (c) => {
    if (!c.low('hemoglobin')) return null;
    const hb = c.val('hemoglobin');
    const mcv = c.val('mcv');
    const ferritinLow = c.low('ferritin');
    const type = mcv == null ? null : mcv < 80 || c.low('mcv') ? 'microcytic' : mcv > 100 || c.high('mcv') ? 'macrocytic' : 'normocytic';
    const typeText = {
      microcytic: 'Small red cells (low MCV) are commonly seen in iron deficiency and also in thalassaemia trait.',
      macrocytic: 'Large red cells (high MCV) can be related to vitamin B12 or folate deficiency, alcohol, thyroid, or liver conditions.',
      normocytic: 'Normal-sized red cells can occur with blood loss, chronic disease, kidney disease, or early deficiency.',
    }[type] || 'Red-cell indices (MCV) were not available to suggest a type.';
    const severity = hb == null ? '' : hb < 8 ? 'severe' : hb < 10 ? 'moderate' : 'mild';
    return finding({
      id: 'anemia', title: `Low haemoglobin${severity ? ` (${severity})` : ''}`, condition: ferritinLow ? 'Possible iron-deficiency anaemia' : 'Possible anaemia', category: 'Blood',
      kind: hb != null && hb < 7 ? 'urgent' : 'possible-condition', evidenceLevel: ferritinLow ? 'strong' : c.low('hematocrit') || c.low('rbc') ? 'moderate' : 'limited',
      urgency: hb != null && hb < 7 ? 'urgent' : hb != null && hb < 8 ? 'soon' : 'routine',
      evidence: c.describe('hemoglobin', 'rbc', 'hematocrit', 'mcv', 'ferritin', 'iron', 'vitamin_b12'),
      explanation: `Haemoglobin is below the reference range, which is the laboratory definition of anaemia. ${typeText}${ferritinLow ? ' Low ferritin supports iron deficiency.' : type === 'microcytic' ? ' Iron studies (ferritin) would help confirm the cause.' : ''}`,
      nextSteps: [hb != null && hb < 7 ? 'Very low haemoglobin needs urgent medical care.' : 'See a doctor to find the cause; ferritin, iron studies, B12, or folate tests may be advised.', 'Do not start iron or other supplements without medical advice — the cause matters.'],
      keys: ['hemoglobin'],
    });
  },
  (c) => (c.high('hemoglobin') || c.high('hematocrit') ? finding({ id: 'hb-high', title: 'High haemoglobin / haematocrit', condition: null, category: 'Blood', kind: 'abnormal-pattern', evidenceLevel: 'limited', evidence: c.describe('hemoglobin', 'hematocrit'), explanation: 'This can be caused by dehydration, smoking, living at altitude, lung disease, or less commonly a bone-marrow condition.', nextSteps: ['Discuss with a doctor; repeat testing when well hydrated may be advised.'], keys: ['hemoglobin', 'hematocrit'] }) : null),
  (c) => (c.low('ferritin') && !c.low('hemoglobin') ? finding({ id: 'iron-low', title: 'Low iron stores', condition: 'Possible iron deficiency (without anaemia)', category: 'Blood', evidenceLevel: 'moderate', evidence: c.describe('ferritin', 'iron', 'transferrin_saturation'), explanation: 'Low ferritin suggests depleted iron stores, even though haemoglobin is not low.', nextSteps: ['Discuss the possible cause and management with a doctor.'], keys: ['ferritin'] }) : null),
  (c) => {
    const keys = ['vitamin_b12', 'folate', 'vitamin_d'].filter((k) => c.low(k));
    if (!keys.length) return null;
    return finding({ id: 'vitamins-low', title: 'Low vitamin level', condition: `Possible ${keys.map((k) => ({ vitamin_b12: 'vitamin B12', folate: 'folate', vitamin_d: 'vitamin D' })[k]).join(' / ')} deficiency`, category: 'Nutrition', evidenceLevel: 'moderate', evidence: c.describe(...keys), explanation: `Below the reference range.${c.val('vitamin_d') != null && c.val('vitamin_d') < 20 ? ' Vitamin D below 20 ng/mL is generally considered deficient; 20–29 ng/mL insufficient.' : ''}`, nextSteps: ['Ask a doctor whether supplementation is appropriate and at what dose — do not self-dose.'], keys });
  },
  (c) => {
    const wbc = c.get('wbc');
    if (!wbc || !['high', 'low'].includes(wbc.status)) return null;
    if (wbc.status === 'low') {
      const urgent = c.val('anc') != null && c.val('anc') < 500;
      return finding({ id: 'wbc-low', title: 'Low white blood cell count', condition: 'Leukopenia (cause not determined)', category: 'Blood', kind: urgent ? 'urgent' : 'abnormal-pattern', evidenceLevel: 'limited', urgency: urgent ? 'urgent' : 'soon', evidence: c.describe('wbc', 'anc', 'neutrophils'), explanation: 'A low white cell count can follow viral infections or be caused by medicines, autoimmune conditions, or bone-marrow problems.', nextSteps: [urgent ? 'Very low neutrophils increase infection risk — seek urgent care for any fever.' : 'Discuss with a doctor; a repeat count is often advised.'], keys: ['wbc'] });
    }
    const supporting = ['neutrophils', 'crp', 'esr', 'procalcitonin'].filter((k) => c.high(k));
    const fever = c.val('temperature') >= 38;
    return finding({
      id: 'wbc-high', title: 'Raised white blood cell count', condition: supporting.length || fever ? 'Possible infection or inflammation' : 'Leukocytosis (cause not determined)', category: 'Infection / inflammation', kind: 'abnormal-pattern',
      evidenceLevel: supporting.length + (fever ? 1 : 0) >= 2 ? 'moderate' : 'limited', urgency: wbc.canonicalValue > 30000 ? 'soon' : 'routine',
      evidence: c.describe('wbc', ...supporting, 'temperature'),
      explanation: `A raised white cell count most often reflects infection or inflammation; stress, smoking, steroids, and, rarely, blood disorders can also raise it.${c.high('neutrophils') ? ' A neutrophil-predominant rise is often seen with bacterial infection.' : ''} The type of infection cannot be identified from a blood count.`,
      nextSteps: ['See a doctor, especially with fever, pain, or other symptoms.'], keys: ['wbc', ...supporting],
    });
  },
  (c) => {
    const keys = ['crp', 'esr', 'procalcitonin'].filter((k) => c.high(k));
    if (!keys.length || c.high('wbc')) return null;
    return finding({ id: 'inflammation', title: 'Raised inflammation markers', condition: 'Inflammation (cause not determined)', category: 'Infection / inflammation', kind: 'abnormal-pattern', evidenceLevel: 'limited', evidence: c.describe(...keys, 'temperature'), explanation: 'CRP/ESR rise with infection, injury, and inflammatory conditions. They show that inflammation is present, not its cause.', nextSteps: ['Discuss with a doctor in the context of symptoms.'], keys });
  },
  (c) => (c.high('eosinophils') ? finding({ id: 'eosinophils', title: 'Raised eosinophils', condition: null, category: 'Blood', kind: 'abnormal-pattern', evidenceLevel: 'limited', evidence: c.describe('eosinophils'), explanation: 'Commonly associated with allergic conditions (asthma, eczema, hay fever) or parasitic infections.', nextSteps: ['Discuss with a doctor if there are allergy symptoms or relevant travel history.'], keys: ['eosinophils'] }) : null),
  (c) => {
    const p = c.get('platelets');
    if (!p || !['high', 'low'].includes(p.status)) return null;
    if (p.status === 'high') return finding({ id: 'platelets-high', title: 'Raised platelet count', condition: 'Thrombocytosis (cause not determined)', category: 'Blood', kind: 'abnormal-pattern', evidenceLevel: 'limited', evidence: c.describe('platelets'), explanation: 'Often a reaction to infection, inflammation, or iron deficiency; less commonly a bone-marrow condition.', nextSteps: ['Discuss with a doctor; a repeat count may be advised.'], keys: ['platelets'] });
    const v = p.canonicalValue;
    const dengue = c.positive('dengue_ns1') || c.positive('dengue_igm');
    return finding({ id: 'platelets-low', title: 'Low platelet count', condition: 'Thrombocytopenia (cause not determined)', category: 'Blood', kind: v < 20000 ? 'urgent' : 'abnormal-pattern', evidenceLevel: 'limited', urgency: v < 20000 ? 'urgent' : v < 50000 || dengue ? 'soon' : 'routine', evidence: c.describe('platelets', 'dengue_ns1', 'dengue_igm'), explanation: `Low platelets can follow viral infections${dengue ? ' (including dengue, which is positive on this report)' : ''}, or be caused by medicines, liver disease, or immune conditions. Clumping in the sample can also give a falsely low count.`, nextSteps: [v < 20000 ? 'Very low platelets need urgent medical care, especially with bleeding.' : 'See a doctor; seek urgent care for bleeding gums, nosebleeds, blood in urine/stool, or many bruises.'], keys: ['platelets'] });
  },
  (c) => {
    const keys = ['inr', 'pt', 'aptt'].filter((k) => c.high(k));
    if (!keys.length) return null;
    return finding({ id: 'clotting', title: 'Prolonged clotting time', condition: 'Clotting abnormality (cause not determined)', category: 'Blood', kind: 'abnormal-pattern', evidenceLevel: 'limited', urgency: c.val('inr') > 3 ? 'soon' : 'routine', evidence: c.describe(...keys), explanation: 'Prolonged clotting tests are expected in people taking blood thinners such as warfarin, and can otherwise reflect liver disease or vitamin K deficiency.', nextSteps: ['Discuss with the doctor managing any blood thinner — do not change the dose yourself. Seek urgent care for unusual bleeding.'], keys });
  },

  // ---- Thyroid ----
  (c) => {
    const tsh = c.get('tsh');
    const t4Low = c.low('ft4') || c.low('t4');
    const t4High = c.high('ft4') || c.high('t4');
    const t3High = c.high('ft3') || c.high('t3');
    const t4Known = c.get('ft4') || c.get('t4');
    if (tsh?.status === 'high') {
      return finding({
        id: 'tsh-high', title: 'Raised TSH', category: 'Thyroid',
        condition: t4Low ? 'Pattern consistent with hypothyroidism (underactive thyroid)' : t4Known ? 'Pattern consistent with subclinical hypothyroidism' : 'Possible underactive thyroid — free T4 needed',
        evidenceLevel: t4Low ? 'strong' : t4Known ? 'moderate' : 'limited', evidence: c.describe('tsh', 'ft4', 't4', 'ft3', 't3'),
        explanation: t4Low ? 'High TSH with low T4 is the typical pattern of primary hypothyroidism.' : t4Known ? 'High TSH with normal T4 is called subclinical hypothyroidism; it is often rechecked before any decision.' : 'TSH alone cannot confirm a thyroid condition; free T4 is needed. TSH can also be temporarily raised during recovery from illness.',
        nextSteps: ['See a doctor; repeat TSH with free T4 (and possibly thyroid antibodies) is commonly advised.'], keys: ['tsh'],
      });
    }
    if (tsh?.status === 'low') {
      return finding({
        id: 'tsh-low', title: 'Low TSH', category: 'Thyroid',
        condition: t4High || t3High ? 'Pattern consistent with hyperthyroidism (overactive thyroid)' : t4Known ? 'Pattern consistent with subclinical hyperthyroidism' : 'Possible overactive thyroid — free T4/T3 needed',
        evidenceLevel: t4High || t3High ? 'strong' : t4Known ? 'moderate' : 'limited', urgency: t4High || t3High ? 'soon' : 'routine', evidence: c.describe('tsh', 'ft4', 't4', 'ft3', 't3'),
        explanation: t4High || t3High ? 'Low TSH with high thyroid hormones is the typical pattern of an overactive thyroid.' : 'Low TSH alone can be caused by thyroid medicine, recent illness, or early overactivity; free T4/T3 are needed.',
        nextSteps: ['See a doctor for further thyroid assessment; seek urgent care for a racing heart, chest pain, or severe agitation.'], keys: ['tsh'],
      });
    }
    if (tsh?.status === 'normal' && (t4Low || t4High)) return finding({ id: 't4-only', title: 'Thyroid hormone outside range with normal TSH', condition: null, category: 'Thyroid', kind: 'abnormal-pattern', evidenceLevel: 'limited', evidence: c.describe('tsh', 'ft4', 't4'), explanation: 'This combination is often caused by recent illness, medicines, or testing factors rather than thyroid disease.', nextSteps: ['Discuss with a doctor; repeat testing may be advised.'], keys: ['ft4', 't4'] });
    if (!tsh && (t4Low || t4High)) return finding({ id: 't4-no-tsh', title: 'Thyroid hormone outside range', condition: null, category: 'Thyroid', kind: 'abnormal-pattern', evidenceLevel: 'limited', evidence: c.describe('ft4', 't4', 'ft3', 't3'), explanation: 'Without TSH, thyroid function cannot be interpreted reliably.', nextSteps: ['Ask a doctor about a TSH test.'], keys: ['ft4', 't4'] });
    return null;
  },

  // ---- Electrolytes ----
  (c) => {
    const keys = ['sodium', 'potassium', 'calcium', 'chloride', 'bicarbonate', 'magnesium', 'phosphorus'].filter((k) => ['high', 'low'].includes(c.status(k)));
    if (!keys.length) return null;
    const critical = keys.some((k) => c.get(k).severity === 'critical');
    return finding({ id: 'electrolytes', title: 'Electrolyte imbalance', condition: null, category: 'Electrolytes', kind: critical ? 'urgent' : 'abnormal-pattern', evidenceLevel: 'moderate', urgency: critical ? 'urgent' : 'soon', evidence: c.describe(...keys), explanation: `Salts such as sodium and potassium outside the reference range can affect the heart, muscles, and brain. Causes include fluid loss, kidney conditions, hormones, and medicines.${critical ? ' At least one value is in a range that is usually treated as urgent.' : ''}`, nextSteps: [critical ? 'Seek urgent medical care.' : 'Discuss promptly with a doctor; repeat testing is usually needed.'], keys });
  },

  // ---- Vital signs / acute illness ----
  (c) => {
    const keys = [];
    if (c.val('spo2') != null && c.val('spo2') < 95) keys.push('spo2');
    if (c.val('respiratory_rate') > 20) keys.push('respiratory_rate');
    if (c.val('heart_rate') > 100 || (c.val('heart_rate') != null && c.val('heart_rate') < 50)) keys.push('heart_rate');
    if (c.val('temperature') >= 38 || (c.val('temperature') != null && c.val('temperature') < 35)) keys.push('temperature');
    if (c.val('gcs') != null && c.val('gcs') < 15) keys.push('gcs');
    if (!keys.length) return null;
    const qsofa = [c.val('respiratory_rate') >= 22, c.get('blood_pressure')?.systolic <= 100, c.val('gcs') != null && c.val('gcs') < 15].filter(Boolean).length;
    const urgent = c.below('spo2', 92) || qsofa >= 2 || c.below('gcs', 13) || c.val('heart_rate') > 130 || c.val('respiratory_rate') > 28 || c.val('temperature') >= 40;
    const feverOnly = keys.length === 1 && keys[0] === 'temperature' && c.val('temperature') >= 38;
    return finding({
      id: 'vitals', title: urgent ? 'Abnormal vital signs — possible medical emergency' : feverOnly ? 'Fever' : 'Abnormal vital signs', condition: urgent ? 'Warning signs of serious illness' : null, category: 'Vital signs',
      kind: urgent ? 'urgent' : 'abnormal-pattern', evidenceLevel: 'moderate', urgency: urgent ? 'urgent' : 'soon',
      evidence: c.describe(...keys, 'blood_pressure'),
      explanation: `${urgent ? 'This combination of vital signs (for example low oxygen, fast breathing, low blood pressure, or reduced consciousness) is a recognised warning sign of serious illness such as severe infection or heart or lung problems.' : feverOnly ? 'A temperature of 38 °C or above is a fever, usually caused by infection.' : 'One or more vital signs are outside the usual adult range.'}${qsofa >= 2 ? ' Two or more qSOFA criteria are present.' : ''}`,
      nextSteps: [urgent ? 'Seek emergency medical care immediately.' : 'Seek medical advice, sooner if symptoms worsen.'], keys,
    });
  },

  // ---- Infection tests ----
  (c) => {
    const tests = { dengue_ns1: 'dengue', dengue_igm: 'dengue', malaria: 'malaria', typhoid_igm: 'typhoid', covid: 'COVID-19', hiv: 'HIV' };
    const keys = Object.keys(tests).filter((k) => c.positive(k));
    if (!keys.length) return null;
    const names = [...new Set(keys.map((k) => tests[k]))];
    return finding({ id: 'infection-tests', title: `Positive ${names.join(' / ')} test`, condition: `Possible ${names.join(' / ')} infection`, category: 'Infection', kind: 'screening-result', evidenceLevel: 'moderate', urgency: keys.some((k) => ['dengue_ns1', 'dengue_igm', 'malaria'].includes(k)) ? 'soon' : 'routine', evidence: c.describe(...keys), explanation: `A positive result needs to be interpreted by a doctor${keys.includes('hiv') ? '; HIV screening results always require confirmatory testing and counselling' : ''}${keys.includes('typhoid_igm') ? '; rapid typhoid antibody tests have frequent false positives' : ''}.`, nextSteps: ['See a doctor promptly. Seek urgent care for warning signs such as bleeding, severe abdominal pain, persistent vomiting, confusion, or breathlessness.'], keys });
  },
  (c) => {
    const keys = [];
    if (c.positive('urine_nitrite')) keys.push('urine_nitrite');
    if (c.positive('urine_leukocyte_esterase')) keys.push('urine_leukocyte_esterase');
    if (c.high('urine_pus_cells')) keys.push('urine_pus_cells');
    if (!keys.length) return null;
    return finding({ id: 'uti-pattern', title: 'Signs of possible urinary infection', condition: 'Possible urinary tract infection', category: 'Urinary', evidenceLevel: keys.length >= 2 ? 'moderate' : 'limited', evidence: c.describe(...keys), explanation: 'White cells, nitrite, or leukocyte esterase in urine can indicate infection, but they can also come from sample contamination. Symptoms and a urine culture are needed to confirm.', nextSteps: ['See a doctor if there is burning, frequent urination, fever, or back pain; a urine culture may be advised.'], keys });
  },
  (c) => (c.positive('urine_blood') || c.high('urine_rbc') ? finding({ id: 'hematuria', title: 'Blood in urine', condition: null, category: 'Urinary', kind: 'abnormal-pattern', evidenceLevel: 'limited', evidence: c.describe('urine_blood', 'urine_rbc'), explanation: 'Causes include infection, kidney stones, menstruation, vigorous exercise, and kidney or bladder conditions.', nextSteps: ['Discuss with a doctor; a repeat urine test is usually advised.'], keys: ['urine_blood', 'urine_rbc'] }) : null),
  (c) => (c.positive('urine_glucose') && !(c.val('hba1c') >= 6.5 || c.val('glucose_fasting') >= 126 || c.val('glucose_random') >= 200 || c.val('glucose_pp') >= 200) ? finding({ id: 'glycosuria', title: 'Glucose in urine', condition: null, category: 'Metabolic', kind: 'abnormal-pattern', evidenceLevel: 'limited', evidence: c.describe('urine_glucose'), explanation: 'Glucose in urine usually reflects high blood sugar; some medicines (SGLT2 inhibitors) and kidney conditions also cause it.', nextSteps: ['Ask a doctor about blood glucose or HbA1c testing.'], keys: ['urine_glucose'] }) : null),

  // ---- Tumour markers ----
  (c) => {
    const names = { psa: 'PSA', cea: 'CEA', ca125: 'CA-125', ca199: 'CA 19-9', ca153: 'CA 15-3', afp: 'AFP' };
    const keys = Object.keys(names).filter((k) => c.high(k));
    if (!keys.length) return null;
    return finding({ id: 'tumour-markers', title: `Raised tumour marker (${keys.map((k) => names[k]).join(', ')})`, condition: null, category: 'Cancer screening', kind: 'screening-result', evidenceLevel: 'limited', urgency: 'soon', evidence: c.describe(...keys), explanation: 'Tumour markers are NOT a cancer diagnosis. They can be raised by non-cancerous conditions (for example prostate enlargement or infection for PSA, smoking for CEA, menstruation or endometriosis for CA-125). Cancer can only be diagnosed by specialist evaluation, imaging, and usually a biopsy.', nextSteps: ['Arrange a doctor’s review to decide whether repeat testing or specialist referral is needed.'], keys });
  },
  (c) => {
    const bmi = c.val('bmi');
    if (bmi == null || (bmi >= 18.5 && bmi < 25)) return null;
    return finding({ id: 'bmi', title: bmi >= 30 ? 'BMI in the obesity range' : bmi >= 25 ? 'BMI in the overweight range' : 'BMI in the underweight range', condition: null, category: 'Metabolic', kind: 'abnormal-pattern', evidenceLevel: 'moderate', evidence: c.describe('bmi'), explanation: 'BMI is a screening measure; it does not account for muscle mass or body-fat distribution.', nextSteps: ['Discuss healthy weight goals with a doctor or dietitian.'], keys: ['bmi'] });
  },
];

const URGENCY_ORDER = { urgent: 0, soon: 1, routine: 2 };
const EVIDENCE_ORDER = { strong: 0, moderate: 1, limited: 2 };

export function deriveFindings(evaluated, patient = {}) {
  const context = makeContext(evaluated, patient);
  return RULES.map((rule) => rule(context)).filter(Boolean)
    .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] || EVIDENCE_ORDER[a.evidenceLevel] - EVIDENCE_ORDER[b.evidenceLevel]);
}

export { describe as describeMeasurement };
