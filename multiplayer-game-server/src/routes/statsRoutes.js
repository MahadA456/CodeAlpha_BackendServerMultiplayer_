// src/routes/statsRoutes.js
const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

router.get('/player/:id', statsController.getPlayerStats);

module.exports = router;
