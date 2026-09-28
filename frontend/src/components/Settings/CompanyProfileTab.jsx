import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config';
import { Building2, Shield, Loader2, Save } from 'lucide-react';

export function CompanyProfileTab() {
  const [companyProfile, setCompanyProfile] = useState({});
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    fetchCompanyProfile();
  }, []);

  const fetchCompanyProfile = async () => {
    setIsLoadingProfile(true);
    try {
      const res = await axios.get(`${API_URL}/api/settings?keys=COMPANY_NAME,COMPANY_ADDRESS,COMPANY_EMAIL,COMPANY_PHONE,COMPANY_WA,COMPANY_NPWP,COMPANY_TAX_NAME,COMPANY_TAX_ADDRESS,COMPANY_NPWP_16,tahun_awal`);
      setCompanyProfile({
        COMPANY_NAME: res.data.COMPANY_NAME || '',
        COMPANY_ADDRESS: res.data.COMPANY_ADDRESS || '',
        COMPANY_EMAIL: res.data.COMPANY_EMAIL || '',
        COMPANY_PHONE: res.data.COMPANY_PHONE || '',
        COMPANY_WA: res.data.COMPANY_WA || '',
        COMPANY_NPWP: res.data.COMPANY_NPWP || '',
        COMPANY_TAX_NAME: res.data.COMPANY_TAX_NAME || '',
        COMPANY_TAX_ADDRESS: res.data.COMPANY_TAX_ADDRESS || '',
        COMPANY_NPWP_16: res.data.COMPANY_NPWP_16 || '',
        tahun_awal: res.data.tahun_awal || ''
      });
    } catch (err) {
      console.error('Failed to fetch company profile', err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const saveCompanyProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await axios.post(`${API_URL}/api/settings/batch`, { settings: companyProfile });
      alert('Profil Perusahaan berhasil disimpan!');
    } catch (err) {
      console.error('Failed to save profile', err);
      alert('Gagal menyimpan profil perusahaan');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm animate-fade-in">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Profil Perusahaan</h2>
          <p className="text-sm text-slate-500 mt-0.5">Atur informasi perusahaan untuk disematkan dalam laporan AI dan respon Chatbot.</p>
        </div>
      </div>

      {isLoadingProfile ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <form onSubmit={saveCompanyProfile} className="space-y-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Nama Perusahaan</label>
              <input 
                type="text" 
                value={companyProfile.COMPANY_NAME || ''} 
                onChange={e => setCompanyProfile({...companyProfile, COMPANY_NAME: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="PT Contoh Perusahaan"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Email Utama</label>
              <input 
                type="email" 
                value={companyProfile.COMPANY_EMAIL || ''} 
                onChange={e => setCompanyProfile({...companyProfile, COMPANY_EMAIL: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="info@perusahaan.com"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Alamat Lengkap</label>
              <textarea 
                value={companyProfile.COMPANY_ADDRESS || ''} 
                onChange={e => setCompanyProfile({...companyProfile, COMPANY_ADDRESS: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                rows="2"
                placeholder="Alamat kantor perusahaan..."
              ></textarea>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">No. Telepon Kantor</label>
              <input 
                type="text" 
                value={companyProfile.COMPANY_PHONE || ''} 
                onChange={e => setCompanyProfile({...companyProfile, COMPANY_PHONE: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="021-1234567"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">No. WhatsApp Resmi</label>
              <input 
                type="text" 
                value={companyProfile.COMPANY_WA || ''} 
                onChange={e => setCompanyProfile({...companyProfile, COMPANY_WA: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="081234567890"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Tahun Awal Data (Sistem)</label>
              <input 
                type="number" 
                value={companyProfile.tahun_awal || ''} 
                onChange={e => setCompanyProfile({...companyProfile, tahun_awal: e.target.value})}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                placeholder="Contoh: 2020"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-400" />
              Informasi Pajak (NPWP)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Nama Wajib Pajak</label>
                <input 
                  type="text" 
                  value={companyProfile.COMPANY_TAX_NAME || ''} 
                  onChange={e => setCompanyProfile({...companyProfile, COMPANY_TAX_NAME: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Sesuai NPWP..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Alamat Wajib Pajak</label>
                <input 
                  type="text" 
                  value={companyProfile.COMPANY_TAX_ADDRESS || ''} 
                  onChange={e => setCompanyProfile({...companyProfile, COMPANY_TAX_ADDRESS: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Alamat domisili NPWP..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">NPWP (15 Digit Format)</label>
                <input 
                  type="text" 
                  value={companyProfile.COMPANY_NPWP || ''} 
                  onChange={e => setCompanyProfile({...companyProfile, COMPANY_NPWP: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                  placeholder="00.000.000.0-000.000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">NPWP 16 Digit (NIK/Baru)</label>
                <input 
                  type="text" 
                  value={companyProfile.COMPANY_NPWP_16 || ''} 
                  onChange={e => setCompanyProfile({...companyProfile, COMPANY_NPWP_16: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                  placeholder="0000000000000000"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-indigo-200 hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50"
            >
              {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSavingProfile ? 'Menyimpan...' : 'Simpan Profil Perusahaan'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
