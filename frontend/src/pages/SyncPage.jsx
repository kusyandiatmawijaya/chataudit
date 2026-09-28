import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { 
  FiRefreshCw, FiSettings, FiPlayCircle, FiCheckCircle, FiXCircle, 
  FiClock, FiDatabase, FiPlus, FiTrash2, FiCode, FiArrowUpRight, FiKey
} from 'react-icons/fi';

export default function SyncPage() {
  const [settings, setSettings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeSyncs, setActiveSyncs] = useState({});
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [activePushModule, setActivePushModule] = useState(null);
  const [isNewModule, setIsNewModule] = useState(false);

  // Settings form state
  const [formData, setFormData] = useState({
    id: '',
    module: '',
    moduleName: '',
    endpoint: '',
    httpMethod: 'GET',
    authType: 'NONE',
    authUsername: '',
    authPassword: '',
    authToken: '',
    apiKeyHeader: 'X-API-Key',
    customHeaders: '',
    paginationType: 'OFFSET_LIMIT',
    dataPath: '',
    fieldMapping: '',
    scheduleType: 'manual',
    syncType: 'replace',
    isActive: true
  });

  useEffect(() => {
    fetchSettings();
    fetchLogs();

    // Setup SSE for progress bar
    const sse = new EventSource(`${API_URL}/api/sync/progress`);
    
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setActiveSyncs(data);
        if (Object.values(data).some(sync => sync.status === 'SUCCESS' || sync.status === 'FAILED')) {
          fetchLogs();
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    return () => sse.close();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sync/settings`);
      
      // Default initial templates for any business (clean, no company-specific credentials)
      const defaultModules = [
        {
          module: 'customers',
          moduleName: 'Master Pelanggan (Customer)',
          endpoint: 'https://api.contoh-perusahaan.com/v1/customers',
          httpMethod: 'GET',
          authType: 'NONE',
          authUsername: '',
          authPassword: '',
          authToken: '',
          apiKeyHeader: 'X-API-Key',
          paginationType: 'OFFSET_LIMIT',
          dataPath: 'data',
          fieldMapping: null,
          scheduleType: 'manual',
          syncType: 'upsert',
          isActive: true
        },
        {
          module: 'outstandingar',
          moduleName: 'Outstanding AR (Data Piutang)',
          endpoint: 'https://api.contoh-perusahaan.com/v1/invoices',
          httpMethod: 'GET',
          authType: 'NONE',
          authUsername: '',
          authPassword: '',
          authToken: '',
          apiKeyHeader: 'X-API-Key',
          paginationType: 'OFFSET_LIMIT',
          dataPath: 'items',
          fieldMapping: null,
          scheduleType: 'manual',
          syncType: 'replace',
          isActive: true
        },
        {
          module: 'daftarhargabarang',
          moduleName: 'Katalog Produk & Daftar Harga',
          endpoint: 'https://api.contoh-perusahaan.com/v1/products',
          httpMethod: 'GET',
          authType: 'NONE',
          authUsername: '',
          authPassword: '',
          authToken: '',
          apiKeyHeader: 'X-API-Key',
          paginationType: 'OFFSET_LIMIT',
          dataPath: 'items',
          fieldMapping: null,
          scheduleType: 'daily',
          syncType: 'replace',
          isActive: true
        },
        {
          module: 'analisacreditlimit',
          moduleName: 'Analisa Credit Limit Toko',
          endpoint: 'https://api.contoh-perusahaan.com/v1/credit-limits',
          httpMethod: 'GET',
          authType: 'NONE',
          authUsername: '',
          authPassword: '',
          authToken: '',
          apiKeyHeader: 'X-API-Key',
          paginationType: 'OFFSET_LIMIT',
          dataPath: 'items',
          fieldMapping: null,
          scheduleType: '2_hours',
          syncType: 'replace',
          isActive: true
        }
      ];

      if (res.data.length === 0) {
        setSettings(defaultModules);
        await axios.post(`${API_URL}/api/sync/settings`, { settings: defaultModules });
      } else {
        setSettings(res.data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sync/logs`);
      setLogs(res.data);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const runSync = async (module) => {
    try {
      await axios.post(`${API_URL}/api/sync/run`, { module });
      setTimeout(() => fetchLogs(), 500);
    } catch (error) {
      console.error('Error starting sync:', error);
      alert('Gagal memulai sync: ' + (error.response?.data?.error || error.message));
    }
  };

  const runAllSync = () => {
    settings.forEach(setting => {
      if (setting.isActive) {
        runSync(setting.module);
      }
    });
  };

  const openSettings = (setting) => {
    setIsNewModule(false);
    setFormData({
      id: setting.id || '',
      module: setting.module,
      moduleName: setting.moduleName || setting.module,
      endpoint: setting.endpoint || '',
      httpMethod: setting.httpMethod || 'GET',
      authType: setting.authType || 'NONE',
      authUsername: setting.authUsername || '',
      authPassword: setting.authPassword || '',
      authToken: setting.authToken || '',
      apiKeyHeader: setting.apiKeyHeader || 'X-API-Key',
      customHeaders: setting.customHeaders ? (typeof setting.customHeaders === 'object' ? JSON.stringify(setting.customHeaders, null, 2) : setting.customHeaders) : '',
      paginationType: setting.paginationType || 'OFFSET_LIMIT',
      dataPath: setting.dataPath || '',
      fieldMapping: setting.fieldMapping ? (typeof setting.fieldMapping === 'object' ? JSON.stringify(setting.fieldMapping, null, 2) : setting.fieldMapping) : '',
      scheduleType: setting.scheduleType || 'manual',
      syncType: setting.syncType || 'replace',
      isActive: setting.isActive !== undefined ? setting.isActive : true
    });
    setIsSettingsModalOpen(true);
  };

  const openCreateModal = () => {
    setIsNewModule(true);
    setFormData({
      id: '',
      module: '',
      moduleName: '',
      endpoint: '',
      httpMethod: 'GET',
      authType: 'NONE',
      authUsername: '',
      authPassword: '',
      authToken: '',
      apiKeyHeader: 'X-API-Key',
      customHeaders: '',
      paginationType: 'OFFSET_LIMIT',
      dataPath: 'data',
      fieldMapping: '',
      scheduleType: 'manual',
      syncType: 'replace',
      isActive: true
    });
    setIsSettingsModalOpen(true);
  };

  const handleDeleteModule = async (id, moduleName) => {
    if (!window.confirm(`Yakin ingin menghapus konfigurasi modul '${moduleName}'?`)) return;
    try {
      await axios.delete(`${API_URL}/api/sync/settings/${id}`);
      fetchSettings();
    } catch (err) {
      alert('Gagal menghapus modul: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      let parsedHeaders = null;
      if (formData.customHeaders?.trim()) {
        try {
          parsedHeaders = JSON.parse(formData.customHeaders);
        } catch {
          alert('Format Custom Headers harus berupa JSON valid');
          return;
        }
      }

      let parsedMapping = null;
      if (formData.fieldMapping?.trim()) {
        try {
          parsedMapping = JSON.parse(formData.fieldMapping);
        } catch {
          alert('Format Field Mapping harus berupa JSON valid (contoh: {"source_field": "target_field"})');
          return;
        }
      }

      const payload = {
        ...formData,
        customHeaders: parsedHeaders,
        fieldMapping: parsedMapping
      };

      await axios.post(`${API_URL}/api/sync/settings`, { settings: [payload] });
      await fetchSettings();
      setIsSettingsModalOpen(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Gagal menyimpan pengaturan: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-4 sm:p-6 pb-32 sm:pb-12 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2 text-gray-900">
            <FiRefreshCw className="text-blue-600" /> Sinkronisasi Data Eksternal (General Sync)
          </h1>
          <p className="text-gray-500">Kelola dan tarik data transaksi, master data, serta custom dataset dari API sistem manapun.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium shadow-sm transition-colors"
        >
          <FiPlus /> Tambah Modul Sync
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-gray-50 gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-700">Daftar Modul Terkonfigurasi ({settings.length})</span>
          </div>
          <button 
            onClick={runAllSync}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium transition-colors w-full sm:w-auto text-sm"
          >
            <FiRefreshCw /> Jalankan Semua Sync
          </button>
        </div>

        <div className="divide-y divide-gray-100">
          {settings.map(setting => {
            const syncState = activeSyncs[setting.module];
            const isSyncing = syncState?.status === 'IN_PROGRESS';
            
            return (
              <div key={setting.module} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col md:flex-row items-stretch md:items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <FiDatabase size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{setting.moduleName}</h3>
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-mono text-xs font-semibold">
                          {setting.module}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium uppercase tracking-wide">
                          {setting.httpMethod || 'GET'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium uppercase tracking-wide">
                          {setting.syncType}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium tracking-wide">
                          {setting.scheduleType}
                        </span>
                        {!setting.isActive && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-medium">
                            Nonaktif
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-2 break-all font-mono">
                        {setting.endpoint || '(Inbound Push Only)'}
                      </p>
                      
                      {/* Progress Bar / Status Area */}
                      {syncState && (
                        <div className={`mt-3 p-3 rounded-lg border w-full max-w-2xl ${
                          syncState.status === 'FAILED' ? 'bg-red-50 border-red-100' :
                          syncState.status === 'SUCCESS' ? 'bg-green-50 border-green-100' :
                          'bg-blue-50 border-blue-100'
                        }`}>
                          <div className={`flex justify-between text-xs font-medium mb-1 ${
                            syncState.status === 'FAILED' ? 'text-red-800' :
                            syncState.status === 'SUCCESS' ? 'text-green-800' :
                            'text-blue-800'
                          }`}>
                            <span>{syncState.message}</span>
                            {syncState.status === 'IN_PROGRESS' && (
                              <span>{syncState.total > 0 ? `${syncState.progress} / ${syncState.total}` : syncState.progress}</span>
                            )}
                          </div>
                          {syncState.status === 'IN_PROGRESS' && (
                            <div className="w-full bg-blue-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out" 
                                style={{ width: syncState.total > 0 ? `${Math.min(100, (syncState.progress / syncState.total) * 100)}%` : '100%' }}
                              ></div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto md:ml-4 shrink-0">
                    <button 
                      onClick={() => runSync(setting.module)}
                      disabled={isSyncing || !setting.endpoint}
                      className={`flex-1 md:flex-none justify-center px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors border text-sm ${
                        isSyncing 
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {isSyncing ? <FiRefreshCw className="animate-spin text-blue-600" /> : <FiPlayCircle />}
                      {isSyncing ? 'Syncing...' : 'Sync Sekarang'}
                    </button>
                    <button 
                      onClick={() => openSettings(setting)}
                      className="flex-1 md:flex-none px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 font-medium transition-colors text-sm"
                    >
                      <FiSettings /> Konfigurasi
                    </button>
                    <button
                      onClick={() => {
                        setActivePushModule(setting);
                        setIsPushModalOpen(true);
                      }}
                      className="flex-1 md:flex-none px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 flex items-center justify-center gap-2 font-medium transition-colors text-sm"
                    >
                      <FiArrowUpRight /> Inbound Webhook
                    </button>
                    {setting.id && (
                      <button
                        onClick={() => handleDeleteModule(setting.id, setting.moduleName)}
                        className="text-red-500 hover:text-red-700 p-2 text-center text-xs flex items-center justify-center gap-1"
                      >
                        <FiTrash2 /> Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <FiClock /> Riwayat Eksekusi Sinkronisasi (Log)
          </h2>
          <button onClick={fetchLogs} className="text-gray-500 hover:text-blue-600 transition-colors p-1.5 hover:bg-gray-100 rounded-lg">
            <FiRefreshCw />
          </button>
        </div>
        
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-medium">Waktu</th>
                <th className="px-6 py-4 font-medium">Modul</th>
                <th className="px-6 py-4 font-medium">Metode</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Data Sinkron</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {new Date(log.createdAt).toLocaleString('id-ID', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">{log.module}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold tracking-wide">
                      {log.method}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {log.status === 'SUCCESS' ? (
                      <span className="flex items-center gap-1.5 text-green-600 font-medium">
                        <FiCheckCircle /> SUCCESS
                      </span>
                    ) : log.status === 'FAILED' ? (
                      <span className="flex items-center gap-1.5 text-red-600 font-medium" title={log.errorMessage}>
                        <FiXCircle /> FAILED: {log.errorMessage?.slice(0, 30)}...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                        <FiRefreshCw className="animate-spin" /> IN_PROGRESS
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-700">
                    {log.syncedRows} records
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    Belum ada riwayat sinkronisasi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {isNewModule ? 'Tambah Modul Sync Baru' : `Pengaturan: ${formData.moduleName}`}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Konfigurasi endpoint, otentikasi, dan mapping data</p>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <FiXCircle size={22} />
              </button>
            </div>
            
            <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Slug Modul / Identifier
                  </label>
                  <input 
                    type="text" 
                    required
                    disabled={!isNewModule}
                    placeholder="misal: customers, outstandingar, atau custom-slug"
                    value={formData.module}
                    onChange={e => setFormData({...formData, module: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 transition-all disabled:bg-gray-100"
                  />
                  <span className="text-[11px] text-gray-400">Gunakan lowercase & tanda strip (-)</span>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Nama Tampilan Modul
                  </label>
                  <input 
                    type="text" 
                    required
                    placeholder="misal: Master Pelanggan"
                    value={formData.moduleName}
                    onChange={e => setFormData({...formData, moduleName: e.target.value})}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Endpoint & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    API Endpoint URL
                  </label>
                  <input 
                    type="url" 
                    placeholder="https://api.perusahaan.com/v1/..."
                    value={formData.endpoint}
                    onChange={e => setFormData({...formData, endpoint: e.target.value})}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    HTTP Method
                  </label>
                  <select 
                    value={formData.httpMethod}
                    onChange={e => setFormData({...formData, httpMethod: e.target.value})}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
              </div>

              {/* Authentication Type */}
              <div className="border border-gray-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
                <div className="flex items-center gap-2 font-semibold text-sm text-gray-800">
                  <FiKey className="text-blue-600" /> Metode Otentikasi
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Jenis Auth</label>
                    <select 
                      value={formData.authType}
                      onChange={e => setFormData({...formData, authType: e.target.value})}
                      className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white"
                    >
                      <option value="NONE">Tanpa Otentikasi</option>
                      <option value="BASIC">Basic Auth (User & Pass)</option>
                      <option value="BEARER">Bearer Token</option>
                      <option value="API_KEY">API Key Header</option>
                    </select>
                  </div>

                  {formData.authType === 'BASIC' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                        <input 
                          type="text" 
                          value={formData.authUsername}
                          onChange={e => setFormData({...formData, authUsername: e.target.value})}
                          className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                        <input 
                          type="password" 
                          value={formData.authPassword}
                          onChange={e => setFormData({...formData, authPassword: e.target.value})}
                          className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </>
                  )}

                  {formData.authType === 'BEARER' && (
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Bearer Token</label>
                      <input 
                        type="text" 
                        placeholder="eyJhbGciOi..."
                        value={formData.authToken}
                        onChange={e => setFormData({...formData, authToken: e.target.value})}
                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-mono"
                      />
                    </div>
                  )}

                  {formData.authType === 'API_KEY' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Header Name</label>
                        <input 
                          type="text" 
                          placeholder="X-API-Key"
                          value={formData.apiKeyHeader}
                          onChange={e => setFormData({...formData, apiKeyHeader: e.target.value})}
                          className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">API Key Value</label>
                        <input 
                          type="text" 
                          placeholder="key_secret_..."
                          value={formData.authToken}
                          onChange={e => setFormData({...formData, authToken: e.target.value})}
                          className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-mono"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Data Extraction & Paginasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Data Path (JSON Property)
                  </label>
                  <input 
                    type="text" 
                    placeholder="misal: data, items, atau results"
                    value={formData.dataPath}
                    onChange={e => setFormData({...formData, dataPath: e.target.value})}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                  <span className="text-[11px] text-gray-400">Letak list array di respon API. Kosongkan untuk deteksi otomatis.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Jenis Paginasi
                  </label>
                  <select 
                    value={formData.paginationType}
                    onChange={e => setFormData({...formData, paginationType: e.target.value})}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="OFFSET_LIMIT">Offset & Limit (?offset=0&limit=2000)</option>
                    <option value="PAGE_NUMBER">Page Number (?page=1&pageSize=2000)</option>
                    <option value="NONE">Sekali Tarik (Tanpa Paginasi)</option>
                  </select>
                </div>
              </div>

              {/* Sync Type & Schedule */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Metode Database Sync
                  </label>
                  <select 
                    value={formData.syncType}
                    onChange={e => setFormData({...formData, syncType: e.target.value})}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="replace">Replace Data (Hapus lalu Insert ulang)</option>
                    <option value="upsert">Update / Insert (Upsert)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Jadwal Otomatis (Scheduler)
                  </label>
                  <select 
                    value={formData.scheduleType}
                    onChange={e => setFormData({...formData, scheduleType: e.target.value})}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="manual">Manual (Hanya lewat tombol/API)</option>
                    <option value="5_minutes">Setiap 5 Menit</option>
                    <option value="10_minutes">Setiap 10 Menit</option>
                    <option value="hourly">Setiap Jam</option>
                    <option value="2_hours">Setiap 2 Jam</option>
                    <option value="6_hours">Setiap 6 Jam</option>
                    <option value="daily">Setiap Hari</option>
                  </select>
                </div>
              </div>

              {/* Advanced Field Mapping */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Field Mapping (Opsional, Format JSON)
                </label>
                <textarea 
                  rows={3}
                  placeholder='{"external_col": "kdcust", "nama_pelanggan": "nmcust"}'
                  value={formData.fieldMapping}
                  onChange={e => setFormData({...formData, fieldMapping: e.target.value})}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-xs font-mono"
                />
                <span className="text-[11px] text-gray-400">Petakan nama kolom dari API eksternal ke properti database sistem.</span>
              </div>

              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={formData.isActive}
                  onChange={e => setFormData({...formData, isActive: e.target.checked})}
                  className="w-5 h-5 text-blue-600 rounded border-gray-300"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Aktifkan Sinkronisasi untuk Modul Ini
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors text-sm"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm text-sm"
                >
                  Simpan Konfigurasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inbound Push Webhook Modal */}
      {isPushModalOpen && activePushModule && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <FiArrowUpRight className="text-blue-600" /> Inbound Webhook / Push API
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Kirim data dari ERP/sistem luar langsung ke modul ini secara real-time</p>
              </div>
              <button onClick={() => setIsPushModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
                <FiXCircle size={22} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Target Endpoint</label>
                <div className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-xs break-all">
                  POST {API_URL}/api/sync/push/{activePushModule.module}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Header Otentikasi (Jika Dikonfigurasi)</label>
                <div className="p-3 bg-slate-100 text-slate-800 rounded-lg font-mono text-xs">
                  x-api-key: {activePushModule.authToken || '(Tidak memerlukan token jika kosong)'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Contoh Permintaan cURL</label>
                <pre className="p-3 bg-slate-900 text-green-400 rounded-lg font-mono text-xs overflow-x-auto whitespace-pre-wrap">
{`curl -X POST "${API_URL}/api/sync/push/${activePushModule.module}" \\
  -H "Content-Type: application/json" \\
  ${activePushModule.authToken ? `-H "x-api-key: ${activePushModule.authToken}" \\` : ''}
  -d '{
    "data": [
      { "id": 1, "name": "Contoh Data Record" }
    ]
  }'`}
                </pre>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  onClick={() => setIsPushModalOpen(false)}
                  className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
