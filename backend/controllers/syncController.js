const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

// In-memory store for active sync progress (for SSE)
const activeSyncs = new Map(); // key: module, value: { status, progress, total, message }
const sseClients = new Set(); // store response objects

const broadcastProgress = () => {
  const data = JSON.stringify(Object.fromEntries(activeSyncs));
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }
};

const updateProgress = (module, progressData) => {
  activeSyncs.set(module, { ...activeSyncs.get(module), ...progressData });
  broadcastProgress();
};

// Helper: Extract nested array from JSON data using optional dot-path
function extractItemsFromData(data, dataPath) {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  if (dataPath && typeof dataPath === 'string') {
    const parts = dataPath.trim().split('.');
    let curr = data;
    for (const part of parts) {
      if (curr && typeof curr === 'object') {
        curr = curr[part];
      } else {
        curr = null;
        break;
      }
    }
    if (Array.isArray(curr)) return curr;
  }

  // Common fallbacks
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.records)) return data.records;

  return [];
}

// Helper: Apply field mapping (source API key -> target DB key)
function applyFieldMapping(item, mapping) {
  if (!mapping || typeof mapping !== 'object' || Object.keys(mapping).length === 0) {
    return item;
  }
  const result = { ...item };
  for (const [sourceKey, targetKey] of Object.entries(mapping)) {
    if (item[sourceKey] !== undefined) {
      result[targetKey] = item[sourceKey];
    }
  }
  return result;
}

// Helper: Build headers & auth configuration
function buildAxiosConfig(setting) {
  const headers = { Accept: 'application/json' };

  if (setting.customHeaders) {
    try {
      const custom = typeof setting.customHeaders === 'string'
        ? JSON.parse(setting.customHeaders)
        : setting.customHeaders;
      if (custom && typeof custom === 'object') {
        Object.assign(headers, custom);
      }
    } catch (e) {
      console.warn(`[Sync] Failed to parse customHeaders for ${setting.module}:`, e.message);
    }
  }

  let auth;
  const authType = (setting.authType || 'NONE').toUpperCase();

  if (authType === 'BASIC') {
    if (setting.authUsername && setting.authPassword) {
      auth = { username: setting.authUsername, password: setting.authPassword };
    }
  } else if (authType === 'BEARER') {
    if (setting.authToken) {
      headers['Authorization'] = `Bearer ${setting.authToken}`;
    }
  } else if (authType === 'API_KEY') {
    const headerName = setting.apiKeyHeader || 'X-API-Key';
    if (setting.authToken) {
      headers[headerName] = setting.authToken;
    }
  } else if (setting.authUsername && setting.authPassword) {
    auth = { username: setting.authUsername, password: setting.authPassword };
  }

  return { headers, auth };
}

