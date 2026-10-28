const { param } = require('express-validator');

module.exports.validateFileId = [
  param('fileId')
    .trim()
    .notEmpty()
    .withMessage('fileId diperlukan')
    .isLength({ min: 1, max: 100 })
    .withMessage('fileId terlalu panjang'),
];
