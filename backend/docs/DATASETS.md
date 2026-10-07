# Datasets and models: current status and strategy

## Current status (checked October 2026)

- **No datasets or trained models are in this repository**, and none were before this change.
  The old "analysis" was a hardcoded example object (`createDemoAnalysis`), not a model.
- The analysis now uses a **rule and reference-range engine** (`services/clinicalRules.js`),
  based on published clinical guideline thresholds, plus an optional Gemini explanation.
  No machine-learning model makes predictions.

This is deliberate. A public dataset only helps when the uploaded report contains the same
input features the model was trained on. Most of the datasets below need features that a routine
lab report does not contain, such as ECG findings, imaging measurements, questionnaire answers,
or biopsy cell measurements. A model fed with missing or guessed features gives confident but
meaningless output. That is the "fake accuracy" this project must avoid.

## Guideline sources used by the rule engine

These are thresholds from clinical guidelines, not datasets. Always check the latest edition.

| Area | Source | Used for |
|---|---|---|
| Diabetes / prediabetes | American Diabetes Association, *Standards of Care in Diabetes* | Fasting glucose ≥126 / 100–125 mg/dL, HbA1c ≥6.5 / 5.7–6.4 %, random/2-h ≥200 mg/dL |
| Lipids | NCEP ATP III | Total cholesterol, LDL, HDL, triglyceride categories; metabolic-syndrome criteria |
| Blood pressure | 2017 ACC/AHA hypertension guideline | Elevated, stage 1, stage 2, crisis ≥180/120 |
| Kidney | KDIGO CKD guideline | eGFR categories G3a–G5; CKD requires abnormality lasting >3 months |
| Anaemia | WHO haemoglobin thresholds | Severity wording |
| Sepsis warning signs | qSOFA (Sepsis-3) | Respiratory rate ≥22, systolic ≤100, altered mentation |

The fallback reference ranges in `services/labCatalog.js` are typical adult ranges. They are used
**only** when a report does not print its own range, and the UI marks those values.

## Candidate datasets for future disease-specific models

Licences below are as published on the source page at the time of writing. **Re-check the
licence and terms on the source page before downloading or using any dataset.**

