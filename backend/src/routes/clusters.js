const express = require('express');
const { validateClusterId } = require('../middleware/validate');
const router = express.Router();

// TODO:
// Implement GET / endpoint.
//   - Query Postgres for all clusters containing start, end timestamps and member article count.
//   - Return 200 OK with the array of cluster structures.
// Implement GET /:id endpoint.
//   - Check cluster availability in database.
//   - Return 404 Not Found if missing, or 200 OK with the detail mapping.

router.get('/', (req, res, next) => {
  try {
    // Placeholder response
    res.json([
      {
        id: 1,
        label: 'senate election bill',
        articleCount: 1,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
      },
    ]);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', validateClusterId, (req, res, next) => {
  try {
    const { idVal } = req.params;
    
    // Placeholder checking logic
    if (idVal !== 1) {
      return res.status(404).json({ error: 'Cluster not found' });
    }

    res.json({
      id: 1,
      label: 'senate election bill',
      articles: [
        {
          id: 101,
          source: 'BBC',
          title: 'Senate advances election bill',
          url: 'https://www.bbc.com/news/example',
          publishedAt: new Date().toISOString(),
        },
      ],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
