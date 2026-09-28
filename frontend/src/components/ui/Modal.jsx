import React from 'react';
import { XCircle } from 'lucide-react';

export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md', icon: Icon }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} overflow-hidden animate-fade-in flex flex-col max-h-[90vh]`}>
        {title && (
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2 text-slate-800">
              {Icon && <Icon className="w-5 h-5 text-indigo-600" />}
              <h3 className="font-bold text-lg">{title}</h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
