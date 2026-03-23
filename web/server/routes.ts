import { Router } from 'express';
import type { Pipeline } from '../../src/pipeline/index.js';
import type { DesignInfo } from '../../src/types/index.js';
import { InputValidationError, LLMApiError } from '../../src/types/errors.js';

function encodeZipBase64(zipArchive: Uint8Array): string {
  return Buffer.from(zipArchive).toString('base64');
}

export function createRoutes(pipeline: Pipeline): Router {
  const router = Router();

  router.post('/generate', async (req, res) => {
    try {
      const { input } = req.body;
      if (!input || typeof input !== 'string') {
        res.status(400).json({ error: '要件を入力してください' });
        return;
      }

      const result = await pipeline.run(input);
      res.json({
        design: result.design,
        designDocument: result.designDocument,
        guiGuide: result.guiGuide,
        validation: result.validation,
        zipBase64: encodeZipBase64(result.zipArchive),
      });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post('/regenerate', async (req, res) => {
    try {
      const { originalInput, instruction, existing } = req.body;
      if (!originalInput || !instruction || !existing) {
        res.status(400).json({ error: 'originalInput, instruction, existing が必要です' });
        return;
      }

      const result = await pipeline.regenerate(
        originalInput as string,
        instruction as string,
        existing as DesignInfo,
      );
      res.json({
        regenerateResult: result.regenerateResult,
        designDocument: result.designDocument,
        guiGuide: result.guiGuide,
        validation: result.validation,
        zipBase64: encodeZipBase64(result.zipArchive),
      });
    } catch (err) {
      handleError(err, res);
    }
  });

  return router;
}

function handleError(err: unknown, res: any): void {
  if (err instanceof InputValidationError) {
    res.status(400).json({ error: err.message });
  } else if (err instanceof LLMApiError) {
    console.error('LLM API Error:', err.message);
    res.status(500).json({ error: 'AI APIでエラーが発生しました。しばらく経ってからお試しください。' });
  } else {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: '予期しないエラーが発生しました' });
  }
}
