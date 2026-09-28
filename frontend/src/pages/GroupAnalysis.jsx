import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { Users, UserCheck, UserX, MessageSquare, FileText, Send, Loader2, Sparkles, AlertCircle, BrainCircuit, ChevronDown, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SaveToIssueModal from '../components/SaveToIssueModal';

const GroupAnalysis = () => {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState('');
  
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [includeMedia, setIncludeMedia] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const [showDetail, setShowDetail] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [sendReportPhone, setSendReportPhone] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState('');

  useEffect(() => {
    fetchSessions();
    
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsGroupDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      fetchGroups(activeSessionId);
    } else {
      setGroups([]);
      setActiveGroupId('');
    }
  }, [activeSessionId]);

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sessions`);
      if (Array.isArray(res.data)) {
        setSessions(res.data);
        if (res.data.length > 0) {
          setActiveSessionId(res.data[0].sessionId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
  };

  const fetchGroups = async (sessionId) => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/group-analysis/groups/${sessionId}`);
      if (res.data && res.data.groups) {
        const sortedGroups = res.data.groups.sort((a, b) => a.name.localeCompare(b.name));
        setGroups(sortedGroups);
        if (sortedGroups.length > 0) {
          setActiveGroupId(sortedGroups[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      setError('Gagal memuat daftar grup. Pastikan device WhatsApp terhubung.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!activeSessionId || !activeGroupId) {
      setError('Silakan pilih Device dan Grup terlebih dahulu.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setResult(null);
    setSendSuccess('');

    try {
      const userStr = localStorage.getItem('user');
      const userObj = userStr ? JSON.parse(userStr) : null;
      const requestedBy = userObj ? (userObj.name || userObj.username) : 'System';

      const res = await axios.post(`${API_URL}/api/group-analysis/analyze`, {
        sessionId: activeSessionId,
        groupId: activeGroupId,
        dateFrom,
        dateTo,
        includeMedia,
        requestedBy
      });

      if (res.data && res.data.success) {
        setResult(res.data.data);
      }
    } catch (err) {
      console.error('Failed to analyze:', err);
      setError(err.response?.data?.error || 'Terjadi kesalahan saat menganalisa grup.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendReport = async (format) => {
    if (!sendReportPhone) {
      alert('Masukkan nomor WhatsApp tujuan.');
      return;
    }
    
    setIsSending(true);
    setSendSuccess('');
    setError('');
    
    try {
      await axios.post(`${API_URL}/api/group-analysis/send-report`, {
        sessionId: activeSessionId,
        contactNumber: sendReportPhone,
        reportData: result,
        format
      });
      setSendSuccess(`Laporan ${format.toUpperCase()} berhasil dikirim!`);
    } catch (err) {
      console.error('Failed to send report:', err);
      alert(err.response?.data?.error || 'Gagal mengirim laporan.');
    } finally {
      setIsSending(false);
    }
  };

  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(groupSearchQuery.toLowerCase()));

  return (
    <div className="flex-1 overflow-y-auto w-full h-full pb-10">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-6 h-6 text-indigo-600" />
          Analisa Grup WhatsApp
        </h1>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Device / Session</label>
            <select
              value={activeSessionId}
              onChange={(e) => setActiveSessionId(e.target.value)}
              className="w-full rounded-lg border-gray-300 border px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">-- Pilih Device --</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.sessionId}>{s.name} ({s.sessionId})</option>
              ))}
            </select>
          </div>

          <div ref={dropdownRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Grup WA</label>
            <div 
              className={`w-full rounded-lg border-gray-300 border px-3 py-2 bg-white flex justify-between items-center cursor-pointer ${isLoading || groups.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => {
                if (!isLoading && groups.length > 0) {
                  setIsGroupDropdownOpen(!isGroupDropdownOpen);
                }
              }}
            >
              <span className="truncate">
                {activeGroupId 
                  ? `${groups.find(g => g.id === activeGroupId)?.name} (${groups.find(g => g.id === activeGroupId)?.memberCount} anggota)` 
                  : '-- Pilih Grup --'}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>
            
            {isGroupDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                <div className="p-2 border-b border-gray-100 flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Cari grup..." 
                    className="w-full text-sm outline-none"
                    value={groupSearchQuery}
                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map(g => (
                      <div 
                        key={g.id} 
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 ${activeGroupId === g.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}
                        onClick={() => {
                          setActiveGroupId(g.id);
                          setIsGroupDropdownOpen(false);
                          setGroupSearchQuery('');
                        }}
                      >
                        {g.name} <span className="text-gray-400">({g.memberCount} anggota)</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500 text-center">Grup tidak ditemukan</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border-gray-300 border px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border-gray-300 border px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
          <label className="flex items-center space-x-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includeMedia}
              onChange={(e) => setIncludeMedia(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Sertakan media (gambar/dokumen) dalam analisa AI</span>
          </label>

          <button
            onClick={handleAnalyze}
            disabled={isLoading || !activeGroupId}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Analisa Sekarang
          </button>
        </div>
        
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-start gap-2 text-sm mt-4">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Dashboard Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Anggota</p>
                <p className="text-2xl font-bold text-gray-900">{result.totalMembers}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Anggota Aktif</p>
                <p className="text-2xl font-bold text-gray-900">{result.activeCount}</p>
                <p className="text-xs text-gray-400">Berkontribusi pesan</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-orange-100 text-orange-600 rounded-lg">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Anggota Pasif</p>
                <p className="text-2xl font-bold text-gray-900">{result.passiveCount}</p>
                <p className="text-xs text-gray-400">Tidak ada interaksi</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AI Summary */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-indigo-600" />
                  Rangkuman AI (Topik, Action, Result)
                </h3>
              </div>
              <div className="p-6 prose prose-indigo max-w-none prose-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.aiSummary}
                </ReactMarkdown>
              </div>
            </div>

            {/* Send Report */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Send className="w-5 h-5 text-indigo-600" />
                  Kirim Laporan
                </h3>
              </div>
              <div className="p-6 space-y-4">
                {sendSuccess && (
                  <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg">
                    {sendSuccess}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WA Tujuan (628...)</label>
                  <input
                    type="text"
                    value={sendReportPhone}
                    onChange={(e) => setSendReportPhone(e.target.value)}
                    placeholder="Contoh: 628123456789"
                    className="w-full rounded-lg border-gray-300 border px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSendReport('text')}
                    disabled={isSending}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-lg font-medium text-sm flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Kirim Teks
                  </button>
                  <button
                    onClick={() => handleSendReport('pdf')}
                    disabled={isSending}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium text-sm flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4" />
                    Kirim PDF
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Member Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-900">Daftar Anggota Grup</h3>
            </div>
            <div className="p-0">
              <div className="max-h-96 overflow-auto w-full">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 sticky top-0 border-b border-gray-100 z-10">
                    <tr>
                      <th className="px-6 py-3 font-semibold text-gray-700">Nama / Nomor</th>
                      <th className="px-6 py-3 font-semibold text-gray-700">Grup / Role</th>
                      <th className="px-6 py-3 font-semibold text-gray-700 text-center">Pesan</th>
                      <th className="px-6 py-3 font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.activeMembers.map((m, i) => (
                      <tr key={'active-'+i} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <div className="font-medium text-gray-900">{m.name}</div>
                          <div className="text-xs text-gray-500">
                            {m.realPhoneNumber ? (
                              <span className="font-medium text-indigo-600" title={`Internal ID: ${m.phoneNumber}`}>{m.realPhoneNumber}</span>
                            ) : m.phoneNumber}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.isInternal ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}`}>
                            {m.group}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center font-medium text-gray-900">
                          {m.messageCount}
                        </td>
                        <td className="px-6 py-3">
                          <span className="text-green-600 font-medium text-xs">Aktif</span>
                        </td>
                      </tr>
                    ))}
                    {result.passiveMembers.map((m, i) => (
                      <tr key={'passive-'+i} className="bg-gray-50 hover:bg-gray-100 opacity-70">
                        <td className="px-6 py-3">
                          <div className="font-medium text-gray-900">{m.name}</div>
                          <div className="text-xs text-gray-500">
                            {m.realPhoneNumber ? (
                              <span className="font-medium text-indigo-600" title={`Internal ID: ${m.phoneNumber}`}>{m.realPhoneNumber}</span>
                            ) : m.phoneNumber}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.isInternal ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}`}>
                            {m.group}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center font-medium text-gray-500">0</td>
                        <td className="px-6 py-3">
                          <span className="text-gray-500 font-medium text-xs">Pasif</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <div className="text-center">
             <button
                onClick={() => setShowDetail(!showDetail)}
                className="text-indigo-600 font-medium hover:underline"
             >
               {showDetail ? 'Sembunyikan Detail Percakapan' : 'Lihat Detail Percakapan'}
             </button>
          </div>

          {showDetail && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6 max-h-[600px] overflow-y-auto">
               <h3 className="font-bold text-gray-900 mb-4">Detail Percakapan</h3>
               <div className="space-y-4">
                 {result.messagesDetail && result.messagesDetail.map(msg => (
                   <div key={msg.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-1">
                         <span className="font-medium text-sm text-indigo-700">{msg.authorName || msg.sender}</span>
                         <span className="text-xs text-gray-500">{new Date(msg.timestamp).toLocaleString('id-ID')}</span>
                      </div>
                      <p className="text-gray-800 text-sm whitespace-pre-wrap">{msg.messageBody}</p>
                      {msg.mediaUrl && <span className="text-xs text-blue-500 mt-1 block">[Terdapat Lampiran Media]</span>}
                   </div>
                 ))}
               </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end">
            <button
              onClick={() => setIsIssueModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-medium flex items-center shadow"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Save to Issue Repository
            </button>
          </div>

        </div>
      )}
      
      <SaveToIssueModal 
        isOpen={isIssueModalOpen} 
        onClose={() => setIsIssueModalOpen(false)} 
        sourceModule="GROUP_ANALYSIS"
        defaultTitle={`Group Analysis: ${result?.groupName || ''}`}
        queryParameters={{ sessionId: activeSessionId, groupId: activeGroupId, dateFrom, dateTo }}
        initialSnapshot={result}
        aiSummary={result?.aiSummary}
      />
      </div>
    </div>
  );
};

export default GroupAnalysis;
