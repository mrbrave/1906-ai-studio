import React, { useState } from 'react';
import { BuyerPersona } from '../types/persona';
import { PersonaCard } from './PersonaCard';
import { Search, PlusCircle, Filter, Radio, Compass } from 'lucide-react';

interface PersonaLibraryProps {
  personas: BuyerPersona[];
  onSelectChat: (persona: BuyerPersona) => void;
  onEditPersona: (persona: BuyerPersona) => void;
  onDeletePersona: (personaId: string) => void;
  onCreatePersona: () => void;
  onStartBroadcast: () => void;
}

export const PersonaLibrary: React.FC<PersonaLibraryProps> = ({
  personas,
  onSelectChat,
  onEditPersona,
  onDeletePersona,
  onCreatePersona,
  onStartBroadcast
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSensitivity, setFilterSensitivity] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');

  const filtered = personas.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.bio.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesBudget = filterSensitivity === 'All' || p.budgetSensitivity === filterSensitivity;

    return matchesSearch && matchesBudget;
  });

  return (
    <div className="space-y-6">
      
      {/* Hero Architectural Header Banner */}
      <div className="relative overflow-hidden bg-brand-bg-light marker-stroke agency-shadow card-irregular-1 p-6 lg:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-pale text-brand-dark border-2 border-brand-primary text-xs font-headline font-bold">
              <Compass className="w-3.5 h-3.5" /> 1906.ai Decision-Intelligence Studio
            </div>
            <h1 className="font-headline font-black text-2xl lg:text-3xl text-brand-text tracking-tight">
              Synthetic Archetypes & Cognitive Decision Engine
            </h1>
            <p className="text-sm font-medium text-brand-text-light leading-relaxed">
              Test strategic positioning, brand narratives, and value propositions against curated executive buyer archetypes before market deployment.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onStartBroadcast}
              className="btn-irregular marker-stroke agency-shadow bg-brand-primary hover:bg-brand-secondary text-brand-bg px-6 py-3.5 font-headline font-black text-sm flex items-center justify-center gap-2 transition-all hover:scale-105"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Broadcast Validation</span>
            </button>

            <button
              onClick={onCreatePersona}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-brand-bg hover:bg-brand-pale text-brand-text font-headline font-bold text-sm border-2 border-brand-text transition-all"
            >
              <PlusCircle className="w-4 h-4 text-brand-primary" />
              <span>New Archetype</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-brand-bg-light p-4 rounded-2xl marker-stroke agency-shadow-sm">
        
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-light" />
          <input
            type="text"
            placeholder="Search cognitive models by name, role, industry, or friction points..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-brand-bg text-brand-text placeholder-brand-text-light text-xs rounded-xl pl-10 pr-4 py-2.5 border-2 border-brand-text focus:outline-none focus:border-brand-primary transition-colors font-medium"
          />
        </div>

        {/* Budget Sensitivity Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-headline font-bold text-brand-text flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Budget Sensitivity:
          </span>
          {(['All', 'High', 'Medium', 'Low'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterSensitivity(lvl)}
              className={`text-xs font-headline font-bold px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                filterSensitivity === lvl
                  ? 'bg-brand-primary text-brand-bg marker-stroke shadow-sm'
                  : 'bg-brand-bg text-brand-text-light hover:text-brand-text border border-brand-text/40'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

      </div>

      {/* Synthetic Archetypes Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-brand-bg-light rounded-3xl marker-stroke p-8 space-y-3">
          <p className="text-brand-text-light font-medium text-sm">No synthetic archetypes match your criteria.</p>
          <button
            onClick={() => { setSearchTerm(''); setFilterSensitivity('All'); }}
            className="text-xs font-headline font-bold text-brand-primary hover:underline"
          >
            Reset Search Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((persona, index) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              index={index}
              onSelectChat={onSelectChat}
              onEdit={onEditPersona}
              onDelete={onDeletePersona}
            />
          ))}
        </div>
      )}

    </div>
  );
};
