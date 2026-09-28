import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import {
  Database, HardDriveDownload, Trash2, Plus, Power, PowerOff, Play, RotateCcw,
  Loader2, X, Clock, Calendar, Archive, Download, History, CheckCircle2, XCircle
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export function BackupRestoreTab() {
  const [backupSchedules, setBackupSchedules] = useState([]);
  const [backupLogs, setBackupLogs] = useState([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isRunningBackup, setIsRunningBackup] = useState(false);
  const [isRestoringId, setIsRestoringId] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    frequency: 'daily',
    backupTime: '02:00',
    retentionDays: 30
  });
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

  useEffect(() => {
    fetchBackupSchedules();
    fetchBackupLogs();
  }, []);

  const fetchBackupSchedules = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/backup/schedules`);
      if (Array.isArray(res.data)) {
        setBackupSchedules(res.data);
      } else {
        setBackupSchedules([]);
      }
    } catch (err) {
      console.error('Failed to fetch backup schedules', err);
    } finally {
      setIsLoadingSchedules(false);
    }
  };

  const fetchBackupLogs = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/backup/logs`);
      if (Array.isArray(res.data)) {
        setBackupLogs(res.data);
      } else {
        setBackupLogs([]);
      }
    } catch (err) {
      console.error('Failed to fetch backup logs', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    setIsSubmittingSchedule(true);
    try {
      await axios.post(`${API_URL}/api/backup/schedules`, scheduleForm);
      setShowScheduleModal(false);
      setScheduleForm({ frequency: 'daily', backupTime: '02:00', retentionDays: 30 });
      fetchBackupSchedules();
    } catch (err) {
      console.error('Failed to create schedule', err);
      alert('Failed to create backup schedule');
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  const handleToggleSchedule = async (id, currentStatus) => {
    try {
      await axios.patch(`${API_URL}/api/backup/schedules/${id}`, { isActive: !currentStatus });
      fetchBackupSchedules();
    } catch (err) {
      console.error('Failed to toggle schedule', err);
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (confirm('Hapus jadwal backup ini?')) {
      try {
        await axios.delete(`${API_URL}/api/backup/schedules/${id}`);
        fetchBackupSchedules();
      } catch (err) {
        console.error('Failed to delete schedule', err);
      }
    }
  };

  const handleRunBackupNow = async () => {
    setIsRunningBackup(true);
    try {
      const res = await axios.post(`${API_URL}/api/backup/run-now`);
      if (res.data.success) {
        alert('Backup berhasil dibuat!');
        fetchBackupLogs();
      }
    } catch (err) {
      console.error('Backup failed', err);
      alert('Backup gagal: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsRunningBackup(false);
    }
  };

  const handleDownloadBackup = (logId) => {
    const token = localStorage.getItem('token');
    window.open(`${API_URL}/api/backup/download/${logId}?token=${token}`, '_blank');
  };

  const handleDeleteLog = async (id) => {
    if (confirm('Hapus backup ini?')) {
      try {
        await axios.delete(`${API_URL}/api/backup/logs/${id}`);
        fetchBackupLogs();
      } catch (err) {
        console.error('Failed to delete backup log', err);
      }
    }
  };

  const handleRestore = async (id, filename) => {
    if (!confirm(`⚠️ PERINGATAN: Restore database dari "${filename}"?\n\nSemua data saat ini akan ditimpa dengan data dari backup ini. Pastikan Anda sudah membuat backup terbaru sebelum melanjutkan.\n\nLanjutkan?`)) {
      return;
    }
    setIsRestoringId(id);
    try {
      const res = await axios.post(`${API_URL}/api/backup/restore/${id}`);
      if (res.data.success) {
        alert('✅ Database berhasil di-restore! Halaman akan dimuat ulang.');
        window.location.reload();
      }
    } catch (err) {
      console.error('Restore failed', err);
      alert('Restore gagal: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsRestoringId(null);
    }
  };

  const formatFileSize = (bytes) => {
    const num = Number(bytes);
    if (num === 0) return '0 B';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const typeLabels = { scheduled: 'Terjadwal', manual: 'Manual', pre_writeoff: 'Pre Write-Off' };
  const typeColors = {
    scheduled: 'bg-blue-100 text-blue-700',
    manual: 'bg-emerald-100 text-emerald-700',
    pre_writeoff: 'bg-amber-100 text-amber-700'
  };

  const safeBackupLogs = Array.isArray(backupLogs) ? backupLogs : [];
  const safeBackupSchedules = Array.isArray(backupSchedules) ? backupSchedules : [];
  
  const successBackups = safeBackupLogs.filter(log => log.status === 'success');
  const sortedSuccessBackups = [...successBackups].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const totalBackupsCount = sortedSuccessBackups.length;
  const activeSchedulesCount = safeBackupSchedules.filter(s => s.isActive).length;
  const latestSuccessBackup = sortedSuccessBackups[0];
  const latestBackupSize = latestSuccessBackup ? formatFileSize(latestSuccessBackup.fileSize) : '0 B';
  const latestBackupTime = latestSuccessBackup ? formatDate(latestSuccessBackup.createdAt) : 'Belum ada backup';

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex items-center gap-5 transition-all duration-300 hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Backup Sukses</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{totalBackupsCount}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Dumps database aman</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex items-center gap-5 transition-all duration-300 hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Jadwal Backup Aktif</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              {activeSchedulesCount} <span className="text-sm font-normal text-slate-400">/ {safeBackupSchedules.length}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Auto-backup terdaftar</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex items-center gap-5 transition-all duration-300 hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <HardDriveDownload className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-500">Backup Terakhir</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1 truncate" title={latestBackupSize}>{latestBackupSize}</h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate" title={latestBackupTime}>{latestBackupTime}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-50 border border-slate-200/60 p-4 rounded-2xl shrink-0">
        <div className="text-sm text-slate-500 mb-2 sm:mb-0">
          <span className="font-semibold text-slate-700">Kontrol Backup:</span> Kelola jadwal otomatis atau trigger backup instan.
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-indigo-200 hover:shadow-md hover:-translate-y-0.5 w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Buat Jadwal Backup
          </button>
          <button
            onClick={handleRunBackupNow}
            disabled={isRunningBackup}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-emerald-200 hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            {isRunningBackup ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            {isRunningBackup ? 'Memproses...' : 'Backup Sekarang'}
          </button>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" />
          Jadwal Backup Otomatis
        </h2>
        {isLoadingSchedules ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : safeBackupSchedules.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-700 mb-1">Belum ada jadwal backup</h3>
            <p className="text-sm text-slate-500">Buat jadwal backup otomatis untuk mengamankan data Anda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {safeBackupSchedules.map((s) => (
              <div key={s.id} className={`bg-white rounded-2xl border p-6 transition-all duration-300 shadow-sm hover:shadow-md hover:border-slate-300 ${s.isActive ? 'border-indigo-200 shadow-indigo-50/50' : 'border-slate-200 opacity-75'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {s.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleToggleSchedule(s.id, s.isActive)}
                      className={`p-1.5 rounded-lg transition-colors ${s.isActive ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                      title={s.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    >
                      {s.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(s.id)}
                      className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold">{s.backupTime} WIB</span>
                    <span className="text-slate-400">•</span>
                    <span className="capitalize text-slate-600">{s.frequency === 'daily' ? 'Setiap Hari' : s.frequency === 'weekly' ? 'Setiap Minggu' : 'Setiap Bulan'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Archive className="w-4 h-4 text-slate-400" />
                    <span>Retensi: {s.retentionDays} hari</span>
                  </div>
                  {s.lastRunAt && (
                    <div className="text-xs text-slate-400 pt-1 border-t border-slate-100 mt-2">
                      Terakhir: {formatDate(s.lastRunAt)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-500" />
          Riwayat Backup
        </h2>
        {isLoadingLogs ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : safeBackupLogs.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <HardDriveDownload className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-700 mb-1">Belum ada riwayat backup</h3>
            <p className="text-sm text-slate-500">Jalankan backup pertama Anda untuk melihat riwayat di sini.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="text-left px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Status</th>
                    <th className="text-left px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Tanggal</th>
                    <th className="text-left px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Tipe</th>
                    <th className="text-left px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">File</th>
                    <th className="text-left px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Ukuran</th>
                    <th className="text-right px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {backupLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors duration-250">
                      <td className="px-6 py-4">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/40">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            Sukses
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/40" title={log.errorMessage || ''}>
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                            Gagal
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-700 font-medium">{formatDate(log.createdAt)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${typeColors[log.type] || 'bg-slate-100 text-slate-600'}`}>
                          {typeLabels[log.type] || log.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs bg-slate-50 border border-slate-200/60 px-2.5 py-1.5 rounded-lg text-slate-600 inline-block max-w-[280px] truncate" title={log.filename}>
                          {log.filename}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{formatFileSize(log.fileSize)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {log.status === 'success' && (
                            <>
                              <button
                                onClick={() => handleDownloadBackup(log.id)}
                                className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-all hover:scale-105 active:scale-95"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRestore(log.id, log.filename)}
                                disabled={isRestoringId === log.id}
                                className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl transition-all disabled:opacity-50 hover:scale-105 active:scale-95"
                                title="Restore dari backup ini"
                              >
                                {isRestoringId === log.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all hover:scale-105 active:scale-95"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="block sm:hidden divide-y divide-slate-100">
              {backupLogs.map((log) => (
                <div key={log.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex justify-between items-center gap-2">
                    <div className="text-sm">
                      {log.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                          <CheckCircle2 className="w-4 h-4" /> Sukses
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-600" title={log.errorMessage || ''}>
                          <XCircle className="w-4 h-4" /> Gagal
                        </span>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[log.type] || 'bg-slate-100 text-slate-600'}`}>
                      {typeLabels[log.type] || log.type}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="text-slate-500 font-medium truncate" title={log.filename}>
                      File: <span className="font-mono text-slate-700">{log.filename}</span>
                    </div>
                    <div className="text-slate-500 font-medium">
                      Ukuran: <span className="text-slate-700 font-semibold">{formatFileSize(log.fileSize)}</span>
                    </div>
                    <div className="text-slate-400">
                      {formatDate(log.createdAt)}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-100 pt-2.5">
                    {log.status === 'success' && (
                      <>
                        <button
                          onClick={() => handleDownloadBackup(log.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                        <button
                          onClick={() => handleRestore(log.id, log.filename)}
                          disabled={isRestoringId === log.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-xs font-semibold transition disabled:opacity-50"
                          title="Restore"
                        >
                          {isRestoringId === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          Restore
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-semibold transition"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Schedule Modal */}
      <Modal isOpen={showScheduleModal} onClose={() => setShowScheduleModal(false)} title="Buat Jadwal Backup">
        <form onSubmit={handleCreateSchedule} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Frekuensi</label>
            <select
              value={scheduleForm.frequency}
              onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="daily">Setiap Hari</option>
              <option value="weekly">Setiap Minggu</option>
              <option value="monthly">Setiap Bulan</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Waktu (WIB)</label>
            <input
              type="time"
              required
              value={scheduleForm.backupTime}
              onChange={(e) => setScheduleForm({ ...scheduleForm, backupTime: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Retensi (Hari)</label>
            <input
              type="number"
              min="1"
              required
              value={scheduleForm.retentionDays}
              onChange={(e) => setScheduleForm({ ...scheduleForm, retentionDays: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-xs text-slate-500 mt-1">Backup yang lebih tua dari ini akan otomatis dihapus.</p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setShowScheduleModal(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmittingSchedule}>
              {isSubmittingSchedule ? 'Menyimpan...' : 'Simpan Jadwal'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
