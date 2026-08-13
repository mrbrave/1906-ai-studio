import React, { useState } from 'react';
import { BuyerPersona, LLMConfig, PitchAnalysis, CampaignReport } from '../types/persona';
import { generatePersonaResponse } from '../services/llmService';
import { saveCampaignReport } from '../services/storageService';
import { 
  Radio, 
  Award, 
  AlertTriangle, 
  Sparkles, 
  CheckSquare, 
  Square,
  Compass,
  Zap,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface BroadcastStudioProps {
  personas: BuyerPersona[];
  llmConfig: LLMConfig;
  onSaveReport?: (report: CampaignReport) => void;
}

export const BroadcastStudio: React.FC<BroadcastStudioProps> = ({
  personas,
  llmConfig,
  onSaveReport
}) => {
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>(
    personas.map(p => p.id)
  );

  const [pitchInput, setPitchInput] = useState(
    'Introducing 1906.ai: The decision-intelligence studio that validates executive positioning and cuts strategic risk by 50% with zero setup friction.'
  );

  const [testing, setTesting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [analyses, setAnalyses] = useState<PitchAnalysis[]>([]);
  const [activeReport, setActiveReport] = useState<CampaignReport | null>(null);

  const toggleSelectPersona = (id: string) => {
    if (selectedPersonaIds.includes(id)) {
      if (selectedPersonaIds.length === 1) return; // Keep at least one
      setSelectedPersonaIds(selectedPersonaIds.filter(pid => pid !== id));
    } else {
      setSelectedPersonaIds([...selectedPersonaIds, id]);
    }
  };

  const selectAll = () => setSelectedPersonaIds(personas.map(p => p.id));
  const deselectAll = () => setSelectedPersonaIds([personas[0].id]);

  const runBroadcastTest = async () => {
    if (!pitchInput.trim() || testing) return;

    setTesting(true);
    setAnalyses([]);
    setActiveReport(null);

    const targetPersonas = personas.filter(p => selectedPersonaIds.includes(p.id));
    const results: PitchAnalysis[] = [];

    for (let i = 0; i < targetPersonas.length; i++) {
      const p = targetPersonas[i];
      setProgressText(`Simulating Cognitive Responses for ${p.name} (${i + 1}/${targetPersonas.length})...`);

      try {
        const payload = await generatePersonaResponse(p, pitchInput, [], llmConfig);

        results.push({
          personaId: p.id,
          personaName: p.name,
          personaAvatar: p.avatar,
          personaRole: p.role,
          response: payload.replyText,
          intentScore: payload.intentScore,
          sentiment: payload.sentiment,
          topObjection: payload.objectionsRaised[0] || 'Pricing clarification required',
          resonancePoints: payload.resonancePoints,
          suggestedTweak: payload.suggestedTweak,
          isCompleted: true
        });
      } catch (err) {
        console.error(`Error broadcasting to ${p.name}:`, err);
      }
    }

    // Sort results by highest intent score
    results.sort((a, b) => b.intentScore - a.intentScore);
    setAnalyses(results);
    setTesting(false);

    // Calculate Campaign Summary
    const avgScore = Math.round(results.reduce((acc, r) => acc + r.intentScore, 0) / (results.length || 1));
    const winner = results[0];

    let overallRec = `Top cognitive alignment: ${winner.personaName} (${winner.personaRole}) with ${winner.intentScore}% conversion intent. `;
    if (avgScore >= 70) {
      overallRec += `Strong strategy validation score! Prioritize acquisition positioning around ${winner.personaRole}.`;
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
    } else {
      overallRec += `To increase cross-archetype resonance, pre-empt primary objection: "${winner.topObjection}".`;
    }

    const report: CampaignReport = {
      id: `report-${Date.now()}`,
      timestamp: Date.now(),
      pitchHeadline: pitchInput,
      targetAudienceSummary: `${results.length} Cognitive Models Evaluated`,
      averageIntentScore: avgScore,
      analyses: results,
      overallRecommendation: overallRec
    };

    setActiveReport(report);
    saveCampaignReport(report);
    if (onSaveReport) onSaveReport(report);
  };

  return (
    <div className="space-y-6">
      
      {/* Broadcast Validation Studio Split Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Left Column - Inputs & Archetype Selector (5/12) */}
        <div className="w-full lg:w-5/12 bg-brand-bg-light marker-stroke agency-shadow p-6 card-irregular-1 space-y-5">
          
          <div className="border-b-2 border-brand-text/20 pb-4">
            <div className="inline-flex items-center gap-1.5 text-xs font-headline font-bold text-brand-primary uppercase tracking-wider mb-1">
              <Radio className="w-4 h-4 animate-pulse" /> 1906 Validation Studio
            </div>
            <h2 className="font-headline font-black text-xl text-brand-text">Broadcast Validation</h2>
            <p className="text-xs font-medium text-brand-text-light mt-1">
              Dispatch positioning narratives across multiple synthetic cognitive archetypes concurrently.
            </p>
          </div>

          {/* Archetype Multi-Select */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-headline font-bold text-brand-text">Select Target Archetypes:</span>
              <div className="flex items-center gap-2 font-headline font-bold">
                <button onClick={selectAll} className="text-brand-primary hover:underline">
                  All ({personas.length})
                </button>
                <span className="text-brand-neutral">•</span>
                <button onClick={deselectAll} className="text-brand-text-light hover:underline">
                  Reset
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {personas.map((p) => {
                const isSelected = selectedPersonaIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleSelectPersona(p.id)}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-brand-pale border-brand-primary font-bold text-brand-dark shadow-sm'
                        : 'bg-brand-bg border-brand-text/30 text-brand-text-light opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base">{p.avatar}</span>
                      <span className="text-xs truncate font-headline">{p.name.split(' ')[0]}</span>
                    </div>
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-brand-primary shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-brand-neutral shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input Pitch Box */}
          <div className="space-y-2">
            <label className="block text-xs font-headline font-bold text-brand-text">
              Strategic Narrative / Pitch to Validate:
            </label>

            <textarea
              rows={4}
              value={pitchInput}
              onChange={(e) => setPitchInput(e.target.value)}
              placeholder="Enter value proposition, headline, or campaign positioning copy..."
              className="w-full bg-brand-bg text-brand-text placeholder-brand-text-light text-xs font-medium rounded-2xl p-4 border-2 border-brand-text focus:outline-none focus:border-brand-primary transition-colors resize-none"
            />
          </div>

          {/* Primary Action Button (Architectural Irregular Button) */}
          <button
            onClick={runBroadcastTest}
            disabled={!pitchInput.trim() || testing || selectedPersonaIds.length === 0}
            className="w-full py-4 btn-irregular marker-stroke agency-shadow bg-brand-primary hover:bg-brand-secondary text-brand-bg font-headline font-black text-sm flex items-center justify-center gap-2 transition-all hover:scale-102 cursor-pointer disabled:opacity-50"
          >
            <Radio className="w-5 h-5 animate-pulse" />
            <span>Execute Broadcast Validation ({selectedPersonaIds.length})</span>
          </button>

        </div>

        {/* Right Column - Results Matrix & Average Intent Card (7/12) */}
        <div className="w-full lg:w-7/12 space-y-6">
          
          {/* Loading State */}
          {testing && (
            <div className="p-12 bg-brand-bg-light marker-stroke agency-shadow card-irregular-2 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-primary text-brand-bg marker-stroke flex items-center justify-center mx-auto animate-spin">
                <Compass className="w-7 h-7" />
              </div>
              <h3 className="font-headline font-black text-lg text-brand-text">
                Simulating Cognitive Responses
              </h3>
              <p className="text-xs font-headline font-bold text-brand-primary animate-pulse">
                {progressText}
              </p>
            </div>
          )}

          {/* Initial State before testing */}
          {!testing && !activeReport && (
            <div className="p-12 bg-brand-bg-light marker-stroke agency-shadow card-irregular-2 text-center space-y-3">
              <Layers className="w-12 h-12 text-brand-primary mx-auto opacity-80" />
              <h3 className="font-headline font-black text-lg text-brand-text">
                Awaiting Telemetry Data
              </h3>
              <p className="text-xs font-medium text-brand-text-light max-w-md mx-auto">
                Configure your target cognitive models and pitch narrative on the left, then click "Execute Broadcast Validation" to simulate telemetry responses.
              </p>
            </div>
          )}

          {/* Results View */}
          {!testing && activeReport && (
            <div className="space-y-6">
              
              {/* Prominent Dark Matrix Summary Card (card-irregular-3) */}
              <div className="bg-brand-dark text-brand-bg marker-stroke agency-shadow card-irregular-3 p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-pale/20 pb-4">
                  <div>
                    <span className="text-[10px] font-headline font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-brand-pale text-brand-dark">
                      Telemetry Matrix Summary
                    </span>
                    <h3 className="font-headline font-black text-xl text-brand-bg mt-1">
                      Matrix Average Intent: <span className="text-cyan-300 font-black">{activeReport.averageIntentScore}%</span>
                    </h3>
                  </div>

                  <div className="bg-brand-primary p-3 rounded-2xl border-2 border-brand-bg text-center shrink-0">
                    <span className="text-[10px] font-headline font-bold uppercase text-brand-pale block">Top Aligned Archetype</span>
                    <span className="text-xl">{activeReport.analyses[0].personaAvatar}</span>
                    <p className="font-headline font-black text-xs text-brand-bg">{activeReport.analyses[0].personaName}</p>
                  </div>
                </div>

                <p className="text-xs font-medium text-brand-pale leading-relaxed">
                  💡 <strong>Strategic Assessment:</strong> {activeReport.overallRecommendation}
                </p>
              </div>

              {/* Individual Archetype Response Cards */}
              <div className="space-y-4">
                <h4 className="font-headline font-black text-sm uppercase tracking-wider text-brand-text">
                  Cognitive Archetype Breakdown ({activeReport.analyses.length})
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeReport.analyses.map((result, idx) => (
                    <div
                      key={result.personaId}
                      className="bg-brand-bg-light marker-stroke agency-shadow-sm p-4 rounded-2xl space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-brand-text/10 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{result.personaAvatar}</span>
                          <div>
                            <h5 className="font-headline font-black text-xs text-brand-text">{result.personaName}</h5>
                            <p className="text-[10px] font-semibold text-brand-text-light">{result.personaRole}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="font-headline font-black text-lg text-brand-primary">{result.intentScore}%</span>
                          <span className="text-[9px] block text-brand-text-light font-bold">Rank #{idx + 1}</span>
                        </div>
                      </div>

                      <p className="text-xs text-brand-text-light font-medium italic bg-brand-bg p-2.5 rounded-xl border border-brand-text/20">
                        "{result.response}"
                      </p>

                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-start gap-1 text-rose-900 bg-rose-50 p-1.5 rounded-lg border border-rose-200">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                          <span><strong>Friction:</strong> {result.topObjection}</span>
                        </div>

                        <div className="flex items-start gap-1 text-amber-900 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                          <Sparkles className="w-3 h-3 shrink-0 mt-0.5 text-amber-600" />
                          <span><strong>Recommended Tweak:</strong> {result.suggestedTweak}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
