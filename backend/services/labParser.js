// Turns the text extracted from a medical report into structured measurements.
// It only records what is printed on the report (value, unit, reference range, flag);
// judging the values happens in clinicalRules.js.
import { ALIAS_INDEX, ANALYTE_BY_KEY, normaliseUnit } from './labCatalog.js';

const NUMBER = String.raw`\d[\d,]*(?:\.\d+)?`;
const QUALITATIVE = /^(non[\s-]?reactive|reactive|positive|negative|not\s+detected|detected|nil|absent|present|trace|\+{1,4}|[1-4]\+)(?![a-z])/i;
const FLAG = /^(h|l|hh|ll|high|low|critical|crit|abnormal|\*|↑|↓|\(h\)|\(l\))$/i;
const FILLER_WORDS = new Set(['serum', 'plasma', 'level', 'levels', 'result', 'value', 'test', 'calculated', 'calc', 'by', 'method', 'whole', 's.', 'conc', 'concentration']);
const HEADER_WORDS = /profile|panel|function|routine|examination|urinalysis|urine|haematology|hematology|biochemistry|chemistry|count|vitals|vital signs|serology|investigations|thyroid|lipid|diabetes|liver|kidney|renal/i;
// When we are inside a urine section, these blood analytes refer to the urine sample instead.
const URINE_REMAP = { glucose_random: 'urine_glucose', glucose_fasting: 'urine_glucose', hemoglobin: 'urine_blood', wbc: 'urine_pus_cells', rbc: 'urine_rbc', albumin: 'urine_protein', total_protein: 'urine_protein' };

export function parseNumber(text) {
  if (text == null) return null;
  const raw = String(text).trim();
  // "11,800" -> 11800 (thousands separator); "1,9" -> 1.9 (decimal comma)
  const cleaned = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.');
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

function normaliseLine(line) {
  return line
    .replace(/[₂²]/g, '2').replace(/[₃³]/g, '3')
    .replace(/[–—−]/g, '-')
    .replace(/\t+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[•●▪*\-]\s*/, '')
    .trim();
}

function isSectionHeader(line) {
  if (/\d/.test(line.replace(/\b(t3|t4|b12|19-9|125|15-3|1st|2nd|3rd)\b/gi, ''))) return false;
  const words = line.split(' ');
  return words.length <= 6 && HEADER_WORDS.test(line);
}

export function parseReferenceRange(text = '') {
  const source = text.replace(/[–—−]/g, '-');
  let match = source.match(new RegExp(`(${NUMBER})\\s*(?:-|to)\\s*(${NUMBER})`, 'i'));
  if (match) return { low: parseNumber(match[1]), high: parseNumber(match[2]), text: match[0].trim() };
  match = source.match(new RegExp(`(?:<=?|≤|up\\s*to|upto|less\\s+than|below)\\s*(${NUMBER})`, 'i'));
  if (match) return { low: null, high: parseNumber(match[1]), text: match[0].trim() };
  match = source.match(new RegExp(`(?:>=?|≥|more\\s+than|greater\\s+than|above)\\s*(${NUMBER})`, 'i'));
  if (match) return { low: parseNumber(match[1]), high: null, text: match[0].trim() };
  return null;
}

function stripFiller(rest) {
  let text = rest;
  for (let i = 0; i < 6; i += 1) {
    const before = text;
    text = text.replace(/^[\s:=,.]+/, '').replace(/^-(?!\s*\d)\s*/, '');
    text = text.replace(/^\(([^)]*[a-z][^)]*)\)\s*/i, ''); // "(SGOT)", "(Hexokinase)"
    const word = text.split(' ')[0]?.toLowerCase();
    if (word && FILLER_WORDS.has(word)) text = text.slice(word.length);
    if (text === before) break;
  }
  return text.trim();
}

