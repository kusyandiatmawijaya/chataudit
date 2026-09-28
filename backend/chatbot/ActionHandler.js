// backend/chatbot/ActionHandler.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { handleExtractedOrder, viewCartSummary, clearCart, checkoutOrder } = require('../services/order.service');

// Helper to remove (SOS) from customer name
function cleanCustomerName(name) {
  if (!name) return name;
  return name.replace(/\s*\(SOS\)/gi, '').trim();
}

async function executeSearchStores(keyword) {
  try {
    const results = await prisma.customer.findMany({
      where: {
        OR: [
          { kdcust: { contains: keyword, mode: 'insensitive' } },
          { nmcust: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      select: { kdcust: true, nmcust: true, nik: true, phone: true },
      take: 5,
    });
    if (results.length === 0) {
      return JSON.stringify({ found: false, message: `Tidak ditemukan toko dengan kata kunci "${keyword}".` });
    }
    return JSON.stringify({
      found: true,
      data: results.map(r => ({ kode_toko: r.kdcust, nama_toko: cleanCustomerName(r.nmcust), nik: r.nik, phone: r.phone })),
    });
  } catch (error) {
    console.error('[Chatbot] Error searching stores:', error);
    return JSON.stringify({ found: false, error: 'Gagal mencari toko di database.' });
  }
}

async function executeGetOutstandingAr(kodeToko) {
  try {
    const matchedCustomers = await prisma.customer.findMany({
      where: {
        OR: [
          { kdcust: kodeToko },
          { nmcust: { contains: kodeToko, mode: 'insensitive' } },
        ]
      },
      select: { kdcust: true }
    });
    const kdcusts = matchedCustomers.map(c => c.kdcust);
    kdcusts.push(kodeToko);

    const results = await prisma.outstandingAr.findMany({
      where: {
        OR: [
          { kdcust: { in: kdcusts } },
          { nmcust: { contains: kodeToko, mode: 'insensitive' } },
        ],
      },
      orderBy: { duedate: 'asc' },
    });

    if (results.length === 0) {
      return JSON.stringify({ found: false, message: `Tidak ditemukan data Outstanding AR untuk toko "${kodeToko}".` });
    }

    const totalAmount = results.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalPaid = results.reduce((sum, r) => sum + (r.paid || 0), 0);
    const totalBalance = results.reduce((sum, r) => sum + (r.balance || 0), 0);
    const customerName = cleanCustomerName(results[0].nmcust) || kodeToko;
    const customerCode = results[0].kdcust || kodeToko;
    const salesName = results[0].nmsls || '-';

    const invoices = results.map((r) => ({
      Nomor_Faktur: r.nopfi,
      Tanggal_Faktur: r.tglpfi ? r.tglpfi.toISOString().split('T')[0] : null,
      Total_Tagihan: r.amount,
      Sudah_Dibayar: r.paid,
      Sisa_Tagihan: r.balance,
      Tanggal_Jatuh_Tempo: r.duedate ? r.duedate.toISOString().split('T')[0] : null,
      ID_Term_Of_Payment: r.topid,
    }));

    return JSON.stringify({
      Data_Ditemukan: true, Kode_Customer: customerCode, Nama_Customer: customerName, Nama_Sales: salesName,
      Ringkasan_Piutang: { Total_Faktur: results.length, Total_Nominal_Tagihan: totalAmount, Total_Sudah_Dibayar: totalPaid, Total_Sisa_Saldo: totalBalance },
      Daftar_Faktur: invoices.slice(0, 15),
    });
  } catch (error) {
    console.error('[Chatbot] Error fetching Outstanding AR:', error);
    return JSON.stringify({ found: false, error: 'Gagal mengambil data dari database.' });
  }
}

async function executeGetOutstandingArBySalesman(keyword, limit = 10) {
  try {
    const take = limit && limit > 0 ? limit : 9999;
    const results = await prisma.outstandingAr.findMany({
      where: {
        OR: [
          { kdsls: keyword },
          { nmsls: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      take: 2000,
    });

    if (results.length === 0) {
      return JSON.stringify({ Data_Ditemukan: false, message: `Tidak ditemukan data Outstanding AR untuk salesman "${keyword}".` });
    }

    const grouped = {};
    let totalAmountAll = 0, totalPaidAll = 0, totalBalanceAll = 0;

    results.forEach(r => {
      const code = r.kdcust || 'UNKNOWN';
      if (!grouped[code]) {
        grouped[code] = { Nama_Toko: cleanCustomerName(r.nmcust), Kode_Toko: code, Total_Faktur: 0, Total_Tagihan_Toko: 0, Sisa_Tagihan_Toko: 0, Jatuh_Tempo_Terdekat: null, _earliestDate: Infinity };
      }
      grouped[code].Total_Faktur += 1;
      grouped[code].Total_Tagihan_Toko += (r.amount || 0);
      grouped[code].Sisa_Tagihan_Toko += (r.balance || 0);
      totalAmountAll += (r.amount || 0);
      totalPaidAll += (r.paid || 0);
      totalBalanceAll += (r.balance || 0);

      if (r.duedate) {
        const dt = new Date(r.duedate).getTime();
        if (dt < grouped[code]._earliestDate) {
          grouped[code]._earliestDate = dt;
          grouped[code].Jatuh_Tempo_Terdekat = r.duedate.toISOString().split('T')[0];
        }
      }
    });

    let storesArray = Object.values(grouped).sort((a, b) => b.Sisa_Tagihan_Toko - a.Sisa_Tagihan_Toko);
    storesArray.forEach(s => delete s._earliestDate);
    const limitedStores = storesArray.slice(0, take);
    const salesName = results[0].nmsls || keyword;

    return JSON.stringify({
      Data_Ditemukan: true, Nama_Sales: salesName, Total_Toko_Ditemukan: storesArray.length, Menampilkan_Jumlah_Toko: limitedStores.length,
      Ringkasan_Seluruh_Piutang_Salesman: { Total_Semua_Faktur: results.length, Total_Nominal_Tagihan: totalAmountAll, Total_Sudah_Dibayar: totalPaidAll, Total_Sisa_Saldo: totalBalanceAll },
      Daftar_Toko: limitedStores,
    });
  } catch (error) {
    console.error('[Chatbot] Error fetching Outstanding AR by Salesman:', error);
    return JSON.stringify({ Data_Ditemukan: false, error: 'Gagal mengambil data dari database.' });
  }
}

async function executeGetOutstandingArSummaryPerSalesman() {
  try {
    const summary = await prisma.outstandingAr.groupBy({
      by: ['nmsls', 'kdsls'],
      _sum: { amount: true, balance: true },
      _count: { nopfi: true },
      orderBy: { _sum: { balance: 'desc' } },
    });

    if (summary.length === 0) return JSON.stringify({ Data_Ditemukan: false, message: 'Tidak ada data Outstanding AR.' });

    const formattedSummary = summary.map((item) => ({
      Nama_Sales: item.nmsls || 'Tidak Diketahui', Kode_Sales: item.kdsls || 'N/A', Total_Faktur: item._count.nopfi, Total_Tagihan: item._sum.amount, Total_Sisa_Tagihan: item._sum.balance,
    }));
    return JSON.stringify({ Data_Ditemukan: true, Jumlah_Salesman: formattedSummary.length, Daftar_Rekap_Salesman: formattedSummary });
  } catch (error) {
    console.error('[Chatbot] Error fetching AR Summary per Salesman:', error);
    return JSON.stringify({ Data_Ditemukan: false, error: 'Gagal mengambil data agregasi dari database.' });
  }
}

async function executeGetCreditLimitAnalysis(kodeToko) {
  try {
    const matchedCustomers = await prisma.customer.findMany({
      where: { OR: [{ kdcust: kodeToko }, { nmcust: { contains: kodeToko, mode: 'insensitive' } }] },
      select: { kdcust: true }
    });
    const kdcusts = matchedCustomers.map(c => c.kdcust);
    kdcusts.push(kodeToko);

    const results = await prisma.analisaCreditLimit.findMany({
      where: { OR: [{ kdcust: { in: kdcusts } }, { nmcust: { contains: kodeToko, mode: 'insensitive' } }] },
    });

    if (results.length === 0) return JSON.stringify({ found: false, message: `Tidak ditemukan data Analisa Credit Limit untuk toko "${kodeToko}".` });

    const data = results.map((r) => ({
      Kode_Customer: r.kdcust, Nama_Customer: cleanCustomerName(r.nmcust), Kode_Sales: r.kdsls, Nama_Sales: r.nmsls,
      Credit_Limit_Saat_Ini: r.old_cl, Credit_Limit_Usulan: r.newcl, Rata_Rata_Transaksi: r.avgtrx, Outstanding_Invoice: r.oi,
      Kebiasaan_Bayar_Ontime: r.pola_ontime, Kebiasaan_Bayar_Cicil: r.pola_cicil, Kategori_Overdue: r.kategori_ovd, Kriteria_Yang_Diterapkan: r.kriteria_applied,
      Status_Toko: r.status_toko, Channel_Penjualan: r.channel, Total_Overdue_Ontime: r.ovdontime, Total_Overdue_3_Sampai_10_Hari: r.ovd3n10,
      Total_Overdue_11_Sampai_18_Hari: r.ovd11n18, Total_Overdue_19_Sampai_30_Hari: r.ovd19n30, Total_Overdue_Lebih_Dari_30_Hari: r.ovdmt30,
      Belum_Bayar: r.blmbayar, Bad_Debt: r.baddebt, Term_Of_Payment_Lama: r.old_top, Term_Of_Payment_Baru: r.new_top,
      Tanggal_Transaksi_Terakhir: r.lasttrx ? r.lasttrx.toISOString().split('T')[0] : null, Pola_Pembayaran: r.pola, Status: r.status, Tipe_Outlet: r.outlet_type,
    }));
    return JSON.stringify({ Data_Ditemukan: true, Total_Hasil: data.length, Daftar_Analisa: data });
  } catch (error) {
    console.error('[Chatbot] Error fetching Credit Limit Analysis:', error);
    return JSON.stringify({ found: false, error: 'Gagal mengambil data dari database.' });
  }
}

async function executeGetInvoiceDetail(nomorFaktur) {
  try {
    const result = await prisma.outstandingAr.findFirst({ where: { nopfi: { contains: nomorFaktur, mode: 'insensitive' } } });
    if (!result) return JSON.stringify({ found: false, message: `Faktur ${nomorFaktur} tidak ditemukan.` });
    return JSON.stringify({ found: true, Nomor_Faktur: result.nopfi, Kode_Customer: result.kdcust, Nama_Customer: result.nmcust, Total_Tagihan: result.amount, Sudah_Dibayar: result.paid, Sisa_Tagihan: result.balance, Jatuh_Tempo: result.duedate ? result.duedate.toISOString().split('T')[0] : null, Salesman: result.nmsls });
  } catch (error) {
    return JSON.stringify({ error: 'Gagal mengambil data faktur.' });
  }
}

async function executeGetStoreProfile(kodeToko) {
  try {
    const result = await prisma.customer.findFirst({ where: { OR: [{ kdcust: kodeToko }, { nmcust: { contains: kodeToko, mode: 'insensitive' } }] } });
    if (!result) return JSON.stringify({ found: false, message: `Toko ${kodeToko} tidak ditemukan.` });
    return JSON.stringify({ found: true, Kode_Toko: result.kdcust, Nama_Toko: cleanCustomerName(result.nmcust), Alamat: result.alamat, Telepon: result.phone || result.kontak, NPWP: result.npwp, Latitude: result.latitude, Longitude: result.longitude, Link_Maps: (result.latitude && result.longitude) ? `https://www.google.com/maps?q=${result.latitude},${result.longitude}` : 'Tidak ada koordinat' });
  } catch (error) {
    return JSON.stringify({ error: 'Gagal mengambil data profil toko.' });
  }
}

async function executeCheckPaymentReceipts(nominal, keyword) {
  try {
    let whereClause = {};
    if (nominal) whereClause.nominalTransfer = nominal;
    if (keyword) {
      whereClause.OR = [{ bankSumber: { contains: keyword, mode: 'insensitive' } }, { beritaPesan: { contains: keyword, mode: 'insensitive' } }];
    }
    const results = await prisma.paymentExtraction.findMany({ where: whereClause, take: 5, orderBy: { createdAt: 'desc' } });
    if (results.length === 0) return JSON.stringify({ found: false, message: 'Data pembayaran tidak ditemukan.' });
    return JSON.stringify({ found: true, Data: results.map(r => ({ Tanggal: r.tanggalTransfer, Bank: r.bankSumber, Rekening_Tujuan: r.rekeningTujuan, Nominal: r.nominalTransfer, Berita: r.beritaPesan })) });
  } catch (error) {
    return JSON.stringify({ error: 'Gagal mengambil mutasi pembayaran.' });
  }
}

async function executeGetBadDebtStores(keyword) {
  try {
    let whereClause = { OR: [{ baddebt: { gt: 0 } }, { ovdmt30: { gt: 0 } }] };
    if (keyword) {
      whereClause.AND = [{ OR: [{ kdsls: keyword }, { nmsls: { contains: keyword, mode: 'insensitive' } }] }];
    }
    const results = await prisma.analisaCreditLimit.findMany({ where: whereClause, orderBy: { baddebt: 'desc' }, take: 10 });
    if (results.length === 0) return JSON.stringify({ found: false, message: 'Tidak ditemukan toko bad debt.' });
    return JSON.stringify({ found: true, Data: results.map(r => ({ Kode_Toko: r.kdcust, Nama_Toko: cleanCustomerName(r.nmcust), Sales: r.nmsls, Overdue_Lebih_30_Hari: r.ovdmt30, Bad_Debt: r.baddebt, Status: r.status_toko })) });
  } catch (error) {
    return JSON.stringify({ error: 'Gagal mengambil data toko bermasalah.' });
  }
}

async function executeGetSalesPerformance(keyword) {
  try {
    let whereClause = {};
    if (keyword) {
      whereClause = { OR: [{ contactName: { contains: keyword, mode: 'insensitive' } }, { contactNumber: { contains: keyword, mode: 'insensitive' } }] };
    }
    const result = await prisma.reportCard.findFirst({ where: whereClause, orderBy: { generatedAt: 'desc' } });
    if (!result) return JSON.stringify({ found: false, message: 'Rapor performa tidak ditemukan.' });
    return JSON.stringify({ found: true, Nama_Sales: result.contactName || result.contactNumber, Nilai_Huruf: result.overallGrade, Skor: result.overallScore, Ringkasan: result.summary, Peringatan: result.redFlags, Total_Pesan: result.totalMessages, Tipe_Rapor: result.type, Tanggal_Generate: result.generatedAt });
  } catch (error) {
    return JSON.stringify({ error: 'Gagal mengambil rapor performa.' });
  }
}



async function executeSearchProductPrice(keyword) {
  try {
    // Basic Synonym Dictionary for common abbreviations
    const synonyms = {
      'botol': 'btl',
      'kardus': 'ctn',
      'karton': 'ctn',
      'pak': 'pck',
      'bks': 'bungkus',
      'coklat': 'cklt',
      'stroberi': 'strawberry'
    };

    let processedKeyword = keyword ? keyword.trim().toLowerCase() : '';
    // Replace synonyms
    Object.keys(synonyms).forEach(key => {
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      processedKeyword = processedKeyword.replace(regex, synonyms[key]);
    });

    const tokens = processedKeyword.split(/\s+/).filter(t => t.length > 2);
    let whereClause = {};
    
    if (tokens.length > 0) {
      whereClause = {
        OR: tokens.map(token => ({
          OR: [
            { nmbrg: { contains: token, mode: 'insensitive' } },
            { brand: { contains: token, mode: 'insensitive' } },
            { nmkat: { contains: token, mode: 'insensitive' } },
            { nmsubkat: { contains: token, mode: 'insensitive' } },
            { tags: { contains: token, mode: 'insensitive' } }
          ]
        }))
      };
    } else if (keyword) {
       whereClause = {
         OR: [
           { nmbrg: { contains: keyword, mode: 'insensitive' } },
           { tags: { contains: keyword, mode: 'insensitive' } }
         ]
       };
    }

    let results = await prisma.daftarHargaBarang.findMany({
      where: whereClause,
      take: 200 // Fetch up to 200 to score them in memory
    });

    // Score and sort results based on how many tokens match their fields
    if (tokens.length > 1) {
      results.forEach(r => {
        let score = 0;
        const textToSearch = `${r.nmbrg || ''} ${r.brand || ''} ${r.nmkat || ''} ${r.nmsubkat || ''} ${r.tags || ''}`.toLowerCase();
        tokens.forEach(token => {
          if (textToSearch.includes(token.toLowerCase())) score++;
        });
        r._score = score;
      });
      // Sort by score descending
      results.sort((a, b) => b._score - a._score);
    }
    
    // Take top 30
    results = results.slice(0, 30);

    // Also search knowledge base with tokenization
    let pkWhereClause = {};
    if (tokens.length > 0) {
      pkWhereClause = {
        OR: tokens.map(token => ({
          OR: [
            { title: { contains: token, mode: 'insensitive' } },
            { content: { contains: token, mode: 'insensitive' } }
          ]
        }))
      };
    }
    const pkResults = await prisma.productKnowledge.findMany({
      where: pkWhereClause,
      select: { title: true, content: true, mediaUrl: true },
      take: 3
    });

    if (results.length === 0 && pkResults.length === 0) {
      return JSON.stringify({ found: false, message: `Tidak ditemukan produk/barang dengan kata kunci "${keyword}" di Daftar Harga maupun Knowledge Base.` });
    }

    const data = results.map(r => ({
      Kode_Barang: r.kdbrg,
      Nama_Barang: r.nmbrg,
      Brand: r.brand,
      UOM1_Terbesar: r.uom1,
      Isi_Per_UOM1: r.kpc1,
      Harga_UOM1: r.harga1,
      UOM2_Menengah: r.uom2,
      Isi_Per_UOM2: r.kpc2,
      Harga_UOM2: r.harga2,
      UOM3_Terkecil: r.uom3,
      Isi_Per_UOM3: r.kpc3,
      Harga_UOM3: r.harga3 || r.harga4
    }));

    return JSON.stringify({ 
      found: true, 
      Sumber_Data: 'Daftar Harga & Knowledge Base',
      Total_Ditemukan_Daftar_Harga: results.length, 
      Daftar_Harga_Barang: data,
      Total_Ditemukan_Knowledge_Base: pkResults.length,
      Info_Produk_Knowledge: pkResults
    });
  } catch (error) {
    console.error('[ActionHandler] executeSearchProductPrice error:', error);
    return JSON.stringify({ error: 'Gagal mencari harga produk.' });
  }
}

async function executeSearchPromo(keyword) {
  try {
    const today = new Date();
    // Search promos in DB
    const promos = await prisma.promo.findMany({
      where: {
        isActive: true,
        startDate: { lte: today },
        endDate: { gte: today },
        keywords: { contains: keyword, mode: 'insensitive' }
      }
    });

    if (promos.length === 0) {
      // Jika keyword spesifik tidak ada, cari yang match dengan keyword 'all' atau 'semua'
      const fallbackPromos = await prisma.promo.findMany({
        where: {
          isActive: true,
          startDate: { lte: today },
          endDate: { gte: today },
        }
      });
      if (fallbackPromos.length === 0) {
        return JSON.stringify({ found: false, message: `Saat ini tidak ada promo yang tersedia.` });
      } else {
         return JSON.stringify({ 
          found: true, 
          message: `Promo khusus untuk '${keyword}' tidak ditemukan, namun berikut adalah promo lain yang sedang berlangsung:`,
          promos: fallbackPromos.map(p => ({
            title: p.title,
            description: p.description,
            mediaUrl: p.imageUrl.startsWith('http') ? p.imageUrl : `https://auditwa.padmasaripangan.co.id${p.imageUrl}`
          }))
        });
      }
    }

    return JSON.stringify({ 
      found: true, 
      promos: promos.map(p => ({
        title: p.title,
        description: p.description,
        mediaUrl: p.imageUrl.startsWith('http') ? p.imageUrl : `https://auditwa.padmasaripangan.co.id${p.imageUrl}`
      }))
    });
  } catch (error) {
    console.error('[ActionHandler] executeSearchPromo error:', error);
    return JSON.stringify({ error: 'Gagal mencari promo.' });
  }
}

async function executeRequestHumanAgent(phoneNumber) {
  try {
    const contact = await prisma.contact.findFirst({
      where: {
        OR: [
          { whatsappId: phoneNumber },
          { whatsappId: phoneNumber + '@s.whatsapp.net' },
          { telegramId: phoneNumber },
          { phoneNumber: phoneNumber },
          { realPhoneNumber: phoneNumber }
        ]
      }
    });
    if (contact) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { botStatus: 'HUMAN_TAKEOVER' }
      });
      return JSON.stringify({ 
        found: true, 
        message: 'Berhasil mengubah status menjadi HUMAN_TAKEOVER. Beritahu pengguna bahwa Anda sedang menyambungkannya ke tim Customer Service.' 
      });
    }
    return JSON.stringify({ found: false, error: 'Kontak tidak ditemukan di database.' });
  } catch (error) {
    console.error('[ActionHandler] executeRequestHumanAgent error:', error);
    return JSON.stringify({ error: 'Gagal memproses peralihan agen.' });
  }
}

async function executeIgnoreUser(reason, phoneNumber) {
  try {
    const contact = await prisma.contact.findFirst({
      where: {
        OR: [
          { whatsappId: phoneNumber },
          { whatsappId: phoneNumber + '@s.whatsapp.net' },
          { telegramId: phoneNumber },
          { phoneNumber: phoneNumber },
          { realPhoneNumber: phoneNumber }
        ]
      }
    });
    if (contact) {
      const ignoredUntilDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
      await prisma.contact.update({
        where: { id: contact.id },
        data: { botStatus: 'IGNORE_USER', ignoredUntil: ignoredUntilDate }
      });
      console.log(`[ActionHandler] tool_ignore_user triggered for ${phoneNumber} reason: ${reason}. Ignored until: ${ignoredUntilDate}`);
      return JSON.stringify({ 
        found: true, 
        message: 'Pengguna telah dibisukan (silent drop) selama 2 jam ke depan. Sistem otomatis tidak akan membalas pesan pengguna ini lagi.' 
      });
    }
    return JSON.stringify({ found: false, error: 'Kontak tidak ditemukan di database.' });
  } catch (error) {
    console.error('[ActionHandler] executeIgnoreUser error:', error);
    return JSON.stringify({ error: 'Gagal memproses pemblokiran.' });
  }
}

async function executeExtractAndCheckOrder(contactId, items) {
  try {
    return await handleExtractedOrder(contactId, items);
  } catch (error) {
    console.error('[ActionHandler] executeExtractAndCheckOrder error:', error);
    return JSON.stringify({ error: 'Gagal memproses ekstraksi pesanan.' });
  }
}

async function executeViewCartSummary(contactId) {
  try {
    return await viewCartSummary(contactId);
  } catch (error) {
    console.error('[ActionHandler] executeViewCartSummary error:', error);
    return JSON.stringify({ error: 'Gagal memproses lihat keranjang.' });
  }
}

async function executeClearCart(contactId) {
  try {
    return await clearCart(contactId);
  } catch (error) {
    console.error('[ActionHandler] executeClearCart error:', error);
    return JSON.stringify({ error: 'Gagal memproses hapus keranjang.' });
  }
}

async function executeCheckoutOrder(contactId) {
  try {
    return await checkoutOrder(contactId);
  } catch (error) {
    console.error('[ActionHandler] executeCheckoutOrder error:', error);
    return JSON.stringify({ error: 'Gagal memproses checkout pesanan.' });
  }
}

async function executeSearchDailyDeliveries(nopfi) {
  try {
    const results = await prisma.dailyDelivery.findMany({
      where: {
        OR: [
          { delivery_number: { contains: nopfi, mode: 'insensitive' } },
          { invoice_number: { contains: nopfi, mode: 'insensitive' } }
        ]
      },
      take: 10
    });

    if (!results || results.length === 0) {
      return JSON.stringify({ message: `Data pengiriman dengan NOPFI '${nopfi}' tidak ditemukan.` });
    }

    return JSON.stringify({
      message: `Ditemukan ${results.length} data pengiriman:`,
      data: results.map(r => ({
        delivery_number: r.delivery_number,
        invoice_number: r.invoice_number,
        delivery_date: r.delivery_date,
        customer_name: r.customer_name,
        customer_code: r.customer_code,
        salesperson_name: r.salesperson_name,
        salesperson_code: r.salesperson_code,
        koordinat: `${r.latitude}, ${r.longitude}`
      }))
    });
  } catch (error) {
    console.error('[ActionHandler] executeSearchDailyDeliveries error:', error);
    return JSON.stringify({ error: 'Gagal mencari data pengiriman harian.' });
  }
}

module.exports = {
  executeSearchStores,
  executeGetOutstandingAr,
  executeGetOutstandingArBySalesman,
  executeGetOutstandingArSummaryPerSalesman,
  executeGetCreditLimitAnalysis,
  executeGetInvoiceDetail,
  executeGetStoreProfile,
  executeCheckPaymentReceipts,
  executeGetBadDebtStores,
  executeGetSalesPerformance,
  executeSearchProductPrice,
  executeSearchPromo,
  executeRequestHumanAgent,
  executeIgnoreUser,
  executeExtractAndCheckOrder,
  executeViewCartSummary,
  executeClearCart,
  executeCheckoutOrder,
  executeSearchDailyDeliveries,
  cleanCustomerName
};
