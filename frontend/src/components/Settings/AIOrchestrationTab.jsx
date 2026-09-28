import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { Sparkles, Loader2, Save, AlertTriangle, Cpu, Layers, GitMerge, FileSearch, VenetianMask, ScanLine, Settings2 } from 'lucide-react';
import { ManageModelsModal } from './ManageModelsModal';

export function AIOrchestrationTab() {
  const [orchestrationTier, setOrchestrationTier] = useState('FREE');
  const [defaultModel, setDefaultModel] = useState('');
  const [availableModels, setAvailableModels] = useState([]);
  
  // Dynamic Role Models
  const [roleModels, setRoleModels] = useState({
    orchestration_model_free_router: '',
    orchestration_model_free_analytical: '',
    orchestration_model_free_persona: '',
    orchestration_model_free_vision: '',
    orchestration_model_paid_router: '',
    orchestration_model_paid_analytical: '',
    orchestration_model_paid_persona: '',
    orchestration_model_paid_vision: '',
  });

  const [orchestratorDefaults, setOrchestratorDefaults] = useState({ FREE: {}, PAID: {} });
  const [openRouterCredits, setOpenRouterCredits] = useState(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchModels();
    fetchDefaults();
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    setCreditsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/settings/openrouter/credits`);
      if (res.data?.data) {
        setOpenRouterCredits(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch OpenRouter credits', err);
    } finally {
      setCreditsLoading(false);
    }
  };

  const fetchDefaults = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/settings/orchestrator/defaults`);
      if (res.data?.defaults) {
        setOrchestratorDefaults(res.data.defaults);
      }
    } catch (err) {
      console.error('Failed to fetch defaults', err);
    }
  };

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const keys = [
        'orchestration_tier', 'default_ai_model',
        'orchestration_model_free_router', 'orchestration_model_free_analytical',
        'orchestration_model_free_persona', 'orchestration_model_free_vision',
        'orchestration_model_paid_router', 'orchestration_model_paid_analytical',
        'orchestration_model_paid_persona', 'orchestration_model_paid_vision'
      ].join(',');
      
      const res = await axios.get(`${API_URL}/api/settings?keys=${keys}`);
      
      setOrchestrationTier(res.data.orchestration_tier || 'FREE');
      setDefaultModel(res.data.default_ai_model || '');
      
      setRoleModels({
        orchestration_model_free_router: res.data.orchestration_model_free_router || '',
        orchestration_model_free_analytical: res.data.orchestration_model_free_analytical || '',
        orchestration_model_free_persona: res.data.orchestration_model_free_persona || '',
        orchestration_model_free_vision: res.data.orchestration_model_free_vision || '',
        orchestration_model_paid_router: res.data.orchestration_model_paid_router || '',
        orchestration_model_paid_analytical: res.data.orchestration_model_paid_analytical || '',
        orchestration_model_paid_persona: res.data.orchestration_model_paid_persona || '',
        orchestration_model_paid_vision: res.data.orchestration_model_paid_vision || '',
      });
    } catch (err) {
      console.error('Failed to fetch AI settings', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/models`);
      const modelsArray = res.data?.data || res.data || [];
      if (Array.isArray(modelsArray)) {
        setAvailableModels(modelsArray.filter(m => m.isActive));
      }
    } catch (err) {
      console.error('Failed to fetch models', err);
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await axios.post(`${API_URL}/api/settings/batch`, {
        settings: {
          orchestration_tier: orchestrationTier,
          default_ai_model: defaultModel,
          ...roleModels
        }
      });
      alert('Pengaturan AI berhasil disimpan!');
    } catch (err) {
      console.error('Failed to save AI settings', err);
      alert('Gagal menyimpan pengaturan AI');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = (key, value) => {
    setRoleModels(prev => ({ ...prev, [key]: value }));
  };

  const renderModelOptions = (tier, role) => {
    const defaultModel = orchestratorDefaults[tier]?.[role] || 'Bawaan';
    return (
      <>
        <option value="">-- Gunakan Bawaan (Default: {defaultModel}) --</option>
        {availableModels.map(m => (
          <option key={m.modelId} value={m.modelId}>
            {m.name} {m.isFree ? '(Gratis)' : '(Berbayar)'}
          </option>
        ))}
      </>
    );
  };

  const handleModalClose = () => {
    setIsManageModalOpen(false);
    fetchModels(); // Refresh available models when modal closes
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">AI & Orchestration</h2>
            <p className="text-sm text-slate-500 mt-0.5">Atur tingkatan kecerdasan buatan (Best-of-Breed Models) untuk aplikasi Anda.</p>
          </div>
        </div>

        {/* Credit Display */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">OpenRouter Balance</span>
            {creditsLoading ? (
              <span className="text-sm font-semibold text-slate-700 animate-pulse">Memuat...</span>
            ) : openRouterCredits ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-emerald-600">
                  ${(openRouterCredits.total_credits - openRouterCredits.total_usage).toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                  Limit: ${openRouterCredits.total_credits.toFixed(0)}
                </span>
              </div>
            ) : (
              <span className="text-sm font-semibold text-rose-500">Gagal memuat</span>
            )}
          </div>
          <button onClick={fetchCredits} disabled={creditsLoading} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors disabled:opacity-50">
            <svg className={`w-4 h-4 ${creditsLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
        </div>
      ) : (
        <form onSubmit={saveSettings} className="space-y-8 max-w-4xl">
          
          {/* Orchestration Tier */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              Tingkat Orkestrasi (Orchestration Tier)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* FREE Tier Card */}
              <div 
                onClick={() => setOrchestrationTier('FREE')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  orchestrationTier === 'FREE' 
                    ? 'border-violet-500 bg-violet-50/50 shadow-sm' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-full">FREE</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    orchestrationTier === 'FREE' ? 'border-violet-500' : 'border-slate-300'
                  }`}>
                    {orchestrationTier === 'FREE' && <div className="w-2.5 h-2.5 bg-violet-500 rounded-full" />}
                  </div>
                </div>
                <h4 className="font-bold text-slate-900 mb-1">Standard / Hemat</h4>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Menggunakan kombinasi model gratis namun mumpuni. Cocok untuk penggunaan harian dengan biaya kredit mendekati nol.
                </p>
              </div>

              {/* PAID Tier Card */}
              <div 
                onClick={() => setOrchestrationTier('PAID')}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  orchestrationTier === 'PAID' 
                    ? 'border-violet-500 bg-violet-50/50 shadow-sm' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="px-3 py-1 bg-amber-200 text-amber-800 text-xs font-bold rounded-full">PREMIUM</span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    orchestrationTier === 'PAID' ? 'border-violet-500' : 'border-slate-300'
                  }`}>
                    {orchestrationTier === 'PAID' && <div className="w-2.5 h-2.5 bg-violet-500 rounded-full" />}
                  </div>
                </div>
                <h4 className="font-bold text-slate-900 mb-1">Advanced / Flagship</h4>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Menggunakan kombinasi model berbayar tertinggi untuk akurasi maksimal, logika kompleks, dan empati.
                </p>
              </div>
            </div>
          </div>

          {/* Role Models Configuration */}
          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-slate-400" />
                  Konfigurasi Peran AI (Role Assignment)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Tentukan model spesifik yang akan bekerja berdasarkan tugas (peran).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(true)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors flex items-center gap-2 border border-slate-200"
              >
                <Settings2 className="w-4 h-4" />
                Kelola Model AI
              </button>
            </div>

            <div className="space-y-4">
              {/* ROUTER */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <GitMerge className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="font-semibold text-sm text-slate-800">1. ROUTER (Triage & Klasifikasi)</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1 block">Free Mode Model</label>
                    <select 
                      value={roleModels.orchestration_model_free_router}
                      onChange={e => handleRoleChange('orchestration_model_free_router', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
                    >
                      {renderModelOptions('FREE', 'ROUTER')}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-amber-600 tracking-wider mb-1 block">Premium Mode Model</label>
                    <select 
                      value={roleModels.orchestration_model_paid_router}
                      onChange={e => handleRoleChange('orchestration_model_paid_router', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    >
                      {renderModelOptions('PAID', 'ROUTER')}
                    </select>
                  </div>
                </div>
              </div>

              {/* ANALYTICAL */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <FileSearch className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="font-semibold text-sm text-slate-800">2. ANALYTICAL (Logika & Query SQL)</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1 block">Free Mode Model</label>
                    <select 
                      value={roleModels.orchestration_model_free_analytical}
                      onChange={e => handleRoleChange('orchestration_model_free_analytical', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
                    >
                      {renderModelOptions('FREE', 'ANALYTICAL')}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-amber-600 tracking-wider mb-1 block">Premium Mode Model</label>
                    <select 
                      value={roleModels.orchestration_model_paid_analytical}
                      onChange={e => handleRoleChange('orchestration_model_paid_analytical', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    >
                      {renderModelOptions('PAID', 'ANALYTICAL')}
                    </select>
                  </div>
                </div>
              </div>

              {/* PERSONA */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center">
                    <VenetianMask className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="font-semibold text-sm text-slate-800">3. PERSONA (Balasan Natural)</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1 block">Free Mode Model</label>
                    <select 
                      value={roleModels.orchestration_model_free_persona}
                      onChange={e => handleRoleChange('orchestration_model_free_persona', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
                    >
                      {renderModelOptions('FREE', 'PERSONA')}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-amber-600 tracking-wider mb-1 block">Premium Mode Model</label>
                    <select 
                      value={roleModels.orchestration_model_paid_persona}
                      onChange={e => handleRoleChange('orchestration_model_paid_persona', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    >
                      {renderModelOptions('PAID', 'PERSONA')}
                    </select>
                  </div>
                </div>
              </div>

              {/* VISION */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                    <ScanLine className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="font-semibold text-sm text-slate-800">4. VISION (Ekstraksi Gambar)</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1 block">Free Mode Model</label>
                    <select 
                      value={roleModels.orchestration_model_free_vision}
                      onChange={e => handleRoleChange('orchestration_model_free_vision', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
                    >
                      {renderModelOptions('FREE', 'VISION')}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-amber-600 tracking-wider mb-1 block">Premium Mode Model</label>
                    <select 
                      value={roleModels.orchestration_model_paid_vision}
                      onChange={e => handleRoleChange('orchestration_model_paid_vision', e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    >
                      {renderModelOptions('PAID', 'VISION')}
                    </select>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-slate-400" />
              Fallback Model (Opsional)
            </h3>
            
            <div className="space-y-1.5">
              <label className="text-sm text-slate-700">Pilih model default jika semua orkestrasi gagal / dinonaktifkan:</label>
              <select 
                value={defaultModel} 
                onChange={e => setDefaultModel(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all"
              >
                <option value="">-- Gunakan Bawaan (Default) --</option>
                {availableModels.map(m => (
                  <option key={m.modelId} value={m.modelId}>
                    {m.name} {m.isFree ? '(Gratis)' : '(Berbayar)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-violet-200 hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan AI'}
            </button>
          </div>
        </form>
      )}

      <ManageModelsModal 
        isOpen={isManageModalOpen} 
        onClose={handleModalClose} 
      />
    </div>
  );
}
