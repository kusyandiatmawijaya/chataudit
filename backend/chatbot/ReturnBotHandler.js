const { getUserState, setUserState, clearUserState } = require('./MemoryManager');
const ReturnService = require('../services/ReturnService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// States
const STATE_RETUR_CUSTOMER        = 'RETUR_CUSTOMER';
const STATE_RETUR_CUSTOMER_SELECT = 'RETUR_CUSTOMER_SELECT';
const STATE_RETUR_TYPE            = 'RETUR_TYPE';
const STATE_RETUR_LOCATION        = 'RETUR_LOCATION';
const STATE_RETUR_PHOTO           = 'RETUR_PHOTO';
const STATE_RETUR_CONFIRM         = 'RETUR_CONFIRM';

const DIVISI_LIST = ['FORISA','KAO','SANIA','PURBASARI','PIGEON','ENESIS','PADIMAS','FINNA','IGI','LAIN-LAIN'];

// Mini App base URL
const MINI_APP_BASE_URL = process.env.MINI_APP_URL || 'https://auditwa.padmasaripangan.co.id/api/twa';

/**
 * Build inline keyboard yang menawarkan Mini App ATAU lanjut via chat.
 * @param {string} invoiceNumber
 * @param {string} customerCode
 * @param {string} sessionId - e.g. "telegram-1" (dikirim sebagai query param untuk auth)
 * @param {string} backState - state untuk tombol BACK
 */
function buildMiniAppKeyboard(invoiceNumber, customerCode, sessionId, backState) {
  const inv  = encodeURIComponent(invoiceNumber  || '');
  const cust = encodeURIComponent(customerCode   || '');
  const sid  = encodeURIComponent(sessionId      || '');
  const url  = `${MINI_APP_BASE_URL}?invoice=${inv}&customerCode=${cust}&sessionId=${sid}`;

  return {
    inline_keyboard: [
      [{ text: '📝 Buka Form Retur (Mini App)', web_app: { url } }],
      [{ text: '⌨️ Lanjut Input via Chat', callback_data: `CONTINUE_CHAT_${backState}` }],
      [{ text: '🏠 Batal', callback_data: 'CANCEL' }],
    ]
  };
}

// In-memory temp storage for the flow. Key: remoteJid
// In-memory temp storage for the flow. Key: remoteJid
const returDataSession = {};

const defaultReplyKeyboard = {
  remove_keyboard: true
};

async function sendWithMenu(sessionId, remoteJid, clientAdapter, text) {
  const { getTelegramBot } = require('../telegram');
  const bot = getTelegramBot(sessionId);
  if (bot) {
    await bot.sendMessage(remoteJid, text, { reply_markup: defaultReplyKeyboard });
  } else {
    await clientAdapter.sendMessage(remoteJid, text);
  }
}

function getPaginationKeyboard(deliveries, currentPage, itemsPerPage = 5) {
  const totalPages = Math.ceil(deliveries.length / itemsPerPage);
  const start = currentPage * itemsPerPage;
  const paginatedItems = deliveries.slice(start, start + itemsPerPage);

  const keyboard = [];
  
  paginatedItems.forEach((d, index) => {
    const absoluteIndex = start + index;
    keyboard.push([{ 
      text: `${d.invoice_number} - ${d.salesperson_code} - ${d.customer_name}`, 
      callback_data: `CUST_${absoluteIndex}` 
    }]);
  });

  const paginationRow = [];
  if (currentPage > 0) {
    paginationRow.push({ text: '⬅️ Prev', callback_data: `PAGE_${currentPage - 1}` });
  }
  if (currentPage < totalPages - 1) {
    paginationRow.push({ text: 'Next ➡️', callback_data: `PAGE_${currentPage + 1}` });
  }
  
  if (paginationRow.length > 0) {
    keyboard.push(paginationRow);
  }

  // Add Cancel
  keyboard.push([{ text: '🏠 Batal', callback_data: 'CANCEL' }]);

  return keyboard;
}

async function handleReturFlow(normalizedMsg, sessionId, clientAdapter) {
  const { senderId: remoteJid, senderName, text, mediaUrl, mediaType, rawMessage } = normalizedMsg;
  const currentState = getUserState(remoteJid);
  const lowerText = (text || '').toLowerCase().trim();

  // COMMAND: /batal
  if (lowerText === '/batal') {
    clearUserState(remoteJid);
    delete returDataSession[remoteJid];
    await sendWithMenu(sessionId, remoteJid, clientAdapter, '❌ Transaksi retur dibatalkan.');
    return true;
  }

  // COMMAND: /retur & /approval
  if (lowerText === '/retur' || lowerText === 'retur' || lowerText === '/approval' || lowerText === 'approval') {
    const contact = await prisma.contact.findFirst({
      where: { telegramId: String(remoteJid) }
    });
    const isSpv = contact && contact.group && (contact.group.toUpperCase().includes('SUPERVISOR') || contact.group.toUpperCase().includes('SPV'));
    if (isSpv) {
      const { getTelegramBot } = require('../telegram');
      const bot = getTelegramBot(sessionId);
      const miniAppUrl = `${process.env.MINI_APP_URL || 'https://auditwa.padmasaripangan.co.id/api/twa'}?mode=list_today&sessionId=${encodeURIComponent(sessionId)}`;
      const msg = `📋 *APPROVAL & CEK RETUR SALESMAN*\n\nSebagai Supervisor Sales, silakan buka menu Approval Retur untuk memeriksa, mengedit, dan menyetujui retur salesman:`;
      if (bot) {
        await bot.sendMessage(remoteJid, msg, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Buka Approval Retur Sales', web_app: { url: miniAppUrl } }]
            ]
          }
        });
      } else {
        await clientAdapter.sendMessage(remoteJid, `${msg}\n\n👉 ${miniAppUrl}`);
      }
      return true;
    }

    const isDriver = contact && contact.group && (contact.group.toUpperCase().includes('SOPIR') || contact.group.toUpperCase().includes('DRIVER'));
    if (isDriver) {
      const { getTelegramBot } = require('../telegram');
      const bot = getTelegramBot(sessionId);
      const miniAppUrl = `${process.env.MINI_APP_URL || 'https://auditwa.padmasaripangan.co.id/api/twa'}?mode=list_today&sessionId=${encodeURIComponent(sessionId)}`;
      const msg = `🚚 *PENARIKAN BARANG RETUR*\n\nSebagai Driver/Kenek, Anda bertugas memproses penarikan barang retur yang telah disetujui Supervisor Sales.\n\nSilakan klik tombol di bawah untuk membuka daftar retur siap ditarik:`;
      if (bot) {
        await bot.sendMessage(remoteJid, msg, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚚 Buka Penarikan & Cetak Retur', web_app: { url: miniAppUrl } }]
            ]
          }
        });
      } else {
        await clientAdapter.sendMessage(remoteJid, `${msg}\n\n👉 ${miniAppUrl}`);
      }
      return true;
    }

    let preSalesCode = null;
    let preSalesName = null;
    if (contact && contact.kodeSales) {
      preSalesCode = contact.kodeSales.split(/[:;,]/)[0].trim();
      const sItem = await prisma.saleableItem.findFirst({
        where: { salesman_code: preSalesCode, salesman_name: { not: null } },
        select: { salesman_name: true }
      });
      if (sItem?.salesman_name) {
        preSalesName = sItem.salesman_name;
      } else {
        const sCov = await prisma.salesCoverage.findFirst({
          where: { salesman_code: preSalesCode, salesman_name: { not: null } },
          select: { salesman_name: true }
        });
        if (sCov?.salesman_name) preSalesName = sCov.salesman_name;
      }
    }

    setUserState(remoteJid, STATE_RETUR_CUSTOMER);
    returDataSession[remoteJid] = {
      contactName: senderName,
      telegramUserId: remoteJid,
      salespersonCode: preSalesCode,
      salespersonName: preSalesName
    };
    await clientAdapter.sendMessage(remoteJid, '📦 *Form Retur*\n\nSilakan masukkan *Kode Customer, Nama Customer, atau No Invoice*:');
    return true; // handled
  }

  // COMMAND: /cetak & /reprint (Keep unchanged)
  if (lowerText === '/cetak' || lowerText === 'cetak') {
    const contact = await prisma.contact.findFirst({
      where: { telegramId: String(remoteJid) }
    });
    const isGudang = contact && contact.group && contact.group.toUpperCase().includes('GUDANG');
    
    const whereClause = { isPrinted: false };
    if (!isGudang) {
      whereClause.telegramUserId = remoteJid;
    }

    const unprinted = await prisma.returnTransaction.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (unprinted.length === 0) {
      await clientAdapter.sendMessage(remoteJid, 'Tidak ada transaksi retur yang belum dicetak hari ini.');
      return true;
    }

    const inlineKeyboard = unprinted.map(tx => {
       return [{ text: `${tx.customerCode || '-'} - ${tx.customerName || '-'} - ${tx.invoiceNumber || '-'}`, callback_data: `PRINT_${tx.id}` }];
    });

    const { getTelegramBot } = require('../telegram');
    const bot = getTelegramBot(sessionId);
    if (bot) {
       await bot.sendMessage(remoteJid, 'Pilih retur yang ingin dicetak:', {
         reply_markup: { inline_keyboard: inlineKeyboard }
       });
    } else {
       await clientAdapter.sendMessage(remoteJid, 'Daftar retur belum dicetak:\n' + unprinted.map(tx => `- ${tx.customerCode || '-'} - ${tx.customerName || '-'} - ${tx.invoiceNumber || '-'}`).join('\n'));
    }
    return true;
  }

  if (lowerText === '/reprint' || lowerText === 'reprint') {
    const contact = await prisma.contact.findFirst({
      where: { telegramId: String(remoteJid) }
    });
    const isGudang = contact && contact.group && contact.group.toUpperCase().includes('GUDANG');
    
    const whereClause = { isPrinted: true };
    if (!isGudang) {
      whereClause.telegramUserId = remoteJid;
    }

    const printed = await prisma.returnTransaction.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    if (printed.length === 0) {
      await clientAdapter.sendMessage(remoteJid, 'Tidak ada transaksi retur yang sudah dicetak sebelumnya.');
      return true;
    }

    const inlineKeyboard = printed.map(tx => {
       return [{ text: `${tx.customerCode || '-'} - ${tx.customerName || '-'} - ${tx.invoiceNumber || '-'}`, callback_data: `PRINT_${tx.id}` }];
    });

    const { getTelegramBot } = require('../telegram');
    const bot = getTelegramBot(sessionId);
    if (bot) {
       await bot.sendMessage(remoteJid, 'Pilih retur yang ingin DICETAK ULANG (Reprint):', {
         reply_markup: { inline_keyboard: inlineKeyboard }
       });
    } else {
       await clientAdapter.sendMessage(remoteJid, 'Daftar retur sudah dicetak:\n' + printed.map(tx => `- ${tx.customerCode || '-'} - ${tx.customerName || '-'} - ${tx.invoiceNumber || '-'}`).join('\n'));
    }
    return true;
  }

  // Handle Callbacks from inline keyboards
  if (lowerText.startsWith('callback:')) {
     const action = text.split(':')[1];
     const { getTelegramBot } = require('../telegram');
     const bot = getTelegramBot(sessionId);

     // MAIN MENU ACTION REDIRECTS
     if (action === 'MAIN_RETUR') {
        normalizedMsg.text = '/retur';
        return await handleReturFlow(normalizedMsg, sessionId, clientAdapter);
     }
     if (action === 'MAIN_CETAK') {
        normalizedMsg.text = '/cetak';
        return await handleReturFlow(normalizedMsg, sessionId, clientAdapter);
     }
     if (action === 'MAIN_REPRINT') {
        normalizedMsg.text = '/reprint';
        return await handleReturFlow(normalizedMsg, sessionId, clientAdapter);
     }

     // CONTINUE via CHAT (user pilih lanjut via chat dari tawaran Mini App)
     if (action.startsWith('CONTINUE_CHAT_')) {
        const targetState = action.replace('CONTINUE_CHAT_', '');
        setUserState(remoteJid, STATE_RETUR_TYPE);
        const { getTelegramBot } = require('../telegram');
        const bot = getTelegramBot(sessionId);
        if (bot) {
          await bot.sendMessage(remoteJid, 'Baik, lanjut via chat.\nPilih jenis retur:', {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'TUNAI', callback_data: 'TYPE_TUNAI' }, { text: 'KREDIT', callback_data: 'TYPE_KREDIT' }],
                [{ text: '🔙 Kembali', callback_data: `BACK_${targetState}` }, { text: '🏠 Batal', callback_data: 'CANCEL' }]
              ]
            }
          });
        }
        return true;
     }

     // PRINT
     if (action.startsWith('PRINT_')) {
        const txId = action.split('PRINT_')[1];
        const tx = await prisma.returnTransaction.findUnique({ where: { id: txId } });
        if (tx) {
           await clientAdapter.sendMessage(remoteJid, 'Mencetak struk, mohon tunggu... ⏳');
           const contact = await prisma.contact.findFirst({ where: { telegramId: String(remoteJid) } });
           const printedBy = contact?.name || normalizedMsg.pushName || 'User';
           const result = await ReturnService.printReceipt(tx, null, printedBy);
           await clientAdapter.sendMessage(remoteJid, result.message);
        }
        return true;
     }

     // CANCEL
     if (action === 'CANCEL') {
       clearUserState(remoteJid);
       delete returDataSession[remoteJid];
       await sendWithMenu(sessionId, remoteJid, clientAdapter, '❌ Transaksi retur dibatalkan.');
       return true;
     }

     // BACK Navigation
     if (action.startsWith('BACK_')) {
        const targetState = action.split('BACK_')[1];
        setUserState(remoteJid, targetState);
        
        if (targetState === STATE_RETUR_CUSTOMER) {
           await clientAdapter.sendMessage(remoteJid, '📦 *Form Retur*\n\nSilakan masukkan *Kode Customer, Nama Customer, atau No Invoice*:');
        } else if (targetState === STATE_RETUR_CUSTOMER_SELECT) {
           if (bot) {
             const deliveries = returDataSession[remoteJid].tempDeliveries;
             const currentPage = returDataSession[remoteJid].currentPage || 0;
             const keyboard = getPaginationKeyboard(deliveries, currentPage);
             await bot.sendMessage(remoteJid, 'Pilih dari daftar berikut:', {
               reply_markup: { inline_keyboard: keyboard }
             });
           }
        } else if (targetState === STATE_RETUR_TYPE) {
           if (bot) {
              await bot.sendMessage(remoteJid, 'Pilih jenis retur:', {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: 'TUNAI', callback_data: 'TYPE_TUNAI' }, { text: 'KREDIT', callback_data: 'TYPE_KREDIT' }],
                    [{ text: '🔙 Kembali', callback_data: `BACK_${STATE_RETUR_CUSTOMER}` }, { text: '🏠 Batal', callback_data: 'CANCEL' }]
                  ]
                }
              });
           }
        } else if (targetState === STATE_RETUR_LOCATION) {
           if (bot) {
              await bot.sendMessage(remoteJid, 'Sekarang, silakan kirimkan *Lokasi (Share Location)* Anda saat ini.', {
                 reply_markup: {
                   keyboard: [[{ text: '📍 Kirim Lokasi Saat Ini', request_location: true }]],
                   resize_keyboard: true,
                   one_time_keyboard: true
                 }
              });
              await bot.sendMessage(remoteJid, 'Atau tekan tombol di bawah jika ingin membatalkan/kembali.', {
                 reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Kembali', callback_data: `BACK_${STATE_RETUR_TYPE}` }, { text: '🏠 Batal', callback_data: 'CANCEL' }]]
                 }
              });
           }
        }
        return true;
     }

     // PAGINATION
     if (action.startsWith('PAGE_')) {
        const page = parseInt(action.split('PAGE_')[1]);
        returDataSession[remoteJid].currentPage = page;
        const deliveries = returDataSession[remoteJid].tempDeliveries;
        const keyboard = getPaginationKeyboard(deliveries, page);
        
        if (bot) {
            await bot.sendMessage(remoteJid, `Menampilkan halaman ${page + 1}:`, {
                reply_markup: { inline_keyboard: keyboard }
            });
        }
        return true;
     }

     // CUSTOMER SELECT
     if (action.startsWith('CUST_')) {
       if (currentState === STATE_RETUR_CUSTOMER_SELECT) {
          const idx = parseInt(action.split('CUST_')[1]);
          const delivery = returDataSession[remoteJid].tempDeliveries[idx];
          returDataSession[remoteJid].customerCode = delivery.customer_code;
          returDataSession[remoteJid].customerName = delivery.customer_name;
          returDataSession[remoteJid].invoiceNumber = delivery.invoice_number;
          returDataSession[remoteJid].salespersonCode = delivery.salesperson_code;

          let spName = delivery.salesperson_name;
          if (delivery.salesperson_code) {
            const saleable = await prisma.saleableItem.findFirst({
              where: { salesman_code: delivery.salesperson_code, salesman_name: { not: null } },
              select: { salesman_name: true }
            });
            if (saleable?.salesman_name) spName = saleable.salesman_name;
          }
          returDataSession[remoteJid].salespersonName = spName;
          returDataSession[remoteJid].originLatitude = delivery.latitude;
          returDataSession[remoteJid].originLongitude = delivery.longitude;
          returDataSession[remoteJid].isCustomerValid = true;
          // We can't delete tempDeliveries if we want BACK to work perfectly, 
          // but if we go BACK to CUSTOMER, it restarts anyway. Let's keep it to allow BACK to TYPE.
          
          await clientAdapter.sendMessage(remoteJid, `Faktur dipilih: *${delivery.invoice_number} - ${delivery.salesperson_code} - ${delivery.customer_name}*`);
          setUserState(remoteJid, STATE_RETUR_TYPE);
          
          if (bot) {
             await bot.sendMessage(remoteJid, '✅ Faktur dipilih!\n\nPilih jenis retur:', {
               reply_markup: {
                 inline_keyboard: [
                   [{ text: 'TUNAI', callback_data: 'TYPE_TUNAI' }, { text: 'KREDIT', callback_data: 'TYPE_KREDIT' }],
                   [{ text: '🔙 Kembali', callback_data: `BACK_${STATE_RETUR_CUSTOMER}` }, { text: '🏠 Batal', callback_data: 'CANCEL' }]
                 ]
               }
             });
          }
       }
       return true;
     }
     
     // TYPE SELECT
     if (action.startsWith('TYPE_')) {
       if (currentState === STATE_RETUR_TYPE) {
          returDataSession[remoteJid].returnType = action.split('TYPE_')[1];
          setUserState(remoteJid, STATE_RETUR_LOCATION);
          
          if (bot) {
             await bot.sendMessage(remoteJid, 'Tipe retur disimpan.\n\nSekarang, silakan kirimkan *Lokasi (Share Location)* Anda saat ini.', {
                reply_markup: {
                  keyboard: [[{ text: '📍 Kirim Lokasi Saat Ini', request_location: true }]],
                  resize_keyboard: true,
                  one_time_keyboard: true
                }
             });
             
             await bot.sendMessage(remoteJid, 'Atau navigasi:', {
                 reply_markup: {
                    inline_keyboard: [[{ text: '🔙 Kembali', callback_data: `BACK_${STATE_RETUR_TYPE}` }, { text: '🏠 Batal', callback_data: 'CANCEL' }]]
                 }
              });
          }
          return true;
       }
     }

     // CONFIRM ACTION
     if (action.startsWith('CONFIRM_')) {
        if (currentState === STATE_RETUR_CONFIRM) {
           const decision = action.split('CONFIRM_')[1];
           if (decision === 'YA') {
               try {
                 const data = returDataSession[remoteJid];
                 await clientAdapter.sendMessage(remoteJid, 'Menyimpan data retur... ⏳');
                 
                 const generatedReturnNumber = await ReturnService.generateReturnNumber();
                 
                 let distanceDiff = null;
                 if (data.originLatitude && data.originLongitude && data.latitude && data.longitude) {
                   distanceDiff = ReturnService.calculateDistance(data.originLatitude, data.originLongitude, data.latitude, data.longitude);
                 }
                 
                 let spCode = data.salespersonCode;
                 let spName = data.salespersonName;
                 if (spCode && (!spName || spName === '-' || spName === 'Sales')) {
                   const saleable = await prisma.saleableItem.findFirst({
                     where: { salesman_code: spCode, salesman_name: { not: null } },
                     select: { salesman_name: true }
                   });
                   if (saleable?.salesman_name) {
                     spName = saleable.salesman_name;
                   } else {
                     const cov = await prisma.salesCoverage.findFirst({
                       where: { salesman_code: spCode, salesman_name: { not: null } },
                       select: { salesman_name: true }
                     });
                     if (cov?.salesman_name) spName = cov.salesman_name;
                   }
                 }
                 
                 const newTx = await prisma.returnTransaction.create({
                   data: {
                     returnNumber: generatedReturnNumber,
                     telegramUserId: data.telegramUserId,
                     contactName: data.contactName,
                     customerCode: data.customerCode,
                     customerName: data.customerName,
                     invoiceNumber: data.invoiceNumber,
                     salespersonCode: spCode,
                     salespersonName: spName,
                     originLatitude: data.originLatitude,
                     originLongitude: data.originLongitude,
                     distanceDiff: distanceDiff,
                     isCustomerValid: data.isCustomerValid || false,
                     returnType: data.returnType || 'TUNAI',
                     latitude: data.latitude,
                     longitude: data.longitude,
                     locationAddress: data.locationAddress,
                     photoUrl: data.photoUrl,
                     isPrinted: false
                   }
                 });
  
                 // Success message (and notify departments)
                 await sendWithMenu(sessionId, remoteJid, clientAdapter, `✅ Header Retur berhasil disimpan ke database.\nNo Retur: *${generatedReturnNumber}*\n\nSilakan buka menu *Input Detail Retur* untuk memasukkan barang retur.`);
                 
                 // Background notify
                 ReturnService.notifyDepartments(sessionId, newTx);
  
                 // Sync to Server
                 ReturnService.syncToServer(newTx).catch(err => {
                   console.error('[ReturnBotHandler] Async Sync Error:', err);
                 });

                 clearUserState(remoteJid);
                 delete returDataSession[remoteJid];
               } catch (err) {
                 console.error('[ReturnBotHandler] Save return error:', err);
                 await sendWithMenu(sessionId, remoteJid, clientAdapter, '⚠️ Terjadi kesalahan saat menyimpan data retur.');
               }
           } else if (decision === 'BATAL') {
               clearUserState(remoteJid);
               delete returDataSession[remoteJid];
               await sendWithMenu(sessionId, remoteJid, clientAdapter, '❌ Transaksi retur dibatalkan.');
           }
        }
        return true;
     }
  }

  // State Machine
  if (currentState === STATE_RETUR_CUSTOMER) {
    await clientAdapter.sendMessage(remoteJid, 'Mencari data pengiriman... ⏳');
    const deliveries = await ReturnService.searchDailyDeliveries(text);
    
    if (deliveries && deliveries.length > 0) {
      if (deliveries.length === 1) {
        const delivery = deliveries[0];
        returDataSession[remoteJid].customerCode = delivery.customer_code;
        returDataSession[remoteJid].customerName = delivery.customer_name;
        returDataSession[remoteJid].invoiceNumber = delivery.invoice_number;
        returDataSession[remoteJid].salespersonCode = delivery.salesperson_code;

        let singleSpName = delivery.salesperson_name;
        if (delivery.salesperson_code) {
          const saleable = await prisma.saleableItem.findFirst({
            where: { salesman_code: delivery.salesperson_code, salesman_name: { not: null } },
            select: { salesman_name: true }
          });
          if (saleable?.salesman_name) singleSpName = saleable.salesman_name;
        }
        returDataSession[remoteJid].salespersonName = singleSpName;
        returDataSession[remoteJid].originLatitude = delivery.latitude;
        returDataSession[remoteJid].originLongitude = delivery.longitude;
        returDataSession[remoteJid].isCustomerValid = true;
        await clientAdapter.sendMessage(remoteJid, `Faktur ditemukan: *${delivery.invoice_number} - ${delivery.salesperson_code} - ${delivery.customer_name}*`);
        
        setUserState(remoteJid, STATE_RETUR_TYPE);
        
        const { getTelegramBot } = require('../telegram');
        const bot = getTelegramBot(sessionId);
        if (bot) {
           await bot.sendMessage(remoteJid, '✅ Faktur ditemukan!\n\nPilih jenis retur:', {
             reply_markup: {
               inline_keyboard: [
                 [{ text: 'TUNAI', callback_data: 'TYPE_TUNAI' }, { text: 'KREDIT', callback_data: 'TYPE_KREDIT' }],
                 [{ text: '🔙 Kembali', callback_data: `BACK_${STATE_RETUR_CUSTOMER}` }, { text: '🏠 Batal', callback_data: 'CANCEL' }]
               ]
             }
           });
        }
      } else {
        returDataSession[remoteJid].tempDeliveries = deliveries;
        returDataSession[remoteJid].currentPage = 0;
        setUserState(remoteJid, STATE_RETUR_CUSTOMER_SELECT);
        
        const { getTelegramBot } = require('../telegram');
        const bot = getTelegramBot(sessionId);
        if (bot) {
           const keyboard = getPaginationKeyboard(deliveries, 0);
           await bot.sendMessage(remoteJid, `Ditemukan ${deliveries.length} data. Pilih dari daftar berikut:`, {
             reply_markup: { inline_keyboard: keyboard }
           });
        }
      }
    } else {
      await clientAdapter.sendMessage(remoteJid, `❌ Data pengiriman tidak ditemukan untuk: *${text}*\nSilakan coba kata kunci lain atau klik Batal.`);
      
      const { getTelegramBot } = require('../telegram');
      const bot = getTelegramBot(sessionId);
      if (bot) {
         await bot.sendMessage(remoteJid, 'Pilihan:', {
             reply_markup: {
                inline_keyboard: [[{ text: '🏠 Batal', callback_data: 'CANCEL' }]]
             }
         });
      }
    }
    return true;
  }
  
  if (currentState === STATE_RETUR_CUSTOMER_SELECT) {
     await clientAdapter.sendMessage(remoteJid, 'Silakan pilih customer dari tombol yang disediakan, atau tekan Batal.');
     return true;
  }

  if (currentState === STATE_RETUR_LOCATION) {
    if (mediaType === 'location' && rawMessage?.location) {
      const lat = rawMessage.location.latitude;
      const lon = rawMessage.location.longitude;
      returDataSession[remoteJid].latitude = lat;
      returDataSession[remoteJid].longitude = lon;
      
      await clientAdapter.sendMessage(remoteJid, 'Mencari alamat dari koordinat... ⏳');
      const address = await ReturnService.reverseGeocode(lat, lon);
      returDataSession[remoteJid].locationAddress = address;

      setUserState(remoteJid, STATE_RETUR_PHOTO);
      
      const { getTelegramBot } = require('../telegram');
      const bot = getTelegramBot(sessionId);
      if (bot) {
         // Restore main menu keyboard and send instruction
         await bot.sendMessage(remoteJid, 'Lokasi diterima.\n\nSekarang, silakan *Upload Foto Barang/Faktur* retur.', {
           reply_markup: defaultReplyKeyboard
         });
         
         await bot.sendMessage(remoteJid, 'Atau navigasi:', {
             reply_markup: {
                inline_keyboard: [[{ text: '🔙 Kembali', callback_data: `BACK_${STATE_RETUR_LOCATION}` }, { text: '🏠 Batal', callback_data: 'CANCEL' }]]
             }
          });
      }
    } else {
      await clientAdapter.sendMessage(remoteJid, '⚠️ Mohon kirimkan Lokasi menggunakan fitur Share Location Telegram.');
    }
    return true;
  }

  if (currentState === STATE_RETUR_PHOTO) {
    if (mediaType === 'image/jpeg' && mediaUrl) {
       returDataSession[remoteJid].photoUrl = mediaUrl;
       setUserState(remoteJid, STATE_RETUR_CONFIRM);
       
       const data = returDataSession[remoteJid];
       let summary = `*KONFIRMASI RETUR*\n\n`;
       summary += `Customer: ${data.customerCode} ${data.customerName ? '- ' + data.customerName : ''}\n`;
       summary += `Invoice: ${data.invoiceNumber || '-'}\n`;
       summary += `Salesperson: ${data.salespersonCode || '-'} - ${data.salespersonName || '-'}\n`;
       summary += `Tipe: ${data.returnType}\n`;
       summary += `Lokasi: ${data.locationAddress || 'Koordinat GPS'}\n\n`;
       summary += `Apakah data ini sudah benar?`;
       
       const { getTelegramBot } = require('../telegram');
       const bot = getTelegramBot(sessionId);
       if (bot) {
          await bot.sendMessage(remoteJid, summary, {
             reply_markup: {
                inline_keyboard: [
                   [{ text: '✅ Konfirmasi Simpan', callback_data: 'CONFIRM_YA' }],
                   [{ text: '🔙 Kembali Ubah Foto', callback_data: `BACK_${STATE_RETUR_PHOTO}` }],
                   [{ text: '❌ Batal Semua', callback_data: 'CONFIRM_BATAL' }]
                ]
             }
          });
       } else {
          await clientAdapter.sendMessage(remoteJid, summary + "\n\nKetik YA untuk simpan, atau BATAL untuk membatalkan.");
       }
    } else {
       await clientAdapter.sendMessage(remoteJid, '⚠️ Mohon kirimkan Foto (Image).');
    }
    return true;
  }

  if (currentState === STATE_RETUR_CONFIRM) {
     // If user types instead of clicking button (fallback)
     if (lowerText === 'ya') {
         // handle manually just in case
         text = "callback:CONFIRM_YA"; // Mock it to be handled by callback above? No, let's just instruct them.
         await clientAdapter.sendMessage(remoteJid, 'Silakan gunakan tombol ✅ Konfirmasi Simpan pada pesan di atas.');
     } else if (lowerText === 'batal') {
         text = "callback:CONFIRM_BATAL";
         await clientAdapter.sendMessage(remoteJid, 'Silakan gunakan tombol ❌ Batal Semua pada pesan di atas.');
     } else {
         await clientAdapter.sendMessage(remoteJid, 'Silakan gunakan tombol yang disediakan untuk konfirmasi.');
     }
     return true;
  }

  return false; // not handled
}

module.exports = { handleReturFlow };
