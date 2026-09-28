import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, BookOpen, AlertCircle, X, Search } from 'lucide-react';
import { API_URL } from '../config';

export default function Dictionary() {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ term: '', definition: '' });
  const [formError, setFormError] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'DEVELOPER' || user.role === 'ADMINISTRATOR';

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/dictionary`);
      setTerms(res.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch dictionary terms');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (term = null) => {
    if (term) {
      setEditingId(term.id);
      setFormData({ term: term.term, definition: term.definition });
    } else {
      setEditingId(null);
      setFormData({ term: '', definition: '' });
    }
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (!formData.term.trim() || !formData.definition.trim()) {
      setFormError('Term and definition are required');
      return;
    }

    try {
      if (editingId) {
        await axios.put(`${API_URL}/api/dictionary/${editingId}`, formData);
      } else {
        await axios.post(`${API_URL}/api/dictionary`, formData);
      }
      closeModal();
      fetchTerms();
    } catch (err) {
      setFormError(err.response?.data?.error || 'An error occurred');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this term?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/dictionary/${id}`);
      fetchTerms();
    } catch (err) {
      alert('Failed to delete term');
    }
  };

  const filteredTerms = terms.filter(t => 
    t.term.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.definition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto bg-slate-50/50">
      <div className="p-4 sm:p-8 max-w-6xl mx-auto">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-emerald-500" />
              AI Dictionary
            </h1>
            <p className="text-slate-500 mt-2">Manage jargon and terminology to improve AI Analysis accuracy.</p>
          </div>
          
          {isAdmin && (
            <button
              onClick={() => openModal()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5" />
              Add Term
            </button>
          )}
        </header>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search terms or definitions..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none flex-1 text-slate-700 placeholder-slate-400"
            />
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading dictionary...</div>
          ) : error ? (
            <div className="p-12 text-center text-rose-500 flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p>{error}</p>
              <button onClick={fetchTerms} className="text-sm underline mt-2">Try again</button>
            </div>
          ) : filteredTerms.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No terms found. {isAdmin && "Add some jargons to help the AI."}
            </div>
          ) : (
            <>
              {/* Desktop & Tablet Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-sm">
                      <th className="px-6 py-4 font-medium">Term / Jargon</th>
                      <th className="px-6 py-4 font-medium">Definition</th>
                      {isAdmin && <th className="px-6 py-4 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredTerms.map((term) => (
                      <tr key={term.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-emerald-700 w-1/4">
                          {term.term}
                        </td>
                        <td className="px-6 py-4">
                          {term.definition}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap text-right w-24">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openModal(term)}
                                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Edit Term"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(term.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Term"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block sm:hidden divide-y divide-slate-100">
                {filteredTerms.map((term) => (
                  <div key={term.id} className="p-5 hover:bg-slate-50/30 transition-colors flex flex-col gap-2">
                    <div className="flex justify-between items-center gap-4">
                      <span className="font-bold text-emerald-700 text-lg tracking-wide">{term.term}</span>
                      {isAdmin && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => openModal(term)}
                            className="p-2 text-slate-505 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-100 rounded-xl transition-all shadow-sm"
                            title="Edit Term"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(term.id)}
                            className="p-2 text-slate-505 hover:text-rose-600 hover:bg-rose-50 border border-slate-100 rounded-xl transition-all shadow-sm"
                            title="Delete Term"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed font-normal">{term.definition}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">
                {editingId ? 'Edit Term' : 'Add New Term'}
              </h2>
              <button 
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              {formError && (
                <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm rounded-lg flex gap-2 items-center">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Term / Jargon
                  </label>
                  <input
                    type="text"
                    value={formData.term}
                    onChange={e => setFormData({ ...formData, term: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="e.g. NOO"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Definition
                  </label>
                  <textarea
                    value={formData.definition}
                    onChange={e => setFormData({ ...formData, definition: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-h-[100px] resize-y"
                    placeholder="e.g. New Open Outlet"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    This definition will be provided to the AI to understand the context of the term.
                  </p>
                </div>
              </div>
              
              <div className="mt-8 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm shadow-emerald-500/20 transition-all"
                >
                  {editingId ? 'Save Changes' : 'Add Term'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
