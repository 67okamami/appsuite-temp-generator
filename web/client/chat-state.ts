import type { DesignInfo, ValidationResult, DesignDiff } from '../../src/types/index.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  result?: GenerateResultData | RegenerateResultData;
  timestamp: number;
}

export interface GenerateResultData {
  type: 'generate';
  design: DesignInfo;
  designDocument: string;
  guiGuide: string;
  validation: ValidationResult;
  zipBase64: string;
}

export interface RegenerateResultData {
  type: 'regenerate';
  design: DesignInfo;
  diff: DesignDiff;
  designDocument: string;
  guiGuide: string;
  validation: ValidationResult;
  zipBase64: string;
}

export type StateChangeHandler = () => void;

export class ChatState {
  messages: ChatMessage[] = [];
  originalInput: string = '';
  currentDesign: DesignInfo | null = null;
  isGenerating: boolean = false;

  private onChange: StateChangeHandler | null = null;

  setOnChange(handler: StateChangeHandler): void {
    this.onChange = handler;
  }

  private notify(): void {
    this.onChange?.();
  }

  addSystemMessage(content: string): void {
    this.messages.push({ role: 'system', content, timestamp: Date.now() });
    this.notify();
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: 'user', content, timestamp: Date.now() });
    this.notify();
  }

  addAssistantMessage(content: string, result?: GenerateResultData | RegenerateResultData): void {
    this.messages.push({ role: 'assistant', content, result, timestamp: Date.now() });
    this.notify();
  }

  addErrorMessage(content: string): void {
    this.messages.push({ role: 'error', content, timestamp: Date.now() });
    this.notify();
  }

  setGenerating(value: boolean): void {
    this.isGenerating = value;
    this.notify();
  }

  isFirstMessage(): boolean {
    return this.currentDesign === null;
  }

  applyGenerateResult(input: string, data: GenerateResultData): void {
    this.originalInput = input;
    this.currentDesign = data.design;
  }

  applyRegenerateResult(data: RegenerateResultData): void {
    this.currentDesign = data.design;
  }
}
