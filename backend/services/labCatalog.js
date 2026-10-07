// Catalog of laboratory analytes and vital signs that the report parser recognises.
//
// - aliases: names as they appear on lab reports (matched at the start of a line, longest first)
// - unit: canonical unit used for guideline thresholds in clinicalRules.js
// - units: normalised unit -> factor (or function) converting a value into the canonical unit
// - guess: factors tried when the report prints no unit (first plausible one wins, flagged as assumed)
// - plausible: canonical bounds; values outside are treated as probable extraction errors
// - range: FALLBACK adult reference range in the canonical unit. It is only used when the
//   report does not print its own reference range. Sex-specific ranges use {male, female}.
// - qualitative: test reports Positive/Negative/Reactive etc. instead of a number

const per_uL = { '/ul': 1, 'cells/ul': 1, 'k/ul': 1000, 'lakh/ul': 100000, 'm/ul': 1e6 };

export const ANALYTES = [
  // ---------------- Complete blood count ----------------
  { key: 'hemoglobin', name: 'Hemoglobin', category: 'blood', aliases: ['hemoglobin', 'haemoglobin', 'hb', 'hgb', 'hb%'], unit: 'g/dL', units: { 'g/dl': 1, 'g/l': 0.1, 'gm/dl': 1, 'gm%': 1, 'g%': 1, 'mmol/l': 1.611 }, guess: [1, 0.1], plausible: [2, 25], range: { male: [13.0, 17.0], female: [12.0, 15.5] } },
  { key: 'wbc', name: 'White blood cell count (WBC)', category: 'blood', aliases: ['wbc', 'wbc count', 'total wbc count', 'total wbc', 'total leucocyte count', 'total leukocyte count', 'tlc', 'white blood cell count', 'white blood cells', 'white cell count', 'leucocyte count', 'leukocyte count'], unit: '/uL', units: per_uL, guess: [1, 1000], plausible: [200, 300000], range: [4000, 11000] },
  { key: 'platelets', name: 'Platelet count', category: 'blood', aliases: ['platelet count', 'platelets', 'plt', 'platelet', 'plt count'], unit: '/uL', units: per_uL, guess: [1, 1000, 100000], plausible: [1000, 2000000], range: [150000, 450000] },
  { key: 'rbc', name: 'Red blood cell count (RBC)', category: 'blood', aliases: ['rbc', 'rbc count', 'red blood cell count', 'red blood cells', 'total rbc count', 'erythrocyte count'], unit: 'million/uL', units: { 'm/ul': 1, '/ul': 1e-6, 'cells/ul': 1e-6 }, guess: [1], plausible: [1, 9], range: { male: [4.5, 5.9], female: [4.0, 5.2] } },
  { key: 'hematocrit', name: 'Hematocrit (PCV)', category: 'blood', aliases: ['hematocrit', 'haematocrit', 'pcv', 'hct', 'packed cell volume', 'pcv / hematocrit', 'pcv/hematocrit', 'pcv / haematocrit'], unit: '%', units: { '%': 1, 'l/l': 100 }, guess: [1, 100], plausible: [10, 70], range: { male: [40, 52], female: [36, 48] } },
  { key: 'mcv', name: 'MCV', category: 'blood', aliases: ['mcv', 'mean corpuscular volume', 'mean cell volume'], unit: 'fL', units: { fl: 1 }, guess: [1], plausible: [50, 130], range: [80, 100] },
  { key: 'mch', name: 'MCH', category: 'blood', aliases: ['mch', 'mean corpuscular hemoglobin', 'mean corpuscular haemoglobin'], unit: 'pg', units: { pg: 1 }, guess: [1], plausible: [15, 45], range: [27, 33] },
  { key: 'mchc', name: 'MCHC', category: 'blood', aliases: ['mchc', 'mean corpuscular hemoglobin concentration', 'mean corpuscular haemoglobin concentration'], unit: 'g/dL', units: { 'g/dl': 1, 'g/l': 0.1, '%': 1 }, guess: [1], plausible: [20, 45], range: [32, 36] },
  { key: 'rdw', name: 'RDW', category: 'blood', aliases: ['rdw', 'rdw-cv', 'rdw cv', 'red cell distribution width'], unit: '%', units: { '%': 1 }, guess: [1], plausible: [8, 30], range: [11.5, 14.5] },
  { key: 'neutrophils', name: 'Neutrophils', category: 'blood', aliases: ['neutrophils', 'neutrophil', 'polymorphs', 'segmented neutrophils'], unit: '%', units: { '%': 1 }, guess: [1], plausible: [0, 100], range: [40, 75] },
  { key: 'lymphocytes', name: 'Lymphocytes', category: 'blood', aliases: ['lymphocytes', 'lymphocyte'], unit: '%', units: { '%': 1 }, guess: [1], plausible: [0, 100], range: [20, 40] },
  { key: 'monocytes', name: 'Monocytes', category: 'blood', aliases: ['monocytes', 'monocyte'], unit: '%', units: { '%': 1 }, guess: [1], plausible: [0, 100], range: [2, 10] },
  { key: 'eosinophils', name: 'Eosinophils', category: 'blood', aliases: ['eosinophils', 'eosinophil'], unit: '%', units: { '%': 1 }, guess: [1], plausible: [0, 100], range: [1, 6] },
  { key: 'basophils', name: 'Basophils', category: 'blood', aliases: ['basophils', 'basophil'], unit: '%', units: { '%': 1 }, guess: [1], plausible: [0, 100], range: [0, 2] },
  { key: 'anc', name: 'Absolute neutrophil count', category: 'blood', aliases: ['absolute neutrophil count', 'anc'], unit: '/uL', units: per_uL, guess: [1, 1000], plausible: [0, 200000], range: [1500, 8000] },
  { key: 'esr', name: 'ESR', category: 'inflammation', aliases: ['esr', 'erythrocyte sedimentation rate'], unit: 'mm/hr', units: { 'mm/hr': 1, 'mm/h': 1, 'mm/1sthr': 1, 'mm/1st hr': 1, 'mm': 1 }, guess: [1], plausible: [0, 160], range: { male: [0, 15], female: [0, 20] } },
  { key: 'crp', name: 'C-reactive protein (CRP)', category: 'inflammation', aliases: ['crp', 'c-reactive protein', 'c reactive protein', 'crp (quantitative)', 'crp quantitative'], unit: 'mg/L', units: { 'mg/l': 1, 'mg/dl': 10 }, guess: [1], plausible: [0, 600], range: [0, 5] },
  { key: 'hscrp', name: 'hs-CRP', category: 'cardiovascular', aliases: ['hs-crp', 'hs crp', 'hscrp', 'high sensitivity crp', 'high-sensitivity crp'], unit: 'mg/L', units: { 'mg/l': 1, 'mg/dl': 10 }, guess: [1], plausible: [0, 300], range: [0, 3] },
  { key: 'procalcitonin', name: 'Procalcitonin', category: 'inflammation', aliases: ['procalcitonin', 'pct'], unit: 'ng/mL', units: { 'ng/ml': 1, 'ug/l': 1 }, guess: [1], plausible: [0, 1000], range: [0, 0.5] },

  // ---------------- Diabetes ----------------
  { key: 'glucose_fasting', name: 'Fasting glucose', category: 'metabolic', aliases: ['fasting blood sugar', 'fasting blood glucose', 'fasting glucose', 'fasting plasma glucose', 'fasting sugar', 'glucose fasting', 'glucose - fasting', 'glucose (fasting)', 'plasma glucose fasting', 'plasma glucose (fasting)', 'blood sugar fasting', 'blood sugar (fasting)', 'blood glucose fasting', 'blood glucose (fasting)', 'fbs', 'fbg', 'fpg'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mg%': 1, 'mmol/l': 18.016 }, guess: [1, 18.016], plausible: [15, 1500], range: [70, 99] },
  { key: 'glucose_pp', name: 'Post-meal glucose', category: 'metabolic', aliases: ['post prandial sugar', 'post prandial blood sugar', 'post prandial glucose', 'postprandial glucose', 'postprandial blood sugar', 'post prandial plasma glucose', 'pp blood sugar', 'ppbs', 'ppbg', 'glucose pp', 'glucose (pp)', 'glucose - pp', 'glucose post prandial', 'blood sugar pp', 'blood sugar (pp)', '2 hr pp', '2hr pp', '2 hour post prandial'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mg%': 1, 'mmol/l': 18.016 }, guess: [1, 18.016], plausible: [15, 1500], range: [70, 139] },
  { key: 'glucose_random', name: 'Glucose (random / timing not stated)', category: 'metabolic', aliases: ['random blood sugar', 'random blood glucose', 'random glucose', 'random plasma glucose', 'glucose random', 'glucose (random)', 'blood sugar random', 'blood sugar (random)', 'rbs', 'blood glucose', 'blood sugar', 'plasma glucose', 'serum glucose', 'glucose'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mg%': 1, 'mmol/l': 18.016 }, guess: [1, 18.016], plausible: [15, 1500], range: [70, 139] },
  { key: 'hba1c', name: 'HbA1c', category: 'metabolic', aliases: ['hba1c', 'hb a1c', 'hba 1c', 'a1c', 'glycated hemoglobin', 'glycated haemoglobin', 'glycosylated hemoglobin', 'glycosylated haemoglobin', 'glycohemoglobin', 'hemoglobin a1c', 'haemoglobin a1c'], unit: '%', units: { '%': 1, 'mmol/mol': (v) => 0.09148 * v + 2.152 }, guess: [1], plausible: [3, 20], range: [4.0, 5.6] },
  { key: 'eag', name: 'Estimated average glucose', category: 'metabolic', aliases: ['estimated avg glucose', 'estimated average glucose', 'eag', 'mean blood glucose', 'mean plasma glucose'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mmol/l': 18.016 }, guess: [1], plausible: [40, 700], range: null, informational: true },
  { key: 'insulin', name: 'Insulin (fasting)', category: 'metabolic', aliases: ['insulin fasting', 'fasting insulin', 'insulin', 'serum insulin'], unit: 'uIU/mL', units: { 'uiu/ml': 1, 'miu/l': 1, 'pmol/l': 1 / 6 }, guess: [1], plausible: [0, 500], range: [2, 25] },

  // ---------------- Lipids ----------------
  { key: 'total_cholesterol', name: 'Total cholesterol', category: 'cardiovascular', aliases: ['total cholesterol', 'cholesterol total', 'cholesterol, total', 'cholesterol - total', 'serum cholesterol', 's. cholesterol', 't. cholesterol', 'cholesterol'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mmol/l': 38.67 }, guess: [1, 38.67], plausible: [40, 1000], range: [0, 199] },
  { key: 'ldl', name: 'LDL cholesterol', category: 'cardiovascular', aliases: ['ldl cholesterol', 'ldl-cholesterol', 'ldl - cholesterol', 'ldl cholesterol direct', 'ldl-c', 'ldl c', 'ldl', 'low density lipoprotein', 'cholesterol ldl', 'cholesterol - ldl'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mmol/l': 38.67 }, guess: [1, 38.67], plausible: [5, 600], range: [0, 129] },
  { key: 'hdl', name: 'HDL cholesterol', category: 'cardiovascular', aliases: ['hdl cholesterol', 'hdl-cholesterol', 'hdl - cholesterol', 'hdl cholesterol direct', 'hdl-c', 'hdl c', 'hdl', 'high density lipoprotein', 'cholesterol hdl', 'cholesterol - hdl'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mmol/l': 38.67 }, guess: [1, 38.67], plausible: [5, 200], range: { male: [40, null], female: [50, null] } },
  { key: 'triglycerides', name: 'Triglycerides', category: 'cardiovascular', aliases: ['triglycerides', 'triglyceride', 'serum triglycerides', 'tg', 'trigs'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mmol/l': 88.57 }, guess: [1, 88.57], plausible: [10, 10000], range: [0, 149] },
  { key: 'vldl', name: 'VLDL cholesterol', category: 'cardiovascular', aliases: ['vldl', 'vldl cholesterol', 'vldl-cholesterol', 'vldl - cholesterol'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mmol/l': 38.67 }, guess: [1], plausible: [1, 500], range: [2, 30] },
  { key: 'non_hdl', name: 'Non-HDL cholesterol', category: 'cardiovascular', aliases: ['non-hdl cholesterol', 'non hdl cholesterol', 'non-hdl', 'non hdl'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mmol/l': 38.67 }, guess: [1], plausible: [10, 900], range: [0, 129] },
  { key: 'tc_hdl_ratio', name: 'Total cholesterol / HDL ratio', category: 'cardiovascular', aliases: ['tc/hdl ratio', 'tc / hdl ratio', 'total cholesterol/hdl ratio', 'cholesterol/hdl ratio', 'chol/hdl ratio', 'tc/hdl', 'tc : hdl ratio'], unit: 'ratio', units: { ratio: 1 }, guess: [1], plausible: [1, 20], range: [0, 5.0] },
  { key: 'ldl_hdl_ratio', name: 'LDL / HDL ratio', category: 'cardiovascular', aliases: ['ldl/hdl ratio', 'ldl / hdl ratio', 'ldl : hdl ratio', 'ldl/hdl'], unit: 'ratio', units: { ratio: 1 }, guess: [1], plausible: [0.2, 15], range: [0, 3.5] },

  // ---------------- Kidney & electrolytes ----------------
  { key: 'creatinine', name: 'Creatinine', category: 'kidney', aliases: ['serum creatinine', 's. creatinine', 's.creatinine', 'creatinine serum', 'creatinine, serum', 'creatinine'], unit: 'mg/dL', units: { 'mg/dl': 1, 'umol/l': 1 / 88.4, 'mmol/l': 1000 / 88.4 }, guess: [1, 1 / 88.4], plausible: [0.1, 25], range: { male: [0.7, 1.3], female: [0.6, 1.1] } },
  { key: 'urea', name: 'Urea', category: 'kidney', aliases: ['blood urea', 'serum urea', 'urea', 's. urea'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mmol/l': 6.006 }, guess: [1, 6.006], plausible: [2, 500], range: [15, 40] },
  { key: 'bun', name: 'Blood urea nitrogen (BUN)', category: 'kidney', aliases: ['blood urea nitrogen', 'bun', 'urea nitrogen'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mmol/l': 2.8 }, guess: [1, 2.8], plausible: [1, 250], range: [7, 20] },
  { key: 'egfr', name: 'eGFR', category: 'kidney', aliases: ['egfr', 'estimated gfr', 'e-gfr', 'gfr estimated', 'estimated glomerular filtration rate'], unit: 'mL/min/1.73m2', units: { 'ml/min/1.73m2': 1, 'ml/min/1.73 m2': 1, 'ml/min/1.73m²': 1, 'ml/min': 1 }, guess: [1], plausible: [1, 200], range: [60, null] },
  { key: 'uric_acid', name: 'Uric acid', category: 'kidney', aliases: ['uric acid', 'serum uric acid', 's. uric acid'], unit: 'mg/dL', units: { 'mg/dl': 1, 'umol/l': 1 / 59.48 }, guess: [1, 1 / 59.48], plausible: [0.5, 25], range: { male: [3.5, 7.2], female: [2.6, 6.0] } },
  { key: 'sodium', name: 'Sodium', category: 'electrolytes', aliases: ['sodium', 'serum sodium', 's. sodium', 'na', 'na+'], unit: 'mmol/L', units: { 'mmol/l': 1, 'meq/l': 1 }, guess: [1], plausible: [95, 190], range: [135, 145] },
  { key: 'potassium', name: 'Potassium', category: 'electrolytes', aliases: ['potassium', 'serum potassium', 's. potassium', 'k', 'k+'], unit: 'mmol/L', units: { 'mmol/l': 1, 'meq/l': 1 }, guess: [1], plausible: [1, 10], range: [3.5, 5.1] },
  { key: 'chloride', name: 'Chloride', category: 'electrolytes', aliases: ['chloride', 'serum chloride', 'cl', 'cl-'], unit: 'mmol/L', units: { 'mmol/l': 1, 'meq/l': 1 }, guess: [1], plausible: [60, 140], range: [98, 107] },
  { key: 'bicarbonate', name: 'Bicarbonate', category: 'electrolytes', aliases: ['bicarbonate', 'hco3', 'total co2', 'co2'], unit: 'mmol/L', units: { 'mmol/l': 1, 'meq/l': 1 }, guess: [1], plausible: [5, 50], range: [22, 29] },
  { key: 'calcium', name: 'Calcium', category: 'electrolytes', aliases: ['calcium', 'serum calcium', 'total calcium', 's. calcium', 'calcium total'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mmol/l': 4.008 }, guess: [1, 4.008], plausible: [3, 18], range: [8.5, 10.5] },
  { key: 'phosphorus', name: 'Phosphorus', category: 'electrolytes', aliases: ['phosphorus', 'phosphate', 'inorganic phosphorus', 'serum phosphorus'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mmol/l': 3.097 }, guess: [1], plausible: [0.5, 15], range: [2.5, 4.5] },
  { key: 'magnesium', name: 'Magnesium', category: 'electrolytes', aliases: ['magnesium', 'serum magnesium'], unit: 'mg/dL', units: { 'mg/dl': 1, 'mmol/l': 2.431 }, guess: [1], plausible: [0.3, 8], range: [1.7, 2.4] },

  // ---------------- Liver ----------------
  { key: 'bilirubin_total', name: 'Total bilirubin', category: 'liver', aliases: ['total bilirubin', 'bilirubin total', 'bilirubin, total', 'bilirubin - total', 'bilirubin (total)', 'serum bilirubin total', 's. bilirubin total', 'serum bilirubin', 'bilirubin'], unit: 'mg/dL', units: { 'mg/dl': 1, 'umol/l': 1 / 17.1 }, guess: [1, 1 / 17.1], plausible: [0.05, 40], range: [0.3, 1.2] },
  { key: 'bilirubin_direct', name: 'Direct bilirubin', category: 'liver', aliases: ['direct bilirubin', 'bilirubin direct', 'bilirubin, direct', 'bilirubin - direct', 'bilirubin (direct)', 'conjugated bilirubin'], unit: 'mg/dL', units: { 'mg/dl': 1, 'umol/l': 1 / 17.1 }, guess: [1], plausible: [0, 30], range: [0, 0.3] },
  { key: 'bilirubin_indirect', name: 'Indirect bilirubin', category: 'liver', aliases: ['indirect bilirubin', 'bilirubin indirect', 'bilirubin, indirect', 'bilirubin - indirect', 'bilirubin (indirect)', 'unconjugated bilirubin'], unit: 'mg/dL', units: { 'mg/dl': 1, 'umol/l': 1 / 17.1 }, guess: [1], plausible: [0, 30], range: [0.1, 1.0] },
  { key: 'alt', name: 'ALT (SGPT)', category: 'liver', aliases: ['alt', 'sgpt', 'alt (sgpt)', 'sgpt (alt)', 'sgpt/alt', 'alt/sgpt', 'alanine aminotransferase', 'alanine transaminase', 's.g.p.t'], unit: 'U/L', units: { 'u/l': 1, 'iu/l': 1 }, guess: [1], plausible: [1, 10000], range: [7, 55] },
  { key: 'ast', name: 'AST (SGOT)', category: 'liver', aliases: ['ast', 'sgot', 'ast (sgot)', 'sgot (ast)', 'sgot/ast', 'ast/sgot', 'aspartate aminotransferase', 'aspartate transaminase', 's.g.o.t'], unit: 'U/L', units: { 'u/l': 1, 'iu/l': 1 }, guess: [1], plausible: [1, 10000], range: [10, 40] },
  { key: 'alp', name: 'Alkaline phosphatase (ALP)', category: 'liver', aliases: ['alkaline phosphatase', 'alk phos', 'alk. phosphatase', 'alp', 'serum alkaline phosphatase'], unit: 'U/L', units: { 'u/l': 1, 'iu/l': 1 }, guess: [1], plausible: [5, 5000], range: [44, 147] },
  { key: 'ggt', name: 'GGT', category: 'liver', aliases: ['ggt', 'gamma gt', 'gamma-gt', 'ggtp', 'gamma glutamyl transferase', 'gamma glutamyl transpeptidase'], unit: 'U/L', units: { 'u/l': 1, 'iu/l': 1 }, guess: [1], plausible: [1, 5000], range: [0, 55] },
  { key: 'albumin', name: 'Albumin', category: 'liver', aliases: ['albumin', 'serum albumin', 's. albumin'], unit: 'g/dL', units: { 'g/dl': 1, 'g/l': 0.1, 'gm/dl': 1 }, guess: [1, 0.1], plausible: [1, 7], range: [3.5, 5.2] },
  { key: 'total_protein', name: 'Total protein', category: 'liver', aliases: ['total protein', 'total proteins', 'serum total protein', 'protein total', 'protein, total'], unit: 'g/dL', units: { 'g/dl': 1, 'g/l': 0.1, 'gm/dl': 1 }, guess: [1, 0.1], plausible: [2, 14], range: [6.0, 8.3] },
  { key: 'globulin', name: 'Globulin', category: 'liver', aliases: ['globulin', 'serum globulin'], unit: 'g/dL', units: { 'g/dl': 1, 'g/l': 0.1, 'gm/dl': 1 }, guess: [1, 0.1], plausible: [0.5, 10], range: [2.0, 3.5] },

  // ---------------- Thyroid ----------------
  { key: 'tsh', name: 'TSH', category: 'thyroid', aliases: ['tsh', 'tsh (ultrasensitive)', 'ultrasensitive tsh', 'tsh ultrasensitive', 'tsh 3rd generation', 'serum tsh', 's. tsh', 'thyroid stimulating hormone'], unit: 'uIU/mL', units: { 'uiu/ml': 1, 'miu/l': 1, 'mu/l': 1, 'uu/ml': 1, 'microiu/ml': 1 }, guess: [1], plausible: [0.001, 500], range: [0.4, 4.0] },
  { key: 'ft4', name: 'Free T4', category: 'thyroid', aliases: ['free t4', 'ft4', 'free thyroxine', 'f t4', 't4 free', 't4, free'], unit: 'ng/dL', units: { 'ng/dl': 1, 'pmol/l': 0.0777 }, guess: [1, 0.0777], plausible: [0.05, 10], range: [0.8, 1.8] },
  { key: 't4', name: 'Total T4', category: 'thyroid', aliases: ['total t4', 't4 total', 't4, total', 't4', 'thyroxine', 'thyroxine (t4)', 'thyroxine total', 'total thyroxine'], unit: 'ug/dL', units: { 'ug/dl': 1, 'mcg/dl': 1, 'nmol/l': 0.0777 }, guess: [1, 0.0777], plausible: [0.5, 30], range: [5.0, 12.0] },
  { key: 'ft3', name: 'Free T3', category: 'thyroid', aliases: ['free t3', 'ft3', 'free triiodothyronine', 'f t3', 't3 free', 't3, free'], unit: 'pg/mL', units: { 'pg/ml': 1, 'pmol/l': 0.651 }, guess: [1, 0.651], plausible: [0.3, 30], range: [2.3, 4.2] },
  { key: 't3', name: 'Total T3', category: 'thyroid', aliases: ['total t3', 't3 total', 't3, total', 't3', 'triiodothyronine', 'triiodothyronine (t3)', 'total triiodothyronine'], unit: 'ng/dL', units: { 'ng/dl': 1, 'ng/ml': 100, 'nmol/l': 65.1 }, guess: [1, 100], plausible: [10, 1000], range: [80, 200] },

  // ---------------- Vitamins & iron ----------------
  { key: 'vitamin_d', name: 'Vitamin D (25-OH)', category: 'nutrition', aliases: ['vitamin d', 'vitamin d3', 'vitamin d (25-oh)', 'vitamin d 25-hydroxy', '25-oh vitamin d', '25 oh vitamin d', '25-hydroxy vitamin d', '25 hydroxy vitamin d', '25(oh)d', '25(oh) vitamin d', 'vit d', 'vit. d', 'vitamin d total'], unit: 'ng/mL', units: { 'ng/ml': 1, 'nmol/l': 0.4, 'ug/l': 1 }, guess: [1], plausible: [2, 200], range: [30, 100] },
  { key: 'vitamin_b12', name: 'Vitamin B12', category: 'nutrition', aliases: ['vitamin b12', 'vitamin b 12', 'vit b12', 'vit. b12', 'cyanocobalamin', 'cobalamin', 'b12'], unit: 'pg/mL', units: { 'pg/ml': 1, 'pmol/l': 1.355, 'ng/l': 1 }, guess: [1], plausible: [30, 5000], range: [200, 900] },
  { key: 'folate', name: 'Folate', category: 'nutrition', aliases: ['folate', 'folic acid', 'serum folate'], unit: 'ng/mL', units: { 'ng/ml': 1, 'nmol/l': 0.441, 'ug/l': 1 }, guess: [1], plausible: [0.3, 60], range: [3, null] },
  { key: 'ferritin', name: 'Ferritin', category: 'nutrition', aliases: ['ferritin', 'serum ferritin', 's. ferritin'], unit: 'ng/mL', units: { 'ng/ml': 1, 'ug/l': 1 }, guess: [1], plausible: [1, 10000], range: { male: [30, 400], female: [15, 150] } },
  { key: 'iron', name: 'Serum iron', category: 'nutrition', aliases: ['serum iron', 'iron', 's. iron', 'iron serum'], unit: 'ug/dL', units: { 'ug/dl': 1, 'mcg/dl': 1, 'umol/l': 5.585 }, guess: [1], plausible: [5, 500], range: [60, 170] },
  { key: 'tibc', name: 'TIBC', category: 'nutrition', aliases: ['tibc', 'total iron binding capacity'], unit: 'ug/dL', units: { 'ug/dl': 1, 'mcg/dl': 1, 'umol/l': 5.585 }, guess: [1], plausible: [50, 800], range: [250, 450] },
  { key: 'transferrin_saturation', name: 'Transferrin saturation', category: 'nutrition', aliases: ['transferrin saturation', '% saturation', 'tsat', 'iron saturation'], unit: '%', units: { '%': 1 }, guess: [1], plausible: [1, 100], range: [20, 50] },

  // ---------------- Cardiac & coagulation ----------------
  // Troponin assays and units differ widely, so only the report's own range is trusted.
  { key: 'troponin', name: 'Troponin', category: 'cardiovascular', aliases: ['troponin i', 'troponin t', 'troponin', 'hs troponin i', 'hs-troponin i', 'hs troponin t', 'hs-troponin t', 'hs-ctni', 'hs-ctnt', 'trop i', 'trop t', 'cardiac troponin'], unit: null, units: {}, guess: [], plausible: null, range: null },
  { key: 'nt_probnp', name: 'NT-proBNP', category: 'cardiovascular', aliases: ['nt-probnp', 'nt probnp', 'nt-pro bnp', 'nt pro bnp'], unit: 'pg/mL', units: { 'pg/ml': 1, 'ng/l': 1 }, guess: [1], plausible: [5, 70000], range: [0, 125] },
  { key: 'bnp', name: 'BNP', category: 'cardiovascular', aliases: ['bnp', 'b-type natriuretic peptide', 'brain natriuretic peptide'], unit: 'pg/mL', units: { 'pg/ml': 1, 'ng/l': 1 }, guess: [1], plausible: [1, 10000], range: [0, 100] },
  { key: 'inr', name: 'INR', category: 'coagulation', aliases: ['inr', 'pt inr', 'pt-inr', 'international normalized ratio', 'international normalised ratio'], unit: 'ratio', units: { ratio: 1 }, guess: [1], plausible: [0.5, 15], range: [0.8, 1.2] },
  { key: 'pt', name: 'Prothrombin time (PT)', category: 'coagulation', aliases: ['prothrombin time', 'pt', 'pt (test)', 'pt patient'], unit: 'seconds', units: { seconds: 1, sec: 1, secs: 1, s: 1 }, guess: [1], plausible: [5, 150], range: [11, 13.5] },
  { key: 'aptt', name: 'aPTT', category: 'coagulation', aliases: ['aptt', 'a.p.t.t', 'ptt', 'activated partial thromboplastin time', 'partial thromboplastin time'], unit: 'seconds', units: { seconds: 1, sec: 1, secs: 1, s: 1 }, guess: [1], plausible: [10, 200], range: [25, 35] },
  { key: 'd_dimer', name: 'D-dimer', category: 'coagulation', aliases: ['d-dimer', 'd dimer'], unit: null, units: {}, guess: [], plausible: null, range: null },

  // ---------------- Tumour markers (screening/monitoring tools, never diagnostic alone) ----------------
  { key: 'psa', name: 'PSA', category: 'tumour-marker', aliases: ['psa', 'total psa', 'psa total', 'prostate specific antigen', 'psa (total)'], unit: 'ng/mL', units: { 'ng/ml': 1, 'ug/l': 1 }, guess: [1], plausible: [0, 10000], range: [0, 4.0] },
  { key: 'cea', name: 'CEA', category: 'tumour-marker', aliases: ['cea', 'carcinoembryonic antigen'], unit: 'ng/mL', units: { 'ng/ml': 1, 'ug/l': 1 }, guess: [1], plausible: [0, 10000], range: [0, 5.0] },
  { key: 'ca125', name: 'CA-125', category: 'tumour-marker', aliases: ['ca-125', 'ca 125', 'ca125', 'cancer antigen 125'], unit: 'U/mL', units: { 'u/ml': 1, 'ku/l': 1 }, guess: [1], plausible: [0, 100000], range: [0, 35] },
  { key: 'ca199', name: 'CA 19-9', category: 'tumour-marker', aliases: ['ca 19-9', 'ca19-9', 'ca 19.9', 'ca19.9', 'cancer antigen 19-9'], unit: 'U/mL', units: { 'u/ml': 1, 'ku/l': 1 }, guess: [1], plausible: [0, 100000], range: [0, 37] },
  { key: 'ca153', name: 'CA 15-3', category: 'tumour-marker', aliases: ['ca 15-3', 'ca15-3', 'ca 15.3', 'cancer antigen 15-3'], unit: 'U/mL', units: { 'u/ml': 1, 'ku/l': 1 }, guess: [1], plausible: [0, 100000], range: [0, 30] },
  { key: 'afp', name: 'Alpha-fetoprotein (AFP)', category: 'tumour-marker', aliases: ['afp', 'alpha fetoprotein', 'alpha-fetoprotein'], unit: 'ng/mL', units: { 'ng/ml': 1, 'ug/l': 1, 'iu/ml': 1.21 }, guess: [1], plausible: [0, 100000], range: [0, 10] },

  // ---------------- Urine ----------------
  { key: 'urine_protein', name: 'Urine protein', category: 'urine', aliases: ['urine protein', 'protein (urine)', 'urine albumin', 'albumin (urine)', 'urine albumin (qualitative)', 'protein'], qualitative: true, urineContext: true },
  { key: 'urine_glucose', name: 'Urine glucose', category: 'urine', aliases: ['urine glucose', 'urine sugar', 'glucose (urine)', 'sugar (urine)', 'sugar'], qualitative: true, urineContext: true },
  { key: 'urine_ketones', name: 'Urine ketones', category: 'urine', aliases: ['urine ketones', 'ketone bodies', 'ketones', 'acetone'], qualitative: true, urineContext: true },
  { key: 'urine_nitrite', name: 'Urine nitrite', category: 'urine', aliases: ['urine nitrite', 'nitrite', 'nitrites'], qualitative: true, urineContext: true },
  { key: 'urine_leukocyte_esterase', name: 'Leukocyte esterase', category: 'urine', aliases: ['leukocyte esterase', 'leucocyte esterase', 'leukocytes (urine)'], qualitative: true, urineContext: true },
  { key: 'urine_blood', name: 'Urine blood', category: 'urine', aliases: ['urine blood', 'occult blood', 'blood (urine)'], qualitative: true, urineContext: true },
  { key: 'urine_pus_cells', name: 'Urine pus cells', category: 'urine', aliases: ['pus cells', 'pus cell', 'urine pus cells', 'wbc (urine)', 'urine wbc', 'leukocytes/hpf'], unit: '/hpf', units: { '/hpf': 1, hpf: 1 }, guess: [1], plausible: [0, 500], range: [0, 5], urineContext: true },
  { key: 'urine_rbc', name: 'Urine RBCs', category: 'urine', aliases: ['urine rbc', 'rbc (urine)', 'red blood cells (urine)', 'rbcs (urine)'], unit: '/hpf', units: { '/hpf': 1, hpf: 1 }, guess: [1], plausible: [0, 500], range: [0, 2], urineContext: true },
  { key: 'urine_specific_gravity', name: 'Urine specific gravity', category: 'urine', aliases: ['specific gravity', 'sp. gravity', 'sp gravity', 'urine specific gravity'], unit: '', units: { '': 1 }, guess: [1], plausible: [1.0, 1.06], range: [1.005, 1.030], urineContext: true },

  // ---------------- Infection serology / rapid tests (screening results) ----------------
  { key: 'hbsag', name: 'Hepatitis B surface antigen (HBsAg)', category: 'infection', aliases: ['hbsag', 'hbs ag', 'hepatitis b surface antigen', 'australia antigen'], qualitative: true },
  { key: 'anti_hcv', name: 'Hepatitis C antibody (anti-HCV)', category: 'infection', aliases: ['anti hcv', 'anti-hcv', 'hcv antibody', 'hcv', 'hepatitis c antibody'], qualitative: true },
  { key: 'hiv', name: 'HIV 1/2 antibody screen', category: 'infection', aliases: ['hiv 1 & 2 antibody', 'hiv 1&2', 'hiv i & ii', 'hiv 1/2', 'hiv antibody', 'hiv'], qualitative: true },
  { key: 'dengue_ns1', name: 'Dengue NS1 antigen', category: 'infection', aliases: ['dengue ns1 antigen', 'dengue ns1', 'ns1 antigen', 'ns1'], qualitative: true },
  { key: 'dengue_igm', name: 'Dengue IgM', category: 'infection', aliases: ['dengue igm', 'dengue igm antibody'], qualitative: true },
  { key: 'malaria', name: 'Malaria test', category: 'infection', aliases: ['malaria parasite', 'malarial parasite', 'malaria antigen', 'malaria rapid test', 'mp', 'malaria'], qualitative: true },
  { key: 'typhoid_igm', name: 'Typhoid IgM', category: 'infection', aliases: ['typhoid igm', 'typhidot igm', 'salmonella typhi igm', 'typhidot'], qualitative: true },
  { key: 'covid', name: 'COVID-19 test', category: 'infection', aliases: ['sars-cov-2', 'covid-19 rt-pcr', 'covid 19', 'covid-19', 'covid'], qualitative: true },

  // ---------------- Vital signs ----------------
  { key: 'blood_pressure', name: 'Blood pressure', category: 'vitals', aliases: ['blood pressure', 'bp'], special: 'bp' },
  { key: 'heart_rate', name: 'Heart rate', category: 'vitals', aliases: ['heart rate', 'pulse rate', 'pulse', 'hr'], unit: 'bpm', units: { bpm: 1, '/min': 1, 'beats/min': 1, b: 1 }, guess: [1], plausible: [20, 250], range: [60, 100] },
  { key: 'respiratory_rate', name: 'Respiratory rate', category: 'vitals', aliases: ['respiratory rate', 'respiration rate', 'rr', 'resp rate'], unit: '/min', units: { '/min': 1, 'breaths/min': 1, bpm: 1 }, guess: [1], plausible: [4, 70], range: [12, 20] },
  { key: 'spo2', name: 'Oxygen saturation (SpO2)', category: 'vitals', aliases: ['spo2', 'sp02', 'spo 2', 'spon', 'oxygen saturation', 'o2 saturation', 'o2 sat', 'sao2'], unit: '%', units: { '%': 1 }, guess: [1], plausible: [40, 100], range: [95, 100] },
  { key: 'temperature', name: 'Temperature', category: 'vitals', aliases: ['temperature', 'body temperature', 'temp'], unit: '°C', units: { '°c': 1, c: 1, 'deg c': 1, '°f': (v) => (v - 32) * 5 / 9, f: (v) => (v - 32) * 5 / 9, 'deg f': (v) => (v - 32) * 5 / 9 }, guess: [1, (v) => (v - 32) * 5 / 9], plausible: [30, 44], range: [36.1, 37.5] },
  { key: 'bmi', name: 'BMI', category: 'metabolic', aliases: ['bmi', 'body mass index'], unit: 'kg/m2', units: { 'kg/m2': 1, 'kg/m²': 1 }, guess: [1], plausible: [10, 80], range: [18.5, 24.9] },
  { key: 'gcs', name: 'Glasgow Coma Scale', category: 'vitals', aliases: ['gcs', 'glasgow coma scale'], unit: '/15', units: { '/15': 1 }, guess: [1], plausible: [3, 15], range: [15, 15] },
];

// Alias index sorted longest first so "hdl cholesterol" wins over "hdl" and "ldl/hdl ratio" over "ldl".
export const ALIAS_INDEX = ANALYTES
  .flatMap((analyte) => analyte.aliases.map((alias) => ({ alias, analyte })))
  .sort((a, b) => b.alias.length - a.alias.length);

export const ANALYTE_BY_KEY = Object.fromEntries(ANALYTES.map((a) => [a.key, a]));

export function normaliseUnit(raw = '') {
  let unit = String(raw).trim().toLowerCase()
    .replace(/[µμ]/g, 'u')
    .replace(/mcl/g, 'ul')
    .replace(/\s+/g, '')
    .replace(/cumm|cu\.mm|mm3|mm³|cmm/g, 'ul')
    .replace(/³/g, '^3').replace(/⁹/g, '^9').replace(/¹²/g, '^12')
    .replace(/\*/g, '^')
    .replace(/^x/, '')
    .replace(/[.,;]$/, '');
  if (/^(10\^3|10e3|thou|k|th)\/ul$/.test(unit) || /^10\^9\/l$/.test(unit) || unit === 'thousand/ul') return 'k/ul';
  if (/^(10\^6|10e6|mill|million|mil|m)\/ul$/.test(unit) || /^10\^12\/l$/.test(unit) || unit === 'millions/ul') return 'm/ul';
  if (/^(lakh|lakhs|lac|lacs)\/ul$/.test(unit)) return 'lakh/ul';
  if (/^(cells|cell)\/ul$/.test(unit)) return 'cells/ul';
  if (unit === 'uiu/ml' || unit === 'uu/ml' || unit === 'microiu/ml') return 'uiu/ml';
  if (unit === 'gm/dl') return 'g/dl';
  if (unit === '°c' || unit === 'oc' || unit === 'degc') return '°c';
  if (unit === '°f' || unit === 'of' || unit === 'degf') return '°f';
  if (unit === 'beats/min' || unit === 'bpm' || unit === 'b/min') return 'bpm';
  return unit;
}
