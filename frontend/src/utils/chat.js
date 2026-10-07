const teluguPattern=/[\u0C00-\u0C7F]/;
const romanTeluguWords=new Set(['naku','naaku','kavali','kaavali','cheppu','cheppandi','ela','undi','unna','kosam','taggali','peragali','baruvu','aaharam','tindi','vyayamam','roju','meeru','nenu','manchi','ledu','avunu','emi','enti']);
export const detectLanguage=text=>teluguPattern.test(text)?'te':'en';
export function resolveChatLanguage(text,selected='en'){const lower=text.toLowerCase().trim();if(/speak|reply|answer|respond/.test(lower)&&/telugu|తెలుగు/.test(lower))return'te';if(/speak|reply|answer|respond/.test(lower)&&/english/.test(lower))return'en';if(teluguPattern.test(text))return'te';const words=lower.replace(/[^a-z\s]/g,' ').split(/\s+/).filter(Boolean);const romanHits=words.filter(word=>romanTeluguWords.has(word)).length;if(romanHits>=2||/\bn+a+ku\b.*\bk+a+v+a+li\b/.test(lower))return'te';
// Romanized Telugu questions such as "Diabetes ante enti?" end with a Telugu question word.
if(/\b(enti|emiti|yenti)\s*\?*\s*$/.test(lower))return'te';return selected==='te'?'te':'en'}
export const timeLabel=(date=new Date())=>date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
export const chatFallback=language=>language==='te'?'క్షమించండి, ప్రస్తుతం సమాధానం పొందలేకపోయాను. దయచేసి మళ్లీ ప్రయత్నించండి.':'Sorry, I could not get a response just now. Please try again.';
