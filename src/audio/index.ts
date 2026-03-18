// ============================================================
// 音声入力モジュール — Web Speech API を使用した音声→テキスト変換
// requirements.md 要件 1.1〜1.4 に準拠
// ============================================================

import { ERROR_MESSAGES } from '../types/errors.js';

/**
 * 音声認識の結果
 */
export interface SpeechResult {
  /** 認識されたテキスト */
  text: string;
  /** 認識の信頼度（0〜1） */
  confidence: number;
}

/**
 * 音声認識のコールバック
 */
export interface SpeechCallbacks {
  /** 認識結果が返ってきた時（中間結果含む） */
  onResult?: (text: string, isFinal: boolean) => void;
  /** 認識が完了した時 */
  onEnd?: (result: SpeechResult) => void;
  /** エラーが発生した時 */
  onError?: (error: string) => void;
}

/**
 * Web Speech API が利用可能かチェックする
 */
export function isSpeechRecognitionAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

/**
 * SpeechRecognition インスタンスを取得する
 */
function getSpeechRecognition(): any {
  if (typeof window === 'undefined') {
    throw new Error(ERROR_MESSAGES.SPEECH_RECOGNITION_FAILED);
  }
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    throw new Error(ERROR_MESSAGES.SPEECH_RECOGNITION_FAILED);
  }
  return new SpeechRecognition();
}

/**
 * AudioInput クラス — 音声入力→テキスト変換を管理する
 *
 * 責務:
 * - Web Speech API を使用したリアルタイム音声→テキスト変換
 * - 変換完了後のテキスト返却
 * - 音声認識失敗時のエラーメッセージ返却
 */
export class AudioInput {
  private recognition: any = null;
  private isListening = false;
  private createRecognition: () => any;

  /**
   * @param createRecognition カスタムの SpeechRecognition ファクトリ（テスト用）
   */
  constructor(createRecognition?: () => any) {
    this.createRecognition = createRecognition ?? getSpeechRecognition;
  }

  /**
   * 音声認識を開始する。
   * コールバックで中間結果・最終結果・エラーを通知する。
   */
  start(callbacks: SpeechCallbacks = {}): void {
    if (this.isListening) {
      this.stop();
    }

    try {
      this.recognition = this.createRecognition();
    } catch {
      callbacks.onError?.(ERROR_MESSAGES.SPEECH_RECOGNITION_FAILED);
      return;
    }

    this.recognition.lang = 'ja-JP';
    this.recognition.continuous = false;
    this.recognition.interimResults = true;

    let finalText = '';
    let finalConfidence = 0;

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
          finalConfidence = result[0].confidence;
          callbacks.onResult?.(finalText, true);
        } else {
          interimTranscript += result[0].transcript;
          callbacks.onResult?.(interimTranscript, false);
        }
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (finalText) {
        callbacks.onEnd?.({ text: finalText, confidence: finalConfidence });
      } else {
        callbacks.onError?.(ERROR_MESSAGES.SPEECH_RECOGNITION_FAILED);
      }
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      // "no-speech" や "audio-capture" 等のエラー
      callbacks.onError?.(ERROR_MESSAGES.SPEECH_RECOGNITION_FAILED);
    };

    this.recognition.start();
    this.isListening = true;
  }

  /**
   * 音声認識を停止する。
   */
  stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  /**
   * 現在音声認識中かどうか。
   */
  get listening(): boolean {
    return this.isListening;
  }
}
