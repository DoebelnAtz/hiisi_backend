const express = require('express');
const searchControllers = require('../controllers/search-controllers');
const router = express.Router();

router.get('/', searchControllers.searchAll);

module.exports = router;
