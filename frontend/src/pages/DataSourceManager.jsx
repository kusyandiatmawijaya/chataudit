import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, Plus, Trash2, Edit2, Play, Sparkles, Loader2, Save, X, TableProperties, ChevronDown, ChevronRight, LayoutList } from 'lucide-react';
import { API_URL } from '../config';

const WIDGET_TYPES = [
  { value: 'KPI', label: 'KPI Card' },
  { value: 'LINE_CHART', label: 'Line Chart' },
  { value: 'BAR_CHART', label: 'Bar Chart' },
  { value: 'DONUT_CHART', label: 'Donut Chart' },
  { value: 'AREA_CHART', label: 'Area Chart' },
  { value: 'DATA_TABLE', label: 'Data Table' },
  { value: 'GEOMAP', label: 'Geo Map' }
];

const DataSourceManager = () => {
  const [dataSources, setDataSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // New States for Tables and Queries
  const [dbTables, setDbTables] = useState({});
  const [expandedTables, setExpandedTables] = useState({});
  const [queryResults, setQueryResults] = useState(null);
  const [queryError, setQueryError] = useState('');
  const [isRunningQuery, setIsRunningQuery] = useState(false);

  const [formData, setFormData] = useState({
    id: null,
    name: '',
    description: '',
    query: '',
    widgetTypes: [],
    dynamicParams: 'tahun,bulan'
  });
  const [aiPrompt, setAiPrompt] = useState('');

  useEffect(() => {
    fetchDataSources();
    fetchTables();
  }, []);

  const fetchDataSources = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/data-sources`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDataSources(response.data);
    } catch (error) {
      console.error('Error fetching data sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/data-sources/tables`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDbTables(response.data);
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  const handleGenerateSQL = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/data-sources/generate`, {
        prompt: aiPrompt
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setFormData(prev => ({
        ...prev,
        query: response.data.query
      }));
    } catch (error) {
      console.error('Error generating SQL:', error);
      alert('Failed to generate SQL from AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunQuery = async () => {
    if (!formData.query) return;
    setIsRunningQuery(true);
    setQueryError('');
    setQueryResults(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/api/data-sources/run`, {
        query: formData.query
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setQueryResults(response.data);
    } catch (error) {
      console.error('Error running query:', error);
      setQueryError(error.response?.data?.error || error.message || 'Failed to execute query');
    } finally {
      setIsRunningQuery(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.query) {
      alert("Name and Query are required!");
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (formData.id) {
        await axios.put(`${API_URL}/api/data-sources/${formData.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/api/data-sources`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      setIsModalOpen(false);
      fetchDataSources();
    } catch (error) {
      console.error('Error saving data source:', error);
      alert('Failed to save data source.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this Data Source?")) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/data-sources/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDataSources();
    } catch (error) {
      console.error('Error deleting data source:', error);
    }
  };

  const openModal = (ds = null) => {
    setQueryResults(null);
    setQueryError('');
    if (ds) {
      let parsedTypes = [];
      try {
        parsedTypes = JSON.parse(ds.widgetTypes);
      } catch (e) {
        parsedTypes = [];
      }
      setFormData({
        id: ds.id,
        name: ds.name,
        description: ds.description || '',
        query: ds.query || '',
        widgetTypes: parsedTypes,
        dynamicParams: ds.dynamicParams !== null ? ds.dynamicParams : 'tahun,bulan'
      });
    } else {
      setFormData({ id: null, name: '', description: '', query: '', widgetTypes: [], dynamicParams: 'tahun,bulan' });
    }
    setAiPrompt('');
    setIsModalOpen(true);
  };

  const handleWidgetTypeToggle = (type) => {
    setFormData(prev => {
      const hasType = prev.widgetTypes.includes(type);
      if (hasType) {
        return { ...prev, widgetTypes: prev.widgetTypes.filter(t => t !== type) };
      } else {
        return { ...prev, widgetTypes: [...prev.widgetTypes, type] };
      }
    });
  };

  const toggleTable = (tableName) => {
    setExpandedTables(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }));
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/50 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <Database className="w-6 h-6 mr-2 text-blue-600" />
            Data Source Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage database queries and connect them to widgets.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Data Source
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64 text-gray-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-semibold text-gray-700">Name</th>
                  <th className="px-6 py-3 font-semibold text-gray-700">Description</th>
                  <th className="px-6 py-3 font-semibold text-gray-700">Supported Widgets</th>
                  <th className="px-6 py-3 font-semibold text-gray-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dataSources.map(ds => {
                  let parsedTypes = [];
                  try { parsedTypes = JSON.parse(ds.widgetTypes); } catch (e) {}
                  
                  return (
                    <tr key={ds.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-medium text-gray-800">{ds.name}</td>
                      <td className="px-6 py-4 text-gray-600 truncate max-w-xs">{ds.description}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {parsedTypes.map(t => (
                            <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => openModal(ds)} className="p-1.5 text-gray-500 hover:text-blue-600 rounded-md hover:bg-blue-50 mr-2">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(ds.id)} className="p-1.5 text-gray-500 hover:text-red-600 rounded-md hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {dataSources.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                      No Data Sources found. Create one to start building your dashboard.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full h-full max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <h2 className="text-lg font-semibold text-gray-800">{formData.id ? 'Edit Data Source' : 'New Data Source'}</h2>
              <div className="flex space-x-3">
                <button 
                  onClick={handleSave}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center shadow-sm"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </button>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Modal Body - Flex Row */}
            <div className="flex flex-1 overflow-hidden">
              
              {/* Left Sidebar - Table Schema */}
              <div className="w-1/4 border-r border-gray-200 bg-gray-50 overflow-y-auto flex flex-col">
                <div className="p-4 border-b border-gray-200 sticky top-0 bg-gray-50 z-10 flex items-center text-sm font-bold text-gray-700">
                  <TableProperties className="w-4 h-4 mr-2" />
                  Database Tables
                </div>
                <div className="p-2">
                  {Object.keys(dbTables).sort().map(tableName => (
                    <div key={tableName} className="mb-1">
                      <button 
                        onClick={() => toggleTable(tableName)}
                        className="w-full flex items-center justify-between p-2 hover:bg-gray-200 rounded text-sm text-gray-800 font-medium"
                      >
                        <span className="flex items-center">
                          <Database className="w-3.5 h-3.5 mr-2 text-gray-500" />
                          {tableName}
                        </span>
                        {expandedTables[tableName] ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                      </button>
                      {expandedTables[tableName] && (
                        <div className="pl-7 pr-2 py-1 space-y-1">
                          {dbTables[tableName].map(col => (
                            <div key={col.name} className="flex justify-between items-center text-xs text-gray-600 py-1 border-b border-gray-100 last:border-0">
                              <span className="font-mono">{col.name}</span>
                              <span className="text-gray-400">{col.type}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {Object.keys(dbTables).length === 0 && (
                    <div className="p-4 text-center text-sm text-gray-500">Loading schemas...</div>
                  )}
                </div>
              </div>

              {/* Right Content - Editor & Preview */}
              <div className="w-3/4 flex flex-col overflow-hidden bg-white">
                
                {/* Meta Settings */}
                <div className="p-6 border-b border-gray-200 shrink-0 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name (Unique Identifier)</label>
                      <input 
                        type="text" 
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="e.g. OUTSTANDING_AR_SUMMARY"
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <input 
                        type="text" 
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        placeholder="Describe what this query returns"
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dynamic Parameters</label>
                      <input 
                        type="text" 
                        value={formData.dynamicParams}
                        onChange={e => setFormData({...formData, dynamicParams: e.target.value})}
                        placeholder="e.g. tahun,bulan,divisi,kode_sales"
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">Kosongkan jika tidak memerlukan parameter filter. Pisahkan dengan koma.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Compatible Widgets</label>
                    <div className="flex flex-wrap gap-2">
                      {WIDGET_TYPES.map(type => (
                        <button
                          key={type.value}
                          onClick={() => handleWidgetTypeToggle(type.value)}
                          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                            formData.widgetTypes.includes(type.value) 
                            ? 'bg-blue-600 border-blue-600 text-white' 
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Generator */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-100">
                    <label className="block text-sm font-semibold text-purple-900 mb-2 flex items-center">
                      <Sparkles className="w-4 h-4 mr-2" /> 
                      AI SQL Generator
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                        placeholder="Tuliskan permintaan Anda dalam bahasa Indonesia..."
                        className="flex-1 border border-purple-200 rounded-md px-3 py-2 bg-white"
                        onKeyDown={e => e.key === 'Enter' && handleGenerateSQL()}
                      />
                      <button 
                        onClick={handleGenerateSQL}
                        disabled={isGenerating || !aiPrompt}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center"
                      >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                        Generate
                      </button>
                    </div>
                  </div>
                </div>

                {/* SQL Editor Area */}
                <div className="flex-1 flex flex-col min-h-0 relative">
                  <div className="flex justify-between items-center px-6 py-2 bg-slate-800 text-slate-300 border-b border-slate-900">
                    <span className="text-sm font-medium flex items-center"><LayoutList className="w-4 h-4 mr-2"/> SQL Editor</span>
                    <button 
                      onClick={handleRunQuery}
                      disabled={isRunningQuery || !formData.query}
                      className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-500 disabled:opacity-50 flex items-center"
                    >
                      {isRunningQuery ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                      Run Query
                    </button>
                  </div>
                  <textarea 
                    value={formData.query}
                    onChange={e => setFormData({...formData, query: e.target.value})}
                    className="w-full flex-1 border-0 px-6 py-4 font-mono text-sm bg-slate-900 text-green-400 focus:ring-0 outline-none resize-none leading-relaxed"
                    placeholder="SELECT * FROM table..."
                  ></textarea>
                </div>

                {/* Query Results Preview */}
                <div className="h-64 flex flex-col border-t border-gray-300 bg-white min-h-[250px] shrink-0">
                  <div className="px-6 py-2 bg-gray-100 border-b border-gray-200 text-sm font-medium text-gray-700 flex justify-between">
                    <span>Query Result Preview (Max 50 rows)</span>
                    {queryResults && Array.isArray(queryResults) && (
                      <span className="text-gray-500 text-xs">{queryResults.length} rows returned</span>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-auto p-4 bg-gray-50">
                    {queryError && (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm whitespace-pre-wrap">
                        {queryError}
                      </div>
                    )}
                    
                    {!queryError && !queryResults && !isRunningQuery && (
                      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                        Click "Run Query" to see preview here
                      </div>
                    )}

                    {isRunningQuery && (
                      <div className="h-full flex items-center justify-center text-blue-500 text-sm">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Executing query...
                      </div>
                    )}

                    {queryResults && Array.isArray(queryResults) && queryResults.length > 0 && (
                      <table className="min-w-full divide-y divide-gray-200 text-xs border border-gray-200 shadow-sm rounded-lg overflow-hidden bg-white">
                        <thead className="bg-gray-100">
                          <tr>
                            {Object.keys(queryResults[0]).map(key => (
                              <th key={key} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap border-r border-gray-200 last:border-0">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {queryResults.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="px-3 py-2 text-gray-800 whitespace-nowrap border-r border-gray-200 last:border-0">
                                  {val === null ? <span className="text-gray-400 italic">null</span> : 
                                   typeof val === 'object' ? JSON.stringify(val) : 
                                   String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {queryResults && Array.isArray(queryResults) && queryResults.length === 0 && (
                      <div className="p-4 text-gray-500 text-sm text-center">
                        Query executed successfully but returned 0 rows.
                      </div>
                    )}
                    
                    {queryResults && !Array.isArray(queryResults) && (
                      <pre className="text-xs text-gray-700 p-2 bg-white border border-gray-200 rounded">
                        {JSON.stringify(queryResults, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>

              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default DataSourceManager;
