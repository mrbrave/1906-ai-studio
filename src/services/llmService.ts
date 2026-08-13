import { BuyerPersona, ChatMessage, LLMConfig, PitchAnalysis } from '../types/persona';

interface PersonaResponsePayload {
  replyText: string;
  intentScore: number;
  sentiment: 'enthusiastic' | 'positive' | 'neutral' | 'skeptical' | 'resistant';
  objectionsRaised: string[];
  resonancePoints: string[];
  keyTakeaway: string;
  suggestedTweak: string;
}

/**
 * Generate a persona response to a pitch or chat message.
 */
export async function generatePersonaResponse(
  persona: BuyerPersona,
  userMessageText: string,
  history: ChatMessage[],
  config: LLMConfig
): Promise<PersonaResponsePayload> {
  const provider = config.defaultProvider;

  if (provider === 'gemini' && config.geminiApiKey) {
    try {
      return await callGeminiAPI(persona, userMessageText, history, config);
    } catch (err) {
      console.warn('Gemini API call failed, falling back to realistic simulation:', err);
    }
  } else if (provider === 'openai' && config.openaiApiKey) {
    try {
      return await callOpenAIAPI(persona, userMessageText, history, config);
    } catch (err) {
      console.warn('OpenAI API call failed, falling back to realistic simulation:', err);
    }
  }

  // Fallback to high-fidelity realistic simulation
  return generateSimulatedResponse(persona, userMessageText);
}

/**
 * Call Google Gemini API
 */
