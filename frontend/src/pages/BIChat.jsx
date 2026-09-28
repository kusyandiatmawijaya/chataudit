import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Send, Bot, Database, Loader2, Sparkles, BarChart3, BrainCircuit, CalendarClock, Store, TrendingUp, Zap, X, ChevronRight, Copy, Check, AlertTriangle, ExternalLink, Info, Image as ImageIcon, BookmarkPlus } from 'lucide-react';
import SaveToIssueModal from '../components/SaveToIssueModal';

// Dynamic AI models are fetched from backend
import axios from 'axios';
import { API_URL } from '../config';

const SUGGESTIONS = [
  "Berapa total AR jatuh tempo?",
  "Tampilkan 5 toko dengan piutang terbesar",
  "Analisa komplain cicilan di percakapan TapTalk 7 hari terakhir",
  "Cari toko yang komplain barang tidak diterima di OneTalk"
];

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: "Halo! Saya adalah AI Business Analyst Anda. Saya terhubung dengan database AR dan siap membantu Anda:\n\n📊 **Analisa Data Piutang & AR** — Total piutang, toko dengan AR tertinggi, perbandingan periode\n💬 **Analisa Komplain Percakapan TapTalk/OneTalk** — Deteksi komplain cicilan (AR dispute) dan komplain barang tidak diterima (GR dispute), lengkap dengan lookup kode toko dan cek data piutang terkait\n🔍 **Identifikasi Customer Tanpa Kode** — Cari data toko di database customers berdasarkan nomor HP dari percakapan\n\nApa yang ingin Anda analisa hari ini?"
};


const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const formatMarkdown = (rawText) => {
  if (!rawText) return '';
  let text = rawText;
  
  // 1. Force a double newline before the first pipe if it's preceded by text on the same line (e.g., "terbesar: | No |")
  text = text.replace(/([^\n|])\s+(\|.*\|\s*\|\s*-+)/g, "$1\n\n$2");
  
  // 2. Fix squashed markdown tables by replacing "| |" with a proper newline "|\n|"
  text = text.replace(/\|\s*\|/g, '|\n|');
  
  return text;
};

