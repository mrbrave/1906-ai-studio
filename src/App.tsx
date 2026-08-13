import React, { useState } from 'react';
import { BuyerPersona, LLMConfig, CampaignReport } from './types/persona';
import { 
  getLLMConfig, 
  saveLLMConfig, 
  getSavedPersonas, 
  saveCustomPersona, 
  deleteCustomPersona,
  getCampaignReports
} from './services/storageService';
import { Navbar } from './components/Navbar';
import { PersonaLibrary } from './components/PersonaLibrary';
import { ChatInterface } from './components/ChatInterface';
import { BroadcastStudio } from './components/BroadcastStudio';
import { CampaignReportsView } from './components/CampaignReportsView';
import { PersonaEditorModal } from './components/PersonaEditorModal';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'library' | 'chat' | 'broadcast' | 'analytics'>('library');
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(getLLMConfig());
  const [personas, setPersonas] = useState<BuyerPersona[]>(getSavedPersonas());
  const [selectedPersona, setSelectedPersona] = useState<BuyerPersona>(personas[0]);
  const [reports, setReports] = useState<CampaignReport[]>(getCampaignReports());

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPersonaEditorModal, setShowPersonaEditorModal] = useState(false);
  const [personaToEdit, setPersonaToEdit] = useState<BuyerPersona | null>(null);

  const handleSaveCustomPersona = (p: BuyerPersona) => {
    const updated = saveCustomPersona(p);
    setPersonas(updated);
    setSelectedPersona(p);
    setShowPersonaEditorModal(false);
    setPersonaToEdit(null);
  };

  const handleDeleteCustomPersona = (id: string) => {
    const updated = deleteCustomPersona(id);
    setPersonas(updated);
    if (selectedPersona.id === id) {
      setSelectedPersona(updated[0]);
    }
  };

  const handleSaveLLMConfig = (newConfig: LLMConfig) => {
    saveLLMConfig(newConfig);
    setLlmConfig(newConfig);
  };

  const handleSelectChat = (p: BuyerPersona) => {
    setSelectedPersona(p);
    setActiveTab('chat');
  };

  const handleEditPersona = (p: BuyerPersona) => {
    setPersonaToEdit(p);
    setShowPersonaEditorModal(true);
  };

  const handleOpenCreatePersona = () => {
    setPersonaToEdit(null);
    setShowPersonaEditorModal(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg text-brand-text font-body selection:bg-brand-primary selection:text-brand-bg">
      
      {/* Top Architectural Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedPersona={selectedPersona}
        personas={personas}
        onSelectPersona={setSelectedPersona}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenCreatePersona={handleOpenCreatePersona}
        llmConfig={llmConfig}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        
        {activeTab === 'library' && (
          <PersonaLibrary
            personas={personas}
            onSelectChat={handleSelectChat}
            onEditPersona={handleEditPersona}
            onDeletePersona={handleDeleteCustomPersona}
            onCreatePersona={handleOpenCreatePersona}
            onStartBroadcast={() => setActiveTab('broadcast')}
          />
        )}

        {activeTab === 'chat' && (
          <ChatInterface
            persona={selectedPersona}
            personas={personas}
            onSelectPersona={setSelectedPersona}
            llmConfig={llmConfig}
          />
        )}

        {activeTab === 'broadcast' && (
          <BroadcastStudio
            personas={personas}
            llmConfig={llmConfig}
            onSaveReport={(newReport) => setReports(prev => [newReport, ...prev])}
          />
        )}

        {activeTab === 'analytics' && (
          <CampaignReportsView
            reports={reports}
          />
        )}

      </main>

      {/* Architectural Footer */}
      <footer className="border-t-2 border-brand-text/20 bg-brand-bg-light py-5 px-4 text-center text-xs font-semibold text-brand-text-light">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-headline font-bold text-brand-text">1906.ai • Decision-Intelligence Studio</span>
          <span className="text-[11px] font-medium text-brand-text-light">Synthetic Archetype Testing Engine • Powered by Gemini & OpenAI</span>
        </div>
      </footer>

      {/* Settings Modal */}
      {showSettingsModal && (
        <SettingsModal
          config={llmConfig}
          onSave={handleSaveLLMConfig}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Persona Editor Modal */}
      {showPersonaEditorModal && (
        <PersonaEditorModal
          personaToEdit={personaToEdit}
          onSave={handleSaveCustomPersona}
          onClose={() => {
            setShowPersonaEditorModal(false);
            setPersonaToEdit(null);
          }}
          llmConfig={llmConfig}
        />
      )}

    </div>
  );
}