async function callGeminiAPI(
  persona: BuyerPersona,
  userMessageText: string,
  history: ChatMessage[],
  config: LLMConfig
): Promise<PersonaResponsePayload> {
  const model = config.geminiModel || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`;

  const prompt = buildStructuredPrompt(persona, userMessageText, history);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini API');

  return parsePayloadJSON(text, persona, userMessageText);
}

/**
 * Call OpenAI API
 */
async function callOpenAIAPI(
  persona: BuyerPersona,
  userMessageText: string,
  history: ChatMessage[],
  config: LLMConfig
): Promise<PersonaResponsePayload> {
  const model = config.openaiModel || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const prompt = buildStructuredPrompt(persona, userMessageText, history);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openaiApiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: 'You are an expert marketing buyer persona simulator. Always output valid JSON.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty response from OpenAI API');

  return parsePayloadJSON(text, persona, userMessageText);
}

/**
 * Helper to build system instructions asking for JSON schema
 */
function buildStructuredPrompt(
  persona: BuyerPersona,
  userMessageText: string,
  history: ChatMessage[]
): string {
  const recentHistory = history.slice(-6).map(h => `${h.sender.toUpperCase()}: ${h.text}`).join('\n');

  return `
SYSTEM INSTRUCTION:
${persona.systemPrompt}

PERSONA CONTEXT:
- Name: ${persona.name}
- Role: ${persona.role} (${persona.industry})
- Age: ${persona.age}
- Tone: ${persona.tone}
- Budget Sensitivity: ${persona.budgetSensitivity}
- Pain Points: ${persona.painPoints.join(', ')}
- Buying Triggers: ${persona.buyingTriggers.join(', ')}
- Common Objections: ${persona.commonObjections.join(', ')}

CONVERSATION HISTORY:
${recentHistory || '(No previous history)'}

MARKETER PITCH / MESSAGE:
"${userMessageText}"

YOUR TASK:
Act 100% in character as ${persona.name}. Evaluate the marketer's message.
Return a valid JSON object matching EXACTLY this JSON structure:
{
  "replyText": "Your direct reply in character as ${persona.name} reacting to the marketer's pitch.",
  "intentScore": 65, // Integer from 0 (0% intent) to 100 (100% buy/convert)
  "sentiment": "skeptical", // Must be one of: "enthusiastic", "positive", "neutral", "skeptical", "resistant"
  "objectionsRaised": ["Specific objection 1", "Specific objection 2"],
  "resonancePoints": ["What liked or connected with"],
  "keyTakeaway": "1-sentence summary of persona reaction for the marketer",
  "suggestedTweak": "Actionable advice for the marketer to improve resonance with this buyer"
}
`;
}

/**
 * Parse JSON safely from LLM output
 */
function parsePayloadJSON(
  rawText: string,
  persona: BuyerPersona,
  userMessageText: string
): PersonaResponsePayload {
  try {
    // Strip markdown code block wrappers if any
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      replyText: parsed.replyText || `As ${persona.name}, I reviewed your message.`,
      intentScore: typeof parsed.intentScore === 'number' ? Math.max(0, Math.min(100, parsed.intentScore)) : 50,
      sentiment: parsed.sentiment || 'neutral',
      objectionsRaised: Array.isArray(parsed.objectionsRaised) ? parsed.objectionsRaised : [],
      resonancePoints: Array.isArray(parsed.resonancePoints) ? parsed.resonancePoints : [],
      keyTakeaway: parsed.keyTakeaway || 'Requires clearer value proposition.',
      suggestedTweak: parsed.suggestedTweak || 'Focus on pain points and concrete ROI.'
    };
  } catch (e) {
    console.error('JSON parse error from LLM response:', e, rawText);
    return generateSimulatedResponse(persona, userMessageText);
  }
}

/**
 * High-fidelity simulated offline fallback response engine
 */
export function generateSimulatedResponse(
  persona: BuyerPersona,
  userMessageText: string
): PersonaResponsePayload {
  const textLower = userMessageText.toLowerCase();

  // Keyword analysis for dynamic intent scoring
  let score = 50;
  const objections: string[] = [];
  const resonance: string[] = [];

  // Check triggers
  for (const trigger of persona.buyingTriggers) {
    const words = trigger.toLowerCase().split(' ');
    if (words.some(w => w.length > 3 && textLower.includes(w))) {
      score += 12;
      resonance.push(`Addressed trigger: ${trigger}`);
    }
  }

  // Check pain points
  for (const pain of persona.painPoints) {
    const words = pain.toLowerCase().split(' ');
    if (words.some(w => w.length > 3 && textLower.includes(w))) {
      score += 10;
      resonance.push(`Recognized pain point: ${pain}`);
    }
  }

  // Check objections
  for (const obj of persona.commonObjections) {
    const words = obj.toLowerCase().split(' ');
    if (words.some(w => w.length > 4 && textLower.includes(w))) {
      score += 8;
      resonance.push(`Pre-empted objection: ${obj}`);
    }
  }

  // Detect negative indicators
  if (textLower.includes('synergy') || textLower.includes('revolutionize') || textLower.includes('game-changer') || textLower.includes('cutting-edge')) {
    if (persona.id === 'alex-cto' || persona.id === 'david-smb') {
      score -= 15;
      objections.push('Overly buzzword-heavy copy without technical proof');
    }
  }

  if (textLower.includes('price') || textLower.includes('cost') || textLower.includes('free trial') || textLower.includes('roi')) {
    if (persona.budgetSensitivity === 'High') {
      score += 10;
      resonance.push('Clear mention of pricing / trial offer');
    }
  } else if (persona.budgetSensitivity === 'High') {
    objections.push('No explicit pricing or budget breakdown mentioned');
  }

  // Clamp score
  score = Math.max(15, Math.min(95, Math.round(score)));

  let sentiment: 'enthusiastic' | 'positive' | 'neutral' | 'skeptical' | 'resistant' = 'neutral';
  if (score >= 80) sentiment = 'enthusiastic';
  else if (score >= 65) sentiment = 'positive';
  else if (score >= 45) sentiment = 'neutral';
  else if (score >= 30) sentiment = 'skeptical';
  else sentiment = 'resistant';

  // Construct in-character persona replies
  let replyText = '';
  let keyTakeaway = '';
  let suggestedTweak = '';

  if (persona.id === 'alex-cto') {
    if (score >= 70) {
      replyText = `That actually sounds reasonable. As CTO, my main question is implementation time. Can my dev ops team set this up in a sandbox environment without sitting through a 45-minute sales demo? If so, send over the API docs and SOC2 status.`;
      keyTakeaway = 'Hooked by practical value; wants self-serve docs and SOC2 security verification.';
      suggestedTweak = 'Add a direct link to technical documentation or a 2-minute sandbox demo.';
    } else {
      replyText = `Honestly, this reads like generic marketing copy. In enterprise infrastructure, claims like "${userMessageText.slice(0, 40)}..." don't mean much without benchmark data, SLA numbers, and SOC2 compliance. How does this compare to our existing setup?`;
      keyTakeaway = 'Skeptical of high-level claims; demands concrete metrics and integration specs.';
      suggestedTweak = 'Cut the buzzwords and lead with specific uptime, security compliance, or integration specs.';
    }
  } else if (persona.id === 'maya-genz') {
    if (score >= 70) {
      replyText = `Okay wait, I love this! The vibe is super clean. If there's a 1-click free trial or a fast video walkthrough showing how to use it in under 60 seconds, I'd definitely test it out for my content.`;
      keyTakeaway = 'Enthusiastic about the concept; wants instant visual trial.';
      suggestedTweak = 'Include a short preview video or interactive visual demo link.';
    } else {
      replyText = `Hmm, I'm swiping past this. It feels a bit too long and corporate. What's the main benefit for me right now? Show me a 15-second before-and-after instead of paragraphs of text!`;
      keyTakeaway = 'Bored by wordy copy; needs instant visual impact.';
      suggestedTweak = 'Shorten the pitch by 50% and focus on a striking visual result.';
    }
  } else if (persona.id === 'david-smb') {
    if (score >= 70) {
      replyText = `If this can genuinely save my staff 5 hours a week and boost monthly store sales, I'm listening. What is the total monthly cost, and is there any setup fee? I need simple tools that don't break our workflow.`;
      keyTakeaway = 'Interested in bottom-line ROI and low labor overhead.';
      suggestedTweak = 'State the exact time saved and monthly price tier clearly.';
    } else {
      replyText = `Look, I run 3 physical stores and a Shopify site—I don't have time for complex tech platforms. This pitch doesn't explain how much it costs or how fast my team can start seeing extra sales. What's the actual bottom line?`;
      keyTakeaway = 'Resistant due to lack of explicit pricing and business case.';
      suggestedTweak = 'Highlight plain-English ROI and ease of setup for small teams.';
    }
  } else if (persona.id === 'marcus-growth') {
    if (score >= 70) {
      replyText = `Good hook. If this can move our conversion rates by even 3-5% or lower our CAC, I'd be open to running a test sprint. Do you have benchmark case studies from other B2B SaaS companies?`;
      keyTakeaway = 'Receptive to conversion optimization; wants CAC/LTV proof.';
      suggestedTweak = 'Add benchmark metrics or percentage lift statistics.';
    } else {
      replyText = `As Head of Growth, I need numbers. Words like "${userMessageText.slice(0, 30)}..." sound nice, but what's the verified conversion lift? Does this integrate natively with Hubspot and Google Analytics?`;
      keyTakeaway = 'Demands empirical data and CRM integration details.';
      suggestedTweak = 'Include data-backed evidence and CRM stack integrations.';
    }
  } else if (persona.id === 'elena-wellness') {
    if (score >= 70) {
      replyText = `This resonates with me. The tone feels thoughtful and aligned with our wellness ethos. If the visual presentation matches this level of care, our boutique community would appreciate it.`;
      keyTakeaway = 'Resonated with brand story and aesthetic positioning.';
      suggestedTweak = 'Emphasize the ethical origin story and community experience.';
    } else {
      replyText = `This feels a bit cold and commercial. In our luxury community, clients look for authentic stories, clean ethics, and beautiful presentation. Where is the human warmth in this pitch?`;
      keyTakeaway = 'Turned off by commercial, transactional language.';
      suggestedTweak = 'Soften the tone and focus on sensory/emotional wellness benefits.';
    }
  } else if (persona.id === 'sophia-eco') {
    if (score >= 70) {
      replyText = `I appreciate that you mentioned real environmental impact. If you can provide 3rd-party carbon audit numbers or lifecycle data on your site, you'll have my full support and recommendation.`;
      keyTakeaway = 'Encouraged by eco claims; looking for 3rd-party verification.';
      suggestedTweak = 'Provide links to certifications or lifecycle assessment data.';
    } else {
      replyText = `I hear claims like this all the time. Is this backed by 3rd-party lifecycle assessments or B-Corp certification? Without concrete data on supply chain transparency, it feels like greenwashing.`;
      keyTakeaway = 'Suspects greenwashing without official sustainability verification.';
      suggestedTweak = 'Replace vague eco words with specific certifications and supply chain metrics.';
    }
  } else {
    // Custom persona default fallback
    replyText = `As ${persona.name} (${persona.role}), I evaluated your pitch. Key elements aligned with my goals, but I have questions about ${persona.commonObjections[0] || 'pricing and implementation'}.`;
    keyTakeaway = `Evaluated from the perspective of ${persona.role}.`;
    suggestedTweak = `Target ${persona.name}'s key buying trigger: ${persona.buyingTriggers[0] || 'clear value proposition'}.`;
  }

  if (objections.length === 0) {
    objections.push(persona.commonObjections[0] || 'Requires clearer value proposition.');
  }

  return {
    replyText,
    intentScore: score,
    sentiment,
    objectionsRaised: objections,
    resonancePoints: resonance.length > 0 ? resonance : [`Aligns with ${persona.role} goals`],
    keyTakeaway,
    suggestedTweak
  };
}