const DynamicChart = ({ chartData, isMobile }) => {
  if (!chartData || !chartData.data || !chartData.type) return null;

  const { type, data, xAxis, yAxis } = chartData;

  return (
    <div className="w-full h-64 mt-6 bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'bar' && (
          <BarChart data={data} margin={{ top: 10, right: 10, left: isMobile ? -20 : 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey={xAxis} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: isMobile ? 10 : 12}} minTickGap={15} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: isMobile ? 10 : 12}} />
            <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
            <Legend wrapperStyle={{fontSize: isMobile ? '10px' : '12px'}} />
            <Bar dataKey={yAxis} fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
        {type === 'line' && (
          <LineChart data={data} margin={{ top: 10, right: 10, left: isMobile ? -20 : 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey={xAxis} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: isMobile ? 10 : 12}} minTickGap={15} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: isMobile ? 10 : 12}} />
            <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
            <Legend wrapperStyle={{fontSize: isMobile ? '10px' : '12px'}} />
            <Line type="monotone" dataKey={yAxis} stroke="#3b82f6" strokeWidth={2} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
          </LineChart>
        )}
        {type === 'pie' && (
          <PieChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
            <Legend wrapperStyle={{fontSize: isMobile ? '10px' : '12px'}} />
            <Pie data={data} dataKey={yAxis} nameKey={xAxis} cx="50%" cy="50%" outerRadius={isMobile ? 60 : 80} fill="#3b82f6" label={!isMobile}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

const BIChat = () => {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  
  // Issue Modal States
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [selectedSummaryForIssue, setSelectedSummaryForIssue] = useState('');
  const [selectedQueryForIssue, setSelectedQueryForIssue] = useState({});

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };
  
  // Prompt Hub States
  const [showAiModal, setShowAiModal] = useState(false);
  const [promptTemplates, setPromptTemplates] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  
  // Lookups
  const [devices, setDevices] = useState([]);
  const [chats, setChats] = useState([]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Fetch Prompt Templates and Lookups
    const fetchTemplatesAndLookups = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': token ? `Bearer ${token}` : '' };
        
        const [templatesRes, devicesRes, chatsRes] = await Promise.all([
          axios.get(`${API_URL}/api/prompt-templates`, { headers }),
          axios.get(`${API_URL}/api/sessions`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_URL}/api/messages/unique-chats`, { headers }).catch(() => ({ data: [] }))
        ]);
        
        setPromptTemplates(templatesRes.data);
        setDevices(devicesRes.data || []);
        setChats(chatsRes.data || []);
      } catch (err) {
        console.error("Failed to fetch initial data", err);
      }
    };
    
    fetchTemplatesAndLookups();
  }, []);

  const handleTemplateSelect = (template) => {
    if (template.type === 'TEXT') {
      handleSendMessage(template.templateText);
      setShowAiModal(false);
      setSelectedCategory(null);
    } else {
      let fields = template.formFields;
      if (typeof fields === 'string') {
        try {
          fields = JSON.parse(fields);
        } catch (e) {
          console.error("Failed to parse formFields", e);
          fields = [];
        }
      }
      
      const parsedTemplate = { ...template, formFields: fields };
      setSelectedTemplate(parsedTemplate);
      
      const initialData = {};
      if (fields && Array.isArray(fields)) {
        fields.forEach(field => {
          initialData[field.name] = '';
        });
      }
      setFormData(initialData);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!selectedTemplate) return;

    let compiledText = selectedTemplate.templateText;
    Object.keys(formData).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      compiledText = compiledText.replace(regex, formData[key]);
    });

    handleSendMessage(compiledText);
    setShowAiModal(false);
    setSelectedTemplate(null);
    setSelectedCategory(null);
    setFormData({});
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (text) => {
    const userText = typeof text === 'string' ? text : input;
    if (!userText.trim() || isLoading) return;

    const userMessage = { role: 'user', content: userText.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      // Ambil 6 pesan terakhir (di luar pesan sambutan pertama dan pesan terbaru)
      const chatHistory = messages
        .slice(1) // abaikan pesan awal AI
        .slice(-6) // batasi 6 pesan terakhir agar hemat token
        .map(m => ({ role: m.role, content: m.content }));

      const response = await axios.post(`${API_URL}/api/bi-chat`, {
        userMessage: userMessage.content,
        chatHistory: chatHistory
      }, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      const data = response.data;
      
      const aiMessage = { 
        role: 'assistant', 
        content: data.reply || data.response || data.message || 'Maaf, saya tidak dapat memproses permintaan Anda saat ini.',
        chartData: data.chart || null
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error in BI Chat:', error);
      const errorData = error.response?.data || {};
      
      const aiError = {
        errorType: errorData.errorType || 'UNKNOWN',
        modelName: errorData.modelName || 'Orchestrator Model',
        error: errorData.error || 'Gagal menjalankan analisis',
        details: errorData.details || error.message || 'Terjadi kesalahan saat mengambil data dari server. Silakan coba lagi nanti.',
        action: errorData.action || 'RETRY'
      };

      const errorMessage = { 
        role: 'assistant', 
        content: null,
        isError: true,
        errorDetails: aiError
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden bg-white font-sans text-slate-800">
      {/* Top Header Bar */}
      <header className="flex-none bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 z-20 w-full">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100 shadow-sm shrink-0">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-1.5 leading-none truncate">
              <span className="truncate hidden sm:inline">AI Business Analyst</span>
              <span className="truncate sm:hidden">AI Analyst</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-medium bg-emerald-100/60 text-emerald-800 shrink-0">
                <Sparkles className="w-2.5 h-2.5 mr-0.5 text-emerald-600" /> PRO
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 mt-1 hidden sm:block truncate">Intelligent query engine & reports generator</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
          <div className="hidden sm:flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <span className="text-[10px] sm:text-xs bg-violet-100 text-violet-700 px-2 py-1 sm:py-1.5 rounded-lg border border-violet-200 font-medium flex items-center gap-1.5 whitespace-nowrap">
              <BrainCircuit className="w-3.5 h-3.5" />
              Orchestrator Active
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-emerald-600 bg-emerald-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-emerald-100 whitespace-nowrap">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0" />
            <Database size={12} className="hidden sm:inline shrink-0" />
            <span className="hidden sm:inline">Connected to AR Database</span>
            <span className="inline sm:hidden">Connected</span>
          </div>
        </div>
      </header>

      {/* Scrollable Chat Area */}
      <main className="flex-1 overflow-y-auto py-4 sm:py-6 pb-36 sm:pb-44 w-full">
        <div className="flex flex-col w-full">
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`w-full py-4 sm:py-6 ${msg.role === 'assistant' ? 'bg-slate-50 border-y border-slate-100' : 'bg-white'}`}
            >
              <div className="max-w-4xl mx-auto flex gap-2.5 sm:gap-6 px-3 sm:px-6 md:px-8 w-full">
                {/* Avatar */}
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md shadow-emerald-100 mt-1 transition-all">
                    <BrainCircuit size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                )}

                {/* Message Content */}
                <div className={`flex-1 min-w-0 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="flex flex-col items-end gap-1 w-full">
                      <div className="bg-slate-100 px-4 sm:px-5 py-2.5 sm:py-3.5 rounded-2xl rounded-tr-sm max-w-[95%] sm:max-w-[85%] text-slate-800 shadow-sm border border-slate-200/60 text-sm sm:text-base break-words">
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                      <button
                        onClick={() => handleCopy(msg.content, index)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-400 hover:text-emerald-600 transition-colors mr-2"
                      >
                        {copiedIndex === index ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        {copiedIndex === index ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col w-full">
                      {msg.isError && msg.errorDetails ? (
                        <div className={`rounded-xl p-4 sm:p-5 border-2 mt-1 ${
                          msg.errorDetails.errorType === 'INSUFFICIENT_CREDITS' ? 'bg-amber-50 border-amber-300' :
                          msg.errorDetails.errorType === 'RATE_LIMIT' ? 'bg-orange-50 border-orange-300' :
                          msg.errorDetails.errorType === 'CONTEXT_TOO_LONG' ? 'bg-blue-50 border-blue-300' :
                          msg.errorDetails.errorType === 'INVALID_API_KEY' ? 'bg-red-50 border-red-300' :
                          msg.errorDetails.errorType === 'MODEL_UNAVAILABLE' ? 'bg-purple-50 border-purple-300' :
                          'bg-red-50 border-red-300'
                        }`}>
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex-shrink-0 ${
                              msg.errorDetails.errorType === 'RATE_LIMIT' ? 'text-orange-500' :
                              msg.errorDetails.errorType === 'CONTEXT_TOO_LONG' ? 'text-blue-500' :
                              msg.errorDetails.errorType === 'INSUFFICIENT_CREDITS' ? 'text-amber-500' :
                              'text-red-500'
                            }`}>
                              {msg.errorDetails.errorType === 'RATE_LIMIT' ? <Zap className="w-5 h-5" /> :
                               msg.errorDetails.errorType === 'CONTEXT_TOO_LONG' ? <Info className="w-5 h-5" /> :
                               <AlertTriangle className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold text-sm ${
                                msg.errorDetails.errorType === 'INSUFFICIENT_CREDITS' ? 'text-amber-800' :
                                msg.errorDetails.errorType === 'RATE_LIMIT' ? 'text-orange-800' :
                                msg.errorDetails.errorType === 'CONTEXT_TOO_LONG' ? 'text-blue-800' :
                                'text-red-800'
                              }`}>
                                {msg.errorDetails.errorType === 'INSUFFICIENT_CREDITS' && '⚠️ Kredit OpenRouter Habis'}
                                {msg.errorDetails.errorType === 'RATE_LIMIT' && '⏱️ Rate Limit Tercapai'}
                                {msg.errorDetails.errorType === 'CONTEXT_TOO_LONG' && '📄 Percakapan Terlalu Panjang'}
                                {msg.errorDetails.errorType === 'INVALID_API_KEY' && '🔑 API Key Tidak Valid'}
                                {msg.errorDetails.errorType === 'MODEL_UNAVAILABLE' && '🤖 Model AI Tidak Tersedia'}
                                {msg.errorDetails.errorType === 'UNKNOWN' && '❌ Gagal Menjalankan Analisis'}
                                {msg.errorDetails.errorType === 'UNAUTHORIZED_QUERY' && '❌ Akses Ditolak'}
                              </p>
                              
                              {msg.errorDetails.modelName && (
                                <div className="mt-2 mb-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800/5 border border-slate-400/20">
                                  <Bot className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                  <span className="text-[11px] sm:text-xs font-mono font-medium text-slate-700 break-all">{msg.errorDetails.modelName}</span>
                                </div>
                              )}
                              
                              <p className={`text-xs sm:text-sm mt-1 leading-relaxed ${
                                msg.errorDetails.errorType === 'INSUFFICIENT_CREDITS' ? 'text-amber-700' :
                                msg.errorDetails.errorType === 'RATE_LIMIT' ? 'text-orange-700' :
                                msg.errorDetails.errorType === 'CONTEXT_TOO_LONG' ? 'text-blue-700' :
                                'text-red-700'
                              }`}>
                                {msg.errorDetails.details}
                              </p>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex flex-wrap gap-2 pl-[44px]">
                            {(msg.errorDetails.action === 'TOP_UP_OR_CHANGE_MODEL') && (
                              <a
                                href="https://openrouter.ai/settings/credits"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition shadow-sm"
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> Top-up Kredit
                              </a>
                            )}
                            {(msg.errorDetails.action === 'CHECK_API_KEY') && (
                              <a
                                href="https://openrouter.ai/settings/keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition shadow-sm"
                              >
                                <ExternalLink className="w-3.5 h-3.5" /> Kelola API Keys
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="prose prose-slate prose-sm sm:prose-base max-w-none w-full whitespace-pre-wrap break-words overflow-hidden">
                          <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({node, ...props}) => (
                              <div className="w-full overflow-x-auto my-4 rounded-lg border border-slate-200 shadow-sm">
                                <table className="w-full text-xs sm:text-sm text-left text-slate-500 min-w-[400px] sm:min-w-0" {...props} />
                              </div>
                            ),
                            thead: ({node, ...props}) => <thead className="text-[10px] sm:text-xs text-slate-700 uppercase bg-slate-50" {...props} />,
                            th: ({node, ...props}) => <th className="px-3 sm:px-6 py-2 sm:py-3 font-semibold border-b border-slate-200" {...props} />,
                            td: ({node, ...props}) => <td className="px-3 sm:px-6 py-2 sm:py-3 border-b border-slate-100 bg-white text-slate-700" {...props} />
                          }}
                        >
                          {formatMarkdown(msg.content)}
                        </ReactMarkdown>
                        {msg.chartData && <DynamicChart chartData={msg.chartData} isMobile={isMobile} />}
                        </div>
                      )}
                      
                      {!msg.isError && (
                        <div className="mt-3 flex justify-start">
                          <button
                            onClick={() => handleCopy(msg.content, index)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm"
                          >
                            {copiedIndex === index ? (
                              <>
                                <Check size={14} className="text-emerald-600" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy size={14} /> Copy Response
                              </>
                            )}
                          </button>
                          
                          {/* Save to Issue Button */}
                          <button
                            onClick={() => {
                              setSelectedSummaryForIssue(formatMarkdown(msg.content));
                              // Retrieve the user message right before this one for context
                              const prevUserMsg = messages[index - 1]?.content || 'Unknown context';
                              setSelectedQueryForIssue({ userPrompt: prevUserMsg });
                              setIsIssueModalOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 ml-2 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                          >
                            <BookmarkPlus size={14} /> Save to Repository
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {/* Loading Indicator */}
          {isLoading && (
            <div className="w-full py-4 sm:py-6 bg-slate-50 border-y border-slate-100">
              <div className="max-w-4xl mx-auto flex gap-3 sm:gap-6 px-3 sm:px-6 md:px-8">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md shadow-emerald-100 mt-1">
                  <BrainCircuit size={18} className="animate-pulse" />
                </div>
                <div className="flex-1 flex items-center gap-3 text-slate-500 font-medium h-8 text-sm sm:text-base">
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-emerald-500" />
                  AI is querying database...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </main>

      {/* Input Area (Absolute inside relative parent) */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent pt-10 pb-6 px-4 z-10 pointer-events-none">
        <div className="max-w-3xl mx-auto w-full flex flex-col items-center pointer-events-auto">
          
          {/* Suggestion Chips - Show if it's the beginning of the conversation */}
          {messages.length === 1 && !isLoading && (
            <div 
              className="flex gap-2 mb-4 w-full px-4 overflow-x-auto no-scrollbar sm:flex-wrap sm:justify-center pb-1.5"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              {SUGGESTIONS.map((suggestion, idx) => {
                // Determine modern icon based on index/suggestion content
                let suggestionIcon = <Sparkles size={12} className="text-emerald-500 sm:w-3.5 sm:h-3.5" />;
                if (idx === 0) {
                  suggestionIcon = <CalendarClock size={12} className="text-blue-500 sm:w-3.5 sm:h-3.5" />;
                } else if (idx === 1) {
                  suggestionIcon = <Store size={12} className="text-indigo-500 sm:w-3.5 sm:h-3.5" />;
                } else if (idx === 2) {
                  suggestionIcon = <TrendingUp size={12} className="text-emerald-500 sm:w-3.5 sm:h-3.5" />;
                }
                return (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(suggestion)}
                    className="flex items-center gap-1.5 sm:gap-2 bg-white border border-slate-200 text-slate-600 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm hover:bg-slate-50 hover:text-emerald-600 transition-colors shadow-sm whitespace-nowrap shrink-0"
                  >
                    {suggestionIcon}
                    {suggestion}
                  </button>
                );
              })}
            </div>
          )}

          {/* AI Actions Trigger */}
          <div className="w-full flex justify-start mb-2">
            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold hover:from-emerald-100 hover:to-teal-100 transition-colors shadow-sm"
            >
              <Zap size={14} className="text-amber-500 fill-amber-500" /> Pilih Form Analisa
            </button>
          </div>

          {/* Input Box */}
          <div className="w-full relative shadow-[0_4px_20px_rgba(0,0,0,0.05)] rounded-xl sm:rounded-2xl bg-white border border-slate-200 focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all flex items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your BI data..."
              className="w-full max-h-36 sm:max-h-48 min-h-[50px] sm:min-h-[60px] py-3.5 sm:py-4 pl-4 sm:pl-5 pr-12 sm:pr-14 resize-none outline-none text-slate-800 bg-transparent text-sm sm:text-base rounded-xl sm:rounded-2xl"
              rows={1}
              disabled={isLoading}
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 bottom-2 sm:right-3 sm:bottom-3 p-2 rounded-lg sm:rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 transition-all flex items-center justify-center shadow-sm"
              title="Send message"
            >
              <Send className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
          
          <div className="text-center mt-2.5 sm:mt-3 text-[10px] sm:text-xs text-slate-400 font-medium">
            AI Business Analyst can make mistakes. Consider verifying important metrics.
          </div>
        </div>
      </div>
      
      {/* AI Actions Modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Zap size={18} className="text-amber-500 fill-amber-500" />
                {selectedTemplate ? selectedTemplate.title : (selectedCategory ? selectedCategory : 'AI Actions Hub')}
              </h3>
              <button 
                onClick={() => {
                  if (selectedTemplate) {
                    setSelectedTemplate(null);
                  } else if (selectedCategory) {
                    setSelectedCategory(null);
                  } else {
                    setShowAiModal(false);
                  }
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-200 transition-colors"
              >
                {selectedTemplate || selectedCategory ? <ChevronRight className="w-5 h-5 rotate-180" /> : <X className="w-5 h-5" />}
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1">
              {!selectedCategory ? (
                // Category List
                <div className="grid grid-cols-1 gap-3">
                  {Object.keys(promptTemplates).map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group text-left"
                    >
                      <span className="font-semibold text-slate-700 group-hover:text-emerald-700">{category}</span>
                      <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full group-hover:bg-emerald-100 group-hover:text-emerald-600">
                        {promptTemplates[category].length} Form
                      </span>
                    </button>
                  ))}
                  {Object.keys(promptTemplates).length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-4">Belum ada form tersedia.</p>
                  )}
                </div>
              ) : !selectedTemplate ? (
                // Template List for Category
                <div className="grid grid-cols-1 gap-3">
                  {promptTemplates[selectedCategory].map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="flex flex-col p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left group"
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-semibold text-slate-700 group-hover:text-emerald-700">{template.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${template.type === 'FORM' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {template.type}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 line-clamp-2">{template.templateText}</span>
                    </button>
                  ))}
                </div>
              ) : (
                // Dynamic Form
                <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                  {selectedTemplate.formFields && selectedTemplate.formFields.map((field, idx) => (
                    <div key={idx} className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">{field.label}</label>
                      {field.type === 'device_lookup' ? (
                        <select
                          required
                          value={formData[field.name] || ''}
                          onChange={e => setFormData({...formData, [field.name]: e.target.value})}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                        >
                          <option value="" disabled>Pilih {field.label}</option>
                          {devices.map((dev, i) => (
                            <option key={i} value={dev.name}>{dev.name}</option>
                          ))}
                        </select>
                      ) : field.type === 'chat_lookup' ? (
                        <select
                          required
                          value={formData[field.name] || ''}
                          onChange={e => setFormData({...formData, [field.name]: e.target.value})}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                        >
                          <option value="" disabled>Pilih {field.label}</option>
                          {chats.map((chatName, i) => (
                            <option key={i} value={chatName}>{chatName}</option>
                          ))}
                        </select>
                      ) : field.type === 'select' ? (
                        <select
                          required
                          value={formData[field.name] || ''}
                          onChange={e => setFormData({...formData, [field.name]: e.target.value})}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                        >
                          <option value="" disabled>Pilih {field.label}</option>
                          {field.options && field.options.map((opt, i) => (
                            <option key={i} value={opt.value || opt}>{opt.label || opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type || 'text'}
                          required
                          placeholder={field.placeholder || ''}
                          value={formData[field.name] || ''}
                          onChange={e => setFormData({...formData, [field.name]: e.target.value})}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm"
                        />
                      )}
                    </div>
                  ))}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors shadow-sm text-sm w-full sm:w-auto"
                    >
                      Generate Prompt
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save to Issue Modal */}
      {isIssueModalOpen && (
        <SaveToIssueModal
          isOpen={isIssueModalOpen}
          onClose={() => setIsIssueModalOpen(false)}
          sourceModule="BUSINESS_ANALYST"
          queryParameters={selectedQueryForIssue}
          initialSnapshot={{ result: selectedSummaryForIssue }}
          aiSummary={selectedSummaryForIssue}
        />
      )}
    </div>
  );
};

export default BIChat;
