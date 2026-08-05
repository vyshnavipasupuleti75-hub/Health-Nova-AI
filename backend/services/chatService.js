const teluguPattern = /[\u0C00-\u0C7F]/;

const english = {
  greeting: ['Hello! I’m Nova. How can I help you today?', 'Hi there! I’m ready to help with health questions or just have a friendly chat.'],
  wellbeing: ['I’m doing well and ready to help. How are you feeling today?', 'I’m here and ready to support you. What would you like to talk about?'],
  identity: ['I’m Nova, a friendly AI health-education assistant. I can explain health topics, but I don’t replace a doctor.'],
  thanks: ['You’re very welcome! I’m here whenever you need help.', 'Glad I could help. Take care of yourself!'],
  morning: ['Good morning! I hope your day starts well. How can I help?'],
  night: ['Good night! Rest well—consistent sleep is an important part of good health.'],
  joke: ['Here’s a gentle one: Why did the skeleton skip the party? It had no body to go with!'],
  diet: ['A balanced plate usually includes plenty of vegetables, whole grains, and a suitable protein source. Limit excess salt, added sugar, and highly processed foods.'],
  exercise: ['A common general goal is 150 minutes of moderate activity each week plus strength work on two days. Start gradually and choose activity appropriate for your health.'],
  medicine: ['Medicines can have side effects and interactions. Use prescription medicines only as directed, and ask a doctor or pharmacist before combining medicines or supplements.'],
  firstAid: ['For first aid, make sure the area is safe, check breathing, and contact emergency services for severe bleeding, unconsciousness, breathing trouble, or major injury.'],
  mentalHealth: ['Mental health matters. Gentle routines, sleep, movement, and talking with someone you trust can help. If you feel unsafe or may harm yourself, contact emergency or crisis support now.'],
  pregnancy: ['Pregnancy care generally includes regular antenatal visits, prescribed supplements, balanced nutrition, and avoiding alcohol and tobacco. Urgent bleeding or severe pain needs prompt medical care.'],
  childHealth: ['Children need age-appropriate nutrition, vaccination, sleep, and regular check-ups. Breathing difficulty, unusual drowsiness, dehydration, or a very unwell child needs urgent assessment.'],
  elderCare: ['Elder care benefits from medicine reviews, fall prevention, nutrition, movement, social connection, and regular vision and hearing checks.'],
  diabetes: ['Diabetes affects how the body manages blood glucose. Monitoring, prescribed treatment, nutrition, activity, and routine eye, kidney, and foot checks are important.'],
  heart: ['Heart health is supported by not smoking, regular activity, balanced food, and managing blood pressure, cholesterol, and diabetes. Chest pressure or severe breathlessness can be an emergency.'],
  pressure: ['Blood pressure readings should be taken while rested with the correct cuff size. Persistently high or low readings should be reviewed by a clinician.'],
  report: ['I can help explain common lab terms and ranges, but interpretation depends on the laboratory, symptoms, medicines, and medical history. Share the test name and value without personal identifiers.'],
  symptoms: ['Symptoms can have many causes, so I can provide education but not diagnose. Tell me what you notice, how long it has lasted, and whether it is worsening.'],
  lifestyle: ['Small consistent habits matter: regular sleep, balanced food, hydration, movement, stress management, and avoiding tobacco. Choose one realistic change to begin with.'],
  fallback: ['I’m listening. Could you tell me a little more so I can give a useful answer?', 'That’s an interesting question. I can help with general information—what part would you like to explore first?'],
};

