import { describe, it, expect, vi, afterEach } from 'vitest';
import { AudioInput, isSpeechRecognitionAvailable } from '../../audio/index.js';
import { ERROR_MESSAGES } from '../../types/errors.js';

// --- Web Speech API モック ---

function createMockRecognition(options: {
  results?: Array<{ transcript: string; confidence: number; isFinal: boolean }>;
  error?: string;
} = {}) {
  const mock: any = {
    lang: '',
    continuous: false,
    interimResults: false,
    onresult: null as any,
    onend: null as any,
    onerror: null as any,
    start: vi.fn().mockImplementation(() => {
      setTimeout(() => {
        if (options.error) {
          mock.onerror?.({ error: options.error });
          return;
        }

        if (options.results && options.results.length > 0) {
          const event = {
            resultIndex: 0,
            results: options.results.map((r) => {
              const res: any = {
                isFinal: r.isFinal,
                0: { transcript: r.transcript, confidence: r.confidence },
                length: 1,
              };
              return res;
            }),
          };
          mock.onresult?.(event);
        }

        mock.onend?.();
      }, 0);
    }),
    stop: vi.fn().mockImplementation(() => {
      mock.onend?.();
    }),
  };
  return mock;
}

// --- テスト ---

describe('isSpeechRecognitionAvailable', () => {
  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('window が存在しない場合は false', () => {
    expect(isSpeechRecognitionAvailable()).toBe(false);
  });

  it('SpeechRecognition が存在する場合は true', () => {
    (globalThis as any).window = { SpeechRecognition: vi.fn() };
    expect(isSpeechRecognitionAvailable()).toBe(true);
  });

  it('webkitSpeechRecognition が存在する場合は true', () => {
    (globalThis as any).window = { webkitSpeechRecognition: vi.fn() };
    expect(isSpeechRecognitionAvailable()).toBe(true);
  });
});

describe('AudioInput', () => {
  it('音声認識成功時に onEnd でテキストを返す（要件 1.3）', async () => {
    const mockRecog = createMockRecognition({
      results: [
        { transcript: '勤怠管理アプリを作りたい', confidence: 0.95, isFinal: true },
      ],
    });
    const audio = new AudioInput(() => mockRecog);

    const result = await new Promise<{ text: string; confidence: number }>((resolve, reject) => {
      audio.start({
        onEnd: resolve,
        onError: (msg) => reject(new Error(msg)),
      });
    });

    expect(result.text).toBe('勤怠管理アプリを作りたい');
    expect(result.confidence).toBe(0.95);
  });

  it('音声認識失敗時にエラーメッセージを返す（要件 1.4）', async () => {
    const mockRecog = createMockRecognition({ error: 'no-speech' });
    const audio = new AudioInput(() => mockRecog);

    const error = await new Promise<string>((resolve) => {
      audio.start({ onError: resolve });
    });

    expect(error).toBe(ERROR_MESSAGES.SPEECH_RECOGNITION_FAILED);
  });

  it('テキストが認識されなかった場合にエラーメッセージを返す', async () => {
    const mockRecog = createMockRecognition({ results: [] });
    const audio = new AudioInput(() => mockRecog);

    const error = await new Promise<string>((resolve) => {
      audio.start({ onError: resolve });
    });

    expect(error).toBe(ERROR_MESSAGES.SPEECH_RECOGNITION_FAILED);
  });

  it('中間結果を onResult で通知する（要件 1.2）', async () => {
    const mockRecog = createMockRecognition({
      results: [
        { transcript: '勤怠', confidence: 0.7, isFinal: false },
      ],
    });

    const results: Array<{ text: string; isFinal: boolean }> = [];
    const audio = new AudioInput(() => mockRecog);

    await new Promise<void>((resolve) => {
      audio.start({
        onResult: (text, isFinal) => results.push({ text, isFinal }),
        onEnd: () => resolve(),
        onError: () => resolve(),
      });
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].text).toBe('勤怠');
    expect(results[0].isFinal).toBe(false);
  });

  it('stop() で音声認識を停止できる', () => {
    const mockRecog = createMockRecognition();
    const audio = new AudioInput(() => mockRecog);
    audio.start();

    expect(audio.listening).toBe(true);

    audio.stop();
    expect(audio.listening).toBe(false);
  });

  it('SpeechRecognition が利用不可の場合にエラーメッセージを返す', async () => {
    const audio = new AudioInput(() => { throw new Error('not available'); });

    const error = await new Promise<string>((resolve) => {
      audio.start({ onError: resolve });
    });

    expect(error).toBe(ERROR_MESSAGES.SPEECH_RECOGNITION_FAILED);
  });

  it('言語が ja-JP に設定される', () => {
    const mockRecog = createMockRecognition();
    const audio = new AudioInput(() => mockRecog);
    audio.start();

    expect(mockRecog.lang).toBe('ja-JP');
  });
});
