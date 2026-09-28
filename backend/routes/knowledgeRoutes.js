const express = require('express');
const router = express.Router();
const multer = require('multer');
const knowledgeController = require('../controllers/knowledgeController');

// Configure multer for temp storage
const upload = multer({ dest: 'uploads/temp/' });

router.post('/upload', upload.single('file'), knowledgeController.uploadKnowledge);
router.get('/', knowledgeController.getKnowledgeBase);
router.delete('/:id', knowledgeController.deleteKnowledge);

module.exports = router;
