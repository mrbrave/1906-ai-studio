import React, { useState } from 'react';
import { BuyerPersona, LLMConfig } from '../types/persona';
import { generatePersonaWithAI } from '../services/llmService';
import { X, Sparkles, Save, UserPlus, Wand2 } from 'lucide-react';

interface PersonaEditorModalProps {
  personaToEdit?: BuyerPersona | null;
  onSave: (persona: BuyerPersona) => void;
  onClose: () => void;
  llmConfig: LLMConfig;
}

export const PersonaEditorModal: React.FC<PersonaEditorModalProps> = ({
  personaToEdit,
  onSave,
  onClose,
  llmConfig
}) => {
  const [name, setName] = useState(personaToEdit?.name || '');
  const [role, setRole] = useState(personaToEdit?.role || '');
  const [industry, setIndustry] = useState(personaToEdit?.industry || '');
  const [age, setAge] = useState<number>(personaToEdit?.age || 36);
  const [incomeRange, setIncomeRange] = useState(personaToEdit?.incomeRange || '$110k - $160k');
  const [avatar, setAvatar] = useState(personaToEdit?.avatar || '👤');
  const [bio, setBio] = useState(personaToEdit?.bio || '');
  const [goals, setGoals] = useState<string>(personaToEdit?.goals.join('\n') || '');
  const [painPoints, setPainPoints] = useState<string>(personaToEdit?.painPoints.join('\n') || '');
  const [buyingTriggers, setBuyingTriggers] = useState<string>(personaToEdit?.buyingTriggers.join('\n') || '');
  const [commonObjections, setCommonObjections] = useState<string>(personaToEdit?.commonObjections.join('\n') || '');
  const [tone, setTone] = useState(personaToEdit?.tone || 'Analytical & Terse');
  const [budgetSensitivity, setBudgetSensitivity] = useState<'High' | 'Medium' | 'Low'>(personaToEdit?.budgetSensitivity || 'Medium');
  const [decisionSpeed, setDecisionSpeed] = useState<'Impulsive' | 'Moderate' | 'Analytical & Slow'>(personaToEdit?.decisionSpeed || 'Moderate');

  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || generatingAi) return;
    setGeneratingAi(true);

    try {
      const generated = await generatePersonaWithAI(aiPrompt, llmConfig);

      if (generated.name) setName(generated.name);
      if (generated.role) setRole(generated.role);
      if (generated.industry) setIndustry(generated.industry);
      if (generated.age) setAge(generated.age);
      if (generated.incomeRange) setIncomeRange(generated.incomeRange);
      if (generated.avatar) setAvatar(generated.avatar);
      if (generated.bio) setBio(generated.bio);
      if (generated.goals) setGoals(generated.goals.join('\n'));
      if (generated.painPoints) setPainPoints(generated.painPoints.join('\n'));
      if (generated.buyingTriggers) setBuyingTriggers(generated.buyingTriggers.join('\n'));
      if (generated.commonObjections) setCommonObjections(generated.commonObjections.join('\n'));
      if (generated.tone) setTone(generated.tone);
    } catch (e) {
      console.error('Error generating archetype:', e);
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newPersona: BuyerPersona = {
      id: personaToEdit?.id || `custom-${Date.now()}`,
      name: name || 'Unnamed Archetype',
      role: role || 'Executive Decision Maker',
      industry: industry || 'Target Industry',
      age: Number(age) || 35,
      incomeRange,
      avatar,
      bio: bio || 'No bio specified.',
      goals: goals.split('\n').filter(g => g.trim()),
      painPoints: painPoints.split('\n').filter(p => p.trim()),
      buyingTriggers: buyingTriggers.split('\n').filter(t => t.trim()),
      commonObjections: commonObjections.split('\n').filter(o => o.trim()),
      tone: tone || 'Pragmatic',
      budgetSensitivity,
      decisionSpeed,
      preferredChannels: ['Executive Briefings', 'Direct Consultation'],
      systemPrompt: `You are ${name}, a ${age}-year-old ${role} in ${industry}. Evaluate pitches pragmatically based on your goals: ${goals} and pain points: ${painPoints}.`,
      isCustom: true
    };

    onSave(newPersona);
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-text/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-brand-bg-light marker-stroke agency-shadow card-irregular-1 p-6 space-y-5 my-8 text-brand-text">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-brand-text/20 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-brand-primary text-brand-bg marker-stroke flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-black text-lg text-brand-text">
                {personaToEdit ? 'Edit Synthetic Archetype' : 'Synthesize New Cognitive Model'}
              </h3>
              <p className="text-xs font-semibold text-brand-text-light">
                Configure cognitive drivers, friction points, and decision boundaries.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-brand-text-light hover:text-brand-text rounded-xl hover:bg-brand-pale transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Archetype Generator Bar */}
        <div className="bg-brand-pale border-2 border-brand-primary p-4 rounded-2xl space-y-2">
          <label className="text-xs font-headline font-black text-brand-dark flex items-center gap-1.5">
            <Wand2 className="w-4 h-4 text-brand-primary" /> AI Archetype Synthesis Prompt
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g., Enterprise Chief Risk Officer concerned with SOC2 and uptime..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="flex-1 bg-brand-bg text-brand-text placeholder-brand-text-light text-xs rounded-xl px-3.5 py-2 border-2 border-brand-text focus:outline-none focus:border-brand-primary font-medium"
            />
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={!aiPrompt.trim() || generatingAi}
              className="px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-brand-bg font-headline font-extrabold text-xs rounded-xl marker-stroke agency-shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{generatingAi ? 'Synthesizing...' : 'Auto-Fill'}</span>
            </button>
          </div>
        </div>

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-headline font-bold text-brand-text mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Eleanor Vance"
                className="w-full bg-brand-bg text-brand-text p-2.5 rounded-xl border-2 border-brand-text focus:border-brand-primary focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block font-headline font-bold text-brand-text mb-1">Role / Title</label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. VP of Security & Infrastructure"
                className="w-full bg-brand-bg text-brand-text p-2.5 rounded-xl border-2 border-brand-text focus:border-brand-primary focus:outline-none font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-headline font-bold text-brand-text mb-1">Industry</label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. SaaS & Cloud"
                className="w-full bg-brand-bg text-brand-text p-2.5 rounded-xl border-2 border-brand-text focus:border-brand-primary focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block font-headline font-bold text-brand-text mb-1">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full bg-brand-bg text-brand-text p-2.5 rounded-xl border-2 border-brand-text focus:border-brand-primary focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block font-headline font-bold text-brand-text mb-1">Avatar Emoji</label>
              <input
                type="text"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                className="w-full bg-brand-bg text-brand-text p-2.5 rounded-xl border-2 border-brand-text text-center focus:border-brand-primary focus:outline-none text-base font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-headline font-bold text-brand-text mb-1">Cognitive Background Bio</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Summary of decision background..."
              className="w-full bg-brand-bg text-brand-text p-2.5 rounded-xl border-2 border-brand-text focus:border-brand-primary focus:outline-none resize-none font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-headline font-bold text-brand-text mb-1">Strategic Goals (1 per line)</label>
              <textarea
                rows={3}
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="Ensure 99.99% uptime&#10;Cut redundant SaaS license costs"
                className="w-full bg-brand-bg text-brand-text p-2.5 rounded-xl border-2 border-brand-text focus:border-brand-primary focus:outline-none resize-none font-medium"
              />
            </div>

            <div>
              <label className="block font-headline font-bold text-brand-text mb-1">Friction Points (1 per line)</label>
              <textarea
                rows={3}
                value={painPoints}
                onChange={(e) => setPainPoints(e.target.value)}
                placeholder="Hidden API fees&#10;Unverified SOC2 security claims"
                className="w-full bg-brand-bg text-brand-text p-2.5 rounded-xl border-2 border-brand-text focus:border-brand-primary focus:outline-none resize-none font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-headline font-bold text-brand-text mb-1">Budget Sensitivity</label>
              <select
                value={budgetSensitivity}
                onChange={(e) => setBudgetSensitivity(e.target.value as any)}
                className="w-full bg-brand-bg text-brand-text p-2.5 rounded-xl border-2 border-brand-text focus:border-brand-primary focus:outline-none font-medium"
              >
                <option value="High">High (Cost Sensitive)</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low (Premium / Enterprise)</option>
              </select>
            </div>

            <div>
              <label className="block font-headline font-bold text-brand-text mb-1">Decision Velocity</label>
              <select
                value={decisionSpeed}
                onChange={(e) => setDecisionSpeed(e.target.value as any)}
                className="w-full bg-brand-bg text-brand-text p-2.5 rounded-xl border-2 border-brand-text focus:border-brand-primary focus:outline-none font-medium"
              >
                <option value="Impulsive">Impulsive</option>
                <option value="Moderate">Moderate</option>
                <option value="Analytical & Slow">Analytical & Slow</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t-2 border-brand-text/20 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-brand-bg text-brand-text font-headline font-bold hover:bg-brand-pale border-2 border-brand-text transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-secondary text-brand-bg font-headline font-black marker-stroke agency-shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Archetype</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
