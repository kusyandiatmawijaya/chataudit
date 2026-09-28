const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'broadcast_media');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

router.get('/', templateController.getTemplates);
router.get('/:id', templateController.getTemplateById);
router.get('/:id/dashboard', templateController.getTemplateDashboard);
router.get('/:id/history', templateController.getTemplateHistory);
router.post('/', upload.single('mediaFile'), templateController.createTemplate);
router.put('/:id', upload.single('mediaFile'), templateController.updateTemplate);
router.delete('/:id', templateController.deleteTemplate);

module.exports = router;
