import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import {
  Bot, Shield, ShieldCheck, Plus, Trash2, Save, Loader2,
  ToggleLeft, ToggleRight, Phone, UserCheck, Settings,
  AlertTriangle, CheckCircle, XCircle, Sparkles, Users
} from 'lucide-react';

const SOCKET_URL = API_URL || window.location.origin;

export default function ChatbotSettings() {
  // Settings state
  const [sessions, setSessions] = useState([]);
  const [enabledSessions, setEnabledSessions] = useState([]);
  const [whitelistMode, setWhitelistMode] = useState('all');

  // Whitelist state
  const [whitelist, setWhitelist] = useState([]);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [deviceContacts, setDeviceContacts] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingWhitelist, setAddingWhitelist] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [settingsRes, sessionsRes, whitelistRes, contactsRes] = await Promise.all([
        axios.get(`${SOCKET_URL}/api/chatbot/settings`).catch(() => ({ data: { enabledSessions: [], whitelistMode: 'all' } })),
        axios.get(`${SOCKET_URL}/api/sessions`).catch(() => ({ data: [] })),
        axios.get(`${SOCKET_URL}/api/chatbot/whitelist`).catch(() => ({ data: [] })),
        axios.get(`${SOCKET_URL}/api/chatbot/contacts`).catch(() => ({ data: [] })),
      ]);

      setEnabledSessions(settingsRes.data.enabledSessions || []);
      setWhitelistMode(settingsRes.data.whitelistMode || 'all');
      setSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
      setWhitelist(Array.isArray(whitelistRes.data) ? whitelistRes.data : []);
      setDeviceContacts(Array.isArray(contactsRes.data) ? contactsRes.data : []);
    } catch (error) {
      console.error('Failed to load chatbot settings:', error);
      showToast('Gagal memuat pengaturan chatbot', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSession = (sessionId) => {
    setEnabledSessions((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    );
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.post(`${SOCKET_URL}/api/chatbot/settings`, {
        enabledSessions,
        whitelistMode
      });
      showToast('Pengaturan chatbot berhasil disimpan');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showToast('Gagal menyimpan pengaturan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addToWhitelist = async () => {
    if (!newPhone.trim()) return;
    setAddingWhitelist(true);
    try {
      const res = await axios.post(`${SOCKET_URL}/api/chatbot/whitelist`, {
        phoneNumber: newPhone.trim(),
        name: newName.trim() || null,
      });
      setWhitelist((prev) => [res.data, ...prev]);
      setNewPhone('');
      setNewName('');
      showToast('Nomor berhasil ditambahkan ke whitelist');
    } catch (error) {
      console.error('Failed to add to whitelist:', error);
      showToast('Gagal menambahkan nomor', 'error');
    } finally {
      setAddingWhitelist(false);
    }
  };

  const toggleWhitelistEntry = async (entry) => {
    try {
      const res = await axios.patch(`${SOCKET_URL}/api/chatbot/whitelist/${entry.id}`, {
        isActive: !entry.isActive,
      });
      setWhitelist((prev) =>
        prev.map((e) => (e.id === entry.id ? res.data : e))
      );
    } catch (error) {
      console.error('Failed to toggle whitelist entry:', error);
      showToast('Gagal mengubah status', 'error');
    }
  };

  const deleteWhitelistEntry = async (id) => {
    try {
      await axios.delete(`${SOCKET_URL}/api/chatbot/whitelist/${id}`);
      setWhitelist((prev) => prev.filter((e) => e.id !== id));
      showToast('Nomor dihapus dari whitelist');
    } catch (error) {
      console.error('Failed to delete whitelist entry:', error);
      showToast('Gagal menghapus nomor', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <span className="text-slate-500 text-sm">Memuat pengaturan chatbot...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-slide-in ${
          toast.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
        }`}>
          {toast.type === 'error' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Chatbot WhatsApp</h1>
            <p className="text-slate-500 text-sm">Konfigurasi chatbot otomatis untuk membalas pesan WhatsApp</p>
          </div>
        </div>

        {/* Section 1: Enable/Disable per Session */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Settings className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Aktivasi Chatbot per Device</h2>
              <p className="text-xs text-slate-500">Pilih device mana yang ingin diaktifkan chatbot AI-nya</p>
            </div>
          </div>
          <div className="p-6">
            {sessions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Belum ada device terhubung</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => {
                  const isEnabled = enabledSessions.includes(session.sessionId);
                  return (
                    <div
                      key={session.sessionId}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        isEnabled
                          ? 'border-emerald-200 bg-emerald-50/50 shadow-sm'
                          : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                      }`}
                      onClick={() => toggleSession(session.sessionId)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          session.status === 'ready' ? 'bg-emerald-400' : 'bg-slate-300'
                        }`} />
                        <div>
                          <p className="font-medium text-slate-800">{session.name}</p>
                          <p className="text-xs text-slate-400">{session.sessionId} · {session.status}</p>
                        </div>
                      </div>
                      <button className="shrink-0">
                        {isEnabled ? (
                          <ToggleRight className="w-8 h-8 text-emerald-500" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-slate-300" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: AI Model removed - now using Central Orchestrator */}
        {/* Section 3: Whitelist Mode */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Mode Akses</h2>
              <p className="text-xs text-slate-500">Tentukan siapa yang boleh berinteraksi dengan chatbot</p>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  whitelistMode === 'all'
                    ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => setWhitelistMode('all')}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <span className="font-semibold text-slate-800">Semua Nomor</span>
                </div>
                <p className="text-xs text-slate-500">Chatbot akan membalas semua pesan masuk (direct chat)</p>
              </div>
              <div
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  whitelistMode === 'whitelist'
                    ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => setWhitelistMode('whitelist')}
              >
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span className="font-semibold text-slate-800">Whitelist Only</span>
                </div>
                <p className="text-xs text-slate-500">Hanya nomor yang terdaftar di whitelist yang akan dibalas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Whitelist Management (visible when mode = whitelist) */}
        {whitelistMode === 'whitelist' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <UserCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Daftar Whitelist</h2>
                <p className="text-xs text-slate-500">Nomor telepon yang diizinkan berinteraksi dengan chatbot</p>
              </div>
            </div>
            <div className="p-6">
              {/* Add new number */}
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="Nomor telepon atau LID (contoh: 62812...)"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      onKeyDown={(e) => e.key === 'Enter' && addToWhitelist()}
                    />
                  </div>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nama Profil WA (opsional)"
                    className="w-full sm:w-1/3 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    onKeyDown={(e) => e.key === 'Enter' && addToWhitelist()}
                  />
                  <button
                    onClick={addToWhitelist}
                    disabled={addingWhitelist || !newPhone.trim()}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {addingWhitelist ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Tambah
                  </button>
                </div>
                
                {/* Contact Picker from History */}
                {deviceContacts.length > 0 && (
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-500 font-medium pl-2 whitespace-nowrap">Atau pilih dari chat:</span>
                    <select
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      onChange={(e) => {
                        const selected = deviceContacts.find(c => c.id === e.target.value);
                        if (selected) {
                          setNewPhone(selected.phoneNumber);
                          setNewName(selected.name);
                        }
                        e.target.value = ""; // Reset after selection
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Pilih kontak yang pernah mengirim pesan...</option>
                      {deviceContacts.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.phoneNumber})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Whitelist entries */}
              {whitelist.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Belum ada nomor di whitelist</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {whitelist.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                        entry.isActive
                          ? 'border-emerald-100 bg-emerald-50/30'
                          : 'border-slate-100 bg-slate-50/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                          entry.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}>
                          {(entry.name || entry.phoneNumber).substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{entry.name || 'Tanpa Nama'}</p>
                          <p className="text-xs text-slate-400">+{entry.phoneNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleWhitelistEntry(entry)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                          title={entry.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          {entry.isActive ? (
                            <ToggleRight className="w-6 h-6 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-400" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteWhitelistEntry(entry.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end mb-8">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold shadow-lg shadow-violet-500/20 hover:shadow-xl hover:shadow-violet-500/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Simpan Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
}
