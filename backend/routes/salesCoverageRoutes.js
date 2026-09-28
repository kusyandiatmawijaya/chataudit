const express = require('express');
const router = express.Router();
const salesCoverageController = require('../controllers/salesCoverageController');

router.get('/', salesCoverageController.getCoverages);
router.get('/salesmen', salesCoverageController.getSalesmen);

module.exports = router;
