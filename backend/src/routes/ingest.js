const express = require('express');
const { createJob, getJob } = require('../jobs/jobStore');
const router = express.Router();

// TODO:
// Implement POST /trigger endpoint.
//   - Generate unique jobId and record status as 'pending' in jobStore.
//   - Spawn python child_process executing: [PYTHON_EXECUTABLE] [SCRAPER_PATH] --mode=incremental
//   - Handle stdout/stderr lines, update job status to 'running' and finally 'done' or 'failed'.
//   - Return 202 Accepted with the generated { jobId, status: 'pending' }.
// Implement GET /status/:jobId endpoint.
//   - Search jobStore for requested jobId.
//   - Return 404 Not Found if missing, or 200 OK with the full tracking metadata.

router.post('/trigger', (req, res, next) => {
  try {
    const jobId = Math.random().toString(36).substring(2, 8);
    const job = createJob(jobId);
    
    // In actual implementation, child_process will spawn the scraper here.
    // For scaffolding, we keep the job synchronous or state-placeholder.
    
    res.status(202).json({
      jobId: job.jobId,
      status: job.status,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
    });
  }

  res.json({
    jobId: job.jobId,
    status: job.status,
    error: job.error,
  });
});

module.exports = router;
