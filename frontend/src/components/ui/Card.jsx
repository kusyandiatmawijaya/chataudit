import React from 'react';

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', title, action }) {
  return (
    <div className={`px-6 py-4 border-b border-slate-100 flex justify-between items-center ${className}`}>
      {title ? <h3 className="font-bold text-lg">{title}</h3> : children}
      {action && <div>{action}</div>}
    </div>
  );
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 ${className}`}>
      {children}
    </div>
  );
}
