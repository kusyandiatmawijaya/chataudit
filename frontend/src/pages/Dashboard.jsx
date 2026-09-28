import React, { useState, useEffect, useRef, useMemo } from 'react';
import io from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import axios from 'axios';
import { API_URL } from '../config';
import { Smartphone, CheckCircle, XCircle, Loader2, SidebarOpen, Settings, EyeOff, Eye, RefreshCw, Bot, ChevronLeft, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Extracted Components
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ProfilePic } from '../components/Dashboard/ProfilePic';
import { DeviceSidebar } from '../components/Dashboard/DeviceSidebar';
import { ChatList } from '../components/Dashboard/ChatList';
import { MessageList } from '../components/Dashboard/MessageList';
import { AddDeviceModal } from '../components/Dashboard/AddDeviceModal';
import { AiAnalysisModal } from '../components/Dashboard/AiAnalysisModal';
import { ManageExclusionsModal } from '../components/Dashboard/ManageExclusionsModal';

const SOCKET_URL = API_URL || window.location.origin;

export default function Dashboard() {
  const [socket, setSocket] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [activeView, setActiveView] = useState('devices');
  const [excludedChats, setExcludedChats] = useState([]);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [syncState, setSyncState] = useState({ isSyncing: false, progress: '', error: null, completed: false, count: 0 });
  
  const defaultEndDate = new Date();
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 2);
  const [dateRange, setDateRange] = useState({
    start: defaultStartDate.toISOString().split('T')[0],
    end: defaultEndDate.toISOString().split('T')[0]
  });
  
  const activeSessionRef = useRef(activeSessionId);
  const activeChatRef = useRef(activeChatId);

  useEffect(() => { activeSessionRef.current = activeSessionId; }, [activeSessionId]);
  useEffect(() => { 
    activeChatRef.current = activeChatId; 
    if (activeChatId) {
      setUnreadCounts(prev => ({ ...prev, [activeChatId]: 0 }));
      setSyncState({ isSyncing: false, progress: '', error: null, completed: false, count: 0 });
      setActiveView('messages');
    }
  }, [activeChatId]);
  
  const [qrCodes, setQrCodes] = useState({});
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExclusionsModal, setShowExclusionsModal] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiError, setAiError] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiIncludeMedia, setAiIncludeMedia] = useState(false);
  const todayStr = () => new Date().toISOString().split('T')[0];
  const [aiDateFrom, setAiDateFrom] = useState(todayStr());
  const [aiDateTo, setAiDateTo] = useState('');
  const [isAiPeriodCollapsibleOpen, setIsAiPeriodCollapsibleOpen] = useState(false);
  const [isAiMediaCollapsibleOpen, setIsAiMediaCollapsibleOpen] = useState(false);
  const [aiMsgCount, setAiMsgCount] = useState(null);
  const [isCopied, setIsCopied] = useState(false);

  const messagesEndRef = useRef(null);

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${SOCKET_URL}/api/sessions`);
      if (Array.isArray(res.data)) {
        setSessions(res.data);
      } else {
        setSessions([]);
      }
      if (Array.isArray(res.data) && res.data.length > 0 && !activeSessionId) {
        setActiveSessionId(res.data[0].sessionId);
        setActiveView('chats');
      }
    } catch (err) {
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
  };

  const fetchMessages = async (sessionId) => {
    try {
      const msgsRes = await axios.get(`${SOCKET_URL}/api/messages`, { params: { sessionId, startDate: dateRange.start, endDate: dateRange.end } });
      if (Array.isArray(msgsRes.data)) {
        setMessages(msgsRes.data.reverse());
      } else {
        setMessages([]);
      }
    } catch (err) {}
  };

  const fetchExclusions = async (sessionId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${SOCKET_URL}/api/sessions/${sessionId}/exclusions`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      setExcludedChats(res.data || []);
    } catch (err) {}
  };

  useEffect(() => {
    fetchSessions();
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('qr', ({ sessionId, qr }) => {
      setQrCodes(prev => ({ ...prev, [sessionId]: qr }));
      setSessions(prev => prev.map(s => s.sessionId === sessionId ? { ...s, status: 'initializing' } : s));
    });

    newSocket.on('ready', ({ sessionId }) => {
      setQrCodes(prev => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      setSessions(prev => prev.map(s => s.sessionId === sessionId ? { ...s, status: 'ready' } : s));
    });

    newSocket.on('disconnected', ({ sessionId }) => {
      setSessions(prev => prev.map(s => s.sessionId === sessionId ? { ...s, status: 'disconnected' } : s));
    });

    newSocket.on('sync_progress', ({ sessionId, chatId, progress }) => {
      if (sessionId === activeSessionRef.current && chatId === activeChatRef.current) {
        setSyncState(prev => ({ ...prev, isSyncing: true, progress, error: null, completed: false }));
      }
    });

    newSocket.on('sync_complete', ({ sessionId, chatId, error, message, savedCount }) => {
      if (sessionId === activeSessionRef.current && chatId === activeChatRef.current) {
        setSyncState({ isSyncing: false, progress: message, error: error ? message : null, completed: !error, count: savedCount || 0 });
        if (!error) setTimeout(() => setSyncState(prev => ({ ...prev, progress: '', completed: false })), 5000);
      }
    });

    newSocket.on('new_message', (msg) => {
      if (msg.sessionId === activeSessionRef.current) {
        setMessages((prev) => [...prev, msg]);
      }
      const isGroup = msg.receiver.includes('-') || msg.receiver.length > 15;
      const chatId = isGroup ? msg.receiver : (msg.isFromMe ? msg.receiver : msg.sender);
      if (chatId !== activeChatRef.current && !msg.isFromMe) {
        setUnreadCounts(prev => ({ ...prev, [chatId]: (prev[chatId] || 0) + 1 }));
      }
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      fetchMessages(activeSessionId);
      fetchExclusions(activeSessionId);
      setActiveChatId(null);
      setActiveView('chats');
    } else {
      setActiveView('devices');
    }
  }, [activeSessionId, dateRange.start, dateRange.end]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChatId]);

  const handleAddDevice = async (name) => {
    try {
      const res = await axios.post(`${SOCKET_URL}/api/sessions`, { name });
      setSessions([res.data, ...sessions]);
      setActiveSessionId(res.data.sessionId);
      setShowAddModal(false);
    } catch (err) {}
  };

  const handleReinitializeDevice = async (sessionId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to re-initialize this device?')) return;
    try {
      await axios.post(`${SOCKET_URL}/api/sessions/${sessionId}/reinitialize`);
      setSessions(sessions.map(s => s.sessionId === sessionId ? { ...s, status: 'initializing' } : s));
    } catch (err) {}
  };

  const handleDeleteDevice = async (sessionId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this device?')) return;
    try {
      await axios.delete(`${SOCKET_URL}/api/sessions/${sessionId}`);
      setSessions(sessions.filter(s => s.sessionId !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
        setActiveChatId(null);
      }
    } catch (err) {}
  };

  const handleAiAnalysis = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim() || !activeChatId) return;
    setIsAnalyzing(true);
    setAiResult('');
    setAiError(null);
    try {
      const res = await axios.post(`${SOCKET_URL}/api/analyze-chat`, {
        sessionId: activeSessionId,
        contactNumber: activeChatId,
        userPrompt: aiPrompt,
        dateFrom: aiDateFrom || undefined,
        dateTo: aiDateTo || undefined,
        includeMedia: aiIncludeMedia
      });
      if (res.data.success) {
        setAiResult(res.data.analysis);
      } else {
        setAiError({ error: res.data.error || 'Failed to analyze' });
      }
    } catch (err) {
      setAiError({ error: err.response?.data?.error || err.message || 'Error occurred.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSyncChat = async () => {
    if (!activeSessionId || !activeChatId) return;
    setSyncState({ isSyncing: true, progress: 'Starting sync...', error: null, completed: false, count: 0 });
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${SOCKET_URL}/api/sessions/${activeSessionId}/sync-chat`, { chatId: activeChatId }, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      // the toast logic can stay or not, but original code just did `setSyncState`
    } catch (err) {
      setSyncState({ isSyncing: false, progress: '', error: 'Failed to connect to server', completed: false, count: 0 });
    }
  };

  const handleCopyResult = () => {
    if (!aiResult) return;
    navigator.clipboard.writeText(aiResult).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const toggleExclusion = async () => {
    if (!activeSessionId || !activeChatId) return;
    const isExcluded = excludedChats.some(ec => ec.chatId === activeChatId);
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      if (isExcluded) {
        await axios.delete(`${SOCKET_URL}/api/sessions/${activeSessionId}/exclusions/${activeChatId}`, { headers });
        setExcludedChats(prev => prev.filter(ec => ec.chatId !== activeChatId));
      } else {
        const res = await axios.post(`${SOCKET_URL}/api/sessions/${activeSessionId}/exclusions`, {
          chatId: activeChatId,
          name: chats.find(c => c.id === activeChatId)?.name || activeChatId
        }, { headers });
        setExcludedChats(prev => [...prev, res.data]);
      }
    } catch (err) {}
  };

  const removeExclusion = async (chatId) => {
    if (!activeSessionId || !chatId) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${SOCKET_URL}/api/sessions/${activeSessionId}/exclusions/${chatId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      setExcludedChats(prev => prev.filter(ec => ec.chatId !== chatId));
    } catch (err) {}
  };

  const openLightbox = (msgId) => {
    const imageMsgs = currentChatMessages.filter(m => m.mediaType?.startsWith('image/'));
    const images = imageMsgs.map(m => `${SOCKET_URL}${m.mediaUrl.startsWith('/uploads/') ? `/api${m.mediaUrl}` : m.mediaUrl}`);
    setLightboxImages(images);
    
    const selectedMsg = imageMsgs.find(m => m.id === msgId);
    if (selectedMsg) {
      const selectedUrl = `${SOCKET_URL}${selectedMsg.mediaUrl.startsWith('/uploads/') ? `/api${selectedMsg.mediaUrl}` : selectedMsg.mediaUrl}`;
      const index = images.findIndex(url => url === selectedUrl);
      setLightboxIndex(index >= 0 ? index : 0);
    } else {
      setLightboxIndex(0);
    }
    setLightboxOpen(true);
  };

  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const safeMessages = Array.isArray(messages) ? messages : [];

  const activeSession = safeSessions.find(s => s.sessionId === activeSessionId);
  const activeMessages = safeMessages.filter(m => m.sessionId === activeSessionId).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));

  const chats = useMemo(() => {
    const chatMap = new Map();
    activeMessages.forEach(msg => {
      const partnerId = msg.isFromMe ? msg.receiver : msg.sender;
      if (!chatMap.has(partnerId)) {
        chatMap.set(partnerId, {
          id: partnerId,
          name: msg.chatName || partnerId,
          lastMessage: msg,
          isGroup: partnerId.includes('-') || partnerId.length > 15
        });
      } else {
        const current = chatMap.get(partnerId);
        if (new Date(msg.timestamp) > new Date(current.lastMessage.timestamp)) {
          chatMap.set(partnerId, { ...current, name: msg.chatName || current.name, lastMessage: msg });
        }
      }
    });
    return Array.from(chatMap.values()).sort((a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp));
  }, [activeMessages]);

  const currentChatMessages = activeMessages.filter(msg => {
    const partnerId = msg.isFromMe ? msg.receiver : msg.sender;
    return partnerId === activeChatId;
  });

  const contactMap = useMemo(() => {
    const map = new Map();
    safeSessions.forEach(s => {
      if (s.sessionId && s.name) map.set(s.sessionId.split(':')[0].split('@')[0], s.name);
    });
    activeMessages.forEach(msg => {
      if (msg.sender && msg.chatName) map.set(msg.sender.split('@')[0], msg.chatName);
      if (msg.authorId && msg.authorName) map.set(msg.authorId.split('@')[0], msg.authorName);
    });
    map.set('72752635576464', 'Kusyandi Atmawijaya'); 
    return map;
  }, [sessions, activeMessages]);

  return (
    <>
      <DeviceSidebar 
        sessions={sessions}
        activeSessionId={activeSessionId}
        activeView={activeView}
        setActiveSessionId={setActiveSessionId}
        setActiveView={setActiveView}
        setShowAddModal={setShowAddModal}
        handleReinitializeDevice={handleReinitializeDevice}
        handleDeleteDevice={handleDeleteDevice}
      />

      <main className={`flex-1 flex flex-col bg-slate-50/50 relative overflow-hidden ${activeView !== 'devices' ? 'flex' : 'hidden lg:flex'}`}>
        {activeSessionId ? (
          <>
            <header className="h-16 px-4 sm:px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 z-10 gap-3">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button 
                  onClick={() => setActiveView('devices')}
                  className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition shrink-0"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="min-w-0">
                  <h2 className="font-bold text-base sm:text-lg text-slate-800 truncate">{activeSession?.name}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {activeSession?.status === 'ready' ? (
                      <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span className="text-[10px] sm:text-xs font-medium text-slate-500">Connected & Live</span></>
                    ) : activeSession?.status === 'disconnected' ? (
                      <><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span className="text-[10px] sm:text-xs font-medium text-slate-500">Disconnected</span></>
                    ) : (
                      <><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span><span className="text-[10px] sm:text-xs font-medium text-slate-500">Pending Authorization...</span></>
                    )}
                  </div>
                </div>
              </div>
            </header>

            {activeSession?.status !== 'ready' && activeSession?.status !== 'disconnected' ? (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center">
                <div className="max-w-md w-full mx-auto mt-6 sm:mt-12 bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 text-center animate-fade-in">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                    <Smartphone className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-2">Link Device</h3>
                  <p className="text-slate-500 mb-6 sm:mb-8 text-xs sm:text-sm leading-relaxed">
                    Open WhatsApp on <strong>{activeSession?.name}</strong>'s phone, go to Linked Devices, and scan the QR code below.
                  </p>
                  
                  <div className="flex justify-center mb-6">
                    {qrCodes[activeSession.sessionId] ? (
                      <div className="p-3 sm:p-4 bg-white border-2 border-dashed border-emerald-200 rounded-xl">
                        <QRCodeSVG value={qrCodes[activeSession.sessionId]} size={180} className="sm:w-[220px] sm:h-[220px]" />
                      </div>
                    ) : (
                      <div className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] bg-slate-50 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-200">
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 animate-spin" />
                          <span className="text-slate-400 text-xs sm:text-sm font-medium">Generating QR...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex overflow-hidden">
                <ChatList 
                  activeView={activeView}
                  setActiveView={setActiveView}
                  chatSearchQuery={chatSearchQuery}
                  setChatSearchQuery={setChatSearchQuery}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  chats={chats}
                  activeChatId={activeChatId}
                  setActiveChatId={setActiveChatId}
                  activeSessionId={activeSessionId}
                  unreadCounts={unreadCounts}
                  excludedChats={excludedChats}
                  setShowExclusionsModal={setShowExclusionsModal}
                />

                <div className={`flex-1 flex flex-col bg-[#f0f2f5] min-w-0 ${activeView === 'messages' ? 'flex' : 'hidden md:flex'}`}>
                  {activeChatId ? (
                    <>
                      <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm z-10 shrink-0 gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <button 
                            onClick={() => {
                              setActiveChatId(null);
                              setActiveView('chats');
                            }}
                            className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition shrink-0"
                          >
                            <ChevronLeft className="w-5.5 h-5.5" />
                          </button>
                          <ProfilePic 
                            sessionId={activeSessionId} 
                            contactId={activeChatId} 
                            isGroup={activeChatId.includes('-') || activeChatId.length > 15} 
                            name={chats.find(c => c.id === activeChatId)?.name || activeChatId}
                            className="w-8 h-8 sm:w-10 sm:h-10" 
                          />
                          <div className="min-w-0">
                            <h3 className="font-semibold text-slate-800 leading-tight text-sm sm:text-base truncate">
                              {chats.find(c => c.id === activeChatId)?.name || activeChatId}
                            </h3>
                            <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">{activeChatId}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleExclusion}
                            className={excludedChats.some(ec => ec.chatId === activeChatId) ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200' : ''}
                            icon={excludedChats.some(ec => ec.chatId === activeChatId) ? Eye : EyeOff}
                          >
                            <span className="hidden sm:inline">{excludedChats.some(ec => ec.chatId === activeChatId) ? 'Resume Monitoring' : 'Exclude Chat'}</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSyncChat}
                            disabled={syncState.isSyncing}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                            icon={RefreshCw}
                          >
                            <span className="hidden sm:inline">Get History</span>
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => { setShowAiModal(true); setAiResult(''); setAiError(null); setAiMsgCount(null); setAiDateFrom(todayStr()); setAiDateTo(''); setAiIncludeMedia(false); }}
                            icon={Bot}
                          >
                            <span className="hidden sm:inline">AI Analyze</span>
                          </Button>
                        </div>
                      </div>
                      
                      {excludedChats.some(ec => ec.chatId === activeChatId) && (
                        <div className="bg-amber-100 border-y border-amber-200 px-4 py-2 flex items-center justify-center gap-2 text-amber-800 text-xs font-medium shadow-inner shrink-0 z-10">
                          <EyeOff className="w-4 h-4" />
                          This chat is currently excluded. New messages will not be saved or monitored.
                        </div>
                      )}

                      {syncState.progress && (
                        <div className={`px-4 py-2 flex items-center justify-center gap-2 text-xs font-medium shadow-inner shrink-0 z-10 ${
                          syncState.error ? 'bg-rose-100 border-y border-rose-200 text-rose-800' :
                          syncState.completed ? 'bg-emerald-100 border-y border-emerald-200 text-emerald-800' :
                          'bg-indigo-100 border-y border-indigo-200 text-indigo-800'
                        }`}>
                          {syncState.isSyncing && <Loader2 className="w-4 h-4 animate-spin" />}
                          {!syncState.isSyncing && syncState.completed && <CheckCircle className="w-4 h-4" />}
                          {!syncState.isSyncing && syncState.error && <XCircle className="w-4 h-4" />}
                          {syncState.progress}
                        </div>
                      )}

                      <MessageList 
                        currentChatMessages={currentChatMessages}
                        activeSessionId={activeSessionId}
                        messagesEndRef={messagesEndRef}
                        openLightbox={openLightbox}
                        contactMap={contactMap}
                      />
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center flex-col text-slate-400 p-6 text-center">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                         <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
                      </div>
                      <p className="text-base sm:text-lg font-medium text-slate-600">No Chat Selected</p>
                      <p className="text-xs sm:text-sm mt-1">Select a conversation from the list to view messages.</p>
                      <button 
                        onClick={() => setActiveView('chats')}
                        className="md:hidden mt-4 px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-emerald-700 transition"
                      >
                        Show Chats
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col text-slate-400 p-6 text-center">
            <SidebarOpen className="w-12 h-12 sm:w-16 sm:h-16 mb-4 opacity-20" />
            <p className="text-base sm:text-lg font-medium text-slate-600">Select a device to view activity</p>
            <p className="text-xs sm:text-sm mt-1">Or click Add in the sidebar to link a new WhatsApp device.</p>
          </div>
        )}
      </main>

      <AddDeviceModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        onAdd={handleAddDevice} 
      />

      <AiAnalysisModal 
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        chats={chats}
        activeChatId={activeChatId}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        aiDateFrom={aiDateFrom}
        setAiDateFrom={setAiDateFrom}
        aiDateTo={aiDateTo}
        setAiDateTo={setAiDateTo}
        aiIncludeMedia={aiIncludeMedia}
        setAiIncludeMedia={setAiIncludeMedia}
        isAiPeriodCollapsibleOpen={isAiPeriodCollapsibleOpen}
        setIsAiPeriodCollapsibleOpen={setIsAiPeriodCollapsibleOpen}
        isAiMediaCollapsibleOpen={isAiMediaCollapsibleOpen}
        setIsAiMediaCollapsibleOpen={setIsAiMediaCollapsibleOpen}
        isAnalyzing={isAnalyzing}
        handleAiAnalysis={handleAiAnalysis}
        aiError={aiError}
        aiResult={aiResult}
        aiMsgCount={aiMsgCount}
        isCopied={isCopied}
        handleCopyResult={handleCopyResult}
        todayStr={todayStr}
      />

      <ManageExclusionsModal 
        isOpen={showExclusionsModal}
        onClose={() => setShowExclusionsModal(false)}
        excludedChats={excludedChats}
        onRemoveExclusion={removeExclusion}
      />

      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col backdrop-blur-sm" onClick={() => setLightboxOpen(false)}>
          <div className="absolute top-4 right-4 z-50">
            <button onClick={() => setLightboxOpen(false)} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
              <XCircle className="w-8 h-8" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 relative" onClick={(e) => e.stopPropagation()}>
            <img 
              src={lightboxImages[lightboxIndex]} 
              alt="Media fullscreen" 
              className="max-w-full max-h-[85vh] object-contain transition-transform duration-200"
            />
          </div>
        </div>
      )}
    </>
  );
}
