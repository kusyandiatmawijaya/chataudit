import React, { useState } from 'react';
import { EyeOff, Eye, Loader2, CheckCircle, Search } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export function ManageExclusionsModal({ isOpen, onClose, excludedChats, onRemoveExclusion }) {
  const [loadingId, setLoadingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleRemove = async (chatId) => {
    setLoadingId(chatId);
    try {
      await onRemoveExclusion(chatId);
    } finally {
      setLoadingId(null);
    }
  };

  const filteredChats = excludedChats.filter(chat => 
    (chat.name || chat.chatId).toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.chatId.includes(searchQuery)
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Excluded Chats" icon={EyeOff} maxWidth="max-w-lg">
      <div className="flex flex-col h-[60vh]">
        <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <p className="text-sm text-slate-600 mb-3">
            These contacts are currently excluded. Their messages will not be saved or monitored.
          </p>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search excluded chats..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {excludedChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">No excluded chats</p>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <p className="text-sm">No matches found</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredChats.map((chat) => (
                <li key={chat.chatId} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-emerald-200 transition-colors">
                  <div className="min-w-0 flex-1 pr-4">
                    <h4 className="text-sm font-semibold text-slate-800 truncate">
                      {chat.name || chat.chatId}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">{chat.chatId}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemove(chat.chatId)}
                    disabled={loadingId === chat.chatId}
                    className="shrink-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                    icon={loadingId === chat.chatId ? Loader2 : Eye}
                  >
                    {loadingId === chat.chatId ? 'Resuming...' : 'Resume'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
