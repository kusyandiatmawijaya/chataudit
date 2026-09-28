import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { SidebarTree } from './components/SidebarTree';
import { SqlEditorPane } from './components/SqlEditorPane';
import { ResultsGrid } from './components/ResultsGrid';
import { AiCopilotBar } from './components/AiCopilotBar';
import { AiExplanationPanel } from './components/AiExplanationPanel';

export const DatabaseExplorer = () => {
  const [schemas, setSchemas] = useState({});
  const [activeQuery, setActiveQuery] = useState('SELECT * FROM users LIMIT 100;');
  const [queryResults, setQueryResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState(null);
  const [executionTime, setExecutionTime] = useState(0);
  
  // AI Explanation State
  const [isExplainOpen, setIsExplainOpen] = useState(false);
  const [explanation, setExplanation] = useState('');

  // Use a ref to access the latest activeQuery in event listeners
  const activeQueryRef = useRef(activeQuery);
  useEffect(() => {
    activeQueryRef.current = activeQuery;
  }, [activeQuery]);

  useEffect(() => {
    fetchSchemas();
  }, []);

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`
    };
  };

  const fetchSchemas = async () => {
    try {
      const res = await axios.get('/api/db/schemas', { headers: getHeaders() });
      setSchemas(res.data);
    } catch (err) {
      console.error('Error fetching schemas:', err);
      setError('Failed to load schemas. Are you a SuperAdmin (DEVELOPER)?');
    }
  };

  const schemaStats = useMemo(() => {
    let tableCount = 0;
    let viewCount = 0;
    Object.values(schemas).forEach(schema => {
      tableCount += schema.tables?.length || 0;
      viewCount += schema.views?.length || 0;
    });
    return { tableCount, viewCount };
  }, [schemas]);

  const handleTableClick = (schema, table) => {
    const query = `SELECT * FROM "${schema}"."${table}" LIMIT 100;`;
    setActiveQuery(query);
  };

  const executeQuery = useCallback(async (queryToRun) => {
    const query = queryToRun || activeQueryRef.current;
    if (!query) return;
    
    setLoading(true);
    setError(null);
    setQueryResults(null);
    
    const start = performance.now();
    try {
      const res = await axios.post('/api/db/query', { query }, { headers: getHeaders() });
      const end = performance.now();
      setExecutionTime(end - start);
      
      if (res.data.success) {
        setQueryResults(res.data);
      } else {
        setError(res.data.error);
      }
    } catch (err) {
      const end = performance.now();
      setExecutionTime(end - start);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGenerateSql = async (prompt) => {
    setAiLoading(true);
    setError(null);
    try {
      const res = await axios.post('/api/db/copilot/generate', { prompt }, { headers: getHeaders() });
      if (res.data && res.data.sql) {
        setActiveQuery(res.data.sql);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate SQL via AI Copilot');
    } finally {
      setAiLoading(false);
    }
  };

  const handleExplainSql = async () => {
    const query = activeQueryRef.current;
    if (!query) return;
    
    setIsExplainOpen(true);
    setExplanation('⏳ Analyzing query using Schema-Aware AI...');
    try {
      const res = await axios.post('/api/db/copilot/explain', { query }, { headers: getHeaders() });
      if (res.data && res.data.explanation) {
        setExplanation(res.data.explanation);
      }
    } catch (err) {
      setExplanation('❌ ' + (err.response?.data?.error || 'Failed to generate explanation.'));
    }
  };

  const handleExport = async (format) => {
    const query = activeQueryRef.current;
    if (!query) return;
    
    try {
      const response = await axios.post('/api/db/export', { query, format }, {
        headers: getHeaders(),
        responseType: format === 'json' ? 'json' : 'blob'
      });
      
      if (format === 'json') {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(response.data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", "export.json");
        document.body.appendChild(downloadAnchorNode); 
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        return;
      }
      
      // For txt and excel (blob)
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const extension = format === 'excel' ? 'xlsx' : 'txt';
      link.setAttribute('download', `export.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data');
    }
  };

  const handleExportSchema = async () => {
    try {
      const response = await axios.get('/api/db/export-schema', {
        headers: getHeaders(),
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'schema.sql');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('Export schema error:', err);
      alert('Failed to export schema');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-900 text-gray-100 overflow-hidden font-sans relative">
      <AiExplanationPanel 
        isOpen={isExplainOpen} 
        onClose={() => setIsExplainOpen(false)} 
        explanation={explanation} 
      />

      {/* Header */}
      <header className="flex justify-between items-center px-6 py-3 border-b border-gray-700 bg-gray-800 shrink-0 z-10">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
              Database Explorer
            </span>
          </div>
          <span className="bg-red-900/50 text-red-400 text-xs px-2 py-1 rounded border border-red-800/50">
            SUPER ADMIN MODE
          </span>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={handleExportSchema}
            className="flex items-center space-x-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <span>Export DDL Schema</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden z-0">
        {/* Left Sidebar */}
        <SidebarTree schemas={schemas} onTableClick={handleTableClick} />

        {/* Right Content */}
        <div className="flex flex-col flex-1 min-w-0 border-l border-gray-700 overflow-hidden">
          
          <AiCopilotBar 
            onGenerate={handleGenerateSql}
            onExplain={handleExplainSql}
            schemaStats={schemaStats}
            loading={aiLoading}
          />

          {/* Top Half: Editor */}
          <div className="flex flex-col flex-1 border-b border-gray-700 min-h-[30%]">
            <div className="flex justify-between items-center px-4 py-2 bg-gray-800/50 border-b border-gray-700">
              <span className="text-sm font-medium text-gray-400">SQL Console Editor</span>
              <button 
                onClick={() => executeQuery()}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>{loading ? 'Executing...' : 'Execute (F5)'}</span>
              </button>
            </div>
            <div className="flex-1 min-h-0 bg-[#1e1e1e]">
              <SqlEditorPane 
                value={activeQuery} 
                onChange={setActiveQuery} 
                onExecute={() => executeQuery()} 
              />
            </div>
          </div>

          {/* Bottom Half: Results */}
          <div className="flex flex-col flex-1 bg-gray-900 overflow-hidden min-h-[30%]">
            <div className="flex justify-between items-center px-4 py-2 bg-gray-800/50 border-b border-gray-700">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-400">Query Results</span>
                {queryResults && (
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-800/50">
                      {queryResults.rowCount} Rows
                    </span>
                    <span className="text-gray-400">
                      {(executionTime).toFixed(1)} ms
                    </span>
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <button onClick={() => handleExport('excel')} className="px-3 py-1 bg-emerald-700/80 hover:bg-emerald-600 rounded text-xs transition-colors flex items-center space-x-1">
                  <span>Excel</span>
                </button>
                <button onClick={() => handleExport('json')} className="px-3 py-1 bg-yellow-600/80 hover:bg-yellow-500 rounded text-xs transition-colors flex items-center space-x-1">
                  <span>JSON</span>
                </button>
                <button onClick={() => handleExport('txt')} className="px-3 py-1 bg-blue-700/80 hover:bg-blue-600 rounded text-xs transition-colors flex items-center space-x-1">
                  <span>TXT</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden relative">
              {error ? (
                <div className="absolute inset-0 p-4 bg-red-900/10 text-red-400 font-mono text-sm overflow-auto whitespace-pre-wrap">
                  {error}
                </div>
              ) : (
                <ResultsGrid results={queryResults} />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