/**
 * Generate AI Prompt suggestions to create a Persona
 */
export async function generatePersonaWithAI(
  promptDescription: string,
  config: LLMConfig
): Promise<Partial<BuyerPersona>> {
  // If API key available, call LLM to generate full persona definition
  if (config.defaultProvider === 'gemini' && config.geminiApiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel || 'gemini-2.0-flash'}:generateContent?key=${config.geminiApiKey}`;
      const prompt = `Create a marketing buyer persona based on: "${promptDescription}".
Return JSON matching:
{
  "name": "Full Name",
  "role": "Job Title",
  "industry": "Industry",
  "age": 35,
  "incomeRange": "$100k - $140k",
  "avatar": "💼",
  "bio": "2 sentence background...",
  "goals": ["Goal 1", "Goal 2"],
  "painPoints": ["Pain 1", "Pain 2"],
  "buyingTriggers": ["Trigger 1", "Trigger 2"],
  "commonObjections": ["Objection 1", "Objection 2"],
  "tone": "Tone description",
  "budgetSensitivity": "Medium",
  "decisionSpeed": "Moderate",
  "systemPrompt": "You are..."
}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        return JSON.parse(rawText.replace(/```json/gi, '').replace(/```/g, '').trim());
      }
    } catch (e) {
      console.warn('AI Persona Generation failed, using intelligent template generator:', e);
    }
  }

  // Smart template generator fallback
  const roleName = promptDescription.split(' ')[0] || 'Target Buyer';
  return {
    name: `${roleName.charAt(0).toUpperCase() + roleName.slice(1)} Professional`,
    role: promptDescription,
    industry: 'Target Industry',
    age: 36,
    incomeRange: '$90,000 - $130,000',
    avatar: '🎯',
    bio: `A busy professional working in ${promptDescription}, focused on efficiency, cost-effectiveness, and reliable performance.`,
    goals: ['Streamline day-to-day workflow', 'Maximize ROI on tools and services', 'Eliminate redundant software'],
    painPoints: ['Complex onboarding', 'Hidden costs and pricing transparency issues', 'Unreliable customer support'],
    buyingTriggers: ['Clear 14-day free trial', 'Strong peer reviews', 'Simple non-technical setup'],
    commonObjections: ['How long does it take to implement?', 'What is the exact monthly cost?', 'Is there a money-back guarantee?'],
    tone: 'Professional, pragmatic, detail-oriented',
    budgetSensitivity: 'Medium',
    decisionSpeed: 'Moderate',
    systemPrompt: `You are a ${promptDescription}. Respond in character to marketing pitches. Focus on practical ROI, implementation ease, and cost transparency.`
  };
}
