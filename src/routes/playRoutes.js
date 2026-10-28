const express = require('express');
const router = express.Router();
const { getPlay } = require('../controllers/playController');

router.get('/play/:driveId', getPlay);

module.exports = router;
