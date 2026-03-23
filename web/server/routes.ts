import { Router, type Response } from 'express';
import type { Pipeline } from '../../src/pipeline/index.js';
import {
  InputValidationError,
  LLMApiError,
  GenerationError,
  TemplateValidationError,
  CONSTRAINTS,
} from '../../src/types/errors.js';

function encodeZipBase64(zipArchive: Uint8Array): string {
  return Buffer.from(zipArchive).toString('base64');
}

function validateDesignInfoShape(obj: unknown): obj is Record<string, unknown> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.appInfo === 'object' && o.appInfo !== null &&
    Array.isArray(o.components) &&
    Array.isArray(o.relations) &&
    Array.isArray(o.automations) &&
    typeof o.layout === 'object' && o.layout !== null
  );
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
      if (input.length > CONSTRAINTS.MAX_INPUT_LENGTH) {
        res.status(400).json({ error: `入力は${CONSTRAINTS.MAX_INPUT_LENGTH}文字以内にしてください` });
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
      if (typeof originalInput !== 'string' || !originalInput) {
        res.status(400).json({ error: 'originalInput が必要です' });
        return;
      }
      if (typeof instruction !== 'string' || !instruction) {
        res.status(400).json({ error: 'instruction が必要です' });
        return;
      }
      if (!validateDesignInfoShape(existing)) {
        res.status(400).json({ error: 'existing の形式が不正です' });
        return;
      }
      if (instruction.length > CONSTRAINTS.MAX_INPUT_LENGTH) {
        res.status(400).json({ error: `指示は${CONSTRAINTS.MAX_INPUT_LENGTH}文字以内にしてください` });
        return;
      }

      const result = await pipeline.regenerate(originalInput, instruction, existing as any);
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

function handleError(err: unknown, res: Response): void {
  if (err instanceof InputValidationError) {
    res.status(400).json({ error: err.message });
  } else if (err instanceof TemplateValidationError) {
    res.status(400).json({ error: `テンプレート検証エラー: ${err.message}` });
  } else if (err instanceof GenerationError) {
    console.error('Generation Error:', err.message);
    res.status(500).json({ error: '生成処理でエラーが発生しました。入力を変えてお試しください。' });
  } else if (err instanceof LLMApiError) {
    console.error('LLM API Error:', err.message);
    res.status(500).json({ error: 'AI APIでエラーが発生しました。しばらく経ってからお試しください。' });
  } else {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: '予期しないエラーが発生しました' });
  }
}
