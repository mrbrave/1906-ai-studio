import { LLMConfig, BuyerPersona, CampaignReport } from '../types/persona';
import { DEFAULT_PERSONAS } from '../data/defaultPersonas';

const LLM_CONFIG_KEY = 'personaflow_llm_config';
const CUSTOM_PERSONAS_KEY = 'personaflow_custom_personas';
const REPORTS_KEY = 'personaflow_reports';

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  openaiApiKey: '',
  geminiApiKey: '',
  defaultProvider: 'demo',
  openaiModel: 'gpt-4o-mini',
  geminiModel: 'gemini-2.0-flash'
};

export const getLLMConfig = (): LLMConfig => {
  try {
    const data = localStorage.getItem(LLM_CONFIG_KEY);
    if (!data) return DEFAULT_LLM_CONFIG;
    return { ...DEFAULT_LLM_CONFIG, ...JSON.parse(data) };
  } catch (e) {
    console.error('Error loading LLM config:', e);
    return DEFAULT_LLM_CONFIG;
  }
};

export const saveLLMConfig = (config: LLMConfig): void => {
  try {
    localStorage.setItem(LLM_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Error saving LLM config:', e);
  }
};

export const getSavedPersonas = (): BuyerPersona[] => {
  try {
    const customData = localStorage.getItem(CUSTOM_PERSONAS_KEY);
    const customPersonas: BuyerPersona[] = customData ? JSON.parse(customData) : [];
    return [...DEFAULT_PERSONAS, ...customPersonas];
  } catch (e) {
    console.error('Error loading personas:', e);
    return DEFAULT_PERSONAS;
  }
};

export const saveCustomPersona = (persona: BuyerPersona): BuyerPersona[] => {
  try {
    const customData = localStorage.getItem(CUSTOM_PERSONAS_KEY);
    const existing: BuyerPersona[] = customData ? JSON.parse(customData) : [];
    
    const index = existing.findIndex(p => p.id === persona.id);
    let updated: BuyerPersona[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = { ...persona, isCustom: true };
    } else {
      updated = [...existing, { ...persona, isCustom: true }];
    }
    
    localStorage.setItem(CUSTOM_PERSONAS_KEY, JSON.stringify(updated));
    return [...DEFAULT_PERSONAS, ...updated];
  } catch (e) {
    console.error('Error saving custom persona:', e);
    return DEFAULT_PERSONAS;
  }
};

export const deleteCustomPersona = (personaId: string): BuyerPersona[] => {
  try {
    const customData = localStorage.getItem(CUSTOM_PERSONAS_KEY);
    if (!customData) return DEFAULT_PERSONAS;
    
    const existing: BuyerPersona[] = JSON.parse(customData);
    const updated = existing.filter(p => p.id !== personaId);
    localStorage.setItem(CUSTOM_PERSONAS_KEY, JSON.stringify(updated));
    return [...DEFAULT_PERSONAS, ...updated];
  } catch (e) {
    console.error('Error deleting custom persona:', e);
    return DEFAULT_PERSONAS;
  }
};

export const getCampaignReports = (): CampaignReport[] => {
  try {
    const data = localStorage.getItem(REPORTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading reports:', e);
    return [];
  }
};

export const saveCampaignReport = (report: CampaignReport): CampaignReport[] => {
  try {
    const reports = getCampaignReports();
    const updated = [report, ...reports];
    localStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Error saving campaign report:', e);
    return [];
  }
};
