import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { Settings2, Loader2, Save } from 'lucide-react';

export function ToolsTab() {
  const [toolsProfile, setToolsProfile] = useState({
    DEFAULT_NOTIF_TELEGRAM: '',
    DEFAULT_NOTIF_WHATSAPP: '',
    PRINTER_NAME: '',
    NOTIF_GUDANG_TG_ID: '',
    NOTIF_KASIR_TG_ID: '',
    NOTIF_EDP_TG_ID: ''
  });
  const [telegramBots, setTelegramBots] = useState([]);
  const [whatsappSessions, setWhatsappSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [settingsRes, botsRes, sessionsRes] = await Promise.all([
        axios.get(`${API_URL}/api/settings?keys=DEFAULT_NOTIF_TELEGRAM,DEFAULT_NOTIF_WHATSAPP,PRINTER_NAME,NOTIF_GUDANG_TG_ID,NOTIF_KASIR_TG_ID,NOTIF_EDP_TG_ID`),
        axios.get(`${API_URL}/api/telegram-bots`),
        axios.get(`${API_URL}/api/sessions`)
      ]);

      setToolsProfile({
        DEFAULT_NOTIF_TELEGRAM: settingsRes.data.DEFAULT_NOTIF_TELEGRAM || '',
        DEFAULT_NOTIF_WHATSAPP: settingsRes.data.DEFAULT_NOTIF_WHATSAPP || '',
        PRINTER_NAME: settingsRes.data.PRINTER_NAME || '',
        NOTIF_GUDANG_TG_ID: settingsRes.data.NOTIF_GUDANG_TG_ID || '',
        NOTIF_KASIR_TG_ID: settingsRes.data.NOTIF_KASIR_TG_ID || '',
        NOTIF_EDP_TG_ID: settingsRes.data.NOTIF_EDP_TG_ID || ''
      });
      setTelegramBots(botsRes.data);
      // Ensure we don't display TapTalk sessions for whatsapp default (assuming taptalk sessions might have specific naming, or just keep all)
      setWhatsappSessions(sessionsRes.data.filter(s => !s.sessionId.includes('taptalk')));
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await axios.post(`${API_URL}/api/settings/batch`, {
        settings: toolsProfile
      });
      alert('Tools settings saved successfully!');
    } catch (err) {
      console.error('Failed to save tools settings', err);
      alert('Failed to save tools settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="p-2.5 bg-slate-100 rounded-lg">
          <Settings2 className="w-5 h-5 text-slate-700" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Konfigurasi Tools</h2>
          <p className="text-sm text-slate-500">Atur pengaturan perangkat default untuk notifikasi.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Default Device Telegram
              </label>
              <select
                value={toolsProfile.DEFAULT_NOTIF_TELEGRAM}
                onChange={(e) => setToolsProfile({ ...toolsProfile, DEFAULT_NOTIF_TELEGRAM: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              >
                <option value="">-- Pilih Telegram Bot --</option>
                {telegramBots.map(bot => (
                  <option key={bot.id} value={`telegram-${bot.id}`}>
                    {bot.name || `Bot (${bot.type})`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">Perangkat yang digunakan untuk mengirim notifikasi Telegram ke PIC.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">
                Default Device WhatsApp
              </label>
              <select
                value={toolsProfile.DEFAULT_NOTIF_WHATSAPP}
                onChange={(e) => setToolsProfile({ ...toolsProfile, DEFAULT_NOTIF_WHATSAPP: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
              >
                <option value="">-- Pilih WhatsApp Session --</option>
                {whatsappSessions.map(session => (
                  <option key={session.id} value={session.sessionId}>
                    {session.name || session.sessionId}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">Perangkat yang digunakan untuk mengirim notifikasi WhatsApp ke PIC.</p>
            </div>

          </div>

          <div className="pt-6 border-t border-slate-200 mt-6">
            <h3 className="text-md font-semibold text-slate-800 mb-4">Pengaturan Printer & ID Notifikasi</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Nama Printer Tujuan</label>
                <input
                  type="text"
                  value={toolsProfile.PRINTER_NAME}
                  onChange={(e) => setToolsProfile({ ...toolsProfile, PRINTER_NAME: e.target.value })}
                  placeholder="Misal: EPSON TM-T82X"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
                <p className="text-xs text-slate-500">Nama printer di sistem (untuk cetak dokumen langsung).</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Notifikasi Gudang (Telegram Chat ID)</label>
                <input
                  type="text"
                  value={toolsProfile.NOTIF_GUDANG_TG_ID}
                  onChange={(e) => setToolsProfile({ ...toolsProfile, NOTIF_GUDANG_TG_ID: e.target.value })}
                  placeholder="Misal: -100123456789"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
                <p className="text-xs text-slate-500">ID Grup/User Telegram untuk notifikasi bagian Gudang.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Notifikasi Kasir (Telegram Chat ID)</label>
                <input
                  type="text"
                  value={toolsProfile.NOTIF_KASIR_TG_ID}
                  onChange={(e) => setToolsProfile({ ...toolsProfile, NOTIF_KASIR_TG_ID: e.target.value })}
                  placeholder="Misal: -100123456789"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
                <p className="text-xs text-slate-500">ID Grup/User Telegram untuk notifikasi bagian Kasir.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Notifikasi EDP (Telegram Chat ID)</label>
                <input
                  type="text"
                  value={toolsProfile.NOTIF_EDP_TG_ID}
                  onChange={(e) => setToolsProfile({ ...toolsProfile, NOTIF_EDP_TG_ID: e.target.value })}
                  placeholder="Misal: -100123456789"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                />
                <p className="text-xs text-slate-500">ID Grup/User Telegram untuk notifikasi bagian EDP.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Simpan Pengaturan
          </button>
        </div>
      </form>
    </div>
  );
}
