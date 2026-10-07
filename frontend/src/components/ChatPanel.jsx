import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FiMic, FiSend, FiSquare, FiVolume2 } from 'react-icons/fi';
import { FaRobot } from 'react-icons/fa6';
import api from '../services/api';
import { languages, speak, startListening, stopSpeaking } from '../utils/speech';
import { chatFallback, detectLanguage, timeLabel } from '../utils/chat';
import { resolveChatLanguage } from '../utils/chat';
import MarkdownMessage from './MarkdownMessage';
import { useAuth } from '../auth/AuthContext';

const SESSION_KEY = 'health-nova-chat';
const greeting = { role: 'assistant', text: 'Hello! I’m Nova. How can I help you today?', language: 'en', time: timeLabel() };

function loadMessages() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || [greeting]; }
  catch { return [greeting]; }
}

function ChatPanel({ compact = false, onClose }) {
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState('');
  const { settings } = useAuth();
  const [language, setLanguage] = useState(languages[settings.language] ? settings.language : 'en');
  // Follow the preferred language saved in Settings.
  useEffect(() => { if (languages[settings.language]) setLanguage(settings.language); }, [settings.language]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const endRef = useRef(null);
  const mounted = useRef(false);
  const streamingTimer = useRef(null);
  const recognition = useRef(null);
  const requestActive = useRef(false);

  useEffect(() => {
    // React StrictMode repeats setup/cleanup in development. Restore this flag on every setup.
    mounted.current = true;
    console.info('[chat] ChatPanel mounted and ready');
    return () => {
      mounted.current = false;
      requestActive.current = false;
      clearInterval(streamingTimer.current);
      recognition.current?.stop();
      stopSpeaking();
      console.info('[chat] ChatPanel cleanup completed');
    };
  }, []);

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const speakReply = useCallback((text, replyLanguage) => speak(text, replyLanguage, {
    onStart: () => mounted.current && setSpeaking(true),
    onEnd: () => mounted.current && setSpeaking(false),
  }), []);

  const stopVoice = () => { stopSpeaking(); setSpeaking(false); };

  const addStreamedReply = useCallback(async (text, replyLanguage) => {
    if (!mounted.current) return;
    setMessages((current) => [...current, { id: Date.now(), role: 'assistant', text, language: replyLanguage, time: timeLabel() }]);
    speakReply(text.replace(/[#*_`]/g, ''), replyLanguage);
  }, [speakReply]);

  const send = useCallback(async (value = input) => {
    const question = value.trim();
    if (!question || requestActive.current) return;
    const requestId = globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}`;
    requestActive.current = true;
    const detected = resolveChatLanguage(question, language);
    console.info(`[chat:${requestId}] Frontend send`, { messageChars: question.length, language: detected });
    stopVoice();
    setVoiceError('');
    setLanguage(detected);
    setInput('');
    setMessages((current) => [...current, { role: 'user', text: question, language: detected, time: timeLabel() }]);
    setLoading(true);
    try {
      const history = messages.filter((item) => !item.error).slice(-8).map(({ role, text }) => ({ role, text }));
      const response = await api.post('/chat', { message: question, language: detected, history, requestId }, { headers: { 'x-request-id': requestId }, timeout: 120000 });
      console.info(`[chat:${requestId}] Frontend response received`, { status: response.status, provider: response.data?.provider, hasReply: Boolean(response.data?.reply) });
      const reply = response.data?.reply?.trim() || chatFallback(detected);
      const replyLanguage = response.data?.language || detectLanguage(reply);
      if (mounted.current) {
        setLoading(false);
        await addStreamedReply(reply, replyLanguage);
      }
    } catch (error) {
      // A handled "AI unavailable" answer from the backend is a warning; anything else (network, crash) is an error.
      (String(error.response?.data?.code || '').startsWith('AI_') ? console.warn : console.error)(`[chat:${requestId}] Frontend chat failed`, { message: error.message, status: error.response?.status, data: error.response?.data });
      const fallback = !navigator.onLine
        ? (detected === 'te' ? 'ఇంటర్నెట్ కనెక్షన్ లేదు. కనెక్షన్ వచ్చిన తర్వాత మళ్లీ ప్రయత్నించండి.' : 'You appear to be offline. Please reconnect and try again.')
        : error.response?.data?.message || chatFallback(detected);
      if (mounted.current) {
        setLoading(false);
        // Shown as an error notice (not an assistant answer): not read aloud, not sent back as chat history.
        setMessages((current) => [...current, { id: Date.now(), role: 'assistant', error: true, text: fallback, language: detected, time: timeLabel() }]);
        setInput((current) => current || question);
      }
    } finally {
      requestActive.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [input, messages, addStreamedReply]);

  const listen = () => {
    if (listening) { recognition.current?.stop(); return; }
    try {
      setVoiceError(''); setListening(true);
      recognition.current = startListening(language, (transcript) => { setInput(transcript); send(transcript); }, () => setListening(false), () => setVoiceError(language === 'te' ? 'వాయిస్ గుర్తింపు విఫలమైంది. మళ్లీ ప్రయత్నించండి.' : 'Voice recognition failed. Please try again.'));
    } catch (error) { setVoiceError(error.message); setListening(false); }
  };

  return <section className={`chat-card ${compact ? 'compact-chat' : ''} ${speaking ? 'is-speaking' : ''}`}>
    <div className="chat-title"><span><FaRobot /></span><div><h3>Nova Assistant</h3><small><i /> System Online</small></div><select aria-label="Voice language" value={language} onChange={(event) => setLanguage(event.target.value)}>{Object.entries(languages).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select>{onClose && <button className="chat-close" onClick={onClose} aria-label="Close chat">×</button>}</div>
    {speaking && <button className="stop-speaking" onClick={stopVoice}><FiSquare /> Stop speaking</button>}
    <div className="messages" aria-live="polite">{messages.map((message, index) => <div key={message.id || `${message.time}-${index}`} className={`message ${message.role}${message.error ? ' error' : ''}`} role={message.error ? 'alert' : undefined}><div className="bubble">{message.role==='assistant'?<MarkdownMessage text={message.text}/>:<p>{message.text}</p>}<small>{message.time}</small></div>{message.role === 'assistant' && message.text && !message.error && <button onClick={() => speakReply(message.text.replace(/[#*_`]/g,''), message.language)} aria-label="Read response"><FiVolume2 /></button>}</div>)}{loading && <div className="message assistant thinking"><div className="bubble"><span /><span /><span /></div></div>}<div ref={endRef} /></div>
    {voiceError && <p className="voice-error">{voiceError}</p>}
    <div className="chat-input"><button className={listening ? 'recording' : ''} onClick={listen} aria-label={listening ? 'Stop listening' : 'Start voice input'}><FiMic /></button><input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') send(); }} placeholder={listening ? 'Listening...' : language === 'te' ? 'ఆరోగ్య ప్రశ్న అడగండి...' : 'Ask anything...'} /><button onClick={() => send()} disabled={loading || !input.trim()} aria-label="Send message"><FiSend /></button></div>
  </section>;
}

export default memo(ChatPanel);
