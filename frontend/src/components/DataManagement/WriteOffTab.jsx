import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import {
  Eraser, AlertTriangle, CheckCircle2, XCircle, Search, Loader2, Play
} from 'lucide-react';
import { Button } from '../ui/Button';

export function WriteOffTab() {
  const [sessions, setSessions] = useState([]);
  const [writeOffForm, setWriteOffForm] = useState({
    deleteMessages: true,
    deleteMedia: true,
    deleteReportSchedules: false,
    deleteDictionary: false,
    deleteExcludedChats: false,
    sessionId: 'all',
    olderThan: ''
  });
  const [preview, setPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [showWriteOffConfirm, setShowWriteOffConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isExecutingWriteOff, setIsExecutingWriteOff] = useState(false);
  const [writeOffResult, setWriteOffResult] = useState(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sessions`);
      setSessions(res.data);
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    }
  };

  const handlePreview = async () => {
    setIsLoadingPreview(true);
    setPreview(null);
    try {
      const res = await axios.post(`${API_URL}/api/backup/write-off/preview`, writeOffForm);
      setPreview(res.data);
    } catch (err) {
      console.error('Failed to preview', err);
      alert('Gagal memuat preview data');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleExecuteWriteOff = async () => {
    if (confirmText !== 'RESET') return;
    setIsExecutingWriteOff(true);
    try {
      const res = await axios.post(`${API_URL}/api/backup/write-off`, { ...writeOffForm, confirmText });
      setWriteOffResult(res.data.summary);
      setShowWriteOffConfirm(false);
      setConfirmText('');
      setPreview(null);
    } catch (err) {
      console.error('Write-off failed', err);
      alert('Write-off gagal: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsExecutingWriteOff(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Warning Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-amber-900 mb-1">Perhatian — Penghapusan Data Permanen</h3>
          <p className="text-sm text-amber-700 leading-relaxed">
            Data yang dihapus melalui Write-Off <strong>tidak dapat dikembalikan</strong>. Sistem akan otomatis membuat backup database sebelum proses penghapusan sebagai langkah keamanan. Pastikan Anda benar-benar yakin sebelum melanjutkan.
          </p>
        </div>
      </div>

      {/* Write-off Success Result */}
      {writeOffResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <h3 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Write-Off Berhasil
          </h3>
          <ul className="text-sm text-emerald-700 space-y-1.5 list-disc list-inside">
            {writeOffResult.messagesDeleted !== undefined && <li>{writeOffResult.messagesDeleted.toLocaleString()} Pesan dihapus</li>}
            {writeOffResult.mediaDeleted !== undefined && <li>{writeOffResult.mediaDeleted.toLocaleString()} File Media dihapus</li>}
            {writeOffResult.reportSchedulesDeleted !== undefined && <li>{writeOffResult.reportSchedulesDeleted.toLocaleString()} Jadwal Report dihapus</li>}
            {writeOffResult.dictionaryDeleted !== undefined && <li>{writeOffResult.dictionaryDeleted.toLocaleString()} Kamus dihapus</li>}
            {writeOffResult.excludedChatsDeleted !== undefined && <li>{writeOffResult.excludedChatsDeleted.toLocaleString()} Excluded Chats dihapus</li>}
          </ul>
        </div>
      )}

      {/* Write-Off Confirmation Dialog */}
      {showWriteOffConfirm && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 relative animate-fade-in shadow-sm">
          <button 
            onClick={() => { setShowWriteOffConfirm(false); setConfirmText(''); }}
            className="absolute top-4 right-4 text-red-400 hover:text-red-600"
          >
            <XCircle className="w-5 h-5" />
          </button>
          
          <h3 className="text-xl font-bold text-red-800 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            Konfirmasi Akhir
          </h3>
          <p className="text-red-700 mb-4 font-medium">
            Tindakan ini bersifat permanen. Ketik <strong>RESET</strong> di bawah ini untuk mengonfirmasi.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Ketik RESET"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="flex-1 px-4 py-3 border-2 border-red-200 rounded-xl focus:border-red-500 focus:ring-4 focus:ring-red-500/20 text-red-900 uppercase font-bold"
            />
            <button
              onClick={handleExecuteWriteOff}
              disabled={confirmText !== 'RESET' || isExecutingWriteOff}
              className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isExecutingWriteOff ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eraser className="w-5 h-5" />}
              {isExecutingWriteOff ? 'Menghapus...' : 'Hapus Data'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Form */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Eraser className="w-5 h-5 text-indigo-500" />
            Kriteria Penghapusan
          </h2>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih Device</label>
              <select
                value={writeOffForm.sessionId}
                onChange={(e) => setWriteOffForm({ ...writeOffForm, sessionId: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
              >
                <option value="all">Semua Device</option>
                {sessions.map(s => (
                  <option key={s.sessionId} value={s.sessionId}>{s.name} ({s.sessionId})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Hapus data sebelum tanggal <span className="text-slate-400 font-normal">(opsional)</span></label>
              <input
                type="date"
                value={writeOffForm.olderThan}
                onChange={(e) => setWriteOffForm({ ...writeOffForm, olderThan: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
              />
              <p className="text-xs text-slate-500 mt-1.5">Jika dikosongkan, data akan dihapus tanpa batas waktu (semua).</p>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="block text-sm font-semibold text-slate-700 mb-3">Jenis Data yang Dihapus</label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={writeOffForm.deleteMessages}
                    onChange={(e) => setWriteOffForm({ ...writeOffForm, deleteMessages: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-800">Riwayat Pesan Chat</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={writeOffForm.deleteMedia}
                    onChange={(e) => setWriteOffForm({ ...writeOffForm, deleteMedia: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-800">File Media (Gambar, PDF, dll)</span>
                    <p className="text-xs text-slate-500">File fisik di server juga akan dihapus.</p>
                  </div>
                </label>
                
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={writeOffForm.deleteReportSchedules}
                    onChange={(e) => setWriteOffForm({ ...writeOffForm, deleteReportSchedules: e.target.checked })}
                    className="w-5 h-5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-800">Jadwal Report & Data Broadcast</span>
                  </div>
                </label>
              </div>
            </div>

            <Button 
              type="button"
              className="w-full mt-4"
              variant="outline"
              icon={isLoadingPreview ? Loader2 : Search}
              onClick={handlePreview}
              disabled={isLoadingPreview}
            >
              {isLoadingPreview ? 'Memindai...' : 'Hitung Data (Preview)'}
            </Button>
          </div>
        </div>

        {/* Right Column: Preview & Execute */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col">
          <h2 className="text-lg font-bold text-slate-800 mb-6 border-b border-slate-200 pb-3">Preview Penghapusan</h2>
          
          <div className="flex-1 flex flex-col justify-center">
            {preview ? (
              <div className="space-y-3 animate-fade-in mb-8">
                {preview.messageCount !== undefined && (
                  <div className="flex justify-between items-center p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <span className="text-sm text-slate-600 font-medium">💬 Pesan Chat</span>
                    <span className="font-bold text-slate-800 text-base">{preview.messageCount.toLocaleString()}</span>
                  </div>
                )}
                {preview.mediaCount !== undefined && (
                  <div className="flex justify-between items-center p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <span className="text-sm text-slate-600 font-medium">🖼️ File Media</span>
                    <span className="font-bold text-slate-800 text-base">{preview.mediaCount.toLocaleString()}</span>
                  </div>
                )}
                {preview.reportSchedulesCount !== undefined && (
                  <div className="flex justify-between items-center p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
                    <span className="text-sm text-amber-800 font-medium">📅 Jadwal Report & Broadcast</span>
                    <span className="font-bold text-amber-900 text-base">{preview.reportSchedulesCount.toLocaleString()}</span>
                  </div>
                )}
                {preview.dictionaryCount !== undefined && (
                  <div className="flex justify-between items-center p-3.5 bg-emerald-50/50 border border-emerald-100/60 rounded-xl">
                    <span className="text-sm text-emerald-800 font-medium">📖 Kamus</span>
                    <span className="font-bold text-emerald-900 text-base">{preview.dictionaryCount.toLocaleString()}</span>
                  </div>
                )}
                {preview.excludedChatsCount !== undefined && (
                  <div className="flex justify-between items-center p-3.5 bg-slate-100/60 border border-slate-200/40 rounded-xl">
                    <span className="text-sm text-slate-700 font-medium">🚫 Excluded Chats</span>
                    <span className="font-bold text-slate-800 text-base">{preview.excludedChatsCount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                Klik tombol "Hitung Data" untuk memindai volume data sebelum menghapus.
              </div>
            )}
          </div>

          <button
            onClick={() => { setConfirmText(''); setShowWriteOffConfirm(true); }}
            disabled={!preview || isExecutingWriteOff}
            className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-5 py-3.5 rounded-xl font-bold transition-all shadow-sm shadow-red-200 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-sm"
          >
            <AlertTriangle className="w-5 h-5" />
            Eksekusi Write-Off
          </button>
          <p className="text-xs text-center text-slate-400 mt-3">Tombol eksekusi aktif setelah data berhasil dipreview.</p>
        </div>
      </div>
    </div>
  );
}
