import React from 'react';
import { BuyerPersona } from '../types/persona';
import { Target, AlertCircle, CheckCircle2, Lightbulb, TrendingUp, Compass } from 'lucide-react';

interface MetricsGaugeProps {
  persona: BuyerPersona;
  intentScore: number;
  sentiment?: 'enthusiastic' | 'positive' | 'neutral' | 'skeptical' | 'resistant';
  objectionsRaised?: string[];
  resonancePoints?: string[];
  keyTakeaway?: string;
  suggestedTweak?: string;
}

export const MetricsGauge: React.FC<MetricsGaugeProps> = ({
  persona,
  intentScore,
  sentiment = 'neutral',
  objectionsRaised = [],
  resonancePoints = [],
  keyTakeaway,
  suggestedTweak
}) => {
  // Score color helper
  const getScoreColor = (score: number) => {
    if (score >= 75) return { text: 'text-emerald-700', bg: 'bg-emerald-600', border: 'border-emerald-700' };
    if (score >= 50) return { text: 'text-brand-primary', bg: 'bg-brand-primary', border: 'border-brand-primary' };
    if (score >= 35) return { text: 'text-amber-700', bg: 'bg-amber-600', border: 'border-amber-700' };
    return { text: 'text-rose-700', bg: 'bg-rose-600', border: 'border-rose-700' };
  };

  const colors = getScoreColor(intentScore);

  return (
    <div className="bg-brand-bg-light marker-stroke agency-shadow rounded-3xl p-5 space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-brand-text/20 pb-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-brand-primary" />
          <h4 className="font-headline font-black text-xs uppercase tracking-wider text-brand-text">
            Live Telemetry Telecommunication
          </h4>
        </div>
        <span className={`text-[10px] font-headline font-black uppercase px-2.5 py-0.5 rounded-full bg-brand-pale text-brand-dark border border-brand-primary`}>
          {sentiment}
        </span>
      </div>

      {/* Main Gauge Meter */}
      <div className="bg-brand-bg p-4 rounded-2xl border-2 border-brand-text text-center space-y-2">
        <div className="flex items-baseline justify-center gap-1">
          <span className={`text-4xl font-headline font-black tracking-tight ${colors.text}`}>
            {intentScore}%
          </span>
          <span className="text-xs font-headline font-bold text-brand-text-light">Conversion Intent</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-brand-neutral/30 rounded-full h-3 overflow-hidden border border-brand-text">
          <div
            className={`h-full transition-all duration-700 ease-out ${colors.bg}`}
            style={{ width: `${intentScore}%` }}
          />
        </div>
        <p className="text-[11px] font-semibold text-brand-text-light">
          {intentScore >= 75
            ? '🔥 High strategy alignment!'
            : intentScore >= 50
            ? '⚡ Moderate alignment. Address friction points.'
            : '⚠️ High friction / low strategy response.'}
        </p>
      </div>

      {/* Strategic Advisory Section */}
      <div className="border-t-2 border-brand-text/20 pt-3 space-y-3">
        <h5 className="font-headline font-black text-xs uppercase tracking-wider text-brand-primary flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-brand-primary" /> Strategic Advisory
        </h5>

        {/* Key Takeaway */}
        {keyTakeaway && (
          <div className="bg-brand-pale border-2 border-brand-primary p-3 rounded-2xl space-y-1">
            <span className="text-[10px] font-headline font-black uppercase text-brand-dark flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-brand-primary" /> Core Reaction
            </span>
            <p className="text-xs font-semibold text-brand-text leading-snug">
              "{keyTakeaway}"
            </p>
          </div>
        )}

        {/* Actionable Tweak Advice */}
        {suggestedTweak && (
          <div className="bg-amber-50 border-2 border-amber-800 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] font-headline font-black uppercase text-amber-900 flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5 text-amber-700" /> Recommended Pitch Adjustment
            </span>
            <p className="text-xs font-semibold text-amber-950 leading-snug">
              {suggestedTweak}
            </p>
          </div>
        )}

        {/* Objections Raised */}
        {objectionsRaised.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-headline font-black uppercase text-rose-800 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Active Objections
            </span>
            <div className="flex flex-wrap gap-1">
              {objectionsRaised.map((obj, idx) => (
                <span key={idx} className="text-[10px] font-semibold bg-rose-100 text-rose-900 border border-rose-800 px-2 py-0.5 rounded-lg">
                  ⚠️ {obj}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Resonance Points */}
        {resonancePoints.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-headline font-black uppercase text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Resonance Points
            </span>
            <ul className="space-y-1">
              {resonancePoints.map((item, idx) => (
                <li key={idx} className="text-[11px] font-semibold text-emerald-950 bg-emerald-50 border border-emerald-800 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

    </div>
  );
};
