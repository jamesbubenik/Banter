const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

['agents', 'data', 'logs'].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

app.use('/api/config',  require('./src/routes/config'));
app.use('/api/agents',  require('./src/routes/agents'));
app.use('/api/discussion', require('./src/routes/discussion'));
app.use('/api/creator', require('./src/routes/creator'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const logger = require('./src/services/logger');

// Handle payload-too-large before it surfaces as HTML to the client
app.use((err, req, res, next) => {
  if (err.status === 413 || err.type === 'entity.too.large') {
    logger.error(`PayloadTooLargeError on ${req.method} ${req.path}`);
    return res.status(413).json({ error: 'PayloadTooLargeError', code: 'PAYLOAD_TOO_LARGE' });
  }
  logger.error(`Unhandled error on ${req.method} ${req.path}: ${err.message}`);
  res.status(err.status || 500).json({ error: err.message });
});

app.listen(PORT, () => {
  logger.info(`Banter started on http://localhost:${PORT}`);
  console.log(`Banter running at http://localhost:${PORT}`);
});
