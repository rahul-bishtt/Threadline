// TODO:
// Implement lightweight checks for request inputs.
// If validating clusters/:id, verify ":id" parameter is a valid integer.
// Reject malformed queries with a 400 Bad Request and clean JSON details.

function validateClusterId(req, res, next) {
  const { id } = req.params;
  const parsedId = parseInt(id, 10);

  if (isNaN(parsedId)) {
    return res.status(400).json({
      error: 'Invalid cluster id. It must be an integer.',
    });
  }

  req.params.idVal = parsedId;
  next();
}

module.exports = {
  validateClusterId,
};
