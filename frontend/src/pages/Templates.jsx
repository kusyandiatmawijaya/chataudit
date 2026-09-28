import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash, X, Database } from 'lucide-react';
import { API_URL } from '../config';

function Templates() {
  const [templates, setTemplates] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'TEXT',
    header: '',
    body: '',
    footer: '',
    mediaUrl: ''
  });
  const [mediaFile, setMediaFile] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/templates`);
      setTemplates(res.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleOpenModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        type: template.type,
        header: template.header || '',
        body: template.body,
        footer: template.footer || '',
        mediaUrl: template.mediaUrl || ''
      });
      setMediaFile(null);
    } else {
      setEditingTemplate(null);
      setFormData({ name: '', type: 'TEXT', header: '', body: '', footer: '', mediaUrl: '' });
      setMediaFile(null);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('type', formData.type);
      data.append('header', formData.header);
      data.append('body', formData.body);
      data.append('footer', formData.footer);
      
      if (formData.mediaUrl && !mediaFile) data.append('mediaUrl', formData.mediaUrl);
      if (mediaFile) {
        data.append('mediaFile', mediaFile);
      }

      const config = {
        headers: { 'Content-Type': 'multipart/form-data' }
      };

      if (editingTemplate) {
        await axios.put(`${API_URL}/api/templates/${editingTemplate.id}`, data, config);
      } else {
        await axios.post(`${API_URL}/api/templates`, data, config);
      }
      fetchTemplates();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      await axios.delete(`${API_URL}/api/templates/${id}`);
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  return (
    <div className="p-6 h-full w-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">WhatsApp Templates</h1>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Create Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map(template => (
          <div key={template.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">{template.name}</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full uppercase">
                  {template.type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex gap-2">
                <Link to={`/templates/${template.id}`} className="text-gray-400 hover:text-green-600 tooltip" title="Database Penerima">
                  <Database size={18} />
                </Link>
                <button onClick={() => handleOpenModal(template)} className="text-gray-400 hover:text-blue-600">
                  <Edit size={18} />
                </button>
                <button onClick={() => handleDelete(template.id)} className="text-gray-400 hover:text-red-600">
                  <Trash size={18} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 bg-gray-50 p-4 rounded-lg relative overflow-y-auto text-sm max-h-[300px]">
              <div className="absolute top-0 left-0 w-1 h-full bg-green-500"></div>
              {template.mediaUrl && (
                <div className="mb-2 text-blue-500 truncate text-xs hover:underline">
                  <a href={template.mediaUrl.startsWith('http') ? template.mediaUrl : `${API_URL}${template.mediaUrl}`} target="_blank" rel="noopener noreferrer">
                    [Media: {template.mediaUrl.split('/').pop()}]
                  </a>
                </div>
              )}
              {template.header && <div className="font-bold mb-2">{template.header}</div>}
              <div className="whitespace-pre-wrap">{template.body}</div>
              {template.footer && <div className="text-gray-500 mt-2 text-xs">{template.footer}</div>}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">{editingTemplate ? 'Edit Template' : 'Create Template'}</h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Type</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="TEXT">Text Only</option>
                    <option value="STATIC_MEDIA">Static Media</option>
                    <option value="DYNAMIC_MEDIA">Dynamic Media (from CSV)</option>
                  </select>
                </div>
              </div>

              {formData.type === 'STATIC_MEDIA' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Media Upload</label>
                  <input
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    onChange={(e) => setMediaFile(e.target.files[0])}
                    className="w-full p-2 border rounded-lg mb-2 bg-gray-50"
                  />
                  <div className="text-center text-gray-400 text-xs my-2 font-medium uppercase">or use URL</div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Media URL</label>
                  <input
                    type="text"
                    name="mediaUrl"
                    value={formData.mediaUrl}
                    onChange={handleChange}
                    placeholder="https://example.com/image.jpg"
                    className="w-full p-2 border rounded-lg disabled:opacity-50 disabled:bg-gray-100"
                    disabled={!!mediaFile}
                  />
                  {mediaFile && <p className="text-xs text-green-600 mt-1">File selected, URL input disabled.</p>}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Header (Optional)</label>
                <input
                  type="text"
                  name="header"
                  value={formData.header}
                  onChange={handleChange}
                  placeholder="Will be displayed in bold"
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Body Message</label>
                <textarea
                  name="body"
                  value={formData.body}
                  onChange={handleChange}
                  rows="4"
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Use {{variable}} for dynamic content"
                  required
                ></textarea>
                <p className="text-xs text-gray-500 mt-1">Example: Hello {"{{name}}"}, your balance is {"{{balance}}"}</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Footer (Optional)</label>
                <input
                  type="text"
                  name="footer"
                  value={formData.footer}
                  onChange={handleChange}
                  placeholder="Displayed in small gray text"
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Templates;
