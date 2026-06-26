const express = require('express');
const queries = require('../db/queries');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const clusters = await queries.getAllClusters();

    // Filter out clusters with zero articles or invalid start times
    const activeClusters = clusters.filter(
      (c) => c.articleCount > 0 && c.startTime !== null
    );

    if (activeClusters.length === 0) {
      return res.json([]);
    }

    // Find the maximum articleCount for normalization
    const maxArticleCount = Math.max(
      ...activeClusters.map((c) => c.articleCount)
    );

    // Map each cluster to a timeline point with normalized intensity
    const timelineData = activeClusters.map((c) => {
      const intensity =
        maxArticleCount > 0
          ? parseFloat((c.articleCount / maxArticleCount).toFixed(4))
          : 0.0;
      return {
        id: c.id,
        label: c.label,
        startTime: c.startTime,
        endTime: c.endTime,
        articleCount: c.articleCount,
        intensity,
        sources: c.sources || [],
      };
    });

    // Sort chronologically by startTime ascending for timeline rendering
    timelineData.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    res.json(timelineData);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
