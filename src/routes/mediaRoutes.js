const express = require('express');
const router = express.Router();
const { validateFileId } = require('../middleware/validateMedia');
const { getMedia } = require('../controllers/mediaController');

router.get(
  '/media/:fileId',
  validateFileId,
  getMedia
);

module.exports = router;
