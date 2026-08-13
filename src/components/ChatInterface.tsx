import React, { useState, useRef, useEffect } from 'react';
import { BuyerPersona, ChatMessage, LLMConfig } from '../types/persona';
import { generatePersonaResponse } from '../services/llmService';
import { MetricsGauge } from './MetricsGauge';
import { 
  Send, 
  RotateCcw, 
  Download, 
  Sparkles, 
  Compass,
  MessageCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ChatInterfaceProps {
  persona: BuyerPersona;
  personas: BuyerPersona[];
  onSelectPersona: (p: BuyerPersona) => void;
  llmConfig: LLMConfig;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  persona,
  personas,
  onSelectPersona,
  llmConfig
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'persona',
      text: `Greetings. I am ${persona.name}, ${persona.role} in ${persona.industry}. Initiate a strategic dialogue by submitting your positioning thesis or narrative.`,
      timestamp: Date.now(),
      intentScore: 50,
      sentiment: 'neutral',
      keyTakeaway: 'Ready to evaluate marketing pitch.',
      suggestedTweak: 'Introduce your core value proposition directly.'
    }
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [latestMetrics, setLatestMetrics] = useState<{
    intentScore: number;
    sentiment: 'enthusiastic' | 'positive' | 'neutral' | 'skeptical' | 'resistant';
    objectionsRaised: string[];
    resonancePoints: string[];
    keyTakeaway: string;
    suggestedTweak: string;
  }>({
    intentScore: 50,
    sentiment: 'neutral',
    objectionsRaised: persona.commonObjections.slice(0, 2),
    resonancePoints: [`Initial context set for ${persona.name}`],
    keyTakeaway: 'Awaiting strategic input.',
    suggestedTweak: `Focus on ${persona.buyingTriggers[0] || 'clear ROI'}.`
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Reset chat when persona changes
  useEffect(() => {
    setMessages([
      {
        id: `init-${persona.id}`,
        sender: 'persona',
        text: `Active dialogue channel initialized with ${persona.name} (${persona.role}). What strategic hypothesis shall we test?`,
        timestamp: Date.now(),
        intentScore: 50,
        sentiment: 'neutral',
        keyTakeaway: 'Ready to evaluate strategic pitch.',
        suggestedTweak: `Target ${persona.name}'s key goal: ${persona.goals[0] || 'practical value'}.`
      }
    ]);
    setLatestMetrics({
      intentScore: 50,
      sentiment: 'neutral',
      objectionsRaised: persona.commonObjections.slice(0, 2),
      resonancePoints: [`Cognitive model switched to ${persona.name}`],
      keyTakeaway: 'Awaiting marketer input.',
      suggestedTweak: `Focus on ${persona.buyingTriggers[0] || 'clear value proposition'}.`
    });
  }, [persona.id]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'marketer',
      text: textToSend.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customText) setInput('');
    setLoading(true);

    try {
      const payload = await generatePersonaResponse(persona, textToSend, messages, llmConfig);

      const personaMsg: ChatMessage = {
        id: `persona-${Date.now()}`,
        sender: 'persona',
        text: payload.replyText,
        timestamp: Date.now(),
        intentScore: payload.intentScore,
        sentiment: payload.sentiment,
        objectionsRaised: payload.objectionsRaised,
        keyTakeaway: payload.keyTakeaway,
        suggestedTweak: payload.suggestedTweak
      };

      setMessages(prev => [...prev, personaMsg]);

      setLatestMetrics({
        intentScore: payload.intentScore,
        sentiment: payload.sentiment,
        objectionsRaised: payload.objectionsRaised,
        resonancePoints: payload.resonancePoints,
        keyTakeaway: payload.keyTakeaway,
        suggestedTweak: payload.suggestedTweak
      });

      if (payload.intentScore >= 80) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    } catch (err) {
      console.error('Error generating persona response:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const exportChatLog = () => {
    const transcript = messages
      .map(m => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.sender.toUpperCase()} (${m.sender === 'persona' ? persona.name : 'Marketer'}): ${m.text}`)
      .join('\n\n');

    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `1906ai_dialogue_${persona.id}_${Date.now()}.txt`;
    a.click();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px]">
      
      {/* Left Strategic Dialogue Main Window (8 cols) */}
      <div className="lg:col-span-8 flex flex-col bg-brand-bg-light marker-stroke agency-shadow rounded-3xl overflow-hidden">
        
        {/* Chat Header */}
        <div className="bg-brand-bg p-4 border-b-2 border-brand-text flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-brand-pale marker-stroke flex items-center justify-center text-2xl">
                {persona.avatar}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-brand-text" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline font-black text-base text-brand-text">{persona.name}</h3>
                <span className="text-[10px] font-headline font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-pale text-brand-dark border border-brand-primary">
                  {persona.role}
                </span>
              </div>
              <p className="text-xs font-semibold text-brand-text-light">{persona.industry} • {persona.tone}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMessages([{
                  id: `init-${Date.now()}`,
                  sender: 'persona',
                  text: `Strategic Dialogue channel reset. What hypothesis shall we test now?`,
                  timestamp: Date.now(),
                  intentScore: 50,
                  sentiment: 'neutral'
                }]);
              }}
              className="p-2 text-brand-text-light hover:text-brand-text hover:bg-brand-pale rounded-xl border border-brand-text/30 transition-all"
              title="Reset Strategic Dialogue"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={exportChatLog}
              className="p-2 text-brand-text-light hover:text-brand-text hover:bg-brand-pale rounded-xl border border-brand-text/30 transition-all"
              title="Export Telemetry Log"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-h-[480px]">
          {messages.map((msg) => {
            const isPersona = msg.sender === 'persona';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isPersona ? 'justify-start' : 'justify-end'}`}
              >
                {isPersona && (
                  <div className="w-9 h-9 rounded-2xl bg-brand-pale marker-stroke flex items-center justify-center text-lg shrink-0 mt-1">
                    {persona.avatar}
                  </div>
                )}

                <div className={`max-w-[85%] sm:max-w-[75%] space-y-1.5`}>
                  {/* Asymmetrical Architectural Chat Bubbles */}
                  <div
                    className={`p-4 text-xs sm:text-sm font-medium leading-relaxed marker-stroke agency-shadow-sm ${
                      isPersona
                        ? 'bg-brand-bg-light text-brand-text rounded-[2rem_2rem_2rem_0.5rem]'
                        : 'bg-brand-primary text-brand-bg rounded-[2rem_2rem_0.5rem_2rem]'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Intent score indicator on persona message */}
                  {isPersona && typeof msg.intentScore === 'number' && (
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-brand-text-light pl-2">
                      <span>Intent Alignment:</span>
                      <span className={`font-headline font-black ${
                        msg.intentScore >= 75 ? 'text-emerald-700' : msg.intentScore >= 50 ? 'text-brand-primary' : 'text-rose-700'
                      }`}>
                        {msg.intentScore}%
                      </span>
                      {msg.keyTakeaway && (
                        <span className="truncate max-w-[250px] text-brand-text-light/80">
                          • {msg.keyTakeaway}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {!isPersona && (
                  <div className="w-9 h-9 rounded-2xl bg-brand-primary text-brand-bg marker-stroke flex items-center justify-center text-xs font-headline font-black shrink-0 mt-1">
                    YOU
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading State */}
          {loading && (
            <div className="flex gap-3 items-center text-brand-text-light text-xs font-medium">
              <div className="w-9 h-9 rounded-2xl bg-brand-pale marker-stroke flex items-center justify-center text-lg animate-pulse">
                {persona.avatar}
              </div>
              <div className="bg-brand-bg p-3 rounded-2xl border-2 border-brand-text flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-primary animate-ping" />
                <span>{persona.name} is evaluating cognitive response...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Pitch Templates */}
        <div className="p-3 bg-brand-bg border-t-2 border-brand-text flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-headline font-extrabold uppercase text-brand-text-light whitespace-nowrap pl-1">
            Shortcuts:
          </span>
          <button
            onClick={() => handleQuickPrompt(`Positioning: "Validate executive strategic hypotheses in minutes with zero setup friction."`)}
            className="text-[11px] font-headline font-bold bg-brand-bg-light hover:bg-brand-pale text-brand-text border border-brand-text/40 rounded-lg px-2.5 py-1 whitespace-nowrap transition-colors"
          >
            🚀 Executive Narrative
          </button>
          <button
            onClick={() => handleQuickPrompt(`Value Prop: "We guarantee a 25% reduction in CAC with zero upfront integration overhead."`)}
            className="text-[11px] font-headline font-bold bg-brand-bg-light hover:bg-brand-pale text-brand-text border border-brand-text/40 rounded-lg px-2.5 py-1 whitespace-nowrap transition-colors"
          >
            💰 Value Proposition
          </button>
          <button
            onClick={() => handleQuickPrompt(`Friction Probe: "What is your primary constraint when adopting new enterprise software?"`)}
            className="text-[11px] font-headline font-bold bg-brand-bg-light hover:bg-brand-pale text-brand-text border border-brand-text/40 rounded-lg px-2.5 py-1 whitespace-nowrap transition-colors"
          >
            ❓ Probe Objections
          </button>
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3.5 bg-brand-bg-light border-t-2 border-brand-text flex items-center gap-2"
        >
          <input
            type="text"
            placeholder={`Enter pitch thesis for ${persona.name}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-brand-bg text-brand-text placeholder-brand-text-light text-xs sm:text-sm font-medium rounded-xl px-4 py-3 border-2 border-brand-text focus:outline-none focus:border-brand-primary transition-colors disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-5 py-3 rounded-xl bg-brand-primary hover:bg-brand-secondary text-brand-bg font-headline font-black text-xs flex items-center gap-2 marker-stroke agency-shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <span>Transmit</span>
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>

      {/* Right Metrics Panel (4 cols) */}
      <div className="lg:col-span-4 space-y-4">
        
        {/* Persona Switching Quick Bar */}
        <div className="bg-brand-bg-light p-3 rounded-2xl marker-stroke flex items-center justify-between gap-2">
          <span className="text-xs font-headline font-bold text-brand-text">Active Model:</span>
          <select
            value={persona.id}
            onChange={(e) => {
              const target = personas.find(p => p.id === e.target.value);
              if (target) onSelectPersona(target);
            }}
            className="bg-brand-bg text-brand-primary text-xs font-headline font-bold px-3 py-1.5 rounded-xl border border-brand-text focus:outline-none cursor-pointer"
          >
            {personas.map(p => (
              <option key={p.id} value={p.id}>
                {p.avatar} {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Real-time Metrics Gauge Component */}
        <MetricsGauge
          persona={persona}
          intentScore={latestMetrics.intentScore}
          sentiment={latestMetrics.sentiment}
          objectionsRaised={latestMetrics.objectionsRaised}
          resonancePoints={latestMetrics.resonancePoints}
          keyTakeaway={latestMetrics.keyTakeaway}
          suggestedTweak={latestMetrics.suggestedTweak}
        />

        {/* Persona Background Quick Ref */}
        <div className="bg-brand-bg-light marker-stroke rounded-3xl p-4 space-y-2">
          <h4 className="font-headline font-black text-xs uppercase text-brand-text tracking-wider">
            Cognitive DNA Specifications
          </h4>
          <div className="text-xs font-medium text-brand-text-light space-y-1">
            <p><strong className="text-brand-text">Income Band:</strong> {persona.incomeRange}</p>
            <p><strong className="text-brand-text">Decision Velocity:</strong> {persona.decisionSpeed}</p>
            <p><strong className="text-brand-text">Communication Style:</strong> {persona.tone}</p>
          </div>
        </div>

      </div>

    </div>
  );
};
