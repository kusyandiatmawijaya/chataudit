import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  FileText, CheckCircle, Clock, AlertCircle, 
  Search, Eye, MessageSquare, Download, Trash, X, Send, ArrowLeft
} from 'lucide-react';
import { API_URL } from '../config';
import * as XLSX from 'xlsx';

function TemplateDetails() {
  const { id } = useParams();
  const [template, setTemplate] = useState(null);
  const [dashboard, setDashboard] = useState({ total: 0, sent: 0, pending: 0, failed: 0 });
  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  
  const [filterStatus, setFilterStatus] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  // Resend Modal State
  const [showResendModal, setShowResendModal] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');

  useEffect(() => {
    fetchTemplateDetails();
    fetchDashboard();
    fetchHistory();

    const interval = setInterval(() => {
      fetchDashboard();
      fetchHistory();
    }, 5000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    let filtered = history;
    
    if (filterStatus !== 'Semua') {
      filtered = filtered.filter(h => {
        if (filterStatus === 'Gagal') {
          return h.status === 'FAILED' || h.deliveryStatus === 'ERROR';
        }
        if (filterStatus === 'Terkirim') {
          return h.status === 'SENT' && h.deliveryStatus !== 'ERROR';
        }
        if (filterStatus === 'Belum Dikirim') {
          return h.status === 'PENDING';
        }
        return true;
      });
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(h => {
        const vars = getParsedVariables(h.variables);
        return h.phoneNumber.includes(lowerQuery) || 
               (vars.customer && vars.customer.toLowerCase().includes(lowerQuery)) ||
               (vars.referensi && vars.referensi.toLowerCase().includes(lowerQuery));
      });
    }

    setFilteredHistory(filtered);
  }, [history, filterStatus, searchQuery]);

  const fetchTemplateDetails = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/templates/${id}`);
      setTemplate(res.data);
    } catch (error) {
      console.error('Error fetching template:', error);
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/templates/${id}/dashboard`);
      setDashboard(res.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/templates/${id}/history`);
      setHistory(res.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleResendClick = (recipient) => {
    setSelectedRecipient(recipient);
    setNewPhoneNumber(recipient.phoneNumber);
    setShowResendModal(true);
  };

  const handleResendSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/broadcasts/recipients/${selectedRecipient.id}/resend`, {
        phoneNumber: newPhoneNumber
      });
      setShowResendModal(false);
      fetchDashboard();
      fetchHistory();
      // Wait a moment and fetch again to see the status change quickly
      setTimeout(() => {
         fetchDashboard();
         fetchHistory();
      }, 2000);
    } catch (error) {
      console.error('Error resending message:', error);
      alert('Gagal mengirim ulang pesan');
    }
  };

  const exportToExcel = () => {
    const dataToExport = filteredHistory.map(h => {
      const vars = getParsedVariables(h.variables);
      return {
        'No. Referensi': vars.referensi || '-',
        'Customer': vars.customer || vars.name || '-',
        'No. WhatsApp': h.phoneNumber,
        'Status': h.status,
        'Waktu': h.updatedAt ? new Date(h.updatedAt).toLocaleString() : '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "History");
    XLSX.writeFile(wb, `Template_${template?.name}_History.xlsx`);
  };

  const getParsedVariables = (varsString) => {
    try {
      return varsString ? JSON.parse(varsString) : {};
    } catch (e) {
      return {};
    }
  };

  // Helper to extract common variable patterns based on screenshots
  const extractDisplayData = (recipient) => {
    const vars = getParsedVariables(recipient.variables);
    
    // Attempt to find fields that match screenshot 'No. Referensi' and 'Customer Apex'
    const referensi = vars.referensi || vars.ref || vars.no_faktur || vars.invoice || '-';
    const customer = vars.customer || vars.nama || vars.name || 'Unknown';
    const address = vars.alamat || vars.address || '-';
    
    return { referensi, customer, address, vars };
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 h-full w-full overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 w-full">
          <Link to="/templates" className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 flex-shrink-0 mt-1 sm:mt-0">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 truncate" title={template?.name}>Database Template: {template?.name}</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">Menampilkan statistik dan riwayat pengiriman pesan</p>
          </div>
        </div>
      </div>

      {/* Dashboard Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-orange-50 rounded-lg">
            <FileText className="text-orange-500" size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">TOTAL PESAN</p>
            <p className="text-2xl font-bold text-gray-800">{dashboard.total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-lg">
            <CheckCircle className="text-green-500" size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">WA TERKIRIM</p>
            <p className="text-2xl font-bold text-gray-800">{dashboard.sent}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <Clock className="text-blue-500" size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">WA BELUM DIKIRIM</p>
            <p className="text-2xl font-bold text-gray-800">{dashboard.pending}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-red-50 rounded-lg">
            <AlertCircle className="text-red-500" size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase">WA GAGAL DIKIRIM</p>
            <p className="text-2xl font-bold text-gray-800">{dashboard.failed}</p>
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="relative w-full lg:w-96 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari customer, ref, no hp..." 
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto overflow-x-auto pb-1">
          <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200 min-w-max">
            {['Semua', 'Belum Dikirim', 'Terkirim', 'Gagal'].map(status => (
              <button 
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  filterStatus === status 
                    ? 'bg-white text-gray-800 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          
          <Link 
            to="/broadcasts"
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 whitespace-nowrap flex items-center gap-2"
          >
            <Send size={16} />
            Blast WA Massal
          </Link>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="font-semibold text-gray-800">Database Penerima</h2>
            <p className="text-xs text-gray-500">Menampilkan {filteredHistory.length} data</p>
          </div>
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white text-gray-600 text-xs font-medium rounded hover:bg-gray-50 transition"
          >
            <Download size={14} className="text-green-600" />
            Export Excel
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-gray-500 text-xs uppercase border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-semibold w-48">NO. REFERENSI</th>
                <th className="px-6 py-4 font-semibold w-64">CUSTOMER APEX</th>
                <th className="px-6 py-4 font-semibold">KONTAK & ALAMAT APEX</th>
                <th className="px-6 py-4 font-semibold w-48 text-center">STATUS WA</th>
                <th className="px-6 py-4 font-semibold w-32 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredHistory.map((item, index) => {
                const { referensi, customer, address, vars } = extractDisplayData(item);
                
                let statusConfig = {
                  color: 'bg-gray-100 text-gray-600',
                  text: 'Pending'
                };
                if (item.status === 'SENT') {
                  if (item.deliveryStatus === 'READ' || item.deliveryStatus === 'PLAYED') {
                    statusConfig = { color: 'bg-blue-100 text-blue-700 border border-blue-200', text: 'Dibaca (Centang Biru)' };
                  } else if (item.deliveryStatus === 'DELIVERY_ACK') {
                    statusConfig = { color: 'bg-teal-100 text-teal-700 border border-teal-200', text: 'Diterima (Centang 2)' };
                  } else if (item.deliveryStatus === 'SERVER_ACK') {
                    statusConfig = { color: 'bg-green-100 text-green-700 border border-green-200', text: 'Terkirim (Centang 1)' };
                  } else if (item.deliveryStatus === 'ERROR') {
                    statusConfig = { color: 'bg-red-100 text-red-700 border border-red-200', text: 'Gagal Terkirim' };
                  } else {
                    statusConfig = { color: 'bg-green-100 text-green-700 border border-green-200', text: 'Proses Kirim' };
                  }
                } else if (item.status === 'FAILED') {
                  statusConfig = { color: 'bg-red-100 text-red-700 border border-red-200', text: 'Gagal' };
                } else if (item.status === 'PENDING') {
                  statusConfig = { color: 'bg-blue-100 text-blue-700 border border-blue-200', text: 'Proses' };
                }

                return (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-block px-2 py-1 bg-yellow-50 text-yellow-800 font-mono text-xs rounded border border-yellow-100">
                        {referensi}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {customer}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-gray-700">
                          <MessageSquare size={14} className="text-gray-400" />
                          <span className="font-medium">{item.phoneNumber}</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-gray-500 line-clamp-1">
                          <span className="truncate" title={address}>{address}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center px-3 py-1 text-xs font-semibold rounded-full ${statusConfig.color}`}>
                        {statusConfig.text}
                      </span>
                      {item.errorReason && (
                         <div className="text-[10px] text-red-500 mt-1 line-clamp-1" title={item.errorReason}>
                            {item.errorReason}
                         </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Resend Action */}
                        <button 
                          onClick={() => handleResendClick(item)}
                          className="p-1.5 text-green-600 bg-green-50 rounded-full hover:bg-green-100 transition tooltip group relative"
                          title="Kirim Notifikasi"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    Tidak ada data riwayat penerima yang ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      </div>

      {/* Resend Modal */}
      {showResendModal && selectedRecipient && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-full text-green-600">
                  <MessageSquare size={20} />
                </div>
                <h2 className="text-lg font-bold text-gray-800">Kirim Notifikasi WhatsApp</h2>
              </div>
              <button 
                onClick={() => setShowResendModal(false)} 
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleResendSubmit} className="p-6">
              
              <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100">
                <div className="flex justify-between py-1 border-b border-dashed border-gray-200 text-sm">
                  <span className="text-gray-500">Customer:</span>
                  <span className="font-semibold text-gray-800 text-right">{extractDisplayData(selectedRecipient).customer}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed border-gray-200 text-sm mt-2">
                  <span className="text-gray-500">No. Faktur / Ref:</span>
                  <span className="font-mono font-medium text-gray-800 text-right">{extractDisplayData(selectedRecipient).referensi}</span>
                </div>
                <div className="flex justify-between py-1 text-sm mt-2">
                  <span className="text-gray-500">Nomor Asli:</span>
                  <span className="font-medium text-gray-800 text-right">{selectedRecipient.phoneNumber}</span>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Nomor WhatsApp Tujuan (Format Indonesia)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <MessageSquare size={18} />
                  </div>
                  <input
                    type="text"
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                    className="w-full pl-10 p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition shadow-sm text-gray-800 font-medium"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  * Nomor yang diawali '0' otomatis diformat ke '62' saat dikirim
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setShowResendModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition w-full sm:w-auto"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#00A859] text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <Send size={16} />
                  Kirim Notifikasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateDetails;