const telugu = {
  greeting: ['నమస్తే! నేను నోవా. ఈ రోజు మీకు ఎలా సహాయం చేయగలను?', 'హాయ్! ఆరోగ్య సమాచారం లేదా సాధారణ సంభాషణ కోసం నేను ఇక్కడ ఉన్నాను.'],
  wellbeing: ['నేను బాగున్నాను, ధన్యవాదాలు! మీరు ఈ రోజు ఎలా ఉన్నారు?', 'నేను మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను. మీరు ఎలా అనుభవిస్తున్నారు?'],
  identity: ['నేను నోవా, స్నేహపూర్వక AI ఆరోగ్య సమాచార సహాయకుడిని. నేను వైద్యుడికి ప్రత్యామ్నాయం కాదు.'],
  thanks: ['మీకు స్వాగతం! అవసరమైనప్పుడు మళ్లీ అడగండి.', 'సహాయం చేయగలిగినందుకు సంతోషం. జాగ్రత్తగా ఉండండి!'],
  morning: ['శుభోదయం! మీ రోజు ఆనందంగా ప్రారంభం కావాలని కోరుకుంటున్నాను.'],
  night: ['శుభరాత్రి! మంచి నిద్ర ఆరోగ్యానికి చాలా ముఖ్యం.'],
  joke: ['ఒక చిన్న జోక్: కంప్యూటర్ డాక్టర్ దగ్గరకు ఎందుకు వెళ్లింది? దానికి వైరస్ వచ్చింది!'],
  diet: ['సమతుల ఆహారంలో కూరగాయలు, పండ్లు, సంపూర్ణ ధాన్యాలు మరియు తగిన ప్రోటీన్ ఉండాలి. అధిక ఉప్పు, చక్కెర మరియు ప్రాసెస్ చేసిన ఆహారాన్ని తగ్గించండి.'],
  exercise: ['సాధారణంగా వారానికి 150 నిమిషాల మితమైన వ్యాయామం మంచిది. మీ ఆరోగ్యానికి తగిన విధంగా నెమ్మదిగా ప్రారంభించండి.'],
  medicine: ['మందులకు దుష్ప్రభావాలు మరియు పరస్పర చర్యలు ఉండవచ్చు. వైద్యుడు సూచించిన విధంగానే వాడండి; సందేహాలకు వైద్యుడు లేదా ఫార్మసిస్ట్‌ను అడగండి.'],
  firstAid: ['ప్రథమ చికిత్సలో ముందుగా ప్రదేశం సురక్షితమో చూడండి, శ్వాసను పరిశీలించండి. తీవ్రమైన రక్తస్రావం, స్పృహ లేకపోవడం లేదా శ్వాస ఇబ్బంది ఉంటే అత్యవసర సేవలకు కాల్ చేయండి.'],
  mentalHealth: ['మానసిక ఆరోగ్యం కూడా ముఖ్యమే. నిద్ర, వ్యాయామం మరియు నమ్మకమైన వ్యక్తితో మాట్లాడటం సహాయపడవచ్చు. మీరు సురక్షితంగా లేరని అనిపిస్తే వెంటనే అత్యవసర సహాయం పొందండి.'],
  pregnancy: ['గర్భధారణలో క్రమమైన వైద్య పరీక్షలు, సూచించిన సప్లిమెంట్లు మరియు సమతుల ఆహారం ముఖ్యం. తీవ్రమైన నొప్పి లేదా రక్తస్రావం ఉంటే వెంటనే వైద్య సహాయం పొందండి.'],
  childHealth: ['పిల్లలకు వయస్సుకు తగిన ఆహారం, టీకాలు, నిద్ర మరియు క్రమమైన పరీక్షలు అవసరం. శ్వాస ఇబ్బంది లేదా తీవ్రమైన నీరసం ఉంటే వెంటనే వైద్యుడిని సంప్రదించండి.'],
  elderCare: ['వృద్ధుల సంరక్షణలో మందుల సమీక్ష, పడిపోకుండా జాగ్రత్తలు, పోషకాహారం, కదలిక మరియు క్రమమైన ఆరోగ్య పరీక్షలు ముఖ్యం.'],
  diabetes: ['మధుమేహం రక్తంలో గ్లూకోజ్ నియంత్రణను ప్రభావితం చేస్తుంది. పరీక్షలు, సూచించిన చికిత్స, ఆహారం, వ్యాయామం మరియు కంటి, మూత్రపిండ, పాద పరీక్షలు ముఖ్యం.'],
  heart: ['గుండె ఆరోగ్యానికి పొగ తాగకపోవడం, వ్యాయామం, సమతుల ఆహారం మరియు రక్తపోటు నియంత్రణ సహాయపడతాయి. ఛాతి నొప్పి లేదా తీవ్రమైన శ్వాస ఇబ్బంది అత్యవసరం కావచ్చు.'],
  pressure: ['రక్తపోటును విశ్రాంతిగా కూర్చొని సరైన కఫ్‌తో కొలవాలి. వరుసగా ఎక్కువ లేదా తక్కువగా ఉంటే వైద్యుడిని సంప్రదించండి.'],
  report: ['ల్యాబ్ పరీక్షల సాధారణ అర్థాన్ని వివరించగలను. కానీ ఫలితాలు లక్షణాలు, మందులు మరియు వైద్య చరిత్రపై ఆధారపడతాయి. వ్యక్తిగత వివరాలు లేకుండా పరీక్ష పేరు, విలువ చెప్పండి.'],
  symptoms: ['ఒకే లక్షణానికి అనేక కారణాలు ఉండవచ్చు; నేను నిర్ధారణ చేయలేను. లక్షణం ఏమిటి, ఎంతకాలంగా ఉంది, పెరుగుతోందా చెప్పండి.'],
  lifestyle: ['క్రమమైన నిద్ర, సమతుల ఆహారం, నీరు, వ్యాయామం, ఒత్తిడి నియంత్రణ మరియు పొగాకు నివారణ ఆరోగ్యానికి సహాయపడతాయి.'],
  fallback: ['నేను వింటున్నాను. మీ ప్రశ్నను కొంచెం వివరంగా చెబుతారా?', 'ఆసక్తికరమైన ప్రశ్న. మీరు ఏ భాగం గురించి ముందుగా తెలుసుకోవాలనుకుంటున్నారు?'],
};