function matchAnalyte(line, inUrine) {
  const lower = line.toLowerCase();
  for (const { alias, analyte } of ALIAS_INDEX) {
    if (!lower.startsWith(alias)) continue;
    const next = lower.charAt(alias.length);
    if (next && !/[\s:(,=\-\[]/.test(next)) continue; // "hb" must not match "hba1c", "ldl" not "ldl/hdl"
    let target = analyte;
    if (inUrine && !analyte.urineContext) {
      if (!URINE_REMAP[analyte.key]) continue;
      target = ANALYTE_BY_KEY[URINE_REMAP[analyte.key]];
    }
    if (!inUrine && analyte.urineContext && !/urine|pus|leuk|hpf|\(urine\)/.test(alias)) continue;
    let rest = line.slice(alias.length);
    // "Glucose, Fasting 102" / "Blood Sugar (PP) 180" — checked before parentheses are stripped
    if (target.key === 'glucose_random') {
      const timing = rest.match(/^[\s:,.-]*\(?\s*(fasting|f|pp|post\s*prandial|random|r)\s*\)?[\s:,-]+/i);
      if (timing) {
        const word = timing[1].toLowerCase();
        target = ANALYTE_BY_KEY[word.startsWith('f') ? 'glucose_fasting' : word.startsWith('p') ? 'glucose_pp' : 'glucose_random'];
        rest = rest.slice(timing[0].length);
      }
    }
    rest = stripFiller(rest);
    const startsWithValue = /^([<>≤≥]=?\s*)?\d/.test(rest) || QUALITATIVE.test(rest);
    if (!startsWithValue) continue;
    return { analyte: target, label: line.slice(0, alias.length).trim(), rest };
  }
  return null;
}

function splitUnitAndTail(afterValue) {
  const tokens = afterValue.split(' ').filter(Boolean);
  const flags = [];
  const unitTokens = [];
  let index = 0;
  for (; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (FLAG.test(token)) { flags.push(token.replace(/[()]/g, '').toUpperCase()); continue; }
    const looksLikeRange = /^[<>≤≥]/.test(token) || /^\d/.test(token) && !/^10[\^*e]/.test(token) || /^(up|upto|less|more|greater|below|above|-)$/i.test(token);
    if (looksLikeRange) break;
    const looksLikeUnit = /[a-zµμ%°/^]/i.test(token) && unitTokens.length < 2 && (unitTokens.length === 0 || token.startsWith('/') || unitTokens[0].endsWith('/') || /^x?10[\^*e]/i.test(unitTokens[0]));
    if (!looksLikeUnit) break;
    unitTokens.push(token);
  }
  const tail = tokens.slice(index).join(' ');
  const trailingFlags = tail.split(' ').filter((token) => FLAG.test(token) && token.length <= 4);
  return { unit: unitTokens.join(' '), flags: [...flags, ...trailingFlags.map((f) => f.replace(/[()]/g, '').toUpperCase())], tail };
}

function toCanonical(analyte, value, unitNormalised) {
  if (value == null || !analyte.unit) return { canonicalValue: null, unitAssumed: false };
  const convert = (factor) => (typeof factor === 'function' ? factor(value) : value * factor);
  const inPlausible = (v) => !analyte.plausible || (v >= analyte.plausible[0] && v <= analyte.plausible[1]);
  if (unitNormalised && Object.prototype.hasOwnProperty.call(analyte.units, unitNormalised)) {
    return { canonicalValue: convert(analyte.units[unitNormalised]), unitAssumed: false };
  }
  // No (or unrecognised) unit: try the analyte's usual units and keep the first plausible one.
  for (const factor of analyte.guess || []) {
    const candidate = convert(factor);
    if (inPlausible(candidate)) return { canonicalValue: candidate, unitAssumed: true };
  }
  // No usual unit gives a plausible value (e.g. OCR dropped a decimal point: BMI "228").
  return { canonicalValue: null, unitAssumed: false, implausible: Boolean(analyte.guess?.length) };
}

export function parseLine(rawLine, { inUrine = false } = {}) {
  const line = normaliseLine(rawLine);
  if (line.length < 3) return null;
  const matched = matchAnalyte(line, inUrine);
  if (!matched) return null;
  const { analyte, label, rest } = matched;
  const base = { key: analyte.key, name: analyte.name, category: analyte.category, label, rawLine: line };

  if (analyte.special === 'bp') {
    const bp = rest.match(/^(\d{2,3})\s*\/\s*(\d{2,3})/);
    if (!bp) return null;
    const { tail } = splitUnitAndTail(rest.slice(bp[0].length).trim());
    return { ...base, systolic: Number(bp[1]), diastolic: Number(bp[2]), value: Number(bp[1]), valueText: `${bp[1]}/${bp[2]}`, unit: 'mmHg', canonicalUnit: 'mmHg', canonicalValue: Number(bp[1]), reportRange: null, flags: [], comment: tail.replace(/^mm\s*hg/i, '').trim() || null };
  }

  const qualitative = rest.match(QUALITATIVE);
  if (qualitative) {
    const word = qualitative[1].replace(/\s+/g, ' ');
    const tailTokens = rest.slice(qualitative[0].length).trim().split(' ').filter(Boolean);
    const flags = tailTokens.filter((token) => FLAG.test(token)).map((token) => token.replace(/[()]/g, '').toUpperCase());
    const expected = tailTokens.filter((token) => !FLAG.test(token) && !token.startsWith('/')).join(' ');
    return { ...base, qualitative: word, value: null, valueText: word, unit: '', reportRange: expected ? { low: null, high: null, text: expected } : null, flags, comment: null, canonicalValue: null, canonicalUnit: analyte.unit || null };
  }
  if (analyte.qualitative) return null;

  // Urine microscopy is often written as a range: "Pus cells 8-10 /hpf"
  if (analyte.unit === '/hpf') {
    const span = rest.match(/^(\d+)\s*-\s*(\d+)/);
    if (span) {
      const { unit, flags, tail } = splitUnitAndTail(rest.slice(span[0].length).trim());
      const value = Number(span[2]);
      return { ...base, value, valueText: `${span[1]}-${span[2]}`, comparator: null, unit: unit || '/hpf', unitNormalised: '/hpf', canonicalValue: value, canonicalUnit: '/hpf', unitAssumed: !unit, reportRange: parseReferenceRange(tail), flags, comment: null };
    }
  }

  const numeric = rest.match(new RegExp(`^([<>≤≥]=?)?\\s*(${NUMBER})`));
  if (!numeric) return null;
  const value = parseNumber(numeric[2]);
  const { unit, flags, tail } = splitUnitAndTail(rest.slice(numeric[0].length).trim());
  const unitNormalised = normaliseUnit(unit);
  const reportRange = parseReferenceRange(tail);
  const comment = reportRange ? null : (tail.replace(/\b(h|l)\b/gi, '').trim() || null);
  return {
    ...base,
    value,
    valueText: `${numeric[1] || ''}${numeric[2]}`,
    comparator: numeric[1] || null,
    unit,
    unitNormalised,
    canonicalUnit: analyte.unit,
    ...toCanonical(analyte, value, unitNormalised),
    reportRange,
    flags,
    comment,
  };
}

export function parsePatientDetails(text = '') {
  const patient = { age: null, sex: null };
  const combined = text.match(/(\d{1,3})\s*(?:y|yr|yrs|years?)\b\.?\s*(?:\/|,|-)?\s*(male|female|m|f)\b/i);
  if (combined) {
    patient.age = Number(combined[1]);
    patient.sex = combined[2].toLowerCase().startsWith('f') ? 'female' : 'male';
  }
  if (patient.age == null) {
    const age = text.match(/\bage\b[^\d\n]{0,12}(\d{1,3})/i);
    if (age && Number(age[1]) < 120) patient.age = Number(age[1]);
  }
  if (!patient.sex) {
    const sex = text.match(/\b(?:sex|gender)\b[^a-z\n]{0,12}(male|female|m|f)\b/i);
    if (sex) patient.sex = sex[1].toLowerCase().startsWith('f') ? 'female' : 'male';
  }
  return patient;
}

export function parseReportText(text = '') {
  const measurements = [];
  const seen = new Set();
  let inUrine = false;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = normaliseLine(rawLine);
    if (!line) continue;
    if (isSectionHeader(line)) { inUrine = /urine|urinalysis/i.test(line); continue; }
    const measurement = parseLine(line, { inUrine });
    if (!measurement) continue;
    // Keep the first occurrence of each test (later repeats are usually summary tables).
    if (seen.has(measurement.key)) continue;
    seen.add(measurement.key);
    measurements.push(measurement);
  }
  return { patient: parsePatientDetails(text), measurements };
}
