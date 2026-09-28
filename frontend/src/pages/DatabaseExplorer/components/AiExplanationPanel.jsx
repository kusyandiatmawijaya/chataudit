import React from 'react';
import { X, Bot, FileText, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export const AiExplanationPanel = ({ explanation, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-full sm:w-96 bg-gray-900 border-l border-gray-700 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center space-x-2 text-indigo-400 font-medium">
          <Bot className="w-5 h-5" />
          <span>AI Explanation</span>
        </div>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 text-sm text-gray-300 custom-scrollbar bg-[#1e1e1e]">
        {explanation ? (
          <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-700 prose-a:text-indigo-400">
            <ReactMarkdown>{explanation}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
            <FileText className="w-12 h-12 opacity-20" />
            <p className="text-center px-4">No explanation generated yet.<br/>Click 'Explain' to understand your SQL query.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-800 border-t border-gray-700 shrink-0 text-xs text-gray-500 flex justify-between items-center">
        <div className="flex items-center space-x-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Schema-Aware Analysis</span>
        </div>
        <span>Powered by Analytical AI</span>
      </div>
    </div>
  );
};
