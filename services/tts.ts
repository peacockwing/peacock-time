export function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'ko-KR';
    utter.rate = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch (e) {
    console.warn('TTS failed', e);
  }
}
