import { detectLanguage, getChatReply } from './chatService.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';

function buildContents(history, message) {
  const contents = history
    .filter((item) => item?.text && ['user', 'assistant'].includes(item.role))
    .map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.text }],
    }));

  contents.push({ role: 'user', parts: [{ text: message }] });
  return contents;
}

export async function generateAIReply({ message, language, history = [], requestId = 'unknown' }) {
  const replyLanguage = detectLanguage(message) === 'te' || language === 'te' ? 'te' : 'en';
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || process.env.AI_PROVIDER?.toLowerCase() === 'local') {
    console.info(`[chat:${requestId}] Gemini API skipped; using local response`);
    return { ...getChatReply(message, replyLanguage, history), provider: 'local', complete: true };
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const instruction = replyLanguage === 'te'
    ? 'You are Nova, a concise health-education assistant. Reply in Telugu. Do not diagnose or prescribe. For emergencies, advise immediate local emergency care.'
    : 'You are Nova, a concise health-education assistant. Reply in English. Do not diagnose or prescribe. For emergencies, advise immediate local emergency care.';

  console.info(`[chat:${requestId}] Calling Gemini API model=${model}`);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: buildContents(history, message),
        generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
      }),
      signal: AbortSignal.timeout(60000),
    });

    const data = await response.json();
    console.info(`[chat:${requestId}] Gemini API returned status=${response.status}`);

    if (!response.ok) {
      throw new Error(data?.error?.message || `Gemini request failed with status ${response.status}`);
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

    if (!reply) throw new Error('Gemini returned an empty response');
    return { reply, language: replyLanguage, provider: 'gemini', complete: true };
  } catch (error) {
    console.error(`[chat:${requestId}] Gemini API call failed:`, error.message);
    throw error;
  }
}
