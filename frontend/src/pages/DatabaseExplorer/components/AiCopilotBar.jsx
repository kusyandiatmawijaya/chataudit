import React, { useState, useEffect } from 'react';
import { Bot, Sparkles, HelpCircle, Code2, Loader2, ArrowRight } from 'lucide-react';

const QUICK_PROMPTS = [
  { id: 'gap_order', label: 'Gap Order Bulan Ini (OA)', prompt: 'Tampilkan toko yang belum order bulan ini beserta salesman-nya' },
  { id: 'top_salesman', label: 'Top 10 Salesman Omzet', prompt: 'Tampilkan 10 salesman dengan total omzet tertinggi bulan ini' },
  { id: 'rute_kunjungan', label: 'Rute Kunjungan Selasa', prompt: 'Tampilkan rute kunjungan salesman hari Selasa dengan status aktif' },
  { id: 'piutang_ar', label: 'Piutang AR > 1 Juta', prompt: 'Tampilkan saldo piutang tertagih dan outstanding tagihan di atas 1 juta' }
];

export const AiCopilotBar = ({ onGenerate, onExplain, schemaStats, loading }) => {
  const [prompt, setPrompt] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleGenerate = () => {
    if (prompt.trim()) {
      onGenerate(prompt);
    }
  };

  const handleQuickPrompt = (quickPromptText) => {
    setPrompt(quickPromptText);
    onGenerate(quickPromptText);
  };

  return (
    <div className="flex flex-col bg-gray-900 border-b border-gray-700 w-full shrink-0">
      <div className="flex items-center px-4 py-2 space-x-3">
        <div className="flex items-center space-x-2 text-indigo-400 font-medium whitespace-nowrap bg-indigo-900/20 px-3 py-1.5 rounded-md border border-indigo-500/30">
          <Bot className="w-5 h-5" />
          <span>AI Copilot</span>
        </div>
        
        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tulis instruksi dalam bahasa manusia (misal: 'Tampilkan toko yang belum order bulan ini...') | Ctrl+Enter"
            className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-4 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            disabled={loading}
          />
          <div className="absolute right-3 text-gray-500 text-xs hidden sm:block pointer-events-none">
            Ctrl+Enter
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-md font-medium transition-all shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Generate SQL</span>
          </button>
          
          <button
            onClick={onExplain}
            disabled={loading}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-yellow-400 border border-gray-700 rounded-md font-medium transition-colors"
            title="Explain Current SQL"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Explain</span>
          </button>
        </div>
      </div>
      
      <div className="flex justify-between items-center px-4 py-2 bg-gray-800/30 text-xs border-t border-gray-800">
        <div className="flex items-center space-x-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <span className="text-gray-400 font-medium">Contoh:</span>
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.id}
              onClick={() => handleQuickPrompt(qp.prompt)}
              disabled={loading}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-full transition-colors whitespace-nowrap"
            >
              {qp.label}
            </button>
          ))}
        </div>
        
        {schemaStats && (
          <div className="flex items-center space-x-2 text-indigo-300/80 bg-indigo-900/10 px-3 py-1 rounded-full border border-indigo-800/30 whitespace-nowrap ml-4">
            <Code2 className="w-3.5 h-3.5" />
            <span>Schema-Aware: {schemaStats.tableCount} Tables, {schemaStats.viewCount} Views loaded</span>
          </div>
        )}
      </div>
    </div>
  );
};
