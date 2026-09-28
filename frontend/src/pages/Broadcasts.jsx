import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Calendar, Users, Upload, Trash, Plus, FileText, CheckCircle, Clock, AlertCircle, X, Search, MessageSquare, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { API_URL } from '../config';

function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [sessions, setSessions] = useState([]);
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    templateId: '',
    sessionId: '',
    scheduledAt: '',
    recipients: []
  });
  
  const [fileData, setFileData] = useState(null);

  // States for Stats Modal
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedFilterType, setSelectedFilterType] = useState('TOTAL');
  const [broadcastDetails, setBroadcastDetails] = useState(null);

  useEffect(() => {
    fetchBroadcasts();
    fetchTemplates();
    fetchSessions();

    const interval = setInterval(() => {
      fetchBroadcasts();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchBroadcasts = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/broadcasts`);
      setBroadcasts(res.data);
    } catch (error) {
      console.error('Error fetching broadcasts:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/templates`);
      setTemplates(res.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sessions`);
      setSessions(res.data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const parsedRecipients = data.map(row => {
        // Assume 'phone' or 'whatsapp' column exists
        const phone = row.phone || row.phoneNumber || row.whatsapp || row.no_hp || row.hp || Object.values(row)[0];
        const mediaUrl = row.mediaUrl || row.image || null;
        
        // Remove phone and mediaUrl from variables
        const variables = { ...row };
        delete variables.phone;
        delete variables.phoneNumber;
        delete variables.whatsapp;
        delete variables.no_hp;
        delete variables.hp;
        delete variables.mediaUrl;
        delete variables.image;

        return {
          phoneNumber: phone.toString(),
          variables,
          mediaUrl
        };
      }).filter(r => r.phoneNumber);

      setFileData({
        fileName: file.name,
        count: parsedRecipients.length
      });

      setFormData(prev => ({
        ...prev,
        recipients: parsedRecipients
      }));
    };
    reader.readAsBinaryString(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.recipients.length) {
        return alert('Please upload a valid Excel/CSV file with recipients');
      }

      await axios.post(`${API_URL}/api/broadcasts`, formData);
      fetchBroadcasts();
      setShowModal(false);
      setFormData({ name: '', templateId: '', sessionId: '', scheduledAt: '', recipients: [] });
      setFileData(null);
    } catch (error) {
      console.error('Error creating broadcast:', error);
      alert('Failed to create broadcast');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this broadcast?')) return;
    try {
      await axios.delete(`${API_URL}/api/broadcasts/${id}`);
      fetchBroadcasts();
    } catch (error) {
      console.error('Error deleting broadcast:', error);
      alert('Failed to delete broadcast');
    }
  };

  const handleStatClick = async (broadcastId, filterType) => {
    setSelectedFilterType(filterType);
    setShowStatsModal(true);
    setBroadcastDetails(null); // Loading state
    try {
      const res = await axios.get(`${API_URL}/api/broadcasts/${broadcastId}`);
      setBroadcastDetails(res.data);
    } catch (error) {
      console.error('Error fetching broadcast details:', error);
    }
  };

  const extractDisplayData = (item) => {
    let vars = {};
    if (item.variables) {
      try {
        vars = typeof item.variables === 'string' ? JSON.parse(item.variables) : item.variables;
      } catch (e) {
        console.error('Error parsing variables:', e);
      }
    }
    const customer = vars.customer || vars.Customer || vars.nama || vars.Nama || '-';
    return { customer, vars };
  };

  const exportModalToExcel = () => {
    if (!broadcastDetails) return;
    
    const filteredData = broadcastDetails.recipients?.filter(r => {
      if (selectedFilterType === 'FAILED') return r.status === 'FAILED' || r.deliveryStatus === 'ERROR';
      if (selectedFilterType === 'PENDING') return r.status === 'PENDING';
      if (selectedFilterType === 'SENT') return r.status === 'SENT' && r.deliveryStatus !== 'ERROR';
      return true; // TOTAL
    }).map((r, index) => {
      const { customer } = extractDisplayData(r);
      let statusText = 'Pending';
      if (r.status === 'SENT') {
        if (r.deliveryStatus === 'READ' || r.deliveryStatus === 'PLAYED') statusText = 'Dibaca';
        else if (r.deliveryStatus === 'DELIVERY_ACK') statusText = 'Diterima';
        else if (r.deliveryStatus === 'SERVER_ACK') statusText = 'Terkirim';
        else if (r.deliveryStatus === 'ERROR') statusText = 'Gagal Terkirim';
        else statusText = 'Proses Kirim';
      } else if (r.status === 'FAILED') {
        statusText = 'Gagal';
      } else if (r.status === 'PENDING') {
        statusText = 'Proses';
      }
      return {
        'No': index + 1,
        'Customer': customer,
        'No Telpon': r.phoneNumber,
        'Tanggal/Waktu': r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '-',
        'Status': statusText,
        'Detail Error': r.errorReason || '-'
      };
    }) || [];

    if (filteredData.length === 0) return alert('Tidak ada data untuk diexport');

    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detail_Penerima");
    
    const fileName = `Detail_Penerima_${broadcastDetails.name}_${selectedFilterType}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Broadcast Campaigns</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          New Broadcast
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="p-4 font-semibold text-gray-600">Campaign Name</th>
              <th className="p-4 font-semibold text-gray-600">Template</th>
              <th className="p-4 font-semibold text-gray-600">Recipients</th>
              <th className="p-4 font-semibold text-gray-600">Schedule</th>
              <th className="p-4 font-semibold text-gray-600">Status</th>
              <th className="p-4 font-semibold text-gray-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map(broadcast => {
              const total = broadcast.recipients?.length || 0;
              let sent = 0;
              let failed = 0;
              let pending = 0;

              broadcast.recipients?.forEach(r => {
                if (r.status === 'FAILED' || r.deliveryStatus === 'ERROR') {
                  failed++;
                } else if (r.status === 'PENDING') {
                  pending++;
                } else if (r.status === 'SENT') {
                  sent++;
                }
              });

              return (
              <tr key={broadcast.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="p-4 font-medium">{broadcast.name}</td>
                <td className="p-4">{broadcast.template?.name || 'N/A'}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button onClick={() => handleStatClick(broadcast.id, 'TOTAL')} className="flex items-center gap-1.5 px-2 py-1 bg-orange-50 text-orange-700 border border-orange-100 rounded hover:bg-orange-100 transition tooltip" title="Total Pesan">
                      <FileText size={14} />
                      <span className="font-bold">{total}</span>
                    </button>
                    <button onClick={() => handleStatClick(broadcast.id, 'SENT')} className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 border border-green-100 rounded hover:bg-green-100 transition tooltip" title="WA Terkirim / Diterima">
                      <CheckCircle size={14} />
                      <span className="font-bold">{sent}</span>
                    </button>
                    <button onClick={() => handleStatClick(broadcast.id, 'PENDING')} className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded hover:bg-blue-100 transition tooltip" title="Belum Dikirim (Proses)">
                      <Clock size={14} />
                      <span className="font-bold">{pending}</span>
                    </button>
                    <button onClick={() => handleStatClick(broadcast.id, 'FAILED')} className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-700 border border-red-100 rounded hover:bg-red-100 transition tooltip" title="WA Gagal Dikirim">
                      <AlertCircle size={14} />
                      <span className="font-bold">{failed}</span>
                    </button>
                  </div>
                </td>
                <td className="p-4">
                  {broadcast.scheduledAt ? (
                    <div className="flex items-center gap-2 text-orange-600">
                      <Calendar size={16} />
                      {new Date(broadcast.scheduledAt).toLocaleString()}
                    </div>
                  ) : (
                    <span className="text-gray-500">Immediate</span>
                  )}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 text-xs rounded-full uppercase font-semibold
                    ${broadcast.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      broadcast.status === 'RUNNING' ? 'bg-blue-100 text-blue-700' :
                      broadcast.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'}`}>
                    {broadcast.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => handleDelete(broadcast.id)} className="text-gray-400 hover:text-red-600">
                    <Trash size={18} />
                  </button>
                </td>
              </tr>
            );
          })}
            {broadcasts.length === 0 && (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-500">No broadcasts found. Create one to get started.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">New Broadcast</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Template</label>
                <select
                  value={formData.templateId}
                  onChange={(e) => setFormData({...formData, templateId: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">-- Choose Template --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.type.replace('_', ' ')})</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Sender Session (WhatsApp)</label>
                <select
                  value={formData.sessionId}
                  onChange={(e) => setFormData({...formData, sessionId: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">-- Choose Session --</option>
                  {sessions.filter(s => s.status === 'ready').map(s => (
                    <option key={s.sessionId} value={s.sessionId}>{s.name} ({s.sessionId})</option>
                  ))}
                </select>
                {sessions.filter(s => s.status === 'ready').length === 0 && (
                  <p className="text-xs text-red-500 mt-1">No active WhatsApp sessions. Please connect a device in Dashboard.</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Contacts (Excel/CSV)</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md relative hover:bg-gray-50 transition">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                        <span>Upload a file</span>
                        <input type="file" className="sr-only" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileUpload} />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      XLSX, XLS, CSV up to 10MB
                    </p>
                  </div>
                </div>
                {fileData && (
                  <div className="mt-2 text-sm text-green-600 flex items-center justify-between bg-green-50 p-2 rounded">
                    <span>{fileData.fileName}</span>
                    <span className="font-bold">{fileData.count} recipients</span>
                  </div>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({...formData, scheduledAt: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to send immediately.</p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  disabled={!formData.recipients.length || !formData.templateId || !formData.sessionId}
                >
                  <Play size={16} />
                  {formData.scheduledAt ? 'Schedule' : 'Send Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {showStatsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
              <div>
                <h2 className="font-semibold text-gray-800">Detail Penerima</h2>
                <p className="text-xs text-gray-500">
                  Menampilkan data filter: <strong className="text-gray-700">{selectedFilterType}</strong>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={exportModalToExcel}
                  className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white text-gray-600 text-xs font-medium rounded hover:bg-gray-50 transition"
                  disabled={!broadcastDetails}
                >
                  <Download size={14} className="text-green-600" />
                  Export Excel
                </button>
                <button onClick={() => setShowStatsModal(false)} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-full">
                  <X size={18} />
                </button>
              </div>
            </div>
            
            <div className="p-4 flex-1 overflow-auto">
              {!broadcastDetails ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-white text-gray-500 text-xs uppercase border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">No Telpon</th>
                      <th className="px-4 py-3 font-semibold">Tanggal/Waktu</th>
                      <th className="px-4 py-3 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {broadcastDetails.recipients?.filter(r => {
                      if (selectedFilterType === 'FAILED') return r.status === 'FAILED' || r.deliveryStatus === 'ERROR';
                      if (selectedFilterType === 'PENDING') return r.status === 'PENDING';
                      if (selectedFilterType === 'SENT') return r.status === 'SENT' && r.deliveryStatus !== 'ERROR';
                      return true; // TOTAL
                    }).map(r => {
                      const { customer } = extractDisplayData(r);
                      
                      let statusConfig = { color: 'bg-gray-100 text-gray-600', text: 'Pending' };
                      if (r.status === 'SENT') {
                        if (r.deliveryStatus === 'READ' || r.deliveryStatus === 'PLAYED') statusConfig = { color: 'bg-blue-100 text-blue-700', text: 'Dibaca' };
                        else if (r.deliveryStatus === 'DELIVERY_ACK') statusConfig = { color: 'bg-teal-100 text-teal-700', text: 'Diterima' };
                        else if (r.deliveryStatus === 'SERVER_ACK') statusConfig = { color: 'bg-green-100 text-green-700', text: 'Terkirim' };
                        else if (r.deliveryStatus === 'ERROR') statusConfig = { color: 'bg-red-100 text-red-700', text: 'Gagal Terkirim' };
                        else statusConfig = { color: 'bg-green-100 text-green-700', text: 'Proses Kirim' };
                      } else if (r.status === 'FAILED') {
                        statusConfig = { color: 'bg-red-100 text-red-700', text: 'Gagal' };
                      } else if (r.status === 'PENDING') {
                        statusConfig = { color: 'bg-blue-100 text-blue-700', text: 'Proses' };
                      }

                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{customer}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <MessageSquare size={14} className="text-gray-400" />
                              {r.phoneNumber}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center justify-center px-2 py-1 text-xs font-semibold rounded ${statusConfig.color}`}>
                              {statusConfig.text}
                            </span>
                            {r.errorReason && (
                               <div className="text-[10px] text-red-500 mt-0.5 line-clamp-1" title={r.errorReason}>
                                  {r.errorReason}
                               </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Broadcasts;
