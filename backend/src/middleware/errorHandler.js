// TODO:
// Intercept all unhandled Express errors.
// Format responses to match the API contract: { error: <message> }.
// Return appropriate HTTP status codes (e.g. 500 for internal errors, 400/404 based on error context).

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
  });
}

module.exports = errorHandler;
