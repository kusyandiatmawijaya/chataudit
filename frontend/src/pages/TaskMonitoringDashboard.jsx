import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Loader2, Sparkles, AlertCircle, CheckCircle, Clock, Trash2, Edit2, Send, ArrowLeft } from 'lucide-react';
import TaskCreationModal from '../components/TaskCreationModal';
import ReactMarkdown from 'react-markdown';

const TaskMonitoringDashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [triggeringAudit, setTriggeringAudit] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [users, setUsers] = useState([]);
  const [editPicMode, setEditPicMode] = useState(false);
  const [newPicId, setNewPicId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/tasks');
      setTasks(data.tasks);
    } catch (err) {
      setError('Failed to fetch tasks');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await axios.get('/api/users');
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, []);

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    setIsDeleting(true);
    try {
      await axios.delete(`/api/tasks/${taskId}`);
      setTasks(tasks => tasks.filter(t => t.id !== taskId));
      if (selectedTask?.id === taskId) setSelectedTask(null);
      alert('Task deleted successfully');
    } catch (err) {
      alert('Failed to delete task');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdatePic = async (taskId) => {
    if (!newPicId) return alert('Select a new PIC');
    try {
      const { data } = await axios.put(`/api/tasks/${taskId}/pic`, { picId: newPicId });
      setTasks(tasks => tasks.map(t => t.id === taskId ? { ...t, picId: data.task.picId, pic: data.task.pic } : t));
      if (selectedTask?.id === taskId) {
        setSelectedTask({ ...selectedTask, picId: data.task.picId, pic: data.task.pic });
      }
      setEditPicMode(false);
      alert('PIC updated successfully');
    } catch (err) {
      alert('Failed to update PIC');
    }
  };

  const handleResendNotif = async (taskId) => {
    setIsResending(true);
    try {
      const { data } = await axios.post(`/api/tasks/${taskId}/resend-notification`);
      alert(data.message || 'Notification resent');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to resend notification');
    } finally {
      setIsResending(false);
    }
  };

  const handleTriggerAudit = async (taskId) => {
    setTriggeringAudit(true);
    try {
      const { data } = await axios.post(`/api/tasks/${taskId}/trigger-audit`);
      setTasks(tasks.map(t => t.id === taskId ? data.task : t));
      if (selectedTask?.id === taskId) {
        setSelectedTask(data.task);
      }
    } catch (err) {
      alert('Failed to trigger audit: ' + (err.response?.data?.error || err.message));
    } finally {
      setTriggeringAudit(false);
    }
  };

  const handleUpdateStatus = async (taskId, status) => {
    setUpdatingStatus(true);
    try {
      const { data } = await axios.put(`/api/tasks/${taskId}/status`, { status });
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status } : t));
      if (selectedTask?.id === taskId) {
        setSelectedTask({ ...selectedTask, status });
      }
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const [notesInput, setNotesInput] = useState('');
  const [updatingNotes, setUpdatingNotes] = useState(false);

  useEffect(() => {
    if (selectedTask) {
      setNotesInput(selectedTask.picNotes || '');
    }
  }, [selectedTask?.id]);

  const handleAcknowledge = async (taskId) => {
    try {
      const { data } = await axios.put(`/api/tasks/${taskId}/acknowledge`);
      // Update local state without losing joined relations if possible, or just merge
      setTasks(tasks.map(t => t.id === taskId ? { ...t, ...data.task } : t));
      if (selectedTask?.id === taskId) {
        setSelectedTask({ ...selectedTask, ...data.task });
      }
    } catch (err) {
      alert('Failed to acknowledge task');
    }
  };

  const handleUpdateNotes = async (taskId) => {
    setUpdatingNotes(true);
    try {
      const { data } = await axios.put(`/api/tasks/${taskId}/notes`, { picNotes: notesInput });
      setTasks(tasks.map(t => t.id === taskId ? { ...t, ...data.task } : t));
      if (selectedTask?.id === taskId) {
        setSelectedTask({ ...selectedTask, ...data.task });
      }
      alert('Progress/Notes updated successfully!');
    } catch (err) {
      alert('Failed to update notes');
    } finally {
      setUpdatingNotes(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'OPEN': return 'bg-blue-100 text-blue-800';
      case 'OPEN_CONTINUE': return 'bg-yellow-100 text-yellow-800';
      case 'SOLVE_AND_CLOSE': return 'bg-green-100 text-green-800';
      case 'OPEN_CLOSE': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Task Monitoring Dashboard</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">Track issues and monitor PIC progress via AI audits.</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 flex items-center text-sm sm:text-base w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
          Create Task
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded mb-6 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Task List */}
        <div className={`lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-col h-[500px] lg:h-[calc(100vh-12rem)] ${selectedTask ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-4 border-b border-gray-200 bg-gray-50 font-medium text-gray-700">
            Active Tasks
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No tasks found.</div>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <div 
                    key={task.id} 
                    onClick={() => setSelectedTask(task)}
                    className={`p-3 border rounded cursor-pointer transition-colors ${selectedTask?.id === task.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    <div className="font-semibold text-gray-800 truncate">{task.issue?.title || 'Unknown Issue'}</div>
                    <div className="text-xs text-gray-500 mt-1 flex justify-between">
                      <span>PIC: {task.pic?.username || task.picId}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      Due: {new Date(task.deadline).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Task Detail */}
        <div className={`lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-col h-[600px] lg:h-[calc(100vh-12rem)] ${!selectedTask ? 'hidden lg:flex' : 'flex'}`}>
          {selectedTask ? (
            <div className="flex flex-col h-full">
              <div className="p-5 border-b border-gray-200 flex justify-between items-start bg-gray-50">
                <div className="flex items-start gap-3">
                  <button 
                    onClick={() => setSelectedTask(null)}
                    className="lg:hidden mt-1 p-1 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedTask.issue?.title}</h2>
                    <div className="text-sm text-gray-500 mt-1">
                      Source: <span className="font-medium text-gray-700">{selectedTask.issue?.sourceModule}</span>
                    </div>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(selectedTask.status)}`}>
                  {selectedTask.status}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                
                {/* Initial Context */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-800 mb-3 border-b pb-2">Initial Context</h3>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
                    <div className="font-medium mb-2 text-indigo-700">AI Summary at Creation:</div>
                    <div className="prose prose-sm max-w-none text-gray-700">
                      <ReactMarkdown>{selectedTask.issue?.aiSummary || 'No initial summary.'}</ReactMarkdown>
                    </div>
                  </div>
                </div>

                {/* Progress Report */}
                <div className="mb-8">
                  <div className="flex justify-between items-center border-b pb-2 mb-3">
                    <h3 className="text-lg font-bold text-gray-800">AI Progress Report</h3>
                    <button
                      onClick={() => handleTriggerAudit(selectedTask.id)}
                      disabled={triggeringAudit || selectedTask.status.includes('CLOSE')}
                      className={`text-sm flex items-center px-3 py-1.5 rounded ${triggeringAudit ? 'bg-gray-200 text-gray-500' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
                    >
                      {triggeringAudit ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                      {triggeringAudit ? 'Auditing...' : 'Trigger AI Audit'}
                    </button>
                  </div>
                  
                  {selectedTask.aiProgressReport ? (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm">
                      <div className="prose prose-sm max-w-none text-blue-900">
                        <ReactMarkdown>{selectedTask.aiProgressReport}</ReactMarkdown>
                      </div>
                      <div className="mt-4 text-xs text-blue-500">
                        Last audited: {new Date(selectedTask.updatedAt).toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400 bg-gray-50 rounded border border-dashed border-gray-300">
                      No progress report generated yet. Click 'Trigger AI Audit' to fetch fresh data and compare.
                    </div>
                  )}
                </div>

                {/* PIC Manual Updates */}
                <div className="mb-8">
                  <div className="flex justify-between items-center border-b pb-2 mb-3">
                    <h3 className="text-lg font-bold text-gray-800">Catatan & Progress (PIC)</h3>
                    {!selectedTask.isAcknowledged && (
                      <button
                        onClick={() => handleAcknowledge(selectedTask.id)}
                        className="text-sm bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded flex items-center font-medium"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Terima & Mengerti Tugas
                      </button>
                    )}
                    {selectedTask.isAcknowledged && (
                      <span className="text-sm text-green-600 flex items-center font-medium">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Tugas Diterima
                      </span>
                    )}
                  </div>
                  
                  {selectedTask.isAcknowledged ? (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <textarea
                        value={notesInput}
                        onChange={(e) => setNotesInput(e.target.value)}
                        placeholder="Tuliskan catatan atau update progress manual di sini..."
                        className="w-full h-24 p-3 border border-gray-300 rounded text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleUpdateNotes(selectedTask.id)}
                          disabled={updatingNotes}
                          className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 flex items-center disabled:opacity-50"
                        >
                          {updatingNotes ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Simpan Catatan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400 bg-gray-50 rounded border border-dashed border-gray-300 text-sm">
                      Silakan klik tombol "Terima & Mengerti Tugas" terlebih dahulu untuk mulai memberikan catatan.
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-gray-800 mb-3 border-b pb-2">Finalize Task</h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleUpdateStatus(selectedTask.id, 'OPEN_CONTINUE')}
                      disabled={updatingStatus || selectedTask.status === 'OPEN_CONTINUE'}
                      className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-sm font-medium"
                    >
                      Open & Continue
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedTask.id, 'SOLVE_AND_CLOSE')}
                      disabled={updatingStatus || selectedTask.status === 'SOLVE_AND_CLOSE'}
                      className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center text-sm font-medium"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Solve & Close
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedTask.id, 'OPEN_CLOSE')}
                      disabled={updatingStatus || selectedTask.status === 'OPEN_CLOSE'}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
                    >
                      Open & Close (Unresolved)
                    </button>
                  </div>
                </div>

                {/* Manage Task */}
                <div>
                  <h3 className="text-lg font-bold text-red-800 mb-3 border-b border-red-200 pb-2">Manage Task</h3>
                  <div className="flex flex-col gap-4">
                    
                    {/* PIC Update */}
                    <div className="flex items-center gap-3">
                      {!editPicMode ? (
                        <>
                          <div className="text-sm"><span className="font-semibold">Current PIC:</span> {selectedTask.pic?.username}</div>
                          <button 
                            onClick={() => { setEditPicMode(true); setNewPicId(selectedTask.picId); }}
                            className="text-indigo-600 hover:text-indigo-800 flex items-center text-sm font-medium"
                          >
                            <Edit2 className="w-4 h-4 mr-1"/> Change PIC
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select 
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                            value={newPicId}
                            onChange={(e) => setNewPicId(e.target.value)}
                          >
                            <option value="">-- Select New PIC --</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>{u.username}</option>
                            ))}
                          </select>
                          <button onClick={() => handleUpdatePic(selectedTask.id)} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700">Save</button>
                          <button onClick={() => setEditPicMode(false)} className="text-gray-500 text-sm hover:text-gray-700">Cancel</button>
                        </div>
                      )}
                    </div>

                    {/* Resend Notif */}
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleResendNotif(selectedTask.id)}
                        disabled={isResending}
                        className="bg-blue-100 text-blue-700 px-3 py-1 rounded flex items-center text-sm font-medium hover:bg-blue-200 disabled:opacity-50"
                      >
                        {isResending ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Send className="w-4 h-4 mr-1" />}
                        Resend Notification
                      </button>
                    </div>

                    {/* Delete */}
                    <div>
                      <button 
                        onClick={() => handleDeleteTask(selectedTask.id)}
                        disabled={isDeleting}
                        className="bg-red-100 text-red-700 px-3 py-1.5 rounded flex items-center text-sm font-medium hover:bg-red-200 disabled:opacity-50"
                      >
                        {isDeleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Trash2 className="w-4 h-4 mr-1" />}
                        Delete Task
                      </button>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 p-6 text-center">
              <div>
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Select a task from the list to view details and monitor progress.</p>
              </div>
            </div>
          )}
        </div>

      </div>

      <TaskCreationModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onTaskCreated={() => {
          fetchTasks();
          setIsCreateModalOpen(false);
        }} 
      />
    </div>
  );
};

export default TaskMonitoringDashboard;
