import { randomUUID } from 'crypto';
import { generateAIReply } from '../services/aiService.js';

export async function chat(req, res) {
  const requestId = req.get('x-request-id') || req.body?.requestId || randomUUID();
  const { message, language, history = [] } = req.body || {};
  console.info(`[chat:${requestId}] Backend request received user=${req.user?._id || 'unknown'} messageChars=${message?.length || 0} language=${language}`);

  if (typeof message !== 'string' || !message.trim()) {
    console.warn(`[chat:${requestId}] Rejected empty message`);
    return res.status(400).json({ message: 'A question is required', requestId });
  }

  try {
    const safeHistory = Array.isArray(history) ? history.slice(-16) : [];
    const result = await generateAIReply({ message: message.trim(), language, history: safeHistory, requestId });
    const reply = result.reply?.trim() || 'I’m here to help. Please try asking that another way.';
    console.info(`[chat:${requestId}] Complete response sent to frontend provider=${result.provider} chars=${reply.length}`);
    return res.json({ reply, language: result.language, provider: result.provider, complete: result.complete !== false, requestId });
  } catch (error) {
    console.error(`[chat:${requestId}] Chat flow failed:`, error);
    // No reply is invented here: the client is told the AI service is unavailable and why.
    if (error.status === 429) {
      const quotaMessage = language === 'te'
        ? 'నోవా అసిస్టెంట్ ప్రస్తుతానికి AI వినియోగ పరిమితిని చేరుకుంది. దయచేసి కొంతసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.'
        : 'Nova Assistant has reached its AI usage limit for now. Please try again later.';
      return res.status(503).json({ message: quotaMessage, code: 'AI_QUOTA_EXCEEDED', requestId });
    }
    const safeMessage = language === 'te'
      ? 'నోవా అసిస్టెంట్ తాత్కాలికంగా అందుబాటులో లేదు. దయచేసి కొద్దిసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.'
      : 'Nova Assistant is temporarily unavailable. Please try again shortly.';
    return res.status(502).json({ message: safeMessage, code: 'AI_SERVICE_UNAVAILABLE', requestId });
  }
}
