const NodeCache = require('node-cache');

const cache = new NodeCache({
  stdTTL: 6 * 60 * 60,
  checkperiod: 120,
});

module.exports = cache;
