const express = require('express');
const router = express.Router();
const dbExplorerController = require('../controllers/dbExplorer.controller');
const dbExportController = require('../controllers/dbExport.controller');
const { authorizeRole } = require('../middleware/auth');

// Protected by strict DEVELOPER role constraint (acts as SuperAdmin here)
router.use(authorizeRole('DEVELOPER'));

// Introspection Routes
router.get('/schemas', dbExplorerController.getSchemas);
router.get('/tables/:tableName/structure', dbExplorerController.getTableStructure);
router.get('/indexes', dbExplorerController.getIndexes);

// Execution Route
router.post('/query', dbExplorerController.executeQuery);

// Export Routes
router.post('/export', dbExportController.exportQuery);
router.get('/export-schema', dbExportController.exportSchema);

// AI Copilot Routes
const dbCopilotController = require('../controllers/dbCopilot.controller');
router.post('/copilot/generate', dbCopilotController.generateSql);
router.post('/copilot/explain', dbCopilotController.explainSql);

module.exports = router;
