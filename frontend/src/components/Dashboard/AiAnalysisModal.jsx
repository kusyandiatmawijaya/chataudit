import React from 'react';
import { Bot, ChevronDown, Check, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export function AiAnalysisModal({
  isOpen,
  onClose,
  chats,
  activeChatId,
  aiPrompt,
  setAiPrompt,
  aiDateFrom,
  setAiDateFrom,
  aiDateTo,
  setAiDateTo,
  aiIncludeMedia,
  setAiIncludeMedia,
  aiSelectedModel,
  setAiSelectedModel,
  aiModelsList,
  saveDefaultAiModel,
  aiSavingDefault,
  aiSavedMsg,
  isAiPeriodCollapsibleOpen,
  setIsAiPeriodCollapsibleOpen,
  isAiMediaCollapsibleOpen,
  setIsAiMediaCollapsibleOpen,
  isAiModelCollapsibleOpen,
  setIsAiModelCollapsibleOpen,
  isAnalyzing,
  handleAiAnalysis,
  aiError,
  aiResult,
  aiMsgCount,
  isCopied,
  handleCopyResult,
  todayStr
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Chat Analysis" maxWidth="max-w-2xl" icon={Bot}>
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <p className="text-sm text-slate-600">
            Target Chat: <span className="font-semibold text-slate-900">{chats.find(c => c.id === activeChatId)?.name || activeChatId}</span>
          </p>
        </div>

        <form onSubmit={handleAiAnalysis} className="flex flex-col gap-4">
          {/* Custom Prompt */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-sm font-medium text-slate-700">Custom Prompt</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setAiPrompt('Ringkas percakapan ini')} className="px-2.5 py-1 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-colors border border-indigo-100">Ringkas percakapan ini</button>
              <button type="button" onClick={() => setAiPrompt('Cari komplain pelanggan')} className="px-2.5 py-1 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-md transition-colors border border-amber-100">Cari komplain pelanggan</button>
              <button type="button" onClick={() => setAiPrompt('Cek potensi toko diblokir')} className="px-2.5 py-1 text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md transition-colors border border-rose-100">Cek potensi toko diblokir</button>
            </div>
          </div>
          <div className="relative">
            <textarea 
              autoFocus
              required
              placeholder="e.g. Buat ringkasan keluhan dari chat ini"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all min-h-[100px] resize-y pr-10"
            />
          </div>

          {/* Periode Analisa */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl flex flex-col overflow-hidden">
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => setIsAiPeriodCollapsibleOpen(!isAiPeriodCollapsibleOpen)}
            >
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                  <span>📅</span> Periode Analisa
                </p>
                {!isAiPeriodCollapsibleOpen && (
                  <span className="text-xs font-medium bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md truncate max-w-[150px] sm:max-w-xs ml-2">
                    {aiDateFrom ? aiDateFrom : 'Semua'} {aiDateTo ? ` - ${aiDateTo}` : (aiDateFrom ? ' - Hari ini' : '')}
                  </span>
                )}
              </div>
              <button type="button" className="p-1 text-slate-400 hover:bg-slate-200 rounded-md transition-colors">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isAiPeriodCollapsibleOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
            
            {isAiPeriodCollapsibleOpen && (
              <div className="p-4 pt-0 border-t border-slate-100 mt-1 flex flex-col gap-3 animate-fade-in bg-white">
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium">Dari Tanggal</label>
                    <input
                      type="date"
                      value={aiDateFrom}
                      onChange={(e) => { setAiDateFrom(e.target.value); setIsAiPeriodCollapsibleOpen(false); }}
                      className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium">Sampai Tanggal <span className="text-slate-400">(kosong = hari ini)</span></label>
                    <input
                      type="date"
                      value={aiDateTo}
                      onChange={(e) => { setAiDateTo(e.target.value); setIsAiPeriodCollapsibleOpen(false); }}
                      className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setAiDateFrom(''); setAiDateTo(''); setIsAiPeriodCollapsibleOpen(false); }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 self-start transition-colors"
                >
                  Hapus filter tanggal (analisa semua pesan)
                </button>
              </div>
            )}
          </div>

          {/* Include Media Toggle */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl flex flex-col overflow-hidden">
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => setIsAiMediaCollapsibleOpen(!isAiMediaCollapsibleOpen)}
            >
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                  <span>📎</span> Konten
                </p>
                {!isAiMediaCollapsibleOpen && (
                  <span className="text-xs font-medium bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md truncate max-w-[150px] sm:max-w-xs ml-2">
                    {aiIncludeMedia ? 'Teks + Media' : 'Teks Saja'}
                  </span>
                )}
              </div>
              <button type="button" className="p-1 text-slate-400 hover:bg-slate-200 rounded-md transition-colors">
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isAiMediaCollapsibleOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
            
            {isAiMediaCollapsibleOpen && (
              <div className="p-4 pt-0 border-t border-slate-100 mt-1 flex flex-col gap-3 animate-fade-in bg-white">
                <label className="flex items-center gap-3 cursor-pointer select-none group pt-2">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={aiIncludeMedia}
                      onChange={(e) => { setAiIncludeMedia(e.target.checked); setIsAiMediaCollapsibleOpen(false); }}
                    />
                    <div className={`w-10 h-6 rounded-full transition-colors duration-200 ${
                      aiIncludeMedia ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                        aiIncludeMedia ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Sertakan gambar &amp; file PDF</p>
                    <p className="text-xs text-slate-500">
                      {aiIncludeMedia
                        ? 'Gambar dan PDF akan ikut dianalisa (menggunakan lebih banyak token)'
                        : 'Hanya teks percakapan yang dianalisa — lebih hemat token & kredit'}
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

        {/* AI Model Selection removed - now centralized in Settings */}

          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={isAnalyzing || !aiPrompt.trim()}
              icon={isAnalyzing ? Loader2 : Sparkles}
              className={isAnalyzing ? '[&>svg]:animate-spin' : ''}
            >
              Run Analysis
            </Button>
          </div>
        </form>

        {aiError && (
          <div className="mt-4 pt-4 border-t border-slate-100 animate-fade-in">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Analysis Error</h4>
            <div className="rounded-xl p-4 border-2 bg-red-50 border-red-300 text-sm text-red-800">
              {aiError.error}
            </div>
          </div>
        )}

        {aiResult && (
          <div className="mt-4 pt-4 border-t border-slate-100 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium text-slate-700">Analysis Result</h4>
              <Button size="sm" variant="outline" onClick={handleCopyResult}>
                {isCopied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed prose prose-sm max-w-none">
              {aiResult}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
