import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import {
  ArrowRightLeft, CheckCircle2, XCircle, X, Loader2
} from 'lucide-react';
import { Button } from '../ui/Button';

export function MigrateTab() {
  const [sessions, setSessions] = useState([]);
  const [migrateForm, setMigrateForm] = useState({ oldSessionId: '', newSessionId: '' });
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sessions`);
      if (Array.isArray(res.data)) {
        setSessions(res.data);
      } else {
        setSessions([]);
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    }
  };

  const handleMigrate = async () => {
    if (!migrateForm.oldSessionId || !migrateForm.newSessionId) {
      alert('Pilih Source Device dan Target Device');
      return;
    }
    if (migrateForm.oldSessionId === migrateForm.newSessionId) {
      alert('Source Device dan Target Device tidak boleh sama');
      return;
    }
    if (!confirm('Apakah Anda yakin ingin memindahkan data dari Source Device ke Target Device? Source Device akan dihapus setelah proses ini selesai.')) return;
    
    setIsMigrating(true);
    setMigrationResult(null);
    try {
      const res = await axios.post(`${API_URL}/api/sessions/migrate`, migrateForm);
      setMigrationResult({ success: true, message: res.data.message });
      setMigrateForm({ oldSessionId: '', newSessionId: '' });
      fetchSessions();
    } catch (err) {
      console.error('Migration failed', err);
      setMigrationResult({ success: false, message: 'Migrasi gagal: ' + (err.response?.data?.error || err.message) });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Info Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          <ArrowRightLeft className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-blue-900 mb-1">Migrasi Data Antar Device</h3>
          <p className="text-sm text-blue-700 leading-relaxed">
            Pindahkan semua data (pesan, jadwal report, excluded chats, report card, payment extraction, broadcast) dari <strong>Source Device</strong> (device lama) ke <strong>Target Device</strong> (device baru). Source Device akan <strong>dihapus</strong> setelah proses migrasi selesai.
          </p>
        </div>
      </div>

      {/* Migration Result */}
      {migrationResult && (
        <div className={`rounded-2xl p-5 flex items-start gap-3 border ${
          migrationResult.success
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-red-50 border-red-200'
        }`}>
          {migrationResult.success
            ? <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            : <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          }
          <div>
            <h4 className={`font-semibold text-sm ${migrationResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
              {migrationResult.success ? 'Migrasi Berhasil' : 'Migrasi Gagal'}
            </h4>
            <p className={`text-sm mt-0.5 ${migrationResult.success ? 'text-emerald-700' : 'text-red-700'}`}>
              {migrationResult.message}
            </p>
          </div>
          <button onClick={() => setMigrationResult(null)} className="ml-auto text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Migration Form */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-3">
          <ArrowRightLeft className="w-5 h-5 text-blue-500" />
          Pilih Source & Target Device
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Source Device (Old) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Source Device (Lama)</label>
            <select
              value={migrateForm.oldSessionId}
              onChange={(e) => setMigrateForm({ ...migrateForm, oldSessionId: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all bg-white font-medium text-slate-800"
            >
              <option value="">— Pilih Source Device —</option>
              {sessions.map(s => (
                <option key={s.sessionId} value={s.sessionId}>
                  {s.name} — {s.sessionId} [{s.status}]
                </option>
              ))}
            </select>
            {migrateForm.oldSessionId && (() => {
              const safeSessions = Array.isArray(sessions) ? sessions : [];
              const s = safeSessions.find(x => x.sessionId === migrateForm.oldSessionId);
              if (!s) return null;
              return (
                <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${s.status === 'ready' ? 'bg-emerald-500' : s.status === 'disconnected' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <span className="font-semibold text-sm text-slate-800">{s.name}</span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">{s.sessionId}</p>
                  <p className="text-xs text-slate-500 mt-1">Status: <span className={`font-semibold ${s.status === 'ready' ? 'text-emerald-600' : s.status === 'disconnected' ? 'text-red-600' : 'text-amber-600'}`}>{s.status}</span></p>
                  <p className="text-[11px] text-orange-600 mt-2 font-medium">⚠ Device ini akan dihapus setelah migrasi</p>
                </div>
              );
            })()}
          </div>

          {/* Target Device (New) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Target Device (Baru)</label>
            <select
              value={migrateForm.newSessionId}
              onChange={(e) => setMigrateForm({ ...migrateForm, newSessionId: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white font-medium text-slate-800"
            >
              <option value="">— Pilih Target Device —</option>
              {sessions.map(s => (
                <option key={s.sessionId} value={s.sessionId}>
                  {s.name} — {s.sessionId} [{s.status}]
                </option>
              ))}
            </select>
            {migrateForm.newSessionId && (() => {
              const safeSessions = Array.isArray(sessions) ? sessions : [];
              const s = safeSessions.find(x => x.sessionId === migrateForm.newSessionId);
              if (!s) return null;
              return (
                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${s.status === 'ready' ? 'bg-emerald-500' : s.status === 'disconnected' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <span className="font-semibold text-sm text-slate-800">{s.name}</span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">{s.sessionId}</p>
                  <p className="text-xs text-slate-500 mt-1">Status: <span className={`font-semibold ${s.status === 'ready' ? 'text-emerald-600' : s.status === 'disconnected' ? 'text-red-600' : 'text-amber-600'}`}>{s.status}</span></p>
                  <p className="text-[11px] text-indigo-600 mt-2 font-medium">✨ Device ini akan menerima semua data migrasi</p>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
          <Button
            onClick={handleMigrate}
            disabled={isMigrating || !migrateForm.oldSessionId || !migrateForm.newSessionId || migrateForm.oldSessionId === migrateForm.newSessionId}
            icon={isMigrating ? Loader2 : ArrowRightLeft}
          >
            {isMigrating ? 'Memproses Migrasi...' : 'Mulai Migrasi Data'}
          </Button>
        </div>
      </div>
    </div>
  );
}
