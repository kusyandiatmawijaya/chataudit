import React from 'react';
import { Download, Info, RefreshCw } from 'lucide-react';

const WidgetFooter = ({ timestamp, source, onRefresh, onExport }) => {
  return (
    <div className="bg-gray-50 border-t border-gray-100 px-4 py-2 flex items-center justify-between text-xs text-gray-500 rounded-b-lg">
      <div className="flex items-center space-x-3">
        <div className="flex items-center" title="Data Source">
          <Info className="w-3.5 h-3.5 mr-1" />
          <span>{source || 'System Data'}</span>
        </div>
        <div className="flex items-center text-gray-400">
          <RefreshCw className="w-3 h-3 mr-1" />
          <span>{timestamp ? new Date(timestamp).toLocaleString() : 'Just now'}</span>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        {onRefresh && (
          <button onClick={onRefresh} className="hover:text-blue-600 transition-colors" title="Refresh Data">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
        {onExport && (
          <button onClick={onExport} className="hover:text-blue-600 transition-colors flex items-center" title="Export">
            <Download className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default WidgetFooter;
