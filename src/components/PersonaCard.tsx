import React from 'react';
import { BuyerPersona } from '../types/persona';
import { MessageSquare, Target, AlertTriangle, Zap, Edit3, Trash2 } from 'lucide-react';

interface PersonaCardProps {
  persona: BuyerPersona;
  index: number;
  onSelectChat: (persona: BuyerPersona) => void;
  onEdit: (persona: BuyerPersona) => void;
  onDelete?: (personaId: string) => void;
}

export const PersonaCard: React.FC<PersonaCardProps> = ({
  persona,
  index,
  onSelectChat,
  onEdit,
  onDelete
}) => {
  // Alternate irregular shape classes for architectural sketch aesthetic
  const irregularClasses = ['card-irregular-1', 'card-irregular-2', 'card-irregular-3'];
  const shapeClass = irregularClasses[index % irregularClasses.length];

  // Distinct top border color indicator based on budget sensitivity or index
  const topBorderClass = 
    persona.budgetSensitivity === 'High'
      ? 'border-t-8 border-t-brand-primary'
      : persona.budgetSensitivity === 'Medium'
      ? 'border-t-8 border-t-brand-secondary'
      : 'border-t-8 border-t-brand-dark';

  return (
    <div className={`group relative bg-brand-bg-light marker-stroke agency-shadow p-6 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between ${shapeClass} ${topBorderClass}`}>
      
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-brand-pale marker-stroke flex items-center justify-center text-3xl shadow-sm group-hover:scale-105 transition-transform">
              {persona.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline font-black text-lg text-brand-text">
                  {persona.name}
                </h3>
                {persona.isCustom && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-primary text-brand-bg">
                    Custom Model
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-brand-primary">{persona.role}</p>
              <p className="text-[11px] font-semibold text-brand-text-light">{persona.industry} • Age {persona.age}</p>
            </div>
          </div>

          {/* Budget & Speed Badges */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-brand-pale text-brand-dark border-2 border-brand-primary">
              Budget: {persona.budgetSensitivity}
            </span>
            <span className="text-[10px] font-semibold text-brand-text-light bg-brand-bg px-2 py-0.5 rounded-md border border-brand-text/40">
              {persona.decisionSpeed}
            </span>
          </div>
        </div>

        {/* Cognitive Bio */}
        <p className="text-xs text-brand-text-light font-medium leading-relaxed mb-4 p-3 bg-brand-bg rounded-2xl border-2 border-brand-text/20 italic">
          "{persona.bio}"
        </p>

        {/* Key Attributes */}
        <div className="space-y-2.5 mb-5">
          
          {/* Strategic Goals */}
          <div className="text-xs">
            <span className="flex items-center gap-1.5 text-brand-text font-bold mb-1">
              <Target className="w-3.5 h-3.5 text-brand-primary" /> Key Goals
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-brand-text-light font-medium pl-1 text-[11px]">
              {persona.goals.slice(0, 2).map((g, idx) => (
                <li key={idx} className="truncate">{g}</li>
              ))}
            </ul>
          </div>

          {/* Friction Points */}
          <div className="text-xs">
            <span className="flex items-center gap-1.5 text-brand-text font-bold mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-brand-secondary" /> Friction Points
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-brand-text-light font-medium pl-1 text-[11px]">
              {persona.painPoints.slice(0, 2).map((p, idx) => (
                <li key={idx} className="truncate">{p}</li>
              ))}
            </ul>
          </div>

          {/* Buying Triggers */}
          <div className="text-xs">
            <span className="flex items-center gap-1.5 text-brand-text font-bold mb-1">
              <Zap className="w-3.5 h-3.5 text-brand-dark" /> Buying Triggers
            </span>
            <div className="flex flex-wrap gap-1">
              {persona.buyingTriggers.slice(0, 2).map((t, idx) => (
                <span key={idx} className="text-[10px] font-semibold bg-brand-pale text-brand-dark px-2 py-0.5 rounded-md border border-brand-primary/30 truncate max-w-[200px]">
                  {t}
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t-2 border-brand-text/20 flex items-center justify-between gap-2">
        <button
          onClick={() => onSelectChat(persona)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-brand-primary hover:bg-brand-secondary text-brand-bg rounded-xl font-headline font-extrabold text-xs marker-stroke agency-shadow-sm transition-all"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Strategic Dialogue</span>
        </button>

        <button
          onClick={() => onEdit(persona)}
          className="p-2 bg-brand-bg hover:bg-brand-pale text-brand-text rounded-xl border-2 border-brand-text transition-all"
          title="Edit Archetype"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>

        {persona.isCustom && onDelete && (
          <button
            onClick={() => onDelete(persona.id)}
            className="p-2 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-xl border-2 border-rose-800 transition-all"
            title="Delete Custom Archetype"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

    </div>
  );
};
