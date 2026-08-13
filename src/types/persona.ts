export type LLMProvider = 'gemini' | 'openai' | 'demo';

export interface LLMConfig {
  openaiApiKey: string;
  geminiApiKey: string;
  defaultProvider: LLMProvider;
  openaiModel: string;
  geminiModel: string;
}

export interface BuyerPersona {
  id: string;
  name: string;
  role: string;
  industry: string;
  age: number;
  incomeRange: string;
  avatar: string;
  bio: string;
  goals: string[];
  painPoints: string[];
  buyingTriggers: string[];
  commonObjections: string[];
  tone: string;
  budgetSensitivity: 'High' | 'Medium' | 'Low';
  decisionSpeed: 'Impulsive' | 'Moderate' | 'Analytical & Slow';
  preferredChannels: string[];
  systemPrompt: string;
  isCustom?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'marketer' | 'persona';
  text: string;
  timestamp: number;
  intentScore?: number; // 0 to 100
  sentiment?: 'enthusiastic' | 'positive' | 'neutral' | 'skeptical' | 'resistant';
  objectionsRaised?: string[];
  keyTakeaway?: string;
  suggestedTweak?: string;
}

export interface PitchAnalysis {
  personaId: string;
  personaName: string;
  personaAvatar: string;
  personaRole: string;
  response: string;
  intentScore: number;
  sentiment: 'enthusiastic' | 'positive' | 'neutral' | 'skeptical' | 'resistant';
  topObjection: string;
  resonancePoints: string[];
  suggestedTweak: string;
  isCompleted: boolean;
}

export interface CampaignReport {
  id: string;
  timestamp: number;
  pitchHeadline: string;
  targetAudienceSummary: string;
  averageIntentScore: number;
  analyses: PitchAnalysis[];
  overallRecommendation: string;
}
