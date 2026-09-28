import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { BarChart3, Calendar as CalendarIcon, Download, RefreshCw, Loader2, AlertTriangle, CheckCircle2, X, TrendingUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function BIRaportTab({ isHeaderCollapsed }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - i);

  const [activeTab, setActiveTab] = useState('calendar');

  // Heatmap
  const [heatmapData, setHeatmapData] = useState([]);
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);
  const [heatmapScope, setHeatmapScope] = useState('all');
  const [heatmapScopeFilter, setHeatmapScopeFilter] = useState('');

  // Report Detail
  const [selectedReport, setSelectedReport] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // Generate Modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    type: 'daily',
    scope: 'all',
    date: new Date().toISOString().split('T')[0],
    scopeFilter: ''
  });

  // Scope filter data
  const [salesmenList, setSalesmenList] = useState([]);
  const [customersList, setCustomersList] = useState([]);

  useEffect(() => {
    fetchHeatmap();
    fetchScopeData();
  }, []);

  useEffect(() => {
    fetchHeatmap();
    setSelectedReport(null);
  }, [selectedYear, heatmapScope, heatmapScopeFilter]);

  const fetchScopeData = async () => {
    try {
      const [salesRes, custRes] = await Promise.all([
        axios.get(`${API_URL}/api/bi-raport/salesmen`),
        axios.get(`${API_URL}/api/bi-raport/customers`)
      ]);
      setSalesmenList(salesRes.data);
      setCustomersList(custRes.data);
    } catch (err) {
      console.error('Failed to fetch scope data', err);
    }
  };

  const fetchHeatmap = async () => {
    setIsLoadingHeatmap(true);
    try {
      let url = `${API_URL}/api/bi-raport/heatmap?year=${selectedYear}&type=daily&scope=${heatmapScope}`;
      if (heatmapScope !== 'all' && heatmapScopeFilter) {
        url += `&scopeFilter=${heatmapScopeFilter}`;
      }
      const res = await axios.get(url);
      setHeatmapData(res.data);
    } catch (err) {
      console.error('Failed to fetch BI heatmap', err);
    } finally {
      setIsLoadingHeatmap(false);
    }
  };

  const loadReportDetail = async (id) => {
    setIsLoadingReport(true);
    try {
      const res = await axios.get(`${API_URL}/api/bi-raport/${id}`);
      setSelectedReport(res.data);
      setActiveTab('detail');
    } catch (err) {
      console.error('Failed to load BI report detail', err);
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await axios.post(`${API_URL}/api/bi-raport/generate`, {
        type: generateForm.type,
        scope: generateForm.scope,
        date: generateForm.date,
        scopeFilter: generateForm.scope !== 'all' ? generateForm.scopeFilter : null
      });
      setShowGenerateModal(false);
      fetchHeatmap();
      setSelectedReport(res.data);
      setActiveTab('detail');
    } catch (err) {
      console.error('Failed to generate BI report', err);
      alert(err.response?.data?.error || 'Failed to generate BI report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getGradeColor = (grade) => {
    if (!grade) return 'bg-slate-100 border-slate-200';
    if (grade.startsWith('A')) return 'bg-teal-500 border-teal-600';
    if (grade.startsWith('B')) return 'bg-cyan-400 border-cyan-500';
    if (grade.startsWith('C')) return 'bg-amber-400 border-amber-500';
    if (grade.startsWith('D')) return 'bg-orange-400 border-orange-500';
    return 'bg-red-500 border-red-600';
  };

  const getGradeTextColor = (grade) => {
    if (!grade) return 'text-slate-400';
    if (grade.startsWith('A')) return 'text-teal-600';
    if (grade.startsWith('B')) return 'text-cyan-600';
    if (grade.startsWith('C')) return 'text-amber-600';
    if (grade.startsWith('D')) return 'text-orange-600';
    return 'text-red-600';
  };

  const getGradeBgColor = (grade) => {
    if (!grade) return 'bg-slate-50';
    if (grade.startsWith('A')) return 'bg-teal-500';
    if (grade.startsWith('B')) return 'bg-cyan-500';
    if (grade.startsWith('C')) return 'bg-amber-500';
    if (grade.startsWith('D')) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const fmtCurrency = (v) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`;

  // Calendar Heatmap
  const renderHeatmap = () => {
    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear, 11, 31);
    const dataMap = {};
    heatmapData.forEach(d => { dataMap[d.date] = d; });

    const weeks = [];
    let currentWeek = [];
    let currentDate = new Date(startDate);
    for (let i = 0; i < currentDate.getDay(); i++) currentWeek.push(null);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      currentWeek.push({ date: dateStr, data: dataMap[dateStr] });
      if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }

    return (
      <div className="flex gap-1 overflow-x-auto pb-4 custom-scrollbar">
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-1 shrink-0">
            {week.map((day, dIdx) => {
              if (!day) return <div key={dIdx} className="w-4 h-4 bg-transparent"></div>;
              const isSelected = selectedReport && selectedReport.date?.startsWith(day.date);
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

  // Stats
  const totalReports = heatmapData.length;
  const avgScore = totalReports > 0 ? Math.round(heatmapData.reduce((acc, curr) => acc + curr.score, 0) / totalReports) : 0;
  const redFlagDays = heatmapData.filter(d => d.redFlags > 0).length;

  return (
    <>
      {/* BI Controls Sub-header */}
      {!isHeaderCollapsed && (
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 shrink-0 animate-in fade-in slide-in-from-top-2 duration-300">
          <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-medium text-slate-700 outline-none transition-all"
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-xl font-medium transition-all shadow-sm shadow-teal-200 hover:shadow-md w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Generate Raport BI</span>
        </button>
      </div>
      )}

      <main className="flex-1 overflow-hidden flex flex-col lg:flex-row p-3 sm:p-4 lg:p-6 gap-4 sm:gap-6">
        {/* Mobile Tabs Switcher */}
        <div className="flex lg:hidden bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 gap-1">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'calendar'
                ? 'bg-white text-teal-600 shadow-sm'
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
                ? 'bg-white text-teal-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4.5 h-4.5" />
            Detail Raport
            {selectedReport && (
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
            )}
          </button>
        </div>

        {/* Left Panel: Heatmap & Stats */}
        <div className={`${activeTab === 'calendar' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/3 xl:w-[400px] flex-col gap-4 sm:gap-6 overflow-y-auto custom-scrollbar flex-1 lg:flex-none`}>

          {/* Heatmap Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 shrink-0">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-teal-500" />
                Kalender BI {selectedYear}
              </h3>
              {isLoadingHeatmap && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </div>

            {/* Scope Filter */}
            <div className="mb-4 flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex gap-2">
                <button onClick={() => { setHeatmapScope('all'); setHeatmapScopeFilter(''); }} className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${heatmapScope === 'all' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Semua</button>
                <button onClick={() => setHeatmapScope('salesman')} className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${heatmapScope === 'salesman' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Salesman</button>
                <button onClick={() => setHeatmapScope('customer')} className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${heatmapScope === 'customer' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Customer</button>
              </div>
              {heatmapScope === 'salesman' && (
                <select value={heatmapScopeFilter} onChange={e => setHeatmapScopeFilter(e.target.value)} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500">
                  <option value="">-- Pilih Salesman --</option>
                  {salesmenList.map(s => <option key={s.kdsls} value={s.kdsls}>{s.nmsls} ({s.kdsls})</option>)}
                </select>
              )}
              {heatmapScope === 'customer' && (
                <select value={heatmapScopeFilter} onChange={e => setHeatmapScopeFilter(e.target.value)} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500">
                  <option value="">-- Pilih Customer --</option>
                  {customersList.map(c => <option key={c.kdcust} value={c.kdcust}>{c.nmcust} ({c.kdcust})</option>)}
                </select>
              )}
            </div>

            <div className="mb-4">{renderHeatmap()}</div>

            <div className="flex items-center justify-between text-xs text-slate-500 mt-2 border-t border-slate-100 pt-3">
              <span>Kurang</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                <div className="w-3 h-3 rounded-sm bg-orange-400"></div>
                <div className="w-3 h-3 rounded-sm bg-amber-400"></div>
                <div className="w-3 h-3 rounded-sm bg-cyan-400"></div>
                <div className="w-3 h-3 rounded-sm bg-teal-500"></div>
              </div>
              <span>Baik</span>
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 shrink-0">
            <h3 className="font-semibold text-slate-800 mb-4">Statistik BI Tahunan</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-center">
                <div className="text-3xl font-bold text-slate-800 mb-1">{totalReports}</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">Total Raport</div>
              </div>
              <div className="bg-teal-50 rounded-xl p-4 border border-teal-100 text-center">
                <div className="text-3xl font-bold text-teal-600 mb-1">{avgScore}</div>
                <div className="text-xs text-teal-500 uppercase tracking-wider font-medium">Avg Score</div>
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

        {/* Right Panel: Report Detail */}
        <div className={`${activeTab === 'detail' ? 'flex' : 'hidden'} lg:flex flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-col relative`}>
          {isLoadingReport ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10">
              <div className="flex flex-col items-center">
                <Loader2 className="w-10 h-10 text-teal-600 animate-spin mb-4" />
                <p className="text-slate-600 font-medium">Memuat detail raport BI...</p>
              </div>
            </div>
          ) : !selectedReport ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mb-4">
                <BarChart3 className="w-10 h-10 text-teal-300" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">Pilih Raport BI</h3>
              <p className="text-slate-500 max-w-md mb-6">Klik salah satu kotak pada kalender heatmap di sebelah kiri untuk melihat detail analisa BI.</p>
              <button
                onClick={() => setActiveTab('calendar')}
                className="lg:hidden inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm shadow-teal-200"
              >
                <CalendarIcon className="w-4 h-4" />
                Lihat Kalender
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* Report Header */}
              <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-teal-900 text-white p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>

                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase">
                        {selectedReport.type === 'daily' ? 'Harian' : selectedReport.type === 'weekly' ? 'Mingguan' : 'Bulanan'}
                      </span>
                      <span className="bg-teal-500/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" /> BI Analysis
                      </span>
                      {selectedReport.scope !== 'all' && (
                        <span className="bg-cyan-500/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase">
                          {selectedReport.scope === 'salesman' ? 'Salesman' : 'Customer'}
                        </span>
                      )}
                    </div>
                    <h2 className="text-3xl font-bold mb-2">
                      {selectedReport.scope === 'all' ? 'Overview Bisnis' : (selectedReport.scopeName || selectedReport.scopeFilter)}
                    </h2>
                    <p className="text-teal-200 flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      {new Date(selectedReport.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-sm text-teal-200 font-medium uppercase tracking-wider mb-1">Score</div>
                      <div className="text-4xl font-black">{selectedReport.overallScore}<span className="text-xl text-teal-400">/100</span></div>
                    </div>
                    <div className="w-20 h-20 rounded-full flex items-center justify-center border-4 border-white/20 bg-white/10 backdrop-blur-md">
                      <span className="text-4xl font-black drop-shadow-md text-white">{selectedReport.overallGrade}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* BI Stats Bar */}
              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-slate-200 px-4 sm:px-8 py-4 shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">Total AR</div>
                    <div className="text-sm font-bold text-slate-800">{fmtCurrency(selectedReport.totalAR)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">Sisa Piutang</div>
                    <div className="text-sm font-bold text-teal-700">{fmtCurrency(selectedReport.totalBalance)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">Faktur</div>
                    <div className="text-sm font-bold text-slate-800">{selectedReport.totalInvoices}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1">Customer</div>
                    <div className="text-sm font-bold text-slate-800">{selectedReport.totalCustomers}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-red-500 uppercase tracking-wider font-medium mb-1">Overdue</div>
                    <div className="text-sm font-bold text-red-600">{selectedReport.overdueCount}</div>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-8 py-3 flex justify-end shrink-0">
                {selectedReport.pdfUrl ? (
                  <a
                    href={`${API_URL}${selectedReport.pdfUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-sm font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 px-4 py-2 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Unduh PDF
                  </a>
                ) : (
                  <span className="text-sm text-slate-400 italic">PDF tidak tersedia</span>
                )}
              </div>

              <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
                {/* Score Cards */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Detail Penilaian BI</h3>
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
                                className={`h-full rounded-full ${getGradeBgColor(s.grade)}`}
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

                {/* Red Flags */}
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
                      <TrendingUp className="w-5 h-5 text-teal-500" />
                      Ringkasan Eksekutif
                    </h3>
                    <div className="prose prose-sm prose-slate max-w-none">
                      <ReactMarkdown>{selectedReport.summary}</ReactMarkdown>
                    </div>
                  </div>

                  {selectedReport.highlights && (
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-teal-500" />
                        Highlights
                      </h3>
                      <div className="prose prose-sm prose-slate max-w-none">
                        <ReactMarkdown>{selectedReport.highlights}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-teal-50/50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-teal-600" />
                Generate Raport BI
              </h2>
              <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerate} className="p-6 space-y-5">
              {/* Type */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tipe Laporan</label>
                <div className="flex gap-3">
                  {['daily', 'weekly', 'monthly'].map(t => (
                    <label key={t} className="flex-1 cursor-pointer">
                      <input type="radio" name="bitype" value={t} checked={generateForm.type === t}
                        onChange={e => setGenerateForm({...generateForm, type: e.target.value})}
                        className="peer sr-only" />
                      <div className="text-center px-3 py-2 border-2 border-slate-200 rounded-xl peer-checked:border-teal-600 peer-checked:bg-teal-50 peer-checked:text-teal-700 font-medium transition-all text-sm">
                        {t === 'daily' ? 'Harian' : t === 'weekly' ? 'Mingguan' : 'Bulanan'}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Scope */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Lingkup (Scope)</label>
                <select
                  value={generateForm.scope}
                  onChange={e => setGenerateForm({...generateForm, scope: e.target.value, scopeFilter: ''})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 outline-none"
                >
                  <option value="all">Keseluruhan Bisnis</option>
                  <option value="salesman">Per Salesman</option>
                  <option value="customer">Per Customer</option>
                </select>
              </div>

              {/* Scope filter */}
              {generateForm.scope === 'salesman' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pilih Salesman</label>
                  <select
                    required
                    value={generateForm.scopeFilter}
                    onChange={e => setGenerateForm({...generateForm, scopeFilter: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 outline-none"
                  >
                    <option value="">-- Pilih Salesman --</option>
                    {salesmenList.map(s => <option key={s.kdsls} value={s.kdsls}>{s.nmsls} ({s.kdsls})</option>)}
                  </select>
                </div>
              )}
              {generateForm.scope === 'customer' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Pilih Customer</label>
                  <select
                    required
                    value={generateForm.scopeFilter}
                    onChange={e => setGenerateForm({...generateForm, scopeFilter: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 outline-none"
                  >
                    <option value="">-- Pilih Customer --</option>
                    {customersList.map(c => <option key={c.kdcust} value={c.kdcust}>{c.nmcust} ({c.kdcust})</option>)}
                  </select>
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal</label>
                <input
                  type="date"
                  required
                  value={generateForm.date}
                  onChange={e => setGenerateForm({...generateForm, date: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full mt-4 bg-teal-600 text-white font-semibold py-3 rounded-xl hover:bg-teal-700 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isGenerating ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Menganalisa data BI via AI...</>
                ) : (
                  'Mulai Analisa & Generate'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
