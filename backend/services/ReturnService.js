const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

class ReturnService {
  /**
   * Reverse Geocode using Nominatim (OpenStreetMap)
   */
  static async reverseGeocode(lat, lon) {
    if (!lat || !lon) return null;
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
      // Adding a generic User-Agent is required by Nominatim
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'AuditWA/1.0 (internal tool)' }
      });
      if (response.data && response.data.display_name) {
        return response.data.display_name;
      }
      return null;
    } catch (error) {
      console.error('[ReturnService] Reverse Geocode error:', error.message);
      return null;
    }
  }

  /**
   * Helper to format items grouped by productCode for Telegram messages
   */
  static _formatGroupedItemsText(items, isCompact = false) {
    if (!items || items.length === 0) return '';
    const activeItems = items.filter(it => !it.deletedAt);
    if (activeItems.length === 0) return '';
    
    const groups = {};
    let grandTotal = 0;
    let hasPrice = false;

    activeItems.forEach(it => {
      if (!groups[it.productCode]) {
        groups[it.productCode] = {
          productCode: it.productCode,
          productName: it.productName,
          alasan: it.alasan,
          uoms: []
        };
      }
      const p = it.price !== undefined && it.price !== null ? parseFloat(it.price) : null;
      const sub = it.totalPrice !== undefined && it.totalPrice !== null
        ? parseFloat(it.totalPrice)
        : (p !== null ? p * (parseFloat(it.qty) || 0) : null);

      if (sub !== null && sub > 0) {
        grandTotal += sub;
        hasPrice = true;
      }

      groups[it.productCode].uoms.push({
        qty: it.qty,
        qtyGood: it.qtyGood,
        qtyBad: it.qtyBad,
        uom: it.uom,
        price: p,
        totalPrice: sub
      });
    });
    const grouped = Object.values(groups);
    
    const lines = grouped.map((g, i) => {
      const uomsStr = g.uoms.map(u => {
        const parts = [];
        if (u.qtyGood > 0) parts.push(`Good: ${u.qtyGood}`);
        if (u.qtyBad > 0) parts.push(`Bad: ${u.qtyBad}`);
        const stockDetail = parts.length > 0 ? ` (${parts.join(', ')})` : '';
        const priceInfo = u.price ? ` @ Rp ${Math.round(u.price).toLocaleString('id-ID')}` : '';
        return `${u.qty} ${u.uom || ''}${priceInfo}${stockDetail}`;
      }).join('; ');

      if (isCompact) {
        return `  ${i + 1}. ${g.productCode || '-'} - ${g.productName || '-'} — Qty: ${uomsStr}`;
      } else {
        return `  ${i + 1}. ${g.productCode || '-'} - ${g.productName || '-'}\n` +
               `     Qty: ${uomsStr}\n` +
               `     Alasan: ${g.alasan || '-'}`;
      }
    });

    if (hasPrice && grandTotal > 0) {
      lines.push(`\n💰 *Total Estimasi Retur: Rp ${Math.round(grandTotal).toLocaleString('id-ID')}*`);
    }

    return lines.join('\n');
  }

  /**
   * Validate Customer by searching Code or Name (Max 10)
   */
  static async validateCustomer(input) {
    if (!input) return [];
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { kdcust: { contains: input, mode: 'insensitive' } },
          { nmcust: { contains: input, mode: 'insensitive' } }
        ]
      },
      take: 10
    });
    return customers;
  }

  /**
   * Search Daily Deliveries by Customer Code, Name, or Invoice Number
   */
  static async searchDailyDeliveries(input) {
    if (!input) return [];
    const deliveries = await prisma.dailyDelivery.findMany({
      where: {
        OR: [
          { customer_code: { contains: input, mode: 'insensitive' } },
          { customer_name: { contains: input, mode: 'insensitive' } },
          { invoice_number: { contains: input, mode: 'insensitive' } }
        ]
      },
      take: 50
    });
    return deliveries;
  }

  /**
   * Calculate distance between two coordinates in meters (Haversine formula)
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371e3; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Send Notifications to respective departments
   */
  static async notifyDepartments(sessionId, returnTx) {
    try {
      const { getTelegramBot } = require('../telegram');
      // Get target IDs from AppSetting
      const keys = ['NOTIF_GUDANG_TG_ID', 'NOTIF_KASIR_TG_ID', 'NOTIF_EDP_TG_ID'];
      const settings = await prisma.appSetting.findMany({
        where: { key: { in: keys } }
      });

      const targets = {};
      settings.forEach(s => {
        targets[s.key] = s.value;
      });

      const bot = getTelegramBot(sessionId) || getTelegramBot('telegram-main');
      if (!bot) {
        console.error('[ReturnService] Cannot find bot instance to send notification');
        return;
      }

      const message = `🔔 *INFO RETUR FALLBACK*\n\n` +
        `👤 *Pembuat:* ${returnTx.contactName || 'Tidak diketahui'}\n` +
        `🧾 *Invoice:* ${returnTx.invoiceNumber || '-'}\n` +
        `💼 *Salesperson:* ${returnTx.salespersonCode || '-'} - ${returnTx.salespersonName || '-'}\n` +
        `🏪 *Customer:* ${returnTx.customerCode} - ${returnTx.customerName}\n` +
        `🏷 *Tipe Retur:* ${returnTx.returnType}\n` +
        `📍 *Lokasi:* ${returnTx.locationAddress || 'Lokasi GPS (tanpa alamat)'}\n` +
        (returnTx.distanceDiff !== null ? `📏 *Selisih Jarak:* ${Math.round(returnTx.distanceDiff)} meter\n` : '') +
        `🕒 *Waktu:* ${returnTx.createdAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n\n` +
        `Data ini dicatat melalui sistem darurat/fallback Telegram.`;

      // Define who gets the notification
      const chatIdsToNotify = new Set();
      if (targets['NOTIF_GUDANG_TG_ID']) chatIdsToNotify.add(targets['NOTIF_GUDANG_TG_ID']);
      if (targets['NOTIF_EDP_TG_ID']) chatIdsToNotify.add(targets['NOTIF_EDP_TG_ID']);
      if (returnTx.returnType === 'TUNAI' && targets['NOTIF_KASIR_TG_ID']) {
        chatIdsToNotify.add(targets['NOTIF_KASIR_TG_ID']);
      }

      for (const chatId of chatIdsToNotify) {
        if (returnTx.photoUrl) {
          const photoPath = path.join(__dirname, '..', returnTx.photoUrl);
          if (fs.existsSync(photoPath)) {
            await bot.sendPhoto(chatId, photoPath, { caption: message, parse_mode: 'Markdown' });
            continue;
          }
        }
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      }

      console.log(`[ReturnService] Notifications sent to ${chatIdsToNotify.size} targets.`);

    } catch (error) {
      console.error('[ReturnService] Notify Departments error:', error);
    }
  }

  /**
   * Create a ReturnTransaction with its ReturnItems in a single DB transaction.
   * Used by Mini App submissions.
   */
  static async createReturnWithItems(data) {
    return await prisma.$transaction(async (tx) => {
      const returnNumber = await ReturnService.generateReturnNumber(tx);

      let spName = data.salespersonName;
      if (data.salespersonCode && (!spName || spName === 'Sales' || spName === '-')) {
        const saleable = await tx.saleableItem.findFirst({
          where: { salesman_code: data.salespersonCode, salesman_name: { not: null } },
          select: { salesman_name: true }
        });
        if (saleable && saleable.salesman_name) {
          spName = saleable.salesman_name;
        } else {
          const cov = await tx.salesCoverage.findFirst({
            where: { salesman_code: data.salespersonCode, salesman_name: { not: null } },
            select: { salesman_name: true }
          });
          if (cov && cov.salesman_name) {
            spName = cov.salesman_name;
          }
        }
      }

      const newTx = await tx.returnTransaction.create({
        data: {
          returnNumber,
          source:          data.source || 'MINI_APP',
          telegramUserId:  data.telegramUserId,
          contactName:     data.contactName,
          customerCode:    data.customerCode,
          customerName:    data.customerName,
          invoiceNumber:   data.invoiceNumber,
          salespersonCode: data.salespersonCode,
          salespersonName: spName || data.salespersonName,
          isCustomerValid: data.isCustomerValid || false,
          returnType:      data.returnType,
          latitude:        data.latitude,
          longitude:       data.longitude,
          locationAddress: data.locationAddress,
          photoUrl:        data.photoUrl,
          originLatitude:  data.originLatitude,
          originLongitude: data.originLongitude,
          distanceDiff:    data.distanceDiff,
          isPrinted:       false,
          isDetailPrinted: false,
          isSynced:        false,
          status:          data.status || 'SUBMITTED',
          items: {
            create: (data.items || []).map(item => {
              const p = item.price !== undefined && item.price !== null ? parseFloat(item.price) : (item.harga !== undefined && item.harga !== null ? parseFloat(item.harga) : null);
              const q = parseFloat(item.qty) || 0;
              const sub = item.totalPrice !== undefined && item.totalPrice !== null ? parseFloat(item.totalPrice) : (p !== null ? p * q : null);
              return {
                productCode: item.productCode,
                productName: item.productName,
                uom:         item.uom,
                konversi:    item.konversi ? parseInt(item.konversi) : null,
                price:       p,
                totalPrice:  sub,
                qty:         q,
                qtyGood:     item.qtyGood !== undefined && item.qtyGood !== null ? parseFloat(item.qtyGood) : null,
                qtyBad:      item.qtyBad !== undefined && item.qtyBad !== null ? parseFloat(item.qtyBad) : null,
                originalQty: q,
                alasan:      item.alasan,
                createdByGroup: data.createdByGroup || 'Salesman',
              };
            })
          }
        },
        include: { items: true }
      });

      await tx.returnHistory.create({
        data: {
          returnTransactionId: newTx.id,
          action: 'CREATED',
          actorRole: data.createdByGroup || 'Salesman',
          actorName: data.contactName || 'Salesman',
          actorId: data.telegramUserId ? String(data.telegramUserId) : null,
          changes: { itemCount: (data.items || []).length }
        }
      });

      return newTx;
    });
  }

  /**
   * Add or edit items to an existing ReturnTransaction.
   * Also soft-delete items that are no longer in the list.
   */
  static async addItemsToReturn(returnId, items, createdByGroup = 'GUDANG', actorData = null) {
    return await prisma.$transaction(async (tx) => {
      // Dapatkan semua item eksisting
      const existingItems = await tx.returnItem.findMany({
        where: { returnTransactionId: returnId }
      });

      const existingMap = new Map(existingItems.map(ex => [ex.id, ex]));

      // Pulihkan ID jika item baru memiliki productCode dan uom yang sama dengan item eksisting
      for (const item of items) {
        if (!item.id && item.productCode && item.uom) {
          const matched = existingItems.find(ex => !ex.deletedAt && ex.productCode === item.productCode && ex.uom === item.uom);
          if (matched) {
            item.id = matched.id;
          }
        }
      }

      // Item yang dikirim dan memiliki ID yang valid di DB
      const incomingIds = items
        .filter(it => it.id && existingMap.has(it.id))
        .map(it => it.id);

      // Soft-delete item yang ada di DB tapi tidak ada di data baru (dan belum di-soft-delete)
      const itemsToDelete = existingItems.filter(ex => !incomingIds.includes(ex.id) && !ex.deletedAt);
      if (itemsToDelete.length > 0) {
        await tx.returnItem.updateMany({
          where: { id: { in: itemsToDelete.map(it => it.id) } },
          data: { deletedAt: new Date() }
        });
      }

      // Upsert (update or insert) item baru/lama
      for (const item of items) {
        if (item.deletedAt) continue; // Jangan proses item yang sudah dihapus
        
        const isExisting = item.id && existingMap.has(item.id);
        
        if (isExisting) {
          const p = item.price !== undefined && item.price !== null ? parseFloat(item.price) : (item.harga !== undefined && item.harga !== null ? parseFloat(item.harga) : undefined);
          const q = parseFloat(item.qty) || 0;
          const sub = item.totalPrice !== undefined && item.totalPrice !== null ? parseFloat(item.totalPrice) : (p !== undefined ? p * q : undefined);

          await tx.returnItem.update({
            where: { id: item.id },
            data: {
              productCode: item.productCode || undefined,
              productName: item.productName || undefined,
              uom:         item.uom || undefined,
              konversi:    item.konversi ? parseInt(item.konversi) : undefined,
              price:       p,
              totalPrice:  sub,
              qty:         q,
              qtyGood:     item.qtyGood !== undefined && item.qtyGood !== null ? parseFloat(item.qtyGood) : null,
              qtyBad:      item.qtyBad !== undefined && item.qtyBad !== null ? parseFloat(item.qtyBad) : null,
              alasan:      item.alasan,
              deletedAt:   null,
            }
          });
        } else {
          // Item baru ditambahkan oleh pengedit
          const p = item.price !== undefined && item.price !== null ? parseFloat(item.price) : (item.harga !== undefined && item.harga !== null ? parseFloat(item.harga) : null);
          const q = parseFloat(item.qty) || 0;
          const sub = item.totalPrice !== undefined && item.totalPrice !== null ? parseFloat(item.totalPrice) : (p !== null ? p * q : null);

          await tx.returnItem.create({
            data: {
              returnTransactionId: returnId,
              productCode: item.productCode,
              productName: item.productName,
              uom:         item.uom,
              konversi:    item.konversi ? parseInt(item.konversi) : null,
              price:       p,
              totalPrice:  sub,
              qty:         q,
              qtyGood:     item.qtyGood !== undefined && item.qtyGood !== null ? parseFloat(item.qtyGood) : null,
              qtyBad:      item.qtyBad !== undefined && item.qtyBad !== null ? parseFloat(item.qtyBad) : null,
              originalQty: q,
              alasan:      item.alasan,
              createdByGroup: createdByGroup,
            }
          });
        }
      }

      // Catat history jika actorData diberikan
      if (actorData) {
        await tx.returnHistory.create({
          data: {
            returnTransactionId: returnId,
            action: actorData.action || 'EDITED_ITEMS',
            actorRole: actorData.role || createdByGroup,
            actorName: actorData.name || 'User',
            actorId: actorData.id ? String(actorData.id) : null,
            changes: { itemCount: items.filter(it => !it.deletedAt).length }
          }
        });
      }

      const updatedTx = await tx.returnTransaction.update({
        where: { id: returnId },
        data: {
          isSynced: false,
          ...(actorData?.status ? { status: actorData.status } : {})
        },
        include: {
          items: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' }
          },
          histories: true
        }
      });
      return updatedTx;
    });
  }

  /**
   * Generate No Retur (YYMMDD001)
   */
  static async generateReturnNumber(client = prisma) {
    const today = new Date();
    const yy = String(today.getFullYear()).slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const prefix = `${yy}${mm}${dd}`;

    const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date().setHours(23, 59, 59, 999));

    const count = await client.returnTransaction.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    const sequence = String(count + 1).padStart(3, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * Generate structured 80mm thermal receipt content & plain text
   */
  static generateReceiptContent(returnTx, printType = null, printedBy = null) {
    const printTime = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    let footerText = `Printed : ${printTime}`;
    if (printedBy) footerText += ` by ${printedBy}`;
    const centeredFooter = footerText.padStart(Math.floor((40 + footerText.length) / 2)).padEnd(40);

    const txDate = returnTx.createdAt ? new Date(returnTx.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : printTime;

    let receiptText =
      `         SURAT PENARIKAN BARANG         \n` +
      `             NO. ${printType === 'GOOD' ? 'G' : printType === 'BAD' ? 'B' : ''}${returnTx.returnNumber || '-'}\n` +
      `========================================\n` +
      `Tgl    : ${txDate}\n` +
      `Tipe   : ${returnTx.returnType || 'TUNAI'}\n` +
      `Status : ${returnTx.status || 'DRAFT'}\n` +
      `Nama   : ${returnTx.contactName || '-'}\n\n` +
      `Inv    : ${returnTx.invoiceNumber || '-'}\n` +
      `Sales  : ${returnTx.salespersonCode || '-'} - ${returnTx.salespersonName || '-'}\n` +
      `Divisi : ${returnTx.divisi || '-'}\n` +
      `Cust   : ${returnTx.customerCode || '-'} - ${returnTx.customerName || '-'}\n`;

    if (returnTx.distanceDiff !== null && returnTx.distanceDiff !== undefined) {
      receiptText += `Selisih Jarak : ${Math.round(returnTx.distanceDiff)}m\n`;
    }

    let receiptItems = (returnTx.items || []).filter(it => !it.deletedAt);
    if (printType === 'GOOD') {
      receiptItems = receiptItems.filter(it => (it.qtyGood > 0) || (it.qtyGood === null && it.qty > 0 && !it.qtyBad));
    } else if (printType === 'BAD') {
      receiptItems = receiptItems.filter(it => (it.qtyBad > 0));
    }

    const groups = {};
    if (receiptItems.length > 0) {
      const typeHeader = printType === 'GOOD' ? ' (GOOD STOCK)' : (printType === 'BAD' ? ' (BAD STOCK / BS)' : '');
      receiptText += `\nDetail Barang${typeHeader}:\n`;
      receiptText += `----------------------------------------\n`;
      receiptItems.forEach(it => {
        if (!groups[it.productCode]) {
          groups[it.productCode] = {
            productCode: it.productCode,
            productName: it.productName,
            uoms: []
          };
        }
        let printQty = it.qty;
        if (printType === 'GOOD') printQty = (it.qtyGood !== null && it.qtyGood !== undefined) ? it.qtyGood : it.qty;
        else if (printType === 'BAD') printQty = (it.qtyBad !== null && it.qtyBad !== undefined) ? it.qtyBad : it.qty;

        groups[it.productCode].uoms.push({
          qty: printQty,
          qtyGood: it.qtyGood,
          qtyBad: it.qtyBad,
          uom: it.uom
        });
      });
      const grouped = Object.values(groups);
      grouped.forEach((g, i) => {
        const no = String(i + 1).padEnd(2);
        const kode = String(g.productCode || '-').trim();
        const fullNama = (g.productName || '-');

        const indentLength = no.length + 1;
        const indentStr = ' '.repeat(indentLength);
        const maxFirstLine = 40 - (indentLength + kode.length + 2);
        const maxNextLine = 40 - indentLength;

        const words = fullNama.split(' ');
        let currentLine = '';
        let lines = [];

        words.forEach(word => {
          const maxLen = lines.length === 0 ? maxFirstLine : maxNextLine;
          if ((currentLine + (currentLine ? ' ' : '') + word).length <= maxLen) {
            currentLine += (currentLine === '' ? '' : ' ') + word;
          } else {
            if (currentLine !== '') {
              lines.push(currentLine);
            }
            let w = word;
            while (w.length > (lines.length === 0 ? maxFirstLine : maxNextLine)) {
              let mLen = lines.length === 0 ? maxFirstLine : maxNextLine;
              lines.push(w.substring(0, mLen));
              w = w.substring(mLen);
            }
            currentLine = w;
          }
        });
        if (currentLine !== '') {
          lines.push(currentLine);
        }
        if (lines.length === 0) lines = ['-'];

        receiptText += `${no} ${kode}  ${lines[0]}\n`;
        for (let j = 1; j < lines.length; j++) {
          receiptText += `${indentStr}${lines[j]}\n`;
        }

        const uomsStr = g.uoms.map(u => {
          if (printType === 'GOOD') return `${u.qty} ${u.uom} [G]`;
          if (printType === 'BAD') return `${u.qty} ${u.uom} [B]`;
          const parts = [];
          if (u.qtyGood > 0) parts.push(`G:${u.qtyGood}`);
          if (u.qtyBad > 0) parts.push(`B:${u.qtyBad}`);
          const detail = parts.length > 0 ? ` (${parts.join('/')})` : '';
          return `${u.qty} ${u.uom}${detail}`;
        }).join(' ');
        receiptText += `${indentStr}Qty : ${uomsStr}\n\n`;
      });
      receiptText += `----------------------------------------\n`;
      receiptText += `Total : ${grouped.length} SKU\n`;
    }

    receiptText += `\n` +
      `Yang Menyerahkan,         Yang Menerima,\n\n\n\n` +
      `(                 )  (                 )\n\n` +
      `${centeredFooter}\n`;

    return {
      plainText: receiptText,
      rawEscPos: '\x1b\x40' + receiptText + '\n\n\n\n',
      groupedItems: Object.values(groups),
      totalSku: Object.keys(groups).length
    };
  }

  /**
   * Generate 80mm plain-text receipt (header struk) and queue for printing
   */
  static async printReceipt(returnTx, printerNameOverride = null, printedBy = null, printType = null) {
    try {
      const setting = await prisma.appSetting.findUnique({ where: { key: 'PRINTER_NAME' } });
      const printerName = printerNameOverride || (setting ? setting.value : null);

      if (!printerName) {
        console.error('[ReturnService] PRINTER_NAME is not set.');
        return { success: false, message: 'Nama Printer belum dikonfigurasi.' };
      }

      // Load items if not already included
      if (!returnTx.items) {
        returnTx = await prisma.returnTransaction.findUnique({
          where: { id: returnTx.id },
          include: { items: true }
        });
      }

      const fileName = `receipt_${returnTx.id}.txt`;
      const tempPath = path.join(__dirname, '..', 'uploads', fileName);

      const content = ReturnService.generateReceiptContent(returnTx, printType, printedBy);
      fs.writeFileSync(tempPath, content.rawEscPos, 'utf8');

      try {
        await prisma.printJob.create({
          data: {
            copies: 1,
            file_url: `/uploads/${fileName}`,
            printer_name: printerName,
            status: 'PENDING'
          }
        });
      } catch (dbErr) {
        throw new Error('Gagal menyimpan antrean cetak: ' + dbErr.message);
      }

      const updatedTx = await prisma.returnTransaction.update({
        where: { id: returnTx.id },
        data: { isPrinted: true, isSynced: false }
      });

      // Struk detail sudah digabung dengan header di atas.
      
      // Trigger sync in background
      ReturnService.syncToServer(updatedTx).catch(err => console.error('[ReturnService] sync error after print:', err));

      return { success: true, message: 'Struk berhasil dikirim ke printer.' };

    } catch (error) {
      console.error('[ReturnService] Print error:', error);
      return { success: false, message: `Gagal mencetak: ${error.message}` };
    }
  }

  /**
   * Generate struk detail berisi daftar barang retur (untuk Mini App submissions).
   * Dicetak sebagai lembar terpisah setelah struk header.
   */
  static async printDetailReceipt(returnTx, printerName = null, printedBy = null) {
    try {
      if (!printerName) {
        const setting = await prisma.appSetting.findUnique({ where: { key: 'PRINTER_NAME' } });
        printerName = setting ? setting.value : null;
      }
      if (!printerName) return { success: false, message: 'Printer tidak dikonfigurasi.' };

      // Load items if needed
      if (!returnTx.items) {
        returnTx = await prisma.returnTransaction.findUnique({
          where: { id: returnTx.id },
          include: { items: true }
        });
      }

      const items = (returnTx.items || []).filter(it => !it.deletedAt);
      if (items.length === 0) {
        return { success: false, message: 'Tidak ada detail barang untuk dicetak.' };
      }

      const fileName = `receipt_detail_${returnTx.id}.txt`;
      const tempPath = path.join(__dirname, '..', 'uploads', fileName);

      const printTime = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

      let txt = '\x1b\x40' +
        `         DETAIL BARANG RETUR          
             NO. ${returnTx.returnNumber || '-'}
========================================
Status : ${returnTx.status || 'DRAFT'}
Cust : ${returnTx.customerCode} - ${(returnTx.customerName || '').substring(0,20)}
Inv  : ${returnTx.invoiceNumber || '-'}
----------------------------------------
`;

      let grandTotal = 0;
      items.forEach((item, i) => {
        const no    = String(i + 1).padEnd(3);
        const kode  = (item.productCode || '-').padEnd(10).substring(0, 10);
        const nama  = (item.productName || '-').substring(0, 24);
        const qty   = String(item.qty || 0);
        const uom   = (item.uom || '').padEnd(5).substring(0, 5);
        const alasan = (item.alasan || '-').substring(0, 38);
        const price = item.price ? Math.round(item.price) : 0;
        const subtotal = item.totalPrice ? Math.round(item.totalPrice) : (price * (item.qty || 0));
        grandTotal += subtotal;

        txt += `${no} ${kode} ${nama}\n`;
        txt += `   Qty: ${qty} ${uom}`;
        if (price > 0) {
          txt += ` @ Rp ${price.toLocaleString('id-ID')} = Rp ${subtotal.toLocaleString('id-ID')}`;
        }
        txt += `\n   Alasan: ${alasan}\n`;
        if (i < items.length - 1) txt += `........................................\n`;
      });

      txt += `========================================\nTotal : ${items.length} jenis barang\n`;
      if (grandTotal > 0) {
        txt += `Total Nominal : Rp ${Math.round(grandTotal).toLocaleString('id-ID')}\n`;
      }
      txt += `Dicetak: ${printTime}`;
      if (printedBy) txt += ` oleh ${printedBy}`;
      txt += `\n\n\n\n\n`;

      fs.writeFileSync(tempPath, txt, 'utf8');

      await prisma.printJob.create({
        data: {
          copies: 1,
          file_url: `/uploads/${fileName}`,
          printer_name: printerName,
          status: 'PENDING'
        }
      });

      const updatedTx = await prisma.returnTransaction.update({
        where: { id: returnTx.id },
        data: { isDetailPrinted: true, isSynced: false }
      });

      // Trigger sync in background
      ReturnService.syncToServer(updatedTx).catch(err => console.error('[ReturnService] sync error after print detail:', err));

      return { success: true, message: 'Struk detail berhasil dikirim ke printer.' };
    } catch (error) {
      console.error('[ReturnService] printDetailReceipt error:', error);
      return { success: false, message: `Gagal cetak detail: ${error.message}` };
    }
  }
  /**
   * Send notification to departments with item details (for Mini App submissions).
   */
  static async notifyDepartmentsWithItems(sessionId, returnTx) {
    try {
      const { getTelegramBot } = require('../telegram');
      const keys = ['NOTIF_GUDANG_TG_ID', 'NOTIF_KASIR_TG_ID', 'NOTIF_EDP_TG_ID'];
      const settings = await prisma.appSetting.findMany({
        where: { key: { in: keys } }
      });

      const targets = {};
      settings.forEach(s => { targets[s.key] = s.value; });

      const bot = getTelegramBot(sessionId) || getTelegramBot('telegram-main');
      if (!bot) return;

      const items = returnTx.items || [];
      let itemsText = '';
      if (items.length > 0) {
        itemsText = `\n📦 *Detail Barang:*\n` + ReturnService._formatGroupedItemsText(items, false);
      }

      let driverInfoText = '';
      if (returnTx.status === 'DRIVER_PROCESSED' || returnTx.driverLocationAddress || returnTx.driverPhotoUrl) {
        driverInfoText = `\n🚚 *PENARIKAN DRIVER:*\n` +
          `📍 *Lokasi Driver:* ${returnTx.driverLocationAddress || (returnTx.driverLatitude ? `${returnTx.driverLatitude}, ${returnTx.driverLongitude}` : '-')}\n` +
          (returnTx.driverDistanceDiff !== null && returnTx.driverDistanceDiff !== undefined ? `📏 *Selisih Jarak Driver:* ${Math.round(returnTx.driverDistanceDiff)} meter\n` : '');
      }

      const message =
        `🔔 *INFO RETUR (Mini App)*\n\n` +
        `👤 *Pembuat:* ${returnTx.contactName || '-'}\n` +
        `🧾 *Invoice:* ${returnTx.invoiceNumber || '-'}\n` +
        `💼 *Salesperson:* ${returnTx.salespersonCode || '-'} - ${returnTx.salespersonName || '-'}\n` +
        `🏪 *Customer:* ${returnTx.customerCode} - ${returnTx.customerName}\n` +
        `🏷 *Tipe Retur:* ${returnTx.returnType}\n` +
        `📍 *Lokasi Sales:* ${returnTx.locationAddress || 'Koordinat GPS'}\n` +
        (returnTx.distanceDiff !== null ? `📏 *Selisih Jarak Sales:* ${Math.round(returnTx.distanceDiff)} meter\n` : '') +
        driverInfoText +
        `🕒 *Waktu:* ${returnTx.createdAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB` +
        itemsText;

      const chatIdsToNotify = new Set();
      if (targets['NOTIF_GUDANG_TG_ID']) chatIdsToNotify.add(targets['NOTIF_GUDANG_TG_ID']);
      if (targets['NOTIF_EDP_TG_ID'])   chatIdsToNotify.add(targets['NOTIF_EDP_TG_ID']);
      if (returnTx.returnType === 'TUNAI' && targets['NOTIF_KASIR_TG_ID']) {
        chatIdsToNotify.add(targets['NOTIF_KASIR_TG_ID']);
      }

      const photoToSend = (returnTx.status === 'DRIVER_PROCESSED' && returnTx.driverPhotoUrl)
        ? returnTx.driverPhotoUrl
        : returnTx.photoUrl;

      for (const chatId of chatIdsToNotify) {
        if (photoToSend) {
          const fullPath = path.join(__dirname, '..', photoToSend);
          if (fs.existsSync(fullPath)) {
            await bot.sendPhoto(chatId, fullPath, { caption: message, parse_mode: 'Markdown' });
            continue;
          }
        }
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      console.error('[ReturnService] notifyDepartmentsWithItems error:', error);
    }
  }

  /**
   * Send confirmation message to the Telegram user who submitted via Mini App.
   */
  static async sendUserConfirmation(sessionId, telegramUserId, returnTx) {
    try {
      const { getTelegramBot } = require('../telegram');
      const bot = getTelegramBot(sessionId) || getTelegramBot('telegram-main');
      if (!bot || !telegramUserId) return;

      const items = returnTx.items || [];
      let itemsText = items.length > 0
        ? `\n\n📦 *Detail Barang:*\n` + ReturnService._formatGroupedItemsText(items, true)
        : '';

      const msg =
        `✅ *Retur berhasil disimpan via Mini App*\n\n` +
        `📋 *No Retur:* ${returnTx.returnNumber}\n` +
        `🏪 *Customer:* ${returnTx.customerCode} - ${returnTx.customerName}\n` +
        `🧾 *Invoice:* ${returnTx.invoiceNumber || '-'}\n` +
        `💼 *Salesperson:* ${returnTx.salespersonCode || '-'} - ${returnTx.salespersonName || '-'}\n` +
        `🏷 *Tipe:* ${returnTx.returnType}` +
        itemsText +
        `\n\nGunakan /cetak untuk mencetak struk.`;

      await bot.sendMessage(telegramUserId, msg, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('[ReturnService] sendUserConfirmation error:', error);
    }
  }

  /**
   * Sync a return transaction to the central server (ORDS)
   * @param {Object} returnTx - ReturnTransaction object or { id }
   * @param {Object} [options] - { force: boolean }
   */
  static async syncToServer(returnTx, options = {}) {
    const force = options.force || false;
    if (!returnTx || !returnTx.id) return { success: false, message: 'Invalid transaction ID' };
    if (returnTx.isSynced && !force) return { success: true, message: 'Already synced' };

    try {
      // Ensure we have the latest and complete transaction record
      let tx = returnTx;
      if (!tx.returnNumber || tx.driverLatitude === undefined || tx.driverPhotoUrl === undefined || !tx.createdAt) {
        const full = await prisma.returnTransaction.findUnique({
          where: { id: returnTx.id }
        });
        if (full) tx = full;
      }

      // Load all items (including soft-deleted) for this transaction
      const items = await prisma.returnItem.findMany({
        where: { returnTransactionId: tx.id }
      });

      // Load all histories for this transaction
      const histories = await prisma.returnHistory.findMany({
        where: { returnTransactionId: tx.id },
        orderBy: { createdAt: 'asc' }
      });

      const baseUrl = process.env.BASE_URL || 'https://auditwa.padmasaripangan.co.id';
      let fullPhotoUrl = tx.photoUrl || null;
      if (fullPhotoUrl && !fullPhotoUrl.startsWith('http')) {
        fullPhotoUrl = `${baseUrl}${fullPhotoUrl.startsWith('/') ? '' : '/'}${fullPhotoUrl}`;
      }

      let fullDriverPhotoUrl = tx.driverPhotoUrl || null;
      if (fullDriverPhotoUrl && !fullDriverPhotoUrl.startsWith('http')) {
        fullDriverPhotoUrl = `${baseUrl}${fullDriverPhotoUrl.startsWith('/') ? '' : '/'}${fullDriverPhotoUrl}`;
      }

      const formatDate = (date) => {
        if (!date) return null;
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return null;
        const pad = (n) => n < 10 ? '0' + n : n;
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };

      const payload = {
        id:                      tx.id,
        return_number:           tx.returnNumber ? String(tx.returnNumber).substring(0, 20) : null,
        telegram_user_id:        tx.telegramUserId ? String(tx.telegramUserId).substring(0, 20) : null,
        contact_name:            tx.contactName ? String(tx.contactName).substring(0, 60) : null,
        customer_code:           tx.customerCode ? String(tx.customerCode).substring(0, 15) : null,
        customer_name:           tx.customerName ? String(tx.customerName).substring(0, 100) : null,
        salesperson_code:        tx.salespersonCode ? String(tx.salespersonCode).substring(0, 15) : null,
        salesperson_name:        tx.salespersonName ? String(tx.salespersonName).substring(0, 100) : null,
        invoice_number:          tx.invoiceNumber ? String(tx.invoiceNumber).substring(0, 30) : null,
        origin_latitude:         tx.originLatitude !== null && tx.originLatitude !== undefined ? Number(tx.originLatitude) : null,
        origin_longitude:        tx.originLongitude !== null && tx.originLongitude !== undefined ? Number(tx.originLongitude) : null,
        latitude:                tx.latitude !== null && tx.latitude !== undefined ? Number(tx.latitude) : null,
        longitude:               tx.longitude !== null && tx.longitude !== undefined ? Number(tx.longitude) : null,
        distance_diff:           tx.distanceDiff !== null && tx.distanceDiff !== undefined ? Number(tx.distanceDiff) : null,
        location_address:        tx.locationAddress ? String(tx.locationAddress).substring(0, 500) : null,
        return_type:             tx.returnType ? String(tx.returnType).substring(0, 15) : null,
        is_customer_valid:       tx.isCustomerValid ? 'true' : 'false',
        is_printed:              tx.isPrinted ? 'true' : 'false',
        is_synced:               'true',
        is_detail_printed:       tx.isDetailPrinted ? 'true' : 'false',
        photo_url:               fullPhotoUrl ? String(fullPhotoUrl).substring(0, 500) : null,
        divisi:                  tx.divisi ? String(tx.divisi).substring(0, 20) : null,
        source:                  tx.source ? String(tx.source).substring(0, 50) : 'MINI_APP',
        status:                  tx.status ? String(tx.status).substring(0, 50) : 'DRAFT',
        driver_distance_diff:    tx.driverDistanceDiff !== null && tx.driverDistanceDiff !== undefined ? Number(tx.driverDistanceDiff) : null,
        driver_latitude:         tx.driverLatitude !== null && tx.driverLatitude !== undefined ? Number(tx.driverLatitude) : null,
        driver_location_address: tx.driverLocationAddress ? String(tx.driverLocationAddress).substring(0, 500) : null,
        driver_longitude:        tx.driverLongitude !== null && tx.driverLongitude !== undefined ? Number(tx.driverLongitude) : null,
        driver_photo_url:        fullDriverPhotoUrl ? String(fullDriverPhotoUrl).substring(0, 500) : null,
        created_at:              formatDate(tx.createdAt),
        updated_at:              formatDate(tx.updatedAt),
        deleted_at:              formatDate(tx.deletedAt),
      };

      const auth = {
        username: process.env.APEX_API_USERNAME || 'gs',
        password: process.env.APEX_API_PASSWORD || 'Padma23#@!'
      };

      // Coba sync ke APEX — jika gagal (timeout/network), tetap tandai lokal
      let apexSynced = false;
      try {
        const ordsUrl = `${process.env.APEX_API_URL || 'http://222.165.244.5/ords/padma/webapi'}/syn_return_transactions`;
        await axios.post(ordsUrl, payload, {
          headers: { 'Content-Type': 'application/json' },
          auth,
          timeout: 10000
        });

        // 1. Sync items satu per satu ke sync_return_items
        if (items && items.length > 0) {
          for (const it of items) {
            const itemPayload = {
              id:                    it.id,
              return_transaction_id: it.returnTransactionId || tx.id,
              product_code:          it.productCode ? String(it.productCode).substring(0, 20) : null,
              product_name:          it.productName ? String(it.productName).substring(0, 100) : null,
              qty:                   it.qty !== null && it.qty !== undefined ? Number(it.qty) : null,
              uom:                   it.uom ? String(it.uom).substring(0, 10) : null,
              konversi:              it.konversi !== null && it.konversi !== undefined ? Number(it.konversi) : null,
              alasan:                it.alasan ? String(it.alasan).substring(0, 500) : null,
              created_by_group:      it.createdByGroup ? String(it.createdByGroup).substring(0, 500) : null,
              original_qty:          it.originalQty !== null && it.originalQty !== undefined ? Number(it.originalQty) : null,
              qty_bad:               it.qtyBad !== null && it.qtyBad !== undefined ? Number(it.qtyBad) : null,
              qty_good:              it.qtyGood !== null && it.qtyGood !== undefined ? Number(it.qtyGood) : null,
              price:                 it.price !== null && it.price !== undefined ? Number(it.price) : null,
              total_price:           it.totalPrice !== null && it.totalPrice !== undefined ? Number(it.totalPrice) : (it.price !== null && it.qty !== null ? Number(it.price) * Number(it.qty) : null),
              created_at:            formatDate(it.createdAt) || formatDate(tx.createdAt),
              deleted_at:            formatDate(it.deletedAt)
            };
            try {
              await axios.post(
                `${process.env.APEX_API_URL || 'http://222.165.244.5/ords/padma/webapi'}/sync_return_items`,
                itemPayload,
                { headers: { 'Content-Type': 'application/json' }, auth, timeout: 10000 }
              );
            } catch (itemErr) {
              console.warn(`[ReturnService] sync_return_items failed for item ${it.id}: ${itemErr.message}`);
            }
          }
        }

        // 2. Sync histories satu per satu ke sync_return_history
        if (histories && histories.length > 0) {
          for (const h of histories) {
            let safeChanges = h.changes;
            if (!safeChanges || typeof safeChanges !== 'object') {
              safeChanges = {};
            }
            const histPayload = {
              id:                    h.id,
              return_transaction_id: h.returnTransactionId || tx.id,
              action:                h.action ? String(h.action).substring(0, 100) : null,
              actor_role:            h.actorRole ? String(h.actorRole).substring(0, 100) : null,
              actor_name:            h.actorName ? String(h.actorName).substring(0, 150) : null,
              actor_id:              h.actorId ? String(h.actorId).substring(0, 50) : null,
              changes:               safeChanges,
              created_at:            formatDate(h.createdAt) || formatDate(tx.createdAt)
            };
            try {
              await axios.post(
                `${process.env.APEX_API_URL || 'http://222.165.244.5/ords/padma/webapi'}/sync_return_history`,
                histPayload,
                { headers: { 'Content-Type': 'application/json' }, auth, timeout: 10000 }
              );
            } catch (histErr) {
              console.warn(`[ReturnService] sync_return_history failed for history ${h.id}: ${histErr.message}`);
            }
          }
        }

        apexSynced = true;
      } catch (apexErr) {
        console.warn(`[ReturnService] APEX sync failed for ${tx.id}: ${apexErr.message}. Will retry later.`);
      }

      // Mark as synced di local DB
      await prisma.returnTransaction.update({
        where: { id: tx.id },
        data: { isSynced: apexSynced }
      });

      console.log(`[ReturnService] syncToServer ${tx.id}: ${apexSynced ? 'APEX OK' : 'local only'} (${items.length} items, ${histories.length} histories).`);
      return { success: true, apexSynced, message: apexSynced ? 'Synced to APEX' : 'Saved locally (APEX pending)' };
    } catch (error) {
      console.error(`[ReturnService] Sync error for ID ${returnTx.id}:`, error.message);
      return { success: false, message: error.message };
    }
  }

  static async approveReturn(returnId, actorData) {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.returnTransaction.update({
        where: { id: returnId },
        data: { status: 'SPV_APPROVED' }
      });
      await tx.returnHistory.create({
        data: {
          returnTransactionId: returnId,
          action: 'SPV_APPROVED',
          actorRole: actorData.role || 'Supervisor Sales',
          actorName: actorData.name,
          actorId: actorData.id
        }
      });
      return updated;
    });
  }

  static async rejectReturn(returnId, actorData) {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.returnTransaction.update({
        where: { id: returnId },
        data: { status: 'SPV_REJECTED' }
      });
      await tx.returnHistory.create({
        data: {
          returnTransactionId: returnId,
          action: 'SPV_REJECTED',
          actorRole: actorData.role || 'Supervisor Sales',
          actorName: actorData.name,
          actorId: actorData.id
        }
      });
      return updated;
    });
  }

  /**
   * Sync all unsynced return transactions
   */
  static async syncAllUnsynced() {
    try {
      const unsynced = await prisma.returnTransaction.findMany({
        where: { isSynced: false }
      });

      let successCount = 0;
      let failCount = 0;

      for (const tx of unsynced) {
        const result = await this.syncToServer(tx, { force: true });
        if (result.success && result.apexSynced) {
          successCount++;
        } else {
          failCount++;
        }
      }

      console.log(`[ReturnService] Sync complete. Success: ${successCount}, Failed: ${failCount}`);
      return { success: true, successCount, failCount, total: unsynced.length };
    } catch (error) {
      console.error('[ReturnService] Sync all error:', error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = ReturnService;

