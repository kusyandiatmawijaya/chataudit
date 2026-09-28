import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { CalendarClock, Plus, Trash2, Power, PowerOff, FileText, Smartphone, MessageSquareText, Save, X, Loader2, Pencil, Play } from 'lucide-react';

export default function ScheduledReports() {
  const [schedules, setSchedules] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [senderDevices, setSenderDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    prompt: '',
    period: 'today',
    sessionId: '',
    senderSessionId: '',
    exportFormat: 'pdf',
    targetWaNumber: '',
    targetEmail: '',
    scheduleTime: '10:00',
    scope: 'device',
    targetChat: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchSchedules();
    fetchSessions();
    fetchSenderDevices();
  }, []);

  const fetchSchedules = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/report-schedules`);
      setSchedules(res.data);
    } catch (err) {
      console.error('Failed to fetch schedules', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sessions`);
      setSessions(res.data.filter(s => s.status === 'ready'));
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    }
  };

  const fetchSenderDevices = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/settings/sender-devices/list`);
      setSenderDevices(res.data);
    } catch (err) {
      console.error('Failed to fetch sender devices', err);
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      await axios.patch(`${API_URL}/api/report-schedules/${id}`, { isActive: !currentStatus });
      fetchSchedules();
    } catch (err) {
      console.error('Failed to toggle status', err);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this schedule?')) {
      try {
        await axios.delete(`${API_URL}/api/report-schedules/${id}`);
        fetchSchedules();
      } catch (err) {
        console.error('Failed to delete schedule', err);
      }
    }
  };

  const [runningId, setRunningId] = useState(null);

  const handleRunNow = async (id) => {
    setRunningId(id);
    try {
      const res = await axios.post(`${API_URL}/api/report-schedules/${id}/run-now`);
      if (res.data && res.data.success === false && res.data.reason === 'no_messages') {
        alert('Tidak ada percakapan pada periode yang dipilih untuk device ini. Analisa dibatalkan.');
      } else {
        alert('Analisa Sedang Berjalan! Hasilnya akan dikirim ke WhatsApp/Telegram dalam beberapa saat lagi.');
      }
    } catch (err) {
      console.error('Failed to run schedule now', err);
      alert('Gagal menjalankan Analisa Sekarang. Pastikan device terhubung.');
    } finally {
      setRunningId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await axios.put(`${API_URL}/api/report-schedules/${editingId}`, formData);
      } else {
        await axios.post(`${API_URL}/api/report-schedules`, formData);
      }
      setShowAddModal(false);
      setEditingId(null);
      setFormData({
        name: '',
        prompt: '',
        period: 'today',
        sessionId: sessions.length > 0 ? sessions[0].sessionId : '',
        senderSessionId: senderDevices.length > 0 ? senderDevices[0].id : '',
        exportFormat: 'pdf',
        targetWaNumber: '',
        targetEmail: '',
        scheduleTime: '10:00',
        scope: 'device',
        targetChat: ''
      });
      fetchSchedules();
    } catch (err) {
      console.error('Failed to save schedule', err);
      alert('Failed to save schedule. Please check all fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (schedule) => {
    setFormData({
      name: schedule.name || '',
      prompt: schedule.prompt,
      period: schedule.period,
      sessionId: schedule.sessionId,
      senderSessionId: schedule.senderSessionId || schedule.sessionId,
      exportFormat: schedule.exportFormat,
      targetWaNumber: schedule.targetWaNumber,
      targetEmail: schedule.targetEmail || '',
      scheduleTime: schedule.scheduleTime,
      scope: schedule.scope || 'device',
      targetChat: schedule.targetChat || ''
    });
    setEditingId(schedule.id);
    setShowAddModal(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 sm:py-5 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Scheduled AI Reports</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Automate your chat summaries and send them via WhatsApp</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              name: '',
              prompt: '',
              period: 'today',
              sessionId: sessions.length > 0 ? sessions[0].sessionId : '',
              senderSessionId: senderDevices.length > 0 ? senderDevices[0].id : '',
              exportFormat: 'pdf',
              targetWaNumber: '',
              targetEmail: '',
              scheduleTime: '10:00',
              scope: 'device',
              targetChat: ''
            });
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-indigo-200 hover:shadow-md hover:-translate-y-0.5 w-full sm:w-auto text-sm sm:text-base"
        >
          <Plus className="w-5 h-5" />
          Create Schedule
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-12 sm:py-20 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarClock className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-800 mb-2">No Schedules Yet</h3>
              <p className="text-xs sm:text-sm text-slate-500 mb-6 max-w-md mx-auto">Create your first automated report schedule to get regular AI summaries delivered straight to WhatsApp.</p>
              <button
                onClick={() => {
                  setEditingId(null);
                  setFormData({
                    name: '',
                    prompt: '',
                    period: 'today',
                    sessionId: sessions.length > 0 ? sessions[0].sessionId : '',
                    senderSessionId: senderDevices.length > 0 ? senderDevices[0].id : '',
                    exportFormat: 'pdf',
                    targetWaNumber: '',
                    targetEmail: '',
                    scheduleTime: '10:00',
                    scope: 'device',
                    targetChat: ''
                  });
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                Create Schedule
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {schedules.map((schedule) => (
                <div key={schedule.id} className={`bg-white rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md flex flex-col ${schedule.isActive ? 'border-indigo-100' : 'border-slate-200 opacity-75'}`}>
                  <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col gap-3 sm:gap-4 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${schedule.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {schedule.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <CalendarClock className="w-3.5 h-3.5" />
                            {schedule.scheduleTime}
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-900 line-clamp-1 text-sm sm:text-base" title={schedule.name}>
                          {schedule.name || 'Laporan AI'}
                        </h3>
                      </div>
                    </div>
                    
                    <p className="text-xs sm:text-sm text-slate-500 line-clamp-3 flex-1" title={schedule.prompt}>
                      {schedule.prompt}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-2.5 border-t border-slate-50 shrink-0">
                      <button 
                        onClick={() => handleToggleActive(schedule.id, schedule.isActive)}
                        className={`flex-1 justify-center flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-colors ${schedule.isActive ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                        title={schedule.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {schedule.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        <span>{schedule.isActive ? 'Deactivate' : 'Activate'}</span>
                      </button>
                      <button 
                        onClick={() => handleRunNow(schedule.id)}
                        disabled={runningId === schedule.id}
                        className={`flex-1 justify-center flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-lg text-xs font-semibold transition-colors ${runningId === schedule.id ? 'bg-indigo-100 text-indigo-400 cursor-not-allowed' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                        title="Run Now"
                      >
                        {runningId === schedule.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        <span>Run Now</span>
                      </button>
                      <button 
                        onClick={() => handleEditClick(schedule)}
                        className="p-1.5 sm:p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(schedule.id)}
                        className="p-1.5 sm:p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5 space-y-2 sm:space-y-3 bg-slate-50/50 rounded-b-2xl shrink-0 border-t border-slate-100">
                    <div className="flex items-center text-xs sm:text-sm text-slate-600">
                      <Smartphone className="w-4 h-4 mr-2.5 text-slate-400 shrink-0" />
                      <span className="truncate flex-1">Source: <span className="font-medium text-slate-800">{schedule.session?.name || schedule.sessionId}</span></span>
                    </div>
                    <div className="flex items-center text-xs sm:text-sm text-slate-600">
                      <MessageSquareText className="w-4 h-4 mr-2.5 text-slate-400 shrink-0" />
                      <span className="truncate flex-1">Sender: <span className="font-medium text-slate-800">{schedule.senderSessionId || schedule.sessionId}</span></span>
                    </div>
                    <div className="flex items-center text-xs sm:text-sm text-slate-600">
                      <MessageSquareText className="w-4 h-4 mr-2.5 text-slate-400 shrink-0" />
                      <span className="truncate flex-1">Send to: <span className="font-medium text-slate-800">{schedule.targetWaNumber}</span></span>
                    </div>
                    <div className="flex justify-between items-center text-xs sm:text-sm text-slate-600 pt-2.5 mt-2.5 border-t border-slate-200">
                      <span className="capitalize text-slate-500">{schedule.period.replace(/_/g, ' ')}</span>
                      <span className="inline-flex items-center px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        <FileText className="w-3 h-3 mr-1" />
                        {schedule.exportFormat}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-indigo-600" />
                {editingId ? 'Edit Scheduled Report' : 'New Scheduled Report'}
              </h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-4 sm:p-6 flex-1">
              <form id="scheduleForm" onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Report Name</label>
                  <input 
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Ringkasan Harian CS"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium text-sm sm:text-base"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Prompt / Instruction</label>
                  <textarea 
                    required
                    value={formData.prompt}
                    onChange={(e) => setFormData({...formData, prompt: e.target.value})}
                    placeholder="e.g. Buatkan ringkasan laporan dari chat, sertakan keluhan pelanggan utama..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none min-h-[90px] sm:min-h-[100px] text-sm sm:text-base"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Date Period</label>
                    <select 
                      value={formData.period}
                      onChange={(e) => setFormData({...formData, period: e.target.value})}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm sm:text-base bg-white"
                    >
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="last_2_days">Last 2 Days</option>
                      <option value="last_7_days">Last 7 Days</option>
                      <option value="last_30_days">Last 30 Days</option>
                      <option value="last_month">Last Month</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Time to Send</label>
                    <input 
                      type="time" 
                      required
                      value={formData.scheduleTime}
                      onChange={(e) => setFormData({...formData, scheduleTime: e.target.value})}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm sm:text-base"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Device (Source Chats)</label>
                    <select 
                      required
                      value={formData.sessionId}
                      onChange={(e) => setFormData({...formData, sessionId: e.target.value})}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white text-sm sm:text-base"
                    >
                      <option value="" disabled>Select a device</option>
                      {sessions.map(session => (
                        <option key={session.sessionId} value={session.sessionId}>
                          {session.name} ({session.sessionId})
                        </option>
                      ))}
                    </select>
                    {sessions.length === 0 && (
                      <p className="text-[10px] sm:text-xs text-red-500 mt-1">No active devices available.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Device (Pengirim Laporan)</label>
                    <select 
                      required
                      value={formData.senderSessionId}
                      onChange={(e) => setFormData({...formData, senderSessionId: e.target.value})}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white text-sm sm:text-base"
                    >
                      <option value="" disabled>Select a sender device</option>
                      {senderDevices.map(device => (
                        <option key={device.id} value={device.id}>
                          {device.name} ({device.type})
                        </option>
                      ))}
                    </select>
                    {senderDevices.length === 0 && (
                      <p className="text-[10px] sm:text-xs text-red-500 mt-1">No active sender devices available.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Export Format</label>
                    <select 
                      value={formData.exportFormat}
                      onChange={(e) => setFormData({...formData, exportFormat: e.target.value})}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all bg-white text-sm sm:text-base"
                    >
                      <option value="pdf">PDF Document</option>
                      <option value="excel">Excel (Tabular)</option>
                      <option value="image">Image (PNG)</option>
                      <option value="text">Direct Text Message (Markdown)</option>
                      <option value="database_payment">Save to Database (Payment JSON)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Data Scope</label>
                    <select 
                      value={formData.scope}
                      onChange={(e) => setFormData({...formData, scope: e.target.value})}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm sm:text-base bg-white"
                    >
                      <option value="device">All Chats in Device</option>
                      <option value="chat">Specific Chat/Group</option>
                    </select>
                  </div>

                  {formData.scope === 'chat' && (
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Target Chat ID / Number</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. 628111 or 12345@g.us"
                        value={formData.targetChat}
                        onChange={(e) => setFormData({...formData, targetChat: e.target.value})}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono text-sm sm:text-base"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Target WhatsApp/Telegram ID {formData.exportFormat !== 'database_payment' ? '(Penerima Report)' : '(Opsional)'}</label>
                    <input 
                      type="text" 
                      required={formData.exportFormat !== 'database_payment'}
                      placeholder="e.g. 628111,628222 or -100123"
                      value={formData.targetWaNumber}
                      onChange={(e) => setFormData({...formData, targetWaNumber: e.target.value.replace(/[^0-9,\-]/g, '')})}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono text-sm sm:text-base"
                    />
                    <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5">Include country code. Use commas to separate multiple numbers.</p>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1">Target Email (Opsional)</label>
                    <input 
                      type="email" 
                      placeholder="e.g. user@example.com"
                      value={formData.targetEmail}
                      onChange={(e) => setFormData({...formData, targetEmail: e.target.value})}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-mono text-sm sm:text-base"
                    />
                    <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5">Masukkan email untuk menerima report via email.</p>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button 
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-200 transition-colors text-xs sm:text-sm"
              >
                Cancel
              </button>
              <button 
                type="submit"
                form="scheduleForm"
                disabled={isSubmitting || sessions.length === 0}
                className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-200 text-xs sm:text-sm"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Save className="w-4 h-4 sm:w-5 sm:h-5" />}
                {isSubmitting ? 'Saving...' : editingId ? 'Update Schedule' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
