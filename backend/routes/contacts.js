const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

router.get('/', contactController.getAllContacts);
router.put('/:id', contactController.updateContactPersona);
router.delete('/:id', contactController.deleteContact);

module.exports = router;
