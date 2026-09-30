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
  budgetSensitivity: "High" | "Medium" | "Low";
  decisionSpeed: "Impulsive" | "Moderate" | "Analytical & Slow";
  preferredChannels: string[];
  systemPrompt: string;
  isCustom?: boolean;
}
