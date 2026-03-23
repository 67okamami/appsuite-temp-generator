import { AudioInput, isSpeechRecognitionAvailable } from '../../src/audio/index.js';

export function initAudioButton(
  button: HTMLButtonElement,
  textArea: HTMLTextAreaElement,
): void {
  if (!isSpeechRecognitionAvailable()) {
    button.style.display = 'none';
    return;
  }

  const audio = new AudioInput();

  button.addEventListener('click', () => {
    if (audio.listening) {
      audio.stop();
      button.classList.remove('recording');
      return;
    }

    button.classList.add('recording');
    audio.start({
      onResult(text, isFinal) {
        if (!isFinal) return;
        textArea.value += text;
        textArea.dispatchEvent(new Event('input'));
      },
      onEnd() {
        button.classList.remove('recording');
      },
      onError(error) {
        button.classList.remove('recording');
        console.error('Speech recognition error:', error);
      },
    });
  });
}
