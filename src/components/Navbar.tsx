import React from 'react';
import { 
  Users, 
  MessageSquare, 
  Radio, 
  Settings, 
  PlusCircle, 
  Zap, 
  Layers,
  Cpu,
  Compass
} from 'lucide-react';
import { BuyerPersona, LLMConfig } from '../types/persona';

interface NavbarProps {
  activeTab: 'library' | 'chat' | 'broadcast' | 'analytics';
  setActiveTab: (tab: 'library' | 'chat' | 'broadcast' | 'analytics') => void;
  selectedPersona: BuyerPersona;
  personas: BuyerPersona[];
  onSelectPersona: (persona: BuyerPersona) => void;
  onOpenSettings: () => void;
  onOpenCreatePersona: () => void;
  llmConfig: LLMConfig;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  selectedPersona,
  personas,
  onSelectPersona,
  onOpenSettings,
  onOpenCreatePersona,
  llmConfig
}) => {
  return (
    <header className="sticky top-0 z-40 bg-brand-bg/90 backdrop-blur-xl border-b-[3px] border-brand-text px-4 lg:px-8 py-3.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Brand Logo & Tagline */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('library')}>
            <div className="w-10 h-10 rounded-2xl bg-brand-primary marker-stroke flex items-center justify-center text-brand-bg shadow-md">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline font-black text-2xl tracking-tight text-brand-text">
                  1906.ai
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-pale text-brand-primary border border-brand-primary/30">
                  Decision Intelligence
                </span>
              </div>
              <p className="text-xs font-semibold text-brand-text-light">Synthetic Archetype Testing Studio</p>
            </div>
          </div>
        </div>

        {/* Center Nav Tabs */}
        <nav className="flex items-center bg-brand-bg-light p-1.5 rounded-2xl marker-stroke agency-shadow-sm">
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-headline font-bold transition-all ${
              activeTab === 'library'
                ? 'bg-brand-primary text-brand-bg marker-stroke shadow-sm'
                : 'text-brand-text-light hover:text-brand-text hover:bg-brand-pale/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Synthetic Archetypes</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-headline font-bold transition-all ${
              activeTab === 'chat'
                ? 'bg-brand-primary text-brand-bg marker-stroke shadow-sm'
                : 'text-brand-text-light hover:text-brand-text hover:bg-brand-pale/50'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Strategic Dialogue</span>
          </button>

          <button
            onClick={() => setActiveTab('broadcast')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-headline font-bold transition-all ${
              activeTab === 'broadcast'
                ? 'bg-brand-primary text-brand-bg marker-stroke shadow-sm'
                : 'text-brand-text-light hover:text-brand-text hover:bg-brand-pale/50'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Broadcast Validation</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-headline font-bold transition-all ${
              activeTab === 'analytics'
                ? 'bg-brand-primary text-brand-bg marker-stroke shadow-sm'
                : 'text-brand-text-light hover:text-brand-text hover:bg-brand-pale/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Telemetry Archives</span>
          </button>
        </nav>

        {/* Right Controls & Compute Credits Counter */}
        <div className="flex items-center gap-3">
          
          {/* Compute Credits Counter */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-pale text-brand-dark border-2 border-brand-primary font-headline text-xs font-extrabold shadow-sm">
            <Zap className="w-3.5 h-3.5 fill-brand-primary text-brand-primary" />
            <span>4,290 compute credits</span>
          </div>

          {/* Active Persona Dropdown Quick Switcher */}
          {activeTab === 'chat' && (
            <div className="flex items-center gap-2 bg-brand-bg-light border-2 border-brand-text rounded-xl px-3 py-1 text-xs">
              <span className="text-brand-text-light font-bold hidden sm:inline">Active:</span>
              <select
                value={selectedPersona.id}
                onChange={(e) => {
                  const target = personas.find(p => p.id === e.target.value);
                  if (target) onSelectPersona(target);
                }}
                className="bg-transparent text-brand-text font-headline font-bold focus:outline-none cursor-pointer pr-2"
              >
                {personas.map(p => (
                  <option key={p.id} value={p.id} className="bg-brand-bg-light text-brand-text">
                    {p.avatar} {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* New Archetype Button */}
          <button
            onClick={onOpenCreatePersona}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-headline font-extrabold bg-brand-bg-light hover:bg-brand-pale text-brand-text border-2 border-brand-text transition-all"
          >
            <PlusCircle className="w-4 h-4 text-brand-primary" />
            <span className="hidden sm:inline">New Archetype</span>
          </button>

          {/* Engine & Provider Settings */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-headline font-bold bg-brand-primary hover:bg-brand-secondary text-brand-bg border-2 border-brand-text transition-all group"
            title="Configure OpenAI / Gemini API Keys & Provider Engine"
          >
            <Cpu className="w-4 h-4 text-brand-bg group-hover:rotate-45 transition-transform" />
            <span className="uppercase text-[11px] font-extrabold tracking-wider">
              {llmConfig.defaultProvider === 'gemini' ? 'Gemini' : llmConfig.defaultProvider === 'openai' ? 'OpenAI' : 'Demo Engine'}
            </span>
            <Settings className="w-3.5 h-3.5 text-brand-bg/80" />
          </button>

        </div>

      </div>
    </header>
  );
};
