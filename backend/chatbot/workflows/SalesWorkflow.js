const ActionHandler = require('../ActionHandler');

class SalesWorkflow {
    /**
     * Entry point untuk menangani pesan dari SALESMAN
     */
    static async handleMessage(normalizedMsg, sessionId, clientAdapter, contact) {
        const remoteJid = normalizedMsg.senderId;
        const textMessage = (normalizedMsg.text || '').trim();
        const lowerText = textMessage.toLowerCase();

        // 1. Tangani perintah global (Menu / Bantuan / Keluar / Reset)
        if (lowerText === 'menu' || lowerText === '/menu' || lowerText === 'bantuan' || lowerText === 'help') {
            await this.sendMainMenu(clientAdapter, remoteJid);
            return;
        }

        if (lowerText === 'reset' || lowerText === '/reset') {
            const { clearMemory } = require('../MemoryManager');
            clearMemory(remoteJid);
            await clientAdapter.sendMessage(remoteJid, "🔄 *Percakapan telah di-reset.*\n\nKonteks sebelumnya telah dihapus. Silakan ketik *menu* untuk melihat opsi yang tersedia.");
            return;
        }

        // 2. Cek apakah ini callback_query dari tombol Inline Telegram
        if (textMessage.startsWith('CALLBACK:')) {
            await this.handleCallbackQuery(textMessage.replace('CALLBACK:', ''), remoteJid, clientAdapter, contact);
            return;
        }

        // 3. Tangani shortcut menu angka (Fallback jika tidak bisa pakai tombol)
        const isMenu1 = textMessage === '1' || textMessage.startsWith('1️⃣') || lowerText === '/profil';
        const isMenu2 = textMessage === '2' || textMessage.startsWith('2️⃣') || lowerText === '/piutang';
        const isMenu3 = textMessage === '3' || textMessage.startsWith('3️⃣') || lowerText === '/omset';
        const isMenu4 = textMessage === '4' || textMessage.startsWith('4️⃣') || lowerText === '/jadwalbesok';
        const isMenu5 = textMessage === '5' || textMessage.startsWith('5️⃣') || lowerText === '/jadwalhariini';
        
        if (isMenu1) {
            let profileMsg = `👤 *PROFIL ANDA*\n\n`;
            if (contact) {
                profileMsg += `*Nama:* ${contact.name || '-'}\n`;
                profileMsg += `*Jabatan/Grup:* ${contact.group || '-'}\n`;
                profileMsg += `*No. HP:* ${contact.realPhoneNumber || contact.phoneNumber || '-'}\n`;
                if (contact.kodeCustomer) profileMsg += `*Kode Customer:* ${contact.kodeCustomer}\n`;
                if (contact.kodeSales) profileMsg += `*Kode Sales:* ${contact.kodeSales}\n`;
            } else {
                profileMsg += `Data kontak belum terdaftar sepenuhnya.`;
            }
            await clientAdapter.sendMessage(remoteJid, profileMsg);
            return;
        } 
        
        if (isMenu2) {
            const rawKodeSales = contact.kodeSales || '';
            const targetKodes = rawKodeSales.split(/[:;,]/).map(k => k.replace(/['"]/g, '').trim()).filter(k => k);

            if (targetKodes.length > 0) {
                for (const targetKode of targetKodes) {
                    await clientAdapter.sendMessage(remoteJid, `Sedang mengambil data piutang area Anda (${targetKode})... ⏳`);
                    const arDataStr = await ActionHandler.executeGetOutstandingArBySalesman(targetKode, 10);
                    let messageToSend = `Tidak ada data piutang untuk area Anda (${targetKode}).`;
                    try {
                        const parsed = JSON.parse(arDataStr);
                        if (parsed.Data_Ditemukan) {
                            messageToSend = `📊 *LAPORAN PIUTANG AREA (${targetKode})*\n\n`;
                            messageToSend += `👤 *Sales:* ${parsed.Nama_Sales}\n`;
                            
                            const ringkasan = parsed.Ringkasan_Seluruh_Piutang_Salesman;
                            if (ringkasan) {
                                messageToSend += `*Total Faktur:* ${ringkasan.Total_Semua_Faktur}\n`;
                                messageToSend += `*Total Tagihan:* Rp ${Number(ringkasan.Total_Nominal_Tagihan).toLocaleString('id-ID')}\n`;
                                messageToSend += `*Sisa Saldo:* Rp ${Number(ringkasan.Total_Sisa_Saldo).toLocaleString('id-ID')}\n\n`;
                            }

                            if (parsed.Daftar_Toko && parsed.Daftar_Toko.length > 0) {
                                messageToSend += `🏢 *Top ${parsed.Menampilkan_Jumlah_Toko} Toko (Sisa Tagihan Terbesar):*\n`;
                                parsed.Daftar_Toko.forEach((toko, idx) => {
                                    messageToSend += `\n${idx + 1}. *${toko.Nama_Toko}* (${toko.Kode_Toko})\n`;
                                    messageToSend += `   Faktur: ${toko.Total_Faktur}\n`;
                                    messageToSend += `   Tagihan: Rp ${Number(toko.Total_Tagihan_Toko).toLocaleString('id-ID')}\n`;
                                    messageToSend += `   Sisa: Rp ${Number(toko.Sisa_Tagihan_Toko).toLocaleString('id-ID')}\n`;
                                    if (toko.Jatuh_Tempo_Terdekat) {
                                        messageToSend += `   Jatuh Tempo Terdekat: ${toko.Jatuh_Tempo_Terdekat}\n`;
                                    }
                                });
                            }
                        } else {
                            messageToSend = parsed.message || parsed.error || messageToSend;
                        }
                    } catch (e) {
                        // Fallback in case it's not JSON
                        messageToSend = arDataStr || messageToSend;
                    }
                    await clientAdapter.sendMessage(remoteJid, messageToSend);
                }
            } else {
                await clientAdapter.sendMessage(remoteJid, 'Kode sales tidak ditemukan pada kontak Anda.');
            }
            return;
        }

        if (isMenu3) {
            await clientAdapter.sendMessage(remoteJid, 'Laporan Omset:\n\n(Fitur ini masih dalam tahap pengembangan).');
            return;
        }

        if (isMenu4 || isMenu5) {
            await clientAdapter.sendMessage(remoteJid, 'Jadwal Kunjungan:\n\n(Fitur ini masih dalam tahap pengembangan).');
            return;
        }

        // 4. Fallback Default jika perintah tidak dikenali
        await clientAdapter.sendMessage(remoteJid, "⚠️ Maaf, perintah tidak dikenali.\n\nSilakan ketik *menu* untuk melihat panduan, atau balas dengan angka sesuai pilihan.");
    }

    /**
     * Penanganan aksi dari tombol Inline Telegram
     */
    static async handleCallbackQuery(callbackData, remoteJid, clientAdapter, contact) {
        // Contoh penanganan callback data
        if (callbackData === 'CONTOH_AKSI_SALES') {
            await clientAdapter.sendMessage(remoteJid, 'Aksi diproses.');
        } else {
            await clientAdapter.sendMessage(remoteJid, `Aksi tombol tidak dikenali: ${callbackData}`);
        }
    }

    /**
     * Tampilkan menu utama Salesman
     */
    static async sendMainMenu(clientAdapter, remoteJid) {
        let menuText = `Berikut daftar menu *Salesman*. Silahkan ketik angka sesuai menu yang Anda inginkan:\n\n`;
        menuText += `1️⃣ *Profil Salesman* - Informasi profil Anda\n`;
        menuText += `2️⃣ *Cek Outstanding AR* - Lihat piutang toko area Anda\n`;
        menuText += `3️⃣ *Laporan Omset* - Ringkasan penjualan\n`;
        menuText += `4️⃣ *Jadwal Kunjungan Sales Besok* - Rencana kunjungan besok\n`;
        menuText += `5️⃣ *Jadwal Kunjungan Sales Hari Ini* - Rencana kunjungan hari ini\n`;
        
        await clientAdapter.sendMessage(remoteJid, menuText);
    }
}

module.exports = SalesWorkflow;
