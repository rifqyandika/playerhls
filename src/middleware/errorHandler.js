module.exports = (err, req, res, next) => {
  const statusCode = err.response ? err.response.status : 500;
  const message = err.response
    ? err.response.data?.message || err.message
    : err.message;

  const isClientError = statusCode >= 400 && statusCode < 500;
  const finalStatus = isClientError ? statusCode : 502;

  const errorBody = {
    success: false,
    error: {
      code: finalStatus,
      message,
    },
  };

  if (config.nodeEnv === 'development' && err.stack) {
    errorBody.error.stack = err.stack;
  }

  return res.status(finalStatus).json(errorBody);
};

const config = require('../config');