| # | Dataset | Source | Licence | Condition | Input features | Target | Size | Lab values? | Research/demo use | How it could be integrated | What it CANNOT do |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Indian Liver Patient Dataset (ILPD) | UCI ML Repository | CC BY 4.0 | Liver disease | Age, sex, total/direct bilirubin, ALP, ALT, AST, total protein, albumin, A/G ratio | Liver patient yes/no | 583 | Yes | Research/demo | Best match with a standard LFT. Use only when **all** features are present in the report | Cannot identify the cause (fatty liver vs hepatitis vs cirrhosis). Small, single-region, label quality unclear |
| 2 | HCV data | UCI ML Repository | CC BY 4.0 | Hepatitis C stages (fibrosis, cirrhosis) vs blood donors | Age, sex, ALB, ALP, ALT, AST, BIL, CHE, CHOL, CREA, GGT, PROT | Category | 615 | Yes | Research/demo | Only when CHE and GGT are also reported, which is uncommon | Cannot detect HCV infection itself; that needs antibody/RNA tests. Very imbalanced |
| 3 | Chronic Kidney Disease | UCI ML Repository | CC BY 4.0 | CKD | 24 features incl. BP, specific gravity, albumin, sugar, RBC, pus cells, glucose, urea, creatinine, sodium, potassium, Hb, PCV, WBC, RBC count, hypertension, diabetes, appetite, oedema | CKD yes/no | 400 | Yes, plus clinical history | Demo only | Needs clinical history fields a lab report lacks, so not recommended | Cannot stage CKD; tiny and many missing values. KDIGO eGFR rules are more reliable |
| 4 | Thyroid Disease (Quinlan / Garavan) | UCI ML Repository | CC BY 4.0 | Hypo/hyperthyroid | TSH, T3, TT4, T4U, FTI, age, sex, medication and history flags | Diagnosis class | ~7,200 (ann-thyroid) / 9,172 | Yes | Research/demo | Not needed: the TSH + T4 pattern rules already capture this logic | Old assay units (1980s); history flags not available from reports |
| 5 | Heart Disease (Cleveland + others) | UCI ML Repository | CC BY 4.0 | Coronary artery disease | Age, sex, chest-pain type, resting BP, cholesterol, fasting sugar >120, resting ECG, max heart rate, exercise angina, ST depression, slope, vessels on fluoroscopy, thal | Angiographic disease | 303 (Cleveland), 920 combined | Partly | Demo only | **Not suitable for lab reports**: most features come from exercise testing and angiography | Cannot assess heart disease from a blood test |
| 6 | Pima Indians Diabetes | Originally NIDDK, via UCI (since removed) and Kaggle | **Unclear.** Kaggle lists CC0, but provenance and redistribution terms are not clearly stated by the originator | Diabetes | Pregnancies, glucose (2-h OGTT), BP, skin thickness, insulin, BMI, pedigree function, age | Diabetes within 5 years | 768 | Partly | Avoid: unclear licence | Do not integrate. ADA thresholds on actual glucose/HbA1c are more reliable | Single population (Pima women ≥21). Cannot diagnose diabetes |
| 7 | CDC Diabetes Health Indicators (BRFSS 2015) | UCI ML Repository / CDC | CC BY 4.0 (CDC data is public domain) | Diabetes / prediabetes risk | Survey answers (BP history, cholesterol history, BMI, smoking, activity, diet, general health, income...) | Diabetes status | 253,680 | **No** | Research/demo | Would need a separate questionnaire feature, not report analysis | Cannot interpret lab values |
| 8 | Breast Cancer Wisconsin (Diagnostic) | UCI ML Repository | CC BY 4.0 | Breast mass benign/malignant | 30 features computed from fine-needle-aspirate cell images | Benign/malignant | 569 | **No** (cytology measurements) | Research/demo | **Not applicable** to uploaded reports | Cannot screen for or detect breast cancer from blood tests or report text |
| 9 | Cervical cancer (Risk Factors) | UCI ML Repository | CC BY 4.0 | Cervical cancer risk | Questionnaire/history: sexual history, smoking, contraception, STDs | Biopsy result | 858 | No | Research/demo | Not applicable to lab reports | Cannot diagnose cervical cancer; screening requires Pap/HPV testing |
| 10 | NHANES laboratory data | US CDC / NCHS | Public domain (US government work) | Population reference distributions (no diagnosis labels) | Thousands of lab variables with age/sex/ethnicity | n/a | Tens of thousands per cycle | Yes | Research/demo | Best use: derive **age- and sex-specific reference percentiles** to improve fallback ranges | Not a diagnostic dataset; US population only |
| — | MIMIC-IV / eICU | PhysioNet | **Credentialed access + Data Use Agreement** | ICU outcomes | Full EHR | Various | Large | Yes | Restricted | Must not be redistributed or used without credentialing. **Not included** | — |
| — | Kaggle "anaemia", "lung cancer", "disease prediction from symptoms" sets | Kaggle uploads | Mostly unclear or synthetic | Various | Various | Various | Small | Mixed | **Excluded**: unclear licensing/provenance, often synthetic | — | — |

## Recommended architecture for adding a model later

```
Report parser → structured values ─┬─> Rule/reference-range engine (always)
                                   └─> Disease-specific model (only if ALL required features are present)
                                          │  output: risk score + model card (dataset, licence, validation metrics)
                                          ▼
                                   Safety layer → Gemini explanation → UI ("model estimate, not a diagnosis")
```

Rules for any future model:
1. Keep it in its own module (for example `services/models/liver.js`) with a declared list of required features.
2. If any required feature is missing, the model must return `null`. Never impute values for a user's report.
3. Report external-validation performance, not training accuracy, and show it as uncertainty in the UI.
4. Never present model output as a diagnosis or with "100%" accuracy.

## Disease coverage: what the current system can and cannot do

**Can flag (from values actually printed on a report):** diabetes/prediabetes-range glucose and
HbA1c, low glucose, dyslipidaemia, metabolic-syndrome pattern, high/low blood pressure readings,
raised troponin/BNP, liver-enzyme and bilirubin abnormalities, low albumin, reduced kidney
function (eGFR/creatinine), raised urea and uric acid, proteinuria, anaemia (with
microcytic/macrocytic pattern and iron deficiency when ferritin is present), high haemoglobin,
low B12/folate/vitamin D, high/low white-cell count, inflammation markers, raised eosinophils,
high/low platelets, clotting abnormalities, thyroid patterns (hypo/hyper, subclinical),
electrolyte imbalances, abnormal vital signs and sepsis warning signs, positive HBsAg / anti-HCV /
dengue / malaria / typhoid / COVID / HIV screens, urinary-infection pattern, blood or glucose in
urine, raised tumour markers (always described as **not** a cancer diagnosis), and BMI categories.

**Cannot determine:** any condition that needs symptoms, examination, imaging, ECG, biopsy, or
specialist tests, including common cold, influenza, migraine, GERD, IBS, asthma, COPD,
pneumonia, tuberculosis, stroke, neuropathy, seizures, arrhythmias, and any cancer. The system
should not claim to detect these from a lab report. It will mention them only if the report
itself contains a relevant positive test result.
