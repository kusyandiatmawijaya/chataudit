import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { UserPlus, Edit2, Trash2, Shield, User, Loader2, XCircle, Phone, Mail, MessageCircle, Send } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [availableSessions, setAvailableSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'USER', sessionIds: [], whatsappId: '', phoneNumber: '', telegramId: '', email: '' });

  const currentUserStr = localStorage.getItem('user');
  const loggedInUser = currentUserStr ? JSON.parse(currentUserStr) : null;

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const [usersRes, sessionsRes] = await Promise.all([
        axios.get(`${API_URL}/api/users`),
        axios.get(`${API_URL}/api/sessions`)
      ]);
      setUsers(usersRes.data);
      setAvailableSessions(sessionsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenModal = (mode, user = null) => {
    setModalMode(mode);
    setCurrentUser(user);
    if (mode === 'edit' && user) {
      setFormData({ 
        username: user.username, 
        password: '', 
        role: user.role,
        sessionIds: user.sessions?.map(s => s.sessionId) || [],
        whatsappId: user.whatsappId || '',
        phoneNumber: user.phoneNumber || '',
        telegramId: user.telegramId || '',
        email: user.email || '',
      });
    } else {
      setFormData({ username: '', password: '', role: 'USER', sessionIds: [], whatsappId: '', phoneNumber: '', telegramId: '', email: '' });
    }
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (modalMode === 'add') {
        await axios.post(`${API_URL}/api/users`, formData);
      } else {
        const updateData = { 
          role: formData.role, 
          sessionIds: formData.sessionIds,
          whatsappId: formData.whatsappId,
          phoneNumber: formData.phoneNumber,
          telegramId: formData.telegramId,
          email: formData.email,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await axios.put(`${API_URL}/api/users/${currentUser.id}`, updateData);
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await axios.delete(`${API_URL}/api/users/${id}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  };

  if (loggedInUser?.role !== 'DEVELOPER' && loggedInUser?.role !== 'ADMINISTRATOR') {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center text-slate-500">
        <Shield className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-xl font-semibold text-slate-700">Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden font-sans selection:bg-emerald-200">
      <header className="px-6 py-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="font-bold text-lg text-slate-800">User Management</h2>
          <p className="text-xs text-slate-500">Manage access and roles</p>
        </div>
        <button 
          onClick={() => handleOpenModal('add')}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-sm w-full sm:w-auto"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center text-emerald-600">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <>
              {/* Desktop & Tablet Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/4">User</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/6">Role</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Devices</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/6">Created</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {user.profilePic ? (
                              <img src={`${API_URL}${user.profilePic}`} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                <User className="w-5 h-5" />
                              </div>
                            )}
                            <div className="text-sm font-medium text-slate-900">{user.username}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.role === 'DEVELOPER' ? 'bg-purple-100 text-purple-800' :
                            user.role === 'ADMINISTRATOR' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100 text-slate-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {user.sessions?.length > 0 ? (
                              user.sessions.map(s => (
                                <span key={s.sessionId} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] rounded-md font-medium border border-slate-200">
                                  {s.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400 italic">No devices</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-3">
                            <button 
                              onClick={() => handleOpenModal('edit', user)}
                              className="text-indigo-600 hover:text-indigo-900 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {user.id !== loggedInUser?.id && (
                              <button 
                                onClick={() => handleDelete(user.id)}
                                className="text-rose-500 hover:text-rose-700 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block sm:hidden divide-y divide-slate-100">
                {users.map((user) => (
                  <div key={user.id} className="p-5 hover:bg-slate-50/30 transition-colors flex flex-col gap-3.5">
                    {/* Top Row: Avatar & Username + Role */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-3">
                        {user.profilePic ? (
                          <img src={`${API_URL}${user.profilePic}`} alt="avatar" className="w-10 h-10 rounded-full object-cover border border-slate-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center border border-indigo-200/50">
                            <User className="w-5 h-5" />
                          </div>
                        )}
                        <span className="font-semibold text-slate-800 text-base">{user.username}</span>
                      </div>
                      
                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full shrink-0 ${
                        user.role === 'DEVELOPER' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'ADMINISTRATOR' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {user.role}
                      </span>
                    </div>

                    {/* Middle Row: Monitored Devices */}
                    <div>
                      <div className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">Devices</div>
                      <div className="flex flex-wrap gap-1">
                        {user.sessions?.length > 0 ? (
                          user.sessions.map(s => (
                            <span key={s.sessionId} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-md font-medium border border-slate-200">
                              {s.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic font-normal">No devices</span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Creation Date & Actions */}
                    <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-1">
                      <div className="text-xs text-slate-500 font-medium">
                        Dibuat: {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleOpenModal('edit', user)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-semibold transition"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        {user.id !== loggedInUser?.id && (
                          <button 
                            onClick={() => handleDelete(user.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl text-xs font-semibold transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg">{modalMode === 'add' ? 'Add User' : 'Edit User'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input 
                  type="text" 
                  required
                  disabled={modalMode === 'edit'}
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white disabled:opacity-60 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {modalMode === 'edit' ? 'New Password (leave blank to keep current)' : 'Password'}
                </label>
                <input 
                  type="password" 
                  required={modalMode === 'add'}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select 
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors"
                >
                  <option value="USER">User</option>
                  <option value="ADMINISTRATOR">Administrator</option>
                  {loggedInUser?.role === 'DEVELOPER' && (
                    <option value="DEVELOPER">Developer</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Monitored Devices</label>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                  {availableSessions.length === 0 ? (
                    <p className="text-sm text-slate-500 italic text-center py-2">No devices available.</p>
                  ) : (
                    availableSessions.map(session => (
                      <label key={session.sessionId} className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded-lg cursor-pointer transition">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                          checked={formData.sessionIds.includes(session.sessionId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, sessionIds: [...formData.sessionIds, session.sessionId] });
                            } else {
                              setFormData({ ...formData, sessionIds: formData.sessionIds.filter(id => id !== session.sessionId) });
                            }
                          }}
                        />
                        <span className="text-sm text-slate-700 font-medium">{session.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Contact Info Fields */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Contact Info (Optional)</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <span className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-green-500" /> WhatsApp ID</span>
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. 628123456789"
                      value={formData.whatsappId}
                      onChange={(e) => setFormData({...formData, whatsappId: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-blue-500" /> Phone Number</span>
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. +62 812 3456 789"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <span className="flex items-center gap-1.5"><Send className="w-3.5 h-3.5 text-sky-500" /> Telegram ID</span>
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. @username or 123456789"
                      value={formData.telegramId}
                      onChange={(e) => setFormData({...formData, telegramId: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-rose-500" /> Email</span>
                    </label>
                    <input 
                      type="email"
                      placeholder="e.g. user@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50 focus:bg-white transition-colors text-sm"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100">
                  {error}
                </div>
              )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-5 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
