const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const biRaportController = require('../controllers/biRaportController');

const router = express.Router();

router.use(authenticateToken);

// 1. GET /api/bi-raport - List
router.get('/', biRaportController.getReports);

// 2. GET /api/bi-raport/heatmap
router.get('/heatmap', biRaportController.getHeatmap);

// 3. GET /api/bi-raport/salesmen
router.get('/salesmen', biRaportController.getSalesmen);

// 4. GET /api/bi-raport/customers
router.get('/customers', biRaportController.getCustomers);

// 5. GET /api/bi-raport/:id - Detail
router.get('/:id', biRaportController.getDetail);

// 6. POST /api/bi-raport/generate - Generate
router.post('/generate', biRaportController.generateReport);

// 7. DELETE /api/bi-raport/:id
router.delete('/:id', biRaportController.deleteReport);

module.exports = router;
