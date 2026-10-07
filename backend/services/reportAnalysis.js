// Report analysis pipeline:
//   file validation -> text/OCR extraction -> structured values -> reference-range evaluation
//   -> rule-based possible findings -> Gemini educational explanation (validated) -> result
// Every number shown to the user comes from the uploaded report. Nothing here is hardcoded per
// disease, and a report without readable values returns "Insufficient information".
import { extractReportText } from './reportExtraction.js';
import { parseReportText } from './labParser.js';
import { evaluateMeasurement, deriveFindings, describeMeasurement } from './clinicalRules.js';
import { generateReportExplanation, isGeminiEnabled, transcribeReportWithGemini } from './reportAI.js';

export const ANALYSIS_ENGINE_VERSION = '2.0.0';
export const INSUFFICIENT_MESSAGE = 'Insufficient information for a reliable interpretation.';
export const NORMAL_MESSAGE = 'Based on the available values, no major abnormality was identified.';
const DISCLAIMER = 'This is an AI-assisted educational interpretation, not a medical diagnosis. Findings are possibilities based only on the values in this report and must be reviewed by a qualified healthcare professional.';

const SEVERITY_WEIGHT = { critical: 40, marked: 20, moderate: 10, mild: 4 };
const CATEGORY_LABEL = { blood: 'Blood count', metabolic: 'Diabetes & metabolism', cardiovascular: 'Heart & lipids', kidney: 'Kidney', liver: 'Liver', thyroid: 'Thyroid', electrolytes: 'Electrolytes', nutrition: 'Vitamins & iron', inflammation: 'Inflammation', coagulation: 'Clotting', 'tumour-marker': 'Tumour markers', urine: 'Urine', infection: 'Infection tests', vitals: 'Vital signs' };

