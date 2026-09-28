const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

// Konfigurasi Multer untuk upload gambar
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      const uploadDir = path.join(__dirname, '../uploads/promos');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } catch (err) {
      console.error('[Multer] Error creating directory:', err);
      cb(err, null);
    }
  },
  filename: function (req, file, cb) {
    cb(null, 'promo-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diperbolehkan!'), false);
    }
  }
});

// GET /api/promos - Ambil semua promo
router.get('/', async (req, res) => {
  try {
    const promos = await prisma.promo.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(promos);
  } catch (error) {
    console.error('[Promos API] Error fetching promos:', error);
    res.status(500).json({ error: 'Gagal mengambil data promo' });
  }
});

// POST /api/promos - Tambah promo baru
router.post('/', upload.single('image'), async (req, res) => {
  console.log('[Promos API] Incoming POST request:', req.body, req.file ? req.file.originalname : 'No file');
  try {
    const { title, description, keywords, startDate, endDate, isActive } = req.body;
    
    if (!title || !description || !keywords || !startDate || !endDate) {
      return res.status(400).json({ error: 'Semua field harus diisi' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Gambar promo harus diunggah' });
    }

    const imageUrl = `/uploads/promos/${req.file.filename}`;

    const promo = await prisma.promo.create({
      data: {
        title,
        description,
        keywords,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive === 'true' || isActive === true,
        imageUrl
      }
    });

    res.status(201).json(promo);
  } catch (error) {
    console.error('[Promos API] Error creating promo:', error);
    res.status(500).json({ error: 'Gagal membuat promo baru' });
  }
});

// DELETE /api/promos/:id - Hapus promo
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Cari promo untuk hapus file gambarnya
    const promo = await prisma.promo.findUnique({ where: { id } });
    if (promo) {
      const filePath = path.join(__dirname, '..', promo.imageUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.promo.delete({ where: { id } });
    res.json({ success: true, message: 'Promo berhasil dihapus' });
  } catch (error) {
    console.error('[Promos API] Error deleting promo:', error);
    res.status(500).json({ error: 'Gagal menghapus promo' });
  }
});

// PUT /api/promos/:id - Update promo
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, keywords, startDate, endDate, isActive } = req.body;
    
    if (!title || !description || !keywords || !startDate || !endDate) {
      return res.status(400).json({ error: 'Semua field harus diisi' });
    }

    const updateData = {
      title,
      description,
      keywords,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: isActive === 'true' || isActive === true,
    };

    if (req.file) {
      // Jika upload gambar baru, ambil path lamanya untuk dihapus (opsional, tapi disarankan)
      const oldPromo = await prisma.promo.findUnique({ where: { id } });
      if (oldPromo && oldPromo.imageUrl) {
        const oldPath = path.join(__dirname, '..', oldPromo.imageUrl);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      updateData.imageUrl = `/uploads/promos/${req.file.filename}`;
    }

    const updatedPromo = await prisma.promo.update({
      where: { id },
      data: updateData
    });

    res.json(updatedPromo);
  } catch (error) {
    console.error('[Promos API] Error updating promo:', error);
    res.status(500).json({ error: 'Gagal memperbarui promo' });
  }
});

module.exports = router;
