const express = require('express');
const router = express.Router();

// TODO:
// Implement GET / endpoint.
//   - Execute group operations over active clusters.
//   - Calculate normalized intensity based on largest cluster article volume.
//   - Return 200 OK with timeline points array.

router.get('/', (req, res, next) => {
  try {
    // Placeholder response
    res.json([
      {
        id: 1,
        label: 'senate election bill',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        articleCount: 1,
        intensity: 1.0,
      },
    ]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
