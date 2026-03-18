import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateInput } from '../../parser/index.js';
import { ERROR_MESSAGES, CONSTRAINTS, InputValidationError } from '../../types/errors.js';

// Feature: appsuite-template-generator, Property 1: 解析結果の構造完全性
// NOTE: LLM呼び出しを伴う構造完全性テストは統合テストで検証する。
//       ここではバリデーション通過後の入力が有効であることを検証する。
describe('プロパティ1: 解析結果の構造完全性（バリデーション通過）', () => {
  it('有効な入力テキストはバリデーションを通過する', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: CONSTRAINTS.MAX_INPUT_LENGTH }).filter(
          (s) => s.trim().length > 0,
        ),
        (validInput) => {
          expect(() => validateInput(validInput)).not.toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 2: 空白入力の拒否
describe('プロパティ2: 空白入力の拒否', () => {
  it('空白のみの入力はエラーを返す', () => {
    fc.assert(
      fc.property(
        fc.string().map((s) => {
          // 空白文字のみで構成される文字列を生成
          const whitespaceChars = [' ', '\t', '\n', '\r'];
          return Array.from(s)
            .map((_, i) => whitespaceChars[i % whitespaceChars.length])
            .join('');
        }),
        (whitespaceInput) => {
          try {
            validateInput(whitespaceInput);
            // 空文字列の場合もここに到達しないはず
            expect.unreachable('バリデーションエラーが発生するべき');
          } catch (error) {
            expect(error).toBeInstanceOf(InputValidationError);
            expect((error as InputValidationError).message).toBe(
              ERROR_MESSAGES.EMPTY_INPUT,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: appsuite-template-generator, Property 3: 文字数上限の強制
describe('プロパティ3: 文字数上限の強制', () => {
  it('5000文字を超える入力はエラーを返す', () => {
    fc.assert(
      fc.property(
        fc.string({
          minLength: CONSTRAINTS.MAX_INPUT_LENGTH + 1,
          maxLength: CONSTRAINTS.MAX_INPUT_LENGTH + 500,
        }),
        (longInput) => {
          try {
            validateInput(longInput);
            expect.unreachable('バリデーションエラーが発生するべき');
          } catch (error) {
            expect(error).toBeInstanceOf(InputValidationError);
            expect((error as InputValidationError).message).toBe(
              ERROR_MESSAGES.INPUT_TOO_LONG,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
