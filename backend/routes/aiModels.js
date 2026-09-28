const express = require('express');
const router = express.Router();
const aiModelsController = require('../controllers/aiModelsController');

router.get('/', aiModelsController.fetchActiveModels);
router.get('/all', aiModelsController.fetchAllModels);
router.patch('/toggle', aiModelsController.toggleModelStatus);
router.post('/sync', aiModelsController.syncModelsFromOpenRouter); // Optional, to trigger sync manually

module.exports = router;
