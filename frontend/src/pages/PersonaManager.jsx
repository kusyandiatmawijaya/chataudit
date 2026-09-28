import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, X, Save, MessageSquare } from 'lucide-react';
import { API_URL } from '../config';

export default function PersonaManager() {
  const [personas, setPersonas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPersona, setCurrentPersona] = useState(null);
  const [formData, setFormData] = useState({ name: '', systemPrompt: '', toolAccess: 'EXTERNAL' });

  const fetchPersonas = async () => {
    setIsLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/personas`);
      setPersonas(data);
    } catch (error) {
      console.error('Error fetching personas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, []);

  const handleOpenModal = (persona = null) => {
    if (persona) {
      setCurrentPersona(persona);
      setFormData({ name: persona.name, systemPrompt: persona.systemPrompt, toolAccess: persona.toolAccess || 'EXTERNAL' });
    } else {
      setCurrentPersona(null);
      setFormData({ name: '', systemPrompt: '', toolAccess: 'EXTERNAL' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentPersona(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (currentPersona) {
        await axios.put(`${API_URL}/api/personas/${currentPersona.id}`, formData);
      } else {
        await axios.post(`${API_URL}/api/personas`, formData);
      }
      handleCloseModal();
      fetchPersonas();
    } catch (error) {
      console.error('Error saving persona:', error);
      alert('Gagal menyimpan persona');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Yakin ingin menghapus persona ini?')) {
      try {
        await axios.delete(`${API_URL}/api/personas/${id}`);
        fetchPersonas();
      } catch (error) {
        console.error('Error deleting persona:', error);
        alert('Gagal menghapus persona');
      }
    }
  };

  return (
    <div className="p-4 sm:p-8 w-full max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <MessageSquare className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600" />
            Persona Management
          </h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">Manage dynamic AI personas and their system prompts.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Add Persona
        </button>
      </div>

      <div className="w-full">
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">Loading...</div>
        ) : personas.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
            No personas found. Create one to get started.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-auto max-h-[calc(100vh-250px)] rounded-b-2xl" style={{ scrollbarWidth: 'thin' }}>
                <table className="w-full text-left border-collapse relative">
                  <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                    <tr className="border-b border-gray-100 text-gray-600 text-sm font-semibold uppercase tracking-wider">
                      <th className="p-6 w-1/4">Name</th>
                      <th className="p-6 w-1/2">System Prompt Preview</th>
                      <th className="p-6">Tool Access</th>
                      <th className="p-6 w-1/4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {personas.map((persona) => (
                      <tr key={persona.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-6 font-medium text-gray-900">{persona.name}</td>
                        <td className="p-6 text-gray-500 truncate max-w-md" title={persona.systemPrompt}>
                          {persona.systemPrompt.substring(0, 100)}...
                        </td>
                        <td className="p-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${persona.toolAccess === 'INTERNAL' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {persona.toolAccess || 'EXTERNAL'}
                          </span>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => handleOpenModal(persona)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(persona.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col gap-4">
              {personas.map((persona) => (
                <div key={persona.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-semibold text-gray-900 text-lg break-words">{persona.name}</h3>
                    <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${persona.toolAccess === 'INTERNAL' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {persona.toolAccess || 'EXTERNAL'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-3" title={persona.systemPrompt}>
                    {persona.systemPrompt}
                  </p>
                  <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-gray-50">
                    <button
                      onClick={() => handleOpenModal(persona)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(persona.id)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-12 sm:p-4 bg-gray-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
              <h2 className="text-xl font-bold text-gray-900">
                {currentPersona ? 'Edit Persona' : 'Add New Persona'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Persona Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-base"
                    placeholder="e.g. KIRANA (Customer Service)"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    System Prompt <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows="8"
                    value={formData.systemPrompt}
                    onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-y text-base"
                    placeholder="Describe the persona's role, tone, and behavior..."
                  ></textarea>
                  <p className="text-xs text-gray-500 mt-2">
                    This prompt will be combined with the global chatbot rules automatically.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tool Access Capability
                  </label>
                  <select
                    value={formData.toolAccess}
                    onChange={(e) => setFormData({ ...formData, toolAccess: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all bg-white text-base"
                  >
                    <option value="EXTERNAL">EXTERNAL (Customer Tools only)</option>
                    <option value="INTERNAL">INTERNAL (Full Staff Tools)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    EXTERNAL limits the AI to only tools safe for customers. INTERNAL allows full access to staff/business tools.
                  </p>
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
                  Save Persona
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
