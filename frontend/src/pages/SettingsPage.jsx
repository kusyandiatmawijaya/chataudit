import React, { useState } from 'react';
import { Settings as SettingsIcon, Building2, Sparkles } from 'lucide-react';
import { CompanyProfileTab } from '../components/Settings/CompanyProfileTab';
import { AIOrchestrationTab } from '../components/Settings/AIOrchestrationTab';
import { ToolsTab } from '../components/Settings/ToolsTab';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company');

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-50/50">
      <header className="bg-white border-b border-slate-200 py-5 shrink-0">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-2">
                <SettingsIcon className="w-6 h-6 text-slate-700" />
                Pengaturan Sistem
              </h1>
              <p className="text-sm text-slate-500 mt-1">Konfigurasi umum perusahaan dan pengaturan tingkat lanjut AI Orchestration.</p>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-slate-100 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
            <button
              onClick={() => setActiveTab('company')}
              className={`flex-1 sm:flex-initial flex items-center justify-center whitespace-nowrap gap-2 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'company'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Profil Perusahaan
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 sm:flex-initial flex items-center justify-center whitespace-nowrap gap-2 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'ai'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              AI & Orchestration
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={`flex-1 sm:flex-initial flex items-center justify-center whitespace-nowrap gap-2 px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'tools'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              Tools
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto py-6 sm:py-8">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 xl:px-12">
          {activeTab === 'company' && <CompanyProfileTab />}
          {activeTab === 'ai' && <AIOrchestrationTab />}
          {activeTab === 'tools' && <ToolsTab />}
        </div>
      </main>
    </div>
  );
}
