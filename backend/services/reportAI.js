// Gemini integration for report analysis (backend only — GEMINI_API_KEY never reaches the browser).
// Gemini receives the structured values that were extracted from THIS report plus the rule-engine
// findings, and is asked for an educational explanation grounded only in that data. Its output is
// checked by validateAIExplanation before it is shown; on any failure the rule-based text is used.
import { describeMeasurement } from './clinicalRules.js';

const DEFAULT_MODEL = 'gemini-flash-latest';

export function isGeminiEnabled() {
  return Boolean(process.env.GEMINI_API_KEY) && process.env.AI_PROVIDER?.toLowerCase() !== 'local';
}

async function callGemini(options, attempt = 1) {
  try {
    return await requestGemini(options);
  } catch (error) {
    // One retry for temporary overload / rate limiting.
    if (attempt < 2 && error.retryable) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      return callGemini(options, attempt + 1);
    }
    throw error;
  }
}

async function requestGemini({ systemInstruction, parts, json = false, maxOutputTokens = 1500, timeoutMs = 45000 }) {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.2, maxOutputTokens, ...(json ? { responseMimeType: 'application/json' } : {}) },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Gemini request failed with status ${response.status}`);
    // Retry only temporary overload; retrying a quota (429) error just spends more of the quota.
    error.retryable = [500, 503].includes(response.status);
    throw error;
  }
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!text) throw new Error('Gemini returned an empty response');
  return { text, model };
}

// ---------------------------------------------------------------------------------------------
// Explanation

export function buildReportPrompt({ patient, evaluated, findings, reportType }) {
  const lines = evaluated
    .filter((e) => e.status !== 'implausible')
    .map((e) => `- ${describeMeasurement(e)}${e.rangeUsed?.source === 'default-adult' ? ' [no range printed on report; typical adult range used]' : ''}`);
  const findingLines = findings.map((f) => `- ${f.title}${f.condition ? ` → ${f.condition}` : ''} (evidence: ${f.evidenceLevel}; urgency: ${f.urgency})`);
  return [
    `Report type: ${reportType}`,
    `Patient: age ${patient.age ?? 'not stated'}, sex ${patient.sex ?? 'not stated'}`,
    '',
    'Values extracted from the uploaded report (value, unit, reference range, status):',
    ...(lines.length ? lines : ['- (no measurable values could be extracted)']),
    '',
    'Findings produced by the rule-based reference-range engine:',
    ...(findingLines.length ? findingLines : ['- No abnormal pattern detected by the rule engine.']),
  ].join('\n');
}

const SYSTEM_INSTRUCTION = `You are a careful health-education assistant explaining a laboratory/medical report to a patient.
Rules you must follow:
- Use ONLY the values listed in the prompt. Never invent, estimate, or assume values, symptoms, history, or test results that are not listed.
- Do not diagnose. Describe findings as "possible", "may suggest", or "can be seen with". Never say a disease is confirmed and never claim certainty or a percentage accuracy.
- A single abnormal value is not enough for a diagnosis; say so where relevant.
- Do not recommend, name, start, stop, or dose any medication or supplement.
- If values are within range, say no major abnormality was identified in the available values, and that this does not rule out every condition.
- If very few values are available, say the information is limited.
- For any urgent findings listed, clearly advise prompt or emergency medical care.
- Plain language, short sentences, suitable for a non-medical reader.
Respond with JSON only, matching exactly:
{"summary": string (3-5 sentences), "doctorExplanation": string (a fuller explanation, 4-8 sentences), "keyPoints": string[] (max 6), "questionsForDoctor": string[] (max 5)}`;

const BANNED = [
  /\b100\s*%\s*(accurate|certain|sure|confirmed)/i,
  /\b(definitely|certainly) (have|has)\b/i,
  /\byou have (diabetes|cancer|hepatitis|anaemia|anemia|hypothyroidism|hyperthyroidism|kidney disease|heart disease|tuberculosis)/i,
  /\bconfirmed (diagnosis|disease)\b/i,
  /\b(take|start|stop|increase|decrease)\s+(\d+|your)\s*(mg|mcg|iu|units|tablets?|medication|medicine)/i,
  /\b\d+(\.\d+)?\s*(mg|mcg|µg|iu)\s+(daily|once|twice|per day|a day)/i,
];

export function validateAIExplanation(output, evaluated) {
  if (!output || typeof output.summary !== 'string' || typeof output.doctorExplanation !== 'string') return { ok: false, reason: 'missing fields' };
  const text = [output.summary, output.doctorExplanation, ...(output.keyPoints || []), ...(output.questionsForDoctor || [])].join(' ');
  const banned = BANNED.find((pattern) => pattern.test(text));
  if (banned) return { ok: false, reason: `unsafe wording (${banned})` };
  // Every decimal or 3+ digit number mentioned must exist in the supplied data (guards against invented values).
  const allowed = new Set();
  for (const e of evaluated) {
    for (const n of [e.value, e.systolic, e.diastolic, e.canonicalValue, e.rangeUsed?.low, e.rangeUsed?.high, e.reportRange?.low, e.reportRange?.high]) {
      if (n != null && Number.isFinite(n)) { allowed.add(String(n)); allowed.add(String(Number(n.toFixed(1)))); allowed.add(String(Math.round(n))); }
    }
    (e.valueText || '').split(/[^\d.]+/).filter(Boolean).forEach((part) => allowed.add(String(Number(part))));
    (e.rangeUsed?.text || '').split(/[^\d.]+/).filter(Boolean).forEach((part) => allowed.add(String(Number(part))));
  }
  const GUIDELINE_NUMBERS = ['100', '125', '126', '140', '199', '200', '5.7', '6.4', '6.5', '130', '160', '190', '150', '500', '180', '120', '1.73', '38.0', '38'];
  GUIDELINE_NUMBERS.forEach((n) => allowed.add(n));
  const numbers = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
  const invented = numbers.map((n) => String(Number(n.replace(/,/g, '')))).filter((n) => (n.includes('.') || n.length >= 3) && !allowed.has(n));
  if (invented.length) return { ok: false, reason: `numbers not present in report data: ${invented.slice(0, 5).join(', ')}` };
  return { ok: true };
}

export async function generateReportExplanation(input, requestId = 'report') {
  if (!isGeminiEnabled()) return { used: false, reason: 'Gemini disabled (AI_PROVIDER=local or no GEMINI_API_KEY)' };
  const prompt = buildReportPrompt(input);
  try {
    const { text, model } = await callGemini({ systemInstruction: SYSTEM_INSTRUCTION, parts: [{ text: prompt }], json: true });
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    const check = validateAIExplanation(parsed, input.evaluated);
    if (!check.ok) {
      console.warn(`[report:${requestId}] Gemini explanation rejected: ${check.reason}`);
      return { used: false, reason: `AI output rejected by safety check: ${check.reason}`, prompt };
    }
    return {
      used: true, provider: 'gemini', model, prompt,
      summary: parsed.summary.trim(),
      doctorExplanation: parsed.doctorExplanation.trim(),
      keyPoints: (parsed.keyPoints || []).filter((p) => typeof p === 'string').slice(0, 6),
      questionsForDoctor: (parsed.questionsForDoctor || []).filter((p) => typeof p === 'string').slice(0, 5),
    };
  } catch (error) {
    console.error(`[report:${requestId}] Gemini explanation failed:`, error.message);
    return { used: false, reason: `Gemini unavailable: ${error.message}`, prompt };
  }
}

// ---------------------------------------------------------------------------------------------
// Transcription fallback for scanned PDFs / photos that local extraction could not read.
// Gemini is asked to transcribe (not interpret) the report; the result goes through the same
// parser and rule engine, and is labelled as AI-transcribed so the user verifies it.

export async function transcribeReportWithGemini(buffer, mimeType, requestId = 'report') {
  if (!isGeminiEnabled()) return null;
  try {
    const { text } = await callGemini({
      systemInstruction: 'You transcribe medical laboratory reports exactly. Output plain text only, one test per line, in the form: Test name <space> result <space> unit <space> reference range. Include vital signs (e.g. "Blood Pressure 120/80 mmHg") and patient age/sex lines if printed. Copy numbers exactly as printed. Do not add, interpret, correct, or infer anything. If the image is not a medical report or is unreadable, output exactly: UNREADABLE',
      parts: [{ inlineData: { mimeType, data: buffer.toString('base64') } }, { text: 'Transcribe this report.' }],
      maxOutputTokens: 4000,
      timeoutMs: 60000,
    });
    if (/^UNREADABLE\b/i.test(text)) return '';
    return text;
  } catch (error) {
    console.error(`[report:${requestId}] Gemini transcription failed:`, error.message);
    return null;
  }
}
