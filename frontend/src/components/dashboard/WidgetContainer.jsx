import React from 'react';
import WidgetFooter from './WidgetFooter';
import { Settings, Maximize2, MoreVertical, Trash2 } from 'lucide-react';

const WidgetContainer = ({ title, children, source, timestamp, onExport, onRefresh, onSettings, onDelete }) => {
  return (
    <div className="group flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-white cursor-move drag-handle">
        <h3 className="font-semibold text-gray-800 truncate">{title}</h3>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onSettings && (
            <button onClick={onSettings} className="p-1 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50" title="Widget Settings">
              <Settings className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50" title="Delete Widget">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button className="p-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button className="p-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-grow p-4 overflow-auto relative">
        {children}
      </div>
      
      {/* Footer */}
      <WidgetFooter 
        timestamp={timestamp} 
        source={source} 
        onExport={onExport}
        onRefresh={onRefresh}
      />
    </div>
  );
};

export default WidgetContainer;
