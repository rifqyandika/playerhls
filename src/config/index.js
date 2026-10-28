require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  icefileBaseUrl: process.env.ICEFILE_BASE_URL || '',
  icefileApiKey: process.env.ICEFILE_API_KEY || '',
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT, 10) || 30000,
  nodeEnv: process.env.NODE_ENV || 'development',
};
