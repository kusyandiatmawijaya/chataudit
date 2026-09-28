import React from 'react';
import { MessageSquare, Smartphone, RefreshCw, Trash2, Plus } from 'lucide-react';
import { Button } from '../ui/Button';

export function DeviceSidebar({ 
  sessions, 
  activeSessionId, 
  activeView, 
  setActiveSessionId, 
  setActiveView, 
  setShowAddModal, 
  handleReinitializeDevice, 
  handleDeleteDevice 
}) {
  return (
    <aside className={`w-full lg:w-[280px] bg-white border-r border-slate-200 flex-col shadow-sm z-20 shrink-0 ${activeView === 'devices' ? 'flex' : 'hidden lg:flex'}`}>
      <div className="p-5 border-b border-slate-100 bg-emerald-600 text-white flex items-center gap-3">
        <MessageSquare className="w-6 h-6" />
        <h1 className="font-bold text-lg tracking-tight">Audit Dashboard</h1>
      </div>
      
      <div className="p-4 flex justify-between items-center bg-slate-50 border-b border-slate-200">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Devices ({sessions.length})</h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setShowAddModal(true)}
          className="shadow-sm"
          icon={Plus}
        >
          Add
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sessions.length === 0 ? (
          <div className="text-center p-6 text-slate-400">
            <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No devices linked.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div 
              key={session.sessionId}
              onClick={() => {
                setActiveSessionId(session.sessionId);
                setActiveView('chats');
              }}
              className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border group ${
                activeSessionId === session.sessionId 
                  ? 'bg-emerald-50 border-emerald-200 shadow-sm ring-1 ring-emerald-500/10' 
                  : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`relative flex items-center justify-center w-10 h-10 rounded-full ${activeSessionId === session.sessionId ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  <Smartphone className="w-5 h-5" />
                  {session.status === 'ready' && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full"></span>
                  )}
                  {session.status === 'disconnected' && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-rose-400 border-2 border-white rounded-full"></span>
                  )}
                  {session.status !== 'ready' && session.status !== 'disconnected' && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-amber-400 border-2 border-white rounded-full animate-pulse"></span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className={`text-sm font-semibold truncate ${activeSessionId === session.sessionId ? 'text-emerald-900' : 'text-slate-700'}`}>
                    {session.name}
                  </h3>
                  <p className="text-xs text-slate-500 capitalize">{session.status}</p>
                </div>
              </div>
              <div className="flex items-center">
                <button 
                  onClick={(e) => handleReinitializeDevice(session.sessionId, e)}
                  className={`p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-md transition ${activeSessionId === session.sessionId ? 'opacity-100' : 'opacity-60 lg:opacity-0 lg:group-hover:opacity-100'}`}
                  title="Re-initialize Device"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => handleDeleteDevice(session.sessionId, e)}
                  className={`p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition ${activeSessionId === session.sessionId ? 'opacity-100' : 'opacity-60 lg:opacity-0 lg:group-hover:opacity-100'}`}
                  title="Delete Device"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
