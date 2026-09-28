import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Edit2, Users, Search, X, Save, Trash2, Unlock } from 'lucide-react';
import { API_URL } from '../config';

const CONTACT_GROUPS = [
  'Customer',
  'Direktur/Owner',
  'Salesman',
  'Supervisor Sales',
  'Asisten Sales Manager',
  'Kasir',
  'Admin Sales/EDP',
  'Kolektor',
  'IT',
  'Accounting/Finance Staff',
  'Accounting/Finance Manager',
  'HRD',
  'Admin Gudang',
  'Prinsiple',
  'Driver/Kenek',
  'Checker/Helper Gudang'
];

export default function ContactManager() {
  const [contacts, setContacts] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');
  const [selectedAccessFilter, setSelectedAccessFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState(null);
  const [formData, setFormData] = useState({ name: '', personaId: '', group: '', isAllowed: false, realPhoneNumber: '', kodeCustomer: '', kodeSales: '', kodeGudang: '', notes: '' });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [contactsRes, personasRes] = await Promise.all([
        axios.get(`${API_URL}/api/contacts`),
        axios.get(`${API_URL}/api/personas`)
      ]);
      setContacts(contactsRes.data);
      setPersonas(personasRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (contact) => {
    setCurrentContact(contact);
    setFormData({ 
      name: contact.name || '', 
      personaId: contact.personaId || '',
      group: contact.group || '',
      isAllowed: contact.isAllowed || false,
      realPhoneNumber: contact.realPhoneNumber || '',
      kodeCustomer: contact.kodeCustomer || '',
      kodeSales: contact.kodeSales || '',
      kodeGudang: contact.kodeGudang || '',
      notes: contact.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentContact(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/api/contacts/${currentContact.id}`, {
        name: formData.name,
        personaId: formData.personaId || null,
        group: formData.group || null,
        isAllowed: formData.isAllowed,
        realPhoneNumber: formData.realPhoneNumber || null,
        kodeCustomer: formData.kodeCustomer || null,
        kodeSales: formData.kodeSales || null,
        kodeGudang: formData.kodeGudang || null,
        notes: formData.notes || null
      });
      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error('Error updating contact:', error);
      alert('Gagal mengupdate contact');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus contact ini?')) return;
    try {
      await axios.delete(`${API_URL}/api/contacts/${id}`);
      fetchData();
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Gagal menghapus contact');
    }
  };

  const handleUnban = async (id) => {
    if (window.confirm('Yakin ingin membuka blokir kontak ini?')) {
      try {
        await axios.put(`${API_URL}/api/contacts/${id}`, { unban: true });
        fetchData();
      } catch (error) {
        console.error('Error unbanning contact:', error);
        alert('Gagal membuka blokir');
      }
    }
  };

  const filteredContacts = React.useMemo(() => {
    let result = contacts.filter(contact => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
                            (contact.name && String(contact.name).toLowerCase().includes(q)) ||
                            (contact.phoneNumber && String(contact.phoneNumber).toLowerCase().includes(q)) ||
                            (contact.realPhoneNumber && String(contact.realPhoneNumber).toLowerCase().includes(q)) ||
                            (contact.whatsappId && String(contact.whatsappId).toLowerCase().includes(q)) ||
                            (contact.telegramId && String(contact.telegramId).toLowerCase().includes(q)) ||
                            (contact.kodeCustomer && String(contact.kodeCustomer).toLowerCase().includes(q));
      const matchesGroup = selectedGroupFilter ? contact.group === selectedGroupFilter : true;
      let matchesAccess = true;
      if (selectedAccessFilter === 'true') matchesAccess = contact.isAllowed === true;
      if (selectedAccessFilter === 'false') matchesAccess = contact.isAllowed === false;
      return matchesSearch && matchesGroup && matchesAccess;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'personaName') {
            aValue = a.persona ? a.persona.name : '';
            bValue = b.persona ? b.persona.name : '';
        }

        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return result;
  }, [contacts, searchQuery, selectedGroupFilter, selectedAccessFilter, sortConfig]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="p-4 sm:p-8 w-full max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600" />
            Contact & Persona Mapping
          </h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">Manage WhatsApp contacts and assign specific AI personas to them.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <select
            value={selectedAccessFilter}
            onChange={(e) => setSelectedAccessFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white text-gray-600"
          >
            <option value="">All Access</option>
            <option value="true">Allowed</option>
            <option value="false">Blocked</option>
          </select>
          <select
            value={selectedGroupFilter}
            onChange={(e) => setSelectedGroupFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white text-gray-600"
          >
            <option value="">All Groups</option>
            {CONTACT_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none w-full md:w-64 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="w-full">
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-auto max-h-[calc(100vh-250px)] rounded-b-2xl" style={{ scrollbarWidth: 'thin' }}>
                <table className="w-full text-left border-collapse relative">
                  <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                    <tr className="border-b border-gray-100 text-gray-600 text-sm font-semibold uppercase tracking-wider">
                      <th className="p-6 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>Name{getSortIcon('name')}</th>
                      <th className="p-6 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('phoneNumber')}>Phone Number{getSortIcon('phoneNumber')}</th>
                      <th className="p-6 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('group')}>Group{getSortIcon('group')}</th>
                      <th className="p-6 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('isAllowed')}>Chatbot Access{getSortIcon('isAllowed')}</th>
                      <th className="p-6 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('whatsappId')}>WhatsApp ID{getSortIcon('whatsappId')}</th>
                      <th className="p-6 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('telegramId')}>Telegram ID{getSortIcon('telegramId')}</th>
                      <th className="p-6 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('personaName')}>Assigned Persona{getSortIcon('personaName')}</th>
                      <th className="p-6 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('createdAt')}>Created At{getSortIcon('createdAt')}</th>
                      <th className="p-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredContacts.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-gray-500">
                          No contacts found.
                        </td>
                      </tr>
                    ) : (
                      filteredContacts.map((contact) => (
                        <tr key={contact.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-6 text-gray-600">{contact.name}</td>
                          <td className="p-6 text-gray-600">
                            {contact.realPhoneNumber ? (
                              <span className="font-semibold text-indigo-700" title={`Internal ID: ${contact.phoneNumber}`}>{contact.realPhoneNumber}</span>
                            ) : contact.phoneNumber}
                          </td>
                          <td className="p-6">
                            {contact.group ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                {contact.group}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic text-sm">-</span>
                            )}
                          </td>
                          <td className="p-6">
                            {contact.isAllowed ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Allowed
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1 items-start">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                  Blocked
                                </span>
                                {contact.strikeCount >= 3 && (
                                  <span className="text-[10px] text-red-600 font-semibold uppercase bg-red-50 px-2 py-0.5 rounded border border-red-100">Auto-ban (Spam)</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-6 font-medium text-gray-900">{contact.whatsappId}</td>
                          <td className="p-6 font-medium text-gray-500">{contact.telegramId || '-'}</td>
                          <td className="p-6">
                            {contact.persona ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                                {contact.persona.name}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic text-sm">Default (KIRANA)</span>
                            )}
                          </td>
                          <td className="p-6 text-gray-500 text-sm whitespace-nowrap">
                            {contact.createdAt ? new Date(contact.createdAt).toLocaleDateString('id-ID', {
                              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            }) : '-'}
                          </td>
                          <td className="p-6 text-right whitespace-nowrap">
                            <button
                              onClick={() => handleOpenModal(contact)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-2"
                              title="Edit Contact"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {(!contact.isAllowed || contact.botStatus === 'BLOCKED') && (
                              <button
                                onClick={() => handleUnban(contact.id)}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-2 ml-2"
                                title="Buka Blokir (Unban)"
                              >
                                <Unlock className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(contact.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center gap-2 ml-2"
                              title="Delete Contact"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden flex flex-col gap-4">
              {filteredContacts.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
                  No contacts found.
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div key={contact.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-lg truncate">{contact.name || contact.phoneNumber}</h3>
                        <p className="text-sm text-gray-500 truncate mt-1">WA: {contact.whatsappId}</p>
                        {contact.telegramId && <p className="text-sm text-blue-500 truncate mt-1">TG: {contact.telegramId}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenModal(contact)}
                          className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span className="text-sm font-medium sr-only">Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="text-sm font-medium sr-only">Delete</span>
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
                      {contact.isAllowed ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Allowed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                          Blocked
                        </span>
                      )}
                      {contact.group && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                          {contact.group}
                        </span>
                      )}
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                        Persona: {contact.persona ? contact.persona.name : 'Default'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-12 sm:p-4 bg-gray-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Map Persona to Contact</h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      WhatsApp ID
                    </label>
                    <input
                      type="text"
                      disabled
                      value={currentContact?.whatsappId || ''}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed text-base sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Telegram ID
                    </label>
                    <input
                      type="text"
                      disabled
                      value={currentContact?.telegramId || '-'}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed text-base sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      disabled
                      value={currentContact?.phoneNumber || ''}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed text-base sm:text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-base"
                      placeholder="Enter contact name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Real Phone Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.realPhoneNumber || ''}
                      onChange={(e) => setFormData({ ...formData, realPhoneNumber: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-base"
                      placeholder="e.g. 62811110313"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Group (Jabatan/Divisi)
                    </label>
                    <select
                      value={formData.group}
                      onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white text-base"
                    >
                      <option value="">-- No Group --</option>
                      {CONTACT_GROUPS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kode Customer
                    </label>
                    <input
                      type="text"
                      value={formData.kodeCustomer}
                      onChange={(e) => setFormData({ ...formData, kodeCustomer: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-base"
                      placeholder="e.g. 0377,1974"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kode Sales
                    </label>
                    <input
                      type="text"
                      value={formData.kodeSales}
                      onChange={(e) => setFormData({ ...formData, kodeSales: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-base"
                      placeholder="e.g. FBB101"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kode Gudang
                    </label>
                    <input
                      type="text"
                      value={formData.kodeGudang}
                      onChange={(e) => setFormData({ ...formData, kodeGudang: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-base"
                      placeholder="e.g. 101W01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assign AI Persona
                    </label>
                    <select
                      value={formData.personaId}
                      onChange={(e) => setFormData({ ...formData, personaId: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white text-base"
                    >
                      <option value="">-- Default (KIRANA) --</option>
                      {personas.map((persona) => (
                        <option key={persona.id} value={persona.id}>
                          {persona.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Catatan (Notes)
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows="3"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-base resize-none"
                      placeholder="Tambahkan catatan untuk kontak ini..."
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Chatbot Access</h3>
                      <p className="text-xs text-gray-500 mt-1">Allow this contact to chat with the AI</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={formData.isAllowed}
                        onChange={(e) => setFormData({ ...formData, isAllowed: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-gray-50/50">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
                >
                  <Save className="w-5 h-5" />
                  Save Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
