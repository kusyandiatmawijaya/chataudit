import React, { useState } from 'react';
import { Database, Table, Eye, ChevronRight, ChevronDown } from 'lucide-react';

export const SidebarTree = ({ schemas, onTableClick }) => {
  const [expandedSchemas, setExpandedSchemas] = useState({});

  const toggleSchema = (schema) => {
    setExpandedSchemas(prev => ({
      ...prev,
      [schema]: !prev[schema]
    }));
  };

  const schemaNames = Object.keys(schemas || {});

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col h-full overflow-hidden shrink-0">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Database Objects</span>
        <Database className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {schemaNames.length === 0 ? (
          <div className="text-gray-500 text-sm text-center mt-4">Loading schemas...</div>
        ) : (
          schemaNames.map(schema => {
            const isExpanded = expandedSchemas[schema];
            const { tables, views } = schemas[schema];
            return (
              <div key={schema} className="mb-1">
                <button 
                  onClick={() => toggleSchema(schema)}
                  className="w-full flex items-center space-x-2 p-1.5 hover:bg-gray-700 rounded text-sm text-gray-300 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <Database className="w-4 h-4 text-blue-400" />
                  <span className="font-medium truncate">{schema}</span>
                </button>
                
                {isExpanded && (
                  <div className="ml-6 mt-1 space-y-0.5 border-l border-gray-700 pl-2">
                    {/* Tables */}
                    {tables.length > 0 && (
                      <div className="mb-2">
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 pl-1">Tables</div>
                        {tables.map(table => (
                          <button
                            key={table}
                            onClick={() => onTableClick(schema, table)}
                            className="w-full flex items-center space-x-2 p-1 hover:bg-gray-700 rounded text-sm text-gray-400 hover:text-gray-200 transition-colors"
                            title={table}
                          >
                            <Table className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="truncate text-left">{table}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Views */}
                    {views.length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 pl-1">Views</div>
                        {views.map(view => (
                          <button
                            key={view}
                            onClick={() => onTableClick(schema, view)}
                            className="w-full flex items-center space-x-2 p-1 hover:bg-gray-700 rounded text-sm text-gray-400 hover:text-gray-200 transition-colors"
                            title={view}
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate text-left">{view}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
