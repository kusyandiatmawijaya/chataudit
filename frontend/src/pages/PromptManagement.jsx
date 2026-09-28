import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { Plus, Edit2, Trash2, Save, X, Settings2, PlusCircle, Trash } from 'lucide-react';

const PromptManagement = () => {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    category: '',
    title: '',
    type: 'TEXT',
    templateText: '',
    formFields: []
  });

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Use the raw endpoint to get flat array
      const res = await axios.get(`${API_URL}/api/prompt-templates/raw`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      setTemplates(res.data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openModal = (template = null) => {
    if (template) {
      setEditingId(template.id);
      setFormData({
        category: template.category,
        title: template.title,
        type: template.type,
        templateText: template.templateText,
        formFields: template.formFields || []
      });
    } else {
      setEditingId(null);
      setFormData({
        category: '',
        title: '',
        type: 'TEXT',
        templateText: '',
        formFields: []
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleFieldChange = (index, key, value) => {
    const updatedFields = [...formData.formFields];
    updatedFields[index][key] = value;
    setFormData({ ...formData, formFields: updatedFields });
  };

  const addField = () => {
    setFormData({
      ...formData,
      formFields: [...formData.formFields, { name: '', label: '', type: 'text', placeholder: '' }]
    });
  };

  const removeField = (index) => {
    const updatedFields = [...formData.formFields];
    updatedFields.splice(index, 1);
    setFormData({ ...formData, formFields: updatedFields });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': token ? `Bearer ${token}` : '' };
      
      if (editingId) {
        await axios.put(`${API_URL}/api/prompt-templates/${editingId}`, formData, { headers });
      } else {
        await axios.post(`${API_URL}/api/prompt-templates`, formData, { headers });
      }
      fetchTemplates();
      closeModal();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_URL}/api/prompt-templates/${id}`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        fetchTemplates();
      } catch (error) {
        console.error('Failed to delete template:', error);
      }
    }
  };

  return (
    <div className="p-6 md:p-8 w-full max-w-7xl mx-auto flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Settings2 className="w-8 h-8 text-emerald-500" />
            Prompt Management
          </h1>
          <p className="text-slate-500 mt-2">Manage dynamic AI prompt forms and categories.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-emerald-200"
        >
          <Plus className="w-5 h-5" />
          Add New Template
        </button>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl flex-1 flex flex-col min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Settings2 className="w-12 h-12 mb-4 text-slate-300" />
            <p>No prompt templates found.</p>
            <button onClick={() => openModal()} className="mt-4 text-emerald-600 hover:underline">Create your first template</button>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 text-sm font-medium text-slate-700">{template.category}</td>
                    <td className="py-4 px-6 text-sm text-slate-600">{template.title}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded uppercase tracking-wider ${template.type === 'FORM' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {template.type}
                      </span>
                    </td>
                    <td className="py-4 px-6 flex gap-2">
                      <button
                        onClick={() => openModal(template)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit Template"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">
                {editingId ? 'Edit Prompt Template' : 'Create New Prompt Template'}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <form id="templateForm" onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Category</label>
                    <input
                      type="text"
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g. Kinerja Tim"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">Title</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. Evaluasi Sales Harian"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">Template Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                  >
                    <option value="TEXT">TEXT (Direct Execution)</option>
                    <option value="FORM">FORM (Requires User Input)</option>
                  </select>
                </div>

                {formData.type === 'FORM' && (
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-slate-700 text-sm">Form Fields Configuration</h3>
                      <button
                        type="button"
                        onClick={addField}
                        className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        <PlusCircle className="w-4 h-4" /> Add Field
                      </button>
                    </div>

                    {formData.formFields.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No fields added yet. Click 'Add Field' to start.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {formData.formFields.map((field, index) => (
                          <div key={index} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm relative group">
                            <input
                              type="text"
                              placeholder="Variable Name (e.g. kodeSales)"
                              required
                              value={field.name}
                              onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                              className="w-full sm:w-1/4 p-2 text-xs border border-slate-200 rounded-md focus:border-emerald-500 outline-none"
                            />
                            <input
                              type="text"
                              placeholder="Label (e.g. Kode Sales)"
                              required
                              value={field.label}
                              onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                              className="w-full sm:w-1/4 p-2 text-xs border border-slate-200 rounded-md focus:border-emerald-500 outline-none"
                            />
                            <select
                              value={field.type}
                              onChange={(e) => handleFieldChange(index, 'type', e.target.value)}
                              className="w-full sm:w-1/4 p-2 text-xs border border-slate-200 rounded-md focus:border-emerald-500 outline-none"
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                              <option value="select">Select Dropdown</option>
                              <option value="device_lookup">Device Lookup</option>
                              <option value="chat_lookup">Chat Lookup</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Placeholder"
                              value={field.placeholder || ''}
                              onChange={(e) => handleFieldChange(index, 'placeholder', e.target.value)}
                              className="w-full sm:w-1/4 p-2 text-xs border border-slate-200 rounded-md focus:border-emerald-500 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => removeField(index)}
                              className="absolute -right-2 -top-2 bg-red-100 text-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex justify-between">
                    <span>Prompt Template Text</span>
                    <span className="text-xs text-slate-400 font-normal">Use {'{variableName}'} to inject form values</span>
                  </label>
                  <textarea
                    required
                    value={formData.templateText}
                    onChange={(e) => setFormData({ ...formData, templateText: e.target.value })}
                    placeholder="Tampilkan evaluasi untuk {kodeSales}..."
                    rows={4}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm resize-y"
                  ></textarea>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="templateForm"
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptManagement;
