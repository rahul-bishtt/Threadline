// TODO:
// Maintain an in-memory dictionary of background scraping jobs.
// Implement methods to:
//   - createJob(jobId) -> initializes a new job state with status 'pending'
//   - updateJob(jobId, updates) -> merges details like status (pending/running/done/failed), error logs
//   - getJob(jobId) -> retrieves the job status by its ID

const jobs = new Map();

function createJob(jobId) {
  const job = {
    jobId,
    status: 'pending',
    startedAt: new Date(),
    finishedAt: null,
    error: null,
  };
  jobs.set(jobId, job);
  return job;
}

function updateJob(jobId, updates) {
  const job = jobs.get(jobId);
  if (!job) return null;
  
  const updatedJob = { ...job, ...updates };
  jobs.set(jobId, updatedJob);
  return updatedJob;
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

module.exports = {
  createJob,
  updateJob,
  getJob,
};
