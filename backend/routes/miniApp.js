// backend/routes/miniApp.js
const express = require('express');
const router  = express.Router();
const path    = require('path');
const multer  = require('multer');
const { validateTelegramWebApp } = require('../middleware/telegramWebApp');
const {
  getConfig,
  getSession,
  searchDeliveries,
  searchProducts,
  submitRetur,
  getTodayReturns,
  getReturnDetails,
  submitReturnItems,
  printReturn,
  finishReturn,
  softDeleteReturn,
  getSalesCoverage,
  getReturnsForRole,
  approveReturnApi,
  rejectReturnApi,
  getReturnReceipt,
  updateReturnInvoice,
  updateReturnType,
  syncReturnApi,
  syncAllReturnsApi
} = require('../controllers/miniAppController');

// Multer setup for photo uploads
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `retur_${Date.now()}${ext}`);
  },
});
const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Hanya file gambar yang diizinkan'), false);
  },
});

// Config: no auth needed
router.get('/config', getConfig);

// Photo upload — validated by Telegram initData
router.post('/uploads/photo', validateTelegramWebApp, uploadPhoto.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// All other routes require valid Telegram initData
router.use(validateTelegramWebApp);

router.get('/session',              getSession);
router.get('/coverage',             getSalesCoverage);
router.get('/deliveries/search',    searchDeliveries);
router.get('/products/search',      searchProducts);
router.post('/retur/submit',        submitRetur);

// New detail input flow
router.get('/retur/today',          getTodayReturns);
router.get('/retur/role',           getReturnsForRole);
router.get('/retur/:id',            getReturnDetails);
router.get('/retur/:id/receipt',    getReturnReceipt);
router.post('/retur/:id/items',     submitReturnItems);
router.post('/retur/:id/invoice',   updateReturnInvoice);
router.post('/retur/:id/type',      updateReturnType);
router.post('/retur/:id/approve',   approveReturnApi);
router.post('/retur/:id/reject',    rejectReturnApi);
router.post('/retur/:id/print',     printReturn);
router.post('/retur/:id/sync',      syncReturnApi);
router.post('/retur/sync-all',      syncAllReturnsApi);

router.post('/retur/:id/finish', validateTelegramWebApp, finishReturn);
router.delete('/retur/:id', validateTelegramWebApp, softDeleteReturn);

module.exports = router;
