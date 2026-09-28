const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const raportController = require('../controllers/raportController');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// 1. GET /api/raport - List summary
router.get('/', raportController.getRaports);

// 2. GET /api/raport/heatmap - Data for heatmap calendar
router.get('/heatmap', raportController.getHeatmap);

// 3. GET /api/raport/:id - Detail
router.get('/:id', raportController.getDetail);

// 4. GET /api/raport/:id/pdf - Download PDF
router.get('/:id/pdf', raportController.downloadPdf);

// 5. POST /api/raport/generate - Manual Trigger Generate
router.post('/generate', raportController.generateRaport);

// 6. DELETE /api/raport/:id
router.delete('/:id', raportController.deleteRaport);

module.exports = router;
