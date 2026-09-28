import React from 'react';
import { Search, ChevronLeft, EyeOff } from 'lucide-react';
import { ProfilePic } from './ProfilePic';
import { formatTime } from './helpers';

export function ChatList({
  activeView,
  setActiveView,
  chatSearchQuery,
  setChatSearchQuery,
  dateRange,
  setDateRange,
  chats,
  activeChatId,
  setActiveChatId,
  activeSessionId,
  unreadCounts,
  excludedChats,
  setShowExclusionsModal
}) {
  const filteredChats = chats.filter(chat => 
    (chat.name || chat.id).toLowerCase().includes(chatSearchQuery.toLowerCase())
  );

  return (
    <div className={`w-full md:w-[320px] border-r border-slate-200 bg-white flex flex-col shrink-0 ${activeView === 'chats' ? 'flex' : 'hidden md:flex'}`}>
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveView('devices')}
              className="lg:hidden p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition shrink-0"
              title="Back to Devices"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="font-semibold text-sm text-slate-700">Chats & Groups</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExclusionsModal(true)}
              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors relative"
              title="Manage Excluded Chats"
            >
              <EyeOff className="w-4 h-4" />
              {excludedChats.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-white"></span>
              )}
            </button>
            <button
              onClick={() => setActiveView('devices')}
              className="hidden md:inline-flex lg:hidden text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Switch Device
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search chats..." 
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Start Date</label>
              <input 
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">End Date</label>
              <input 
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {chatSearchQuery ? 'No chats match your search.' : 'No conversations yet.'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredChats.map(chat => (
              <li 
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id);
                  setActiveView('messages');
                }}
                className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${activeChatId === chat.id ? 'bg-emerald-50/50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <ProfilePic 
                    sessionId={activeSessionId} 
                    contactId={chat.id} 
                    isGroup={chat.isGroup} 
                    name={chat.name}
                    className="w-10 h-10" 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="text-sm font-semibold text-slate-900 truncate pr-2">{chat.name}</h4>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {formatTime(chat.lastMessage.timestamp)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate -mt-1 mb-1">{chat.id}</p>
                    <div className="flex justify-between items-center gap-2 mt-1">
                      <p className="text-xs text-slate-500 truncate flex-1">
                        {chat.lastMessage.isFromMe 
                          ? 'You: ' 
                          : chat.lastMessage.authorName 
                            ? `${chat.lastMessage.authorName}: ` 
                            : ''}
                        {chat.lastMessage.messageBody}
                      </p>
                      {unreadCounts[chat.id] > 0 && (
                        <span className="bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center shrink-0">
                          {unreadCounts[chat.id]}
                        </span>
                      )}
                      {excludedChats.some(ec => ec.chatId === chat.id) && (
                        <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
