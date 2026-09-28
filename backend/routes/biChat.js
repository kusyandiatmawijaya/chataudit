const express = require('express');
const router = express.Router();
const biController = require('../controllers/biController');
const { authenticateToken } = require('../middleware/auth'); // assuming there's an auth middleware, adjust if needed

// Make sure it hits POST /api/bi-chat (so here the route is just /)
router.post('/', biController.handleBiChat);

module.exports = router;
