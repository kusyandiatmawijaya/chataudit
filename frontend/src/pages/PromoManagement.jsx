import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Image as ImageIcon, Calendar } from 'lucide-react';

import { API_URL } from '../config';

const PromoManagement = () => {
  const [promos, setPromos] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    keywords: '',
    startDate: '',
    endDate: '',
    isActive: true,
    image: null
  });

  useEffect(() => {
    fetchPromos();
  }, []);

  const fetchPromos = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/promos`);
      setPromos(response.data);
    } catch (error) {
      console.error('Error fetching promos:', error);
    }
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({
      title: '', description: '', keywords: '', startDate: '', endDate: '', isActive: true, image: null
    });
    setIsModalOpen(true);
  };

  const handleEdit = (promo) => {
    setEditingId(promo.id);
    setFormData({
      title: promo.title,
      description: promo.description,
      keywords: promo.keywords,
      startDate: new Date(promo.startDate).toISOString().split('T')[0],
      endDate: new Date(promo.endDate).toISOString().split('T')[0],
      isActive: promo.isActive,
      image: null
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'file') {
      setFormData({ ...formData, image: files[0] });
    } else if (type === 'checkbox') {
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    data.append('keywords', formData.keywords);
    data.append('startDate', formData.startDate);
    data.append('endDate', formData.endDate);
    data.append('isActive', formData.isActive);
    if (formData.image) {
      data.append('image', formData.image);
    }

    try {
      if (editingId) {
        await axios.put(`${API_URL}/api/promos/${editingId}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        await axios.post(`${API_URL}/api/promos`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      setIsModalOpen(false);
      setFormData({
        title: '', description: '', keywords: '', startDate: '', endDate: '', isActive: true, image: null
      });
      fetchPromos();
    } catch (error) {
      console.error('Error saving promo:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      alert('Gagal menyimpan promo: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Yakin ingin menghapus promo ini?')) {
      try {
        await axios.delete(`${API_URL}/api/promos/${id}`);
        fetchPromos();
      } catch (error) {
        console.error('Error deleting promo:', error);
      }
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Manajemen Promo</h1>
          <p className="text-slate-500 text-sm sm:text-base mt-1">Atur banner dan promo yang akan diinformasikan oleh AI Chatbot</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl flex items-center justify-center text-sm font-semibold transition-all shadow-sm hover:shadow active:scale-95"
        >
          <Plus className="w-5 h-5 mr-2" />
          Tambah Promo
        </button>
      </div>

      {promos.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <ImageIcon className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-1">Belum ada promo</h3>
          <p className="text-slate-500 max-w-sm mb-6">Anda belum menambahkan promo apapun. Tambahkan promo pertama Anda sekarang.</p>
          <button onClick={handleOpenAddModal} className="text-emerald-600 font-semibold hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg transition-colors">
            Tambah Promo Baru
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {promos.map((promo) => (
            <div key={promo.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow group">
              <div className="relative h-48 bg-slate-100 overflow-hidden cursor-pointer" onClick={() => setPreviewImage(`${API_URL}${promo.imageUrl}`)}>
                <img 
                  src={`${API_URL}${promo.imageUrl}`} 
                  alt={promo.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                   <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                </div>
                <div className="absolute top-3 right-3 flex gap-2">
                  {promo.isActive ? (
                    <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">Aktif</span>
                  ) : (
                    <span className="bg-slate-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">Tidak Aktif</span>
                  )}
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-slate-800 text-lg mb-2 leading-tight">{promo.title}</h3>
                <p className="text-sm text-slate-500 mb-4 line-clamp-2 flex-1">{promo.description}</p>
                
                <div className="flex items-center text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg mb-4 border border-slate-100">
                  <Calendar className="w-4 h-4 mr-2 text-emerald-600" />
                  <span className="font-medium">
                    {new Date(promo.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} 
                    <span className="mx-1.5 text-slate-300">-</span> 
                    {new Date(promo.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {promo.keywords.split(',').map((k, i) => (
                    <span key={i} className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-medium border border-emerald-100/50">
                      #{k.trim()}
                    </span>
                  ))}
                </div>
                
                <div className="flex justify-end gap-2 mt-auto pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleEdit(promo)}
                    className="flex-1 sm:flex-none flex justify-center items-center text-slate-600 hover:text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors text-sm font-semibold"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(promo.id)}
                    className="flex-1 sm:flex-none flex justify-center items-center text-slate-600 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors text-sm font-semibold"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl my-auto">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-2xl">
              <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Promo' : 'Tambah Promo Baru'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-full hover:bg-slate-100">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Judul Promo</label>
                <input required type="text" name="title" value={formData.title} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" placeholder="Cth: Promo Kemerdekaan" />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Kata Kunci (Keywords)</label>
                <input required type="text" name="keywords" value={formData.keywords} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" placeholder="Cth: diskon, merdeka, cashback" />
                <p className="text-xs text-slate-500 mt-1.5 flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Pisahkan dengan koma. AI akan memanggil promo jika user mengetik kata kunci ini.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Deskripsi</label>
                <textarea required name="description" value={formData.description} onChange={handleInputChange} rows={3} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors resize-none" placeholder="Jelaskan mekanisme atau rincian promo..."></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal Mulai</label>
                  <input required type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tanggal Selesai</label>
                  <input required type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Upload Gambar Promo</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group">
                  <div className="space-y-2 text-center">
                    <ImageIcon className="mx-auto h-10 w-10 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    <div className="flex text-sm text-slate-600 justify-center">
                      <label className="relative cursor-pointer rounded-md font-semibold text-emerald-600 hover:text-emerald-500 focus-within:outline-none">
                        <span>Pilih File</span>
                        <input required={!editingId} type="file" name="image" accept="image/jpeg, image/png, image/webp" onChange={handleInputChange} className="sr-only" />
                      </label>
                      <p className="pl-1">atau drag and drop</p>
                    </div>
                    <p className="text-xs text-slate-500">PNG, JPG, WEBP (Max 5MB)</p>
                    {formData.image && <p className="text-xs font-semibold text-emerald-600 mt-2 bg-emerald-50 py-1 px-2 rounded inline-block">Terpilih: {formData.image.name}</p>}
                    {!formData.image && editingId && <p className="text-xs text-slate-500 mt-2">Biarkan kosong jika tidak ingin mengubah gambar.</p>}
                  </div>
                </div>
              </div>

              <div className="flex items-center mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100 cursor-pointer" onClick={() => setFormData({...formData, isActive: !formData.isActive})}>
                <div className="relative flex items-start">
                  <div className="flex h-6 items-center">
                    <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleInputChange} className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer" onClick={(e) => e.stopPropagation()} />
                  </div>
                  <div className="ml-3 text-sm leading-6">
                    <label className="font-semibold text-slate-800 cursor-pointer">Status Promo Aktif</label>
                    <p className="text-slate-500 text-xs">Promo akan terlihat oleh AI Chatbot jika aktif.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3 pt-5 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-800 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={loading} className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-sm">
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Menyimpan...
                    </>
                  ) : (editingId ? 'Simpan Perubahan' : 'Tambah Promo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 sm:p-8" onClick={() => setPreviewImage(null)}>
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all"
            onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img 
            src={previewImage} 
            alt="Preview" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default PromoManagement;