const includesAny = (text, words) => words.some((word) => text.includes(word));
const choose = (items, seed) => items[Math.abs([...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % items.length];

function topicFor(text, isTelugu) {
  if (!isTelugu && /^(hello|hi|hey)\b/.test(text)) return 'greeting';
  if (includesAny(text, isTelugu ? ['నమస్తే','హాయ్','హలో'] : ['hello','hi ','hi!','hey'])) return 'greeting';
  if (includesAny(text, isTelugu ? ['ఎలా ఉన్నావు','ఎలా ఉన్నారు'] : ['how are you'])) return 'wellbeing';
  if (includesAny(text, isTelugu ? ['నువ్వు ఎవరు','మీరు ఎవరు'] : ['who are you'])) return 'identity';
  if (includesAny(text, isTelugu ? ['ధన్యవాదాలు','థాంక్స్'] : ['thank you','thanks'])) return 'thanks';
  if (includesAny(text, isTelugu ? ['శుభోదయం'] : ['good morning'])) return 'morning';
  if (includesAny(text, isTelugu ? ['శుభరాత్రి'] : ['good night'])) return 'night';
  if (includesAny(text, isTelugu ? ['జోక్','నవ్వు'] : ['joke'])) return 'joke';
  if (includesAny(text, isTelugu ? ['ఆహారం','డైట్','పోషణ'] : ['diet','food','nutrition','meal'])) return 'diet';
  if (includesAny(text, isTelugu ? ['వ్యాయామం','ఫిట్‌నెస్'] : ['exercise','fitness','workout','walking'])) return 'exercise';
  if (includesAny(text, isTelugu ? ['మందు','మాత్ర'] : ['medicine','tablet','drug','dose','supplement'])) return 'medicine';
  if (includesAny(text, isTelugu ? ['ప్రథమ చికిత్స'] : ['first aid','burn','cut','bleeding'])) return 'firstAid';
  if (includesAny(text, isTelugu ? ['మానసిక','ఒత్తిడి','ఆందోళన'] : ['mental','anxiety','depression','stress'])) return 'mentalHealth';
  if (includesAny(text, isTelugu ? ['గర్భం','గర్భధారణ'] : ['pregnan','antenatal'])) return 'pregnancy';
  if (includesAny(text, isTelugu ? ['పిల్ల','శిశు'] : ['child','baby','infant'])) return 'childHealth';
  if (includesAny(text, isTelugu ? ['వృద్ధ'] : ['elder','senior','old age'])) return 'elderCare';
  if (includesAny(text, isTelugu ? ['మధుమేహం','షుగర్'] : ['diabetes','blood sugar'])) return 'diabetes';
  if (includesAny(text, isTelugu ? ['గుండె'] : ['heart','cardiac','cholesterol'])) return 'heart';
  if (includesAny(text, isTelugu ? ['రక్తపోటు','బీపీ'] : ['blood pressure','hypertension'])) return 'pressure';
  if (includesAny(text, isTelugu ? ['రిపోర్ట్','పరీక్ష'] : ['report','lab','test result','haemoglobin','hemoglobin'])) return 'report';
  if (includesAny(text, isTelugu ? ['లక్షణం','జ్వరం','నొప్పి'] : ['symptom','fever','pain','disease','asthma'])) return 'symptoms';
  if (includesAny(text, isTelugu ? ['జీవనశైలి','నిద్ర'] : ['lifestyle','sleep','habit'])) return 'lifestyle';
  return 'fallback';
}

export function detectLanguage(message) {
  return teluguPattern.test(message) ? 'te' : 'en';
}

export function getChatReply(message, requestedLanguage, history=[]) {
  const originalText = message.trim();
  const previousUserMessage = [...history].reverse().find(item=>item?.role==='user'&&item.text)?.text;
  const isFollowUp = /^(tell me more|more details|explain more|ఇంకా చెప్పండి|మరింత వివరంగా)/i.test(originalText);
  const text = isFollowUp&&previousUserMessage?`${previousUserMessage} ${originalText}`:originalText;
  const language = detectLanguage(text) === 'te' ? 'te' : requestedLanguage === 'te' ? 'te' : 'en';
  const lower = text.toLowerCase();
  const urgent = /chest pain|can.?t breathe|unconscious|stroke|suicide|emergency|ఛాతి నొప్పి|శ్వాస ఇబ్బంది|స్పృహ/.test(lower);
  if (urgent) return language === 'te'
    ? {reply:'ఇది అత్యవసర పరిస్థితి కావచ్చు. వెంటనే స్థానిక అత్యవసర సేవలను సంప్రదించండి. ఈ చాట్‌పై మాత్రమే ఆధారపడవద్దు.',language}
    : {reply:'This may be an emergency. Contact local emergency services immediately. Do not rely only on this chat.',language};
  const catalog = language === 'te' ? telugu : english;
  let reply=choose(catalog[topicFor(lower, language === 'te')], text);
  const previousAssistant=[...history].reverse().find(item=>item?.role==='assistant'&&item.text)?.text;
  if(previousAssistant===reply)reply=language==='te'?`ఇదే విషయాన్ని మరోలా చెప్పాలంటే: ${reply}`:`Here’s another way to frame it: ${reply}`;
  return { reply, language };
}
