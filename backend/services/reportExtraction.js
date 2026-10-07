// Reads the uploaded file and returns its text.
// - PDFs with a text layer: pdf-parse
// - JPG/PNG images: local OCR with tesseract.js (language data is downloaded once and cached)
// Scanned PDFs (no text layer) cannot be OCR'd locally without a PDF renderer; the caller can
// fall back to Gemini transcription for those when it is configured.
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';
import { parseReportText } from './labParser.js';

const cacheDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.cache/tesseract');
const MAX_TEXT_CHARS = 100000;

export class ReportFileError extends Error {
  constructor(message) {
    super(message);
    this.status = 422;
  }
}

// Check the real file signature instead of trusting the browser-supplied MIME type.
export function detectFileType(buffer) {
  if (!buffer || buffer.length < 8) return null;
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buffer[0] === 0x89 && buffer.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  return null;
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = (result.text || '').replace(/\n-- \d+ of \d+ --\n/g, '\n');
    return { text, pages: result.total ?? null };
  } catch (error) {
    if (error?.name === 'PasswordException') throw new ReportFileError('This PDF is password-protected. Please upload an unlocked copy.');
    throw new ReportFileError('This PDF could not be read. It may be damaged.');
  } finally {
    await parser.destroy().catch(() => {});
  }
}

let workerPromise = null;
async function getOcrWorker() {
  if (!workerPromise) {
    workerPromise = import('tesseract.js')
      .then(({ createWorker }) => createWorker('eng', 1, { cachePath: cacheDirectory }))
      .catch((error) => { workerPromise = null; throw error; });
  }
  return workerPromise;
}

// Rebuild table rows from word positions so "Label | Value | Unit" cells end up on one line.
function wordsToRows(blocks = []) {
  const words = [];
  for (const block of blocks) for (const paragraph of block.paragraphs || []) for (const line of paragraph.lines || []) for (const word of line.words || []) words.push({ text: word.text, ...word.bbox });
  words.sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  const rows = [];
  for (const word of words) {
    const centre = (word.y0 + word.y1) / 2;
    const height = word.y1 - word.y0;
    const row = rows.find((r) => Math.abs(r.centre - centre) < Math.max(height, r.height) * 0.6);
    if (row) row.words.push(word); else rows.push({ centre, height, words: [word] });
  }
  return rows.map((row) => row.words.sort((a, b) => a.x0 - b.x0).map((w) => w.text).join(' ')).join('\n');
}

async function extractImageText(buffer) {
  try {
    const worker = await getOcrWorker();
    // Pass 1: Tesseract defaults on the original image (works well for clean scans).
    await worker.setParameters({ tessedit_pageseg_mode: '3' });
    const plain = await worker.recognize(buffer);
    const candidates = [{ text: plain.data.text || '', confidence: plain.data.confidence ?? null }];
    // Pass 2: upscaled + binarised, sparse-text mode, rows rebuilt from word positions.
    // Handles phone photos/screenshots of tables, where labels sit on shaded cells.
    try {
      const { Jimp } = await import('jimp');
      const image = await Jimp.read(buffer);
      if (image.bitmap.width < 2500) image.scale(2);
      image.greyscale().threshold({ max: 170 });
      await worker.setParameters({ tessedit_pageseg_mode: '11' });
      const table = await worker.recognize(await image.getBuffer('image/png'), {}, { blocks: true, text: true });
      candidates.push({ text: wordsToRows(table.data.blocks), confidence: table.data.confidence ?? null });
    } catch (error) {
      console.warn('[report] OCR table pass skipped:', error.message);
    }
    // Keep the pass that yields the most recognisable measurements.
    const scored = candidates.map((c) => ({ ...c, values: parseReportText(c.text).measurements.length }));
    scored.sort((a, b) => b.values - a.values || (b.confidence ?? 0) - (a.confidence ?? 0));
    return scored[0];
  } catch (error) {
    console.error('[report] OCR failed:', error.message);
    return { text: '', confidence: null, error: 'Local OCR is unavailable (the OCR language data may need an internet connection on first use).' };
  }
}

export async function extractReportText(buffer) {
  const fileType = detectFileType(buffer);
  if (!fileType) throw new ReportFileError('The file content is not a valid PDF, JPG, or PNG file.');

  if (fileType === 'application/pdf') {
    const { text, pages } = await extractPdfText(buffer);
    const meaningful = text.replace(/\s+/g, '').length;
    return {
      fileType,
      method: meaningful >= 10 ? 'pdf-text' : 'pdf-no-text-layer',
      text: text.slice(0, MAX_TEXT_CHARS),
      pages,
      ocrConfidence: null,
      warnings: meaningful >= 10 ? [] : ['This PDF has no readable text layer (it is probably a scanned image).'],
    };
  }

  const { text, confidence, error } = await extractImageText(buffer);
  const warnings = [];
  if (error) warnings.push(error);
  if (confidence != null && confidence < 60) warnings.push(`OCR confidence is low (${Math.round(confidence)}%). Values should be checked against the original report.`);
  return { fileType, method: 'ocr', text: text.slice(0, MAX_TEXT_CHARS), pages: 1, ocrConfidence: confidence, warnings };
}