function inferReportType(evaluated, fileType) {
  const categories = new Set(evaluated.map((e) => e.category));
  const parts = Object.entries(CATEGORY_LABEL).filter(([key]) => categories.has(key)).map(([, label]) => label);
  if (!parts.length) return fileType === 'application/pdf' ? 'PDF report' : 'Image report';
  return parts.length > 3 ? `Multi-panel report (${parts.slice(0, 3).join(', ')} +${parts.length - 3})` : parts.join(', ');
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function suggestionsFor(categories, findings, insufficient) {
  const has = (...names) => names.some((n) => categories.has(n));
  const ids = new Set(findings.map((f) => f.id));
  const lifestyle = ['Keep a record of your symptoms, medicines, and supplements to share with your doctor.'];
  const exercise = [];
  const diet = { breakfast: 'A balanced breakfast with whole grains, fruit, and a protein source', lunch: 'Vegetables, whole grains, and a lean protein', dinner: 'A lighter balanced meal with vegetables', snacks: 'Fruit, unsalted nuts, or yoghurt', avoid: ['Sugary drinks', 'Highly processed, salty packaged foods'], eatMore: ['Vegetables', 'Whole grains', 'Fibre-rich foods'], water: 'Drink to thirst; follow your doctor’s advice if fluids are restricted', protein: 'Individual needs vary; ask a doctor or dietitian', calories: 'Individual needs vary by age, size, and activity' };
  if (has('metabolic') || ids.has('dyslipidemia')) {
    lifestyle.push('Regular physical activity and gradual weight management can improve blood sugar and lipid levels.');
    diet.avoid.push('Refined sugar and white-flour snacks', 'Fried and fatty fast food');
    diet.eatMore.push('Legumes and pulses', 'Oats and other soluble fibre');
    exercise.push('Aim for about 150 minutes of moderate activity per week if your doctor says it is safe.');
  }
  if (ids.has('liver-enzymes') || ids.has('bilirubin')) {
    lifestyle.push('Avoid alcohol until you have discussed these liver results with a doctor.');
  }
  if (ids.has('kidney-function') || ids.has('proteinuria')) {
    lifestyle.push('Do not change your fluid, salt, or protein intake drastically without advice from a doctor — kidney needs are individual.');
    diet.water = 'Ask your doctor how much fluid is right for you';
    diet.protein = 'Ask your doctor — protein needs change with kidney function';
  }
  if (ids.has('anemia') || ids.has('iron-low')) diet.eatMore.push('Iron-rich foods such as leafy greens, legumes, and lean meat or fish');
  if (ids.has('uric-acid')) diet.avoid.push('Excess red meat, organ meat, and sugary drinks');
  if (ids.has('bp-high')) diet.avoid.push('High-salt foods such as pickles, chips, and processed meats');
  if (!exercise.length) exercise.push('Regular moderate activity, such as brisk walking, if medically suitable.');
  exercise.push('Stop and seek medical advice for chest pain, faintness, or unusual breathlessness.');
  if (findings.some((f) => f.urgency === 'urgent')) {
    exercise.length = 0;
    exercise.push('Avoid strenuous activity until a doctor has reviewed the urgent findings in this report.');
  }
  return {
    lifestyleSuggestions: unique(lifestyle),
    exerciseSuggestions: unique(exercise),
    sleepSuggestions: ['Aim for 7–9 hours of regular sleep.'],
    hydrationSuggestions: [diet.water],
    stressSuggestions: ['Breathing exercises, social support, and relaxation breaks can help manage stress.'],
    medicineSuggestions: ['Do not start, stop, or change any medicine or supplement based on this analysis. Discuss any changes with your doctor or pharmacist.'],
    dietPlan: insufficient ? { ...diet, avoid: [], eatMore: [] } : { ...diet, avoid: unique(diet.avoid), eatMore: unique(diet.eatMore) },
  };
}

function buildRuleSummary({ evaluated, judged, abnormal, findings, insufficient, urgent }) {
  if (insufficient) {
    return {
      summary: `${INSUFFICIENT_MESSAGE} No measurable laboratory values or vital signs could be read from this file, so no condition has been suggested.`,
      doctorExplanation: 'The analysis only uses values that are actually printed on the report. Try uploading a clearer image or the original PDF from the laboratory, and discuss the report with a doctor.',
    };
  }
  if (!abnormal.length) {
    return {
      summary: `${NORMAL_MESSAGE} ${judged.length} value${judged.length === 1 ? ' was' : 's were'} checked against reference ranges. This does not rule out every medical condition — only the tests in this report were assessed.`,
      doctorExplanation: 'All interpretable values are within their reference ranges. Continue routine check-ups as advised by your doctor, and seek advice for any symptoms regardless of these results.',
    };
  }
  const titles = findings.map((f) => f.condition || f.title);
  return {
    summary: `${evaluated.length} values were read from this report; ${abnormal.length} ${abnormal.length === 1 ? 'is' : 'are'} outside the reference range.${titles.length ? ` Possible findings: ${titles.slice(0, 4).join('; ')}${titles.length > 4 ? `; and ${titles.length - 4} more` : ''}.` : ''}${urgent ? ' Some findings may need urgent medical attention.' : ''} These are possibilities based on the report values, not a diagnosis.`,
    doctorExplanation: findings.length
      ? findings.slice(0, 4).map((f) => `${f.title}: ${f.explanation}`).join(' ')
      : 'Some values are outside the reference range but do not form a recognised pattern on their own. Discuss them with a doctor, who can interpret them with your symptoms and history.',
  };
}

export async function analyzeReport({ buffer, mimeType, requestId = 'report', previousScores = [] }) {
  // 1-2. Validate and extract text
  const extraction = await extractReportText(buffer);
  let text = extraction.text;
  let method = extraction.method;
  const warnings = [...extraction.warnings];

  // 3. Structured values
  let parsed = parseReportText(text);

  // Fallback: scanned PDF / unreadable photo -> Gemini transcription, then the same parser.
  if (parsed.measurements.length === 0 && (extraction.method !== 'pdf-text') && isGeminiEnabled()) {
    const transcript = await transcribeReportWithGemini(buffer, extraction.fileType || mimeType, requestId);
    if (transcript) {
      const transcribed = parseReportText(transcript);
      if (transcribed.measurements.length) {
        parsed = transcribed;
        text = `${text}\n\n--- AI transcription (Gemini) ---\n${transcript}`;
        method = `${method}+gemini-transcription`;
        warnings.push('Values were transcribed from the image by AI. Check each value against your original report.');
      }
    }
  }

  // 4. Reference-range evaluation
  const { patient } = parsed;
  const evaluated = parsed.measurements.map((m) => evaluateMeasurement(m, patient));
  const implausible = evaluated.filter((e) => e.status === 'implausible');
  const judged = evaluated.filter((e) => ['normal', 'high', 'low', 'abnormal'].includes(e.status));
  const abnormal = judged.filter((e) => e.status !== 'normal');
  const insufficient = judged.length === 0;
  if (implausible.length) warnings.push(`Some values look implausible and were not interpreted (possible reading error): ${implausible.map((e) => `${e.name} ${e.valueText}${e.unit ? ` ${e.unit}` : ''}`).join(', ')}.`);
  if (evaluated.some((e) => e.rangeUsed?.source === 'default-adult')) warnings.push('Some values had no reference range printed on the report; typical adult ranges were used for those and are marked in the table.');
  if (evaluated.some((e) => e.unitAssumed)) warnings.push('Some values had no unit printed; the most likely unit was assumed and is marked in the table.');

  // 5. Possible findings
  const findings = insufficient ? [] : deriveFindings(evaluated, patient);
  const urgentFindings = findings.filter((f) => f.urgency === 'urgent');
  const reportType = inferReportType(evaluated, extraction.fileType);

  // 6. AI educational explanation
  const ruleText = buildRuleSummary({ evaluated, judged, abnormal, findings, insufficient, urgent: urgentFindings.length > 0 });
  const ai = insufficient
    ? { used: false, reason: 'Not requested: no values to explain' }
    : await generateReportExplanation({ patient, evaluated, findings, reportType }, requestId);

  // Scores derived only from this report's values
  const score = judged.length ? Math.round(((judged.length - abnormal.length) / judged.length) * 100) : null;
  const riskScore = insufficient ? null : Math.min(100, abnormal.reduce((sum, e) => sum + (SEVERITY_WEIGHT[e.severity] || 4), 0) + urgentFindings.length * 20);
  const riskLevel = insufficient ? 'Unknown'
    : urgentFindings.length || abnormal.some((e) => e.severity === 'critical') ? 'High'
      : findings.some((f) => f.urgency === 'soon' || f.evidenceLevel !== 'limited') || abnormal.some((e) => ['marked', 'moderate'].includes(e.severity)) ? 'Medium'
        : 'Low';
  const prediction = insufficient ? 'Insufficient information'
    : findings.length ? `${findings[0].condition || findings[0].title}${findings.length > 1 ? ` (+${findings.length - 1} more)` : ''}`
      : abnormal.length ? `${abnormal.length} value${abnormal.length > 1 ? 's' : ''} outside range` : 'No major abnormality identified';

  const categories = new Set(abnormal.map((e) => e.category));
  const suggestions = suggestionsFor(categories, findings, insufficient);
  const nextSteps = unique(findings.flatMap((f) => f.nextSteps));
  const limitations = unique([
    'Only the tests printed in this report were assessed; conditions that these tests do not measure cannot be ruled in or out.',
    'Reference ranges depend on the laboratory, age, sex, pregnancy, and testing method. The report’s own ranges were used wherever they were printed.',
    judged.length > 0 && judged.length < 4 ? 'Very few values were available, so the interpretation is limited.' : null,
    'Symptoms, medical history, and medicines are not known to this system and can change the meaning of results.',
  ]);

  const analysis = {
    engineVersion: ANALYSIS_ENGINE_VERSION,
    reportDate: new Date().toISOString(),
    reportType,
    insufficientInformation: insufficient,
    summary: ai.used ? ai.summary : ruleText.summary,
    doctorExplanation: ai.used ? ai.doctorExplanation : ruleText.doctorExplanation,
    ruleBasedSummary: ruleText.summary,
    aiExplanation: ai.used
      ? { used: true, provider: ai.provider, model: ai.model, keyPoints: ai.keyPoints, questionsForDoctor: ai.questionsForDoctor }
      : { used: false, reason: ai.reason },
    prediction,
    riskLevel,
    riskScore,
    score,
    patient,
    possibleConditions: findings,
    urgentFindings: urgentFindings.map((f) => ({ title: f.title, nextSteps: f.nextSteps })),
    measurements: evaluated.map((e) => ({
      key: e.key, name: e.name, label: e.label, category: e.category,
      value: e.value, valueText: e.valueText, unit: e.unit || '', comparator: e.comparator || null,
      canonicalValue: e.canonicalValue != null ? Number(e.canonicalValue.toFixed(3)) : null, canonicalUnit: e.canonicalUnit || null, unitAssumed: Boolean(e.unitAssumed),
      referenceRange: e.rangeUsed?.text || null, referenceSource: e.rangeUsed?.source || null,
      status: e.status, severity: e.severity, flags: e.flags || [], comment: e.comment || null, rawLine: e.rawLine,
    })),
    keyFindings: insufficient ? [INSUFFICIENT_MESSAGE] : abnormal.length ? abnormal.slice(0, 8).map(describeMeasurement) : [NORMAL_MESSAGE],
    observations: unique([
      `${evaluated.length} value${evaluated.length === 1 ? '' : 's'} extracted (${method})`,
      judged.length ? `${judged.length - abnormal.length} of ${judged.length} interpretable values within reference range` : null,
      urgentFindings.length ? `${urgentFindings.length} finding${urgentFindings.length > 1 ? 's' : ''} may need urgent care` : null,
      ...(ai.used ? ai.keyPoints : []),
    ]),
    abnormalValues: abnormal.map((e) => ({ name: e.name, value: `${e.valueText}${e.unit ? ` ${e.unit}` : ''}`, status: e.status === 'abnormal' ? 'Positive' : e.status === 'high' ? 'High' : 'Low', severity: e.severity === 'critical' ? 'critical' : e.severity === 'marked' ? 'high' : e.severity === 'moderate' ? 'medium' : 'low', referenceRange: e.rangeUsed?.text || null })),
    risks: insufficient ? [] : [
      { name: 'Outside range (marked/critical)', value: abnormal.filter((e) => ['critical', 'marked'].includes(e.severity)).length, color: '#e84b4b' },
      { name: 'Outside range (mild/moderate)', value: abnormal.filter((e) => !['critical', 'marked'].includes(e.severity)).length, color: '#f2a93b' },
      { name: 'Within range', value: judged.length - abnormal.length, color: '#18a984' },
    ].filter((r) => r.value > 0),
    recommendations: insufficient
      ? ['Upload the original laboratory PDF or a clear, well-lit photo of the full report.', 'Discuss the report directly with a qualified doctor.']
      : unique([...(urgentFindings.length ? ['Some findings may be urgent — seek prompt medical care.'] : []), ...nextSteps, 'Discuss all out-of-range values with a qualified doctor, who can interpret them with your symptoms and history.']),
    ...suggestions,
    medicalRecommendations: {
      consultation: insufficient ? 'A doctor can interpret this report directly.' : urgentFindings.length ? 'Seek urgent medical care for the findings marked urgent.' : findings.some((f) => f.urgency === 'soon') ? 'Arrange a doctor’s appointment soon to review these results.' : abnormal.length ? 'Routine review with a doctor is recommended.' : 'No specific follow-up is suggested by these values; continue routine check-ups.',
      additionalTests: unique(findings.flatMap((f) => f.nextSteps.filter((s) => /test|repeat|screen|ultrasound|culture|ferritin|tsh|t4|hba1c|rna|study|studies/i.test(s)))),
      monitoring: abnormal.length ? ['Repeat out-of-range tests at the interval your doctor advises.'] : [],
      prevention: ['Keep up routine screening and vaccinations', 'Avoid tobacco and limit alcohol', 'Balanced diet and regular physical activity'],
    },
    // Each value as a percentage of its reference limit (units differ, so raw values are not comparable on one axis).
    metrics: evaluated.filter((e) => e.value != null && e.rangeUsed && (e.rangeUsed.high || e.rangeUsed.low) && e.rangeUsed.source !== 'guideline').slice(0, 12).map((e) => {
      const ref = e.status === 'low' && e.rangeUsed.low ? e.rangeUsed.low : e.rangeUsed.high || e.rangeUsed.low;
      const value = e.rangeUsed.source === 'default-adult' ? e.canonicalValue : e.value;
      return { name: e.label || e.name, value: Math.round((value / ref) * 100), normal: 100 };
    }),
    vitals: evaluated.filter((e) => e.category === 'vitals').map((e) => ({ name: e.name, value: e.key === 'blood_pressure' ? e.systolic : Number((e.canonicalValue ?? e.value).toFixed(1)), label: `${e.valueText} ${e.unit || ''}`.trim() })),
    trend: [...previousScores, ...(score != null ? [{ name: 'This report', score }] : [])],
    extraction: { method, fileType: extraction.fileType, pages: extraction.pages, characters: text.length, ocrConfidence: extraction.ocrConfidence, valuesFound: evaluated.length },
    warnings: unique(warnings),
    limitations,
    disclaimer: DISCLAIMER,
  };

  return { analysis, extractedText: text, extraction: analysis.extraction, aiPrompt: ai.prompt || null };
}
