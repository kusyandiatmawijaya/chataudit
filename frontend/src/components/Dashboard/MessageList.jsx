import React, { Fragment } from 'react';
import { ProfilePic } from './ProfilePic';
import { MediaRenderer } from './MediaRenderer';
import { formatDateHeader, formatTime, getContactColor } from './helpers';

export function MessageList({
  currentChatMessages,
  activeSessionId,
  messagesEndRef,
  openLightbox,
  contactMap
}) {
  const formatMessageBody = (text) => {
    if (!text) return null;
    const parts = text.split(/(@\d+)/);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const num = part.slice(1);
        const name = contactMap.get(num) || (num === '72752635576464' ? 'Kusyandi Atmawijaya' : num);
        return <span key={i} className="text-emerald-600 font-semibold cursor-pointer hover:underline">@{name}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
      {currentChatMessages.map((msg, index) => {
        const msgDate = new Date(msg.timestamp).toDateString();
        const prevMsgDate = index > 0 ? new Date(currentChatMessages[index - 1].timestamp).toDateString() : null;
        const showDateHeader = index === 0 || msgDate !== prevMsgDate;

        return (
          <Fragment key={msg.id}>
            {showDateHeader && (
              <div className="flex justify-center my-4">
                <div className="bg-white/80 backdrop-blur-sm shadow-sm border border-slate-100 text-slate-500 text-xs px-3 py-1.5 rounded-full font-medium">
                  {formatDateHeader(msg.timestamp)}
                </div>
              </div>
            )}
            <div className={`flex ${msg.isFromMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className={`max-w-[85%] sm:max-w-[75%] flex min-w-0 ${msg.isFromMe ? 'flex-col items-end' : 'flex-row items-end gap-2'}`}>
                
                {/* Avatar for incoming group messages */}
                {!msg.isFromMe && !!msg.authorId && (
                  <ProfilePic 
                    sessionId={activeSessionId}
                    contactId={msg.authorId}
                    isGroup={false}
                    name={msg.authorName || msg.authorId}
                    className="w-7 h-7 mb-1 shrink-0"
                  />
                )}

                <div className="flex flex-col min-w-0">
                  <div className={`relative px-4 py-2 shadow-sm ${
                    msg.isFromMe 
                      ? 'bg-emerald-100 text-emerald-900 rounded-2xl rounded-tr-sm' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm'
                  }`}>
                    {!msg.isFromMe && !!msg.authorId && (
                      <p 
                        className="text-[11.5px] font-bold mb-0.5"
                        style={{ color: getContactColor(msg.authorName || msg.authorId) }}
                      >
                        {msg.authorName || msg.authorId}
                      </p>
                    )}
                    {msg.messageBody && !(msg.mediaUrl && /\.[a-z0-9]+$/i.test(msg.messageBody.trim()) && msg.messageBody.trim().split(/\s+/).length === 1) && !msg.messageBody.startsWith('[Sent a file:') && (
                      <p className="text-[14.5px] whitespace-pre-wrap break-words leading-relaxed">{formatMessageBody(msg.messageBody)}</p>
                    )}
                    <div className="text-[10px] text-right mt-1 opacity-60">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                  <MediaRenderer msg={msg} openLightbox={openLightbox} />
                </div>
              </div>
            </div>
          </Fragment>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
