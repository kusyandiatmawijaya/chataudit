const ActionHandler = require('../ActionHandler');
// Nanti bisa tambahkan Prisma jika perlu akses DB langsung: const { PrismaClient } = require('@prisma/client');

class SopirWorkflow {
    /**
     * Entry point untuk menangani pesan dari SOPIR
     */
    static async handleMessage(normalizedMsg, sessionId, clientAdapter, contact) {
        const remoteJid = normalizedMsg.senderId;
        const textMessage = (normalizedMsg.text || '').trim();
        const lowerText = textMessage.toLowerCase();

        // 1. Tangani perintah global (Menu / Bantuan / Keluar)
        if (lowerText === 'menu' || lowerText === 'bantuan' || lowerText === 'help') {
            await this.sendMainMenu(clientAdapter, remoteJid);
            return;
        }

        // 2. Cek apakah ini callback_query dari tombol Inline Telegram
        // (Kita akan mendeteksi dari prefix khusus, misal "CALLBACK:")
        if (textMessage.startsWith('CALLBACK:')) {
            await this.handleCallbackQuery(textMessage.replace('CALLBACK:', ''), remoteJid, clientAdapter, contact);
            return;
        }

        // 3. Tangani shortcut menu angka (Fallback jika tidak bisa pakai tombol)
        const isMenu1 = textMessage === '1' || textMessage.startsWith('1️⃣');
        const isMenu2 = textMessage === '2' || textMessage.startsWith('2️⃣');
        
        if (isMenu1) {
            await clientAdapter.sendMessage(remoteJid, 'Jadwal Pengiriman Hari Ini:\n\n(Fitur ini masih dalam tahap pengembangan. Nanti akan terhubung dengan data DO).');
            return;
        } 
        
        if (isMenu2) {
            // Contoh mengirim tombol interaktif Telegram
            if (clientAdapter.platform === 'telegram') {
                const opts = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "Dalam Perjalanan", callback_data: "STATUS_JALAN" },
                                { text: "Sampai Tujuan", callback_data: "STATUS_SAMPAI" }
                            ],
                            [
                                { text: "Kendala", callback_data: "STATUS_KENDALA" }
                            ]
                        ]
                    }
                };
                // Menggunakan clientAdapter.sendMessage dengan options (reply_markup)
                await clientAdapter.sendMessage(remoteJid, 'Pilih status pengiriman saat ini:', opts);
            } else {
                await clientAdapter.sendMessage(remoteJid, 'Update Status Kirim:\nKetik "Sampai" atau kirim foto bukti pengiriman.');
            }
            return;
        }

        // 4. Fallback Default jika perintah tidak dikenali
        await clientAdapter.sendMessage(remoteJid, "⚠️ Maaf, perintah tidak dikenali.\n\nSilakan ketik *menu* untuk melihat panduan, atau balas dengan angka (1, 2) sesuai pilihan.");
    }

    /**
     * Penanganan aksi dari tombol Inline Telegram
     */
    static async handleCallbackQuery(callbackData, remoteJid, clientAdapter, contact) {
        if (callbackData === 'STATUS_JALAN') {
            await clientAdapter.sendMessage(remoteJid, 'Status diupdate: *Dalam Perjalanan*. Hati-hati di jalan!');
        } else if (callbackData === 'STATUS_SAMPAI') {
            await clientAdapter.sendMessage(remoteJid, 'Status diupdate: *Sampai Tujuan*. Silakan kirimkan foto bukti pengiriman/DO yang sudah ditandatangani.');
        } else if (callbackData === 'STATUS_KENDALA') {
            await clientAdapter.sendMessage(remoteJid, 'Harap ketik kendala yang dialami secara singkat.');
        } else {
            await clientAdapter.sendMessage(remoteJid, `Aksi tombol tidak dikenali: ${callbackData}`);
        }
    }

    /**
     * Tampilkan menu utama Sopir
     */
    static async sendMainMenu(clientAdapter, remoteJid) {
        let menuText = `Berikut daftar menu *Sopir*. Silahkan ketik angka sesuai menu yang Anda inginkan:\n\n`;
        menuText += `1️⃣ *Jadwal Pengiriman* - Daftar jadwal pengiriman hari ini\n`;
        menuText += `2️⃣ *Update Status Kirim* - Update pengiriman barang (Tombol Interaktif)\n`;
        
        await clientAdapter.sendMessage(remoteJid, menuText);
    }
}

module.exports = SopirWorkflow;