const syncController = {
  streamProgress: (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    sseClients.add(res);
    res.write(`data: ${JSON.stringify(Object.fromEntries(activeSyncs))}\n\n`);

    req.on('close', () => {
      sseClients.delete(res);
    });
  },

  getSettings: async (req, res) => {
    try {
      const settings = await prisma.syncSetting.findMany({
        orderBy: { createdAt: 'asc' }
      });
      res.json(settings);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  },

  saveSettings: async (req, res) => {
    try {
      const payload = req.body.settings ? req.body.settings : [req.body];
      const settings = Array.isArray(payload) ? payload : [payload];
      const updated = [];

      for (const setting of settings) {
        if (!setting.module) continue;

        const dataToSave = {
          moduleName: setting.moduleName || setting.module,
          endpoint: setting.endpoint || '',
          httpMethod: setting.httpMethod || 'GET',
          authType: setting.authType || 'NONE',
          authUsername: setting.authUsername || null,
          authPassword: setting.authPassword || null,
          authToken: setting.authToken || null,
          apiKeyHeader: setting.apiKeyHeader || 'X-API-Key',
          customHeaders: setting.customHeaders || null,
          paginationType: setting.paginationType || 'OFFSET_LIMIT',
          dataPath: setting.dataPath || null,
          fieldMapping: setting.fieldMapping || null,
          scheduleType: setting.scheduleType || 'manual',
          syncType: setting.syncType || 'replace',
          isActive: setting.isActive !== undefined ? setting.isActive : true,
        };

        const result = await prisma.syncSetting.upsert({
          where: { module: setting.module },
          update: dataToSave,
          create: {
            module: setting.module,
            ...dataToSave
          }
        });
        updated.push(result);
      }
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to save settings' });
    }
  },

  deleteSetting: async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.syncSetting.delete({
        where: { id }
      });
      res.json({ message: 'Setting deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete setting' });
    }
  },

  getLogs: async (req, res) => {
    try {
      const { module } = req.query;
      const filter = module ? { module } : {};
      const logs = await prisma.syncLog.findMany({
        where: filter,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      res.json(logs);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  },

  runSync: async (req, res) => {
    const { module } = req.body;

    if (activeSyncs.has(module) && activeSyncs.get(module).status === 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Sync already in progress for this module' });
    }

    try {
      const setting = await prisma.syncSetting.findUnique({
        where: { module },
      });

      if (!setting) {
        return res.status(404).json({ error: 'Settings not found for this module' });
      }

      runSyncProcess(setting, 'MANUAL');
      res.json({ message: 'Sync started' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to start sync' });
    }
  },

  // Inbound Webhook: external ERP pushes data directly to chataudit
  receivePush: async (req, res) => {
    const { module } = req.params;
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];

    // Verify module configuration
    const setting = await prisma.syncSetting.findUnique({ where: { module } });
    if (!setting) {
      return res.status(404).json({ error: `Sync setting for module '${module}' not found` });
    }

    // Optional API key validation
    if (setting.authToken) {
      const token = apiKey?.startsWith('Bearer ') ? apiKey.slice(7) : apiKey;
      if (token !== setting.authToken) {
        return res.status(401).json({ error: 'Unauthorized push token' });
      }
    }

    const payload = req.body;
    const items = extractItemsFromData(payload, setting.dataPath);

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No data items found in payload' });
    }

    try {
      await saveItemsToDatabase(module, items, setting);
      await prisma.syncLog.create({
        data: {
          module,
          method: 'INBOUND_PUSH',
          status: 'SUCCESS',
          syncedRows: items.length
        }
      });
      res.json({ message: `Successfully pushed ${items.length} records to module '${module}'` });
    } catch (err) {
      console.error(`[Inbound Push Error] ${module}:`, err);
      await prisma.syncLog.create({
        data: {
          module,
          method: 'INBOUND_PUSH',
          status: 'FAILED',
          syncedRows: 0,
          errorMessage: err.message
        }
      });
      res.status(500).json({ error: err.message });
    }
  }
};

// Database persistence per module / generic datasets
async function saveItemsToDatabase(module, rawItems, setting) {
  const mapping = setting.fieldMapping || {};
  const items = rawItems.map(item => applyFieldMapping(item, mapping));

  if (setting.syncType === 'replace') {
    if (module === 'outstandingar') {
      await prisma.outstandingAr.deleteMany({});
    } else if (module === 'analisacreditlimit') {
      await prisma.analisaCreditLimit.deleteMany({});
    } else if (module === 'customers') {
      await prisma.customer.deleteMany({});
    } else if (module === 'daftarhargabarang') {
      await prisma.daftarHargaBarang.deleteMany({});
    } else if (module === 'rasiopiutangpersales') {
      await prisma.rasioPiutangPerSales.deleteMany({});
    } else if (module === 'checkorderableitems' || module === 'orderableitems') {
      await prisma.orderableItem.deleteMany({});
    } else if (module === 'daily-deliveries') {
      await prisma.dailyDelivery.deleteMany({});
    } else if (module === 'sales-coverages') {
      await prisma.salesCoverage.deleteMany({});
    } else if (module === 'saleable-items') {
      await prisma.saleableItem.deleteMany({});
    }
  }

  // 1. OUTSTANDING AR
  if (module === 'outstandingar') {
    const mappedItems = items.map(item => ({
      tglpfi: item.tglpfi ? new Date(item.tglpfi) : null,
      nopfi: String(item.nopfi || item.invoice_number || item.invoiceNumber || item.no_faktur || ''),
      kdsls: item.kdsls !== null && item.kdsls !== undefined ? String(item.kdsls) : null,
      nmsls: item.nmsls || item.sales_name || null,
      kdcust: item.kdcust !== null && item.kdcust !== undefined ? String(item.kdcust) : null,
      nmcust: item.nmcust || item.customer_name || null,
      amount: item.amount !== undefined ? Number(item.amount) : null,
      paid: item.paid !== undefined ? Number(item.paid) : null,
      balance: item.balance !== undefined ? Number(item.balance) : null,
      pdc: item.pdc !== null && item.pdc !== undefined ? String(item.pdc) : null,
      topid: item.topid !== null && item.topid !== undefined ? Number(item.topid) : null,
      duedate: item.duedate ? new Date(item.duedate) : null,
      metadata: item
    })).filter(x => x.nopfi);

    if (setting.syncType === 'replace') {
      await prisma.outstandingAr.createMany({ data: mappedItems, skipDuplicates: true });
    } else {
      for (const chunk of chunkArray(mappedItems, 500)) {
        await prisma.$transaction(
          chunk.map(item => prisma.outstandingAr.upsert({
            where: { nopfi: item.nopfi },
            update: item,
            create: item
          }))
        );
      }
    }
    return mappedItems.length;
  }

  // 2. CUSTOMERS
  if (module === 'customers') {
    const mappedItems = items.map(item => ({
      kdcust: String(item.kdcust || item.customer_code || item.code || ''),
      nmcust: item.nmcust || item.name || item.customer_name || null,
      alamat: item.alamat || item.address || null,
      kontak: item.kontak || item.contact_person || null,
      phone: item.phone || item.no_hp || item.telephone || null,
      status: item.status || 'ACTIVE',
      first_sales: item.first_sales ? new Date(item.first_sales) : null,
      npwp: item.npwp || null,
      tax_name: item.tax_name || null,
      tax_address: item.tax_address || null,
      nik: item.nik ? String(item.nik) : null,
      latitude: item.latitude !== undefined && item.latitude !== null ? Number(item.latitude) : null,
      longitude: item.longitude !== undefined && item.longitude !== null ? Number(item.longitude) : null,
      customFields: item
    })).filter(x => x.kdcust);

    if (setting.syncType === 'replace') {
      await prisma.customer.createMany({ data: mappedItems, skipDuplicates: true });
    } else {
      for (const chunk of chunkArray(mappedItems, 500)) {
        await prisma.$transaction(
          chunk.map(item => prisma.customer.upsert({
            where: { kdcust: item.kdcust },
            update: item,
            create: item
          }))
        );
      }
    }
    return mappedItems.length;
  }

  // 3. DAFTAR HARGA BARANG / PRODUCT CATALOG
  if (module === 'daftarhargabarang' || module === 'products') {
    const mappedItems = items.map(item => ({
      kdbrg: String(item.kdbrg || item.product_code || item.item_code || item.code || ''),
      nmbrg: item.nmbrg || item.name || item.product_name || null,
      pack_size: item.pack_size || null,
      composite_desc: item.composite_desc || null,
      kdprinsip: item.kdprinsip || null,
      principal_name1: item.principal_name1 || null,
      nmsup: item.nmsup || null,
      kpc1: item.kpc1 !== undefined ? Number(item.kpc1) : null,
      kpc2: item.kpc2 !== undefined ? Number(item.kpc2) : null,
      kpc3: item.kpc3 !== undefined ? Number(item.kpc3) : null,
      kpc4: item.kpc4 !== undefined ? Number(item.kpc4) : null,
      konversi1: item.konversi1 !== undefined ? Number(item.konversi1) : null,
      konversi2: item.konversi2 !== undefined ? Number(item.konversi2) : null,
      konversi3: item.konversi3 !== undefined ? Number(item.konversi3) : null,
      konversi4: item.konversi4 !== undefined ? Number(item.konversi4) : null,
      qtypcs: item.qtypcs !== undefined ? Number(item.qtypcs) : null,
      uom1: item.uom1 || item.unit || null,
      uom2: item.uom2 || null,
      uom3: item.uom3 || null,
      uom4: item.uom4 || null,
      lev: item.lev || null,
      nmkat: item.nmkat || item.category || null,
      nmsubkat: item.nmsubkat || null,
      brand: item.brand || null,
      tags: item.tags || null,
      rbp1: item.rbp1 !== undefined ? Number(item.rbp1) : null,
      harga1: item.harga1 !== undefined ? Number(item.harga1) : (item.price !== undefined ? Number(item.price) : null),
      harga2: item.harga2 !== undefined ? Number(item.harga2) : null,
      harga3: item.harga3 !== undefined ? Number(item.harga3) : null,
      harga4: item.harga4 !== undefined ? Number(item.harga4) : null,
      metadata: item
    })).filter(x => x.kdbrg);

    if (setting.syncType === 'replace') {
      await prisma.daftarHargaBarang.createMany({ data: mappedItems, skipDuplicates: true });
    } else {
      for (const chunk of chunkArray(mappedItems, 500)) {
        await prisma.$transaction(
          chunk.map(item => prisma.daftarHargaBarang.upsert({
            where: { kdbrg: item.kdbrg },
            update: item,
            create: item
          }))
        );
      }
    }
    return mappedItems.length;
  }

  // 4. ANALISA CREDIT LIMIT
  if (module === 'analisacreditlimit') {
    const mappedItems = items.map(item => ({
      kunci: String(item.kunci || `${item.kdcust}_${item.kdsls || ''}`),
      kdcust: item.kdcust ? String(item.kdcust) : null,
      nmcust: item.nmcust || null,
      kdsls: item.kdsls ? String(item.kdsls) : null,
      nmsls: item.nmsls || null,
      old_cl: item.old_cl !== undefined ? Number(item.old_cl) : null,
      newcl: item.newcl !== undefined ? Number(item.newcl) : null,
      avgtrx: item.avgtrx !== undefined ? Number(item.avgtrx) : null,
      oi: item.oi !== undefined ? Number(item.oi) : null,
      pola_ontime: item.pola_ontime || null,
      pola_cicil: item.pola_cicil || null,
      kategori_ovd: item.kategori_ovd || null,
      kriteria_applied: item.kriteria_applied || null,
      status_toko: item.status_toko || null,
      channel: item.channel || null,
      jumpfi: item.jumpfi !== undefined ? Number(item.jumpfi) : null,
      bayar1x: item.bayar1x !== undefined ? Number(item.bayar1x) : null,
      bayar2x: item.bayar2x !== undefined ? Number(item.bayar2x) : null,
      bayar3x: item.bayar3x !== undefined ? Number(item.bayar3x) : null,
      bayar4x: item.bayar4x !== undefined ? Number(item.bayar4x) : null,
      ovdontime: item.ovdontime !== undefined ? Number(item.ovdontime) : null,
      ovd3n10: item.ovd3n10 !== undefined ? Number(item.ovd3n10) : null,
      ovd11n18: item.ovd11n18 !== undefined ? Number(item.ovd11n18) : null,
      ovd19n30: item.ovd19n30 !== undefined ? Number(item.ovd19n30) : null,
      ovdmt30: item.ovdmt30 !== undefined ? Number(item.ovdmt30) : null,
      blmbayar: item.blmbayar !== undefined ? Number(item.blmbayar) : null,
      baddebt: item.baddebt !== undefined ? Number(item.baddebt) : null,
      old_top: item.old_top !== undefined ? Number(item.old_top) : null,
      new_top: item.new_top ? String(item.new_top) : null,
      colovd: item.colovd ? String(item.colovd) : null,
      lasttrx: item.lasttrx ? new Date(item.lasttrx) : null,
      pola: item.pola || null,
      trgec: item.trgec !== undefined ? Number(item.trgec) : null,
      status: item.status || null,
      outlet_type: item.outlet_type || null
    })).filter(x => x.kunci);

    if (setting.syncType === 'replace') {
      await prisma.analisaCreditLimit.createMany({ data: mappedItems, skipDuplicates: true });
    } else {
      for (const chunk of chunkArray(mappedItems, 500)) {
        await prisma.$transaction(
          chunk.map(item => prisma.analisaCreditLimit.upsert({
            where: { kunci: item.kunci },
            update: item,
            create: item
          }))
        );
      }
    }
    return mappedItems.length;
  }

  // 5. RASIO PIUTANG PER SALES
  if (module === 'rasiopiutangpersales') {
    const mappedItems = items.map(item => ({
      tahun: item.tahun !== undefined ? Number(item.tahun) : null,
      bulan: item.bulan !== undefined ? Number(item.bulan) : null,
      periode: item.periode || null,
      jumlah_invoice: item.jumlah_invoice !== undefined ? Number(item.jumlah_invoice) : null,
      jumlah_customer: item.jumlah_customer !== undefined ? Number(item.jumlah_customer) : null,
      kode_sales: item.kode_sales ? String(item.kode_sales) : null,
      nama_sales: item.nama_sales || null,
      divisi: item.divisi || null,
      jumlah_piutang: item.jumlah_piutang !== undefined ? Number(item.jumlah_piutang) : null,
      jumlah_bayar: item.jumlah_bayar !== undefined ? Number(item.jumlah_bayar) : null,
      jumlah_sisa: item.jumlah_sisa !== undefined ? Number(item.jumlah_sisa) : null,
      rasio: item.rasio !== undefined ? Number(item.rasio) : null,
    }));
    await prisma.rasioPiutangPerSales.createMany({ data: mappedItems, skipDuplicates: true });
    return mappedItems.length;
  }

  // 6. DYNAMIC GENERIC DATASET (Fallback for ANY arbitrary company module!)
  let dataset = await prisma.customDataSet.findUnique({ where: { slug: module } });
  if (!dataset) {
    dataset = await prisma.customDataSet.create({
      data: {
        slug: module,
        name: setting.moduleName || module,
        description: `Auto-created dataset for module '${module}'`
      }
    });
  }

  if (setting.syncType === 'replace') {
    await prisma.customDataRow.deleteMany({ where: { datasetId: dataset.id } });
  }

  const rowData = items.map(item => ({
    datasetId: dataset.id,
    rowKey: String(item.id || item.code || item.kdcust || item.nopfi || item.key || ''),
    data: item
  }));

  for (const chunk of chunkArray(rowData, 1000)) {
    await prisma.customDataRow.createMany({ data: chunk });
  }

  return rowData.length;
}

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// Core sync worker (called by scheduler or manual trigger)
async function runSyncProcess(setting, method) {
  const module = setting.module;

  if (activeSyncs.has(module) && activeSyncs.get(module).status === 'IN_PROGRESS') {
    console.log(`[Sync] Module ${module} sync is already IN_PROGRESS. Skipping.`);
    return;
  }

  updateProgress(module, { status: 'IN_PROGRESS', progress: 0, total: 0, message: 'Starting...' });

  const logEntry = await prisma.syncLog.create({
    data: {
      module,
      method,
      status: 'IN_PROGRESS',
      syncedRows: 0
    }
  });

  await prisma.syncSetting.update({
    where: { id: setting.id },
    data: { lastSyncAt: new Date() }
  });

  try {
    const { headers, auth } = buildAxiosConfig(setting);
    let hasMore = true;
    let offset = 0;
    let page = 1;
    const limit = 2000;
    let totalSynced = 0;

    // Outbound contacts push support
    if (setting.syncType === 'push' && module === 'contacts_push') {
      const totalContacts = await prisma.contact.count();
      updateProgress(module, { message: 'Pushing contacts...', total: totalContacts });

      let pushed = 0;
      const pushLimit = 100;
      while (pushed < totalContacts) {
        const contacts = await prisma.contact.findMany({ skip: pushed, take: pushLimit });
        const mapped = contacts.map(c => ({
          id: c.id,
          whatsapp_id: c.whatsappId,
          phone_number: c.phoneNumber,
          name: c.name,
          persona_id: c.personaId,
          kode_customer: c.kodeCustomer,
          kode_sales: c.kodeSales,
          is_allowed: c.isAllowed ? 'true' : 'false'
        }));

        for (let i = 0; i < mapped.length; i += 10) {
          const batch = mapped.slice(i, i + 10);
          await Promise.all(batch.map(payload =>
            axios.post(setting.endpoint, payload, { auth, headers, timeout: 30000 }).catch(e => {
              console.error(`Failed to push contact ${payload.id}:`, e.message);
            })
          ));
        }

        pushed += mapped.length;
        totalSynced = pushed;
        updateProgress(module, { progress: totalSynced, message: `Pushed ${totalSynced}/${totalContacts}` });
      }
      hasMore = false;
    }

    // Pull from external API
    while (hasMore && setting.syncType !== 'push') {
      updateProgress(module, { message: `Fetching data (offset: ${offset}, page: ${page})...` });

      const url = new URL(setting.endpoint);
      const paginationType = setting.paginationType || 'OFFSET_LIMIT';

      if (paginationType === 'OFFSET_LIMIT') {
        url.searchParams.set('offset', offset);
        url.searchParams.set('limit', limit);
      } else if (paginationType === 'PAGE_NUMBER') {
        url.searchParams.set('page', page);
        url.searchParams.set('pageSize', limit);
      }

      let response;
      let retries = 3;
      while (retries > 0) {
        try {
          const reqConfig = {
            auth,
            headers,
            timeout: 120000
          };
          if ((setting.httpMethod || 'GET').toUpperCase() === 'POST') {
            response = await axios.post(url.toString(), {}, reqConfig);
          } else {
            response = await axios.get(url.toString(), reqConfig);
          }
          break;
        } catch (fetchErr) {
          retries--;
          console.warn(`[SYNC RETRY] Error fetching ${module}: ${fetchErr.message}. Retries left: ${retries}`);
          if (retries === 0) throw fetchErr;
          await new Promise(res => setTimeout(res, 3000));
        }
      }

      const data = response.data;
      const items = extractItemsFromData(data, setting.dataPath);

      updateProgress(module, {
        message: `Saving data (batch size: ${items.length})...`,
        total: data.count || data.total || (totalSynced + items.length)
      });

      if (items.length > 0) {
        const savedCount = await saveItemsToDatabase(module, items, setting);
        totalSynced += (savedCount || items.length);
        updateProgress(module, { progress: totalSynced, message: `Synced ${totalSynced} items` });
      }

      if (paginationType === 'NONE' || items.length === 0) {
        hasMore = false;
      } else if (paginationType === 'OFFSET_LIMIT') {
        hasMore = (data.hasMore === true || items.length === limit);
        offset += (data.limit || limit);
      } else if (paginationType === 'PAGE_NUMBER') {
        hasMore = items.length === limit;
        page++;
      }
    }

    // Mark as SUCCESS
    await prisma.syncLog.update({
      where: { id: logEntry.id },
      data: {
        status: 'SUCCESS',
        syncedRows: totalSynced
      }
    });

    await prisma.syncSetting.update({
      where: { id: setting.id },
      data: { lastSyncAt: new Date() }
    });

    updateProgress(module, { status: 'SUCCESS', progress: totalSynced, message: 'Sync complete' });

  } catch (error) {
    console.error(`Sync Error (${module}):`, error);

    await prisma.syncLog.update({
      where: { id: logEntry.id },
      data: {
        status: 'FAILED',
        errorMessage: error.message
      }
    });

    updateProgress(module, { status: 'FAILED', message: error.message });
  }
}

module.exports = { ...syncController, runSyncProcess };
