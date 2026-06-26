const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const clustersRouter = require('./routes/clusters');
const timelineRouter = require('./routes/timeline');
const ingestRouter = require('./routes/ingest');

// Load environment configurations
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// TODO:
// Mount API route paths correctly mapping endpoints to routers.
// Ensure rate limiting or authentication hooks can be placed here in the future.
app.use('/clusters', clustersRouter);
app.use('/timeline', timelineRouter);
app.use('/ingest', ingestRouter);

// Root verification endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'News Pulse Backend' });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});

module.exports = server; // Exported for verification purposes
