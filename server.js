import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rateLimit } from 'express-rate-limit';

import { config } from './src/config.js';
import ingestRoutes from './routes/ingest.js';
import chatRoutes from './routes/chat.js';
import { getIndexStats } from './src/vectorstore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// --- Core middleware ---
app.use(cors({ origin: config.corsOrigin === '*' ? '*' : config.corsOrigin.split(',') }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Basic abuse protection — tune to taste for your traffic.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Optional shared-secret auth for the API. Set APP_API_KEY in .env to enable.
// Requests must send header: x-api-key: <APP_API_KEY>
app.use('/api/', (req, res, next) => {
  if (!config.appApiKey) return next(); // auth disabled
  const key = req.header('x-api-key');
  if (key !== config.appApiKey) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid x-api-key header.' });
  }
  next();
});

// --- Routes ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getIndexStats();
    res.json({ success: true, stats });
  } catch (err) {
    console.error('[stats] error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch index stats.' });
  }
});

app.use('/api/ingest', ingestRoutes);
app.use('/api/chat', chatRoutes);

// --- Static frontend (simple test UI) ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Error handling ---
app.use((err, req, res, next) => {
  console.error('[unhandled error]', err);
  if (err.type === 'entity.too.large' || err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Payload too large.' });
  }
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(config.port, () => {
  console.log(`RAG server listening on port ${config.port} (${config.nodeEnv})`);
});
