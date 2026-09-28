import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { API_URL } from '../config';

function TelegramBotsManager() {
    const [bots, setBots] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ id: null, token: '', name: '', type: 'MAIN', isActive: true });

    useEffect(() => {
        fetchBots();
    }, []);

    const fetchBots = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/api/telegram-bots`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBots(response.data);
        } catch (error) {
            console.error('Error fetching bots:', error);
            Swal.fire('Error', 'Gagal memuat data bot', 'error');
        }
    };

    const handleOpenModal = (bot = null) => {
        if (bot) {
            setFormData({ ...bot });
        } else {
            setFormData({ id: null, token: '', name: '', type: 'MAIN', isActive: true });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setFormData({ id: null, token: '', name: '', type: 'MAIN', isActive: true });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            
            if (formData.id) {
                await axios.put(`${API_URL}/api/telegram-bots/${formData.id}`, formData, { headers });
                Swal.fire('Sukses', 'Bot berhasil diupdate', 'success');
            } else {
                await axios.post(`${API_URL}/api/telegram-bots`, formData, { headers });
                Swal.fire('Sukses', 'Bot berhasil ditambahkan', 'success');
            }
            fetchBots();
            handleCloseModal();
        } catch (error) {
            console.error('Error saving bot:', error);
            Swal.fire('Error', 'Gagal menyimpan data bot', 'error');
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Hapus Bot?',
            text: "Anda yakin ingin menghapus bot ini?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Ya, hapus!'
        });

        if (result.isConfirmed) {
            try {
                const token = localStorage.getItem('token');
                await axios.delete(`${API_URL}/api/telegram-bots/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                Swal.fire('Terhapus!', 'Bot berhasil dihapus.', 'success');
                fetchBots();
            } catch (error) {
                console.error('Error deleting bot:', error);
                Swal.fire('Error', 'Gagal menghapus bot', 'error');
            }
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Manajemen Telegram Bot</h1>
                <button 
                    onClick={() => handleOpenModal()} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow transition-colors"
                >
                    + Tambah Bot
                </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipe</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token (Sebagian)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {bots.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                                    Belum ada bot yang terdaftar.
                                </td>
                            </tr>
                        ) : bots.map(bot => (
                            <tr key={bot.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{bot.name || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${bot.type === 'MAIN' ? 'bg-blue-100 text-blue-800' : bot.type === 'SOPIR' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                                        {bot.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${bot.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {bot.isActive ? 'Aktif' : 'Tidak Aktif'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                    {bot.token ? bot.token.substring(0, 10) + '...' : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => handleOpenModal(bot)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</button>
                                    <button onClick={() => handleDelete(bot.id)} className="text-red-600 hover:text-red-900">Hapus</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="p-4 bg-yellow-50 border-t border-yellow-100 text-sm text-yellow-800 flex items-center">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
                    </svg>
                    <span><strong>Catatan:</strong> Jika Anda menambah atau mengubah status bot, Anda harus me-restart service backend (PM2) agar perubahan tersebut diterapkan (instance baru akan diload).</span>
                </div>
            </div>

            {/* Modal Form */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center">
                    <div className="fixed inset-0 transition-opacity" onClick={handleCloseModal}>
                        <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                    </div>
                    <div className="bg-white rounded-lg overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full z-50">
                        <form onSubmit={handleSave}>
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                    {formData.id ? 'Edit Bot Telegram' : 'Tambah Bot Telegram'}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Nama Bot (Alias)</label>
                                        <input 
                                            type="text" 
                                            value={formData.name}
                                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                            placeholder="Misal: Bot Utama, Bot Sopir Jakarta"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Token Bot API</label>
                                        <input 
                                            type="text" 
                                            required
                                            value={formData.token}
                                            onChange={(e) => setFormData({...formData, token: e.target.value})}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                                            placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Tipe Bot</label>
                                        <select 
                                            value={formData.type}
                                            onChange={(e) => setFormData({...formData, type: e.target.value})}
                                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        >
                                            <option value="MAIN">MAIN (Bot Utama / General)</option>
                                            <option value="SOPIR">SOPIR (Bot Khusus Sopir)</option>
                                            <option value="SALESMAN">SALESMAN (Bot Khusus Salesman)</option>
                                        </select>
                                        <p className="mt-1 text-xs text-gray-500">Tipe bot menentukan menu dan respon spesifik yang diberikan.</p>
                                    </div>
                                    <div className="flex items-center mt-4">
                                        <input 
                                            type="checkbox" 
                                            id="isActive"
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                                            Status Aktif (Bot akan dinyalakan saat server direstart)
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button 
                                    type="submit" 
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Simpan
                                </button>
                                <button 
                                    type="button" 
                                    onClick={handleCloseModal}
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Batal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TelegramBotsManager;
