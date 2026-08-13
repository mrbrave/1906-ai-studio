import React, { useState } from 'react';
import { LLMConfig, LLMProvider } from '../types/persona';
import { X, Key, Cpu, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface SettingsModalProps {
  config: LLMConfig;
  onSave: (newConfig: LLMConfig) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  onSave,
  onClose
}) => {
  const [defaultProvider, setDefaultProvider] = useState<LLMProvider>(config.defaultProvider);
  const [geminiApiKey, setGeminiApiKey] = useState(config.geminiApiKey);
  const [openaiApiKey, setOpenaiApiKey] = useState(config.openaiApiKey);
  const [geminiModel, setGeminiModel] = useState(config.geminiModel || 'gemini-2.0-flash');
  const [openaiModel, setOpenaiModel] = useState(config.openaiModel || 'gpt-4o-mini');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      openaiApiKey,
      geminiApiKey,
      defaultProvider,
      openaiModel,
      geminiModel
    });
    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-brand-text/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-brand-bg-light marker-stroke agency-shadow card-irregular-2 p-6 space-y-6 text-brand-text">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-brand-text/20 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-brand-primary text-brand-bg marker-stroke flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-black text-lg text-brand-text">1906 Engine & LLM Settings</h3>
              <p className="text-xs font-semibold text-brand-text-light">Configure Google Gemini & OpenAI credentials</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-brand-text-light hover:text-brand-text rounded-xl hover:bg-brand-pale transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Note */}
        <div className="bg-brand-pale border-2 border-brand-primary p-3 rounded-2xl flex items-start gap-2.5 text-xs text-brand-dark">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-brand-primary" />
          <div>
            <strong className="block font-headline font-black">100% Local Privacy Guarantee</strong>
            API Keys are stored securely in browser `localStorage` and dispatched directly to Google & OpenAI endpoints.
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          
          {/* Active Provider Selector */}
          <div>
            <label className="block font-headline font-bold text-brand-text mb-1.5">
              Primary Cognitive Model Engine
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDefaultProvider('demo')}
                className={`p-3 rounded-xl border-2 font-headline font-extrabold text-xs transition-all ${
                  defaultProvider === 'demo'
                    ? 'bg-brand-primary text-brand-bg border-brand-text marker-stroke shadow-sm'
                    : 'bg-brand-bg text-brand-text-light border-brand-text/30 hover:border-brand-text'
                }`}
              >
                Offline Demo Engine
              </button>

              <button
                type="button"
                onClick={() => setDefaultProvider('gemini')}
                className={`p-3 rounded-xl border-2 font-headline font-extrabold text-xs transition-all ${
                  defaultProvider === 'gemini'
                    ? 'bg-brand-primary text-brand-bg border-brand-text marker-stroke shadow-sm'
                    : 'bg-brand-bg text-brand-text-light border-brand-text/30 hover:border-brand-text'
                }`}
              >
                Google Gemini
              </button>

              <button
                type="button"
                onClick={() => setDefaultProvider('openai')}
                className={`p-3 rounded-xl border-2 font-headline font-extrabold text-xs transition-all ${
                  defaultProvider === 'openai'
                    ? 'bg-brand-primary text-brand-bg border-brand-text marker-stroke shadow-sm'
                    : 'bg-brand-bg text-brand-text-light border-brand-text/30 hover:border-brand-text'
                }`}
              >
                OpenAI GPT
              </button>
            </div>
          </div>

          {/* Google Gemini Settings */}
          <div className="p-4 bg-brand-bg rounded-2xl border-2 border-brand-text space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-headline font-bold text-brand-text flex items-center gap-1.5">
                <Key className="w-4 h-4 text-brand-primary" /> Google Gemini API Key
              </span>
              <select
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="bg-brand-bg-light text-brand-text text-[11px] font-headline font-bold px-2 py-1 rounded-lg border border-brand-text"
              >
                <option value="gemini-2.0-flash">gemini-2.0-flash (Recommended)</option>
                <option value="gemini-1.5-pro">gemini-1.5-pro (Reasoning)</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash</option>
              </select>
            </div>

            <input
              type="password"
              placeholder="AIzaSy..."
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="w-full bg-brand-bg-light text-brand-text placeholder-brand-text-light/60 p-2.5 rounded-xl border-2 border-brand-text focus:border-brand-primary focus:outline-none font-mono"
            />
          </div>

          {/* OpenAI Settings */}
          <div className="p-4 bg-brand-bg rounded-2xl border-2 border-brand-text space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-headline font-bold text-brand-text flex items-center gap-1.5">
                <Key className="w-4 h-4 text-brand-secondary" /> OpenAI API Key
              </span>
              <select
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                className="bg-brand-bg-light text-brand-text text-[11px] font-headline font-bold px-2 py-1 rounded-lg border border-brand-text"
              >
                <option value="gpt-4o-mini">gpt-4o-mini (Recommended)</option>
                <option value="gpt-4o">gpt-4o (Flagship)</option>
                <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
              </select>
            </div>

            <input
              type="password"
              placeholder="sk-proj-..."
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              className="w-full bg-brand-bg-light text-brand-text placeholder-brand-text-light/60 p-2.5 rounded-xl border-2 border-brand-text focus:border-brand-primary focus:outline-none font-mono"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-between">
            {savedSuccess ? (
              <span className="text-emerald-700 font-headline font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Settings Saved!
              </span>
            ) : (
              <span className="text-brand-text-light font-medium text-[11px]">Ready to save</span>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-brand-bg text-brand-text font-headline font-bold hover:bg-brand-pale border-2 border-brand-text transition-all"
              >
                Close
              </button>

              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-brand-primary hover:bg-brand-secondary text-brand-bg font-headline font-black marker-stroke agency-shadow-sm transition-all cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
