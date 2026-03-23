import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { Pipeline } from '../../src/pipeline/index.js';
import { createRoutes } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '3001', 10);

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY が .env に設定されていません');
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const pipeline = new Pipeline({ llmClient: client });

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use('/api', createRoutes(pipeline));

// Production: serve built client files
if (process.env.NODE_ENV === 'production') {
  const clientDir = path.resolve(__dirname, '../dist/client');
  app.use(express.static(clientDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { app };
