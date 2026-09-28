import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Search, Check, AlertTriangle, Eye, Server, RefreshCw } from 'lucide-react';
import { API_URL } from '../../config';

export function ManageModelsModal({ isOpen, onClose }) {
  const [models, setModels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchAllModels();
    }
  }, [isOpen]);

  const fetchAllModels = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/models/all`);
      setModels(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch all models', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleModelStatus = async (modelId) => {
    try {
      const res = await axios.patch(`${API_URL}/api/models/toggle`, { modelId });
      if (res.data.success) {
        setModels(prev => 
          prev.map(m => m.modelId === modelId ? { ...m, isActive: res.data.data.isActive } : m)
        );
      }
    } catch (err) {
      console.error('Failed to toggle model', err);
      alert('Gagal mengubah status model');
    }
  };

  if (!isOpen) return null;

  const filteredModels = models.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.modelId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Panel */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col animate-scale-in">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Kelola Model AI (OpenRouter)</h2>
              <p className="text-xs text-slate-500">Cari dan aktifkan model yang ingin digunakan dalam aplikasi.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Actions */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari nama model atau ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-all"
            />
          </div>
          <button 
            onClick={fetchAllModels}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-50 hover:text-slate-800 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <RefreshCw className="w-6 h-6 text-violet-500 animate-spin" />
              <p className="text-sm text-slate-500">Memuat daftar model...</p>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
              <AlertTriangle className="w-8 h-8" />
              <p className="text-sm">Tidak ada model yang cocok dengan pencarian.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredModels.map(model => (
                <div 
                  key={model.modelId} 
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    model.isActive 
                      ? 'bg-white border-violet-200 shadow-sm ring-1 ring-violet-50' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-800 text-sm truncate" title={model.name}>
                        {model.name}
                      </h4>
                      {model.isFree ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold tracking-wide">FREE</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold tracking-wide">PAID</span>
                      )}
                      {model.isMultimodal && (
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center" title="Vision / Multimodal Support">
                          <Eye className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono truncate" title={model.modelId}>
                      {model.modelId}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Konteks: {model.contextLength ? model.contextLength.toLocaleString() : '?'} token
                    </p>
                  </div>
                  
                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={model.isActive}
                      onChange={() => toggleModelStatus(model.modelId)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
          >
            Tutup & Simpan
          </button>
        </div>

      </div>
    </div>
  );
}
