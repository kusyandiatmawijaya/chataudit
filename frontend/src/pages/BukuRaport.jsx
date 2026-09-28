import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { ClipboardCheck, Calendar as CalendarIcon, Download, RefreshCw, Loader2, AlertTriangle, CheckCircle2, ChevronRight, X, User, BarChart3, ChevronUp, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import BIRaportTab from './BIRaportTab';

export default function BukuRaport() {
  // Top-level tab: CRM or BI
  const [mainTab, setMainTab] = useState('crm');
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  
  // Year selector
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - i);

  // Active Tab for mobile/tablet responsive layout
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' or 'detail'

  // Heatmap Data
  const [heatmapData, setHeatmapData] = useState([]);
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);
  const [heatmapScope, setHeatmapScope] = useState('device');
  const [heatmapContactInput, setHeatmapContactInput] = useState('');
  const [heatmapContact, setHeatmapContact] = useState('');
  const [availableChats, setAvailableChats] = useState([]);

  // Report Detail
  const [selectedReport, setSelectedReport] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // Generate Report Modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    type: 'daily',
    scope: 'device',
    date: new Date().toISOString().split('T')[0],
    contactNumber: ''
  });

  // Modal Gallery
  const [modalImage, setModalImage] = useState(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      fetchHeatmap();
      setSelectedReport(null);
    }
  }, [selectedSessionId, selectedYear, heatmapScope, heatmapContact]);

  useEffect(() => {
    if (selectedSessionId) {
      fetchAvailableChats();
    }
  }, [selectedSessionId]);

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sessions`);
      setSessions(res.data.filter(s => s.status === 'ready'));
      if (res.data.length > 0) {
        setSelectedSessionId(res.data[0].sessionId);
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    }
  };

  const fetchAvailableChats = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sessions/${selectedSessionId}/chats`);
      setAvailableChats(res.data);
    } catch (err) {
      console.error('Failed to fetch available chats', err);
    }
  };

  const fetchHeatmap = async () => {
    setIsLoadingHeatmap(true);
    try {
      let url = `${API_URL}/api/raport/heatmap?sessionId=${selectedSessionId}&year=${selectedYear}&type=daily&scope=${heatmapScope}`;
      if (heatmapScope === 'chat' && heatmapContact) {
        url += `&contactNumber=${heatmapContact}`;
      }
      const res = await axios.get(url);
      setHeatmapData(res.data);
    } catch (err) {
      console.error('Failed to fetch heatmap', err);
    } finally {
      setIsLoadingHeatmap(false);
    }
  };

  const loadReportDetail = async (id) => {
    setIsLoadingReport(true);
    try {
      const res = await axios.get(`${API_URL}/api/raport/${id}`);
      setSelectedReport(res.data);
      setActiveTab('detail');
    } catch (err) {
      console.error('Failed to load report detail', err);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await axios.post(`${API_URL}/api/raport/generate`, {
        sessionId: selectedSessionId,
        type: generateForm.type,
        scope: generateForm.scope,
        date: generateForm.date,
        contactNumber: generateForm.scope === 'chat' ? generateForm.contactNumber : null
      });
      
      setShowGenerateModal(false);
      fetchHeatmap(); // Refresh heatmap
      setSelectedReport(res.data); // Directly show the new report
      setActiveTab('detail');
    } catch (err) {
      console.error('Failed to generate report', err);
      alert(err.response?.data?.error || 'Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getGradeColor = (grade) => {
    if (!grade) return 'bg-slate-100 border-slate-200';
    if (grade.startsWith('A')) return 'bg-emerald-500 border-emerald-600';
    if (grade.startsWith('B')) return 'bg-green-400 border-green-500';
    if (grade.startsWith('C')) return 'bg-yellow-400 border-yellow-500';
    if (grade.startsWith('D')) return 'bg-orange-400 border-orange-500';
    return 'bg-red-500 border-red-600';
  };

  const getGradeTextColor = (grade) => {
    if (!grade) return 'text-slate-400';
    if (grade.startsWith('A')) return 'text-emerald-600';
    if (grade.startsWith('B')) return 'text-green-600';
    if (grade.startsWith('C')) return 'text-yellow-600';
    if (grade.startsWith('D')) return 'text-orange-600';
    return 'text-red-600';
  };

  // Generate calendar grid for heatmap
  const renderHeatmap = () => {
    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear, 11, 31);
    
    // Create a map for O(1) lookup
    const dataMap = {};
    heatmapData.forEach(d => {
      dataMap[d.date] = d;
    });

    const weeks = [];
    let currentWeek = [];
    let currentDate = new Date(startDate);
    
    // Pad first week if it doesn't start on Sunday
    for (let i = 0; i < currentDate.getDay(); i++) {
      currentWeek.push(null);
    }

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const data = dataMap[dateStr];
      
      currentWeek.push({
        date: dateStr,
        data: data
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      // Pad last week
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    return (
      <div className="flex gap-1 overflow-x-auto pb-4 custom-scrollbar">
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-1 shrink-0">
            {week.map((day, dIdx) => {
              if (!day) return <div key={dIdx} className="w-4 h-4 bg-transparent"></div>;
              
              const isSelected = selectedReport && selectedReport.date.startsWith(day.date);
              
              return (
                <button
                  key={day.date}
                  onClick={() => day.data && loadReportDetail(day.data.id)}
                  disabled={!day.data}
                  title={day.data ? `${day.date}: Grade ${day.data.grade} (${day.data.score}/100)` : day.date}
                  className={`w-4 h-4 rounded-sm border ${
                    day.data 
                      ? `${getGradeColor(day.data.grade)} hover:opacity-80 cursor-pointer` 
                      : 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-50'
                  } ${isSelected ? 'ring-2 ring-offset-1 ring-slate-800' : ''} transition-all`}
                ></button>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // Stats calculation
  const totalReports = heatmapData.length;
  const avgScore = totalReports > 0 ? Math.round(heatmapData.reduce((acc, curr) => acc + curr.score, 0) / totalReports) : 0;
  const redFlagDays = heatmapData.filter(d => d.redFlags > 0).length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50/50 w-full">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 sm:py-5 shrink-0 flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent flex items-center gap-2">
                <ClipboardCheck className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" />
                Buku Raport
              </h1>
              <button 
                onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                title={isHeaderCollapsed ? "Expand Header" : "Collapse Header"}
              >
                {isHeaderCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
              </button>
            </div>
            {!isHeaderCollapsed && <p className="text-sm text-slate-500 mt-1 animate-in fade-in slide-in-from-top-1">Jurnal analisa AI harian & mingguan</p>}
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
            <button
              onClick={() => setMainTab('crm')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                mainTab === 'crm'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              Raport CRM
            </button>
            <button
              onClick={() => setMainTab('bi')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                mainTab === 'bi'
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Raport BI Analysis
            </button>
          </div>
        </div>

        {/* CRM Controls — only shown when CRM tab is active */}
        {mainTab === 'crm' && !isHeaderCollapsed && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full animate-in fade-in slide-in-from-top-2 duration-300">
            <select 
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700 outline-none transition-all"
            >
              <option value="" disabled>Select Device</option>
              {sessions.map(s => (
                <option key={s.sessionId} value={s.sessionId}>{s.name}</option>
              ))}
            </select>

            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700 outline-none transition-all"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              onClick={() => setShowGenerateModal(true)}
              disabled={!selectedSessionId}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl font-medium transition-all shadow-sm shadow-indigo-200 hover:shadow-md w-full sm:w-auto"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Generate Raport</span>
            </button>
          </div>
        )}
      </header>

      {mainTab === 'crm' ? (
      <>
      <main className="flex-1 overflow-hidden flex flex-col lg:flex-row p-3 sm:p-4 lg:p-6 gap-4 sm:gap-6">
        
        {/* Mobile Tabs Switcher */}
        <div className="flex lg:hidden bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 gap-1">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'calendar'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CalendarIcon className="w-4.5 h-4.5" />
            Kalender & Statistik
          </button>
          <button
            onClick={() => setActiveTab('detail')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'detail'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="w-4.5 h-4.5" />
            Detail Raport
            {selectedReport && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            )}
          </button>
        </div>

        {/* LEFT PANEL: Heatmap & Stats */}
        <div className={`${activeTab === 'calendar' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/3 xl:w-[400px] flex-col gap-4 sm:gap-6 overflow-y-auto custom-scrollbar flex-1 lg:flex-none`}>
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 shrink-0">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-500" />
                Kalender Harian {selectedYear}
              </h3>
              {isLoadingHeatmap && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </div>

            <div className="mb-4 flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
               <div className="flex gap-2">
                 <button onClick={() => {setHeatmapScope('device'); setHeatmapContact('');}} className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${heatmapScope === 'device' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Semua Device</button>
                 <button onClick={() => setHeatmapScope('chat')} className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${heatmapScope === 'chat' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Chat Spesifik</button>
               </div>
               {heatmapScope === 'chat' && (
                 <div className="flex gap-2 mt-1">
                   <input list="chat-options-heatmap" type="text" placeholder="Nomor Kontak (mis. 628...)" value={heatmapContactInput} onChange={e => setHeatmapContactInput(e.target.value.replace(/[^0-9]/g, ''))} className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono" />
                   <datalist id="chat-options-heatmap">
                     {availableChats.map(c => (
                       <option key={c.id} value={c.id}>{c.name}</option>
                     ))}
                   </datalist>
                   <button onClick={() => setHeatmapContact(heatmapContactInput)} className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-200 transition-colors">Terapkan</button>
                 </div>
               )}
            </div>
            
            <div className="mb-4">
              {renderHeatmap()}
            </div>
            
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2 border-t border-slate-100 pt-3">
              <span>Kurang</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                <div className="w-3 h-3 rounded-sm bg-orange-400"></div>
                <div className="w-3 h-3 rounded-sm bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-sm bg-green-400"></div>
                <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
              </div>
              <span>Baik</span>
            </div>
          </div>

          {/* Quick Stats Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 shrink-0">
            <h3 className="font-semibold text-slate-800 mb-4">Statistik Tahunan</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                <div className="text-3xl font-bold text-slate-800 mb-1">{totalReports}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Raport</div>
              </div>
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 text-center">
                <div className="text-3xl font-bold text-indigo-600 mb-1">{avgScore}</div>
                <div className="text-xs text-indigo-500 uppercase tracking-wider font-medium">Avg Score</div>
              </div>
              <div className="bg-red-50 col-span-2 rounded-xl p-4 border border-red-100 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-red-600 mb-1">{redFlagDays}</div>
                  <div className="text-xs text-red-500 uppercase tracking-wider font-medium">Hari dgn Red Flag</div>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-200" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Report Detail */}
        <div className={`${activeTab === 'detail' ? 'flex' : 'hidden'} lg:flex flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-col relative`}>
          {isLoadingReport ? (
             <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10">
               <div className="flex flex-col items-center">
                 <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                 <p className="text-slate-600 font-medium">Memuat detail raport...</p>
               </div>
             </div>
          ) : !selectedReport ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <ClipboardCheck className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Pilih Raport</h3>
              <p className="text-slate-500 max-w-md mb-6">Klik salah satu kotak pada kalender heatmap di sebelah kiri untuk melihat detail analisa AI.</p>
              <button 
                onClick={() => setActiveTab('calendar')}
                className="lg:hidden inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm shadow-indigo-200"
              >
                <CalendarIcon className="w-4 h-4" />
                Lihat Kalender
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* Report Header Cover */}
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 text-white p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>
                
                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase">
                        {selectedReport.type === 'daily' ? 'Harian' : 'Mingguan'}
                      </span>
                      {selectedReport.scope === 'chat' && (
                        <span className="bg-blue-500/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase flex items-center gap-1">
                          <User className="w-3 h-3" /> Chat Spesifik
                        </span>
                      )}
                    </div>
                    <h2 className="text-3xl font-bold mb-2">
                      {selectedReport.scope === 'chat' ? (selectedReport.contactName || selectedReport.contactNumber) : selectedReport.session?.name}
                    </h2>
                    <p className="text-indigo-200 flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      {new Date(selectedReport.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-sm text-indigo-200 font-medium uppercase tracking-wider mb-1">Score</div>
                      <div className="text-4xl font-black">{selectedReport.overallScore}<span className="text-xl text-indigo-400">/100</span></div>
                    </div>
                    <div className="w-20 h-20 rounded-full flex items-center justify-center border-4 border-white/20 bg-white/10 backdrop-blur-md relative">
                      <span className={`text-4xl font-black ${getGradeTextColor(selectedReport.overallGrade).replace('text-', 'text-')} drop-shadow-md`}>
                        {selectedReport.overallGrade}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-8 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                <div className="flex flex-wrap gap-4 sm:gap-6 text-sm text-slate-600 font-medium">
                  <span>Pesan: <b className="text-slate-900">{selectedReport.totalMessages}</b></span>
                  {selectedReport.scope === 'device' && (
                     <span>Chats: <b className="text-slate-900">{selectedReport.totalChats}</b></span>
                  )}
                  <span>Media: <b className="text-slate-900">{selectedReport.totalMediaFiles}</b></span>
                </div>
                
                {selectedReport.pdfUrl ? (
                   <a 
                    href={`${API_URL}${selectedReport.pdfUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors w-full sm:w-auto text-center"
                  >
                    <Download className="w-4 h-4" />
                    Unduh PDF
                  </a>
                ) : (
                   <span className="text-sm text-slate-400 italic w-full sm:w-auto text-left sm:text-right">PDF tidak tersedia</span>
                )}
              </div>

              <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
                {/* Score Cards */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Detail Penilaian</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(() => {
                      try {
                        const scores = JSON.parse(selectedReport.scores);
                        return scores.map((s, idx) => (
                          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-semibold text-slate-700 text-sm">{s.category}</h4>
                              <span className={`font-bold ${getGradeTextColor(s.grade)}`}>{s.grade}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full mb-3 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${getGradeColor(s.grade).split(' ')[0]}`}
                                style={{ width: `${s.score}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">{s.description}</p>
                          </div>
                        ));
                      } catch (e) {
                        return <div className="text-sm text-red-500">Error parsing scores data</div>;
                      }
                    })()}
                  </div>
                </div>

                {/* Red Flags (Conditional) */}
                {selectedReport.redFlagCount > 0 && selectedReport.redFlags && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
                    <div className="bg-red-100/50 px-5 py-3 border-b border-red-100 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <h3 className="font-bold text-red-800">Radar Anomali & Risiko ({selectedReport.redFlagCount})</h3>
                    </div>
                    <div className="p-5 text-red-700 prose prose-sm prose-red max-w-none">
                      <ReactMarkdown>{selectedReport.redFlags}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Summary & Highlights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                      Ringkasan Eksekutif
                    </h3>
                    <div className="prose prose-sm prose-slate max-w-none">
                      <ReactMarkdown>{selectedReport.summary}</ReactMarkdown>
                    </div>
                  </div>
                  
                  {selectedReport.highlights && (
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        Highlights
                      </h3>
                      <div className="prose prose-sm prose-slate max-w-none">
                        <ReactMarkdown>{selectedReport.highlights}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>

                {/* Gallery */}
                {selectedReport.gallery && (() => {
                  try {
                    const gallery = JSON.parse(selectedReport.gallery);
                    if (gallery.length === 0) return null;
                    return (
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Galeri Bukti Visual</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {gallery.map((img, idx) => (
                            <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden group">
                              <div 
                                className="aspect-square bg-slate-100 relative cursor-pointer overflow-hidden"
                                onClick={() => setModalImage(`${API_URL}${img.mediaUrl}`)}
                              >
                                <img 
                                  src={`${API_URL}${img.mediaUrl}`} 
                                  alt="Bukti visual" 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e) => { e.target.src = 'https://placehold.co/400x400?text=Image+Not+Found' }}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                </div>
                              </div>
                              <div className="p-3">
                                {img.relatedSection && (
                                  <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded uppercase font-bold tracking-wider mb-1">
                                    {img.relatedSection}
                                  </span>
                                )}
                                <p className="text-xs text-slate-700 italic line-clamp-2" title={img.caption}>{img.caption}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  } catch (e) {
                    return null;
                  }
                })()}

              </div>
            </div>
          )}
        </div>
      </main>


      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-600" />
                Generate Buku Raport
              </h2>
              <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleGenerate} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tipe Laporan</label>
                <div className="flex gap-4">
                  <label className="flex-1 cursor-pointer">
                    <input 
                      type="radio" 
                      name="type" 
                      value="daily" 
                      checked={generateForm.type === 'daily'}
                      onChange={(e) => setGenerateForm({...generateForm, type: e.target.value})}
                      className="peer sr-only" 
                    />
                    <div className="text-center px-4 py-2 border-2 border-slate-200 rounded-xl peer-checked:border-indigo-600 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 font-medium transition-all">
                      Harian
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <input 
                      type="radio" 
                      name="type" 
                      value="weekly" 
                      checked={generateForm.type === 'weekly'}
                      onChange={(e) => setGenerateForm({...generateForm, type: e.target.value})}
                      className="peer sr-only" 
                    />
                    <div className="text-center px-4 py-2 border-2 border-slate-200 rounded-xl peer-checked:border-indigo-600 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 font-medium transition-all">
                      Mingguan
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Lingkup (Scope)</label>
                <select 
                  value={generateForm.scope}
                  onChange={(e) => setGenerateForm({...generateForm, scope: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none"
                >
                  <option value="device">Seluruh Device (Semua Chat)</option>
                  <option value="chat">Satu Chat/Kontak Spesifik</option>
                </select>
              </div>

              {generateForm.scope === 'chat' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nomor Kontak</label>
                  <input 
                    list="chat-options-generate"
                    type="text"
                    required
                    placeholder="Contoh: 62812345678"
                    value={generateForm.contactNumber}
                    onChange={(e) => setGenerateForm({...generateForm, contactNumber: e.target.value.replace(/[^0-9]/g, '')})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none font-mono"
                  />
                  <datalist id="chat-options-generate">
                     {availableChats.map(c => (
                       <option key={c.id} value={c.id}>{c.name}</option>
                     ))}
                  </datalist>
                  <p className="text-xs text-slate-500 mt-1">Hanya angka dengan kode negara (tanpa +)</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal</label>
                <input 
                  type="date" 
                  required
                  value={generateForm.date}
                  onChange={(e) => setGenerateForm({...generateForm, date: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none"
                />
              </div>

              <button 
                type="submit"
                disabled={isGenerating}
                className="w-full mt-4 bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isGenerating ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Menganalisa via AI...</>
                ) : (
                  'Mulai Analisa & Generate'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {modalImage && (
        <div 
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setModalImage(null)}
        >
          <img 
            src={modalImage} 
            alt="Enlarged" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" 
          />
          <button className="absolute top-6 right-6 text-white/50 hover:text-white bg-black/50 rounded-full p-2">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      </>
      ) : (
        <BIRaportTab isHeaderCollapsed={isHeaderCollapsed} />
      )}

    </div>
  );
}
