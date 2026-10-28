const axios = require('axios');
const config = require('../config');

const client = axios.create({
  baseURL: config.icefileBaseUrl,
  timeout: config.requestTimeout,
  headers: {
    Accept: 'application/json',
    ...(config.icefileApiKey ? { Authorization: `Bearer ${config.icefileApiKey}` } : {}),
  },
});

const getMediaByFileId = async (fileId) => {
  const response = await client.get(`/${encodeURIComponent(fileId)}`);
  return response.data;
};

module.exports = {
  getMediaByFileId,
};
