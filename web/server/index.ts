import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { Pipeline } from '../../src/pipeline/index.js';
import { createRoutes } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '3001', 10);
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3001',
];

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY が .env に設定されていません');
  process.exit(1);
}

const client = new Anthropic({ apiKey });
const pipeline = new Pipeline({ llmClient: client });

const app = express();
app.use(express.json({ limit: '1mb' }));

// CORS: 許可オリジンのみ受け付ける
app.use(cors({ origin: ALLOWED_ORIGINS }));

// レート制限: 1分あたり10リクエストまで（LLM API呼び出しのコスト保護）
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'リクエストが多すぎます。しばらく経ってからお試しください。' },
});
app.use('/api', apiLimiter);

app.use('/api', createRoutes(pipeline));

// Production: serve built client files
if (process.env.NODE_ENV === 'production') {
  const clientDir = path.resolve(__dirname, '../dist/client');
  app.use(express.static(clientDir));
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { app };
