// backend/controllers/miniAppController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const ReturnService = require('../services/ReturnService');
const path = require('path');

// Alasan retur preset
const ALASAN_RETUR_PRESET = [
  'Barang rusak / cacat',
  'Barang kadaluarsa',
  'Salah kirim / tidak sesuai pesanan',
  'Kelebihan stok',
  'Kemasan rusak',
  'Barang tidak laku',
  'Harga tidak sesuai',
  'Lainnya',
];

/**
 * GET /api/mini-app/config
 * Return config data: preset alasan, divisi list, etc.
 */
async function getConfig(req, res) {
  try {
    res.json({
      alasanPreset: ALASAN_RETUR_PRESET,
      divisiList: ['FORISA','KAO','SANIA','PURBASARI','PIGEON','ENESIS','PADIMAS','FINNA','IGI','LAIN-LAIN'],
    });
  } catch (err) {
    console.error('[MiniApp] getConfig error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * GET /api/mini-app/session
 * Validate initData (done by middleware) and return user context + delivery info.
 * Query params: invoice, customerCode
 */
async function getSession(req, res) {
  try {
    const { invoice, customerCode, simulatedRole, dev } = req.query;
    const telegramUserId = req.telegramUserId;

    let deliveryInfo = null;
    if (invoice) {
      deliveryInfo = await prisma.dailyDelivery.findFirst({
        where: { invoice_number: { equals: invoice, mode: 'insensitive' } }
      });
    }

    let role = 'Salesman';
    let kodeSales = '';
    let contactName = '';
    let contactGroup = null;

    if (telegramUserId) {
      const contact = await prisma.contact.findFirst({ where: { telegramId: String(telegramUserId) } });
      if (contact) {
        contactName = contact.name || '';
        contactGroup = contact.group || null;
        if (contact.kodeSales) kodeSales = contact.kodeSales;

        if (contact.group) {
          const g = contact.group.toUpperCase();
          if (g.includes('SUPERVISOR') || g.includes('SPV') || g.includes('ASISTEN SALES MANAGER')) {
            role = 'Supervisor Sales';
          } else if (g.includes('SOPIR') || g.includes('DRIVER')) {
            role = 'Driver/Kenek';
          } else if (g.includes('GUDANG')) {
            role = 'Admin Gudang';
          } else if (g.includes('SALES')) {
            role = 'Salesman';
          } else {
            role = contact.group;
          }
        }
      }
    }

    // Only allow simulatedRole override if explicitly requested in dev mode, or if contact has no group
    const isDev = dev === 'true' || dev === '1';
    if (simulatedRole && (isDev || !contactGroup)) {
      role = simulatedRole;
      if (simulatedRole === 'Salesman' && !kodeSales) {
         // mock for testing if the user has no real kodeSales
         kodeSales = 'SBB103:ABB103'; 
      }
    }

    // Resolve salesman list with names from saleable_items (and sales_coverages)
    const codes = kodeSales ? kodeSales.split(/[:;,]/).map(s => s.trim()).filter(Boolean) : [];
    let salesList = [];
    if (codes.length > 0) {
      const saleableMatches = await prisma.saleableItem.findMany({
        where: { salesman_code: { in: codes }, salesman_name: { not: null } },
        select: { salesman_code: true, salesman_name: true },
        distinct: ['salesman_code']
      });
      const nameMap = new Map();
      saleableMatches.forEach(m => {
        if (m.salesman_code && m.salesman_name) nameMap.set(m.salesman_code, m.salesman_name);
      });

      const missingCodes = codes.filter(c => !nameMap.has(c));
      if (missingCodes.length > 0) {
        const coverageMatches = await prisma.salesCoverage.findMany({
          where: { salesman_code: { in: missingCodes }, salesman_name: { not: null } },
          select: { salesman_code: true, salesman_name: true },
          distinct: ['salesman_code']
        });
        coverageMatches.forEach(m => {
          if (m.salesman_code && m.salesman_name && !nameMap.has(m.salesman_code)) {
            nameMap.set(m.salesman_code, m.salesman_name);
          }
        });
      }

      salesList = codes.map(c => ({
        code: c,
        name: nameMap.get(c) || c
      }));
    }

    res.json({
      user: req.telegramUser,
      telegramUserId,
      deliveryInfo,
      role,
      contactName,
      contactGroup,
      isDev,
      kodeSales,
      salesList
    });
  } catch (err) {
    console.error('[MiniApp] getSession error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * GET /api/mini-app/deliveries/search?q=<keyword>
 * Search daily deliveries by customer code/name or invoice
 */

async function getSalesCoverage(req, res) {
  try {
    const { kodeSales } = req.query;
    if (!kodeSales) return res.json({ data: [] });

    // kodeSales could be "SBB103:ABB103", so we split it
    const codes = kodeSales.split(':').map(s => s.trim()).filter(Boolean);
    
    // search in SalesCoverage
    const coverage = await prisma.salesCoverage.findMany({
      where: {
        salesman_code: { in: codes }
      },
      select: {
        customer_code: true,
        customer_name: true,
        full_store_address: true
      },
      distinct: ['customer_code']
    });
    
    res.json({ data: coverage });
  } catch (err) {
    console.error('[MiniApp] getSalesCoverage error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

async function searchDeliveries(req, res) {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ data: [] });
    }
    const deliveries = await ReturnService.searchDailyDeliveries(q);
    res.json({ data: deliveries });
  } catch (err) {
    console.error('[MiniApp] searchDeliveries error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * GET /api/mini-app/products/search?q=<keyword>&kodeSales=<salesmanCode>&returnId=<returnId>
 * Search saleable_items with filter on salesman_code, including prices and conversions.
 */
async function searchProducts(req, res) {
  try {
    const q = (req.query.q || '').trim();
    let kodeSales = (req.query.kodeSales || req.query.salespersonCode || '').trim();
    const returnId = (req.query.returnId && req.query.returnId !== 'undefined' && req.query.returnId !== 'null') ? req.query.returnId.trim() : null;

    if (!q || q.length < 2) {
      return res.json({ data: [] });
    }

    const role = (req.query.role || '').trim();
    const isDriver = (role === 'Driver/Kenek' || role === 'Sopir');
    const isGudang = (role === 'Admin Gudang');

    // 1. Jika ada returnId, SELALU pastikan kodeSales diambil dari dokumen retur
    if (returnId) {
      const returnDoc = await prisma.returnTransaction.findUnique({
        where: { id: returnId },
        select: { salespersonCode: true }
      });
      if (returnDoc && returnDoc.salespersonCode) {
        kodeSales = returnDoc.salespersonCode.trim();
      }
    }

    // 2. Jika tetap belum ada kodeSales, fallback ke contact telegram user jika ada
    if (!kodeSales && req.telegramUserId && !isDriver && !isGudang) {
      const contact = await prisma.contact.findFirst({
        where: { telegramId: String(req.telegramUserId) },
        select: { kodeSales: true }
      });
      if (contact && contact.kodeSales) {
        kodeSales = contact.kodeSales.trim();
      }
    }

    // Wajib ada filter kode sales! Jika tidak ada kode sales, jangan tampilkan data saleable item
    if (!kodeSales) {
      return res.json({ data: [] });
    }

    // Filter berdasarkan kode sales (mengacu ke saleable item dengan filter kode sales)
    const rawSalesCodes = kodeSales.split(/[:;,]/).map(s => s.trim()).filter(Boolean);
    const salesCodes = Array.from(new Set(rawSalesCodes.flatMap(s => [s, s.toUpperCase(), s.toLowerCase()])));

    if (salesCodes.length === 0) {
      return res.json({ data: [] });
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const itemMatchClause = tokens.length > 1
      ? {
          AND: tokens.map(t => ({
            OR: [
              { product_code: { contains: t, mode: 'insensitive' } },
              { product_name: { contains: t, mode: 'insensitive' } },
              { product_barcode: { contains: t, mode: 'insensitive' } },
            ]
          }))
        }
      : {
          OR: [
            { product_code: { contains: q, mode: 'insensitive' } },
            { product_name: { contains: q, mode: 'insensitive' } },
            { product_barcode: { contains: q, mode: 'insensitive' } },
          ]
        };

    const whereClause = {
      ...itemMatchClause,
      salesman_code: { in: salesCodes }
    };

    const selectFields = {
      product_code: true,
      product_name: true,
      product_barcode: true,
      packaging_description: true,
      brand_name: true,
      principal_name: true,
      salesman_code: true,
      salesman_name: true,
      unit_of_measure_1: true,
      unit_of_measure_2: true,
      unit_of_measure_3: true,
      conversion_factor_1: true,
      conversion_factor_2: true,
      conversion_factor_3: true,
      price_tier_1: true,
      price_tier_2: true,
      price_tier_3: true,
    };

    const products = await prisma.saleableItem.findMany({
      where: whereClause,
      select: selectFields,
      take: 25,
      orderBy: { product_name: 'asc' },
    });

    // Deduplikasi produk berdasarkan product_code
    const seen = new Set();
    const uniqueProducts = [];
    for (const p of products) {
      if (!seen.has(p.product_code)) {
        seen.add(p.product_code);
        uniqueProducts.push(p);
      }
    }

    // Transform UOM dengan harga dan konversi
    const result = uniqueProducts.map(p => {
      const uoms = [
        p.unit_of_measure_1 ? {
          label: p.unit_of_measure_1,
          konversi: p.conversion_factor_1 ? Math.round(p.conversion_factor_1) : 1,
          harga: p.price_tier_1 || 0,
          price: p.price_tier_1 || 0,
        } : null,
        p.unit_of_measure_2 ? {
          label: p.unit_of_measure_2,
          konversi: p.conversion_factor_2 ? Math.round(p.conversion_factor_2) : 1,
          harga: p.price_tier_2 || 0,
          price: p.price_tier_2 || 0,
        } : null,
        p.unit_of_measure_3 ? {
          label: p.unit_of_measure_3,
          konversi: p.conversion_factor_3 ? Math.round(p.conversion_factor_3) : 1,
          harga: p.price_tier_3 || 0,
          price: p.price_tier_3 || 0,
        } : null,
      ].filter(Boolean);

      return {
        kdbrg: p.product_code,
        nmbrg: p.product_name,
        barcode: p.product_barcode,
        salesmanCode: p.salesman_code,
        salesmanName: p.salesman_name,
        packaging: p.packaging_description,
        brand: p.brand_name,
        principal: p.principal_name,
        uoms,
      };
    });

    res.json({ data: result });
  } catch (err) {
    console.error('[MiniApp] searchProducts error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * POST /api/mini-app/retur/submit
 * Body: {
 *   sessionId, customerCode, customerName, invoiceNumber,
 *   salespersonCode, salespersonName, returnType,
 *   latitude, longitude, locationAddress,
 *   photoUrl, isCustomerValid,
 *   items: [{ productCode, productName, uom, konversi, qty, alasan }]
 * }
 */
async function submitRetur(req, res) {
  try {
    const telegramUserId = req.telegramUserId;
    const telegramUser   = req.telegramUser;
    const sessionId      = req.headers['x-telegram-session-id'] || 'telegram-main';

    const {
      customerCode, customerName, invoiceNumber,
      salespersonCode, salespersonName, returnType,
      latitude, longitude, locationAddress,
      photoUrl, isCustomerValid,
      items = [],
    } = req.body;

    // Validasi minimal
    if (!customerCode || !returnType) {
      return res.status(400).json({ error: 'customerCode dan returnType wajib diisi' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Minimal 1 item barang harus diisi' });
    }
    if (!photoUrl || typeof photoUrl !== 'string' || !photoUrl.trim()) {
      return res.status(400).json({ error: 'Foto barang retur wajib dilampirkan' });
    }
    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined || isNaN(Number(latitude)) || isNaN(Number(longitude))) {
      return res.status(400).json({ error: 'Share location (GPS) wajib diambil' });
    }

    const contactName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim();

    // Hitung distance jika ada koordinat asal dari delivery
    let originLatitude = null, originLongitude = null, distanceDiff = null;
    const delivery = await prisma.dailyDelivery.findFirst({
      where: { invoice_number: { equals: invoiceNumber, mode: 'insensitive' } }
    });
    if (delivery) {
      originLatitude  = delivery.latitude;
      originLongitude = delivery.longitude;
      if (latitude && longitude && originLatitude && originLongitude) {
        distanceDiff = ReturnService.calculateDistance(originLatitude, originLongitude, latitude, longitude);
      }
    }

    // Lookup contact group
    let contactGroup = 'SALESMAN';
    if (telegramUserId) {
      const contact = await prisma.contact.findFirst({
        where: { telegramId: String(telegramUserId) }
      });
      if (contact && contact.group) {
        contactGroup = contact.group;
      }
    }

    const role = req.body.role || contactGroup;
    let isDriver = false;
    if (req.body.role) {
      isDriver = (req.body.role === 'Driver/Kenek' || req.body.role === 'Sopir');
    } else {
      isDriver = Boolean(contactGroup && (contactGroup.toUpperCase().includes('SOPIR') || contactGroup.toUpperCase().includes('DRIVER') || contactGroup === 'Driver/Kenek'));
    }
    if (isDriver) {
      return res.status(403).json({ error: 'Driver/Kenek tidak memiliki hak akses untuk membuat retur baru.' });
    }

    // Resolve salesman name from saleable_items / sales_coverages
    let resolvedSalespersonName = salespersonName;
    if (salespersonCode) {
      const saleable = await prisma.saleableItem.findFirst({
        where: { salesman_code: salespersonCode, salesman_name: { not: null } },
        select: { salesman_name: true }
      });
      if (saleable && saleable.salesman_name) {
        resolvedSalespersonName = saleable.salesman_name;
      } else {
        const coverage = await prisma.salesCoverage.findFirst({
          where: { salesman_code: salespersonCode, salesman_name: { not: null } },
          select: { salesman_name: true }
        });
        if (coverage && coverage.salesman_name) {
          resolvedSalespersonName = coverage.salesman_name;
        }
      }
    }

    const newTx = await ReturnService.createReturnWithItems({
      source:          'MINI_APP',
      telegramUserId,
      contactName,
      customerCode,
      customerName,
      invoiceNumber,
      salespersonCode,
      salespersonName: resolvedSalespersonName || salespersonName,
      isCustomerValid: !!isCustomerValid,
      returnType,
      latitude,
      longitude,
      locationAddress,
      photoUrl,
      originLatitude,
      originLongitude,
      distanceDiff,
      items,
      createdByGroup: contactGroup,
    });

    // Kirim notifikasi ke gudang/kasir/EDP via bot (background, non-blocking)
    ReturnService.notifyDepartmentsWithItems(sessionId, newTx).catch(err =>
      console.error('[MiniApp] Notify error:', err)
    );

    // Kirim konfirmasi ke chat user via bot
    ReturnService.sendUserConfirmation(sessionId, telegramUserId, newTx).catch(err =>
      console.error('[MiniApp] User confirm error:', err)
    );

    // Kirim sinkronisasi ke server pusat (background, non-blocking)
    ReturnService.syncToServer(newTx, { force: true }).catch(err =>
      console.error('[MiniApp] submitRetur sync error:', err)
    );

    res.json({
      success: true,
      returnNumber: newTx.returnNumber,
      returnId: newTx.id,
      data: newTx,
      message: `Retur berhasil disimpan. No: ${newTx.returnNumber}`,
    });
  } catch (err) {
    console.error('[MiniApp] submitRetur error:', err);
    res.status(500).json({ error: 'Gagal menyimpan retur: ' + err.message });
  }
}

/**
 * GET /api/mini-app/retur/today
 */

async function getReturnsForRole(req, res) {
  try {
    const { role, status, date } = req.query;
    const telegramUserId = req.telegramUserId;
    
    let whereClause = { deletedAt: null };

    // Status filter:
    if (status && status !== 'ALL') {
      if (status === 'SUBMITTED') {
        whereClause.status = { in: ['SUBMITTED', 'DRAFT'] };
      } else {
        whereClause.status = status;
      }
    } else if (!status) {
      if (role === 'Supervisor Sales') {
        whereClause.status = { in: ['SUBMITTED', 'DRAFT'] };
      } else if (role === 'Driver/Kenek' || role === 'Sopir') {
        whereClause.status = { in: ['SPV_APPROVED', 'DRIVER_PROCESSED'] };
      } else if (role === 'Admin Gudang') {
        whereClause.status = { in: ['SPV_APPROVED', 'DRIVER_PROCESSED'] };
      }
    } else if (status === 'ALL') {
      if (role === 'Driver/Kenek' || role === 'Sopir') {
        whereClause.status = { in: ['SPV_APPROVED', 'DRIVER_PROCESSED', 'SELESAI'] };
      } else if (role === 'Admin Gudang') {
        whereClause.status = { in: ['SPV_APPROVED', 'DRIVER_PROCESSED', 'SELESAI'] };
      }
    }

    // Date filter:
    if (date && date !== 'ALL') {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      whereClause.createdAt = { gte: startOfDay, lte: endOfDay };
    }

    // Salesman role filter:
    if (role === 'Salesman' && telegramUserId) {
      const contact = await prisma.contact.findFirst({ where: { telegramId: String(telegramUserId) } });
      const codes = contact?.kodeSales ? contact.kodeSales.split(':').map(s => s.trim()).filter(Boolean) : [];
      if (codes.length > 0) {
        whereClause.OR = [
          { telegramUserId: telegramUserId },
          { salespersonCode: { in: codes } }
        ];
      } else {
        whereClause.telegramUserId = telegramUserId;
      }
    }

    const returns = await prisma.returnTransaction.findMany({
      where: whereClause,
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' }
        },
        histories: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    res.json({ data: returns });
  } catch (err) {
    console.error('[MiniApp] getReturnsForRole error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

async function approveReturnApi(req, res) {
  try {
    const returnId = req.params.id;
    const existingTx = await prisma.returnTransaction.findUnique({ where: { id: returnId } });
    if (!existingTx || existingTx.deletedAt) return res.status(404).json({ error: 'Return tidak ditemukan' });
    if (existingTx.status === 'SPV_APPROVED') {
      return res.status(400).json({ error: 'Retur ini sudah diapprove sebelumnya.' });
    }

    let actorName = req.telegramUser?.first_name || 'Supervisor';
    if (req.telegramUserId) {
      const contact = await prisma.contact.findFirst({ where: { telegramId: String(req.telegramUserId) } });
      if (contact && contact.name) actorName = contact.name;
    }
    const actorData = { id: req.telegramUserId, name: actorName, role: req.body.role || 'Supervisor Sales' };
    const updated = await ReturnService.approveReturn(returnId, actorData);

    // Sync status change to central server (background, non-blocking)
    ReturnService.syncToServer(updated, { force: true }).catch(err =>
      console.error('[MiniApp] Approve sync error:', err)
    );

    // Notify salesman via Telegram bot if available
    if (existingTx.telegramUserId) {
      try {
        const { getTelegramBot } = require('../telegram');
        const bot = getTelegramBot('telegram-main');
        if (bot) {
          const msg = `✅ *RETUR DISETUJUI*\n\nNo. Retur: *${existingTx.returnNumber || '-'}*\nToko: *${existingTx.customerCode} - ${existingTx.customerName}*\nDisetujui oleh: *${actorData.name}* (Supervisor)\n\nStruk retur sekarang siap dicetak.`;
          bot.sendMessage(existingTx.telegramUserId, msg, { parse_mode: 'Markdown' }).catch(err => console.error('[MiniApp] Approve notify error:', err.message));
        }
      } catch (notifErr) {
        console.error('[MiniApp] Telegram bot notify error:', notifErr.message);
      }
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function rejectReturnApi(req, res) {
  try {
    const returnId = req.params.id;
    const existingTx = await prisma.returnTransaction.findUnique({ where: { id: returnId } });
    if (!existingTx || existingTx.deletedAt) return res.status(404).json({ error: 'Return tidak ditemukan' });
    if (['SPV_APPROVED', 'SELESAI'].includes(existingTx.status)) {
      return res.status(400).json({ error: 'Retur yang sudah diapprove tidak dapat ditolak.' });
    }

    let actorName = req.telegramUser?.first_name || 'Supervisor';
    if (req.telegramUserId) {
      const contact = await prisma.contact.findFirst({ where: { telegramId: String(req.telegramUserId) } });
      if (contact && contact.name) actorName = contact.name;
    }
    const actorData = { id: req.telegramUserId, name: actorName, role: req.body.role || 'Supervisor Sales' };
    const updated = await ReturnService.rejectReturn(returnId, actorData);

    // Sync status change to central server (background, non-blocking)
    ReturnService.syncToServer(updated, { force: true }).catch(err =>
      console.error('[MiniApp] Reject sync error:', err)
    );

    // Notify salesman via Telegram bot if available
    if (existingTx.telegramUserId) {
      try {
        const { getTelegramBot } = require('../telegram');
        const bot = getTelegramBot('telegram-main');
        if (bot) {
          const msg = `❌ *RETUR DITOLAK*\n\nNo. Retur: *${existingTx.returnNumber || '-'}*\nToko: *${existingTx.customerCode} - ${existingTx.customerName}*\nDitolak oleh: *${actorData.name}* (Supervisor)`;
          bot.sendMessage(existingTx.telegramUserId, msg, { parse_mode: 'Markdown' }).catch(err => console.error('[MiniApp] Reject notify error:', err.message));
        }
      } catch (notifErr) {
        console.error('[MiniApp] Telegram bot notify error:', notifErr.message);
      }
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getTodayReturns(req, res) {
  try {
    const telegramUserId = req.telegramUserId;
    const { date } = req.query;
    
    let dateFilter = {};
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      dateFilter = {
        gte: startOfDay,
        lte: endOfDay
      };
    } else {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      dateFilter = { gte: last24Hours };
    }

    const returns = await prisma.returnTransaction.findMany({
      where: {
        telegramUserId,
        createdAt: dateFilter,
        deletedAt: null
      },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ data: returns });
  } catch (err) {
    console.error('[MiniApp] getTodayReturns error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * GET /api/mini-app/retur/:id
 */
async function getReturnDetails(req, res) {
  try {
    const returnId = req.params.id;
    const tx = await prisma.returnTransaction.findUnique({
      where: { id: returnId },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' }
        },
        histories: true
      }
    });
    if (!tx || tx.deletedAt) return res.status(404).json({ error: 'Return tidak ditemukan' });

    let userGroup = null;
    if (req.telegramUserId) {
      const contact = await prisma.contact.findFirst({ where: { telegramId: String(req.telegramUserId) } });
      if (contact) userGroup = contact.group;
    }

    res.json({ data: tx, userGroup });
  } catch (err) {
    console.error('[MiniApp] getReturnDetails error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * POST /api/mini-app/retur/:id/items
 */
async function submitReturnItems(req, res) {
  try {
    const returnId = req.params.id;
    const { items } = req.body;
    const sessionId = req.headers['x-telegram-session-id'] || 'telegram-main';
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Minimal 1 item barang harus diisi' });
    }

    const tx = await prisma.returnTransaction.findUnique({ where: { id: returnId } });
    if (!tx || tx.deletedAt) {
      return res.status(404).json({ error: 'Return tidak ditemukan' });
    }

    // Lookup contact group
    let contactGroup = null;
    if (req.telegramUserId) {
      const contact = await prisma.contact.findFirst({
        where: { telegramId: String(req.telegramUserId) }
      });
      if (contact && contact.group) {
        contactGroup = contact.group;
      }
    }

    const role = req.body.role || contactGroup || 'GUDANG';
    let isDriver = false;
    if (req.body.role) {
      isDriver = (req.body.role === 'Driver/Kenek' || req.body.role === 'Sopir');
    } else {
      isDriver = Boolean(contactGroup && (contactGroup.toUpperCase().includes('SOPIR') || contactGroup.toUpperCase().includes('DRIVER') || contactGroup === 'Driver/Kenek'));
    }

    let isGudang = false;
    if (req.body.role) {
      isGudang = (req.body.role === 'Admin Gudang');
    } else {
      isGudang = Boolean(contactGroup && contactGroup.toUpperCase().includes('GUDANG'));
    }

    // Status locking logic:
    // Once SELESAI, no further item editing is allowed for anyone
    if (tx.status === 'SELESAI') {
      return res.status(403).json({ error: 'Retur yang sudah disetujui Gudang (SELESAI) telah dikunci permanen dan tidak dapat diedit lagi.' });
    }

    // Retur yang sudah diproses oleh Driver (DRIVER_PROCESSED) hanya dapat diedit/diverifikasi oleh Admin Gudang
    if (tx.status === 'DRIVER_PROCESSED') {
      if (!isGudang) {
        return res.status(403).json({ error: 'Retur yang sudah diproses oleh Driver/Kenek hanya dapat diedit dan diverifikasi oleh Admin Gudang.' });
      }
    }

    // SPV_APPROVED returns can be edited by Driver/Kenek (pickup) or Admin Gudang (direct receipt)
    if (tx.status === 'SPV_APPROVED') {
      if (!isDriver && !isGudang) {
        return res.status(403).json({ error: 'Retur yang sudah disetujui oleh Supervisor hanya dapat diedit oleh Driver/Kenek atau Admin Gudang.' });
      }
    } else if (['SUBMITTED', 'DRAFT'].includes(tx.status)) {
      // Driver/Kenek cannot process unapproved returns
      if (isDriver) {
        return res.status(403).json({ error: 'Driver/Kenek hanya dapat memproses retur yang sudah disetujui oleh Supervisor Sales.' });
      }
    }

    const isFinal = req.body.isFinal === true || req.body.isFinal === 'true';
    if (isDriver && isFinal) {
      const dPhoto = req.body.driverPhotoUrl ? String(req.body.driverPhotoUrl).trim() : null;
      if (!dPhoto && !tx.driverPhotoUrl) {
        return res.status(400).json({ error: 'Foto barang retur wajib dilampirkan oleh Driver' });
      }
      const hasReqGps = req.body.driverLatitude !== undefined && req.body.driverLatitude !== null &&
                        req.body.driverLongitude !== undefined && req.body.driverLongitude !== null &&
                        !isNaN(Number(req.body.driverLatitude)) && !isNaN(Number(req.body.driverLongitude));
      const hasExistingGps = tx.driverLatitude !== null && tx.driverLongitude !== null;
      if (!hasReqGps && !hasExistingGps) {
        return res.status(400).json({ error: 'Share location (GPS) wajib diambil oleh Driver' });
      }
    }
    let action = 'EDITED_ITEMS';
    if (role === 'Supervisor Sales') action = 'SPV_EDITED_ITEMS';
    if (isGudang) action = 'GUDANG_EDITED_ITEMS';
    if (isDriver) {
      action = isFinal ? 'DRIVER_PROCESSED_ITEMS' : 'DRIVER_EDITED_ITEMS';
    }

    const actorData = { id: req.telegramUserId, name: req.telegramUser?.first_name || (isGudang ? 'Admin Gudang' : (isDriver ? 'Driver' : 'User')), role, action };
    if (isDriver && isFinal) {
      actorData.status = 'DRIVER_PROCESSED';
    }
    const updatedTx = await ReturnService.addItemsToReturn(returnId, items, contactGroup, actorData);

    const updateHeaderData = {};

    // Update invoiceNumber if provided in payload
    if (req.body.invoiceNumber !== undefined) {
      const inv = String(req.body.invoiceNumber || '').trim();
      updateHeaderData.invoiceNumber = inv || null;
      updatedTx.invoiceNumber = inv || null;
    }

    // Update returnType if provided in payload
    if (req.body.returnType) {
      const rType = String(req.body.returnType).toUpperCase().trim();
      if (['TUNAI', 'KREDIT'].includes(rType)) {
        updateHeaderData.returnType = rType;
        updatedTx.returnType = rType;
      }
    }

    // If driver is saving or finalizing pickup, store driver photo & location
    if (isDriver) {
      if (req.body.driverPhotoUrl !== undefined) {
        const dPhoto = req.body.driverPhotoUrl ? String(req.body.driverPhotoUrl).trim() : null;
        updateHeaderData.driverPhotoUrl = dPhoto;
        updatedTx.driverPhotoUrl = dPhoto;
      }
      if (req.body.driverLatitude !== undefined && req.body.driverLongitude !== undefined && req.body.driverLatitude !== null && req.body.driverLongitude !== null) {
        const dLat = parseFloat(req.body.driverLatitude);
        const dLng = parseFloat(req.body.driverLongitude);
        updateHeaderData.driverLatitude = dLat;
        updateHeaderData.driverLongitude = dLng;
        updatedTx.driverLatitude = dLat;
        updatedTx.driverLongitude = dLng;

        if (tx.originLatitude !== null && tx.originLatitude !== undefined && tx.originLongitude !== null && tx.originLongitude !== undefined) {
          const dDiff = ReturnService.calculateDistance(tx.originLatitude, tx.originLongitude, dLat, dLng);
          updateHeaderData.driverDistanceDiff = dDiff;
          updatedTx.driverDistanceDiff = dDiff;
        }
      }
      if (req.body.driverLocationAddress !== undefined) {
        const dAddr = req.body.driverLocationAddress ? String(req.body.driverLocationAddress).trim() : null;
        updateHeaderData.driverLocationAddress = dAddr;
        updatedTx.driverLocationAddress = dAddr;
      }
    }

    if (Object.keys(updateHeaderData).length > 0) {
      await prisma.returnTransaction.update({
        where: { id: returnId },
        data: updateHeaderData
      });
    }

    // Fetch complete updated transaction record with items
    const freshTx = await prisma.returnTransaction.findUnique({
      where: { id: returnId },
      include: { items: true }
    });

    // Notify departments
    ReturnService.notifyDepartmentsWithItems(sessionId, freshTx || updatedTx).catch(err =>
      console.error('[MiniApp] Notify error:', err)
    );
    
    // Sync to Central Server (ORDS)
    ReturnService.syncToServer(freshTx || updatedTx, { force: true }).catch(err =>
      console.error('[MiniApp] Sync error:', err)
    );

    res.json({
      success: true,
      message: 'Detail barang berhasil disimpan',
      data: updatedTx
    });
  } catch (err) {
    console.error('[MiniApp] submitReturnItems error:', err);
    res.status(500).json({ error: 'Gagal menyimpan detail: ' + err.message });
  }
}

/**
 * POST /api/mini-app/retur/:id/type
 * Body: { returnType: 'TUNAI' | 'KREDIT', role?: string }
 */
async function updateReturnType(req, res) {
  try {
    const returnId = req.params.id;
    const { returnType, role } = req.body;

    const tx = await prisma.returnTransaction.findUnique({
      where: { id: returnId }
    });

    if (!tx || tx.deletedAt) {
      return res.status(404).json({ error: 'Dokumen retur tidak ditemukan' });
    }

    if (tx.status === 'SELESAI') {
      return res.status(403).json({ error: 'Retur yang sudah disetujui Gudang (SELESAI) telah dikunci permanen dan tidak dapat diubah lagi.' });
    }

    let contactGroup = null;
    if (req.telegramUserId) {
      const contact = await prisma.contact.findFirst({
        where: { telegramId: String(req.telegramUserId) }
      });
      if (contact && contact.group) {
        contactGroup = contact.group;
      }
    }

    const currentRole = role || contactGroup || 'GUDANG';
    let isDriver = false;
    if (role) {
      isDriver = (role === 'Driver/Kenek' || role === 'Sopir');
    } else {
      isDriver = Boolean(contactGroup && (contactGroup.toUpperCase().includes('SOPIR') || contactGroup.toUpperCase().includes('DRIVER') || contactGroup === 'Driver/Kenek'));
    }

    let isGudang = false;
    if (role) {
      isGudang = (role === 'Admin Gudang');
    } else {
      isGudang = Boolean(contactGroup && contactGroup.toUpperCase().includes('GUDANG'));
    }

    // Driver can edit on SPV_APPROVED. Admin Gudang can edit on DRIVER_PROCESSED or SPV_APPROVED. Sales/SPV can edit on SUBMITTED/DRAFT.
    if (tx.status === 'DRIVER_PROCESSED' && !isGudang) {
      return res.status(403).json({ error: 'Retur yang sudah diproses oleh Driver hanya dapat diubah Tipe Retur oleh Admin Gudang.' });
    }
    if (tx.status === 'SPV_APPROVED' && !isDriver && !isGudang) {
      return res.status(403).json({ error: 'Retur yang telah disetujui SPV hanya dapat diubah Tipe Returnya oleh Driver/Kenek atau Admin Gudang.' });
    }

    const newType = (returnType || '').toUpperCase().trim();
    if (!['TUNAI', 'KREDIT'].includes(newType)) {
      return res.status(400).json({ error: 'Tipe Retur harus TUNAI atau KREDIT' });
    }

    const updatedTx = await prisma.returnTransaction.update({
      where: { id: returnId },
      data: { returnType: newType }
    });

    // Record history
    await prisma.returnHistory.create({
      data: {
        returnTransactionId: returnId,
        action: isGudang ? 'GUDANG_UPDATED_TYPE' : (isDriver ? 'DRIVER_UPDATED_TYPE' : 'UPDATED_TYPE'),
        actorId: req.telegramUserId ? String(req.telegramUserId) : null,
        actorName: req.telegramUser?.first_name || (isGudang ? 'Admin Gudang' : (isDriver ? 'Driver' : 'User')),
        actorRole: currentRole,
        changes: { oldType: tx.returnType, newType }
      }
    });

    // Sync to Central Server (ORDS)
    ReturnService.syncToServer(updatedTx, { force: true }).catch(err =>
      console.error('[MiniApp] updateReturnType sync error:', err)
    );

    res.json({
      success: true,
      message: `Tipe Retur berhasil diubah menjadi ${newType}`,
      data: updatedTx
    });
  } catch (err) {
    console.error('[MiniApp] updateReturnType error:', err);
    res.status(500).json({ error: 'Gagal mengubah Tipe Retur: ' + err.message });
  }
}

/**
 * POST /api/mini-app/retur/:id/invoice
 * Body: { invoiceNumber: string, role?: string }
 */
async function updateReturnInvoice(req, res) {
  try {
    const returnId = req.params.id;
    const { invoiceNumber, role } = req.body;

    const tx = await prisma.returnTransaction.findUnique({
      where: { id: returnId }
    });

    if (!tx || tx.deletedAt) {
      return res.status(404).json({ error: 'Dokumen retur tidak ditemukan' });
    }

    if (tx.status === 'SELESAI') {
      return res.status(403).json({ error: 'Retur yang sudah disetujui Gudang (SELESAI) telah dikunci permanen dan tidak dapat diubah lagi.' });
    }

    let contactGroup = null;
    if (req.telegramUserId) {
      const contact = await prisma.contact.findFirst({
        where: { telegramId: String(req.telegramUserId) }
      });
      if (contact && contact.group) {
        contactGroup = contact.group;
      }
    }

    const currentRole = role || contactGroup || 'GUDANG';
    let isDriver = false;
    if (role) {
      isDriver = (role === 'Driver/Kenek' || role === 'Sopir');
    } else {
      isDriver = Boolean(contactGroup && (contactGroup.toUpperCase().includes('SOPIR') || contactGroup.toUpperCase().includes('DRIVER') || contactGroup === 'Driver/Kenek'));
    }

    let isGudang = false;
    if (role) {
      isGudang = (role === 'Admin Gudang');
    } else {
      isGudang = Boolean(contactGroup && contactGroup.toUpperCase().includes('GUDANG'));
    }

    // Driver can edit invoice on SPV_APPROVED. Admin Gudang can edit on DRIVER_PROCESSED or SPV_APPROVED. Sales/SPV can edit on SUBMITTED/DRAFT.
    if (tx.status === 'DRIVER_PROCESSED' && !isGudang) {
      return res.status(403).json({ error: 'Retur yang sudah diproses oleh Driver hanya dapat diedit No Faktur oleh Admin Gudang.' });
    }
    if (tx.status === 'SPV_APPROVED' && !isDriver && !isGudang) {
      return res.status(403).json({ error: 'Retur yang telah disetujui SPV hanya dapat diedit No Faktur oleh Driver/Kenek atau Admin Gudang.' });
    }

    const newInvoiceNumber = (invoiceNumber || '').trim();

    const updatedTx = await prisma.returnTransaction.update({
      where: { id: returnId },
      data: { invoiceNumber: newInvoiceNumber || null }
    });

    // Record history
    await prisma.returnHistory.create({
      data: {
        returnTransactionId: returnId,
        action: isGudang ? 'GUDANG_UPDATED_INVOICE' : (isDriver ? 'DRIVER_UPDATED_INVOICE' : 'UPDATED_INVOICE'),
        actorId: req.telegramUserId ? String(req.telegramUserId) : null,
        actorName: req.telegramUser?.first_name || (isGudang ? 'Admin Gudang' : (isDriver ? 'Driver' : 'User')),
        actorRole: currentRole,
        changes: { oldInvoice: tx.invoiceNumber || null, newInvoice: newInvoiceNumber || null }
      }
    });

    // Sync to Central Server (ORDS)
    ReturnService.syncToServer(updatedTx, { force: true }).catch(err =>
      console.error('[MiniApp] updateReturnInvoice sync error:', err)
    );

    res.json({
      success: true,
      message: 'No Faktur berhasil diperbarui',
      data: updatedTx
    });
  } catch (err) {
    console.error('[MiniApp] updateReturnInvoice error:', err);
    res.status(500).json({ error: 'Gagal memperbarui No Faktur: ' + err.message });
  }
}

/**
 * POST /api/mini-app/retur/:id/print
 */
async function printReturn(req, res) {
  try {
    const returnId = req.params.id;
    const tx = await prisma.returnTransaction.findUnique({
      where: { id: returnId },
      include: { items: true }
    });
    if (!tx || tx.deletedAt) return res.status(404).json({ error: 'Return tidak ditemukan' });
    
    let printedBy = req.telegramUser ? `${req.telegramUser.first_name || ''} ${req.telegramUser.last_name || ''}`.trim() : 'User';
    if (req.telegramUserId) {
      const contact = await prisma.contact.findFirst({ where: { telegramId: String(req.telegramUserId) } });
      if (contact && contact.name) printedBy = contact.name;
    }

    const printType = req.body.printType || null;
    const result = await ReturnService.printReceipt(tx, null, printedBy, printType);
    if (result.success) {
      res.json({ success: true, message: 'Struk berhasil dikirim ke antrean cetak' });
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (err) {
    console.error('[MiniApp] printReturn error:', err);
    res.status(500).json({ error: 'Gagal mencetak: ' + err.message });
  }
}

/**
 * GET /api/mini-app/retur/:id/receipt
 * Structured data & plain text receipt for TWA thermal preview & printing
 */
async function getReturnReceipt(req, res) {
  try {
    const returnId = req.params.id;
    const printType = req.query.type || req.query.printType || null;
    const tx = await prisma.returnTransaction.findUnique({
      where: { id: returnId },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    if (!tx || tx.deletedAt) return res.status(404).json({ error: 'Return tidak ditemukan' });

    let printedBy = req.telegramUser ? `${req.telegramUser.first_name || ''} ${req.telegramUser.last_name || ''}`.trim() : 'Salesman';
    if (req.telegramUserId) {
      const contact = await prisma.contact.findFirst({ where: { telegramId: String(req.telegramUserId) } });
      if (contact && contact.name) printedBy = contact.name;
    }

    const receiptContent = ReturnService.generateReceiptContent(tx, printType, printedBy);
    res.json({
      success: true,
      data: {
        id: tx.id,
        returnNumber: tx.returnNumber,
        customerCode: tx.customerCode,
        customerName: tx.customerName,
        invoiceNumber: tx.invoiceNumber,
        salespersonCode: tx.salespersonCode,
        salespersonName: tx.salespersonName,
        returnType: tx.returnType,
        status: tx.status,
        isPrinted: tx.isPrinted,
        createdAt: tx.createdAt,
        plainText: receiptContent.plainText,
        groupedItems: receiptContent.groupedItems,
        totalSku: receiptContent.totalSku,
        printedBy
      }
    });
  } catch (err) {
    console.error('[MiniApp] getReturnReceipt error:', err);
    res.status(500).json({ error: 'Gagal mengambil data struk: ' + err.message });
  }
}

/**
 * POST /api/mini-app/retur/:id/finish
 * Admin Gudang Approve & Lock Return (status: SELESAI)
 */
async function finishReturn(req, res) {
  try {
    const returnId = req.params.id;
    const existingTx = await prisma.returnTransaction.findUnique({
      where: { id: returnId },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    if (!existingTx || existingTx.deletedAt) return res.status(404).json({ error: 'Return tidak ditemukan' });
    if (existingTx.status === 'SELESAI') {
      return res.status(400).json({ error: 'Retur ini sudah disetujui sebelumnya dan berstatus SELESAI.' });
    }

    let contactGroup = 'GUDANG';
    if (req.telegramUserId) {
      const contact = await prisma.contact.findFirst({ where: { telegramId: String(req.telegramUserId) } });
      if (contact && contact.group) contactGroup = contact.group;
    }
    const role = req.body?.role || contactGroup;
    const actorName = req.telegramUser?.first_name || 'Admin Gudang';

    // If latest items are provided in payload, save them first
    if (req.body?.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
      await ReturnService.addItemsToReturn(returnId, req.body.items, 'GUDANG', {
        action: 'GUDANG_APPROVED',
        role: 'Admin Gudang',
        name: actorName,
        id: req.telegramUserId
      });
    }

    const tx = await prisma.returnTransaction.update({
      where: { id: returnId },
      data: { status: 'SELESAI', isSynced: false },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    const totalGood = tx.items.reduce((acc, i) => acc + (i.qtyGood || 0), 0);
    const totalBad = tx.items.reduce((acc, i) => acc + (i.qtyBad || 0), 0);
    const totalNominal = tx.items.reduce((acc, i) => acc + (i.totalPrice || (i.price || 0) * (i.qty || 0)), 0);

    // Record history
    await prisma.returnHistory.create({
      data: {
        returnTransactionId: returnId,
        action: 'GUDANG_APPROVED',
        actorRole: 'Admin Gudang',
        actorName,
        actorId: req.telegramUserId ? String(req.telegramUserId) : null,
        changes: {
          itemCount: tx.items.length,
          totalQtyGood: totalGood,
          totalQtyBad: totalBad,
          totalNominal
        }
      }
    });

    // Trigger background sync to APEX
    ReturnService.syncToServer(tx).catch(err => console.error('[MiniApp] finishReturn sync error:', err));

    // Send Telegram bot notification to Salesman if telegramUserId available
    if (tx.telegramUserId) {
      try {
        const { getTelegramBot } = require('../telegram');
        const bot = getTelegramBot('telegram-main');
        if (bot) {
          const msg = `📦 *RETUR DISETUJUI GUDANG (SELESAI)*\n\nNo. Retur: *${tx.returnNumber || '-'}*\nToko: *${tx.customerCode} - ${tx.customerName}*\nInv: *${tx.invoiceNumber || '-'}*\nDisetujui oleh: *${actorName}* (Admin Gudang)\nKondisi: 🟢 *${totalGood} Good* · 🔴 *${totalBad} Bad*\n\nDokumen retur telah dikunci dan struk gudang siap dicetak.`;
          bot.sendMessage(tx.telegramUserId, msg, { parse_mode: 'Markdown' }).catch(err => console.error('[MiniApp] Gudang approve notify error:', err.message));
        }
      } catch (notifErr) {
        console.error('[MiniApp] Telegram bot notify error:', notifErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Retur berhasil disetujui oleh Gudang dan dikunci permanen (SELESAI)',
      data: tx
    });
  } catch (err) {
    console.error('[MiniApp] finishReturn error:', err);
    res.status(500).json({ error: 'Gagal menyelesaikan retur: ' + err.message });
  }
}

/**
 * DELETE /api/mini-app/retur/:id
 */
async function softDeleteReturn(req, res) {
  try {
    const returnId = req.params.id;
    
    const tx = await prisma.returnTransaction.findUnique({ where: { id: returnId } });
    if (!tx || tx.deletedAt) {
      return res.status(404).json({ error: 'Return tidak ditemukan' });
    }
    
    // Check role: Driver/Kenek is strictly forbidden from deleting returns
    let contactGroup = 'SALESMAN';
    if (req.telegramUserId) {
      const contact = await prisma.contact.findFirst({ where: { telegramId: String(req.telegramUserId) } });
      if (contact && contact.group) contactGroup = contact.group;
    }
    const role = req.body?.role || req.query?.role || contactGroup;
    let isDriver = false;
    if (req.body?.role || req.query?.role) {
      const r = req.body?.role || req.query?.role;
      isDriver = (r === 'Driver/Kenek' || r === 'Sopir');
    } else {
      isDriver = Boolean(contactGroup && (contactGroup.toUpperCase().includes('SOPIR') || contactGroup.toUpperCase().includes('DRIVER') || contactGroup === 'Driver/Kenek'));
    }
    if (isDriver) {
      return res.status(403).json({ error: 'Driver/Kenek tidak memiliki hak akses untuk menghapus retur.' });
    }

    if (['SPV_APPROVED', 'DRIVER_PROCESSED', 'SELESAI'].includes(tx.status)) {
      return res.status(403).json({ error: 'Retur yang sudah disetujui oleh Supervisor tidak dapat dihapus.' });
    }

    const deletedTx = await prisma.returnTransaction.update({
      where: { id: returnId },
      data: { deletedAt: new Date(), isSynced: false }
    });

    // Sync soft delete to Central Server (ORDS)
    ReturnService.syncToServer(deletedTx, { force: true }).catch(err =>
      console.error('[MiniApp] softDeleteReturn sync error:', err)
    );
    
    res.json({ success: true, message: 'Retur berhasil dihapus' });
  } catch (err) {
    console.error('[MiniApp] softDeleteReturn error:', err);
    res.status(500).json({ error: 'Gagal menghapus retur: ' + err.message });
  }
}

/**
 * POST /api/mini-app/retur/:id/sync
 * Manually triggers sync of a single return transaction to central server
 */
async function syncReturnApi(req, res) {
  try {
    const returnId = req.params.id;
    const tx = await prisma.returnTransaction.findUnique({
      where: { id: returnId },
      include: { items: true }
    });

    if (!tx) {
      return res.status(404).json({ error: 'Dokumen retur tidak ditemukan' });
    }

    const syncResult = await ReturnService.syncToServer(tx, { force: true });
    res.json({
      success: syncResult.success,
      apexSynced: syncResult.apexSynced,
      message: syncResult.message,
      data: {
        id: tx.id,
        returnNumber: tx.returnNumber,
        isSynced: syncResult.apexSynced
      }
    });
  } catch (err) {
    console.error('[MiniApp] syncReturnApi error:', err);
    res.status(500).json({ error: 'Gagal melakukan sinkronisasi: ' + err.message });
  }
}

/**
 * POST /api/mini-app/retur/sync-all
 * Triggers batch sync of all unsynced return transactions
 */
async function syncAllReturnsApi(req, res) {
  try {
    const result = await ReturnService.syncAllUnsynced();
    res.json(result);
  } catch (err) {
    console.error('[MiniApp] syncAllReturnsApi error:', err);
    res.status(500).json({ error: 'Gagal sinkronisasi massal: ' + err.message });
  }
}

module.exports = { 
  getSalesCoverage, 
  getReturnsForRole,
  approveReturnApi,
  rejectReturnApi, 
  getConfig, 
  getSession, 
  searchDeliveries, 
  searchProducts, 
  submitRetur,
  getTodayReturns,
  getReturnDetails,
  submitReturnItems,
  printReturn,
  getReturnReceipt,
  finishReturn,
  softDeleteReturn,
  updateReturnInvoice,
  updateReturnType,
  syncReturnApi,
  syncAllReturnsApi
};
