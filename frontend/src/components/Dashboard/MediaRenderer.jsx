import React from 'react';
import { FileText, Download, MapPin } from 'lucide-react';
import { API_URL } from '../../config';

const SOCKET_URL = API_URL || window.location.origin;

export function MediaRenderer({ msg, openLightbox }) {
  if (!msg.mediaUrl) return null;
  
  let urlPath = msg.mediaUrl;
  if (urlPath.startsWith('/uploads/')) {
    urlPath = `/api${urlPath}`;
  }
  const fullUrl = `${SOCKET_URL}${urlPath}`;
  const isImage = msg.mediaType?.startsWith('image/');
  
  if (isImage) {
    return (
      <div 
        className="mt-3 max-w-sm rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => openLightbox(msg.id)}
      >
        <img src={fullUrl} alt="Attached media" className="w-full h-auto object-cover" loading="lazy" />
      </div>
    );
  }

  const isLocation = msg.mediaType === 'location';
  if (isLocation) {
    return (
      <a 
        href={msg.mediaUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="mt-2 flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors group w-full max-w-sm shadow-sm"
      >
        <div className="p-3 rounded-xl flex shrink-0 bg-blue-100 text-blue-600">
          <MapPin className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-sm font-semibold text-slate-800 truncate mb-0.5">
            Lokasi Dibagikan
          </p>
          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
            Buka di Google Maps
          </p>
        </div>
      </a>
    );
  }

  const isPdf = msg.mediaType === 'application/pdf';
  let fileName = 'Document';
  const isJustFilename = msg.messageBody && /\.[a-z0-9]+$/i.test(msg.messageBody.trim()) && msg.messageBody.trim().split(/\s+/).length === 1;
  
  if (isJustFilename) {
    fileName = msg.messageBody.trim();
  } else if (isPdf) {
    fileName = 'PDF Document';
  }

  return (
    <a 
      href={fullUrl} 
      target="_blank" 
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors group w-full max-w-sm shadow-sm"
    >
      <div className={`p-3 rounded-xl flex shrink-0 ${isPdf ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
        <FileText className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="text-sm font-semibold text-slate-800 truncate mb-0.5" title={fileName}>
          {fileName}
        </p>
        <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
          {msg.mediaType?.split('/')[1] || 'FILE'}
        </p>
      </div>
      <div className="p-2 shrink-0">
        <Download className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
      </div>
    </a>
  );
}
